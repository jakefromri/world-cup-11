import { useState } from 'react'
import { cn } from '@/lib/cn'
import type { LeaderboardEntry } from '@/types'

interface LeaderboardProps {
  entries: LeaderboardEntry[]
  currentMemberId?: string
  picksLocked: boolean
}

export function Leaderboard({ entries, currentMemberId, picksLocked }: LeaderboardProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

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
        const isExpanded = expanded === entry.member.id
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
              onClick={() => setExpanded(isExpanded ? null : entry.member.id)}
            >
              {/* Rank */}
              <span className={cn(
                'w-8 text-lg font-bold flex-shrink-0',
                rank === 1 && 'text-accent-gold',
                rank === 2 && 'text-gray-400',
                rank === 3 && 'text-amber-600',
                rank > 3 && 'text-text-muted',
              )}>
                {rank}
              </span>

              {/* Name */}
              <span className="flex-1 font-semibold text-text-primary">
                {entry.member.display_name}
                {isMe && <span className="ml-2 text-xs text-accent-blue">(you)</span>}
              </span>

              {/* Mini flags */}
              <div className="hidden sm:flex gap-0.5 flex-shrink-0">
                {entry.picks.slice(0, 11).map(pick => (
                  <img
                    key={pick.id}
                    src={`https://flagcdn.com/w20/${pick.player.country_code.toLowerCase()}.png`}
                    alt={pick.player.country_code}
                    className="w-4 h-3 object-cover rounded"
                  />
                ))}
              </div>

              {/* Points */}
              <span className="text-accent-gold font-bold text-lg flex-shrink-0">
                {picksLocked ? entry.totalPoints.toFixed(1) : '—'}
              </span>

              {/* Chevron */}
              <svg
                className={cn('w-4 h-4 text-text-muted transition-transform flex-shrink-0', isExpanded && 'rotate-180')}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded: full team */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-border pt-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {entry.picks.map(pick => (
                    <div key={pick.id} className="flex items-center gap-2 bg-background rounded-lg px-3 py-2">
                      <img
                        src={`https://flagcdn.com/w40/${pick.player.country_code.toLowerCase()}.png`}
                        alt={pick.player.country}
                        className="w-6 h-4 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-text-primary truncate">
                          {pick.player.short_name}
                        </div>
                        <div className="text-xs text-text-muted">{pick.player.position}</div>
                      </div>
                      {picksLocked && (
                        <span className="text-xs text-accent-gold font-semibold flex-shrink-0">
                          {/* per-player points would go here */}
                          —
                        </span>
                      )}
                    </div>
                  ))}
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
