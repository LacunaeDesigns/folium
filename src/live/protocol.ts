import { nanoid } from 'nanoid'
import { Card, CommentContent, DocState, ImageContent, ImagePin } from '../model/types'
import { AtlasStore } from '../store/store'

export type LiveMsg =
  | { t: 'hello'; name: string }
  | { t: 'welcome'; hostName: string; boardTitle: string }
  | { t: 'comment-add'; boardId: string; x: number; y: number; text: string; author: string; ts: number }
  | { t: 'pin-add'; cardId: string; fx: number; fy: number; text: string; author: string; ts: number }
  | { t: 'reply-add'; cardId: string; pinId?: string; text: string; author: string; ts: number }
  | { t: 'cards-sync'; cards: SyncCard[] }
  | { t: 'peers'; names: string[] }

export interface SyncCard {
  id: string
  boardId: string
  type: Card['type']
  x: number
  y: number
  w: number
  h?: number
  z: number
  colId: string | null
  colIndex: number
  content: Card['content']
}

const MAX_TEXT = 5000
const MAX_NAME = 60

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/** Apply a reviewer message to the host store. Malformed input is ignored. */
export function applyLiveMsg(store: AtlasStore, msg: LiveMsg): void {
  if (!msg || typeof msg !== 'object') return
  const s = store.getState()
  try {
    switch (msg.t) {
      case 'comment-add': {
        const boardId = str(msg.boardId, 40)
        const text = str(msg.text, MAX_TEXT)
        if (!s.boards[boardId] || !text) return
        s.addCard(boardId, 'comment', {
          x: num(msg.x),
          y: num(msg.y),
          content: {
            kind: 'comment',
            author: str(msg.author, MAX_NAME) || 'Reviewer',
            text,
            replies: [],
            ts: num(msg.ts) || Date.now(),
          },
        })
        return
      }
      case 'pin-add': {
        const card = s.cards[str(msg.cardId, 40)]
        const text = str(msg.text, MAX_TEXT)
        if (!card || card.content.kind !== 'image' || !text) return
        const pin: ImagePin = {
          id: nanoid(6),
          fx: clamp01(num(msg.fx)),
          fy: clamp01(num(msg.fy)),
          author: str(msg.author, MAX_NAME) || 'Reviewer',
          text,
          replies: [],
          ts: num(msg.ts) || Date.now(),
        }
        s.updateContent(card.id, { pins: [...card.content.pins, pin] })
        return
      }
      case 'reply-add': {
        const card = s.cards[str(msg.cardId, 40)]
        const text = str(msg.text, MAX_TEXT)
        if (!card || !text) return
        const reply = {
          id: nanoid(6),
          author: str(msg.author, MAX_NAME) || 'Reviewer',
          text,
          ts: num(msg.ts) || Date.now(),
        }
        if (msg.pinId && card.content.kind === 'image') {
          const pins = card.content.pins.map((p) =>
            p.id === msg.pinId ? { ...p, replies: [...p.replies, reply] } : p,
          )
          s.updateContent(card.id, { pins })
        } else if (card.content.kind === 'comment') {
          s.updateContent(card.id, { replies: [...(card.content as CommentContent).replies, reply] })
        }
        return
      }
      default:
        return
    }
  } catch {
    /* never let a peer message crash the host */
  }
}

/** Comment + image cards on the given boards — the live-sync payload. */
export function collectSyncCards(state: DocState, boardIds: string[]): SyncCard[] {
  const set = new Set(boardIds)
  return Object.values(state.cards)
    .filter(
      (c) =>
        set.has(c.boardId) && !c.trashed && !c.inUnsorted && (c.type === 'comment' || c.type === 'image'),
    )
    .map((c) => ({
      id: c.id,
      boardId: c.boardId,
      type: c.type,
      x: c.x,
      y: c.y,
      w: c.w,
      h: c.h,
      z: c.z,
      colId: c.colId,
      colIndex: c.colIndex,
      content: c.content as CommentContent | ImageContent,
    }))
}
