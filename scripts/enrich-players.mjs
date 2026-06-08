import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] })
)

const SUPABASE_URL = process.env.SUPABASE_URL ?? env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const API_KEY = env.API_FOOTBALL_KEY
const API_BASE = 'https://v3.football.api-sports.io'
const SLEEP_MS = 250 // 300 req/min = 1 per 200ms; 250ms to be safe

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function fetchPlayerStats(apiId, season) {
  const res = await fetch(`${API_BASE}/players?id=${apiId}&season=${season}`, {
    headers: { 'x-apisports-key': API_KEY },
  })
  if (!res.ok) { console.error(`HTTP ${res.status} for api_id=${apiId}`); return null }
  const data = await res.json()
  return data.response?.[0] ?? null
}

async function main() {
  const [p1, p2] = await Promise.all([
    supabase.from('players').select('id, api_id, position').eq('wc_squad', true).order('id').range(0, 999),
    supabase.from('players').select('id, api_id, position').eq('wc_squad', true).order('id').range(1000, 1999),
  ])
  if (p1.error) { console.error('fetch players failed:', p1.error); process.exit(1) }
  const players = [...(p1.data ?? []), ...(p2.data ?? [])]
  console.log(`Enriching ${players.length} wc_squad players (2025→2024→2023)...`)

  let done = 0
  let missed = 0

  for (const player of players) {
    await sleep(SLEEP_MS)

    let row = await fetchPlayerStats(player.api_id, 2025)
    if (!row) row = await fetchPlayerStats(player.api_id, 2024)
    if (!row) row = await fetchPlayerStats(player.api_id, 2023)

    if (!row) {
      missed++
      console.log(`  [MISS] api_id=${player.api_id}`)
      continue
    }

    const p = row.player
    const allStats = row.statistics ?? []

    // Full name from firstname + lastname, not the abbreviated p.name
    const fullName = (p.firstname && p.lastname)
      ? `${p.firstname} ${p.lastname}`
      : p.name ?? null

    // Primary club = most minutes played across all competitions
    const primaryStats = allStats.reduce((best, s) =>
      (s.games?.minutes ?? 0) > (best?.games?.minutes ?? 0) ? s : best
    , allStats[0])

    // Sum goals/assists/saves across ALL competitions
    const totalGoals = allStats.reduce((n, s) => n + (s.goals?.total ?? 0), 0)
    const totalAssists = allStats.reduce((n, s) => n + (s.goals?.assists ?? 0), 0)
    const totalSaves = allStats.reduce((n, s) => n + (s.goals?.saves ?? 0), 0)

    const season = primaryStats?.league?.season
    const update = {
      full_name: fullName,
      birth_date: p.birth?.date ?? null,
      club_name: primaryStats?.team?.name ?? null,
      club_logo_url: primaryStats?.team?.logo ?? null,
      club_season: season ? `${season}-${String(season + 1).slice(2)}` : null,
      club_goals: totalGoals,
      club_assists: totalAssists,
      club_saves: totalSaves,
      club_clean_sheets: 0,
    }

    const { error: updateErr } = await supabase
      .from('players')
      .update(update)
      .eq('id', player.id)

    if (updateErr) {
      console.error(`  [ERR] id=${player.id}:`, updateErr.message)
      missed++
    } else {
      done++
      if (done % 100 === 0) console.log(`  ${done}/${players.length}...`)
    }
  }

  console.log(`\nDone. ${done} enriched, ${missed} missed.`)
}

main()
