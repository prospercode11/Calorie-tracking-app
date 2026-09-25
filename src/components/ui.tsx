import { useEffect, type ReactNode } from 'react'
import { grams, kcal } from '../lib/format'
import type { Macros } from '../lib/types'
import { Icon } from './Icon'

export const MACRO_META = [
  { key: 'calories', label: 'Calories', short: 'Cal', unit: '', color: 'var(--calories)' },
  { key: 'protein', label: 'Protein', short: 'P', unit: 'g', color: 'var(--protein)' },
  { key: 'fat', label: 'Fat', short: 'F', unit: 'g', color: 'var(--fat)' },
  { key: 'carbs', label: 'Carbs', short: 'C', unit: 'g', color: 'var(--carbs)' },
] as const

export function Sheet({ title, onClose, children, action }: { title: string; onClose: () => void; children: ReactNode; action?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
          <h2>{title}</h2>
          {action}
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function Screen({ title, sub, onBack, right, children }: { title: string; sub?: string; onBack?: () => void; right?: ReactNode; children: ReactNode }) {
  return (
    <>
      <header className="topbar">
        {onBack && (
          <button className="icon-btn" onClick={onBack} aria-label="Back">
            <Icon name="back" />
          </button>
        )}
        <h1>
          {title}
          {sub && <div className="sub">{sub}</div>}
        </h1>
        {right}
      </header>
      <main className="page">{children}</main>
    </>
  )
}

/** Compact four-column intake vs. target summary. */
export function MacroStrip({ intake, targets }: { intake: Macros; targets?: Macros }) {
  return (
    <div className="macro-strip">
      {MACRO_META.map((m) => {
        const v = intake[m.key]
        const t = targets?.[m.key]
        return (
          <div className="cell" key={m.key}>
            <div className="label">{m.label}</div>
            <div className="val">
              {m.key === 'calories' ? kcal(v) : grams(v)}
              {t != null && <span> / {m.key === 'calories' ? kcal(t) : `${grams(t)}g`}</span>}
            </div>
            <div className="bar">
              <i style={{ width: `${t ? Math.min(100, (v / t) * 100) : 0}%`, background: m.color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Full-width progress rows for each macro, with remaining amounts. */
export function MacroRows({ intake, targets }: { intake: Macros; targets?: Macros }) {
  return (
    <div className="macro-rows">
      {MACRO_META.map((m) => {
        const v = intake[m.key]
        const t = targets?.[m.key] ?? 0
        const left = t - v
        const fmt = (n: number) => (m.key === 'calories' ? `${kcal(n)} kcal` : `${grams(n)} g`)
        return (
          <div className="macro-row" key={m.key}>
            <div className="top">
              <b>
                <span className="dot" style={{ background: m.color }} />
                {m.label}
              </b>
              <span className="num muted">
                {fmt(v)} / {fmt(t)} · <span className={left < 0 ? 'danger' : ''}>{left >= 0 ? `${fmt(left)} left` : `${fmt(-left)} over`}</span>
              </span>
            </div>
            <div className="bar">
              <i style={{ width: `${t ? Math.min(100, (v / t) * 100) : 0}%`, background: m.color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function MacroChips({ m }: { m: Macros }) {
  return (
    <span className="macro-chips">
      <span>
        <span className="dot" style={{ background: 'var(--protein)' }} />
        <b>{grams(m.protein)}</b>P
      </span>
      <span>
        <span className="dot" style={{ background: 'var(--fat)' }} />
        <b>{grams(m.fat)}</b>F
      </span>
      <span>
        <span className="dot" style={{ background: 'var(--carbs)' }} />
        <b>{grams(m.carbs)}</b>C
      </span>
    </span>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="group">
      {options.map((o) => (
        <button key={o.value} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
