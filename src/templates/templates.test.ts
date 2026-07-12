import { describe, it, expect } from 'vitest'
import { createAtlasStore } from '../store/store'
import { BUILTIN_TEMPLATES } from './builtins'
import { boardCards, breadcrumbs } from '../store/selectors'

describe('built-in templates', () => {
  it('ships the required template set', () => {
    const names = BUILTIN_TEMPLATES.map((t) => t.name)
    for (const required of [
      'Storyboard',
      'World Building',
      'Game Development',
      'Portfolio Review',
      'Moodboard',
      'Project Plan',
      'Brainstorm',
    ]) {
      expect(names).toContain(required)
    }
  })

  it('every template snapshot has a root board and at least 5 cards', () => {
    for (const t of BUILTIN_TEMPLATES) {
      expect(t.snapshot.boards.some((b) => b.id === t.snapshot.rootBoardId)).toBe(true)
      expect(t.snapshot.cards.length).toBeGreaterThanOrEqual(5)
    }
  })

  it('instantiating grafts a fresh subtree under the parent board', () => {
    const store = createAtlasStore()
    const s = store.getState()
    const t = BUILTIN_TEMPLATES.find((x) => x.name === 'Portfolio Review')!
    const newBoardId = s.graftSnapshot(t.snapshot, s.rootId, { x: 100, y: 100 })

    const state = store.getState()
    expect(state.boards[newBoardId]).toBeDefined()
    expect(state.boards[newBoardId].parentId).toBe(state.rootId)
    // board card exists on the parent
    const parentCards = boardCards(state, state.rootId)
    expect(parentCards.some((c) => c.content.kind === 'board' && c.content.boardId === newBoardId)).toBe(true)
    // cards landed on the new board
    expect(Object.values(state.cards).filter((c) => c.boardId === newBoardId).length).toBeGreaterThan(0)
    expect(breadcrumbs(state, newBoardId)).toHaveLength(2)
  })

  it('instantiating twice produces disjoint ids', () => {
    const store = createAtlasStore()
    const s = store.getState()
    const t = BUILTIN_TEMPLATES.find((x) => x.name === 'Brainstorm')!
    const b1 = s.graftSnapshot(t.snapshot, s.rootId, { x: 0, y: 0 })
    const b2 = store.getState().graftSnapshot(t.snapshot, s.rootId, { x: 50, y: 50 })
    expect(b1).not.toBe(b2)
    const state = store.getState()
    const cards1 = Object.values(state.cards).filter((c) => c.boardId === b1)
    const cards2 = Object.values(state.cards).filter((c) => c.boardId === b2)
    expect(cards1.length).toBe(cards2.length)
    expect(cards1.length).toBeGreaterThan(0)
    // and the template snapshot itself was not mutated
    expect(t.snapshot.boards[0].parentId).toBeNull()
  })

  it('nested boards inside templates are re-created with correct parents', () => {
    const store = createAtlasStore()
    const s = store.getState()
    const t = BUILTIN_TEMPLATES.find((x) => x.name === 'World Building')!
    const rootBoard = s.graftSnapshot(t.snapshot, s.rootId, { x: 0, y: 0 })
    const state = store.getState()
    const nested = Object.values(state.boards).filter((b) => b.parentId === rootBoard)
    expect(nested.length).toBeGreaterThanOrEqual(3)
  })
})
