import { Board, Card, DocState, Line } from '../model/types'

/** Cards floating on the board canvas (not trashed / unsorted / in a column). */
export function boardCards(s: DocState, boardId: string): Card[] {
  return Object.values(s.cards)
    .filter((c) => c.boardId === boardId && !c.trashed && !c.inUnsorted && !c.colId)
    .sort((a, b) => a.z - b.z)
}

export function columnCards(s: DocState, colId: string): Card[] {
  return Object.values(s.cards)
    .filter((c) => c.colId === colId && !c.trashed)
    .sort((a, b) => a.colIndex - b.colIndex)
}

export function unsortedCards(s: DocState, boardId: string): Card[] {
  return Object.values(s.cards)
    .filter((c) => c.boardId === boardId && c.inUnsorted && !c.trashed)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export function trashedCards(s: DocState): Card[] {
  return Object.values(s.cards)
    .filter((c) => c.trashed)
    .sort((a, b) => b.createdAt - a.createdAt)
}

/** Live card count on a board (canvas + columns + unsorted). */
export function boardCardCount(s: DocState, boardId: string): number {
  return Object.values(s.cards).filter((c) => c.boardId === boardId && !c.trashed).length
}

export function breadcrumbs(s: DocState, boardId: string): Board[] {
  const trail: Board[] = []
  let cur: Board | undefined = s.boards[boardId]
  while (cur) {
    trail.unshift(cur)
    cur = cur.parentId ? s.boards[cur.parentId] : undefined
  }
  return trail
}

export function linesOnBoard(s: DocState, boardId: string): Line[] {
  return Object.values(s.lines).filter((l) => l.boardId === boardId)
}
