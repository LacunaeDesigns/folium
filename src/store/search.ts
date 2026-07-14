import { Card, DocState } from '../model/types'

export interface SearchHit {
  kind: 'board' | 'card'
  id: string
  /** board to open (the board itself, or the card's board) */
  boardId: string
  cardId?: string
  title: string
  snippet: string
  cardType?: Card['type']
}

/** Collect plain text from a TipTap JSON doc. */
export function tiptapText(doc: unknown): string {
  const out: string[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as { text?: string; content?: unknown[] }
    if (typeof n.text === 'string') out.push(n.text)
    if (Array.isArray(n.content)) n.content.forEach(walk)
  }
  walk(doc)
  return out.join(' ')
}

export function cardText(card: Card): string {
  const c = card.content
  switch (c.kind) {
    case 'note':
      return tiptapText(c.doc)
    case 'todo':
      return [c.title, ...c.items.map((i) => i.text)].join(' ')
    case 'link':
      return [c.title, c.description, c.url].join(' ')
    case 'image':
      return [c.caption, ...c.pins.map((p) => [p.text, ...p.replies.map((r) => r.text)].join(' '))].join(' ')
    case 'file':
      return c.name
    case 'column':
      return c.title
    case 'comment':
      return [c.text, ...c.replies.map((r) => r.text)].join(' ')
    case 'table':
      return c.rows.flat().join(' ')
    case 'swatch':
      return [c.name, c.hex].join(' ')
    case 'sticky':
      return c.text
    case 'shape':
      return c.text
    case 'chart':
      return [c.title, ...c.rows.flat()].join(' ')
    case 'frame':
      return c.title
    case 'heading':
      return c.text
    case 'board':
    case 'ink':
      return ''
  }
}

function snippetAround(text: string, query: string, span = 60): string {
  const idx = text.toLowerCase().indexOf(query)
  if (idx < 0) return text.slice(0, span)
  const start = Math.max(0, idx - Math.floor(span / 3))
  const cut = text.slice(start, start + span).trim()
  return (start > 0 ? '…' : '') + cut + (start + span < text.length ? '…' : '')
}

export function searchAll(state: DocState, rawQuery: string, limit = 30): SearchHit[] {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return []
  const hits: SearchHit[] = []

  for (const board of Object.values(state.boards)) {
    if (board.title.toLowerCase().includes(query)) {
      hits.push({
        kind: 'board',
        id: board.id,
        boardId: board.id,
        title: board.title,
        snippet: 'Board',
      })
    }
  }

  for (const card of Object.values(state.cards)) {
    if (card.trashed) continue
    if (!state.boards[card.boardId]) continue
    const text = cardText(card)
    if (!text || !text.toLowerCase().includes(query)) continue
    hits.push({
      kind: 'card',
      id: card.id,
      boardId: card.boardId,
      cardId: card.id,
      cardType: card.type,
      title: state.boards[card.boardId].title,
      snippet: snippetAround(text, query),
    })
    if (hits.length >= limit) break
  }

  return hits.slice(0, limit)
}
