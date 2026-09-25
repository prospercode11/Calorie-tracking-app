import type { UnitSystem } from './types'

export const LB_PER_KG = 2.20462

export function kcal(n: number): string {
  return Math.round(n).toLocaleString()
}

export function grams(n: number): string {
  return `${Math.round(n)}`
}

export function weightUnit(units: UnitSystem): string {
  return units === 'imperial' ? 'lb' : 'kg'
}

export function toDisplayWeight(kg: number, units: UnitSystem): number {
  return units === 'imperial' ? kg * LB_PER_KG : kg
}

export function fromDisplayWeight(v: number, units: UnitSystem): number {
  return units === 'imperial' ? v / LB_PER_KG : v
}

export function weight(kg: number, units: UnitSystem, digits = 1): string {
  return toDisplayWeight(kg, units).toFixed(digits)
}

export function signed(n: number, digits = 1): string {
  const v = n.toFixed(digits)
  return n > 0 ? `+${v}` : v
}
