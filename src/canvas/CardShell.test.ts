import { describe, it, expect } from 'vitest'
import { cardZIndex, columnContainsSelection, blurActiveFormField, isCardDragging, gridSnapDelta, gridSnapResize } from './CardShell'
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

describe('columnContainsSelection', () => {
  it('is true when a member card id is in the selection', () => {
    const members = [makeCard({ id: 'm1' }), makeCard({ id: 'm2' })]
    expect(columnContainsSelection(members, ['m2'])).toBe(true)
  })

  it('is false when no member id is in the selection', () => {
    const members = [makeCard({ id: 'm1' }), makeCard({ id: 'm2' })]
    expect(columnContainsSelection(members, ['other'])).toBe(false)
  })

  it('is false for an empty member list', () => {
    expect(columnContainsSelection([], ['m1'])).toBe(false)
  })
})

describe('isCardDragging', () => {
  it('is false when there is no drag in progress', () => {
    expect(isCardDragging(null, makeCard())).toBe(false)
  })

  it('is true when the card is part of the drag and unlocked', () => {
    const drag = { ids: ['c1', 'c2'], dx: 5, dy: 5 }
    expect(isCardDragging(drag, makeCard({ id: 'c1' }))).toBe(true)
  })

  it('is false for a locked card even when swept along in a multi-selection drag', () => {
    const drag = { ids: ['c1', 'c2'], dx: 5, dy: 5 }
    expect(isCardDragging(drag, makeCard({ id: 'c1', locked: true }))).toBe(false)
  })

  it('is false for a card not included in the drag', () => {
    const drag = { ids: ['c2'], dx: 5, dy: 5 }
    expect(isCardDragging(drag, makeCard({ id: 'c1' }))).toBe(false)
  })
})

describe('blurActiveFormField', () => {
  it('blurs a focused input', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    expect(document.activeElement).toBe(input)

    blurActiveFormField()

    expect(document.activeElement).not.toBe(input)
    input.remove()
  })

  it('blurs a focused textarea', () => {
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()
    expect(document.activeElement).toBe(textarea)

    blurActiveFormField()

    expect(document.activeElement).not.toBe(textarea)
    textarea.remove()
  })

  it('does nothing when nothing is focused', () => {
    document.body.focus()
    expect(() => blurActiveFormField()).not.toThrow()
  })
})

describe('gridSnapDelta', () => {
  it('snaps the projected origin to the nearest grid line', () => {
    // origin+dx: 10+9=19 -> nearest multiple of 24 is 24 (dx: 24-10=14)
    // origin+dy: 10+3=13 -> nearest multiple of 24 is 24 (dy: 24-10=14)
    expect(gridSnapDelta(10, 10, 9, 3, 24)).toEqual({ dx: 14, dy: 14 })
  })

  it('is identity when already on the grid', () => {
    expect(gridSnapDelta(24, 48, 24, -24, 24)).toEqual({ dx: 24, dy: -24 })
  })
})

describe('gridSnapResize', () => {
  const start = { x: 100, y: 100, w: 200, h: 150 }

  it('top-left handle (rc-tl): snaps the dragged corner but keeps the opposite (bottom-right) corner fixed', () => {
    // unsnapped preview from dragging rc-tl by (dx=5, dy=5): anchor is
    // start.x+start.w=300, start.y+start.h=250
    const preview = { x: 105, y: 105, w: 195, h: 145 }
    const result = gridSnapResize(preview, start, -1, -1, 24)
    expect(result).toEqual({ x: 96, y: 96, w: 204, h: 154 })
    expect(result.x + result.w).toBe(start.x + start.w)
    expect(result.y! + result.h!).toBe(start.y + start.h)
  })

  it('top-right handle (rc-tr): x stays anchored, y snaps and the bottom-left corner stays fixed', () => {
    const preview = { x: 100, y: 105, w: 205, h: 145 }
    const result = gridSnapResize(preview, start, 1, -1, 24)
    expect(result.x).toBe(100)
    expect(result.y).toBe(96)
    expect(result.y! + result.h!).toBe(start.y + start.h)
  })

  it('bottom-left handle (rc-bl): y stays anchored, x snaps and the top-right corner stays fixed', () => {
    const preview = { x: 105, y: 100, w: 195, h: 155 }
    const result = gridSnapResize(preview, start, -1, 1, 24)
    expect(result.y).toBe(100)
    expect(result.x).toBe(96)
    expect(result.x + result.w).toBe(start.x + start.w)
  })

  it('bottom-right handle (rc-br): both origin coordinates stay anchored (unaffected by the fix)', () => {
    const preview = { x: 100, y: 100, w: 205, h: 155 }
    const result = gridSnapResize(preview, start, 1, 1, 24)
    expect(result).toEqual({ x: 100, y: 100, w: 216, h: 144 })
  })

  it('leaves h undefined for auto-height cards', () => {
    const autoStart = { x: 100, y: 100, w: 200 }
    const preview = { x: 105, y: 100, w: 195 }
    const result = gridSnapResize(preview, autoStart, -1, -1, 24)
    expect(result.h).toBeUndefined()
  })
})
