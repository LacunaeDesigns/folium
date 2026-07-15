import { describe, it, expect } from 'vitest'
import { cardZIndex } from './CardShell'
import { Card } from '../model/types'

function makeCard(patch: Partial<Card> = {}): Card {
  return {
    id: 'c1',
    boardId: 'b1',
    type: 'sticky',
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    z: 5,
    colId: null,
    colIndex: 0,
    frameId: null,
    inUnsorted: false,
    trashed: false,
    createdAt: 0,
    content: { kind: 'sticky', text: '', color: 'yellow' },
    ...patch,
  } as Card
}

describe('cardZIndex', () => {
  it('returns the card\'s own z when not selected', () => {
    expect(cardZIndex(makeCard({ z: 5 }), false)).toBe(5)
  })

  it('boosts a selected card above the normal card z-index range', () => {
    const unselectedHigherZ = cardZIndex(makeCard({ z: 500 }), false)
    const selectedLowerZ = cardZIndex(makeCard({ z: 5 }), true)
    expect(selectedLowerZ).toBeGreaterThan(unselectedHigherZ)
  })

  it('stays below the snap-guide/lines-layer overlay z-index (9999/10000) even when selected', () => {
    expect(cardZIndex(makeCard({ z: 5 }), true)).toBeLessThan(9999)
  })

  it('keeps frames behind regular cards regardless of selection', () => {
    const frame = makeCard({ type: 'frame', z: 500 })
    expect(cardZIndex(frame, false)).toBeLessThan(cardZIndex(makeCard({ z: 1 }), false))
    expect(cardZIndex(frame, true)).toBeLessThan(cardZIndex(makeCard({ z: 1 }), false))
  })
})
