import { useState } from 'react'
import { cn } from '@/lib/cn'
import type { LeaderboardEntry } from '@/types'

interface LeaderboardProps {
  entries: LeaderboardEntry[]
  currentMemberId?: string
  picksLocked: boolean
}

export function Leaderboard({ entries, currentMemberId, picksLocked }: LeaderboardProps) {
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)

  const sorted = [...entries].sort((a, b) => b.totalPoints - a.totalPoints)

  return (
    <div className="flex flex-col gap-2">
      {!picksLocked && (
        <div className="text-center text-sm text-text-muted bg-surface rounded-lg px-4 py-3 border border-border">
          picks aren't locked yet — leaderboard goes live at kickoff
        </div>
      )}

      {sorted.map((entry, idx) => {
        const rank = idx + 1
        const isMemberExpanded = expandedMember === entry.member.id
        const isMe = entry.member.id === currentMemberId

        return (
          <div
            key={entry.member.id}
            className={cn(
              'rounded-xl border transition-colors',
              isMe ? 'border-accent-blue/50 bg-surface-raised' : 'border-border bg-surface',
            )}
          >
            {/* Collapsed row */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
              onClick={() => {
                setExpandedMember(isMemberExpanded ? null : entry.member.id)
                setExpandedPlayer(null)
              }}
            >
              <span className={cn(
                'w-6 text-base font-black flex-shrink-0 text-right',
                rank === 1 && 'text-accent-gold',
                rank === 2 && 'text-gray-400',
                rank === 3 && 'text-amber-600',
                rank > 3 && 'text-text-muted',
              )}>
                {rank}
              </span>

              <span className="flex-1 min-w-0 font-semibold text-text-primary text-sm truncate">
                {entry.member.display_name}
                {isMe && <span className="ml-1 text-xs text-accent-blue flex-shrink-0">(you)</span>}
              </span>

              {/* Mini headshots */}
              <div className="hidden sm:flex gap-0.5 flex-shrink-0">
                {entry.picks.slice(0, 11).map(pick => (
                  <div key={pick.id} className="w-[18px] h-[18px] rounded-full overflow-hidden border border-border/50 bg-surface-raised flex-shrink-0">
                    {pick.player.photo_url
                      ? <img src={pick.player.photo_url} alt={pick.player.short_name} className="w-full h-full object-cover" />
                      : <span className="w-full h-full flex items-center justify-center text-[8px] font-bold text-text-muted">
                          {pick.player.short_name.slice(0, 1)}
                        </span>
                    }
                  </div>
                ))}
              </div>

              <span className={cn(
                'font-black text-base flex-shrink-0 w-14 text-right',
                picksLocked ? 'text-accent-gold' : 'text-text-muted'
              )}>
                {picksLocked ? entry.totalPoints.toFixed(1) : '—'}
              </span>

              <svg
                className={cn('w-4 h-4 text-text-muted transition-transform flex-shrink-0', isMemberExpanded && 'rotate-180')}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded: full team */}
            {isMemberExpanded && (
              <div className="px-4 pb-4 border-t border-border pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {entry.picks.map(pick => {
                    const pp = entry.playerPoints[pick.player_id]
                    const pts = pp?.total ?? 0
                    const isPlayerExpanded = expandedPlayer === `${entry.member.id}-${pick.player_id}`

                    return (
                      <div key={pick.id} className="rounded-lg border border-border overflow-hidden">
                        {/* Player row */}
                        <button
                          className="w-full flex items-center gap-2 bg-background px-3 py-2 text-left hover:bg-surface transition-colors"
                          onClick={() => setExpandedPlayer(
                            isPlayerExpanded ? null : `${entry.member.id}-${pick.player_id}`
                          )}
                        >
                          <div className="w-8 h-8 rounded-full overflow-hidden border border-border/50 bg-surface-raised flex-shrink-0">
                            {pick.player.photo_url
                              ? <img src={pick.player.photo_url} alt={pick.player.short_name} className="w-full h-full object-cover" />
                              : <span className="w-full h-full flex items-center justify-center text-[10px] font-bold text-text-muted">
                                  {pick.player.short_name.slice(0, 2).toUpperCase()}
                                </span>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-text-primary truncate">{pick.player.short_name}</div>
                            <div className="flex items-center gap-1">
                              <img
                                src={`https://flagcdn.com/w20/${pick.player.country_code.toLowerCase()}.png`}
                                alt={pick.player.country}
                                className="w-3 h-2 object-cover rounded"
                              />
                              <span className="text-xs text-text-muted">{pick.player.position}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className={cn('text-sm font-bold', pts > 0 ? 'text-accent-gold' : 'text-text-muted')}>
                              {picksLocked ? pts.toFixed(1) : '—'}
                            </span>
                            {picksLocked && pp?.breakdown.length > 0 && (
                              <svg
                                className={cn('w-3 h-3 text-text-muted transition-transform', isPlayerExpanded && 'rotate-180')}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </div>
                        </button>

                        {/* Per-match breakdown */}
                        {isPlayerExpanded && pp?.breakdown.length > 0 && (
                          <div className="border-t border-border bg-surface">
                            {pp.breakdown.map((b, i) => (
                              <div key={i} className="flex items-start gap-2 px-3 py-2 border-b border-border/50 last:border-0 text-xs">
                                <span className={cn(
                                  'w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0',
                                  b.result === 'win' && 'bg-accent-green',
                                  b.result === 'draw' && 'bg-accent-amber',
                                  b.result === 'loss' && 'bg-accent-red',
                                )} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-text-muted truncate">{b.homeTeam} vs {b.awayTeam}</div>
                                  <div className="text-text-muted/70 mt-0.5 flex gap-2 flex-wrap">
                                    {b.result === 'win' && <span className="text-accent-green">W</span>}
                                    {b.result === 'draw' && <span className="text-accent-amber">D</span>}
                                    {b.result === 'loss' && <span className="text-accent-red">L</span>}
                                    {b.goals > 0 && <span>{b.goals}G</span>}
                                    {b.assists > 0 && <span>{b.assists}A</span>}
                                    {b.saves > 0 && <span>{b.saves} saves</span>}
                                    {b.cleanSheet && pick.slot === 'GK' && <span>CS</span>}
                                    {b.pickerCount > 1 && <span className="text-text-muted/50">÷{b.pickerCount}</span>}
                                  </div>
                                </div>
                                <span className="text-accent-gold font-semibold flex-shrink-0">
                                  +{b.splitPoints.toFixed(1)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {entries.length === 0 && (
        <div className="text-center text-text-muted py-12">no members yet</div>
      )}
    </div>
  )
}
