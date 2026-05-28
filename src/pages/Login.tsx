import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchParams] = useSearchParams()
  const next = searchParams.get('next') ?? '/'

  async function handleSend() {
    if (!email.trim()) return
    setLoading(true)
    setError('')

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`

    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">⚽</div>
          <h1 className="text-2xl font-black text-text-primary">sign in</h1>
          <p className="text-text-muted text-sm mt-2">we'll send a magic link to your email</p>
        </div>

        {sent ? (
          <div className="bg-surface border border-accent-green/30 rounded-xl p-6 text-center">
            <div className="text-2xl mb-2">📬</div>
            <div className="font-semibold text-text-primary mb-1">check your inbox</div>
            <div className="text-sm text-text-muted">sent a link to <strong>{email}</strong></div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Input
              type="email"
              placeholder="your email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              autoFocus
            />
            {error && <div className="text-accent-red text-xs">{error}</div>}
            <Button onClick={handleSend} disabled={loading || !email.trim()} size="lg">
              {loading ? 'sending...' : 'send magic link'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
