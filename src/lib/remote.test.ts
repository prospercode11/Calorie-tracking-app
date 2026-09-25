import { describe, expect, it } from 'vitest'
import { diffState, fromEntryRow, isEmptyDiff, toEntryRow } from './remote'
import { defaultState } from './store'
import type { AppState, LogEntry } from './types'

const entry: LogEntry = { id: 'e1', day: '2026-01-01', time: 480, foodId: 'b1', name: 'Egg', servings: 2, macros: { calories: 144, protein: 12, fat: 10, carbs: 1 } }

function withEntries(entries: LogEntry[]): AppState {
  return { ...defaultState(), entries }
}

describe('diffState', () => {
  it('is empty for identical states', () => {
    const s = withEntries([entry])
    expect(isEmptyDiff(diffState(s, { ...s, entries: [{ ...entry }] }))).toBe(true)
  })

  it('upserts new and changed rows and deletes removed ones', () => {
    const e2 = { ...entry, id: 'e2' }
    const prev = withEntries([entry, e2])
    const next = withEntries([{ ...entry, servings: 3 }, { ...entry, id: 'e3' }])
    const d = diffState(prev, next)
    expect(d.log_entries.upsert.map((r) => r.id).sort()).toEqual(['e1', 'e3'])
    expect(d.log_entries.remove).toEqual(['e2'])
    expect(d.profile).toBeNull()
  })

  it('writes the profile row only when a singleton field changes', () => {
    const prev = defaultState()
    const d = diffState(prev, { ...prev, settings: { ...prev.settings, units: 'imperial' } })
    expect(d.profile?.settings.units).toBe('imperial')
  })

  it('keys weights by day and targets by start day', () => {
    const prev = { ...defaultState(), weights: [{ day: '2026-01-01', kg: 80 }] }
    const d = diffState(prev, { ...prev, weights: [{ day: '2026-01-01', kg: 79.5 }] })
    expect(d.weights.upsert).toEqual([{ day: '2026-01-01', kg: 79.5 }])
    expect(d.weights.remove).toEqual([])
  })
})

describe('row mapping', () => {
  it('round-trips a log entry', () => {
    expect(fromEntryRow(toEntryRow(entry))).toEqual(entry)
    const quick = { ...entry, foodId: undefined, quickAdd: true }
    expect(fromEntryRow(toEntryRow(quick))).toEqual({ ...quick, foodId: undefined })
  })
})
