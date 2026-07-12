import { describe, it, expect, beforeEach } from 'vitest'
import { createAtlasStore, AtlasStore } from '../store/store'
import { applyLiveMsg, collectSyncCards, LiveMsg } from './protocol'
import { CommentContent, ImageContent } from '../model/types'

let store: AtlasStore
const s = () => store.getState()

beforeEach(() => {
  store = createAtlasStore()
})

describe('applyLiveMsg', () => {
  it('comment-add creates a comment card from a reviewer', () => {
    const msg: LiveMsg = {
      t: 'comment-add',
      boardId: s().rootId,
      x: 120,
      y: 80,
      text: 'The mid-section pacing drags',
      author: 'Alex',
      ts: 1,
    }
    applyLiveMsg(store, msg)
    const card = Object.values(s().cards).find((c) => c.type === 'comment')!
    expect(card).toBeDefined()
    const content = card.content as CommentContent
    expect(content.author).toBe('Alex')
    expect(content.text).toContain('pacing')
    expect(card.x).toBe(120)
  })

  it('rejects comment-add for unknown boards', () => {
    applyLiveMsg(store, { t: 'comment-add', boardId: 'nope', x: 0, y: 0, text: 'x', author: 'A', ts: 1 })
    expect(Object.values(s().cards)).toHaveLength(0)
  })

  it('pin-add appends a pin to an image card', () => {
    const img = s().addCard(s().rootId, 'image', { x: 0, y: 0 })
    applyLiveMsg(store, { t: 'pin-add', cardId: img, fx: 0.5, fy: 0.25, text: 'sightline issue', author: 'Alex', ts: 2 })
    const content = s().cards[img].content as ImageContent
    expect(content.pins).toHaveLength(1)
    expect(content.pins[0].author).toBe('Alex')
    expect(content.pins[0].fx).toBe(0.5)
  })

  it('clamps pin coordinates into 0..1', () => {
    const img = s().addCard(s().rootId, 'image', { x: 0, y: 0 })
    applyLiveMsg(store, { t: 'pin-add', cardId: img, fx: 4, fy: -1, text: 'x', author: 'A', ts: 2 })
    const content = s().cards[img].content as ImageContent
    expect(content.pins[0].fx).toBeLessThanOrEqual(1)
    expect(content.pins[0].fy).toBeGreaterThanOrEqual(0)
  })

  it('reply-add appends to a comment card thread', () => {
    const id = s().addCard(s().rootId, 'comment', { x: 0, y: 0 })
    applyLiveMsg(store, { t: 'reply-add', cardId: id, text: 'agreed', author: 'Alex', ts: 3 })
    const content = s().cards[id].content as CommentContent
    expect(content.replies).toHaveLength(1)
    expect(content.replies[0].author).toBe('Alex')
  })

  it('reply-add with pinId appends to an image pin thread', () => {
    const img = s().addCard(s().rootId, 'image', { x: 0, y: 0 })
    applyLiveMsg(store, { t: 'pin-add', cardId: img, fx: 0.1, fy: 0.1, text: 'first', author: 'Alex', ts: 4 })
    const pinId = (s().cards[img].content as ImageContent).pins[0].id
    applyLiveMsg(store, { t: 'reply-add', cardId: img, pinId, text: 'seconded', author: 'Sam', ts: 5 })
    const pins = (s().cards[img].content as ImageContent).pins
    expect(pins[0].replies).toHaveLength(1)
    expect(pins[0].replies[0].text).toBe('seconded')
  })

  it('ignores malformed messages without throwing', () => {
    expect(() => applyLiveMsg(store, { t: 'comment-add' } as never)).not.toThrow()
    expect(() => applyLiveMsg(store, null as never)).not.toThrow()
    expect(Object.values(s().cards)).toHaveLength(0)
  })

  it('truncates absurdly long reviewer text', () => {
    applyLiveMsg(store, {
      t: 'comment-add',
      boardId: s().rootId,
      x: 0,
      y: 0,
      text: 'x'.repeat(100000),
      author: 'A'.repeat(500),
      ts: 6,
    })
    const card = Object.values(s().cards)[0]
    const content = card.content as CommentContent
    expect(content.text.length).toBeLessThanOrEqual(5000)
    expect(content.author.length).toBeLessThanOrEqual(60)
  })
})

describe('collectSyncCards', () => {
  it('returns comment and image cards for the given boards only', () => {
    const { boardId } = s().createBoard(s().rootId, 'Other')
    s().addCard(s().rootId, 'comment', { x: 0, y: 0 })
    s().addCard(s().rootId, 'image', { x: 0, y: 0 })
    s().addCard(s().rootId, 'note', { x: 0, y: 0 })
    s().addCard(boardId, 'comment', { x: 0, y: 0 })
    const sync = collectSyncCards(s(), [s().rootId])
    expect(sync).toHaveLength(2)
    expect(sync.every((c) => c.boardId === s().rootId)).toBe(true)
  })
})
