import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'

export function UserNav() {
  const { user } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const label = user.user_metadata?.username ?? user.email?.split('@')[0] ?? 'you'

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="flex items-center gap-3 text-xs text-text-muted">
      <span>{label}</span>
      <button onClick={signOut} className="hover:text-text-primary underline underline-offset-2">
        sign out
      </button>
    </div>
  )
}
