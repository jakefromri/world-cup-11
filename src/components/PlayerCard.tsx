import { useState } from 'react'
import { cn } from '@/lib/cn'
import type { Player } from '@/types'

const POSITION_COLORS: Record<string, string> = {
  GK: 'bg-accent-amber text-black',
  DEF: 'bg-accent-blue text-white',
  MID: 'bg-accent-green text-black',
  FWD: 'bg-accent-red text-white',
}

function getAge(birthDate: string | null): number | null {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

interface PlayerCardProps {
  player: Player
  points?: number
  selected?: boolean
  onClick?: () => void
  compact?: boolean
}

export function PlayerCard({ player, points, selected, onClick, compact }: PlayerCardProps) {
  const [expanded, setExpanded] = useState(false)
  const flagUrl = `https://flagcdn.com/w80/${player.country_code.toLowerCase()}.png`
  const age = getAge(player.birth_date)
  const isGK = player.position === 'GK'
  const hasDetail = !!(player.full_name || player.club_name)

  return (
    <div
      className={cn(
        'relative rounded-xl overflow-hidden select-none transition-colors duration-150',
        'border-2',
        selected
          ? 'border-accent-blue shadow-lg shadow-accent-blue/20'
          : 'border-border hover:border-border/80',
        !compact && expanded && 'row-span-2 self-stretch',
      )}
      style={{ background: 'linear-gradient(180deg, #1c1f2e 0%, #12141f 100%)' }}
    >
      {/* Flag wash */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `url(${flagUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(8px) saturate(2)',
        }}
      />

      {/* Compact section — tap to select */}
      <div
        onClick={onClick}
        className={cn(
          'relative z-10 flex flex-col items-center justify-end p-2 gap-1',
          onClick ? 'cursor-pointer active:scale-95' : 'cursor-default',
          compact ? 'h-28' : 'h-36 sm:h-44',
        )}
      >
        {selected && (
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent-blue flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {!compact && player.photo_url && (
          <img
            src={player.photo_url}
            alt={player.short_name}
            className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-full border border-border/50"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}

        <img
          src={`https://flagcdn.com/w40/${player.country_code.toLowerCase()}.png`}
          alt={player.country}
          className="w-6 h-4 object-cover rounded"
        />

        <div className={cn('font-bold text-text-primary leading-tight text-center', compact ? 'text-xs' : 'text-sm')}>
          {player.short_name}
        </div>

        <div className="flex items-center gap-1">
          <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded', POSITION_COLORS[player.position])}>
            {player.position}
          </span>
          {points !== undefined && (
            <span className="text-xs font-semibold text-accent-gold">{points.toFixed(1)} pts</span>
          )}
        </div>
      </div>

      {/* Chevron toggle */}
      {!compact && hasDetail && (
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
          className="relative z-10 w-full flex items-center justify-center gap-1 py-1 border-t border-white/5 text-[10px] font-semibold uppercase tracking-wide text-text-muted/50 hover:text-text-muted transition-colors"
        >
          details
          <svg
            className={cn('w-3 h-3 transition-transform duration-200', expanded && 'rotate-180')}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {/* Detail section */}
      {!compact && expanded && (
        <div className="relative z-10 px-2.5 pb-3 border-t border-white/[.06]">
          <div className="mt-2.5 text-xs font-bold text-text-primary">{player.full_name ?? player.name}</div>
          <div className="flex items-center gap-1 mt-0.5 mb-2.5 text-[10px] text-text-muted">
            <img
              src={`https://flagcdn.com/w20/${player.country_code.toLowerCase()}.png`}
              alt={player.country}
              className="w-3.5 h-2.5 object-cover rounded"
            />
            {player.country}{age !== null ? ` · age ${age}` : ''}
          </div>

          {player.club_name && (
            <div className="flex items-center gap-1.5 bg-white/[.04] border border-white/[.06] rounded-lg px-2 py-1.5 mb-2">
              {player.club_logo_url && (
                <img
                  src={player.club_logo_url}
                  alt={player.club_name}
                  className="w-5 h-5 object-contain flex-shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
              <div>
                <div className="text-[11px] font-semibold text-text-primary">{player.club_name}</div>
                {player.club_season && (
                  <div className="text-[9px] text-text-muted">{player.club_season}</div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1">
            {isGK ? (
              <>
                <StatBox value={player.club_saves} label="saves" color="text-purple-400" />
                <StatBox value={player.club_clean_sheets} label="clean sheets" color="text-accent-amber" />
              </>
            ) : (
              <>
                <StatBox value={player.club_goals} label="goals" color="text-accent-green" />
                <StatBox value={player.club_assists} label="assists" color="text-accent-blue" />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="bg-white/[.04] border border-white/[.06] rounded-lg p-1.5 text-center">
      <div className={cn('text-base font-black leading-none mb-0.5', color)}>{value}</div>
      <div className="text-[8px] font-semibold uppercase tracking-wider text-text-muted">{label}</div>
    </div>
  )
}
