import { useState, useMemo } from 'react'
import { PlayerCard } from './PlayerCard'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { useToast } from './ui/toast'
import { cn } from '@/lib/cn'
import type { Player } from '@/types'

type Position = 'ALL' | 'GK' | 'DEF' | 'MID' | 'FWD'

interface PickerProps {
  players: Player[]
  onSubmit: (picks: { player: Player; slot: 'GK' | 'outfield' }[]) => Promise<void>
  submitting?: boolean
}

export function PlayerPicker({ players, onSubmit, submitting }: PickerProps) {
  const [selected, setSelected] = useState<Map<string, Player>>(new Map())
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState<Position>('ALL')
  const [countryFilter, setCountryFilter] = useState<string | null>(null)
  const { toast } = useToast()

  const countries = useMemo(() => {
    const seen = new Map<string, string>()
    for (const p of players) seen.set(p.country_code, p.country)
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [players])

  const filtered = useMemo(() => {
    return players.filter(p => {
      if (posFilter !== 'ALL' && p.position !== posFilter) return false
      if (countryFilter && p.country_code !== countryFilter) return false
      if (search && !p.short_name.toLowerCase().includes(search.toLowerCase()) &&
          !p.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [players, posFilter, countryFilter, search])

  const selectedList = [...selected.values()]
  const selectedGK = selectedList.find(p => p.position === 'GK')
  const selectedDEF = selectedList.filter(p => p.position === 'DEF').length
  const selectedMID = selectedList.filter(p => p.position === 'MID').length
  const selectedCount = selected.size

  function togglePlayer(player: Player) {
    const next = new Map(selected)

    if (next.has(player.id)) {
      next.delete(player.id)
      setSelected(next)
      return
    }

    if (player.position === 'GK' && selectedGK) {
      toast('swap your GK first — only 1 GK allowed', 'error')
      return
    }

    if (selectedCount >= 11) {
      toast('remove a player first — max 11', 'error')
      return
    }

    next.set(player.id, player)
    setSelected(next)
  }

  function handleSubmit() {
    if (selectedCount !== 11) return
    if (!selectedGK) return
    if (selectedDEF < 2) { toast('pick at least 2 defenders', 'error'); return }
    if (selectedMID < 2) { toast('pick at least 2 midfielders', 'error'); return }

    const picks = selectedList.map(p => ({
      player: p,
      slot: p.position === 'GK' ? ('GK' as const) : ('outfield' as const),
    }))
    onSubmit(picks)
  }

  const slots = Array.from({ length: 11 }, (_, i) => {
    const players = [...selected.values()]
    // GK first, then outfield
    const gk = players.find(p => p.position === 'GK')
    const outfield = players.filter(p => p.position !== 'GK')
    if (i === 0) return gk ?? null
    return outfield[i - 1] ?? null
  })

  return (
    <div className="flex flex-col h-full">
      {/* Sticky search + filters */}
      <div className="sticky top-0 z-20 bg-background pb-2 pt-3 px-4 border-b border-border">
        <Input
          placeholder="search players..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mb-2"
        />

        {/* Position + country filters — single scrollable row */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {(['ALL', 'GK', 'DEF', 'MID', 'FWD'] as Position[]).map(pos => (
            <button
              key={pos}
              onClick={() => setPosFilter(pos)}
              className={cn(
                'flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                posFilter === pos
                  ? 'bg-accent-blue border-accent-blue text-white'
                  : 'border-border text-text-muted hover:border-text-muted'
              )}
            >
              {pos}
            </button>
          ))}

          <div className="w-px bg-border flex-shrink-0 mx-0.5" />

          {countries.map(([code, name]) => (
            <button
              key={code}
              onClick={() => setCountryFilter(countryFilter === code ? null : code)}
              title={name}
              className={cn(
                'flex-shrink-0 w-8 h-6 rounded overflow-hidden border-2 transition-colors',
                countryFilter === code ? 'border-accent-blue' : 'border-transparent opacity-60 hover:opacity-100'
              )}
            >
              <img
                src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
                alt={name}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>

      {/* Player grid */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filtered.map(player => (
            <PlayerCard
              key={player.id}
              player={player}
              selected={selected.has(player.id)}
              onClick={() => togglePlayer(player)}
            />
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="text-center text-text-muted py-12">no players found</div>
        )}
        {/* Bottom padding for tray */}
        <div className="h-36" />
      </div>

      {/* Fixed bottom tray */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border px-4 py-3 z-30">
        {/* 11 slots */}
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
          {slots.map((player, i) => (
            <div
              key={i}
              onClick={() => player && togglePlayer(player)}
              className={cn(
                'relative flex-shrink-0 w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xs font-bold overflow-hidden',
                player ? 'cursor-pointer' : 'cursor-default',
                i === 0
                  ? player ? 'border-accent-amber' : 'border-accent-amber/40 text-accent-amber/60'
                  : player ? 'border-accent-blue' : 'border-border text-text-muted'
              )}
            >
              {player ? (
                <>
                  {player.photo_url
                    ? <img src={player.photo_url} alt={player.short_name} className="w-full h-full object-cover" />
                    : <span className="text-[10px] font-bold">{player.short_name.slice(0, 2).toUpperCase()}</span>
                  }
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <span className="text-white text-[10px] font-bold">✕</span>
                  </div>
                </>
              ) : (
                i === 0 ? 'GK' : i
              )}
            </div>
          ))}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={selectedCount !== 11 || !selectedGK || submitting}
          className="w-full"
          size="lg"
        >
          {submitting ? 'saving...' : (() => {
            if (selectedCount < 11) return `pick ${11 - selectedCount} more${!selectedGK ? ' (need a GK)' : ''}`
            if (!selectedGK) return 'need a GK'
            if (selectedDEF < 2) return 'need 2+ defenders'
            if (selectedMID < 2) return 'need 2+ midfielders'
            return 'lock in my team'
          })()}
        </Button>
      </div>
    </div>
  )
}
