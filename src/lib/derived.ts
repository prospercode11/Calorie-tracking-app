import { useMemo } from 'react'
import { addDays, today, type DayKey } from './date'
import { dailyTotals, expenditureSeries, firstDataDay, targetsFor, trendWeights, ZERO } from './nutrition'
import { useStore } from './store'
import type { AppState, Macros } from './types'

export interface Derived {
  state: AppState
  today: DayKey
  firstDay: DayKey
  totals: Map<DayKey, Macros>
  trend: Map<DayKey, number>
  scale: Map<DayKey, number>
  expenditure: Map<DayKey, number>
  intakeOn: (day: DayKey) => Macros
  targetsOn: (day: DayKey) => Macros | undefined
}

/** Everything the screens compute from raw state, memoized per state change. */
export function useDerived(): Derived {
  const state = useStore()
  return useMemo(() => {
    const t = today()
    const first = firstDataDay(state) ?? t
    const firstDay = first < t ? first : t
    const totals = dailyTotals(state.entries)
    const trend = trendWeights(state.weights, t)
    const scale = new Map(state.weights.map((w) => [w.day, w.kg]))
    const expenditure = new Map(expenditureSeries(state, addDays(firstDay, -1), t).map((p) => [p.day, p.kcal]))
    return {
      state,
      today: t,
      firstDay,
      totals,
      trend,
      scale,
      expenditure,
      intakeOn: (d) => totals.get(d) ?? ZERO,
      targetsOn: (d) => targetsFor(state.targetsHistory, d)?.targets,
    }
  }, [state])
}
