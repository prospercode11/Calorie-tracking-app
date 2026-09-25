import type { DayKey } from './date'

export type Sex = 'male' | 'female'
export type GoalType = 'lose' | 'maintain' | 'gain'
export type ProgramStyle = 'balanced' | 'lowFat' | 'lowCarb' | 'keto'
export type UnitSystem = 'metric' | 'imperial'

export interface Macros {
  calories: number
  protein: number
  fat: number
  carbs: number
}

export interface Profile {
  sex: Sex
  birthYear: number
  heightCm: number
  /** Self-reported activity multiplier used only for the initial expenditure guess. */
  activity: number
  bodyFatPct?: number
}

export interface Goal {
  type: GoalType
  /** Target weight change as % of body weight per week (positive = gain). */
  ratePctPerWeek: number
  targetWeightKg?: number
  style: ProgramStyle
  /** Protein in g per kg of trend weight. */
  proteinPerKg: number
  checkInDay: number
}

export interface Food {
  id: string
  name: string
  brand?: string
  /** Label of one serving, e.g. "1 large egg". */
  servingLabel: string
  servingGrams: number
  /** Nutrition per one serving. */
  per: Macros
  custom?: boolean
}

export interface LogEntry {
  id: string
  day: DayKey
  /** Minutes since midnight — the food log is a timeline, not meal buckets. */
  time: number
  foodId?: string
  name: string
  servings: number
  /** Totals for this entry (already multiplied by servings). */
  macros: Macros
  quickAdd?: boolean
}

export interface WeightEntry {
  day: DayKey
  kg: number
}

export interface TargetsRecord {
  /** First day these targets apply from. */
  from: DayKey
  expenditure: number
  targets: Macros
}

export interface Settings {
  units: UnitSystem
  weekStart: number
  theme: 'system' | 'light' | 'dark'
}

export interface AppState {
  version: 1
  onboarded: boolean
  profile: Profile
  goal: Goal
  initialExpenditure: number
  foods: Food[]
  recentFoodIds: string[]
  entries: LogEntry[]
  weights: WeightEntry[]
  targetsHistory: TargetsRecord[]
  settings: Settings
}
