import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'
import type { League } from '@/types'

// Synthetic email for username-only accounts — never shown to users
function syntheticEmail(username: string) {
  return `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@wc11.play`
}

export function Join() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [league, setLeague] = useState<League | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // New account form
  const [playerName, setPlayerName] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [showSignIn, setShowSignIn] = useState(false)
  const [signInPassword, setSignInPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!code) return
    fetchLeague()
  }, [code])

  useEffect(() => {
    if (!authLoading && user && league) checkMembership()
  }, [user?.id, authLoading, league])

  async function fetchLeague() {
    setLoading(true)
    const { data, error: fetchErr } = await supabase
      .from('leagues').select('*').eq('join_code', code!).single()

    if (!data) {
      setError(`league not found — check the code (${fetchErr?.message ?? 'no data'})`)
      setLoading(false)
      return
    }
    setLeague(data)

    const { count } = await supabase
      .from('league_members')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', data.id)

    setMemberCount(count ?? 0)
    setLoading(false)
  }

  async function checkMembership() {
    if (!league || !user) return
    const { data } = await supabase
      .from('league_members').select('id')
      .eq('league_id', league.id).eq('user_id', user.id).single()
    if (data) navigate(`/league/${league.id}`, { replace: true })
  }

  async function joinLeague(userId: string, displayName: string) {
    const { error: err } = await supabase.from('league_members').insert({
      league_id: league!.id,
      user_id: userId,
      display_name: displayName.trim(),
    })
    if (err) {
      setError('could not join — you may already be a member')
      return false
    }
    return true
  }

  async function handleCreateAndJoin() {
    if (!league || !playerName.trim() || !password) return
    if (password.length < 6) { setError('password must be at least 6 characters'); return }
    if (!/^[a-zA-Z0-9_\- ]+$/.test(playerName)) {
      setError('player name can only contain letters, numbers, spaces, - and _')
      return
    }

    setSubmitting(true)
    setError('')

    const useEmail = email.trim() || syntheticEmail(playerName)

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email: useEmail,
      password,
      options: { data: { username: playerName.trim(), synthetic_email: !email.trim() } },
    })

    if (signUpErr) {
      // Username taken (synthetic email already exists)
      if (signUpErr.message.includes('already registered') || signUpErr.message.includes('already been registered')) {
        setError('that player name is already taken — try a different one')
      } else {
        setError(signUpErr.message)
      }
      setSubmitting(false)
      return
    }

    if (!data.user) {
      setError('signup failed — try again')
      setSubmitting(false)
      return
    }

    const joined = await joinLeague(data.user.id, playerName.trim())
    if (joined) navigate(`/league/${league.id}`)
    setSubmitting(false)
  }

  async function handleSignInAndJoin() {
    if (!league || !playerName.trim() || !signInPassword) return
    setSubmitting(true)
    setError('')

    // Detect email vs username
    const loginEmail = playerName.includes('@') ? playerName.trim() : syntheticEmail(playerName)

    const { data, error: signInErr } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: signInPassword,
    })

    if (signInErr) {
      setError('wrong player name or password')
      setSubmitting(false)
      return
    }

    // Check if already a member
    const { data: existing } = await supabase.from('league_members').select('id')
      .eq('league_id', league.id).eq('user_id', data.user.id).single()

    if (existing) {
      navigate(`/league/${league.id}`)
      return
    }

    const displayName = data.user.user_metadata?.username ?? playerName.trim()
    const joined = await joinLeague(data.user.id, displayName)
    if (joined) navigate(`/league/${league.id}`)
    setSubmitting(false)
  }

  if (loading || authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-text-muted">loading...</div>
  }

  if (error && !league) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <div className="text-4xl mb-4">😕</div>
        <div className="text-text-primary font-semibold mb-2">{error}</div>
        <Button variant="ghost" onClick={() => navigate('/')}>back home</Button>
      </div>
    )
  }

  // Already logged in → just show join button
  if (user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-4xl mb-3">🏆</div>
            <h1 className="text-2xl font-black text-text-primary">{league?.name}</h1>
            <div className="text-text-muted text-sm mt-1">{memberCount} member{memberCount !== 1 ? 's' : ''}</div>
          </div>
          {error && <div className="text-accent-red text-xs mb-3">{error}</div>}
          {league?.picks_locked && (
            <div className="text-xs text-accent-amber bg-accent-amber/10 rounded-lg px-3 py-2 border border-accent-amber/20 mb-3">
              picks are locked — you can join and view the leaderboard but can't make picks
            </div>
          )}
          <Button
            onClick={async () => {
              setSubmitting(true)
              const joined = await joinLeague(user.id, user.user_metadata?.username ?? user.email?.split('@')[0] ?? 'player')
              if (joined) navigate(`/league/${league!.id}`)
              setSubmitting(false)
            }}
            disabled={submitting}
            size="lg"
            className="w-full"
          >
            {submitting ? 'joining...' : 'join league'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* League info */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🏆</div>
          <h1 className="text-2xl font-black text-text-primary">{league?.name}</h1>
          <div className="text-text-muted text-sm mt-1">{memberCount} member{memberCount !== 1 ? 's' : ''} · enter to join</div>
        </div>

        {/* Tab toggle */}
        <div className="flex rounded-lg bg-surface border border-border p-1 mb-4">
          <button
            onClick={() => { setShowSignIn(false); setError('') }}
            className={cn(
              'flex-1 py-1.5 text-sm font-semibold rounded transition-colors',
              !showSignIn ? 'bg-accent-blue text-white' : 'text-text-muted hover:text-text-primary'
            )}
          >
            new player
          </button>
          <button
            onClick={() => { setShowSignIn(true); setError('') }}
            className={cn(
              'flex-1 py-1.5 text-sm font-semibold rounded transition-colors',
              showSignIn ? 'bg-accent-blue text-white' : 'text-text-muted hover:text-text-primary'
            )}
          >
            returning player
          </button>
        </div>

        {!showSignIn ? (
          /* New player signup */
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-text-muted font-semibold uppercase tracking-wider block mb-1.5">
                pick a player name
              </label>
              <Input
                placeholder="e.g. GoatFinder99"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                maxLength={20}
                autoFocus
              />
              <div className="text-xs text-text-muted mt-1">this is what others see on the leaderboard</div>
            </div>

            <div>
              <label className="text-xs text-text-muted font-semibold uppercase tracking-wider block mb-1.5">
                password
              </label>
              <Input
                type="password"
                placeholder="at least 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateAndJoin()}
              />
            </div>

            <div>
              <label className="text-xs text-text-muted font-semibold uppercase tracking-wider block mb-1.5">
                email <span className="text-text-muted/50 font-normal normal-case">(optional — for account recovery)</span>
              </label>
              <Input
                type="email"
                placeholder="your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateAndJoin()}
              />
            </div>

            {error && <div className="text-accent-red text-xs">{error}</div>}

            {league?.picks_locked && (
              <div className="text-xs text-accent-amber bg-accent-amber/10 rounded-lg px-3 py-2 border border-accent-amber/20">
                picks are locked — you can join and view the leaderboard but can't make picks
              </div>
            )}

            <Button
              onClick={handleCreateAndJoin}
              disabled={submitting || !playerName.trim() || !password}
              size="lg"
              className="w-full"
            >
              {submitting ? 'joining...' : 'join & start picking →'}
            </Button>
          </div>
        ) : (
          /* Returning player sign in */
          <div className="flex flex-col gap-3">
            <Input
              placeholder="player name or email"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              autoFocus
            />
            <Input
              type="password"
              placeholder="password"
              value={signInPassword}
              onChange={e => setSignInPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSignInAndJoin()}
            />
            {error && <div className="text-accent-red text-xs">{error}</div>}
            <Button
              onClick={handleSignInAndJoin}
              disabled={submitting || !playerName.trim() || !signInPassword}
              size="lg"
              className="w-full"
            >
              {submitting ? 'signing in...' : 'sign in & join →'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
