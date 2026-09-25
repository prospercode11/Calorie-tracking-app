// Mapping between the app's state and Supabase rows, plus the diff that decides
// which rows to write. Pure functions only — no network — so they can be unit tested.
import type { AppState, Food, LogEntry, TargetsRecord, WeightEntry } from './types'

export interface ProfileRow {
  onboarded: boolean
  profile: AppState['profile']
  goal: AppState['goal']
  settings: AppState['settings']
  initial_expenditure: number
  recent_food_ids: string[]
}

export interface FoodRow {
  id: string
  name: string
  brand: string | null
  serving_label: string
  serving_grams: number
  calories: number
  protein: number
  fat: number
  carbs: number
}

export interface EntryRow {
  id: string
  day: string
  time_min: number
  food_id: string | null
  name: string
  servings: number
  calories: number
  protein: number
  fat: number
  carbs: number
  quick_add: boolean
}

export interface WeightRow {
  day: string
  kg: number
}

export interface TargetsRow {
  from_day: string
  expenditure: number
  calories: number
  protein: number
  fat: number
  carbs: number
}

export const toProfileRow = (s: AppState): ProfileRow => ({
  onboarded: s.onboarded,
  profile: s.profile,
  goal: s.goal,
  settings: s.settings,
  initial_expenditure: Math.round(s.initialExpenditure),
  recent_food_ids: s.recentFoodIds,
})

export const toFoodRow = (f: Food): FoodRow => ({
  id: f.id,
  name: f.name,
  brand: f.brand ?? null,
  serving_label: f.servingLabel,
  serving_grams: f.servingGrams,
  ...f.per,
})

export const fromFoodRow = (r: FoodRow): Food => ({
  id: r.id,
  name: r.name,
  brand: r.brand ?? undefined,
  servingLabel: r.serving_label,
  servingGrams: r.serving_grams,
  per: { calories: r.calories, protein: r.protein, fat: r.fat, carbs: r.carbs },
  custom: true,
})

export const toEntryRow = (e: LogEntry): EntryRow => ({
  id: e.id,
  day: e.day,
  time_min: e.time,
  food_id: e.foodId ?? null,
  name: e.name,
  servings: e.servings,
  ...e.macros,
  quick_add: !!e.quickAdd,
})

export const fromEntryRow = (r: EntryRow): LogEntry => ({
  id: r.id,
  day: r.day,
  time: r.time_min,
  foodId: r.food_id ?? undefined,
  name: r.name,
  servings: r.servings,
  macros: { calories: r.calories, protein: r.protein, fat: r.fat, carbs: r.carbs },
  ...(r.quick_add ? { quickAdd: true } : {}),
})

export const toWeightRow = (w: WeightEntry): WeightRow => ({ day: w.day, kg: w.kg })
export const fromWeightRow = (r: WeightRow): WeightEntry => ({ day: r.day, kg: r.kg })

export const toTargetsRow = (t: TargetsRecord): TargetsRow => ({ from_day: t.from, expenditure: Math.round(t.expenditure), ...t.targets })
export const fromTargetsRow = (r: TargetsRow): TargetsRecord => ({
  from: r.from_day,
  expenditure: r.expenditure,
  targets: { calories: r.calories, protein: r.protein, fat: r.fat, carbs: r.carbs },
})

export interface TableDiff<R> {
  upsert: R[]
  /** Primary-key values (within the user) of rows to delete. */
  remove: string[]
}

export interface StateDiff {
  profile: ProfileRow | null
  foods: TableDiff<FoodRow>
  log_entries: TableDiff<EntryRow>
  weights: TableDiff<WeightRow>
  targets_history: TableDiff<TargetsRow>
}

function diffTable<T, R>(prev: T[], next: T[], key: (t: T) => string, toRow: (t: T) => R): TableDiff<R> {
  // Rows are compared through their serialized DB shape, so any field change triggers a write.
  const before = new Map(prev.map((t) => [key(t), JSON.stringify(toRow(t))]))
  const after = new Set<string>()
  const upsert: R[] = []
  for (const t of next) {
    const k = key(t)
    after.add(k)
    const row = toRow(t)
    if (before.get(k) !== JSON.stringify(row)) upsert.push(row)
  }
  const remove = [...before.keys()].filter((k) => !after.has(k))
  return { upsert, remove }
}

/** Rows to write so the database, which currently mirrors `prev`, matches `next`. */
export function diffState(prev: AppState, next: AppState): StateDiff {
  const pp = JSON.stringify(toProfileRow(prev))
  const np = toProfileRow(next)
  return {
    profile: pp === JSON.stringify(np) ? null : np,
    foods: diffTable(prev.foods, next.foods, (f) => f.id, toFoodRow),
    log_entries: diffTable(prev.entries, next.entries, (e) => e.id, toEntryRow),
    weights: diffTable(prev.weights, next.weights, (w) => w.day, toWeightRow),
    targets_history: diffTable(prev.targetsHistory, next.targetsHistory, (t) => t.from, toTargetsRow),
  }
}

export function isEmptyDiff(d: StateDiff): boolean {
  return !d.profile && [d.foods, d.log_entries, d.weights, d.targets_history].every((t) => t.upsert.length === 0 && t.remove.length === 0)
}
