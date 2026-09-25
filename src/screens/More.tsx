import { useRef, useState } from 'react'
import { MacroChips, Screen, Segmented } from '../components/ui'
import { weekdayName } from '../lib/date'
import { demoState } from '../lib/demo'
import { kcal } from '../lib/format'
import { actions, useStore } from '../lib/store'
import { signOut, supabase, useSync, type SyncStatus } from '../lib/sync'
import type { Settings } from '../lib/types'
import type { Nav } from '../App'

export function More({ nav }: { nav: Nav }) {
  const state = useStore()
  const { settings, profile } = state
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fuelwise-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importData(file: File) {
    try {
      actions.importState(await file.text())
      setMsg('Backup restored.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not read that file.')
    }
  }

  return (
    <Screen title="More">
      {supabase && <Account />}

      <div className="section-title">Insights</div>
      <div className="list">
        <button className="list-item" onClick={() => nav.push('weight')}>
          <div className="grow name">Weight trend</div>
        </button>
        <button className="list-item" onClick={() => nav.push('expenditure')}>
          <div className="grow name">Expenditure</div>
        </button>
      </div>

      <div className="section-title">Preferences</div>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label className="field">
          <span>Units</span>
          <Segmented<Settings['units']>
            value={settings.units}
            onChange={(units) => actions.setSettings({ units })}
            options={[
              { value: 'metric', label: 'Metric (kg)' },
              { value: 'imperial', label: 'Imperial (lb)' },
            ]}
          />
        </label>
        <label className="field">
          <span>Appearance</span>
          <Segmented<Settings['theme']>
            value={settings.theme}
            onChange={(theme) => actions.setSettings({ theme })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </label>
        <label className="field">
          <span>Week starts on</span>
          <select className="input" value={settings.weekStart} onChange={(e) => actions.setSettings({ weekStart: Number(e.target.value) })}>
            {[0, 1, 6].map((i) => (
              <option key={i} value={i}>
                {weekdayName(i)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="section-title">Profile</div>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="row">
          <label className="field">
            <span>Sex</span>
            <select className="input" value={profile.sex} onChange={(e) => actions.setProfile({ ...profile, sex: e.target.value as 'male' | 'female' })}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <label className="field">
            <span>Birth year</span>
            <input className="input" inputMode="numeric" value={profile.birthYear} onChange={(e) => actions.setProfile({ ...profile, birthYear: Number(e.target.value) || profile.birthYear })} />
          </label>
        </div>
        <label className="field">
          <span>Height (cm)</span>
          <input className="input" inputMode="decimal" value={profile.heightCm} onChange={(e) => actions.setProfile({ ...profile, heightCm: Number(e.target.value) || profile.heightCm })} />
        </label>
        <p className="faint" style={{ fontSize: 13, margin: 0 }}>
          Your profile only sets the starting expenditure estimate ({kcal(state.initialExpenditure)} kcal). After that, your logged data drives it.
        </p>
      </div>

      <div className="section-title">My foods</div>
      <div className="list">
        {state.foods.map((f) => (
          <div key={f.id} className="list-item">
            <div className="grow">
              <div className="name">{f.name}</div>
              <div className="detail">
                {f.servingLabel} · {kcal(f.per.calories)} kcal · <MacroChips m={f.per} />
              </div>
            </div>
            <button className="link" style={{ color: 'var(--danger)' }} onClick={() => actions.deleteFood(f.id)}>
              Delete
            </button>
          </div>
        ))}
        {state.foods.length === 0 && <div className="empty">Foods you create show up here.</div>}
      </div>

      <div className="section-title">Data</div>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p className="faint" style={{ fontSize: 13, margin: 0 }}>
          {supabase ? 'Data is kept on this device and, when signed in, in your account.' : 'Everything is stored on this device only.'} Export a backup to move it or keep it safe.
        </p>
        <div className="row">
          <button className="btn" onClick={exportData}>
            Export backup
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Import backup
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
        <button
          className="btn"
          onClick={() => {
            if (confirm('Replace your data with 8 weeks of demo data?')) actions.replace(demoState())
          }}
        >
          Load demo data
        </button>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm('Delete all data and start over? This cannot be undone.')) actions.reset()
          }}
        >
          Reset everything
        </button>
        {msg && <div className="muted" style={{ fontSize: 13 }}>{msg}</div>}
      </div>
    </Screen>
  )
}

const STATUS_TEXT: Record<SyncStatus, string> = {
  local: 'Not syncing',
  loading: 'Loading…',
  saving: 'Saving…',
  synced: 'All changes saved',
  error: 'Sync failed — will retry',
}

function Account() {
  const sync = useSync()
  const email = sync.session?.user.email
  return (
    <>
      <div className="section-title">Account</div>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {email ? (
          <>
            <div className="row">
              <div>
                <b>{email}</b>
                <div className={sync.status === 'error' ? 'danger' : 'faint'} style={{ fontSize: 13 }} role="status">
                  {STATUS_TEXT[sync.status]}
                  {sync.status === 'error' && sync.error ? ` (${sync.error})` : ''}
                </div>
              </div>
              <button className="btn" style={{ flex: 'none' }} onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="faint" style={{ fontSize: 13, margin: 0 }}>
              You're using Fuelwise on this device only. Sign in to back up and sync your data; what's here now is uploaded to a new account.
            </p>
            <button
              className="btn primary"
              onClick={() => {
                try {
                  localStorage.removeItem('fuelwise:local-mode')
                } catch {
                  // Ignore; reload shows the sign-in screen anyway when storage is unavailable.
                }
                location.reload()
              }}
            >
              Sign in or create account
            </button>
          </>
        )}
      </div>
    </>
  )
}
