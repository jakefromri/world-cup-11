import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const next = searchParams.get('next') ?? '/'
      if (data.session) {
        navigate(next, { replace: true })
      } else {
        navigate('/login', { replace: true })
      }
    })
  }, [navigate, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-text-muted">signing you in...</div>
    </div>
  )
}
