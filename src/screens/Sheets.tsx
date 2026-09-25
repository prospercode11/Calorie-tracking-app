import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { MacroChips, Segmented, Sheet } from '../components/ui'
import { formatLong, formatTime, nowMinutes, today, type DayKey } from '../lib/date'
import { searchFoods } from '../lib/foods'
import { fromDisplayWeight, kcal, toDisplayWeight, weightUnit } from '../lib/format'
import { caloriesFromMacros, scaleMacros } from '../lib/nutrition'
import { actions, allFoods, findFood, useStore } from '../lib/store'
import type { Food } from '../lib/types'

function timeToInput(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}
function inputToTime(v: string): number {
  const [h, m] = v.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

// ---- Add food ---------------------------------------------------------------

type AddMode = 'search' | 'quick' | 'create'

export function AddFoodSheet({ day, time, onClose }: { day: DayKey; time?: number; onClose: () => void }) {
  const state = useStore()
  const [mode, setMode] = useState<AddMode>('search')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Food | null>(null)
  const [when, setWhen] = useState(time ?? (day === today() ? nowMinutes() : 12 * 60))

  const foods = allFoods(state)
  const results = useMemo(() => {
    if (query.trim()) return searchFoods(foods, query).slice(0, 50)
    const recent = state.recentFoodIds.map((id) => foods.find((f) => f.id === id)).filter((f): f is Food => !!f)
    return recent.length ? recent : foods.slice(0, 20)
  }, [query, foods, state.recentFoodIds])

  if (picked) {
    return <ServingPicker food={picked} day={day} time={when} setTime={setWhen} onBack={() => setPicked(null)} onDone={onClose} />
  }

  return (
    <Sheet title={`Log food · ${formatLong(day)}`} onClose={onClose}>
      <Segmented<AddMode>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'search', label: 'Search' },
          { value: 'quick', label: 'Quick add' },
          { value: 'create', label: 'New food' },
        ]}
      />
      <label className="field">
        <span>Time</span>
        <input className="input" type="time" value={timeToInput(when)} onChange={(e) => setWhen(inputToTime(e.target.value))} />
      </label>

      {mode === 'search' && (
        <>
          <div className="search">
            <Icon name="search" size={18} />
            <input autoFocus placeholder="Search foods" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search foods" />
          </div>
          <div className="section-title" style={{ margin: '4px 4px -4px' }}>
            {query.trim() ? `${results.length} results` : state.recentFoodIds.length ? 'Recent' : 'Popular'}
          </div>
          <div className="list">
            {results.map((f) => (
              <button key={f.id} className="list-item" onClick={() => setPicked(f)}>
                <div className="grow">
                  <div className="name">{f.name}</div>
                  <div className="detail">
                    {f.brand ? `${f.brand} · ` : ''}
                    {f.servingLabel}
                    {f.custom ? ' · My food' : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="kcal">{kcal(f.per.calories)}</div>
                  <MacroChips m={f.per} />
                </div>
              </button>
            ))}
            {results.length === 0 && (
              <div className="empty">
                No matches. <button className="link" onClick={() => setMode('create')}>Create “{query}”</button>
              </div>
            )}
          </div>
        </>
      )}

      {mode === 'quick' && <QuickAdd day={day} time={when} onDone={onClose} />}
      {mode === 'create' && <CreateFood initialName={query} onCreated={(f) => setPicked(f)} />}
    </Sheet>
  )
}

function ServingPicker({ food, day, time, setTime, onBack, onDone }: { food: Food; day: DayKey; time: number; setTime: (t: number) => void; onBack: () => void; onDone: () => void }) {
  const [unit, setUnit] = useState<'serving' | 'g'>('serving')
  const [amount, setAmount] = useState('1')
  const n = Number(amount) || 0
  const servings = unit === 'serving' ? n : n / food.servingGrams
  const m = scaleMacros(food.per, servings)

  return (
    <Sheet
      title={food.name}
      onClose={onDone}
      action={
        <button className="link" onClick={onBack}>
          Back
        </button>
      }
    >
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="big-num">
          {kcal(m.calories)}
          <small>kcal</small>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <MacroChips m={m} />
        </div>
      </div>
      <div className="row">
        <label className="field">
          <span>Amount</span>
          <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>Unit</span>
          <select
            className="input"
            value={unit}
            onChange={(e) => {
              const next = e.target.value as 'serving' | 'g'
              setAmount(next === 'g' ? String(Math.round(servings * food.servingGrams)) : String(+servings.toFixed(2)))
              setUnit(next)
            }}
          >
            <option value="serving">{food.servingLabel}</option>
            <option value="g">grams</option>
          </select>
        </label>
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {[0.5, 1, 1.5, 2].map((q) => (
          <button key={q} className="btn" onClick={() => (setUnit('serving'), setAmount(String(q)))}>
            {q}×
          </button>
        ))}
      </div>
      <label className="field">
        <span>Time</span>
        <input className="input" type="time" value={timeToInput(time)} onChange={(e) => setTime(inputToTime(e.target.value))} />
      </label>
      <button
        className="btn primary block"
        disabled={servings <= 0}
        onClick={() => {
          actions.logFood(food, servings, day, time)
          onDone()
        }}
      >
        Log {kcal(m.calories)} kcal at {formatTime(time)}
      </button>
    </Sheet>
  )
}

function NumField({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <label className="field">
      <span>
        {label}
        {suffix ? ` (${suffix})` : ''}
      </span>
      <input className="input" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" />
    </label>
  )
}

function QuickAdd({ day, time, onDone }: { day: DayKey; time: number; onDone: () => void }) {
  const [name, setName] = useState('')
  const [p, setP] = useState('')
  const [f, setF] = useState('')
  const [c, setC] = useState('')
  const [cal, setCal] = useState('')
  const derived = Math.round(caloriesFromMacros(+p || 0, +f || 0, +c || 0))
  const calories = cal ? +cal || 0 : derived
  return (
    <>
      <label className="field">
        <span>Name (optional)</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Quick add" />
      </label>
      <div className="row">
        <NumField label="Protein" suffix="g" value={p} onChange={setP} />
        <NumField label="Fat" suffix="g" value={f} onChange={setF} />
        <NumField label="Carbs" suffix="g" value={c} onChange={setC} />
      </div>
      <NumField label={`Calories — leave blank to use ${derived} from macros`} value={cal} onChange={setCal} />
      <button
        className="btn primary block"
        disabled={calories <= 0}
        onClick={() => {
          actions.quickAdd(name, { calories, protein: +p || 0, fat: +f || 0, carbs: +c || 0 }, day, time)
          onDone()
        }}
      >
        Add {kcal(calories)} kcal
      </button>
    </>
  )
}

function CreateFood({ initialName, onCreated }: { initialName: string; onCreated: (f: Food) => void }) {
  const [name, setName] = useState(initialName)
  const [brand, setBrand] = useState('')
  const [servingLabel, setServingLabel] = useState('1 serving')
  const [servingGrams, setServingGrams] = useState('100')
  const [p, setP] = useState('')
  const [f, setF] = useState('')
  const [c, setC] = useState('')
  const [cal, setCal] = useState('')
  const calories = cal ? +cal || 0 : Math.round(caloriesFromMacros(+p || 0, +f || 0, +c || 0))
  return (
    <>
      <label className="field">
        <span>Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Brand (optional)</span>
        <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} />
      </label>
      <div className="row">
        <label className="field">
          <span>Serving</span>
          <input className="input" value={servingLabel} onChange={(e) => setServingLabel(e.target.value)} />
        </label>
        <NumField label="Grams" value={servingGrams} onChange={setServingGrams} />
      </div>
      <div className="section-title" style={{ margin: '4px 4px -4px' }}>
        Nutrition per serving
      </div>
      <div className="row">
        <NumField label="Protein" suffix="g" value={p} onChange={setP} />
        <NumField label="Fat" suffix="g" value={f} onChange={setF} />
        <NumField label="Carbs" suffix="g" value={c} onChange={setC} />
      </div>
      <NumField label="Calories (blank = from macros)" value={cal} onChange={setCal} />
      <button
        className="btn primary block"
        disabled={!name.trim() || calories <= 0}
        onClick={() =>
          onCreated(
            actions.createFood({
              name: name.trim(),
              brand: brand.trim() || undefined,
              servingLabel: servingLabel.trim() || '1 serving',
              servingGrams: +servingGrams || 100,
              per: { calories, protein: +p || 0, fat: +f || 0, carbs: +c || 0 },
            }),
          )
        }
      >
        Save food
      </button>
    </>
  )
}

// ---- Edit a logged entry ----------------------------------------------------

export function EntrySheet({ id, onClose }: { id: string; onClose: () => void }) {
  const state = useStore()
  const entry = state.entries.find((e) => e.id === id)
  const [servings, setServings] = useState(entry ? String(+entry.servings.toFixed(2)) : '1')
  const [time, setTime] = useState(entry?.time ?? 0)
  if (!entry) return null
  const food = findFood(state, entry.foodId)
  const n = Number(servings) || 0
  const preview = entry.servings > 0 ? scaleMacros(entry.macros, n / entry.servings) : entry.macros

  return (
    <Sheet title={entry.name} onClose={onClose}>
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="big-num">
          {kcal(preview.calories)}
          <small>kcal</small>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <MacroChips m={preview} />
        </div>
        {food && <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>1 serving = {food.servingLabel}</div>}
      </div>
      <div className="row">
        {!entry.quickAdd && (
          <label className="field">
            <span>Servings</span>
            <input className="input" inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} />
          </label>
        )}
        <label className="field">
          <span>Time</span>
          <input className="input" type="time" value={timeToInput(time)} onChange={(e) => setTime(inputToTime(e.target.value))} />
        </label>
      </div>
      <button
        className="btn primary block"
        disabled={n <= 0}
        onClick={() => {
          actions.updateEntry(id, { servings: entry.quickAdd ? entry.servings : n, time })
          onClose()
        }}
      >
        Save
      </button>
      {food && (
        <button
          className="btn block"
          onClick={() => {
            actions.logFood(food, entry.servings, today())
            onClose()
          }}
        >
          <Icon name="copy" size={16} /> Log again today
        </button>
      )}
      <button
        className="btn danger block"
        onClick={() => {
          actions.deleteEntry(id)
          onClose()
        }}
      >
        Delete entry
      </button>
    </Sheet>
  )
}

// ---- Weigh-in ---------------------------------------------------------------

export function WeightSheet({ day: initialDay, onClose }: { day?: DayKey; onClose: () => void }) {
  const state = useStore()
  const units = state.settings.units
  const [day, setDay] = useState(initialDay ?? today())
  const existing = state.weights.find((w) => w.day === day)
  const last = [...state.weights].sort((a, b) => b.day.localeCompare(a.day))[0]
  const [value, setValue] = useState(existing ? toDisplayWeight(existing.kg, units).toFixed(1) : last ? toDisplayWeight(last.kg, units).toFixed(1) : '')
  const n = Number(value)
  return (
    <Sheet title="Log weight" onClose={onClose}>
      <label className="field">
        <span>Date</span>
        <input className="input" type="date" value={day} max={today()} onChange={(e) => {
            const k = e.target.value
            if (!k) return
            setDay(k)
            const w = state.weights.find((x) => x.day === k)
            if (w) setValue(toDisplayWeight(w.kg, units).toFixed(1))
          }} />
      </label>
      <label className="field">
        <span>Scale weight ({weightUnit(units)})</span>
        <input className="input" inputMode="decimal" autoFocus value={value} onChange={(e) => setValue(e.target.value)} style={{ fontSize: 28, fontWeight: 700, textAlign: 'center' }} />
      </label>
      <p className="faint" style={{ fontSize: 13, margin: 0 }}>
        Weigh in first thing in the morning, after the bathroom and before eating. Daily swings are normal — the trend smooths them out.
      </p>
      <button
        className="btn primary block"
        disabled={!(n > 0)}
        onClick={() => {
          actions.logWeight(day, fromDisplayWeight(n, units))
          onClose()
        }}
      >
        Save {n > 0 ? `${n} ${weightUnit(units)}` : ''}
      </button>
      {existing && (
        <button
          className="btn danger block"
          onClick={() => {
            actions.deleteWeight(day)
            onClose()
          }}
        >
          Delete this weigh-in
        </button>
      )}
      <span className="faint" style={{ fontSize: 12, textAlign: 'center' }}>
        {existing ? `Currently ${toDisplayWeight(existing.kg, units).toFixed(1)} ${weightUnit(units)} on this day` : 'No weigh-in on this day yet'}
      </span>
    </Sheet>
  )
}
