import { useState } from 'react'
import { BarChart, Ring, Sparkline } from '../components/Charts'
import { Icon } from '../components/Icon'
import { MacroRows, MacroStrip, Screen, Segmented } from '../components/ui'
import { addDays, formatLong, formatShort, fromKey, range, startOfWeek, weekdayShort, type DayKey } from '../lib/date'
import { useDerived } from '../lib/derived'
import { kcal, signed, weight, weightUnit } from '../lib/format'
import { addMacros, streak, ZERO } from '../lib/nutrition'
import type { Macros } from '../lib/types'
import type { Nav } from '../App'

type Widget = 'week' | 'energy' | 'today'

export function Dashboard({ nav }: { nav: Nav }) {
  const d = useDerived()
  const [widget, setWidget] = useState<Widget>('week')
  const units = d.state.settings.units

  const trendNow = d.trend.get(d.today)
  const trendWeekAgo = d.trend.get(addDays(d.today, -7))
  const expNow = d.expenditure.get(d.today) ?? d.state.initialExpenditure
  const exp30 = d.expenditure.get(addDays(d.today, -30))
  const last30 = range(addDays(d.today, -29), d.today)

  const logStreak = streak((k) => d.totals.has(k), d.today)
  const weighStreak = streak((k) => d.scale.has(k), d.today)
  const last7 = range(addDays(d.today, -6), d.today)

  return (
    <Screen
      title="Dashboard"
      sub={formatLong(d.today) + ' · ' + formatShort(d.today)}
      right={
        <button className="icon-btn" onClick={() => nav.sheet({ kind: 'weight' })} aria-label="Log weight">
          <Icon name="scale" />
        </button>
      }
    >
      <div className="card">
        <Segmented<Widget>
          value={widget}
          onChange={setWidget}
          options={[
            { value: 'week', label: 'Nutrition & Targets' },
            { value: 'energy', label: 'Energy Balance' },
            { value: 'today', label: 'Today' },
          ]}
        />
        <div style={{ marginTop: 14 }}>
          {widget === 'week' && <WeekWidget />}
          {widget === 'energy' && <EnergyWidget />}
          {widget === 'today' && <TodayWidget />}
        </div>
      </div>

      <div className="section-title">Insights &amp; analytics</div>
      <div className="grid-2">
        <button className="card tap" onClick={() => nav.push('expenditure')}>
          <div className="card-head">
            <span className="card-title">Expenditure</span>
            <Icon name="flame" size={18} />
          </div>
          <div className="big-num">
            {kcal(expNow)}
            <small>kcal</small>
          </div>
          <Sparkline values={last30.map((k) => d.expenditure.get(k) ?? null)} color="var(--calories)" />
          <div className="card-meta">{exp30 != null ? `${signed(expNow - exp30, 0)} kcal vs 30 days ago` : 'Keep logging to refine'}</div>
        </button>
        <button className="card tap" onClick={() => nav.push('weight')}>
          <div className="card-head">
            <span className="card-title">Weight trend</span>
            <Icon name="scale" size={18} />
          </div>
          <div className="big-num">
            {trendNow != null ? weight(trendNow, units) : '—'}
            <small>{weightUnit(units)}</small>
          </div>
          <Sparkline values={last30.map((k) => d.trend.get(k) ?? null)} color="var(--weight)" />
          <div className="card-meta">
            {trendNow != null && trendWeekAgo != null ? `${signed(Number(weight(trendNow - trendWeekAgo, units, 2)), 2)} ${weightUnit(units)} this week` : 'Weigh in daily'}
          </div>
        </button>
      </div>

      <div className="section-title">Habits</div>
      <div className="card">
        <HabitRow icon="log" title="Food logging" streakDays={logStreak} days={last7.map((k) => d.totals.has(k))} onClick={() => nav.tab('log')} />
        <div style={{ height: 14 }} />
        <HabitRow icon="scale" title="Weigh-ins" streakDays={weighStreak} days={last7.map((k) => d.scale.has(k))} onClick={() => nav.sheet({ kind: 'weight' })} />
      </div>

      <div className="section-title">Strategy</div>
      <button className="card tap" onClick={() => nav.tab('strategy')}>
        <div className="card-head">
          <span className="card-title">{goalLabel(d.state.goal.type)}</span>
          <span className="pill accent">{d.state.goal.style === 'lowFat' ? 'Low fat' : d.state.goal.style === 'lowCarb' ? 'Low carb' : d.state.goal.style === 'keto' ? 'Keto' : 'Balanced'}</span>
        </div>
        <div className="muted" style={{ fontSize: 14 }}>
          {d.state.goal.type === 'maintain' ? 'Holding weight steady' : `${signed(d.state.goal.ratePctPerWeek)}% body weight per week`} · Check-in every {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.state.goal.checkInDay]}
        </div>
      </button>
    </Screen>
  )
}

export function goalLabel(t: string): string {
  return t === 'lose' ? 'Fat loss' : t === 'gain' ? 'Muscle gain' : 'Maintenance'
}

function HabitRow({ icon, title, streakDays, days, onClick }: { icon: string; title: string; streakDays: number; days: boolean[]; onClick: () => void }) {
  return (
    <button className="habit" onClick={onClick} style={{ border: 0, background: 'none', width: '100%', textAlign: 'left', padding: 0 }}>
      <div className="icon">
        <Icon name={icon} size={20} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <b style={{ fontSize: 15 }}>{title}</b>
          <span className="num muted" style={{ fontSize: 13 }}>
            {streakDays} day streak
          </span>
        </div>
        <div className="habit-days" aria-label={`${days.filter(Boolean).length} of last 7 days`}>
          {days.map((on, i) => (
            <i key={i} className={on ? 'on' : ''} />
          ))}
        </div>
      </div>
    </button>
  )
}

function WeekWidget() {
  const d = useDerived()
  const weekStart = startOfWeek(d.today, d.state.settings.weekStart)
  const days = range(weekStart, addDays(weekStart, 6))
  const [selected, setSelected] = useState<DayKey | null>(d.today)

  const intake: Macros = selected ? d.intakeOn(selected) : days.reduce((s, k) => addMacros(s, d.intakeOn(k)), ZERO)
  const targets: Macros | undefined = selected ? d.targetsOn(selected) : days.reduce<Macros>((s, k) => addMacros(s, d.targetsOn(k) ?? ZERO), ZERO)

  return (
    <>
      <div className="card-head">
        <span className="card-title">{selected ? formatLong(selected) : `Week of ${formatShort(weekStart)}`}</span>
        <span className="card-meta">{selected ? 'Tap the day again for the week' : 'Tap a day'}</span>
      </div>
      <BarChart
        data={days.map((k) => ({ key: k, label: weekdayShort(k).slice(0, 1), value: d.intakeOn(k).calories, target: d.targetsOn(k)?.calories, faded: k > d.today }))}
        color="var(--calories)"
        selected={selected ?? undefined}
        onSelect={(k) => setSelected(selected === k ? null : k)}
        tooltip={(b) => (
          <>
            {kcal(b.value)} kcal <span className="t-sub">/ {b.target != null ? kcal(b.target) : '—'} · {formatShort(b.key)}</span>
          </>
        )}
      />
      <div className="legend">
        <span>
          <i className="swatch" style={{ background: 'var(--calories)' }} />
          Calories eaten
        </span>
        <span>
          <i className="swatch line" style={{ background: 'var(--text)' }} />
          Target
        </span>
      </div>
      <div style={{ marginTop: 14 }}>
        <MacroStrip intake={intake} targets={targets} />
      </div>
    </>
  )
}

function EnergyWidget() {
  const d = useDerived()
  const days = range(addDays(d.today, -29), d.today)
  const logged = days.filter((k) => d.totals.has(k) && k !== d.today)
  const avgIntake = logged.length ? logged.reduce((s, k) => s + d.intakeOn(k).calories, 0) / logged.length : 0
  const avgExp = logged.length ? logged.reduce((s, k) => s + (d.expenditure.get(k) ?? 0), 0) / logged.length : 0
  const balance = avgIntake - avgExp
  return (
    <>
      <div className="card-head">
        <span className="card-title">Last 30 days</span>
        <span className="card-meta">{logged.length} days logged</span>
      </div>
      <BarChart
        data={days.map((k) => ({ key: k, label: fromKey(k).getDate().toString(), value: d.intakeOn(k).calories, line: d.expenditure.get(k) }))}
        color="var(--calories)"
        lineColor="var(--protein)"
        labelEvery={7}
        tooltip={(b) => (
          <>
            {kcal(b.value)} in <span className="t-sub">· {b.line != null ? kcal(b.line) : '—'} out · {formatShort(b.key)}</span>
          </>
        )}
      />
      <div className="legend">
        <span>
          <i className="swatch" style={{ background: 'var(--calories)' }} />
          Intake
        </span>
        <span>
          <i className="swatch line" style={{ background: 'var(--protein)' }} />
          Expenditure
        </span>
      </div>
      <div className="grid-2" style={{ marginTop: 14, gridTemplateColumns: '1fr 1fr 1fr' }}>
        <Stat label="Avg intake" value={kcal(avgIntake)} />
        <Stat label="Avg expenditure" value={kcal(avgExp)} />
        <Stat label="Avg balance" value={signed(Math.round(balance), 0)} tone={balance < 0 ? 'good' : undefined} />
      </div>
    </>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' }) {
  return (
    <div>
      <div className="faint" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </div>
      <div className={`num ${tone ?? ''}`} style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>
        {value}
      </div>
    </div>
  )
}

function TodayWidget() {
  const d = useDerived()
  const intake = d.intakeOn(d.today)
  const targets = d.targetsOn(d.today)
  const left = (targets?.calories ?? 0) - intake.calories
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Ring value={intake.calories} max={targets?.calories ?? 0} color="var(--calories)" size={128} stroke={11}>
          <div>
            <div className="big-num" style={{ fontSize: 24 }}>
              {kcal(Math.abs(left))}
            </div>
            <div className="faint" style={{ fontSize: 12 }}>
              {left >= 0 ? 'kcal left' : 'kcal over'}
            </div>
          </div>
        </Ring>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
          <div>
            <span className="faint">Eaten</span> <b className="num">{kcal(intake.calories)}</b>
          </div>
          <div>
            <span className="faint">Target</span> <b className="num">{targets ? kcal(targets.calories) : '—'}</b>
          </div>
          <div>
            <span className="faint">Expenditure</span> <b className="num">{kcal(d.expenditure.get(d.today) ?? 0)}</b>
          </div>
        </div>
      </div>
      <MacroRows intake={intake} targets={targets} />
    </div>
  )
}
