import { describe, it, expect, beforeEach } from 'vitest'
import { createFoliumStore, FoliumStore, collectClip } from './store'
import { zOrderedIds, zBatchPatches } from '../canvas/useShortcuts'
import { boardCards, columnCards, breadcrumbs, boardCardCount, trashedCards, boardTodoStats } from './selectors'
import { HeadingContent, NoteContent, StickyContent, TodoContent } from '../model/types'

let store: FoliumStore
const s = () => store.getState()

beforeEach(() => {
  store = createFoliumStore()
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

  it('a multi-select bring-to-front (Ctrl+]/Arrange menu) batches into one undo step', () => {
    const a = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    const b = s().addCard(s().rootId, 'note', { x: 100, y: 0 })
    const c = s().addCard(s().rootId, 'note', { x: 200, y: 0 })
    store.temporal.getState().clear()
    const ids = zOrderedIds([a, b], (id) => s().cards[id].z, 'front')
    s().updateCards(zBatchPatches(ids, s().cards, 'front'))
    expect(s().cards[a].z).toBeGreaterThan(s().cards[c].z)
    expect(s().cards[b].z).toBeGreaterThan(s().cards[a].z)
    expect(store.temporal.getState().pastStates.length).toBe(1)
  })

  it('a multi-select send-to-back (Ctrl+[/Arrange menu) batches into one undo step', () => {
    const a = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    const b = s().addCard(s().rootId, 'note', { x: 100, y: 0 })
    const c = s().addCard(s().rootId, 'note', { x: 200, y: 0 })
    store.temporal.getState().clear()
    const ids = zOrderedIds([b, c], (id) => s().cards[id].z, 'back')
    s().updateCards(zBatchPatches(ids, s().cards, 'back'))
    // both land below the untouched card a, with b/c's original relative
    // order (b was behind c) preserved
    expect(s().cards[c].z).toBeLessThan(s().cards[a].z)
    expect(s().cards[b].z).toBeLessThan(s().cards[c].z)
    expect(store.temporal.getState().pastStates.length).toBe(1)
  })

  it('updateCards applies all patches in one undo step', () => {
    const a = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    const b = s().addCard(s().rootId, 'note', { x: 100, y: 0 })
    store.temporal.getState().clear()
    s().updateCards([
      { id: a, patch: { x: 50 } },
      { id: b, patch: { x: 50 } },
    ])
    expect(s().cards[a].x).toBe(50)
    expect(s().cards[b].x).toBe(50)
    expect(store.temporal.getState().pastStates.length).toBe(1)
  })
})

describe('heading', () => {
  it('addCard defaults to level 1 with empty text', () => {
    const id = s().addCard(s().rootId, 'heading', { x: 0, y: 0 })
    const c = s().cards[id].content as HeadingContent
    expect(c.kind).toBe('heading')
    expect(c.level).toBe(1)
    expect(c.text).toBe('')
  })

  it('updateContent changes text and level independently', () => {
    const id = s().addCard(s().rootId, 'heading', { x: 0, y: 0 })
    s().updateContent(id, { text: 'Chapter One' })
    s().updateContent(id, { level: 2 })
    const c = s().cards[id].content as HeadingContent
    expect(c.text).toBe('Chapter One')
    expect(c.level).toBe(2)
  })
})

describe('boardTodoStats', () => {
  it('sums done/total items across todo cards on a board', () => {
    const a = s().addCard(s().rootId, 'todo', { x: 0, y: 0 })
    s().updateContent(a, {
      items: [
        { id: 't1', text: 'a', done: true },
        { id: 't2', text: 'b', done: true },
        { id: 't3', text: 'c', done: false },
      ],
    })
    const b = s().addCard(s().rootId, 'todo', { x: 0, y: 0 })
    s().updateContent(b, { items: [{ id: 't4', text: 'd', done: true }] })
    expect(boardTodoStats(s(), s().rootId)).toEqual({ done: 3, total: 4 })
  })

  it('returns zeros when the board has no todo items', () => {
    s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    expect(boardTodoStats(s(), s().rootId)).toEqual({ done: 0, total: 0 })
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

describe('duplicate in columns', () => {
  it('duplicating a column member keeps colIndexes unique and places the copy after the original', () => {
    const col = s().addCard(s().rootId, 'column', { x: 0, y: 0 })
    const a = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    const b = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    s().setCardColumn(a, col, 0)
    s().setCardColumn(b, col, 1)
    const [dup] = s().duplicateCards([a])
    const members = columnCards(s(), col)
    expect(members.map((c) => c.id)).toEqual([a, dup, b])
    const indexes = members.map((c) => c.colIndex)
    expect(new Set(indexes).size).toBe(indexes.length)
    expect(indexes).toEqual([0, 1, 2])
  })
})

describe('clipboard copy/paste', () => {
  it('pastes a copied card onto another board with a fresh id', () => {
    const { boardId: other } = s().createBoard(s().rootId, 'Other')
    const id = s().addCard(s().rootId, 'note', { x: 10, y: 20 })
    s().updateContent(id, { doc: { hello: 'world' } })
    const clip = collectClip(s(), [id])!
    const [pasted] = s().pasteClip(clip, other, { x: 0, y: 0 })
    expect(pasted).not.toBe(id)
    expect(s().cards[pasted].boardId).toBe(other)
    expect(boardCards(s(), other).map((c) => c.id)).toContain(pasted)
    // original untouched
    expect(s().cards[id].boardId).toBe(s().rootId)
    // deep content copy
    expect((s().cards[pasted].content as NoteContent).doc).toEqual({ hello: 'world' })
  })

  it('positions the pasted group so its top-left lands at the paste point', () => {
    const a = s().addCard(s().rootId, 'note', { x: 100, y: 100 })
    const b = s().addCard(s().rootId, 'note', { x: 140, y: 160 })
    const clip = collectClip(s(), [a, b])!
    const ids = s().pasteClip(clip, s().rootId, { x: 0, y: 0 })
    const xs = ids.map((i) => s().cards[i].x)
    const ys = ids.map((i) => s().cards[i].y)
    expect(Math.min(...xs)).toBe(0)
    expect(Math.min(...ys)).toBe(0)
    // relative offset between the two cards is preserved
    expect(Math.max(...xs) - Math.min(...xs)).toBe(40)
    expect(Math.max(...ys) - Math.min(...ys)).toBe(60)
  })

  it('copying a board card clones its whole subtree on paste', () => {
    const { boardId: child, cardId } = s().createBoard(s().rootId, 'Child')
    s().addCard(child, 'note', { x: 0, y: 0 })
    const { boardId: dest } = s().createBoard(s().rootId, 'Dest')
    const clip = collectClip(s(), [cardId])!
    const [pasted] = s().pasteClip(clip, dest, { x: 0, y: 0 })
    const content = s().cards[pasted].content
    if (content.kind !== 'board') throw new Error('expected board card')
    expect(content.boardId).not.toBe(child)
    expect(s().boards[content.boardId].parentId).toBe(dest)
    expect(boardCards(s(), content.boardId)).toHaveLength(1)
  })

  it('copying a column brings its members and keeps them as members', () => {
    const col = s().addCard(s().rootId, 'column', { x: 0, y: 0 })
    const a = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    const b = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    s().setCardColumn(a, col, 0)
    s().setCardColumn(b, col, 1)
    const { boardId: dest } = s().createBoard(s().rootId, 'Dest')
    const clip = collectClip(s(), [col])!
    const [newCol] = s().pasteClip(clip, dest, { x: 0, y: 0 })
    expect(s().cards[newCol].type).toBe('column')
    const members = columnCards(s(), newCol)
    expect(members).toHaveLength(2)
    expect(members.every((m) => m.boardId === dest)).toBe(true)
  })

  it('preserves lines internal to the copied set and drops dangling ones', () => {
    const a = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    const b = s().addCard(s().rootId, 'note', { x: 200, y: 0 })
    const outside = s().addCard(s().rootId, 'note', { x: 400, y: 0 })
    s().addLine(s().rootId, { cardId: a }, { cardId: b }) // internal — kept
    s().addLine(s().rootId, { cardId: b }, { cardId: outside }) // dangling — dropped
    const before = Object.keys(s().lines).length
    const clip = collectClip(s(), [a, b])!
    s().pasteClip(clip, s().rootId, { x: 500, y: 500 })
    expect(Object.keys(s().lines).length).toBe(before + 1)
  })

  it('collectClip returns null for an empty selection', () => {
    expect(collectClip(s(), [])).toBeNull()
  })
})

describe('board meta', () => {
  it('setBoardMeta sets and clears a board background', () => {
    s().setBoardMeta(s().rootId, { background: 'sage' })
    expect(s().boards[s().rootId].background).toBe('sage')
    s().setBoardMeta(s().rootId, { background: undefined })
    expect(s().boards[s().rootId].background).toBeUndefined()
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

describe('frames', () => {
  it('a card placed inside a frame is assigned membership at creation', () => {
    const frame = s().addCard(s().rootId, 'frame', { x: 0, y: 0, w: 400, h: 300 })
    const a = s().addCard(s().rootId, 'note', { x: 50, y: 50 })
    expect(s().cards[a].frameId).toBe(frame)
  })

  it('a card placed outside any frame has no frameId', () => {
    s().addCard(s().rootId, 'frame', { x: 0, y: 0, w: 400, h: 300 })
    const a = s().addCard(s().rootId, 'note', { x: 900, y: 900 })
    expect(s().cards[a].frameId).toBeNull()
  })

  it('dragging a card into a frame assigns membership; dragging it out clears it', () => {
    const frame = s().addCard(s().rootId, 'frame', { x: 0, y: 0, w: 400, h: 300 })
    const a = s().addCard(s().rootId, 'note', { x: 900, y: 900, w: 100, h: 60 })
    expect(s().cards[a].frameId).toBeNull()
    s().moveCards([a], -800, -800) // lands at (100,100), inside the frame
    expect(s().cards[a].frameId).toBe(frame)
    s().moveCards([a], 800, 800) // back outside
    expect(s().cards[a].frameId).toBeNull()
  })

  it('moving a frame cascades the move to its members', () => {
    const frame = s().addCard(s().rootId, 'frame', { x: 0, y: 0, w: 400, h: 300 })
    const a = s().addCard(s().rootId, 'note', { x: 50, y: 50 })
    expect(s().cards[a].frameId).toBe(frame)
    s().moveCards([frame], 30, 40)
    expect(s().cards[frame].x).toBe(30)
    expect(s().cards[a].x).toBe(80)
    expect(s().cards[a].y).toBe(90)
  })

  it('moving a frame onto a stationary card assigns it membership, even though the card itself never moved', () => {
    const frame = s().addCard(s().rootId, 'frame', { x: 0, y: 0, w: 400, h: 300 })
    const a = s().addCard(s().rootId, 'note', { x: 900, y: 900, w: 100, h: 60 })
    expect(s().cards[a].frameId).toBeNull()
    s().moveCards([frame], 900, 900) // frame now covers (900,900)-(1300,1200), which contains `a`
    expect(s().cards[a].frameId).toBe(frame)
  })

  it('resizing a frame to newly cover a stationary card assigns it membership', () => {
    const frame = s().addCard(s().rootId, 'frame', { x: 0, y: 0, w: 100, h: 100 })
    const a = s().addCard(s().rootId, 'note', { x: 300, y: 300, w: 100, h: 60 })
    expect(s().cards[a].frameId).toBeNull()
    s().resizeFrame(frame, 0, 0, 500, 500) // now covers (300,300)
    expect(s().cards[a].frameId).toBe(frame)
    expect(s().cards[a].x).toBe(300) // membership assigned without repositioning a brand-new member
  })

  it('resizing a frame scales member position and size proportionally', () => {
    const frame = s().addCard(s().rootId, 'frame', { x: 0, y: 0, w: 400, h: 300 })
    const a = s().addCard(s().rootId, 'note', { x: 100, y: 100, w: 100, h: 60 })
    expect(s().cards[a].frameId).toBe(frame)
    s().resizeFrame(frame, 0, 0, 800, 600) // 2x both axes
    expect(s().cards[a].x).toBe(200)
    expect(s().cards[a].y).toBe(200)
    expect(s().cards[a].w).toBe(200)
    expect(s().cards[a].h).toBe(120)
  })

  it('trashing a frame releases its members instead of trashing them', () => {
    const frame = s().addCard(s().rootId, 'frame', { x: 0, y: 0, w: 400, h: 300 })
    const a = s().addCard(s().rootId, 'note', { x: 50, y: 50 })
    s().trashCards([frame])
    expect(s().cards[frame].trashed).toBe(true)
    expect(s().cards[a].trashed).toBe(false)
    expect(s().cards[a].frameId).toBeNull()
  })

  it('duplicating a frame duplicates its members and remaps their frameId', () => {
    const frame = s().addCard(s().rootId, 'frame', { x: 0, y: 0, w: 400, h: 300 })
    const a = s().addCard(s().rootId, 'note', { x: 50, y: 50 })
    const newIds = s().duplicateCards([frame])
    expect(newIds.length).toBe(2)
    const newFrame = newIds.find((id) => s().cards[id].type === 'frame')!
    const newMember = newIds.find((id) => id !== newFrame)!
    expect(newFrame).toBeDefined()
    expect(newMember).toBeDefined()
    expect(s().cards[newMember].frameId).toBe(newFrame)
    // originals untouched
    expect(s().cards[a].frameId).toBe(frame)
  })

  it('restoring a trashed member clears its frameId', () => {
    const frame = s().addCard(s().rootId, 'frame', { x: 0, y: 0, w: 400, h: 300 })
    const a = s().addCard(s().rootId, 'note', { x: 50, y: 50 })
    s().trashCards([a])
    expect(s().cards[a].frameId).toBeNull() // trashCards itself doesn't set frameId (card wasn't the frame)
    s().restoreCards([a])
    expect(s().cards[a].frameId).toBeNull()
  })
})

describe('locking', () => {
  it('moveCards skips locked cards', () => {
    const a = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    const b = s().addCard(s().rootId, 'note', { x: 100, y: 0 })
    s().updateCard(a, { locked: true })
    s().moveCards([a, b], 10, 10)
    expect(s().cards[a].x).toBe(0)
    expect(s().cards[b].x).toBe(110)
  })
  it('resizeCard is a no-op on a locked card', () => {
    const a = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    s().updateCard(a, { locked: true })
    s().resizeCard(a, 500, 500)
    expect(s().cards[a].w).not.toBe(500)
  })
  it('trashCards skips locked cards', () => {
    const a = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    s().updateCard(a, { locked: true })
    s().trashCards([a])
    expect(s().cards[a].trashed).toBeFalsy()
  })
  it('a locked card can still be unlocked', () => {
    const a = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    s().updateCard(a, { locked: true })
    s().updateCard(a, { locked: false })
    s().trashCards([a])
    expect(s().cards[a].trashed).toBe(true)
  })
  it('moving a frame does not drag a locked member along', () => {
    const frame = s().addCard(s().rootId, 'frame', { x: 0, y: 0, w: 400, h: 300 })
    const a = s().addCard(s().rootId, 'note', { x: 50, y: 50 })
    s().updateCard(a, { locked: true })
    s().moveCards([frame], 30, 40)
    expect(s().cards[frame].x).toBe(30)
    expect(s().cards[a].x).toBe(50)
    expect(s().cards[a].y).toBe(50)
  })
  it('moveCards on an all-locked selection pushes no undo entry', () => {
    const a = s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    s().updateCard(a, { locked: true })
    store.temporal.getState().clear()
    s().moveCards([a], 5, 5)
    expect(s().cards[a].x).toBe(0)
    expect(store.temporal.getState().pastStates.length).toBe(0)
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
