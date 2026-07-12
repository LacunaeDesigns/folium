import { describe, it, expect, beforeEach } from 'vitest'
import { createAtlasStore, AtlasStore } from './store'
import { boardCards, columnCards, breadcrumbs, boardCardCount, trashedCards } from './selectors'
import { NoteContent, StickyContent, TodoContent } from '../model/types'

let store: AtlasStore
const s = () => store.getState()

beforeEach(() => {
  store = createAtlasStore()
})

describe('initial document', () => {
  it('has a root Home board', () => {
    const root = s().boards[s().rootId]
    expect(root).toBeDefined()
    expect(root.title).toBe('Home')
    expect(root.parentId).toBeNull()
  })
})

describe('cards', () => {
  it('addCard creates a card of the given type at a position', () => {
    const id = s().addCard(s().rootId, 'note', { x: 100, y: 60 })
    const card = s().cards[id]
    expect(card.type).toBe('note')
    expect(card.x).toBe(100)
    expect(card.y).toBe(60)
    expect(card.boardId).toBe(s().rootId)
    expect(card.trashed).toBe(false)
    expect((card.content as NoteContent).kind).toBe('note')
  })

  it('updateContent patches content without clobbering other fields', () => {
    const id = s().addCard(s().rootId, 'sticky', { x: 0, y: 0 })
    s().updateContent(id, { text: 'hello' })
    const c = s().cards[id].content as StickyContent
    expect(c.text).toBe('hello')
    expect(c.color).toBeTruthy()
  })

  it('moveCards shifts multiple cards by a delta', () => {
    const a = s().addCard(s().rootId, 'note', { x: 10, y: 10 })
    const b = s().addCard(s().rootId, 'note', { x: 50, y: 50 })
    s().moveCards([a, b], 5, -3)
    expect(s().cards[a].x).toBe(15)
    expect(s().cards[a].y).toBe(7)
    expect(s().cards[b].x).toBe(55)
    expect(s().cards[b].y).toBe(47)
  })

  it('resizeCard sets width and optional height', () => {
    const id = s().addCard(s().rootId, 'image', { x: 0, y: 0 })
    s().resizeCard(id, 320, 200)
    expect(s().cards[id].w).toBe(320)
    expect(s().cards[id].h).toBe(200)
  })

  it('bringToFront raises z above all other cards on the board', () => {
    const a = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    const b = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    s().bringToFront(a)
    expect(s().cards[a].z).toBeGreaterThan(s().cards[b].z)
  })
})

describe('trash', () => {
  it('trashCards hides cards from the board and shows them in trash', () => {
    const id = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    s().trashCards([id])
    expect(s().cards[id].trashed).toBe(true)
    expect(boardCards(s(), s().rootId).map((c) => c.id)).not.toContain(id)
    expect(trashedCards(s()).map((c) => c.id)).toContain(id)
  })

  it('restoreCards puts a trashed card back at its old spot', () => {
    const id = s().addCard(s().rootId, 'note', { x: 42, y: 24 })
    s().trashCards([id])
    s().restoreCards([id])
    const c = s().cards[id]
    expect(c.trashed).toBe(false)
    expect(c.x).toBe(42)
    expect(boardCards(s(), s().rootId).map((k) => k.id)).toContain(id)
  })

  it('emptyTrash permanently deletes trashed cards', () => {
    const id = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    s().trashCards([id])
    s().emptyTrash()
    expect(s().cards[id]).toBeUndefined()
  })

  it('trashing a card removes lines attached to it', () => {
    const a = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    const b = s().addCard(s().rootId, 'note', { x: 200, y: 0 })
    const lineId = s().addLine(s().rootId, { cardId: a }, { cardId: b })
    s().trashCards([a])
    expect(s().lines[lineId]).toBeUndefined()
  })

  it('emptying trash with a board card deletes the child board subtree', () => {
    const { boardId, cardId } = s().createBoard(s().rootId, 'Project')
    const inner = s().addCard(boardId, 'note', { x: 0, y: 0 })
    s().trashCards([cardId])
    s().emptyTrash()
    expect(s().boards[boardId]).toBeUndefined()
    expect(s().cards[inner]).toBeUndefined()
  })
})

describe('duplicate', () => {
  it('duplicates cards with fresh ids, offset position and deep content copy', () => {
    const id = s().addCard(s().rootId, 'todo', { x: 10, y: 10 })
    s().updateContent(id, { items: [{ id: 't1', text: 'a', done: false }] })
    const [dup] = s().duplicateCards([id])
    expect(dup).not.toBe(id)
    const orig = s().cards[id].content as TodoContent
    const copy = s().cards[dup].content as TodoContent
    expect(copy.items).toHaveLength(1)
    expect(copy.items).not.toBe(orig.items)
    expect(s().cards[dup].x).toBeGreaterThan(s().cards[id].x)
  })

  it('duplicating a board card clones the whole child board subtree', () => {
    const { boardId, cardId } = s().createBoard(s().rootId, 'World')
    s().addCard(boardId, 'note', { x: 0, y: 0 })
    const [dupCardId] = s().duplicateCards([cardId])
    const dupContent = s().cards[dupCardId].content
    if (dupContent.kind !== 'board') throw new Error('expected board card')
    expect(dupContent.boardId).not.toBe(boardId)
    const clonedBoard = s().boards[dupContent.boardId]
    expect(clonedBoard).toBeDefined()
    expect(boardCards(s(), dupContent.boardId)).toHaveLength(1)
  })
})

describe('nested boards', () => {
  it('createBoard makes a child board plus a board card on the parent', () => {
    const { boardId, cardId } = s().createBoard(s().rootId, 'Work')
    expect(s().boards[boardId].parentId).toBe(s().rootId)
    const card = s().cards[cardId]
    expect(card.type).toBe('board')
    expect(card.boardId).toBe(s().rootId)
  })

  it('breadcrumbs walk from root to the given board', () => {
    const { boardId: work } = s().createBoard(s().rootId, 'Work')
    const { boardId: mood } = s().createBoard(work, 'Moodboard')
    const trail = breadcrumbs(s(), mood)
    expect(trail.map((b) => b.title)).toEqual(['Home', 'Work', 'Moodboard'])
  })

  it('boardCardCount counts live cards on a board', () => {
    const { boardId } = s().createBoard(s().rootId, 'Work')
    s().addCard(boardId, 'note', { x: 0, y: 0 })
    const trashme = s().addCard(boardId, 'note', { x: 0, y: 0 })
    s().trashCards([trashme])
    expect(boardCardCount(s(), boardId)).toBe(1)
  })
})

describe('columns', () => {
  it('setCardColumn moves a card into a column at an index and keeps order', () => {
    const col = s().addCard(s().rootId, 'column', { x: 0, y: 0 })
    const a = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    const b = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    s().setCardColumn(a, col, 0)
    s().setCardColumn(b, col, 0)
    expect(columnCards(s(), col).map((c) => c.id)).toEqual([b, a])
    expect(boardCards(s(), s().rootId).map((c) => c.id)).not.toContain(a)
  })

  it('setCardColumn(null) pops the card back onto the canvas', () => {
    const col = s().addCard(s().rootId, 'column', { x: 0, y: 0 })
    const a = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    s().setCardColumn(a, col, 0)
    s().setCardColumn(a, null, 0, { x: 300, y: 300 })
    expect(s().cards[a].colId).toBeNull()
    expect(s().cards[a].x).toBe(300)
    expect(boardCards(s(), s().rootId).map((c) => c.id)).toContain(a)
  })
})

describe('lines', () => {
  it('addLine connects two cards and updateLine patches it', () => {
    const a = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    const b = s().addCard(s().rootId, 'note', { x: 200, y: 0 })
    const id = s().addLine(s().rootId, { cardId: a }, { cardId: b })
    expect(s().lines[id].boardId).toBe(s().rootId)
    s().updateLine(id, { label: 'depends on', arrowEnd: true })
    expect(s().lines[id].label).toBe('depends on')
    s().deleteLine(id)
    expect(s().lines[id]).toBeUndefined()
  })
})

describe('undo/redo', () => {
  it('undo removes an added card, redo brings it back', () => {
    const id = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    store.temporal.getState().undo()
    expect(s().cards[id]).toBeUndefined()
    store.temporal.getState().redo()
    expect(s().cards[id]).toBeDefined()
  })

  it('undo restores card position after a move', () => {
    const id = s().addCard(s().rootId, 'note', { x: 10, y: 10 })
    s().moveCards([id], 100, 100)
    store.temporal.getState().undo()
    expect(s().cards[id].x).toBe(10)
  })
})
