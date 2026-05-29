// Seed WC 2022 match data + player stats for testing scoring.
// Usage:
//   node scripts/seed-historical.mjs --phase 1   (group stage only, through Dec 2 2022)
//   node scripts/seed-historical.mjs --phase 2   (full tournament through Dec 18 2022)

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf-8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(p => p.trim()))
    .map(([k, ...v]) => [k, v.join('=')])
)

const phase = process.argv.includes('--phase') ? process.argv[process.argv.indexOf('--phase') + 1] : '1'
const CUTOFF = phase === '1' ? new Date('2022-12-03T00:00:00Z') : new Date('2022-12-19T00:00:00Z')

console.log(`Phase ${phase} — seeding matches through ${CUTOFF.toDateString()}\n`)

const API_BASE = 'https://v3.football.api-sports.io'
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const sleep = ms => new Promise(r => setTimeout(r, ms))

function parseStage(round) {
  if (round.includes('Group')) return 'group'
  if (round.includes('Round of 32')) return 'r32'
  if (round.includes('Round of 16')) return 'r16'
  if (round.includes('Quarter')) return 'qf'
  if (round.includes('Semi')) return 'sf'
  if (round.includes('Final')) return 'final'
  return 'group'
}

// 1. Fetch all WC 2022 fixtures
console.log('Fetching WC 2022 fixtures...')
const fixturesRes = await fetch(`${API_BASE}/fixtures?league=1&season=2022`, {
  headers: { 'x-apisports-key': env.API_FOOTBALL_KEY },
})
const fixturesData = await fixturesRes.json()

if (fixturesData.errors && Object.keys(fixturesData.errors).length > 0) {
  console.error('API error:', fixturesData.errors)
  process.exit(1)
}

const allFixtures = fixturesData.response ?? []
console.log(`Got ${allFixtures.length} total fixtures`)

// Filter to finished games before the cutoff
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN'])
const targetFixtures = allFixtures.filter(f => {
  const matchDate = new Date(f.fixture.date)
  return FINISHED_STATUSES.has(f.fixture.status.short) && matchDate < CUTOFF
})

console.log(`${targetFixtures.length} finished fixtures before cutoff\n`)

// 2. Upsert match rows for all target fixtures
const matchRows = targetFixtures.map(f => ({
  api_id: f.fixture.id,
  home_team: f.teams.home.name,
  away_team: f.teams.away.name,
  home_country_code: '',
  away_country_code: '',
  home_score: f.goals.home ?? 0,
  away_score: f.goals.away ?? 0,
  status: FINISHED_STATUSES.has(f.fixture.status.short) ? 'finished' : 'scheduled',
  stage: parseStage(f.league.round),
  match_date: f.fixture.date,
  synced_at: new Date().toISOString(),
}))

const { error: matchUpsertErr } = await supabase
  .from('matches')
  .upsert(matchRows, { onConflict: 'api_id' })

if (matchUpsertErr) {
  console.error('Match upsert error:', matchUpsertErr.message)
  process.exit(1)
}
console.log(`Upserted ${matchRows.length} matches\n`)

// 3. Check which fixtures already have stats synced (skip them on re-run)
const { data: syncedMatches } = await supabase
  .from('matches')
  .select('api_id')
  .not('synced_at', 'is', null)
const syncedApiIds = new Set((syncedMatches ?? []).map(m => m.api_id))

// 4. Fetch and upsert player stats for each fixture
let totalStats = 0
let skipped = 0

for (const fixture of targetFixtures) {
  const fixtureId = fixture.fixture.id

  await sleep(2100) // Pro plan: 30 req/min → 2s between calls

  const statsRes = await fetch(`${API_BASE}/fixtures/players?fixture=${fixtureId}`, {
    headers: { 'x-apisports-key': env.API_FOOTBALL_KEY },
  })
  const statsData = await statsRes.json()

  if (statsData.errors && Object.keys(statsData.errors).length > 0) {
    console.log(`  fixture ${fixtureId}: API error — ${JSON.stringify(statsData.errors)}`)
    continue
  }

  // Look up our match row
  const { data: matchRow } = await supabase
    .from('matches')
    .select('id')
    .eq('api_id', fixtureId)
    .single()

  if (!matchRow) {
    console.log(`  fixture ${fixtureId}: match row not found`)
    continue
  }

  const { home_score: homeScore, away_score: awayScore } = matchRows.find(m => m.api_id === fixtureId) ?? {}

  const teamEntries = statsData.response ?? [] // [{team, players:[]}]
  let fixtureStats = 0

  for (const teamEntry of teamEntries) {
    const teamName = teamEntry.team.name
    const isHomeTeam = teamName === fixture.teams.home.name
    const teamScore = isHomeTeam ? homeScore : awayScore
    const opponentScore = isHomeTeam ? awayScore : homeScore

    for (const { player, statistics } of teamEntry.players) {
      const s = statistics?.[0]
      if (!s) continue

      const minutes = s.games?.minutes ?? 0
      if (minutes === 0) continue

      // Look up player in our DB
      const { data: playerRow } = await supabase
        .from('players')
        .select('id')
        .eq('api_id', player.id)
        .single()

      if (!playerRow) continue // player not in our seeded list (fine — not all WC 2022 players are in current squads)

      const goals = s.goals?.total ?? 0
      const assists = s.goals?.assists ?? 0
      const saves = s.goalkeeper?.saves ?? 0
      const yellowCard = (s.cards?.yellow ?? 0) > 0
      const redCard = (s.cards?.red ?? 0) > 0
      const cleanSheet = opponentScore === 0

      const { error } = await supabase.from('player_match_stats').upsert({
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

      if (!error) fixtureStats++
    }
  }

  const date = fixture.fixture.date.slice(0, 10)
  console.log(`✓ ${fixture.teams.home.name} vs ${fixture.teams.away.name} (${date}): ${fixtureStats} player rows`)
  totalStats += fixtureStats
}

console.log(`\nDone — ${totalStats} player_match_stats rows seeded`)
