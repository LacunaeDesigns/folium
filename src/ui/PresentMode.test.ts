import { describe, it, expect } from 'vitest'
import { frameCard, movedPastThreshold } from './PresentMode'

describe('frameCard', () => {
  it('frames a card with an explicit height, capping zoom at 1.6', () => {
    const view = frameCard({ x: 100, y: 50, w: 200, h: 150 }, 1000, 800)
    expect(view.zoom).toBeCloseTo(1.6)
    expect(view.pan.x).toBeCloseTo(180)
    expect(view.pan.y).toBeCloseTo(200)
  })

  it('derives height from width when h is omitted, and fits without capping', () => {
    const view = frameCard({ x: 0, y: 0, w: 1000 }, 2000, 2000)
    expect(view.zoom).toBeCloseTo(1.4)
    expect(view.pan.x).toBeCloseTo(300)
    expect(view.pan.y).toBeCloseTo(650)
  })
})

describe('movedPastThreshold', () => {
  it('returns false when movement is within the threshold', () => {
    expect(movedPastThreshold(3, 4, 5)).toBe(false)
  })
  it('returns true when movement exceeds the threshold', () => {
    expect(movedPastThreshold(3, 4, 4.9)).toBe(true)
  })
  it('returns false for no movement', () => {
    expect(movedPastThreshold(0, 0, 4)).toBe(false)
  })
})
