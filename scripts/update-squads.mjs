// Sync official WC 2026 squads from api-football /players/squads
// Marks wc_squad=true for the 26-man roster of each team.
// Inserts any players missing from the DB.
// Usage:
//   node scripts/update-squads.mjs          ← dev
//   node scripts/update-squads.mjs --prod   ← prod
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] })
)

const isProd = process.argv.includes('--prod')
const SUPABASE_URL = isProd ? 'https://wspafzifrnpkfzpglkqn.supabase.co' : env.VITE_SUPABASE_URL
const SUPABASE_KEY = isProd
  ? process.env.PROD_SERVICE_ROLE_KEY ?? (() => { console.error('Set PROD_SERVICE_ROLE_KEY'); process.exit(1) })()
  : env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const API_KEY = env.API_FOOTBALL_KEY
const API_BASE = 'https://v3.football.api-sports.io'
const sleep = ms => new Promise(r => setTimeout(r, ms))

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

function shortNameFromAbbreviated(name) {
  // "T. Courtois" → "Courtois", "K. De Bruyne" → "De Bruyne"
  return name.replace(/^\w+\.\s*/, '').trim() || name
}

console.log(`Target: ${isProd ? 'PROD' : 'dev'}`)

// Step 1: reset all wc_squad flags
console.log('Resetting wc_squad flags...')
const { error: resetErr } = await supabase.from('players').update({ wc_squad: false }).gte('api_id', 0)
if (resetErr) { console.error('Reset failed:', resetErr.message); process.exit(1) }

// Step 2: fetch each team's squad and upsert
let totalMarked = 0
let totalInserted = 0

for (const { id: teamId, name: country } of WC_TEAMS) {
  await sleep(350)
  const res = await fetch(`${API_BASE}/players/squads?team=${teamId}`, {
    headers: { 'x-apisports-key': API_KEY },
  })
  const data = await res.json()
  const squadPlayers = data.response?.[0]?.players ?? []

  if (squadPlayers.length === 0) {
    console.log(`  [MISS] ${country} — no squad data`)
    continue
  }

  const countryCode = COUNTRY_TO_CODE[country]
  const rows = squadPlayers.map(p => ({
    api_id: p.id,
    name: shortNameFromAbbreviated(p.name), // used as display name fallback
    short_name: shortNameFromAbbreviated(p.name),
    position: normalizePosition(p.position),
    country,
    country_code: countryCode,
    photo_url: p.photo ?? null,
    jersey_number: p.number ?? null,
    wc_squad: true,
    // preserve existing enrichment data on conflict
  }))

  const { error } = await supabase
    .from('players')
    .upsert(rows, { onConflict: 'api_id', ignoreDuplicates: false })

  if (error) {
    console.error(`  [ERR] ${country}:`, error.message)
  } else {
    totalMarked += squadPlayers.length
    console.log(`  ✓ ${country}: ${squadPlayers.length} players`)
  }
}

console.log(`\nDone. ${totalMarked} players marked wc_squad=true.`)
console.log('Run enrich-players.mjs next to refresh club stats.')
