import { cn } from '@/lib/cn'
import type { Player } from '@/types'

const POSITION_COLORS: Record<string, string> = {
  GK: 'bg-accent-amber text-black',
  DEF: 'bg-accent-blue text-white',
  MID: 'bg-accent-green text-black',
  FWD: 'bg-accent-red text-white',
}

interface PlayerCardProps {
  player: Player
  points?: number
  selected?: boolean
  onClick?: () => void
  compact?: boolean
}

export function PlayerCard({ player, points, selected, onClick, compact }: PlayerCardProps) {
  const flagUrl = `https://flagcdn.com/w80/${player.country_code.toLowerCase()}.png`

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200 select-none',
        'border-2',
        selected
          ? 'border-accent-blue shadow-lg shadow-accent-blue/20'
          : 'border-border hover:border-border/80',
        compact ? 'h-28' : 'h-44',
        onClick && 'active:scale-95'
      )}
      style={{
        background: `linear-gradient(180deg, #1c1f2e 0%, #12141f 100%)`,
      }}
    >
      {/* Flag background */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url(${flagUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(8px) saturate(2)',
        }}
      />

      {/* Selected checkmark */}
      {selected && (
        <div className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-accent-blue flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center justify-end h-full p-2 gap-1">
        {/* Player photo */}
        {!compact && player.photo_url && (
          <img
            src={player.photo_url}
            alt={player.short_name}
            className="w-16 h-16 object-cover rounded-full border border-border/50"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}

        {/* Country flag (small) */}
        <img
          src={`https://flagcdn.com/w40/${player.country_code.toLowerCase()}.png`}
          alt={player.country}
          className="w-6 h-4 object-cover rounded"
        />

        {/* Name */}
        <div className="text-center">
          <div className={cn('font-bold text-text-primary leading-tight', compact ? 'text-xs' : 'text-sm')}>
            {player.short_name}
          </div>
        </div>

        {/* Position badge + points */}
        <div className="flex items-center gap-1">
          <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded', POSITION_COLORS[player.position])}>
            {player.position}
          </span>
          {points !== undefined && (
            <span className="text-xs font-semibold text-accent-gold">{points.toFixed(1)} pts</span>
          )}
        </div>
      </div>
    </div>
  )
}
