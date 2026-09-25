import { describe, expect, it } from 'vitest'
import { addDays, range } from './date'
import { computeTargets, dailyTotals, expenditureSeries, KCAL_PER_KG, streak, targetsFor, trendWeights } from './nutrition'
import type { Goal, LogEntry, WeightEntry } from './types'

const goal: Goal = { type: 'lose', ratePctPerWeek: -0.5, style: 'balanced', proteinPerKg: 2, checkInDay: 1 }

function entry(day: string, calories: number): LogEntry {
  return { id: day, day, time: 720, name: 'x', servings: 1, macros: { calories, protein: 0, fat: 0, carbs: 0 } }
}

describe('trendWeights', () => {
  it('smooths noise and interpolates missing days', () => {
    const w: WeightEntry[] = [
      { day: '2026-01-01', kg: 80 },
      { day: '2026-01-03', kg: 82 },
    ]
    const t = trendWeights(w, '2026-01-05')
    expect(t.get('2026-01-01')).toBe(80)
    // Jan 2 interpolates to 81 → 80 + 0.1 * 1
    expect(t.get('2026-01-02')).toBeCloseTo(80.1)
    expect(t.size).toBe(5)
    expect(t.get('2026-01-05')!).toBeLessThan(82)
  })
})

describe('expenditureSeries', () => {
  it('converges toward the true expenditure implied by intake and weight change', () => {
    const start = '2026-01-01'
    const days = range(start, addDays(start, 119))
    const trueTdee = 2600
    const intake = 2100
    const entries = days.map((d) => entry(d, intake))
    const weights = days.map((d, i) => ({ day: d, kg: 90 + (i * (intake - trueTdee)) / KCAL_PER_KG }))
    const series = expenditureSeries({ entries, weights, initialExpenditure: 2200 }, start, days[days.length - 1])
    const last = series[series.length - 1].kcal
    expect(Math.abs(last - trueTdee)).toBeLessThan(60)
  })

  it('ignores unlogged days instead of treating them as zero intake', () => {
    const start = '2026-01-01'
    const days = range(start, addDays(start, 59))
    const entries = days.filter((_, i) => i % 3 !== 0).map((d) => entry(d, 2400))
    const weights = days.map((d) => ({ day: d, kg: 80 }))
    const series = expenditureSeries({ entries, weights, initialExpenditure: 2400 }, start, days[days.length - 1])
    expect(series[series.length - 1].kcal).toBe(2400)
  })
})

describe('computeTargets', () => {
  it('applies the goal deficit and macro split', () => {
    const t = computeTargets(2500, 80, goal)
    // 0.5% of 80 kg = 0.4 kg/week → 440 kcal/day deficit
    expect(t.calories).toBe(2060)
    expect(t.protein).toBe(160)
    expect(t.protein * 4 + t.fat * 9 + t.carbs * 4).toBeCloseTo(t.calories, -1)
  })

  it('keeps keto carbs low', () => {
    expect(computeTargets(2500, 80, { ...goal, style: 'keto', type: 'maintain' }).carbs).toBe(30)
  })
})

describe('helpers', () => {
  it('picks the targets in effect for a day', () => {
    const t = { calories: 1, protein: 0, fat: 0, carbs: 0 }
    const h = [
      { from: '2026-01-01', expenditure: 1, targets: t },
      { from: '2026-01-08', expenditure: 2, targets: t },
    ]
    expect(targetsFor(h, '2026-01-07')!.expenditure).toBe(1)
    expect(targetsFor(h, '2026-01-09')!.expenditure).toBe(2)
  })

  it('counts streaks ending today or yesterday', () => {
    const logged = new Set(['2026-01-01', '2026-01-02', '2026-01-03'])
    expect(streak((d) => logged.has(d), '2026-01-04')).toBe(3)
    expect(streak((d) => logged.has(d), '2026-01-06')).toBe(0)
  })

  it('totals entries per day', () => {
    const m = dailyTotals([entry('2026-01-01', 100), entry('2026-01-01', 50)])
    expect(m.get('2026-01-01')!.calories).toBe(150)
  })
})
