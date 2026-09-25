import { addDays, diffDays, range, type DayKey } from './date'
import type { AppState, Goal, LogEntry, Macros, Profile, TargetsRecord, WeightEntry } from './types'

/** Energy stored per kg of body-weight change (mixed tissue). */
export const KCAL_PER_KG = 7700
/** Smoothing factor for the trend weight (exponentially weighted moving average). */
export const TREND_ALPHA = 0.1
/** Days of history the expenditure algorithm looks back over. */
export const EXPENDITURE_WINDOW = 21

export const ZERO: Macros = { calories: 0, protein: 0, fat: 0, carbs: 0 }

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    carbs: a.carbs + b.carbs,
  }
}

export function scaleMacros(m: Macros, k: number): Macros {
  return { calories: m.calories * k, protein: m.protein * k, fat: m.fat * k, carbs: m.carbs * k }
}

export function caloriesFromMacros(protein: number, fat: number, carbs: number): number {
  return protein * 4 + fat * 9 + carbs * 4
}

/** Mifflin–St Jeor resting metabolic rate, or Katch–McArdle when body fat is known. */
export function bmr(profile: Profile, weightKg: number, year = new Date().getFullYear()): number {
  if (profile.bodyFatPct != null && profile.bodyFatPct > 0) {
    const lean = weightKg * (1 - profile.bodyFatPct / 100)
    return 370 + 21.6 * lean
  }
  const age = year - profile.birthYear
  const base = 10 * weightKg + 6.25 * profile.heightCm - 5 * age
  return profile.sex === 'male' ? base + 5 : base - 161
}

export function initialExpenditure(profile: Profile, weightKg: number): number {
  return Math.round(bmr(profile, weightKg) * profile.activity)
}

/** Sum of logged nutrition per day. Days with no entries are absent. */
export function dailyTotals(entries: LogEntry[]): Map<DayKey, Macros> {
  const out = new Map<DayKey, Macros>()
  for (const e of entries) out.set(e.day, addMacros(out.get(e.day) ?? ZERO, e.macros))
  return out
}

/**
 * Trend weight for every day from the first weigh-in to `end`, using an EWMA over
 * scale weights with linear interpolation across days without a weigh-in.
 */
export function trendWeights(weights: WeightEntry[], end: DayKey): Map<DayKey, number> {
  const out = new Map<DayKey, number>()
  if (weights.length === 0) return out
  const sorted = [...weights].sort((a, b) => a.day.localeCompare(b.day))
  const byDay = new Map(sorted.map((w) => [w.day, w.kg]))
  let trend = sorted[0].kg
  let prev = sorted[0]
  let nextIdx = 1
  for (const day of range(sorted[0].day, end < sorted[0].day ? sorted[0].day : end)) {
    let scale = byDay.get(day)
    if (scale != null) {
      prev = { day, kg: scale }
      while (nextIdx < sorted.length && sorted[nextIdx].day <= day) nextIdx++
    } else if (nextIdx < sorted.length) {
      const next = sorted[nextIdx]
      const span = diffDays(next.day, prev.day)
      scale = prev.kg + ((next.kg - prev.kg) * diffDays(day, prev.day)) / span
    } else {
      // After the last weigh-in, the trend holds steady.
      scale = trend
    }
    trend = trend + TREND_ALPHA * (scale - trend)
    out.set(day, trend)
  }
  return out
}

export interface ExpenditurePoint {
  day: DayKey
  kcal: number
}

/**
 * Adaptive expenditure estimate for each day from `start` to `end`.
 *
 * Each day, look back over the trailing window: expenditure ≈ average intake minus the
 * energy implied by the change in trend weight. The raw estimate is noisy, so it is
 * blended into the running estimate, weighted by how much of the window was logged.
 * Days that were not logged are treated as unknown, not as zero intake.
 */
export function expenditureSeries(state: Pick<AppState, 'entries' | 'weights' | 'initialExpenditure'>, start: DayKey, end: DayKey): ExpenditurePoint[] {
  const totals = dailyTotals(state.entries)
  const trend = trendWeights(state.weights, end)
  const out: ExpenditurePoint[] = []
  let est = state.initialExpenditure
  for (const day of range(start, end)) {
    const windowStart = addDays(day, -(EXPENDITURE_WINDOW - 1))
    const days = range(windowStart, day)
    const logged = days.filter((d) => totals.has(d))
    const tStart = trend.get(windowStart)
    const tEnd = trend.get(day)
    if (logged.length >= 7 && tStart != null && tEnd != null) {
      const avgIntake = logged.reduce((s, d) => s + totals.get(d)!.calories, 0) / logged.length
      const raw = avgIntake - ((tEnd - tStart) * KCAL_PER_KG) / (EXPENDITURE_WINDOW - 1)
      const coverage = logged.length / EXPENDITURE_WINDOW
      est = est + 0.15 * coverage * (raw - est)
    }
    out.push({ day, kcal: Math.round(est) })
  }
  return out
}

export function currentExpenditure(state: AppState, day: DayKey): number {
  const first = firstDataDay(state) ?? day
  const series = expenditureSeries(state, first < day ? first : day, day)
  return series[series.length - 1].kcal
}

export function firstDataDay(state: Pick<AppState, 'entries' | 'weights'>): DayKey | undefined {
  const days = [...state.entries.map((e) => e.day), ...state.weights.map((w) => w.day)]
  return days.length ? days.reduce((a, b) => (a < b ? a : b)) : undefined
}

const FAT_SHARE: Record<Goal['style'], number> = {
  balanced: 0.3,
  lowFat: 0.2,
  lowCarb: 0.45,
  keto: 0.7,
}

/** Calorie and macro targets for a given expenditure, trend weight and goal. */
export function computeTargets(expenditure: number, weightKg: number, goal: Goal): Macros {
  const dailyDelta = goal.type === 'maintain' ? 0 : ((goal.ratePctPerWeek / 100) * weightKg * KCAL_PER_KG) / 7
  const floor = 1200
  const calories = Math.max(floor, Math.round(expenditure + dailyDelta))
  const protein = Math.round(goal.proteinPerKg * weightKg)
  let fat: number
  let carbs: number
  if (goal.style === 'keto') {
    carbs = 30
    fat = Math.max(0, Math.round((calories - protein * 4 - carbs * 4) / 9))
  } else {
    fat = Math.round((calories * FAT_SHARE[goal.style]) / 9)
    carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4))
  }
  return { calories, protein, fat, carbs }
}

/** Targets in effect on `day` (the latest record starting on or before it). */
export function targetsFor(history: TargetsRecord[], day: DayKey): TargetsRecord | undefined {
  let found: TargetsRecord | undefined
  for (const r of history) if (r.from <= day && (!found || r.from >= found.from)) found = r
  return found ?? history[0]
}

/** Most recent trend weight on or before `day`. */
export function trendOn(state: Pick<AppState, 'weights'>, day: DayKey): number | undefined {
  return trendWeights(state.weights, day).get(day)
}

/** Most recent check-in day on or before `day`. */
export function lastCheckInDay(day: DayKey, checkInDow: number, dow: (k: DayKey) => number): DayKey {
  let k = day
  while (dow(k) !== checkInDow) k = addDays(k, -1)
  return k
}

/** Consecutive days, ending today or yesterday, for which `has(day)` is true. */
export function streak(has: (d: DayKey) => boolean, day: DayKey): number {
  let k = has(day) ? day : addDays(day, -1)
  let n = 0
  while (has(k)) {
    n++
    k = addDays(k, -1)
  }
  return n
}
