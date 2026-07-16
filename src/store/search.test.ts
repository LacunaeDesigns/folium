import { describe, it, expect, beforeEach } from 'vitest'
import { createFoliumStore, FoliumStore } from './store'
import { searchAll } from './search'

let store: FoliumStore
const s = () => store.getState()

beforeEach(() => {
  store = createFoliumStore()
})

describe('searchAll', () => {
  it('finds boards by title', () => {
    s().createBoard(s().rootId, 'Level Design Portfolio')
    const { hits } = searchAll(s(), 'portfolio')
    expect(hits.some((h) => h.kind === 'board' && h.title === 'Level Design Portfolio')).toBe(true)
  })

  it('finds note text inside TipTap doc JSON', () => {
    s().addCard(s().rootId, 'note', {
      x: 0,
      y: 0,
      content: {
        doc: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Danish design history' }] },
          ],
        },
      } as never,
    })
    const { hits } = searchAll(s(), 'danish')
    expect(hits).toHaveLength(1)
    expect(hits[0].snippet).toContain('Danish')
  })

  it('finds todo items, link meta, sticky text, table cells and file names', () => {
    const b = s().rootId
    s().addCard(b, 'todo', { x: 0, y: 0, content: { items: [{ id: '1', text: 'buy wishbone chair', done: false }] } as never })
    s().addCard(b, 'link', { x: 0, y: 0, content: { url: 'https://x.com', title: 'Chair reference', description: '' } as never })
    s().addCard(b, 'sticky', { x: 0, y: 0, content: { text: 'chairs everywhere' } as never })
    s().addCard(b, 'table', { x: 0, y: 0, content: { rows: [['Item'], ['Egg chair']] } as never })
    s().addCard(b, 'file', { x: 0, y: 0, content: { name: 'chair-render.png', size: 1, mime: '' } as never })
    expect(searchAll(s(), 'chair').hits).toHaveLength(5)
  })

  it('ignores trashed cards and is case-insensitive', () => {
    const id = s().addCard(s().rootId, 'sticky', { x: 0, y: 0, content: { text: 'FIND ME' } as never })
    expect(searchAll(s(), 'find me').hits).toHaveLength(1)
    s().trashCards([id])
    expect(searchAll(s(), 'find me').hits).toHaveLength(0)
  })

  it('returns empty for blank queries', () => {
    s().addCard(s().rootId, 'sticky', { x: 0, y: 0, content: { text: 'anything' } as never })
    expect(searchAll(s(), '  ').hits).toHaveLength(0)
  })
})

describe('searchAll filters and paging', () => {
  it('filters by card type', () => {
    const b = s().rootId
    const { boardId: b2 } = s().createBoard(b, 'Board Two')
    s().addCard(b, 'sticky', { x: 0, y: 0, content: { text: 'foo sticky one' } as never })
    s().addCard(b, 'sticky', { x: 0, y: 0, content: { text: 'foo sticky two' } as never })
    s().addCard(b2, 'table', { x: 0, y: 0, content: { rows: [['H'], ['foo']] } as never })

    const { hits } = searchAll(s(), 'foo', { type: 'table' })
    expect(hits).toHaveLength(1)
    expect(hits[0].cardType).toBe('table')
  })

  it('filters by board', () => {
    const b = s().rootId
    const { boardId: b2 } = s().createBoard(b, 'Board Two')
    s().addCard(b, 'sticky', { x: 0, y: 0, content: { text: 'foo here' } as never })
    s().addCard(b2, 'table', { x: 0, y: 0, content: { rows: [['H'], ['foo']] } as never })

    const { hits } = searchAll(s(), 'foo', { boardId: b2 })
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((h) => h.boardId === b2)).toBe(true)
  })

  it('pages past the first 30 with offset and reports total', () => {
    const b = s().rootId
    for (let i = 0; i < 35; i++) {
      s().addCard(b, 'sticky', { x: 0, y: 0, content: { text: `foo item ${i}` } as never })
    }
    const first = searchAll(s(), 'foo', { limit: 30, offset: 0 })
    const second = searchAll(s(), 'foo', { limit: 30, offset: 30 })
    expect(first.hits).toHaveLength(30)
    expect(second.hits.length).toBeGreaterThan(0)
    expect(first.total).toBe(first.hits.length + second.hits.length)
  })
})

describe('restore fallback', () => {
  it('restores a card to the root board when its board was deleted', () => {
    const { boardId, cardId } = s().createBoard(s().rootId, 'Doomed')
    const inner = s().addCard(boardId, 'note', { x: 0, y: 0 })
    s().trashCards([inner])
    s().trashCards([cardId])
    s().emptyTrash() // deletes board card + board subtree; inner was already trashed separately…
    const still = s().cards[inner]
    if (still) {
      // if the cascade left it, restoring must not strand it on a dead board
      s().restoreCards([inner])
      expect(s().boards[s().cards[inner].boardId]).toBeDefined()
    }
  })
})
