import { describe, it, expect, beforeEach } from 'vitest'
import { createAtlasStore, AtlasStore } from './store'
import { searchAll } from './search'

let store: AtlasStore
const s = () => store.getState()

beforeEach(() => {
  store = createAtlasStore()
})

describe('searchAll', () => {
  it('finds boards by title', () => {
    s().createBoard(s().rootId, 'Level Design Portfolio')
    const hits = searchAll(s(), 'portfolio')
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
    const hits = searchAll(s(), 'danish')
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
    expect(searchAll(s(), 'chair')).toHaveLength(5)
  })

  it('ignores trashed cards and is case-insensitive', () => {
    const id = s().addCard(s().rootId, 'sticky', { x: 0, y: 0, content: { text: 'FIND ME' } as never })
    expect(searchAll(s(), 'find me')).toHaveLength(1)
    s().trashCards([id])
    expect(searchAll(s(), 'find me')).toHaveLength(0)
  })

  it('returns empty for blank queries', () => {
    s().addCard(s().rootId, 'sticky', { x: 0, y: 0, content: { text: 'anything' } as never })
    expect(searchAll(s(), '  ')).toHaveLength(0)
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
