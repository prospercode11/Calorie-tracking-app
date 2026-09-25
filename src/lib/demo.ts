import { addDays, fromKey, range, today } from './date'
import { BUILTIN_FOODS } from './foods'
import { computeTargets, currentExpenditure, KCAL_PER_KG, scaleMacros, trendOn } from './nutrition'
import { defaultState, uid } from './store'
import type { AppState, LogEntry, WeightEntry } from './types'

// Deterministic pseudo-random numbers so the demo looks the same every time.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const MEALS: [number, string[]][] = [
  [7 * 60 + 30, ['Oats, rolled (dry)', 'Whey protein powder', 'Blueberries', 'Coffee, black']],
  [8 * 60, ['Egg, whole', 'Egg, whole', 'Bread, whole wheat', 'Avocado']],
  [12 * 60 + 30, ['Chicken breast, cooked', 'White rice, cooked', 'Broccoli', 'Olive oil']],
  [13 * 60, ['Burrito bowl, chicken']],
  [15 * 60 + 30, ['Greek yogurt, nonfat plain', 'Banana']],
  [16 * 60, ['Protein bar', 'Apple']],
  [19 * 60, ['Salmon, cooked', 'Sweet potato, baked', 'Green beans']],
  [19 * 60 + 30, ['Ground beef 90% lean, cooked', 'Pasta, cooked', 'Mixed salad greens']],
  [21 * 60, ['Dark chocolate 70%']],
]

/** Eight weeks of a steady fat-loss phase: logged meals, daily weigh-ins, weekly check-ins. */
export function demoState(): AppState {
  const rand = rng(42)
  const end = today()
  const start = addDays(end, -55)
  const trueExpenditure = 2500
  const goal = { type: 'lose' as const, ratePctPerWeek: -0.5, style: 'balanced' as const, proteinPerKg: 2.0, checkInDay: 1 }
  const entries: LogEntry[] = []
  const weights: WeightEntry[] = []
  let tissue = 88

  for (const day of range(start, end)) {
    const isToday = day === end
    const skipped = !isToday && rand() < 0.06
    let intake = 0
    if (!skipped) {
      const picks = [0, 2, 4, 6, 8].map((i) => (rand() < 0.5 ? MEALS[i] : MEALS[Math.min(i + 1, MEALS.length - 1)]))
      for (const [time, names] of picks) {
        if (isToday && time > 13 * 60) break
        for (const name of names) {
          const food = BUILTIN_FOODS.find((f) => f.name === name)!
          const servings = Math.round((0.75 + rand() * 0.75) * 4) / 4
          const macros = scaleMacros(food.per, servings)
          intake += macros.calories
          entries.push({ id: uid(), day, time: time + Math.floor(rand() * 20), foodId: food.id, name, servings, macros })
        }
      }
    } else {
      intake = 2300
    }
    tissue += (intake - trueExpenditure) / KCAL_PER_KG
    if (day === start || rand() < 0.9) {
      const water = (rand() - 0.5) * 1.6
      weights.push({ day, kg: Math.round((tissue + water) * 10) / 10 })
    }
  }

  const base = defaultState()
  const firstWeight = weights[0].kg
  const initialExpenditure = 2300
  const state: AppState = {
    ...base,
    onboarded: true,
    profile: { sex: 'male', birthYear: 1992, heightCm: 180, activity: 1.4 },
    goal,
    initialExpenditure,
    entries,
    weights,
    recentFoodIds: BUILTIN_FOODS.slice(0, 8).map((f) => f.id),
    targetsHistory: [{ from: start, expenditure: initialExpenditure, targets: computeTargets(initialExpenditure, firstWeight, goal) }],
  }
  // Replay the weekly check-ins that would have happened along the way.
  for (const day of range(addDays(start, 1), end)) {
    if (fromKey(day).getDay() !== goal.checkInDay) continue
    const expenditure = currentExpenditure(state, addDays(day, -1))
    const weight = trendOn(state, day) ?? firstWeight
    state.targetsHistory.push({ from: day, expenditure, targets: computeTargets(expenditure, weight, goal) })
  }
  return state
}
