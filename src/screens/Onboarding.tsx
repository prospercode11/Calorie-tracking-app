import { useState } from 'react'
import { Segmented } from '../components/ui'
import { demoState } from '../lib/demo'
import { fromDisplayWeight, grams, kcal, weightUnit } from '../lib/format'
import { computeTargets, initialExpenditure } from '../lib/nutrition'
import { actions } from '../lib/store'
import type { Goal, GoalType, ProgramStyle, Sex, UnitSystem } from '../lib/types'

const ACTIVITY = [
  { value: 1.25, label: 'Mostly sitting', detail: 'Desk job, little exercise' },
  { value: 1.4, label: 'Lightly active', detail: 'On your feet some, or exercise 1–3×/week' },
  { value: 1.55, label: 'Active', detail: 'Exercise 3–5×/week or active job' },
  { value: 1.75, label: 'Very active', detail: 'Hard training most days or physical job' },
]

const STYLES: { value: ProgramStyle; label: string; detail: string }[] = [
  { value: 'balanced', label: 'Balanced', detail: '~30% of calories from fat, the rest from carbs' },
  { value: 'lowFat', label: 'Low fat', detail: '~20% fat, more room for carbs' },
  { value: 'lowCarb', label: 'Low carb', detail: '~45% fat, fewer carbs' },
  { value: 'keto', label: 'Keto', detail: '30 g carbs, most energy from fat' },
]

export function Onboarding() {
  const [step, setStep] = useState(0)
  const [units, setUnits] = useState<UnitSystem>('metric')
  const [sex, setSex] = useState<Sex>('female')
  const [birthYear, setBirthYear] = useState('1995')
  const [height, setHeight] = useState('170')
  const [heightIn, setHeightIn] = useState({ ft: '5', in: '7' })
  const [weightStr, setWeightStr] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [activity, setActivity] = useState(1.4)
  const [goalType, setGoalType] = useState<GoalType>('lose')
  const [rate, setRate] = useState(0.5)
  const [targetStr, setTargetStr] = useState('')
  const [style, setStyle] = useState<ProgramStyle>('balanced')
  const [protein, setProtein] = useState(2.0)

  const heightCm = units === 'metric' ? Number(height) : (Number(heightIn.ft) * 12 + Number(heightIn.in)) * 2.54
  const weightKg = fromDisplayWeight(Number(weightStr), units)
  const profile = { sex, birthYear: Number(birthYear), heightCm, activity, bodyFatPct: Number(bodyFat) || undefined }
  const goal: Goal = {
    type: goalType,
    ratePctPerWeek: goalType === 'lose' ? -rate : goalType === 'gain' ? rate : 0,
    targetWeightKg: Number(targetStr) > 0 ? fromDisplayWeight(Number(targetStr), units) : undefined,
    style,
    proteinPerKg: protein,
    checkInDay: 1,
  }

  const steps = ['welcome', 'about', 'body', 'activity', 'goal', 'diet', 'summary'] as const
  const current = steps[step]
  const valid: Record<(typeof steps)[number], boolean> = {
    welcome: true,
    about: Number(birthYear) > 1900 && Number(birthYear) < new Date().getFullYear() - 12,
    body: heightCm > 100 && heightCm < 250 && weightKg > 30 && weightKg < 350,
    activity: true,
    goal: true,
    diet: true,
    summary: true,
  }

  const next = () => setStep((s) => Math.min(steps.length - 1, s + 1))
  const back = () => setStep((s) => Math.max(0, s - 1))

  if (current === 'welcome') {
    return (
      <div className="onboard">
        <div className="spacer" />
        <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--accent)', display: 'grid', placeItems: 'center', color: 'white', fontSize: 34, fontWeight: 800 }}>F</div>
        <h1>Fuelwise</h1>
        <p className="muted" style={{ fontSize: 17, lineHeight: 1.5, margin: 0 }}>
          A macro tracker and diet coach that learns your real metabolism from what you eat and how your weight trends, then adjusts your targets every week.
        </p>
        <div className="spacer" />
        <button className="btn primary block" onClick={next}>
          Get started
        </button>
        <button className="btn block" onClick={() => actions.replace(demoState())}>
          Explore with demo data
        </button>
      </div>
    )
  }

  const exp = valid.body ? initialExpenditure(profile, weightKg) : 0
  const targets = valid.body ? computeTargets(exp, weightKg, goal) : null

  return (
    <div className="onboard">
      <div className="row" style={{ flex: 'none' }}>
        <button className="link" style={{ flex: 'none' }} onClick={back}>
          Back
        </button>
        <span className="step" style={{ textAlign: 'right' }}>
          Step {step} of {steps.length - 1}
        </span>
      </div>
      <div className="progress">
        <i style={{ width: `${(step / (steps.length - 1)) * 100}%` }} />
      </div>

      {current === 'about' && (
        <>
          <h1>About you</h1>
          <label className="field">
            <span>Sex (used for the starting metabolism estimate)</span>
            <Segmented<Sex>
              value={sex}
              onChange={setSex}
              options={[
                { value: 'female', label: 'Female' },
                { value: 'male', label: 'Male' },
              ]}
            />
          </label>
          <label className="field">
            <span>Birth year</span>
            <input className="input" inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} />
          </label>
        </>
      )}

      {current === 'body' && (
        <>
          <h1>Your body</h1>
          <Segmented<UnitSystem>
            value={units}
            onChange={setUnits}
            options={[
              { value: 'metric', label: 'kg / cm' },
              { value: 'imperial', label: 'lb / ft' },
            ]}
          />
          {units === 'metric' ? (
            <label className="field">
              <span>Height (cm)</span>
              <input className="input" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} />
            </label>
          ) : (
            <div className="row">
              <label className="field">
                <span>Height (ft)</span>
                <input className="input" inputMode="numeric" value={heightIn.ft} onChange={(e) => setHeightIn({ ...heightIn, ft: e.target.value })} />
              </label>
              <label className="field">
                <span>(in)</span>
                <input className="input" inputMode="numeric" value={heightIn.in} onChange={(e) => setHeightIn({ ...heightIn, in: e.target.value })} />
              </label>
            </div>
          )}
          <label className="field">
            <span>Current weight ({weightUnit(units)})</span>
            <input className="input" inputMode="decimal" value={weightStr} onChange={(e) => setWeightStr(e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span>Body fat % (optional, improves the estimate)</span>
            <input className="input" inputMode="decimal" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} />
          </label>
        </>
      )}

      {current === 'activity' && (
        <>
          <h1>How active are you?</h1>
          <p className="muted" style={{ margin: 0 }}>
            This only sets a starting point. Your expenditure will be recalculated from your own data.
          </p>
          <div className="choice-list">
            {ACTIVITY.map((a) => (
              <button key={a.value} className="choice" aria-pressed={activity === a.value} onClick={() => setActivity(a.value)}>
                <b>{a.label}</b>
                <span>{a.detail}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {current === 'goal' && (
        <>
          <h1>What's your goal?</h1>
          <Segmented<GoalType>
            value={goalType}
            onChange={(g) => {
              setGoalType(g)
              setRate(g === 'gain' ? 0.25 : 0.5)
            }}
            options={[
              { value: 'lose', label: 'Lose fat' },
              { value: 'maintain', label: 'Maintain' },
              { value: 'gain', label: 'Build muscle' },
            ]}
          />
          {goalType !== 'maintain' && (
            <label className="field">
              <span>
                Rate: {rate.toFixed(2)}% of body weight per week
                {weightKg > 0 ? ` (≈ ${((rate / 100) * Number(weightStr)).toFixed(2)} ${weightUnit(units)})` : ''}
              </span>
              <input type="range" min={goalType === 'lose' ? 0.1 : 0.05} max={goalType === 'lose' ? 1.25 : 0.75} step={0.05} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
              <span className="faint" style={{ fontSize: 12, fontWeight: 500 }}>
                {goalType === 'lose' ? (rate <= 0.5 ? 'Gentle — easier to sustain' : rate <= 0.9 ? 'Moderate' : 'Aggressive — harder to sustain') : rate <= 0.25 ? 'Lean gain' : 'Faster gain, more fat'}
              </span>
            </label>
          )}
          <label className="field">
            <span>Goal weight ({weightUnit(units)}, optional)</span>
            <input className="input" inputMode="decimal" value={targetStr} onChange={(e) => setTargetStr(e.target.value)} />
          </label>
        </>
      )}

      {current === 'diet' && (
        <>
          <h1>Diet preference</h1>
          <div className="choice-list">
            {STYLES.map((s) => (
              <button key={s.value} className="choice" aria-pressed={style === s.value} onClick={() => setStyle(s.value)}>
                <b>{s.label}</b>
                <span>{s.detail}</span>
              </button>
            ))}
          </div>
          <label className="field">
            <span>
              Protein: {protein.toFixed(1)} g per kg ({(protein / 2.20462).toFixed(2)} g/lb)
            </span>
            <input type="range" min={1.2} max={3} step={0.1} value={protein} onChange={(e) => setProtein(Number(e.target.value))} />
          </label>
        </>
      )}

      {current === 'summary' && targets && (
        <>
          <h1>Your starting plan</h1>
          <div className="card">
            <div className="faint" style={{ fontSize: 13 }}>Estimated expenditure</div>
            <div className="big-num">
              {kcal(exp)}
              <small>kcal/day</small>
            </div>
          </div>
          <div className="card">
            <div className="faint" style={{ fontSize: 13, marginBottom: 8 }}>Daily targets</div>
            <div className="macro-strip">
              {[
                ['Calories', kcal(targets.calories), 'var(--calories)'],
                ['Protein', `${grams(targets.protein)}g`, 'var(--protein)'],
                ['Fat', `${grams(targets.fat)}g`, 'var(--fat)'],
                ['Carbs', `${grams(targets.carbs)}g`, 'var(--carbs)'],
              ].map(([l, v, c]) => (
                <div className="cell" key={l}>
                  <div className="label">
                    <span className="dot" style={{ background: c }} />
                    {l}
                  </div>
                  <div className="val">{v}</div>
                </div>
              ))}
            </div>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            Log your food and weigh in as often as you can. Every Monday your targets are recalculated from your actual intake and weight trend.
          </p>
        </>
      )}

      <div className="spacer" />
      {current === 'summary' ? (
        <button className="btn primary block" onClick={() => actions.completeOnboarding(profile, goal, weightKg, units)}>
          Start tracking
        </button>
      ) : (
        <button className="btn primary block" disabled={!valid[current]} onClick={next}>
          Continue
        </button>
      )}
    </div>
  )
}
