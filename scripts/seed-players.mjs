// One-shot seed script — run with: node scripts/seed-players.mjs
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf-8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(p => p.trim()))
    .map(([k, ...v]) => [k, v.join('=')])
)

const API_BASE = 'https://v3.football.api-sports.io'

// WC 2022 team IDs → names (from api-football /teams?league=1&season=2022)
const WC_TEAMS = [
  { id: 1,    name: 'Belgium' },
  { id: 2,    name: 'France' },
  { id: 3,    name: 'Croatia' },
  { id: 6,    name: 'Brazil' },
  { id: 7,    name: 'Uruguay' },
  { id: 9,    name: 'Spain' },
  { id: 10,   name: 'England' },
  { id: 12,   name: 'Japan' },
  { id: 13,   name: 'Senegal' },
  { id: 14,   name: 'Serbia' },
  { id: 15,   name: 'Switzerland' },
  { id: 16,   name: 'Mexico' },
  { id: 17,   name: 'South Korea' },
  { id: 20,   name: 'Australia' },
  { id: 21,   name: 'Denmark' },
  { id: 22,   name: 'Iran' },
  { id: 23,   name: 'Saudi Arabia' },
  { id: 24,   name: 'Poland' },
  { id: 25,   name: 'Germany' },
  { id: 26,   name: 'Argentina' },
  { id: 27,   name: 'Portugal' },
  { id: 28,   name: 'Tunisia' },
  { id: 29,   name: 'Costa Rica' },
  { id: 31,   name: 'Morocco' },
  { id: 767,  name: 'Wales' },
  { id: 1118, name: 'Netherlands' },
  { id: 1504, name: 'Ghana' },
  { id: 1530, name: 'Cameroon' },
  { id: 1569, name: 'Qatar' },
  { id: 2382, name: 'Ecuador' },
  { id: 2384, name: 'USA' },
  { id: 5529, name: 'Canada' },
]

const COUNTRY_TO_CODE = {
  'Argentina': 'ar', 'Australia': 'au', 'Belgium': 'be', 'Brazil': 'br',
  'Cameroon': 'cm', 'Canada': 'ca', 'Costa Rica': 'cr', 'Croatia': 'hr',
  'Denmark': 'dk', 'Ecuador': 'ec', 'England': 'gb-eng', 'France': 'fr',
  'Germany': 'de', 'Ghana': 'gh', 'Iran': 'ir', 'Japan': 'jp',
  'Mexico': 'mx', 'Morocco': 'ma', 'Netherlands': 'nl', 'Poland': 'pl',
  'Portugal': 'pt', 'Qatar': 'qa', 'Saudi Arabia': 'sa', 'Senegal': 'sn',
  'Serbia': 'rs', 'South Korea': 'kr', 'Spain': 'es', 'Switzerland': 'ch',
  'Tunisia': 'tn', 'USA': 'us', 'Uruguay': 'uy', 'Wales': 'gb-wls',
}

function normalizePosition(pos) {
  return { Goalkeeper: 'GK', Defender: 'DEF', Midfielder: 'MID', Attacker: 'FWD' }[pos] ?? 'MID'
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// Find which teams are already seeded so we don't waste quota re-fetching them
const { data: seededRows } = await supabase.from('players').select('country')
const seededCountries = new Set((seededRows ?? []).map(r => r.country))
console.log(`Already seeded: ${[...seededCountries].join(', ') || 'none'}\n`)

let totalInserted = 0

for (const { id: teamId, name: teamName } of WC_TEAMS) {
  if (seededCountries.has(teamName)) {
    console.log(`skip ${teamName} (already in DB)`)
    continue
  }

  await sleep(6500) // free plan: 10 req/min

  const res = await fetch(`${API_BASE}/players/squads?team=${teamId}`, {
    headers: { 'x-apisports-key': env.API_FOOTBALL_KEY },
  })
  const data = await res.json()

  if (!data.response?.[0]) {
    console.log(`${teamName}: no data — ${JSON.stringify(data.errors ?? {})}`)
    continue
  }

  const { team, players } = data.response[0]
  const countryCode = COUNTRY_TO_CODE[team.name] ?? team.name.slice(0, 2).toLowerCase()

  const rows = players.map(p => ({
    api_id: p.id,
    name: p.name,
    short_name: p.name.split(' ').pop(),
    position: normalizePosition(p.position),
    country: team.name,
    country_code: countryCode,
    photo_url: p.photo ?? null,
    jersey_number: p.number ?? null,
    seeded_at: new Date().toISOString(),
  }))

  const { error } = await supabase.from('players').upsert(rows, { onConflict: 'api_id' })
  if (error) {
    console.error(`${teamName} upsert error:`, error.message)
  } else {
    totalInserted += rows.length
    console.log(`✓ ${team.name}: ${rows.length} players`)
  }
}

console.log(`\nDone — seeded ${totalInserted} new players this run`)
