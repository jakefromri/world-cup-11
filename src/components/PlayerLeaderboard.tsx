import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { computeRawPoints } from '@/lib/scoring'
import { cn } from '@/lib/cn'

type Position = 'GK' | 'DEF' | 'MID' | 'FWD'

interface PlayerStat {
  playerId: string
  name: string
  shortName: string
  photoUrl: string | null
  country: string
  countryCode: string
  position: Position
  totalPoints: number
  goals: number
  assists: number
  saves: number
  cleanSheets: number
  matchesPlayed: number
}

const POSITION_ORDER: Position[] = ['FWD', 'MID', 'DEF', 'GK']
const POSITION_LABEL: Record<Position, string> = {
  FWD: 'forwards',
  MID: 'midfielders',
  DEF: 'defenders',
  GK: 'goalkeepers',
}

function statsLabel(p: PlayerStat): string {
  const parts: string[] = []
  if (p.goals > 0) parts.push(`${p.goals}G`)
  if (p.assists > 0) parts.push(`${p.assists}A`)
  if (p.position === 'GK' && p.cleanSheets > 0) parts.push(`${p.cleanSheets} CS`)
  if (p.position === 'GK' && p.saves > 0) parts.push(`${p.saves} saves`)
  if (parts.length === 0) parts.push(`${p.matchesPlayed} match${p.matchesPlayed !== 1 ? 'es' : ''}`)
  return parts.join(' · ')
}

export function PlayerLeaderboard() {
  const [players, setPlayers] = useState<PlayerStat[]>([])
  const [loading, setLoading] = useState(true)
  const [activePosition, setActivePosition] = useState<Position>('FWD')

  useEffect(() => {
    fetchStats()

    // Refetch whenever admin sync writes new/updated stats, so the
    // leaderboard reflects the latest fixtures without a manual reload.
    const channel = supabase
      .channel('player-leaderboard-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_match_stats' }, () => {
        fetchStats()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function fetchStats() {
    // PostgREST caps a single request at ~1000 rows, and this table now has
    // more than that — paginate so newly-synced stats aren't silently dropped.
    const pageSize = 1000
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = []
    for (let from = 0; ; from += pageSize) {
      const { data: page, error } = await supabase
        .from('player_match_stats')
        .select(`
          goals, assists, saves, clean_sheet,
          player:players(id, name, short_name, position, country, country_code, photo_url),
          match:matches(home_team, away_team, home_score, away_score, status)
        `)
        .range(from, from + pageSize - 1)

      if (error || !page) break
      data.push(...page)
      if (page.length < pageSize) break
    }

    if (data.length === 0) { setLoading(false); return }

    // Aggregate per player
    const map = new Map<string, PlayerStat>()

    for (const row of data) {
      const player = row.player as unknown as { id: string; name: string; short_name: string; position: Position; country: string; country_code: string; photo_url: string | null } | null
      const match = row.match as unknown as { home_team: string; away_team: string; home_score: number | null; away_score: number | null; status: string } | null

      if (!player || !match || match.status !== 'finished') continue
      if (match.home_score == null || match.away_score == null) continue

      const isHome = match.home_team === player.country
      const myScore = isHome ? match.home_score : match.away_score
      const theirScore = isHome ? match.away_score : match.home_score
      const result: 'win' | 'draw' | 'loss' =
        myScore > theirScore ? 'win' : myScore === theirScore ? 'draw' : 'loss'

      const rawPoints = computeRawPoints(
        row as any,
        player.position === 'GK',
        result,
      )

      const existing = map.get(player.id)
      if (existing) {
        existing.totalPoints += rawPoints
        existing.goals += row.goals
        existing.assists += row.assists
        existing.saves += row.saves
        if (row.clean_sheet) existing.cleanSheets += 1
        existing.matchesPlayed += 1
      } else {
        map.set(player.id, {
          playerId: player.id,
          name: player.name,
          shortName: player.short_name,
          photoUrl: player.photo_url,
          country: player.country,
          countryCode: player.country_code,
          position: player.position,
          totalPoints: rawPoints,
          goals: row.goals,
          assists: row.assists,
          saves: row.saves,
          cleanSheets: row.clean_sheet ? 1 : 0,
          matchesPlayed: 1,
        })
      }
    }

    setPlayers([...map.values()])
    setLoading(false)
  }

  const byPosition = players
    .filter(p => p.position === activePosition)
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 10)

  if (loading) {
    return (
      <div className="text-center text-text-muted py-6 text-sm">loading player stats...</div>
    )
  }

  if (players.length === 0) {
    return null
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-xs text-text-muted font-semibold uppercase tracking-wider mb-3">
        player leaderboard
      </div>

      {/* Position tabs */}
      <div className="flex rounded-lg border border-border overflow-hidden mb-3">
        {POSITION_ORDER.map(pos => (
          <button
            key={pos}
            onClick={() => setActivePosition(pos)}
            className={cn(
              'flex-1 py-1.5 text-xs font-semibold transition-colors',
              activePosition === pos
                ? 'bg-accent-blue text-white'
                : 'text-text-muted hover:text-text-primary bg-surface'
            )}
          >
            {pos}
          </button>
        ))}
      </div>

      {byPosition.length === 0 ? (
        <div className="text-center text-text-muted py-6 text-sm">
          no stats yet for {POSITION_LABEL[activePosition]}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {byPosition.map((p, idx) => (
            <div
              key={p.playerId}
              className="flex items-center gap-3 bg-surface rounded-xl border border-border px-3 py-2.5"
            >
              {/* Rank */}
              <span className="w-5 text-center flex-shrink-0">
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (
                  <span className="text-xs font-bold text-text-muted">{idx + 1}</span>
                )}
              </span>

              {/* Photo */}
              <div className="w-8 h-8 rounded-full overflow-hidden border border-border/50 bg-surface-raised flex-shrink-0">
                {p.photoUrl
                  ? <img src={p.photoUrl} alt={p.shortName} className="w-full h-full object-cover" />
                  : <span className="w-full h-full flex items-center justify-center text-[10px] font-bold text-text-muted">
                      {p.shortName.slice(0, 2).toUpperCase()}
                    </span>
                }
              </div>

              {/* Name + stats */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-text-primary truncate">{p.shortName}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <img
                    src={`https://flagcdn.com/w20/${p.countryCode.toLowerCase()}.png`}
                    alt={p.country}
                    className="w-3 h-2 object-cover rounded"
                  />
                  <span className="text-xs text-text-muted">
                    {statsLabel(p)}
                  </span>
                </div>
              </div>

              {/* Points */}
              <span className="text-accent-gold font-black text-base flex-shrink-0">
                {p.totalPoints % 1 === 0 ? p.totalPoints : p.totalPoints.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 text-xs text-text-muted text-center">
        raw points · not adjusted for picks
      </div>
    </div>
  )
}
