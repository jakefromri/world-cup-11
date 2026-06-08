import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PlayerPicker } from '@/components/PlayerPicker'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/toast'
import type { Player, LeagueMember } from '@/types'

export function Pick() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()

  const [players, setPlayers] = useState<Player[]>([])
  const [myMember, setMyMember] = useState<LeagueMember | null>(null)
  const [existingPicks, setExistingPicks] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (authLoading) return
    fetchData()
  }, [id, user, authLoading])

  async function fetchData() {
    setLoading(true)

    const [{ data: leagueData }, page1, page2] = await Promise.all([
      supabase.from('leagues').select('*').eq('id', id!).single(),
      supabase.from('players').select('*').order('country').order('position').order('short_name').range(0, 999),
      supabase.from('players').select('*').order('country').order('position').order('short_name').range(1000, 1999),
    ])
    const playersData = [...(page1.data ?? []), ...(page2.data ?? [])]

    if (!leagueData) { navigate('/'); return }

    if (leagueData.picks_locked) {
      toast('picks are locked', 'error')
      navigate(`/league/${id}`)
      return
    }

    if (user) {
      const { data: memberData } = await supabase
        .from('league_members')
        .select('*')
        .eq('league_id', id!)
        .eq('user_id', user.id)
        .single()

      if (!memberData) {
        navigate(`/join/${leagueData.join_code}`)
        return
      }
      setMyMember(memberData)

      const { data: picksData } = await supabase
        .from('picks')
        .select('*, player:players(*)')
        .eq('member_id', memberData.id)
      setExistingPicks((picksData ?? []).map((p: { player: Player }) => p.player))
    } else {
      navigate(`/login?next=/league/${id}/pick`)
      return
    }

    setPlayers(playersData ?? [])
    setLoading(false)
  }

  async function handleSubmit(picks: { player: Player; slot: 'GK' | 'outfield' }[]) {
    if (!myMember) return
    setSubmitting(true)

    // Delete existing picks first
    await supabase.from('picks').delete().eq('member_id', myMember.id)

    const rows = picks.map(p => ({
      member_id: myMember.id,
      player_id: p.player.id,
      slot: p.slot,
    }))

    const { error } = await supabase.from('picks').insert(rows)

    if (error) {
      toast('could not save picks — try again', 'error')
      setSubmitting(false)
      return
    }

    toast('team saved!', 'success')
    navigate(`/league/${id}`)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-text-muted">loading players...</div>
  }

  if (players.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <div className="text-2xl mb-3">⏳</div>
        <div className="font-semibold text-text-primary">players not seeded yet</div>
        <div className="text-text-muted text-sm mt-2">check back soon — squads are being loaded</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-surface border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(`/league/${id}`)} className="text-text-muted hover:text-text-primary">
          ← back
        </button>
        <div className="font-semibold text-text-primary">pick your starting 11</div>
        <div className="ml-auto text-xs text-text-muted">1 GK + 10 outfield</div>
      </div>
      <div className="flex-1 overflow-hidden">
        <PlayerPicker players={players} onSubmit={handleSubmit} submitting={submitting} initialPicks={existingPicks} />
      </div>
    </div>
  )
}
