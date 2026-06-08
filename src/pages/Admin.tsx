import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

const ADMIN_EMAIL = 'jakericciardi@gmail.com'

interface LeagueSummary {
  id: string
  name: string
  join_code: string
  picks_locked: boolean
  member_count: number
}

export function Admin() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [leagues, setLeagues] = useState<LeagueSummary[]>([])
  const [playerCount, setPlayerCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && user?.email !== ADMIN_EMAIL) {
      navigate('/')
    }
  }, [user?.email, authLoading, navigate])

  useEffect(() => {
    if (user?.email === ADMIN_EMAIL) fetchData()
  }, [user?.email])

  async function fetchData() {
    setLoading(true)

    const [{ data: leaguesData }, { count }] = await Promise.all([
      supabase.from('leagues').select('*, league_members(count)'),
      supabase.from('players').select('*', { count: 'exact', head: true }),
    ])

    setPlayerCount(count ?? 0)

    const summaries: LeagueSummary[] = (leaguesData ?? []).map((l: { id: string; name: string; join_code: string; picks_locked: boolean; league_members: { count: number }[] }) => ({
      id: l.id,
      name: l.name,
      join_code: l.join_code,
      picks_locked: l.picks_locked,
      member_count: l.league_members?.[0]?.count ?? 0,
    }))

    setLeagues(summaries)
    setLoading(false)
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/sync-scores', { method: 'POST' })
      const json = await res.json() as { message?: string }
      setSyncResult(json.message ?? 'sync complete')
    } catch {
      setSyncResult('sync failed — check logs')
    }
    setSyncing(false)
  }

  async function handleSeedPlayers() {
    setSeeding(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/seed-players', { method: 'POST' })
      const json = await res.json() as { message?: string }
      setSyncResult(json.message ?? 'seed complete')
      fetchData()
    } catch {
      setSyncResult('seed failed — check logs')
    }
    setSeeding(false)
  }

  async function toggleLock(leagueId: string, locked: boolean) {
    await supabase
      .from('leagues')
      .update({ picks_locked: !locked, picks_locked_at: !locked ? new Date().toISOString() : null })
      .eq('id', leagueId)
    fetchData()
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-text-muted">loading...</div>
  }

  return (
    <div className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-black text-text-primary mb-8">admin</h1>

      {/* Player sync */}
      <div className="bg-surface rounded-xl border border-border p-5 mb-6">
        <div className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">player data</div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-2xl font-bold text-text-primary">{playerCount}</div>
            <div className="text-xs text-text-muted">players in database</div>
          </div>
          <Button onClick={handleSeedPlayers} disabled={seeding} variant="outline">
            {seeding ? 'seeding...' : 'seed players'}
          </Button>
        </div>
        <Button onClick={handleSync} disabled={syncing} className="w-full">
          {syncing ? 'syncing...' : 'sync scores now'}
        </Button>
        {syncResult && (
          <div className="mt-3 text-sm text-text-muted bg-background rounded-lg px-3 py-2 border border-border">
            {syncResult}
          </div>
        )}
      </div>

      {/* Leagues */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
          leagues ({leagues.length})
        </div>
        <div className="flex flex-col gap-3">
          {leagues.map(l => (
            <div key={l.id} className="flex items-center gap-3 bg-background rounded-lg px-3 py-3 border border-border">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-text-primary text-sm truncate">{l.name}</div>
                <div className="text-xs text-text-muted">
                  code: <span className="font-mono text-accent-blue">{l.join_code}</span> · {l.member_count} members
                </div>
              </div>
              <button
                onClick={() => toggleLock(l.id, l.picks_locked)}
                className={`text-xs font-semibold px-2 py-1 rounded border ${l.picks_locked ? 'border-accent-red/50 text-accent-red' : 'border-accent-green/50 text-accent-green'}`}
              >
                {l.picks_locked ? 'locked' : 'open'}
              </button>
            </div>
          ))}
          {leagues.length === 0 && (
            <div className="text-text-muted text-sm">no leagues yet</div>
          )}
        </div>
      </div>
    </div>
  )
}
