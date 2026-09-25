import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(320)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // Before layout the element can report 0; keep the last usable width.
    const measure = () => el.clientWidth > 80 && setWidth(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

function niceTicks(min: number, max: number, count = 3): number[] {
  if (max <= min) return [min]
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(6)))
  return out
}

/** A bar with 4px rounded ends at the data end, square at the baseline. */
function barPath(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0) return ''
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}

export interface BarDatum {
  key: string
  label: string
  value: number
  target?: number
  /** Line value drawn across bars, e.g. expenditure. */
  line?: number
  faded?: boolean
}

interface BarChartProps {
  data: BarDatum[]
  height?: number
  color: string
  lineColor?: string
  selected?: string
  onSelect?: (key: string) => void
  tooltip: (d: BarDatum) => ReactNode
  labelEvery?: number
}

/** Vertical bars on one kcal axis, with optional target ticks and an overlaid line. */
export function BarChart({ data, height = 150, color, lineColor, selected, onSelect, tooltip, labelEvery = 1 }: BarChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const padL = 34
  const padB = 20
  const padT = 6
  const plotW = width - padL
  const plotH = height - padB - padT
  const max = Math.max(1, ...data.flatMap((d) => [d.value, d.target ?? 0, d.line ?? 0])) * 1.08
  const ticks = niceTicks(0, max, 3)
  const y = (v: number) => padT + plotH - (v / max) * plotH
  const slot = plotW / Math.max(1, data.length)
  const gap = Math.max(2, Math.min(8, slot * 0.28))
  const bw = slot - gap
  const hasLine = data.some((d) => d.line != null)
  const linePts = data
    .map((d, i) => (d.line != null ? `${padL + i * slot + slot / 2},${y(d.line)}` : null))
    .filter(Boolean)
    .join(' ')

  return (
    <div className="chart-wrap" ref={ref} onPointerLeave={() => setHover(null)}>
      <svg className="chart" width={width} height={height} role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={padL} x2={width} y1={y(t)} y2={y(t)} />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end">
              {t >= 1000 ? `${(t / 1000).toFixed(t % 1000 ? 1 : 0)}k` : t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = padL + i * slot + gap / 2
          const isSel = selected === d.key
          const dim = (selected && !isSel) || d.faded
          return (
            <g key={d.key}>
              <path d={barPath(x, y(d.value), bw, y(0) - y(d.value))} fill={color} opacity={dim ? 0.35 : 1} />
              {d.target != null && (
                <line x1={x - 1} x2={x + bw + 1} y1={y(d.target)} y2={y(d.target)} stroke="var(--text)" strokeWidth={2} strokeLinecap="round" opacity={dim ? 0.35 : 0.8} />
              )}
              {i % labelEvery === 0 && (
                <text x={x + bw / 2} y={height - 5} textAnchor="middle" style={isSel ? { fill: 'var(--text)', fontWeight: 700 } : undefined}>
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
        {hasLine && <polyline points={linePts} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {hover != null && <line x1={padL + hover * slot + slot / 2} x2={padL + hover * slot + slot / 2} y1={padT} y2={y(0)} stroke="var(--text-3)" strokeDasharray="2 3" />}
        {data.map((d, i) => (
          <rect
            key={d.key}
            x={padL + i * slot}
            y={0}
            width={slot}
            height={height}
            fill="transparent"
            onPointerEnter={() => setHover(i)}
            onPointerDown={() => setHover(i)}
            onClick={() => onSelect?.(d.key)}
            style={{ cursor: onSelect ? 'pointer' : 'default' }}
          >
            <title>{d.label}</title>
          </rect>
        ))}
      </svg>
      {hover != null && data[hover] && (
        <div className="tooltip" style={{ left: Math.min(Math.max(padL + hover * slot + slot / 2, 60), width - 60), top: Math.max(0, y(Math.max(data[hover].value, data[hover].target ?? 0, data[hover].line ?? 0)) - 6) }}>
          {tooltip(data[hover])}
        </div>
      )}
    </div>
  )
}

export interface LineSeries {
  name: string
  color: string
  kind: 'line' | 'dots'
  values: (number | null)[]
}

interface LineChartProps {
  labels: string[]
  series: LineSeries[]
  height?: number
  tooltip: (i: number) => ReactNode
  format?: (v: number) => string
  labelCount?: number
  minSpan?: number
}

/** Time series on one shared y-axis; the hover layer is a crosshair + tooltip. */
export function LineChart({ labels, series, height = 210, tooltip, format = (v) => v.toFixed(0), labelCount = 4, minSpan = 1 }: LineChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const padL = 38
  const padR = 8
  const padB = 20
  // Top padding reserves room for the hover tooltip so it never covers the card header.
  const padT = 34
  const plotW = width - padL - padR
  const plotH = height - padB - padT
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null))
  let lo = all.length ? Math.min(...all) : 0
  let hi = all.length ? Math.max(...all) : 1
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2
    lo = mid - minSpan / 2
    hi = mid + minSpan / 2
  }
  const pad = (hi - lo) * 0.1
  lo -= pad
  hi += pad
  const n = labels.length
  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const y = (v: number) => padT + plotH - ((v - lo) / (hi - lo)) * plotH
  const ticks = niceTicks(lo, hi, 3)
  const labelIdx = n <= 1 ? [0] : Array.from({ length: labelCount }, (_, k) => Math.round((k * (n - 1)) / (labelCount - 1)))

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const i = Math.round(((px - padL) / plotW) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }

  return (
    <div className="chart-wrap" ref={ref}>
      <svg className="chart" width={width} height={height} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end">
              {format(t)}
            </text>
          </g>
        ))}
        {labelIdx.map((i, k) => (
          <text key={k} x={x(i)} y={height - 5} textAnchor={k === 0 ? 'start' : k === labelIdx.length - 1 ? 'end' : 'middle'}>
            {labels[i]}
          </text>
        ))}
        {series.map((s) =>
          s.kind === 'dots' ? (
            <g key={s.name}>
              {s.values.map((v, i) => (v == null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={n > 120 ? 1.5 : 2.5} fill={s.color} />))}
            </g>
          ) : (
            <path key={s.name} d={linePath(s.values, x, y)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ),
        )}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + plotH} stroke="var(--text-3)" strokeDasharray="2 3" />
            {series.map((s) => {
              const v = s.values[hover]
              return v == null ? null : <circle key={s.name} cx={x(hover)} cy={y(v)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
            })}
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="tooltip below" style={{ left: Math.min(Math.max(x(hover), 70), width - 70), top: 0 }}>
          {tooltip(hover)}
        </div>
      )}
    </div>
  )
}

function linePath(values: (number | null)[], x: (i: number) => number, y: (v: number) => number): string {
  let d = ''
  let pen = false
  values.forEach((v, i) => {
    if (v == null) {
      pen = false
      return
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
    pen = true
  })
  return d
}

/** Tiny trend line for summary cards (no axes, no hover — the card opens the full chart). */
export function Sparkline({ values, color, height = 40 }: { values: (number | null)[]; color: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const nums = values.filter((v): v is number => v != null)
  if (nums.length < 2) return <div ref={ref} style={{ height }} />
  const lo = Math.min(...nums)
  const hi = Math.max(...nums)
  const span = hi - lo || 1
  const x = (i: number) => 2 + (i / (values.length - 1)) * (width - 4)
  const y = (v: number) => 3 + (height - 6) - ((v - lo) / span) * (height - 6)
  return (
    <div ref={ref}>
      <svg className="chart" width={width} height={height} aria-hidden="true">
        <path d={linePath(values, x, y)} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

/** Circular progress toward a target. */
export function Ring({ value, max, color, size = 120, stroke = 10, children }: { value: number; max: number; color: string; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const frac = max > 0 ? Math.min(1, value / max) : 0
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${frac * c} ${c}`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div>
    </div>
  )
}
