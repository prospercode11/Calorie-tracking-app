import { useState } from 'react'
import { Segmented } from '../components/ui'
import { supabase } from '../lib/sync'

type Mode = 'signin' | 'signup'

export function AuthScreen({ onSkip }: { onSkip: () => void }) {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
        if (error) throw error
        if (!data.session) setNotice('Check your email for a confirmation link, then sign in.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="onboard" onSubmit={submit}>
      <div className="spacer" />
      <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--accent)', display: 'grid', placeItems: 'center', color: 'white', fontSize: 34, fontWeight: 800 }}>F</div>
      <h1>Fuelwise</h1>
      <p className="muted" style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>
        Sign in to keep your log, weigh-ins and targets synced across your devices.
      </p>
      <Segmented<Mode>
        value={mode}
        onChange={(m) => {
          setMode(m)
          setError('')
          setNotice('')
        }}
        options={[
          { value: 'signin', label: 'Sign in' },
          { value: 'signup', label: 'Create account' },
        ]}
      />
      <label className="field">
        <span>Email</span>
        <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          className="input"
          type="password"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          minLength={6}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && (
        <div className="danger" role="alert" style={{ fontSize: 14 }}>
          {error}
        </div>
      )}
      {notice && (
        <div className="good" role="status" style={{ fontSize: 14 }}>
          {notice}
        </div>
      )}
      <button className="btn primary block" disabled={busy}>
        {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
      </button>
      <div className="spacer" />
      <button type="button" className="link" style={{ alignSelf: 'center' }} onClick={onSkip}>
        Use without an account (this device only)
      </button>
    </form>
  )
}
