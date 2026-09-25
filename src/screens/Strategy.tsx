import { useState } from 'react'
import { Icon } from '../components/Icon'
import { Screen, Segmented, Sheet } from '../components/ui'
import { addDays, formatLong, formatShort, fromKey, weekdayName } from '../lib/date'
import { useDerived } from '../lib/derived'
import { fromDisplayWeight, grams, kcal, signed, toDisplayWeight, weight, weightUnit } from '../lib/format'
import { KCAL_PER_KG } from '../lib/nutrition'
import { actions } from '../lib/store'
import type { Goal, GoalType, ProgramStyle } from '../lib/types'
import { goalLabel } from './Dashboard'

const STYLE_LABEL: Record<ProgramStyle, string> = { balanced: 'Balanced', lowFat: 'Low fat', lowCarb: 'Low carb', keto: 'Keto' }

export function Strategy() {
  const d = useDerived()
  const [editing, setEditing] = useState(false)
  const { goal, settings } = d.state
  const units = settings.units
  const history = [...d.state.targetsHistory].sort((a, b) => b.from.localeCompare(a.from))
  const current = history[0]
  const previous = history[1]
  const trendNow = d.trend.get(d.today)

  let next = addDays(d.today, 1)
  while (fromKey(next).getDay() !== goal.checkInDay) next = addDays(next, 1)

  const weeklyKg = trendNow != null ? (goal.ratePctPerWeek / 100) * trendNow : 0
  let eta: string | null = null
  if (goal.targetWeightKg && trendNow != null && goal.type !== 'maintain' && weeklyKg !== 0) {
    const weeks = (goal.targetWeightKg - trendNow) / weeklyKg
    if (weeks > 0) eta = formatShort(addDays(d.today, Math.round(weeks * 7)))
  }

  return (
    <Screen
      title="Strategy"
      right={
        <button className="link" onClick={() => setEditing(true)}>
          Edit program
        </button>
      }
    >
      <div className="card">
        <div className="card-head">
          <span className="card-title">{goalLabel(goal.type)}</span>
          <span className="pill accent">{STYLE_LABEL[goal.style]}</span>
        </div>
        <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <Metric label="Rate" value={goal.type === 'maintain' ? '0%' : `${signed(goal.ratePctPerWeek, 2)}%`} sub="per week" />
          <Metric label="≈ per week" value={goal.type === 'maintain' ? '0' : signed(toDisplayWeight(weeklyKg, units), 2)} sub={weightUnit(units)} />
          <Metric label="Goal weight" value={goal.targetWeightKg ? weight(goal.targetWeightKg, units) : '—'} sub={eta ? `by ~${eta}` : weightUnit(units)} />
        </div>
      </div>

      <div className="section-title">Current targets</div>
      {current ? (
        <div className="card">
          <div className="card-head">
            <span className="card-title">Since {formatLong(current.from)}</span>
            <span className="card-meta">Expenditure {kcal(current.expenditure)} kcal</span>
          </div>
          <div className="macro-strip">
            <Target label="Calories" value={kcal(current.targets.calories)} delta={previous ? current.targets.calories - previous.targets.calories : undefined} color="var(--calories)" />
            <Target label="Protein" value={`${grams(current.targets.protein)}g`} delta={previous ? current.targets.protein - previous.targets.protein : undefined} color="var(--protein)" />
            <Target label="Fat" value={`${grams(current.targets.fat)}g`} delta={previous ? current.targets.fat - previous.targets.fat : undefined} color="var(--fat)" />
            <Target label="Carbs" value={`${grams(current.targets.carbs)}g`} delta={previous ? current.targets.carbs - previous.targets.carbs : undefined} color="var(--carbs)" />
          </div>
        </div>
      ) : (
        <div className="card empty">No targets yet.</div>
      )}

      <div className="card">
        <div className="habit">
          <div className="icon">
            <Icon name="calendar" size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <b>Next check-in: {formatLong(next)}</b>
            <div className="muted" style={{ fontSize: 13 }}>
              Targets update every {weekdayName(goal.checkInDay)} from your intake and weight trend.
            </div>
          </div>
        </div>
        <button className="btn block" style={{ marginTop: 12 }} onClick={() => actions.checkIn()}>
          Check in now
        </button>
      </div>

      <div className="section-title">How your targets are set</div>
      <div className="card muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
        Your expenditure is estimated from what you eat and how your <b>trend weight</b> changes: every {kcal(KCAL_PER_KG)} kcal eaten above or below expenditure moves the trend by about 1 kg. Each check-in sets calories to
        expenditure {goal.type === 'maintain' ? '' : goal.type === 'lose' ? 'minus' : 'plus'}
        {goal.type === 'maintain' ? '' : ` the energy needed for ${Math.abs(goal.ratePctPerWeek)}% of body weight per week`}, protein to {goal.proteinPerKg} g per kg of trend weight, and splits the rest by your {STYLE_LABEL[goal.style].toLowerCase()} preference.
      </div>

      <div className="section-title">Check-in history</div>
      <div className="list">
        {history.slice(0, 12).map((r, i) => {
          const prev = history[i + 1]
          return (
            <div className="list-item" key={r.from}>
              <div className="grow">
                <div className="name">{formatLong(r.from)}</div>
                <div className="detail num">
                  Expenditure {kcal(r.expenditure)} · P {grams(r.targets.protein)} · F {grams(r.targets.fat)} · C {grams(r.targets.carbs)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="kcal">{kcal(r.targets.calories)}</div>
                {prev && <div className="detail num">{signed(r.targets.calories - prev.targets.calories, 0)}</div>}
              </div>
            </div>
          )
        })}
      </div>

      {editing && <EditProgram goal={goal} units={units} trendKg={trendNow} onClose={() => setEditing(false)} />}
    </Screen>
  )
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="faint" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </div>
      <div className="num" style={{ fontSize: 18, fontWeight: 700, margin: '2px 0' }}>
        {value}
      </div>
      <div className="faint" style={{ fontSize: 12 }}>
        {sub}
      </div>
    </div>
  )
}

function Target({ label, value, delta, color }: { label: string; value: string; delta?: number; color: string }) {
  return (
    <div className="cell">
      <div className="label">
        <span className="dot" style={{ background: color }} />
        {label}
      </div>
      <div className="val">{value}</div>
      {delta != null && delta !== 0 && <div className="faint num" style={{ fontSize: 12 }}>{signed(Math.round(delta), 0)}</div>}
    </div>
  )
}

export function EditProgram({ goal, units, trendKg, onClose }: { goal: Goal; units: 'metric' | 'imperial'; trendKg?: number; onClose: () => void }) {
  const [draft, setDraft] = useState<Goal>(goal)
  const [target, setTarget] = useState(goal.targetWeightKg ? toDisplayWeight(goal.targetWeightKg, units).toFixed(1) : '')
  const set = (patch: Partial<Goal>) => setDraft((g) => ({ ...g, ...patch }))
  const magnitude = Math.abs(draft.ratePctPerWeek) || 0.5
  const kgPerWeek = trendKg != null ? (magnitude / 100) * trendKg : undefined

  return (
    <Sheet title="Edit program" onClose={onClose}>
      <label className="field">
        <span>Goal</span>
        <Segmented<GoalType>
          value={draft.type}
          onChange={(type) => set({ type, ratePctPerWeek: type === 'lose' ? -magnitude : type === 'gain' ? Math.min(magnitude, 0.5) : 0 })}
          options={[
            { value: 'lose', label: 'Lose' },
            { value: 'maintain', label: 'Maintain' },
            { value: 'gain', label: 'Gain' },
          ]}
        />
      </label>
      {draft.type !== 'maintain' && (
        <label className="field">
          <span>
            Rate: {magnitude.toFixed(2)}% of body weight / week
            {kgPerWeek != null ? ` (≈ ${toDisplayWeight(kgPerWeek, units).toFixed(2)} ${weightUnit(units)})` : ''}
          </span>
          <input
            type="range"
            min={draft.type === 'lose' ? 0.1 : 0.05}
            max={draft.type === 'lose' ? 1.25 : 0.75}
            step={0.05}
            value={magnitude}
            onChange={(e) => set({ ratePctPerWeek: (draft.type === 'lose' ? -1 : 1) * Number(e.target.value) })}
          />
        </label>
      )}
      <label className="field">
        <span>Goal weight ({weightUnit(units)}, optional)</span>
        <input className="input" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
      </label>
      <label className="field">
        <span>Diet style</span>
        <Segmented<ProgramStyle>
          value={draft.style}
          onChange={(style) => set({ style })}
          options={(Object.keys(STYLE_LABEL) as ProgramStyle[]).map((k) => ({ value: k, label: STYLE_LABEL[k] }))}
        />
      </label>
      <label className="field">
        <span>Protein: {draft.proteinPerKg.toFixed(1)} g/kg ({(draft.proteinPerKg / 2.20462).toFixed(2)} g/lb)</span>
        <input type="range" min={1.2} max={3} step={0.1} value={draft.proteinPerKg} onChange={(e) => set({ proteinPerKg: Number(e.target.value) })} />
      </label>
      <label className="field">
        <span>Check-in day</span>
        <select className="input" value={draft.checkInDay} onChange={(e) => set({ checkInDay: Number(e.target.value) })}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <option key={i} value={i}>
              {weekdayName(i)}
            </option>
          ))}
        </select>
      </label>
      <button
        className="btn primary block"
        onClick={() => {
          const t = Number(target)
          actions.setGoal({ ...draft, targetWeightKg: t > 0 ? fromDisplayWeight(t, units) : undefined })
          onClose()
        }}
      >
        Save &amp; update targets
      </button>
    </Sheet>
  )
}
