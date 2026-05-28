import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const LEAGUE_ID = 1 // FIFA World Cup (api-football v3)
const SEASON = 2026
const API_BASE = 'https://v3.football.api-sports.io'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ApiPlayer {
  player: {
    id: number
    name: string
    firstname: string
    lastname: string
    nationality: string
    number: number | null
    pos: string
    photo: string
  }
}

function normalizePosition(pos: string): 'GK' | 'DEF' | 'MID' | 'FWD' {
  const map: Record<string, 'GK' | 'DEF' | 'MID' | 'FWD'> = {
    G: 'GK', D: 'DEF', M: 'MID', F: 'FWD',
    Goalkeeper: 'GK', Defender: 'DEF', Midfielder: 'MID', Attacker: 'FWD',
  }
  return map[pos] ?? 'MID'
}

// Country name → ISO 2-char code mapping for common World Cup nations
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) return res.status(500).json({ error: 'API_FOOTBALL_KEY not set' })

  let page = 1
  let totalInserted = 0
  let hasMore = true

  while (hasMore) {
    const url = `${API_BASE}/players/squads?league=${LEAGUE_ID}&season=${SEASON}&page=${page}`
    const response = await fetch(url, {
      headers: { 'x-apisports-key': apiKey },
    })

    if (!response.ok) {
      return res.status(500).json({ error: `api-football error: ${response.status}` })
    }

    const data = await response.json() as {
      response: { team: { name: string; country: string }; players: ApiPlayer[] }[]
      paging: { current: number; total: number }
    }

    for (const { team, players } of data.response) {
      const countryCode = COUNTRY_TO_CODE[team.country] ?? team.country.slice(0, 2).toLowerCase()

      const rows = players.map(({ player: p }) => ({
        api_id: p.id,
        name: `${p.firstname} ${p.lastname}`.trim() || p.name,
        short_name: p.lastname || p.name,
        position: normalizePosition(p.pos),
        country: team.name,
        country_code: countryCode,
        photo_url: p.photo ?? null,
        jersey_number: p.number ?? null,
        seeded_at: new Date().toISOString(),
      }))

      const { error } = await supabase.from('players').upsert(rows, { onConflict: 'api_id' })
      if (error) console.error('upsert error:', error)
      else totalInserted += rows.length
    }

    hasMore = data.paging.current < data.paging.total
    page++
  }

  return res.status(200).json({ message: `seeded ${totalInserted} players` })
}
