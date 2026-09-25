import { Icon } from '../components/Icon'
import { MacroChips, MacroStrip, Screen } from '../components/ui'
import { addDays, formatLong, formatShort, formatTime, fromKey, nowMinutes, range, startOfWeek, weekdayShort, type DayKey } from '../lib/date'
import { useDerived } from '../lib/derived'
import { kcal } from '../lib/format'
import { actions } from '../lib/store'
import type { LogEntry } from '../lib/types'
import type { Nav } from '../App'

export function FoodLog({ nav, day, setDay }: { nav: Nav; day: DayKey; setDay: (d: DayKey) => void }) {
  const d = useDerived()
  const entries = d.state.entries.filter((e) => e.day === day).sort((a, b) => a.time - b.time)
  const intake = d.intakeOn(day)
  const targets = d.targetsOn(day)
  const weekStart = startOfWeek(day, d.state.settings.weekStart)
  const week = range(weekStart, addDays(weekStart, 6))

  // Show every hour that has food, plus a waking-hours frame so the day reads as a timeline.
  const byHour = new Map<number, LogEntry[]>()
  for (const e of entries) {
    const h = Math.floor(e.time / 60)
    byHour.set(h, [...(byHour.get(h) ?? []), e])
  }
  const hours = new Set<number>([...byHour.keys()])
  for (let h = 6; h <= 22; h++) hours.add(h)
  const isToday = day === d.today
  const now = nowMinutes()
  if (isToday) hours.add(Math.floor(now / 60))
  const sortedHours = [...hours].sort((a, b) => a - b)
  const yesterdayHasFood = d.totals.has(addDays(day, -1))

  return (
    <Screen
      title={formatLong(day)}
      sub={formatShort(day)}
      right={
        <>
          <button className="icon-btn" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day">
            <Icon name="chevronLeft" />
          </button>
          <button className="icon-btn" onClick={() => setDay(addDays(day, 1))} aria-label="Next day">
            <Icon name="chevronRight" />
          </button>
        </>
      }
    >
      <div className="week-strip">
        {week.map((k) => (
          <button key={k} aria-pressed={k === day} onClick={() => setDay(k)}>
            {weekdayShort(k).slice(0, 1)}
            <span className="d">{fromKey(k).getDate()}</span>
            <span className={`pip ${d.totals.has(k) ? '' : 'off'}`} />
          </button>
        ))}
      </div>

      <div className="card">
        <MacroStrip intake={intake} targets={targets} />
      </div>

      {entries.length === 0 && (
        <div className="card empty">
          Nothing logged {isToday ? 'yet today' : 'on this day'}.
          <div className="row" style={{ marginTop: 14, justifyContent: 'center' }}>
            <button className="btn primary" style={{ flex: 'none' }} onClick={() => nav.sheet({ kind: 'add', day })}>
              Log food
            </button>
            {yesterdayHasFood && (
              <button className="btn" style={{ flex: 'none' }} onClick={() => actions.copyDay(addDays(day, -1), day)}>
                Copy previous day
              </button>
            )}
          </div>
        </div>
      )}

      <div className="timeline">
        {sortedHours.map((h) => (
          <div key={h}>
            {isToday && Math.floor(now / 60) === h && <NowLine />}
            <div className="tl-hour">
              <div className="label">{formatTime(h * 60).replace(':00', '')}</div>
              <div className="slot">
                <button className="add-here" onClick={() => nav.sheet({ kind: 'add', day, time: h * 60 })} aria-label={`Log food at ${formatTime(h * 60)}`}>
                  + Add at {formatTime(h * 60)}
                </button>
                {(byHour.get(h) ?? []).map((e) => (
                  <button key={e.id} className="tl-entry" onClick={() => nav.sheet({ kind: 'entry', id: e.id })}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="name">{e.name}</div>
                      <div className="detail">
                        {e.quickAdd ? 'Quick add' : `${+e.servings.toFixed(2)} × serving`} · {formatTime(e.time)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="num" style={{ fontWeight: 700 }}>
                        {kcal(e.macros.calories)}
                      </div>
                      <MacroChips m={e.macros} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Screen>
  )
}

function NowLine() {
  return <div className="tl-now" aria-label="Now" />
}
