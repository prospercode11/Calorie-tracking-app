import { useCallback, useEffect, useState } from 'react'
import { Icon } from './components/Icon'
import { today, type DayKey } from './lib/date'
import { actions, useStore } from './lib/store'
import { supabase, useSync } from './lib/sync'
import { AuthScreen } from './screens/Auth'
import { Dashboard } from './screens/Dashboard'
import { FoodLog } from './screens/FoodLog'
import { ExpenditureScreen, WeightScreen } from './screens/Insights'
import { More } from './screens/More'
import { Onboarding } from './screens/Onboarding'
import { AddFoodSheet, EntrySheet, WeightSheet } from './screens/Sheets'
import { Strategy } from './screens/Strategy'

export type Tab = 'dashboard' | 'log' | 'strategy' | 'more'
export type Route = 'weight' | 'expenditure'
export type SheetSpec = { kind: 'add'; day: DayKey; time?: number } | { kind: 'entry'; id: string } | { kind: 'weight'; day?: DayKey }

export interface Nav {
  tab: (t: Tab) => void
  push: (r: Route) => void
  back: () => void
  sheet: (s: SheetSpec) => void
}

const LOCAL_MODE_KEY = 'fuelwise:local-mode'

function readLocalMode(): boolean {
  try {
    return localStorage.getItem(LOCAL_MODE_KEY) === '1'
  } catch {
    return false
  }
}

export default function App() {
  const state = useStore()
  const sync = useSync()
  const [localMode, setLocalMode] = useState(readLocalMode)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [stack, setStack] = useState<Route[]>([])
  const [sheet, setSheet] = useState<SheetSpec | null>(null)
  const [logDay, setLogDay] = useState<DayKey>(today())

  useEffect(() => {
    const root = document.documentElement
    if (state.settings.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', state.settings.theme)
  }, [state.settings.theme])

  // Weekly check-ins run when the app opens on or after the check-in day.
  useEffect(() => {
    actions.runDueCheckIns()
  }, [state.onboarded])

  const closeSheet = useCallback(() => setSheet(null), [])

  const nav: Nav = {
    tab: (t) => {
      setStack([])
      setTab(t)
      window.scrollTo(0, 0)
    },
    push: (r) => {
      setStack((s) => [...s, r])
      window.scrollTo(0, 0)
    },
    back: () => setStack((s) => s.slice(0, -1)),
    sheet: setSheet,
  }

  if (supabase && !sync.ready) return null
  if (supabase && !sync.session && !localMode) {
    return (
      <AuthScreen
        onSkip={() => {
          try {
            localStorage.setItem(LOCAL_MODE_KEY, '1')
          } catch {
            // Private mode: the choice lasts for this visit only.
          }
          setLocalMode(true)
        }}
      />
    )
  }
  if (sync.status === 'loading') return <div className="empty" style={{ paddingTop: '40vh' }}>Loading your data…</div>
  if (!state.onboarded) return <Onboarding />

  const route = stack[stack.length - 1]
  let screen
  if (route === 'weight') screen = <WeightScreen nav={nav} />
  else if (route === 'expenditure') screen = <ExpenditureScreen nav={nav} />
  else if (tab === 'dashboard') screen = <Dashboard nav={nav} />
  else if (tab === 'log') screen = <FoodLog nav={nav} day={logDay} setDay={setLogDay} />
  else if (tab === 'strategy') screen = <Strategy />
  else screen = <More nav={nav} />

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'log', label: 'Food Log', icon: 'log' },
    { id: 'strategy', label: 'Strategy', icon: 'strategy' },
    { id: 'more', label: 'More', icon: 'more' },
  ]

  return (
    <div className="app">
      {screen}
      <nav className="tabbar" aria-label="Main">
        {tabs.slice(0, 2).map((t) => (
          <TabButton key={t.id} {...t} active={!route && tab === t.id} onClick={() => nav.tab(t.id)} />
        ))}
        <button aria-label="Log food" onClick={() => setSheet({ kind: 'add', day: tab === 'log' ? logDay : today() })}>
          <span className="fab">
            <Icon name="plus" size={26} stroke={2.5} />
          </span>
        </button>
        {tabs.slice(2).map((t) => (
          <TabButton key={t.id} {...t} active={!route && tab === t.id} onClick={() => nav.tab(t.id)} />
        ))}
      </nav>
      {sheet?.kind === 'add' && <AddFoodSheet day={sheet.day} time={sheet.time} onClose={closeSheet} />}
      {sheet?.kind === 'entry' && <EntrySheet id={sheet.id} onClose={closeSheet} />}
      {sheet?.kind === 'weight' && <WeightSheet day={sheet.day} onClose={closeSheet} />}
    </div>
  )
}

function TabButton({ label, icon, active, onClick }: { label: string; icon: string; active: boolean; onClick: () => void }) {
  return (
    <button aria-current={active ? 'page' : undefined} onClick={onClick}>
      <Icon name={icon} />
      {label}
    </button>
  )
}
