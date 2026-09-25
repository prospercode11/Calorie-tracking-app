import { useSyncExternalStore } from 'react'
import { addDays, fromKey, nowMinutes, today, type DayKey } from './date'
import { BUILTIN_FOODS } from './foods'
import { computeTargets, currentExpenditure, initialExpenditure, lastCheckInDay, scaleMacros, trendOn } from './nutrition'
import type { AppState, Food, Goal, LogEntry, Macros, Profile, Settings } from './types'

const STORAGE_KEY = 'fuelwise:v1'

export function defaultState(): AppState {
  return {
    version: 1,
    onboarded: false,
    profile: { sex: 'male', birthYear: 1994, heightCm: 178, activity: 1.45 },
    goal: { type: 'lose', ratePctPerWeek: -0.5, style: 'balanced', proteinPerKg: 2.0, checkInDay: 1 },
    initialExpenditure: 2500,
    foods: [],
    recentFoodIds: [],
    entries: [],
    weights: [],
    targetsHistory: [],
    settings: { units: 'metric', weekStart: 1, theme: 'system' },
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaultState(), ...JSON.parse(raw) }
  } catch {
    // Unavailable or corrupt storage: start fresh.
  }
  return defaultState()
}

let state: AppState = load()
const listeners = new Set<() => void>()

function set(next: AppState) {
  state = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or blocked; keep the in-memory state.
  }
  listeners.forEach((l) => l())
}

function update(fn: (s: AppState) => AppState) {
  set(fn(state))
}

export function getState(): AppState {
  return state
}

export function useStore(): AppState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function allFoods(s: AppState): Food[] {
  return [...s.foods, ...BUILTIN_FOODS]
}

export function findFood(s: AppState, id: string | undefined): Food | undefined {
  return id ? allFoods(s).find((f) => f.id === id) : undefined
}

// ---- Actions ----------------------------------------------------------------

export const actions = {
  completeOnboarding(profile: Profile, goal: Goal, weightKg: number, units: Settings['units']) {
    const day = today()
    const expenditure = initialExpenditure(profile, weightKg)
    update((s) => ({
      ...s,
      onboarded: true,
      profile,
      goal,
      initialExpenditure: expenditure,
      weights: [{ day, kg: weightKg }],
      targetsHistory: [{ from: day, expenditure, targets: computeTargets(expenditure, weightKg, goal) }],
      settings: { ...s.settings, units },
    }))
  },

  logFood(food: Food, servings: number, day: DayKey, time = nowMinutes()) {
    const entry: LogEntry = {
      id: uid(),
      day,
      time,
      foodId: food.id,
      name: food.name,
      servings,
      macros: scaleMacros(food.per, servings),
    }
    update((s) => ({
      ...s,
      entries: [...s.entries, entry],
      recentFoodIds: [food.id, ...s.recentFoodIds.filter((id) => id !== food.id)].slice(0, 30),
    }))
  },

  quickAdd(name: string, macros: Macros, day: DayKey, time = nowMinutes()) {
    const entry: LogEntry = { id: uid(), day, time, name: name || 'Quick add', servings: 1, macros, quickAdd: true }
    update((s) => ({ ...s, entries: [...s.entries, entry] }))
  },

  updateEntry(id: string, patch: Partial<Pick<LogEntry, 'servings' | 'time' | 'day'>>) {
    update((s) => ({
      ...s,
      entries: s.entries.map((e) => {
        if (e.id !== id) return e
        const next = { ...e, ...patch }
        if (patch.servings != null && e.servings > 0) next.macros = scaleMacros(e.macros, patch.servings / e.servings)
        return next
      }),
    }))
  },

  deleteEntry(id: string) {
    update((s) => ({ ...s, entries: s.entries.filter((e) => e.id !== id) }))
  },

  copyDay(from: DayKey, to: DayKey) {
    update((s) => ({
      ...s,
      entries: [...s.entries, ...s.entries.filter((e) => e.day === from).map((e) => ({ ...e, id: uid(), day: to }))],
    }))
  },

  createFood(food: Omit<Food, 'id' | 'custom'>): Food {
    const f: Food = { ...food, id: uid(), custom: true }
    update((s) => ({ ...s, foods: [f, ...s.foods] }))
    return f
  },

  deleteFood(id: string) {
    update((s) => ({ ...s, foods: s.foods.filter((f) => f.id !== id) }))
  },

  logWeight(day: DayKey, kg: number) {
    update((s) => ({ ...s, weights: [...s.weights.filter((w) => w.day !== day), { day, kg }] }))
  },

  deleteWeight(day: DayKey) {
    update((s) => ({ ...s, weights: s.weights.filter((w) => w.day !== day) }))
  },

  /** Recompute targets from the latest expenditure and trend weight, effective `from`. */
  checkIn(from: DayKey = today()) {
    update((s) => {
      const expenditure = currentExpenditure(s, addDays(from, -1))
      const weight = trendOn(s, from) ?? s.weights[s.weights.length - 1]?.kg ?? 75
      const record = { from, expenditure, targets: computeTargets(expenditure, weight, s.goal) }
      return { ...s, targetsHistory: [...s.targetsHistory.filter((r) => r.from !== from), record] }
    })
  },

  /** Run any weekly check-ins that came due since the last one. */
  runDueCheckIns() {
    const s = state
    if (!s.onboarded || s.targetsHistory.length === 0) return
    const due = lastCheckInDay(today(), s.goal.checkInDay, (k) => fromKey(k).getDay())
    const latest = s.targetsHistory.reduce((a, b) => (a.from > b.from ? a : b))
    if (due > latest.from) actions.checkIn(due)
  },

  setGoal(goal: Goal) {
    update((s) => ({ ...s, goal }))
    actions.checkIn()
  },

  setProfile(profile: Profile) {
    update((s) => ({ ...s, profile }))
  },

  setSettings(patch: Partial<Settings>) {
    update((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
  },

  importState(json: string) {
    const parsed = JSON.parse(json) as AppState
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) throw new Error('Not a Fuelwise backup file')
    set({ ...defaultState(), ...parsed })
  },

  reset() {
    set(defaultState())
  },

  replace(next: AppState) {
    set(next)
  },
}

