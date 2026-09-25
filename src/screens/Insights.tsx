import { useState } from 'react'
import { LineChart } from '../components/Charts'
import { Screen, Segmented } from '../components/ui'
import { addDays, formatShort, range } from '../lib/date'
import { useDerived } from '../lib/derived'
import { kcal, signed, toDisplayWeight, weight, weightUnit } from '../lib/format'
import type { Nav } from '../App'

type Span = '1M' | '3M' | '6M' | 'All'
const SPAN_DAYS: Record<Span, number> = { '1M': 30, '3M': 91, '6M': 182, All: 100000 }

function useSpanDays(span: Span) {
  const d = useDerived()
  const start = addDays(d.today, -(SPAN_DAYS[span] - 1))
  return range(start > d.firstDay ? start : d.firstDay, d.today)
}

const SPANS = (['1M', '3M', '6M', 'All'] as Span[]).map((s) => ({ value: s, label: s }))

export function WeightScreen({ nav }: { nav: Nav }) {
  const d = useDerived()
  const units = d.state.settings.units
  const [span, setSpan] = useState<Span>('1M')
  const days = useSpanDays(span)
  const trend = days.map((k) => d.trend.get(k) ?? null)
  const scale = days.map((k) => d.scale.get(k) ?? null)
  const disp = (v: number | null) => (v == null ? null : toDisplayWeight(v, units))
  const first = trend.find((v) => v != null)
  const last = [...trend].reverse().find((v) => v != null)
  const change = first != null && last != null ? last - first : null
  const weeks = days.length / 7
  const weighIns = [...d.state.weights].sort((a, b) => b.day.localeCompare(a.day))

  return (
    <Screen
      title="Weight trend"
      onBack={nav.back}
      right={
        <button className="link" onClick={() => nav.sheet({ kind: 'weight' })}>
          Log
        </button>
      }
    >
      <Segmented value={span} onChange={setSpan} options={SPANS} />
      <div className="card">
        <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 12 }}>
          <div>
            <div className="faint" style={{ fontSize: 12 }}>Trend</div>
            <div className="big-num" style={{ fontSize: 22 }}>
              {last != null ? weight(last, units) : '—'}
              <small>{weightUnit(units)}</small>
            </div>
          </div>
          <div>
            <div className="faint" style={{ fontSize: 12 }}>Change</div>
            <div className="big-num" style={{ fontSize: 22 }}>
              {change != null ? signed(toDisplayWeight(change, units)) : '—'}
            </div>
          </div>
          <div>
            <div className="faint" style={{ fontSize: 12 }}>Per week</div>
            <div className="big-num" style={{ fontSize: 22 }}>
              {change != null && weeks >= 1 ? signed(toDisplayWeight(change / weeks, units), 2) : '—'}
            </div>
          </div>
        </div>
        <LineChart
          labels={days.map(formatShort)}
          series={[
            { name: 'Scale weight', color: 'var(--scale-dot)', kind: 'dots', values: scale.map(disp) },
            { name: 'Trend weight', color: 'var(--weight)', kind: 'line', values: trend.map(disp) },
          ]}
          format={(v) => v.toFixed(units === 'imperial' ? 0 : 1)}
          minSpan={2}
          tooltip={(i) => (
            <>
              {trend[i] != null ? `${weight(trend[i]!, units)} trend` : 'No data'}
              <span className="t-sub">
                {scale[i] != null ? ` · ${weight(scale[i]!, units)} scale` : ''} · {formatShort(days[i])}
              </span>
            </>
          )}
        />
        <div className="legend">
          <span>
            <i className="swatch" style={{ background: 'var(--scale-dot)', borderRadius: '50%' }} />
            Scale weight
          </span>
          <span>
            <i className="swatch line" style={{ background: 'var(--weight)' }} />
            Trend weight
          </span>
        </div>
      </div>
      <div className="card muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
        Scale weight bounces with water, salt and food volume. The trend line is a smoothed average that reveals the real direction, so a single high or low reading barely moves it.
      </div>
      <div className="section-title">Weigh-ins</div>
      <div className="list">
        {weighIns.slice(0, 60).map((w) => (
          <button key={w.day} className="list-item" onClick={() => nav.sheet({ kind: 'weight', day: w.day })}>
            <div className="grow">
              <div className="name">{formatShort(w.day)}</div>
              <div className="detail">Trend {d.trend.get(w.day) != null ? weight(d.trend.get(w.day)!, units) : '—'}</div>
            </div>
            <div className="kcal">
              {weight(w.kg, units)} {weightUnit(units)}
            </div>
          </button>
        ))}
        {weighIns.length === 0 && <div className="empty">No weigh-ins yet.</div>}
      </div>
    </Screen>
  )
}

export function ExpenditureScreen({ nav }: { nav: Nav }) {
  const d = useDerived()
  const [span, setSpan] = useState<Span>('3M')
  const days = useSpanDays(span)
  const values = days.map((k) => d.expenditure.get(k) ?? null)
  const now = d.expenditure.get(d.today) ?? d.state.initialExpenditure
  const first = values.find((v) => v != null) ?? now
  return (
    <Screen title="Expenditure" onBack={nav.back}>
      <Segmented value={span} onChange={setSpan} options={SPANS} />
      <div className="card">
        <div className="grid-2" style={{ marginBottom: 12 }}>
          <div>
            <div className="faint" style={{ fontSize: 12 }}>Current estimate</div>
            <div className="big-num">
              {kcal(now)}
              <small>kcal/day</small>
            </div>
          </div>
          <div>
            <div className="faint" style={{ fontSize: 12 }}>Change over period</div>
            <div className="big-num">{signed(now - first, 0)}</div>
          </div>
        </div>
        <LineChart
          labels={days.map(formatShort)}
          series={[{ name: 'Expenditure', color: 'var(--calories)', kind: 'line', values }]}
          minSpan={200}
          format={(v) => kcal(v)}
          tooltip={(i) => (
            <>
              {values[i] != null ? `${kcal(values[i]!)} kcal` : '—'}
              <span className="t-sub"> · {formatShort(days[i])}</span>
            </>
          )}
        />
      </div>
      <div className="card muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
        Your starting estimate ({kcal(d.state.initialExpenditure)} kcal) came from your profile. Since then it adapts to your real data: average intake minus the energy implied by your trend-weight change over the last three weeks. Days you
        didn't log are skipped rather than counted as zero, so gaps don't skew it. Log consistently, including the less tidy days, for the best estimate.
      </div>
    </Screen>
  )
}
