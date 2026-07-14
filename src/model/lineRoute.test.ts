import { describe, it, expect } from 'vitest'
import { curveFromMidpoint, elbowPath } from './lineRoute'

describe('elbowPath', () => {
  it('routes H-V-H through the x midpoint when both ends are horizontal', () => {
    const { d, midX, midY } = elbowPath(0, 0, 100, 50, true, true)
    expect(d).toBe('M 0 0 L 50 0 L 50 50 L 100 50')
    expect(midX).toBe(50)
    expect(midY).toBe(25)
  })

  it('routes V-H-V through the y midpoint when both ends are vertical', () => {
    const { d, midX, midY } = elbowPath(0, 0, 100, 50, false, false)
    expect(d).toBe('M 0 0 L 0 25 L 100 25 L 100 50')
    expect(midX).toBe(50)
    expect(midY).toBe(25)
  })

  it('routes a single corner when ends are mixed (a horizontal, b vertical)', () => {
    const { d, midX, midY } = elbowPath(0, 0, 100, 50, true, false)
    // corner at (bx, ay)
    expect(d).toBe('M 0 0 L 100 0 L 100 50')
    expect(midX).toBe(100)
    expect(midY).toBe(0)
  })

  it('routes a single corner when ends are mixed (a vertical, b horizontal)', () => {
    const { d, midX, midY } = elbowPath(0, 0, 100, 50, false, true)
    // corner at (ax, by)
    expect(d).toBe('M 0 0 L 0 50 L 100 50')
    expect(midX).toBe(0)
    expect(midY).toBe(50)
  })
})

describe('curveFromMidpoint', () => {
  it('returns 0 (straight) when the pointer sits on the a/b midpoint', () => {
    const curve = curveFromMidpoint(0, 0, 100, 0, 50, 0, 0.5)
    expect(curve).toBe(0)
  })

  it('solves a positive curve for a pointer bowed to one side', () => {
    // a=(0,0) b=(100,0): perpendicular is +y direction scaled by curve
    const curve = curveFromMidpoint(0, 0, 100, 0, 50, 10, 0)
    expect(curve).toBeCloseTo(0.2, 5)
  })

  it('clamps to the [-1.5, 1.5] range', () => {
    const curve = curveFromMidpoint(0, 0, 100, 0, 50, 1000, 0)
    expect(curve).toBe(1.5)
    const curveNeg = curveFromMidpoint(0, 0, 100, 0, 50, -1000, 0)
    expect(curveNeg).toBe(-1.5)
  })

  it('bails and returns the current curve when a and b are coincident', () => {
    expect(curveFromMidpoint(10, 10, 10, 10, 50, 50, 0.3)).toBe(0.3)
  })
})
