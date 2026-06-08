// Manually add a missing player by name + country
// Usage:
//   node scripts/add-player.mjs "Courtois" "Belgium"          ← targets dev
//   node scripts/add-player.mjs "Courtois" "Belgium" --prod   ← targets prod
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] })
)

// Two modes:
//   by name:  node scripts/add-player.mjs "Courtois" "Belgium" [--prod]
//   by id:    node scripts/add-player.mjs --id 730 "Belgium" [--prod]
const args = process.argv.slice(2)
const isProd = args.includes('--prod')
const idIdx = args.indexOf('--id')
const byId = idIdx !== -1
const apiIdArg = byId ? parseInt(args[idIdx + 1]) : null
const searchName = byId ? null : args[0]
const searchCountry = byId ? args[idIdx + 2] : args[1]

if ((!searchName && !apiIdArg) || !searchCountry) {
  console.error('Usage:')
  console.error('  node scripts/add-player.mjs "<name>" "<country>" [--prod]')
  console.error('  node scripts/add-player.mjs --id <api_id> "<country>" [--prod]')
  process.exit(1)
}

// isProd already set above
const SUPABASE_URL = isProd
  ? 'https://wspafzifrnpkfzpglkqn.supabase.co'
  : env.VITE_SUPABASE_URL
const SUPABASE_KEY = isProd
  ? process.env.PROD_SERVICE_ROLE_KEY ?? (() => { console.error('Set PROD_SERVICE_ROLE_KEY env var for --prod'); process.exit(1) })()
  : env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const API_KEY = env.API_FOOTBALL_KEY
const API_BASE = 'https://v3.football.api-sports.io'

const COUNTRY_TO_TEAM_ID = {
  'Algeria': 1532, 'Argentina': 26, 'Australia': 20, 'Austria': 775,
  'Belgium': 1, 'Bosnia & Herzegovina': 1113, 'Brazil': 6,
  'Canada': 5529, 'Cape Verde Islands': 1533, 'Colombia': 8,
  'Congo DR': 1508, 'Croatia': 3, 'Curaçao': 5530,
  'Czech Republic': 770, 'Ecuador': 2382, 'Egypt': 32,
  'England': 10, 'France': 2, 'Germany': 25, 'Ghana': 1504,
  'Haiti': 2386, 'Iran': 22, 'Iraq': 1567, 'Ivory Coast': 1501,
  'Japan': 12, 'Jordan': 1548, 'Mexico': 16, 'Morocco': 31,
  'Netherlands': 1118, 'New Zealand': 4673, 'Norway': 1090,
  'Panama': 11, 'Paraguay': 2380, 'Portugal': 27, 'Qatar': 1569,
  'Saudi Arabia': 23, 'Scotland': 1108, 'Senegal': 13,
  'South Africa': 1531, 'South Korea': 17, 'Spain': 9,
  'Sweden': 5, 'Switzerland': 15, 'Tunisia': 28, 'Türkiye': 777,
  'Uruguay': 7, 'USA': 2384, 'Uzbekistan': 1568,
}

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

function getAge(birthDate) {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

const countryCode = COUNTRY_TO_CODE[searchCountry]
if (!countryCode) {
  console.error(`Unknown country "${searchCountry}". Check COUNTRY_TO_CODE map.`)
  process.exit(1)
}

const teamId = COUNTRY_TO_TEAM_ID[searchCountry]
if (!teamId) {
  console.error(`No team ID for "${searchCountry}". Check COUNTRY_TO_TEAM_ID map.`)
  process.exit(1)
}

let player, statistics

if (byId) {
  console.log(`Fetching api-football player id=${apiIdArg}...`)
  const res = await fetch(`${API_BASE}/players?id=${apiIdArg}&season=2024`, {
    headers: { 'x-apisports-key': API_KEY },
  })
  const data = await res.json()
  if (!data.response?.[0]) {
    // fall back to 2023
    const res2 = await fetch(`${API_BASE}/players?id=${apiIdArg}&season=2023`, {
      headers: { 'x-apisports-key': API_KEY },
    })
    const data2 = await res2.json()
    if (!data2.response?.[0]) { console.error('Player not found'); process.exit(1) }
    ;({ player, statistics } = data2.response[0])
  } else {
    ;({ player, statistics } = data.response[0])
  }
} else {
  console.log(`Searching "${searchName}" in ${searchCountry} squad (team ${teamId})...`)
  const res = await fetch(`${API_BASE}/players?team=${teamId}&season=2026`, {
    headers: { 'x-apisports-key': API_KEY },
  })
  const data = await res.json()
  if (data.errors && Object.keys(data.errors).length > 0) {
    console.error('API error:', data.errors); process.exit(1)
  }
  const results = (data.response ?? []).filter(r =>
    r.player.name.toLowerCase().includes(searchName.toLowerCase()) ||
    r.player.lastname?.toLowerCase().includes(searchName.toLowerCase())
  )
  if (results.length === 0) {
    console.log(`No match for "${searchName}" in ${searchCountry} squad. Full squad:`)
    for (const r of data.response ?? []) {
      console.log(`  id=${r.player.id}  ${r.player.name}  (${r.statistics?.[0]?.games?.position ?? '?'})`)
    }
    console.log(`\nTry: node scripts/add-player.mjs --id <id> "${searchCountry}"`)
    process.exit(1)
  }
  if (results.length > 1) {
    console.log('Multiple matches — use --id:')
    for (const r of results) console.log(`  id=${r.player.id}  ${r.player.name}`)
    process.exit(1)
  }
  ;({ player, statistics } = results[0])
}
const stats = statistics?.[0]
const position = normalizePosition(stats?.games?.position ?? 'Midfielder')

const fullName = (player.firstname && player.lastname)
  ? `${player.firstname} ${player.lastname}`
  : player.name

const row = {
  api_id: player.id,
  name: fullName,
  short_name: player.lastname || player.name.split(' ').pop(),
  full_name: fullName,
  position,
  country: searchCountry,
  country_code: countryCode,
  photo_url: player.photo ?? null,
  jersey_number: null,
  birth_date: player.birth?.date ?? null,
  club_name: stats?.team?.name ?? null,
  club_logo_url: stats?.team?.logo ?? null,
  club_season: stats?.league?.season ? `${stats.league.season}-${String(stats.league.season + 1).slice(2)}` : null,
  club_goals: stats?.goals?.total ?? 0,
  club_assists: stats?.goals?.assists ?? 0,
  club_saves: stats?.goals?.saves ?? 0,
  club_clean_sheets: 0,
}

console.log(`\nFound: ${row.name} (${row.position}, ${row.country}, age ${getAge(row.birth_date)})`)
console.log(`Club: ${row.club_name ?? 'unknown'}`)
console.log(`\nInserting into ${isProd ? 'PROD' : 'dev'}...`)

const { error } = await supabase
  .from('players')
  .upsert(row, { onConflict: 'api_id' })

if (error) {
  console.error('Insert failed:', error.message)
  process.exit(1)
}

console.log(`Done. ${row.name} added.`)
