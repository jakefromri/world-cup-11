import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    // Give Supabase client time to exchange the hash tokens into a session
    const handle = async () => {
      const next = searchParams.get('next') ?? '/'

      // onAuthStateChange fires once the hash is processed
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          subscription.unsubscribe()
          navigate(next, { replace: true })
        }
      })

      // Also check if session already exists (page refresh case)
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        subscription.unsubscribe()
        navigate(next, { replace: true })
      }

      // Fallback after 5s
      setTimeout(() => {
        subscription.unsubscribe()
        navigate(next, { replace: true })
      }, 5000)
    }

    handle()
  }, [navigate, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-text-muted">signing you in...</div>
    </div>
  )
}
