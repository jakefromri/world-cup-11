import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import type { League } from '@/types'

export function Join() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [league, setLeague] = useState<League | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [, setAlreadyMember] = useState(false)

  useEffect(() => {
    if (!code) return
    fetchLeague()
  }, [code])

  useEffect(() => {
    if (user) {
      setDisplayName(user.email?.split('@')[0] ?? '')
      checkMembership()
    }
  }, [user, league])

  async function fetchLeague() {
    setLoading(true)
    const { data, error: fetchErr } = await supabase
      .from('leagues')
      .select('*')
      .eq('join_code', code!)
      .single()

    console.log('fetchLeague code:', code, 'data:', data, 'error:', fetchErr)

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
      .from('league_members')
      .select('id')
      .eq('league_id', league.id)
      .eq('user_id', user.id)
      .single()

    if (data) {
      setAlreadyMember(true)
      navigate(`/league/${league.id}`, { replace: true })
    }
  }

  async function handleJoin() {
    if (!user) {
      navigate(`/login?next=/join/${code}`)
      return
    }
    if (!league || !displayName.trim()) return

    setJoining(true)
    setError('')

    const { error: err } = await supabase.from('league_members').insert({
      league_id: league.id,
      user_id: user.id,
      display_name: displayName.trim(),
    })

    if (err) {
      setError('could not join — you may already be a member')
      setJoining(false)
      return
    }

    navigate(`/league/${league.id}`)
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏆</div>
          <h1 className="text-2xl font-black text-text-primary">{league?.name}</h1>
          <div className="text-text-muted text-sm mt-1">{memberCount} member{memberCount !== 1 ? 's' : ''}</div>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-text-muted font-semibold uppercase tracking-wider block mb-1.5">
              your name in the league
            </label>
            <Input
              placeholder="display name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              maxLength={24}
            />
            <div className="text-xs text-text-muted mt-1">this is what others see on the leaderboard</div>
          </div>

          {error && <div className="text-accent-red text-xs">{error}</div>}

          {league?.picks_locked && (
            <div className="text-xs text-accent-amber bg-accent-amber/10 rounded-lg px-3 py-2 border border-accent-amber/20">
              picks are locked — you can join and view the leaderboard but can't make picks
            </div>
          )}

          <Button onClick={handleJoin} disabled={joining || !displayName.trim()} size="lg">
            {joining ? 'joining...' : user ? 'join league' : 'sign in & join'}
          </Button>
        </div>
      </div>
    </div>
  )
}
