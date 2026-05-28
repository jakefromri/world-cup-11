import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Leaderboard } from '@/components/Leaderboard'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'
import type { League as LeagueType, LeagueMember, Pick, Player, LeaderboardEntry } from '@/types'

type Tab = 'leaderboard' | 'my-team'

export function League() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [tab, setTab] = useState<Tab>('leaderboard')
  const [league, setLeague] = useState<LeagueType | null>(null)
  const [myMember, setMyMember] = useState<LeagueMember | null>(null)
  const [myPicks, setMyPicks] = useState<(Pick & { player: Player })[]>([])
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!id) return
    fetchAll()
  }, [id, user])

  async function fetchAll() {
    setLoading(true)

    const [{ data: leagueData }, { data: membersData }] = await Promise.all([
      supabase.from('leagues').select('*').eq('id', id!).single(),
      supabase.from('league_members').select('*').eq('league_id', id!),
    ])

    if (!leagueData) { navigate('/'); return }
    setLeague(leagueData)

    const members: LeagueMember[] = membersData ?? []
    const me = user ? members.find(m => m.user_id === user.id) ?? null : null
    setMyMember(me)

    // Fetch all picks with players for all members
    const memberIds = members.map(m => m.id)
    if (memberIds.length === 0) {
      setLoading(false)
      return
    }

    const { data: picksData } = await supabase
      .from('picks')
      .select('*, player:players(*)')
      .in('member_id', memberIds)

    const picks = (picksData ?? []) as (Pick & { player: Player })[]

    if (me) {
      setMyPicks(picks.filter(p => p.member_id === me.id))
    }

    // Build leaderboard entries (points = 0 until scoring is live)
    const leaderboardEntries: LeaderboardEntry[] = members.map(member => ({
      member,
      picks: picks.filter(p => p.member_id === member.id),
      totalPoints: 0,
      groupPoints: 0,
    }))

    setEntries(leaderboardEntries)
    setLoading(false)
  }

  function copyCode() {
    if (!league) return
    navigator.clipboard.writeText(league.join_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-text-muted">loading...</div>
  }

  if (!league) return null

  const picksComplete = myPicks.length === 11

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-surface border-b border-border px-4 py-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-black text-text-primary">{league.name}</h1>
              <div className="text-text-muted text-sm mt-0.5">
                {entries.length} member{entries.length !== 1 ? 's' : ''}
              </div>
            </div>
            <button
              onClick={copyCode}
              className="flex flex-col items-end gap-0.5"
            >
              <span className="font-mono font-bold tracking-widest text-accent-blue text-lg">
                {league.join_code}
              </span>
              <span className="text-xs text-text-muted">
                {copied ? '✓ copied!' : 'tap to copy invite code'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="max-w-lg mx-auto flex">
          {(['leaderboard', 'my-team'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 py-3 text-sm font-semibold transition-colors',
                tab === t
                  ? 'text-text-primary border-b-2 border-accent-blue'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              {t === 'leaderboard' ? 'leaderboard' : 'my team'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {tab === 'leaderboard' && (
          <Leaderboard
            entries={entries}
            currentMemberId={myMember?.id}
            picksLocked={league.picks_locked}
          />
        )}

        {tab === 'my-team' && (
          <div>
            {!user ? (
              <div className="text-center py-12">
                <div className="text-text-muted mb-4">sign in to see your team</div>
                <Button onClick={() => navigate(`/login?next=/league/${id}`)}>sign in</Button>
              </div>
            ) : !myMember ? (
              <div className="text-center py-12">
                <div className="text-text-muted mb-4">you're not in this league</div>
                <Button onClick={() => navigate(`/join/${league.join_code}`)}>join league</Button>
              </div>
            ) : !picksComplete && !league.picks_locked ? (
              <div className="flex flex-col items-center py-12 gap-4">
                <div className="text-text-muted text-center">you haven't picked your team yet</div>
                <Link to={`/league/${id}/pick`}>
                  <Button size="lg" variant="gold">pick my 11</Button>
                </Link>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-semibold text-text-muted">your team</div>
                  {!league.picks_locked && (
                    <Link to={`/league/${id}/pick`}>
                      <Button size="sm" variant="outline">edit picks</Button>
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {myPicks.map(pick => (
                    <div key={pick.id} className="flex items-center gap-2 bg-surface rounded-xl px-3 py-3 border border-border">
                      {pick.player.photo_url && (
                        <img
                          src={pick.player.photo_url}
                          alt={pick.player.short_name}
                          className="w-8 h-8 rounded-full border border-border/50 object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-text-primary truncate">
                          {pick.player.short_name}
                        </div>
                        <div className="flex items-center gap-1">
                          <img
                            src={`https://flagcdn.com/w20/${pick.player.country_code.toLowerCase()}.png`}
                            alt={pick.player.country}
                            className="w-4 h-3 object-cover rounded"
                          />
                          <span className="text-xs text-text-muted">{pick.player.position}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom nav CTA: pick button (if pre-lock and not picked) */}
      {myMember && !picksComplete && !league.picks_locked && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface border-t border-border">
          <div className="max-w-lg mx-auto">
            <Link to={`/league/${id}/pick`}>
              <Button size="lg" variant="gold" className="w-full">
                pick my starting 11
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
