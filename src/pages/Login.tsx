import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'

function syntheticEmail(username: string) {
  return `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@wc11.play`
}

export function Login() {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin')

  // Sign-in state
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)

  // Sign-up state
  const [playerName, setPlayerName] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [email, setEmail] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const next = searchParams.get('next') ?? '/'

  const isEmail = identifier.includes('@')

  function switchTab(t: 'signin' | 'signup') {
    setTab(t)
    setError('')
  }

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

  async function handleSignUp() {
    if (!playerName.trim() || !signupPassword) return
    if (signupPassword.length < 6) { setError('password must be at least 6 characters'); return }
    if (!/^[a-zA-Z0-9_\- ]+$/.test(playerName)) {
      setError('player name can only contain letters, numbers, spaces, - and _')
      return
    }

    setLoading(true)
    setError('')

    const useEmail = email.trim() || syntheticEmail(playerName)
    const { error: err } = await supabase.auth.signUp({
      email: useEmail,
      password: signupPassword,
      options: { data: { username: playerName.trim(), synthetic_email: !email.trim() } },
    })

    if (err) {
      if (err.message.includes('already registered') || err.message.includes('already been registered')) {
        setError('that player name is already taken — try a different one')
      } else {
        setError(err.message)
      }
      setLoading(false)
      return
    }

    navigate(next, { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">⚽</div>
          <h1 className="text-2xl font-black text-text-primary">world cup starting 11</h1>
        </div>

        {/* Tab toggle */}
        <div className="flex rounded-lg bg-surface border border-border p-1 mb-4">
          <button
            onClick={() => switchTab('signin')}
            className={cn(
              'flex-1 py-1.5 text-sm font-semibold rounded transition-colors',
              tab === 'signin' ? 'bg-accent-blue text-white' : 'text-text-muted hover:text-text-primary'
            )}
          >
            sign in
          </button>
          <button
            onClick={() => switchTab('signup')}
            className={cn(
              'flex-1 py-1.5 text-sm font-semibold rounded transition-colors',
              tab === 'signup' ? 'bg-accent-blue text-white' : 'text-text-muted hover:text-text-primary'
            )}
          >
            new player
          </button>
        </div>

        {tab === 'signin' ? (
          sent ? (
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

              <Input
                type="password"
                placeholder={isEmail ? 'password (or leave blank for magic link)' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (password ? handlePasswordLogin() : isEmail ? handleMagicLink() : null)}
              />

              {error && <div className="text-accent-red text-xs">{error}</div>}

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
          )
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-text-muted font-semibold uppercase tracking-wider block mb-1.5">
                pick a player name
              </label>
              <Input
                placeholder="e.g. GoatFinder99"
                value={playerName}
                onChange={e => { setPlayerName(e.target.value); setError('') }}
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
                value={signupPassword}
                onChange={e => { setSignupPassword(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleSignUp()}
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
                onKeyDown={e => e.key === 'Enter' && handleSignUp()}
              />
            </div>

            {error && <div className="text-accent-red text-xs">{error}</div>}

            <Button
              onClick={handleSignUp}
              disabled={loading || !playerName.trim() || !signupPassword}
              size="lg"
            >
              {loading ? 'creating account...' : 'create account →'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
