import { describe, it, expect } from 'vitest'
import { frameCard } from './PresentMode'

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
