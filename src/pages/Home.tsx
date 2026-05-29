import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

interface MyLeague {
  league_id: string
  leagues: { id: string; name: string; join_code: string } | null
}

export function Home() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [joinCode, setJoinCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [leagueName, setLeagueName] = useState('')
  const [showCreate, setShowCreate] = useState(() => searchParams.get('create') === '1')
  const [error, setError] = useState('')
  const [myLeagues, setMyLeagues] = useState<MyLeague[]>([])

  useEffect(() => {
    if (authLoading || !user) return
    supabase
      .from('league_members')
      .select('league_id, leagues(id, name, join_code)')
      .eq('user_id', user.id)
      .then(({ data }) => setMyLeagues((data as unknown as MyLeague[]) ?? []))
  }, [user, authLoading])

  async function handleJoin() {
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    navigate(`/join/${code}`)
  }

  async function handleCreate() {
    if (!leagueName.trim()) return
    if (authLoading) return
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(window.location.pathname + '?create=1')}`)
      return
    }
    setCreating(true)
    setError('')

    // Generate a 6-char code
    const code = Math.random().toString(36).slice(2, 8).toUpperCase()

    const { data, error: err } = await supabase
      .from('leagues')
      .insert({ name: leagueName.trim(), join_code: code, created_by: user.id, picks_locked: false })
      .select()
      .single()

    if (err) {
      setError('could not create league — try again')
      setCreating(false)
      return
    }

    // Auto-join as creator
    await supabase.from('league_members').insert({
      league_id: data.id,
      user_id: user.id,
      display_name: user.email?.split('@')[0] ?? 'you',
    })

    navigate(`/league/${data.id}`)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 sm:py-16">
      {/* Hero */}
      <div className="text-center mb-8 sm:mb-12 max-w-lg">
        <div className="text-6xl mb-4">⚽</div>
        <h1 className="text-4xl sm:text-5xl font-black text-text-primary mb-4 leading-tight">
          world cup<br />starting 11
        </h1>
        <p className="text-text-muted text-lg leading-relaxed">
          pick 11 players from any World Cup squad. score points for goals, assists, and wins.
          the twist: shared players split points — find the players nobody else picked.
        </p>
        <div className="mt-4 text-sm text-accent-gold font-semibold">
          FIFA World Cup 2026 · picks lock June 11
        </div>
      </div>

      {/* My leagues (authenticated users only) */}
      {myLeagues.length > 0 && (
        <div className="w-full max-w-sm mb-6">
          <div className="text-xs text-text-muted font-semibold uppercase tracking-wider mb-2">my leagues</div>
          <div className="flex flex-col gap-2">
            {myLeagues.map(({ league_id, leagues: league }) => league && (
              <Link
                key={league_id}
                to={`/league/${league.id}`}
                className="flex items-center justify-between bg-surface rounded-xl border border-border px-4 py-3 hover:border-accent-blue transition-colors"
              >
                <span className="font-semibold text-text-primary">{league.name}</span>
                <span className="font-mono text-xs text-accent-blue tracking-widest">{league.join_code}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="w-full max-w-sm flex flex-col gap-4">
        {/* Join */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="text-sm font-semibold text-text-muted mb-2">join a league</div>
          <div className="flex gap-2">
            <Input
              placeholder="enter code (e.g. ABC123)"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              maxLength={6}
              className="uppercase font-mono tracking-widest"
            />
            <Button onClick={handleJoin} disabled={joinCode.length !== 6}>
              join
            </Button>
          </div>
        </div>

        <div className="text-center text-text-muted text-sm">or</div>

        {/* Create */}
        {!showCreate ? (
          <Button variant="outline" size="lg" onClick={() => {
            if (!user) {
              navigate(`/login?next=${encodeURIComponent('/?create=1')}`)
            } else {
              setShowCreate(true)
            }
          }}>
            create a league
          </Button>
        ) : (
          <div className="bg-surface rounded-xl border border-border p-4 flex flex-col gap-3">
            <div className="text-sm font-semibold text-text-muted">create a league</div>
            <Input
              placeholder="league name"
              value={leagueName}
              onChange={e => setLeagueName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            {error && <div className="text-accent-red text-xs">{error}</div>}
            <Button onClick={handleCreate} disabled={creating || !leagueName.trim()} size="lg">
              {creating ? 'creating...' : 'create league'}
            </Button>
          </div>
        )}
      </div>

      {/* Scoring legend */}
      <div className="mt-16 max-w-sm w-full">
        <div className="text-xs text-text-muted font-semibold uppercase tracking-wider mb-3">scoring</div>
        <div className="grid grid-cols-2 gap-1 text-sm">
          {[
            ['goal', '+5 pts'],
            ['assist', '+3 pts'],
            ['team win', '+3 pts'],
            ['team draw', '+1 pt'],
            ['GK clean sheet', '+5 pts'],
            ['GK save', '+0.5 pts'],
          ].map(([label, pts]) => (
            <div key={label} className="flex justify-between px-3 py-2 bg-surface rounded-lg border border-border">
              <span className="text-text-muted">{label}</span>
              <span className="text-accent-gold font-semibold">{pts}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-text-muted bg-surface rounded-lg px-3 py-2 border border-border">
          points are split equally among all league members who picked the same player
        </div>
      </div>
    </div>
  )
}
