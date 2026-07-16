import { describe, it, expect } from 'vitest'
import { insertRowAt, removeRowAt, moveRow, insertColAt, removeColAt, moveCol, applyTsvPaste, nextCellPos } from './gridOps'

const g = () => [
  ['H1', 'H2'],
  ['a', 'b'],
  ['c', 'd'],
]

describe('row ops', () => {
  it('insertRowAt inserts an empty row after the given index', () => {
    expect(insertRowAt(g(), 1)).toEqual([['H1', 'H2'], ['a', 'b'], ['', ''], ['c', 'd']])
  })
  it('removeRowAt refuses the header row', () => {
    expect(removeRowAt(g(), 0)).toEqual(g())
  })
  it('moveRow swaps adjacent body rows and never crosses the header', () => {
    expect(moveRow(g(), 2, 1)).toEqual([['H1', 'H2'], ['c', 'd'], ['a', 'b']])
    expect(moveRow(g(), 1, 0)).toEqual(g())
  })
})

describe('col ops', () => {
  it('insertColAt inserts an empty column after the given index', () => {
    expect(insertColAt(g(), 0)).toEqual([['H1', '', 'H2'], ['a', '', 'b'], ['c', '', 'd']])
  })
  it('removeColAt / moveCol respect a minCol floor (chart label column)', () => {
    expect(removeColAt(g(), 0, 1)).toEqual(g())          // col 0 protected when minCol=1
    expect(moveCol(g(), 1, 0, 1)).toEqual(g())           // can't move into protected slot
  })
})

describe('applyTsvPaste', () => {
  it('expands TSV from the anchor cell, growing the grid', () => {
    expect(applyTsvPaste(g(), 2, 1, 'x\ty\nz\tw')).toEqual([
      ['H1', 'H2', ''],
      ['a', 'b', ''],
      ['c', 'x', 'y'],
      ['', 'z', 'w'],
    ])
  })
})

describe('nextCellPos', () => {
  it('Tab wraps to the next row, Enter moves down, nothing past the last cell', () => {
    expect(nextCellPos(1, 1, 3, 2, 'Tab')).toEqual({ r: 2, c: 0 })
    expect(nextCellPos(1, 0, 3, 2, 'Enter')).toEqual({ r: 2, c: 0 })
    expect(nextCellPos(2, 1, 3, 2, 'Tab')).toBeNull()
  })
})
