import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function syntheticEmail(username: string) {
  return `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@wc11.play`
}

export function Login() {
  const [identifier, setIdentifier] = useState('') // email or username
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const next = searchParams.get('next') ?? '/'

  const isEmail = identifier.includes('@')

  async function handlePasswordLogin() {
    if (!identifier.trim() || !password) return
    setLoading(true)
    setError('')

    const loginEmail = isEmail ? identifier.trim() : syntheticEmail(identifier)
    const { error: err } = await supabase.auth.signInWithPassword({ email: loginEmail, password })

    if (err) {
      setError('wrong player name or password')
      setLoading(false)
      return
    }
    navigate(next, { replace: true })
  }

  async function handleMagicLink() {
    if (!identifier.trim() || !isEmail) return
    setLoading(true)
    setError('')

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
    const { error: err } = await supabase.auth.signInWithOtp({
      email: identifier.trim(),
      options: { emailRedirectTo: redirectTo },
    })

    if (err) { setError(err.message); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">⚽</div>
          <h1 className="text-2xl font-black text-text-primary">sign in</h1>
          <p className="text-text-muted text-sm mt-2">
            enter your player name + password, or email for a magic link
          </p>
        </div>

        {sent ? (
          <div className="bg-surface border border-accent-green/30 rounded-xl p-6 text-center">
            <div className="text-2xl mb-2">📬</div>
            <div className="font-semibold text-text-primary mb-1">check your inbox</div>
            <div className="text-sm text-text-muted">sent a link to <strong>{identifier}</strong></div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Input
              placeholder="player name or email"
              value={identifier}
              onChange={e => { setIdentifier(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && (isEmail ? handleMagicLink() : handlePasswordLogin())}
              autoFocus
            />

            {/* Password field — always shown, required for username login */}
            <Input
              type="password"
              placeholder={isEmail ? 'password (or leave blank for magic link)' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (password ? handlePasswordLogin() : isEmail ? handleMagicLink() : null)}
            />

            {error && <div className="text-accent-red text-xs">{error}</div>}

            {/* Primary action */}
            {!isEmail ? (
              <Button
                onClick={handlePasswordLogin}
                disabled={loading || !identifier.trim() || !password}
                size="lg"
              >
                {loading ? 'signing in...' : 'sign in'}
              </Button>
            ) : (
              <>
                {password && (
                  <Button onClick={handlePasswordLogin} disabled={loading} size="lg">
                    {loading ? 'signing in...' : 'sign in with password'}
                  </Button>
                )}
                <Button
                  onClick={handleMagicLink}
                  disabled={loading || !identifier.trim()}
                  size="lg"
                  variant={password ? 'outline' : 'default'}
                >
                  {loading ? 'sending...' : 'send magic link'}
                </Button>
              </>
            )}

            <div className="text-center text-xs text-text-muted mt-1">
              joining a league?{' '}
              <button
                onClick={() => navigate('/')}
                className="text-accent-blue hover:underline"
              >
                use the invite link instead
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
