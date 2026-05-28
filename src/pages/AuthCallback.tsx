import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const handle = async () => {
      const next = searchParams.get('next') ?? '/'

      // Supabase v2 PKCE flow: magic link redirects here with ?code=XXXX
      // We must explicitly exchange the code for a session.
      const code = searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          navigate(next, { replace: true })
          return
        }
      }

      // Fallback: check if a session already exists (e.g. page refresh after sign-in)
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        navigate(next, { replace: true })
        return
      }

      // Legacy implicit flow (hash-based token) — listen for the state change
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          subscription.unsubscribe()
          navigate(next, { replace: true })
        }
      })

      // Safety fallback: redirect after 6s regardless
      setTimeout(() => {
        subscription.unsubscribe()
        navigate(next, { replace: true })
      }, 6000)
    }

    handle()
  }, [navigate, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-text-muted">signing you in...</div>
    </div>
  )
}
