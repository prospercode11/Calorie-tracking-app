// Cloud sync with Supabase. The local store stays the source of truth for the UI;
// this module mirrors it to the signed-in user's rows and loads them on sign-in.
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { actions, defaultState, getState, subscribe } from './store'
import type { AppState } from './types'
import {
  diffState,
  fromEntryRow,
  fromFoodRow,
  fromTargetsRow,
  fromWeightRow,
  isEmptyDiff,
  type EntryRow,
  type FoodRow,
  type ProfileRow,
  type StateDiff,
  type TargetsRow,
  type WeightRow,
} from './remote'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

export type SyncStatus = 'local' | 'loading' | 'synced' | 'saving' | 'error'

interface SyncInfo {
  status: SyncStatus
  session: Session | null
  /** True once the initial auth check has finished. */
  ready: boolean
  error?: string
}

let info: SyncInfo = { status: 'local', session: null, ready: !supabase }
const infoListeners = new Set<() => void>()
function setInfo(patch: Partial<SyncInfo>) {
  info = { ...info, ...patch }
  infoListeners.forEach((l) => l())
}

export function useSync(): SyncInfo {
  return useSyncExternalStore(
    (l) => {
      infoListeners.add(l)
      return () => infoListeners.delete(l)
    },
    () => info,
  )
}

// ---- Loading ----------------------------------------------------------------

async function selectAll<T>(client: SupabaseClient, table: string): Promise<T[]> {
  const out: T[] = []
  const page = 1000
  for (let from = 0; ; from += page) {
    const { data, error } = await client.from(table).select('*').range(from, from + page - 1)
    if (error) throw error
    out.push(...(data as T[]))
    if (!data || data.length < page) return out
  }
}

/** The user's full state from the database, or null if they have never saved anything. */
async function loadRemote(client: SupabaseClient): Promise<AppState | null> {
  const { data: profile, error } = await client.from('profiles').select('*').maybeSingle<ProfileRow>()
  if (error) throw error
  if (!profile) return null
  const [foods, entries, weights, targets] = await Promise.all([
    selectAll<FoodRow>(client, 'foods'),
    selectAll<EntryRow>(client, 'log_entries'),
    selectAll<WeightRow>(client, 'weights'),
    selectAll<TargetsRow>(client, 'targets_history'),
  ])
  const base = defaultState()
  return {
    ...base,
    onboarded: profile.onboarded,
    profile: { ...base.profile, ...profile.profile },
    goal: { ...base.goal, ...profile.goal },
    settings: { ...base.settings, ...profile.settings },
    initialExpenditure: profile.initial_expenditure,
    recentFoodIds: profile.recent_food_ids ?? [],
    foods: foods.map(fromFoodRow),
    entries: entries.map(fromEntryRow),
    weights: weights.map(fromWeightRow),
    targetsHistory: targets.map(fromTargetsRow),
  }
}

// ---- Saving -----------------------------------------------------------------

const CHUNK = 500

async function pushDiff(client: SupabaseClient, userId: string, diff: StateDiff) {
  const check = ({ error }: { error: unknown }) => {
    if (error) throw error
  }
  if (diff.profile) check(await client.from('profiles').upsert({ ...diff.profile, user_id: userId, updated_at: new Date().toISOString() }))
  const tables: [keyof Omit<StateDiff, 'profile'>, string][] = [
    ['foods', 'id'],
    ['log_entries', 'id'],
    ['weights', 'day'],
    ['targets_history', 'from_day'],
  ]
  for (const [table, pk] of tables) {
    const { remove } = diff[table]
    const upsert = (diff[table].upsert as object[]).map((r) => ({ ...r, user_id: userId }))
    for (let i = 0; i < upsert.length; i += CHUNK) check(await client.from(table).upsert(upsert.slice(i, i + CHUNK)))
    // RLS scopes deletes to the signed-in user's own rows.
    for (let i = 0; i < remove.length; i += CHUNK) check(await client.from(table).delete().in(pk, remove.slice(i, i + CHUNK)))
  }
}

/** What the database holds for the signed-in user, as last confirmed. */
let mirrored: AppState | null = null
let unsubscribeStore: (() => void) | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let flushing: Promise<void> | null = null

function scheduleFlush() {
  clearTimeout(timer)
  timer = setTimeout(() => void flush(), 600)
}

async function flush(): Promise<void> {
  const userId = info.session?.user.id
  if (!supabase || !mirrored || !userId) return
  if (flushing) {
    await flushing
    return flush()
  }
  const target = getState()
  const diff = diffState(mirrored, target)
  if (isEmptyDiff(diff)) {
    setInfo({ status: 'synced', error: undefined })
    return
  }
  setInfo({ status: 'saving' })
  flushing = pushDiff(supabase, userId, diff)
    .then(() => {
      mirrored = target
      setInfo({ status: getState() === target ? 'synced' : 'saving', error: undefined })
      if (getState() !== target) scheduleFlush()
    })
    .catch((e: unknown) => {
      setInfo({ status: 'error', error: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e) })
      // Retry later; `mirrored` still reflects what the server has.
      clearTimeout(timer)
      timer = setTimeout(() => void flush(), 10_000)
    })
    .finally(() => {
      flushing = null
    })
  return flushing
}

function hasPendingChanges(): boolean {
  return !!mirrored && !isEmptyDiff(diffState(mirrored, getState()))
}

async function attach(client: SupabaseClient) {
  setInfo({ status: 'loading' })
  try {
    const remote = await loadRemote(client)
    const local = getState()
    if (remote) {
      actions.replace(remote)
      mirrored = remote
    } else {
      // First sign-in: keep what's on this device and upload it.
      mirrored = defaultState()
      if (!local.onboarded) actions.replace(defaultState())
    }
    unsubscribeStore?.()
    unsubscribeStore = subscribe(scheduleFlush)
    await flush()
    setInfo({ status: 'synced', error: undefined })
  } catch (e) {
    setInfo({ status: 'error', error: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e) })
  }
}

function detach() {
  unsubscribeStore?.()
  unsubscribeStore = null
  clearTimeout(timer)
  mirrored = null
}

/** Pull the latest from the server (e.g. edits made on another device). */
export async function refresh() {
  if (!supabase || !info.session || hasPendingChanges() || flushing) return
  try {
    const remote = await loadRemote(supabase)
    if (remote && !hasPendingChanges()) {
      mirrored = remote
      actions.replace(remote)
    }
  } catch {
    // Offline; try again on the next focus.
  }
}

export function startSync() {
  if (!supabase) return
  const client = supabase
  let currentUser: string | undefined
  client.auth.getSession().then(({ data }) => {
    currentUser = data.session?.user.id
    setInfo({ session: data.session, ready: true })
    if (data.session) void attach(client)
  })
  client.auth.onAuthStateChange((_event, session) => {
    const uid = session?.user.id
    setInfo({ session, ready: true })
    if (uid === currentUser) return
    currentUser = uid
    // Defer so we don't call Supabase from inside its own auth callback.
    setTimeout(() => {
      if (uid) void attach(client)
      else {
        detach()
        setInfo({ status: 'local' })
      }
    }, 0)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refresh()
  })
  window.addEventListener('online', () => void flush())
}

export async function signOut() {
  if (!supabase) return
  await flush().catch(() => undefined)
  detach()
  await supabase.auth.signOut()
  // Clear this device so the next person doesn't see the previous account's data.
  actions.reset()
  setInfo({ status: 'local' })
}
