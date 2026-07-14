import { describe, it, expect } from 'vitest'
import { hasMeaningfulPressure, strokeOutlinePath } from './inkOutline'

describe('hasMeaningfulPressure', () => {
  it('is false for a constant 0.5 (mouse default)', () => {
    expect(hasMeaningfulPressure([0.5, 0.5, 0.5])).toBe(false)
  })
  it('is false for a constant 0 (no-sensor fallback)', () => {
    expect(hasMeaningfulPressure([0, 0, 0])).toBe(false)
  })
  it('is false for an empty array', () => {
    expect(hasMeaningfulPressure([])).toBe(false)
  })
  it('is true when at least one value differs from 0/0.5', () => {
    expect(hasMeaningfulPressure([0.5, 0.5, 0.8])).toBe(true)
  })
})

describe('strokeOutlinePath', () => {
  it('returns "" for fewer than 2 points (degenerate input)', () => {
    expect(strokeOutlinePath([0, 0], [0.5], 4)).toBe('')
    expect(strokeOutlinePath([], [], 4)).toBe('')
  })

  it('produces a closed polygon path for a simple straight stroke', () => {
    const points = [0, 0, 10, 0, 20, 0]
    const pressures = [0.2, 0.5, 1]
    const d = strokeOutlinePath(points, pressures, 4)
    expect(d.startsWith('M ')).toBe(true)
    expect(d.endsWith(' Z')).toBe(true)
    // one M + 5 L commands (3 left points + 3 right points, minus the initial M)
    expect(d.match(/L /g)?.length).toBe(5)
  })

  it('does not throw when all points are identical (zero-length stroke)', () => {
    const d = strokeOutlinePath([5, 5, 5, 5, 5, 5], [0.3, 0.6, 0.9], 6)
    expect(() => d).not.toThrow()
    expect(d.startsWith('M ')).toBe(true)
  })

  it('widens the outline with higher pressure', () => {
    const points = [0, 0, 10, 0]
    const lowD = strokeOutlinePath(points, [0, 0], 10)
    const highD = strokeOutlinePath(points, [1, 1], 10)
    // first left point's y-offset reflects the half-width for that pressure
    const yOf = (d: string) => parseFloat(d.split(' ')[2])
    expect(Math.abs(yOf(highD))).toBeGreaterThan(Math.abs(yOf(lowD)))
  })
})
