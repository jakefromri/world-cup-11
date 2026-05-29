import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const LEAGUE_ID = 1
const SEASON = 2026
const API_BASE = 'https://v3.football.api-sports.io'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ApiFixture {
  fixture: { id: number; status: { short: string }; date: string }
  league: { round: string }
  teams: {
    home: { name: string; winner: boolean | null }
    away: { name: string; winner: boolean | null }
  }
  goals: { home: number | null; away: number | null }
}

interface ApiPlayerStat {
  player: { id: number; name: string }
  statistics: {
    goals: { total: number | null; assists: number | null }
    games: { minutes: number | null }
    cards: { yellow: number; red: number }
    goalkeeper?: { saves: number | null }
    passes?: { accuracy: string | null }
  }[]
}

function parseStage(round: string): string {
  if (round.includes('Group')) return 'group'
  if (round.includes('Round of 32')) return 'r32'
  if (round.includes('Round of 16')) return 'r16'
  if (round.includes('Quarter')) return 'qf'
  if (round.includes('Semi')) return 'sf'
  if (round.includes('Final')) return 'final'
  return 'group'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) return res.status(500).json({ error: 'API_FOOTBALL_KEY not set' })

  // 1. Fetch all fixtures from api-football
  const fixturesRes = await fetch(
    `${API_BASE}/fixtures?league=${LEAGUE_ID}&season=${SEASON}`,
    { headers: { 'x-apisports-key': apiKey } }
  )
  const fixturesData = await fixturesRes.json() as { response: ApiFixture[] }
  const allFixtures = fixturesData.response ?? []

  // 2. Get already-synced match api_ids
  const { data: syncedMatches } = await supabase
    .from('matches')
    .select('api_id, synced_at')
    .not('synced_at', 'is', null)

  const syncedIds = new Set((syncedMatches ?? []).map(m => m.api_id))

  const finished = allFixtures.filter(
    f => f.fixture.status.short === 'FT' && !syncedIds.has(f.fixture.id)
  )

  // 3. Upsert all matches (scheduled + finished) for the fixture list
  const matchRows = allFixtures.map(f => ({
    api_id: f.fixture.id,
    home_team: f.teams.home.name,
    away_team: f.teams.away.name,
    home_country_code: '',
    away_country_code: '',
    home_score: f.goals.home,
    away_score: f.goals.away,
    status: f.fixture.status.short === 'FT' ? 'finished' : f.fixture.status.short === '1H' || f.fixture.status.short === '2H' ? 'live' : 'scheduled',
    stage: parseStage(f.league.round),
    match_date: f.fixture.date,
    synced_at: f.fixture.status.short === 'FT' ? new Date().toISOString() : null,
  }))

  await supabase.from('matches').upsert(matchRows, { onConflict: 'api_id' })

  // 4. Fetch player stats for each newly-finished fixture
  let statsSynced = 0
  for (const fixture of finished) {
    const statsRes = await fetch(
      `${API_BASE}/fixtures/players?fixture=${fixture.fixture.id}`,
      { headers: { 'x-apisports-key': apiKey } }
    )
    const statsData = await statsRes.json() as { response: { players: ApiPlayerStat[] }[] }

    // Get our match id
    const { data: matchRow } = await supabase
      .from('matches')
      .select('id')
      .eq('api_id', fixture.fixture.id)
      .single()

    if (!matchRow) continue

    const allPlayerStats: ApiPlayerStat[] = (statsData.response ?? []).flatMap(t => t.players)

    for (const { player, statistics } of allPlayerStats) {
      const s = statistics[0]
      if (!s) continue

      // Lookup player by api_id
      const { data: playerRow } = await supabase
        .from('players')
        .select('id')
        .eq('api_id', player.id)
        .single()

      if (!playerRow) continue

      const minutes = s.games?.minutes ?? 0
      if (minutes === 0) continue // didn't play

      const goals = s.goals?.total ?? 0
      const assists = s.goals?.assists ?? 0
      const saves = s.goalkeeper?.saves ?? 0
      const yellowCard = (s.cards?.yellow ?? 0) > 0
      const redCard = (s.cards?.red ?? 0) > 0
      // Clean sheet: GK played full 90 and goals conceded = 0
      const cleanSheet = opponentScore === 0

      await supabase.from('player_match_stats').upsert({
        player_id: playerRow.id,
        match_id: matchRow.id,
        goals,
        assists,
        saves,
        minutes_played: minutes,
        clean_sheet: cleanSheet,
        yellow_card: yellowCard,
        red_card: redCard,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'player_id,match_id' })

      statsSynced++
    }
  }

  return res.status(200).json({
    message: `synced ${finished.length} fixtures, ${statsSynced} player stat rows`,
  })
}
