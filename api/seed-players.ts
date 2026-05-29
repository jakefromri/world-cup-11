import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const API_BASE = 'https://v3.football.api-sports.io'

// WC 2022 team IDs from api-football — good stand-in for 2026 dev data.
// Free plan supports /players/squads?team={id} but not league+season for 2026.
const WC_TEAM_IDS = [
  1, 2, 3, 6, 7, 9, 10, 12, 13, 14, 15, 16, 17, 20, 21, 22, 23, 24, 25, 26,
  27, 28, 29, 31, 767, 1118, 1504, 1530, 1569, 2382, 2384, 5529,
]

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function normalizePosition(pos: string): 'GK' | 'DEF' | 'MID' | 'FWD' {
  const map: Record<string, 'GK' | 'DEF' | 'MID' | 'FWD'> = {
    G: 'GK', D: 'DEF', M: 'MID', F: 'FWD',
    Goalkeeper: 'GK', Defender: 'DEF', Midfielder: 'MID', Attacker: 'FWD',
  }
  return map[pos] ?? 'MID'
}

const COUNTRY_TO_CODE: Record<string, string> = {
  'Argentina': 'ar', 'Australia': 'au', 'Austria': 'at', 'Belgium': 'be',
  'Brazil': 'br', 'Cameroon': 'cm', 'Canada': 'ca', 'Chile': 'cl',
  'Colombia': 'co', 'Croatia': 'hr', 'Denmark': 'dk', 'Ecuador': 'ec',
  'Egypt': 'eg', 'England': 'gb-eng', 'France': 'fr', 'Germany': 'de',
  'Ghana': 'gh', 'Honduras': 'hn', 'Iran': 'ir', 'Italy': 'it',
  'Japan': 'jp', 'Mexico': 'mx', 'Morocco': 'ma', 'Netherlands': 'nl',
  'New Zealand': 'nz', 'Nigeria': 'ng', 'Panama': 'pa', 'Paraguay': 'py',
  'Peru': 'pe', 'Poland': 'pl', 'Portugal': 'pt', 'Qatar': 'qa',
  'Saudi Arabia': 'sa', 'Senegal': 'sn', 'Serbia': 'rs', 'South Korea': 'kr',
  'Spain': 'es', 'Switzerland': 'ch', 'Tunisia': 'tn', 'Turkey': 'tr',
  'USA': 'us', 'United States': 'us', 'Uruguay': 'uy', 'Wales': 'gb-wls',
  'Costa Rica': 'cr', 'Slovakia': 'sk', 'Czech Republic': 'cz', 'Romania': 'ro',
  'Ukraine': 'ua', 'Scotland': 'gb-sct', 'Ireland': 'ie', 'Algeria': 'dz',
  'Ivory Coast': 'ci', 'Mali': 'ml', 'Zambia': 'zm', 'Congo DR': 'cd',
  'South Africa': 'za', 'Guatemala': 'gt', 'Venezuela': 've', 'Bolivia': 'bo',
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) return res.status(500).json({ error: 'API_FOOTBALL_KEY not set' })

  let totalInserted = 0
  const errors: string[] = []

  for (const teamId of WC_TEAM_IDS) {
    await sleep(200) // stay under rate limit

    const url = `${API_BASE}/players/squads?team=${teamId}`
    const response = await fetch(url, {
      headers: { 'x-apisports-key': apiKey },
    })

    if (!response.ok) {
      errors.push(`team ${teamId}: HTTP ${response.status}`)
      continue
    }

    const data = await response.json() as {
      response: {
        team: { id: number; name: string; country: string }
        players: {
          id: number; name: string; age: number
          number: number | null; position: string; photo: string
        }[]
      }[]
      errors: Record<string, string>
    }

    if (Object.keys(data.errors ?? {}).length > 0) {
      errors.push(`team ${teamId}: ${JSON.stringify(data.errors)}`)
      continue
    }

    const entry = data.response?.[0]
    if (!entry) continue

    const { team, players } = entry
    const countryCode = COUNTRY_TO_CODE[team.name] ?? team.name.slice(0, 2).toLowerCase()

    const rows = players.map(p => ({
      api_id: p.id,
      name: p.name,
      short_name: p.name.split(' ').slice(-1)[0], // last name
      position: normalizePosition(p.position),
      country: team.name,
      country_code: countryCode,
      photo_url: p.photo ?? null,
      jersey_number: p.number ?? null,
      seeded_at: new Date().toISOString(),
    }))

    const { error } = await supabase.from('players').upsert(rows, { onConflict: 'api_id' })
    if (error) {
      errors.push(`team ${teamId} upsert: ${error.message}`)
    } else {
      totalInserted += rows.length
      console.log(`seeded ${team.name}: ${rows.length} players`)
    }
  }

  return res.status(200).json({
    message: `seeded ${totalInserted} players across ${WC_TEAM_IDS.length} teams`,
    errors: errors.length > 0 ? errors : undefined,
  })
}
