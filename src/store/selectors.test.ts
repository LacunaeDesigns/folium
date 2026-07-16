import { describe, it, expect } from 'vitest'
import { allBoardStats } from './selectors'
import { DocState } from '../model/types'

function doc(cards: DocState['cards']): DocState {
  return { rootId: 'r', boards: {}, cards, lines: {} }
}

describe('allBoardStats', () => {
  it('counts live cards per board in one pass, excluding trashed', () => {
    const s = doc({
      a: { id: 'a', boardId: 'b1', type: 'note', x: 0, y: 0, w: 1, z: 0, colId: null, colIndex: 0, frameId: null, inUnsorted: false, trashed: false, createdAt: 0, content: { kind: 'note', doc: null, bg: 'white' } },
      b: { id: 'b', boardId: 'b1', type: 'note', x: 0, y: 0, w: 1, z: 0, colId: null, colIndex: 0, frameId: null, inUnsorted: false, trashed: true, createdAt: 0, content: { kind: 'note', doc: null, bg: 'white' } },
      c: { id: 'c', boardId: 'b2', type: 'note', x: 0, y: 0, w: 1, z: 0, colId: null, colIndex: 0, frameId: null, inUnsorted: false, trashed: false, createdAt: 0, content: { kind: 'note', doc: null, bg: 'white' } },
    })
    const stats = allBoardStats(s)
    expect(stats['b1'].cardCount).toBe(1)
    expect(stats['b2'].cardCount).toBe(1)
    expect(stats['b3']).toBeUndefined()
  })

  it('aggregates todo done/total per board', () => {
    const s = doc({
      t1: {
        id: 't1', boardId: 'b1', type: 'todo', x: 0, y: 0, w: 1, z: 0, colId: null, colIndex: 0,
        frameId: null, inUnsorted: false, trashed: false, createdAt: 0,
        content: { kind: 'todo', title: '', items: [{ id: '1', text: '', done: true }, { id: '2', text: '', done: false }] },
      },
      t2: {
        id: 't2', boardId: 'b1', type: 'todo', x: 0, y: 0, w: 1, z: 0, colId: null, colIndex: 0,
        frameId: null, inUnsorted: false, trashed: false, createdAt: 0,
        content: { kind: 'todo', title: '', items: [{ id: '3', text: '', done: true }] },
      },
    })
    const stats = allBoardStats(s)
    expect(stats['b1']).toEqual({ cardCount: 2, todoDone: 2, todoTotal: 3 })
  })

  it('returns an empty object for a doc with no cards', () => {
    expect(allBoardStats(doc({}))).toEqual({})
  })
})
