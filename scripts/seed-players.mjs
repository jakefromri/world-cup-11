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

// WC 2026 team IDs → names (from api-football /teams?league=1&season=2026)
const WC_TEAMS = [
  { id: 1,    name: 'Belgium' },
  { id: 2,    name: 'France' },
  { id: 3,    name: 'Croatia' },
  { id: 5,    name: 'Sweden' },
  { id: 6,    name: 'Brazil' },
  { id: 7,    name: 'Uruguay' },
  { id: 8,    name: 'Colombia' },
  { id: 9,    name: 'Spain' },
  { id: 10,   name: 'England' },
  { id: 11,   name: 'Panama' },
  { id: 12,   name: 'Japan' },
  { id: 13,   name: 'Senegal' },
  { id: 15,   name: 'Switzerland' },
  { id: 16,   name: 'Mexico' },
  { id: 17,   name: 'South Korea' },
  { id: 20,   name: 'Australia' },
  { id: 22,   name: 'Iran' },
  { id: 23,   name: 'Saudi Arabia' },
  { id: 25,   name: 'Germany' },
  { id: 26,   name: 'Argentina' },
  { id: 27,   name: 'Portugal' },
  { id: 28,   name: 'Tunisia' },
  { id: 31,   name: 'Morocco' },
  { id: 32,   name: 'Egypt' },
  { id: 770,  name: 'Czech Republic' },
  { id: 775,  name: 'Austria' },
  { id: 777,  name: 'Türkiye' },
  { id: 1090, name: 'Norway' },
  { id: 1108, name: 'Scotland' },
  { id: 1113, name: 'Bosnia & Herzegovina' },
  { id: 1118, name: 'Netherlands' },
  { id: 1501, name: 'Ivory Coast' },
  { id: 1504, name: 'Ghana' },
  { id: 1508, name: 'Congo DR' },
  { id: 1531, name: 'South Africa' },
  { id: 1532, name: 'Algeria' },
  { id: 1533, name: 'Cape Verde Islands' },
  { id: 1548, name: 'Jordan' },
  { id: 1567, name: 'Iraq' },
  { id: 1568, name: 'Uzbekistan' },
  { id: 1569, name: 'Qatar' },
  { id: 2380, name: 'Paraguay' },
  { id: 2382, name: 'Ecuador' },
  { id: 2384, name: 'USA' },
  { id: 2386, name: 'Haiti' },
  { id: 4673, name: 'New Zealand' },
  { id: 5529, name: 'Canada' },
  { id: 5530, name: 'Curaçao' },
]

const COUNTRY_TO_CODE = {
  'Algeria': 'dz', 'Argentina': 'ar', 'Australia': 'au', 'Austria': 'at',
  'Belgium': 'be', 'Bosnia & Herzegovina': 'ba', 'Brazil': 'br',
  'Canada': 'ca', 'Cape Verde Islands': 'cv', 'Colombia': 'co',
  'Congo DR': 'cd', 'Croatia': 'hr', 'Curaçao': 'cw',
  'Czech Republic': 'cz', 'Ecuador': 'ec', 'Egypt': 'eg',
  'England': 'gb-eng', 'France': 'fr', 'Germany': 'de', 'Ghana': 'gh',
  'Haiti': 'ht', 'Iran': 'ir', 'Iraq': 'iq', 'Ivory Coast': 'ci',
  'Japan': 'jp', 'Jordan': 'jo', 'Mexico': 'mx', 'Morocco': 'ma',
  'Netherlands': 'nl', 'New Zealand': 'nz', 'Norway': 'no',
  'Panama': 'pa', 'Paraguay': 'py', 'Portugal': 'pt', 'Qatar': 'qa',
  'Saudi Arabia': 'sa', 'Scotland': 'gb-sct', 'Senegal': 'sn',
  'South Africa': 'za', 'South Korea': 'kr', 'Spain': 'es',
  'Sweden': 'se', 'Switzerland': 'ch', 'Tunisia': 'tn', 'Türkiye': 'tr',
  'Uruguay': 'uy', 'USA': 'us', 'Uzbekistan': 'uz',
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

  // Fetch all pages for this team (20 players/page)
  const players = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    await sleep(700) // pro plan: 100 req/min
    const res = await fetch(`${API_BASE}/players?team=${teamId}&season=2026&page=${page}`, {
      headers: { 'x-apisports-key': env.API_FOOTBALL_KEY },
    })
    const data = await res.json()

    if (data.errors && Object.keys(data.errors).length > 0) {
      console.log(`${teamName} p${page}: API error — ${JSON.stringify(data.errors)}`)
      break
    }

    totalPages = data.paging?.total ?? 1
    for (const { player, statistics } of data.response ?? []) {
      const position = statistics?.[0]?.games?.position ?? 'Midfielder'
      players.push({ player, position })
    }
    page++
  }

  if (players.length === 0) {
    console.log(`${teamName}: no players returned`)
    continue
  }

  const countryCode = COUNTRY_TO_CODE[teamName] ?? teamName.slice(0, 2).toLowerCase()

  const rows = players.map(({ player, position }) => ({
    api_id: player.id,
    name: player.name,
    short_name: player.name.split(' ').pop(),
    position: normalizePosition(position),
    country: teamName,
    country_code: countryCode,
    photo_url: player.photo ?? null,
    jersey_number: null,
    seeded_at: new Date().toISOString(),
  }))

  const { error } = await supabase.from('players').upsert(rows, { onConflict: 'api_id' })
  if (error) {
    console.error(`${teamName} upsert error:`, error.message)
  } else {
    totalInserted += rows.length
    console.log(`✓ ${teamName}: ${rows.length} players`)
  }
}

console.log(`\nDone — seeded ${totalInserted} new players this run`)
