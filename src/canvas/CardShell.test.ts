import { describe, it, expect } from 'vitest'
import { cardZIndex, columnContainsSelection, blurActiveFormField, isCardDragging } from './CardShell'
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
