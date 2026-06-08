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
  const { data: players, error } = await supabase
    .from('players')
    .select('id, api_id, position')
    .order('id')

  if (error) { console.error('fetch players failed:', error); process.exit(1) }
  console.log(`Enriching ${players.length} players from 2024 season...`)

  let done = 0
  let missed = 0

  for (const player of players) {
    await sleep(SLEEP_MS)

    let row = await fetchPlayerStats(player.api_id, 2024)
    // fall back to 2023 if no 2024 data
    if (!row) row = await fetchPlayerStats(player.api_id, 2023)

    if (!row) {
      missed++
      console.log(`  [MISS] api_id=${player.api_id}`)
      continue
    }

    const p = row.player
    const stats = row.statistics?.[0]

    const update = {
      full_name: p.name ?? null,
      birth_date: p.birth?.date ?? null,
      club_name: stats?.team?.name ?? null,
      club_logo_url: stats?.team?.logo ?? null,
      club_season: stats?.league?.season ? `${stats.league.season}-${String(stats.league.season + 1).slice(2)}` : null,
      club_goals: stats?.goals?.total ?? 0,
      club_assists: stats?.goals?.assists ?? 0,
      club_saves: stats?.goals?.saves ?? 0,
      club_clean_sheets: 0, // not available in player stats endpoint; populated separately if needed
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
