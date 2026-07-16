import { Board, Card, DocState, Line, TodoContent } from '../model/types'

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

/** Cards currently inside a frame (section). */
export function frameMemberCount(s: DocState, frameId: string): number {
  return Object.values(s.cards).filter((c) => c.frameId === frameId && !c.trashed).length
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

/** Aggregate todo-item progress across all todo cards directly on a board (non-recursive). */
export function boardTodoStats(s: DocState, boardId: string): { done: number; total: number } {
  let done = 0
  let total = 0
  for (const c of Object.values(s.cards)) {
    if (c.boardId !== boardId || c.trashed || c.type !== 'todo') continue
    const items = (c.content as TodoContent).items
    total += items.length
    done += items.filter((i) => i.done).length
  }
  return { done, total }
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

export interface BoardStats {
  cardCount: number
  todoDone: number
  todoTotal: number
}

/** Card-count + todo-progress aggregates for every board with at least one live card,
 *  computed in ONE pass over s.cards. boardCardCount/boardTodoStats above are each
 *  O(cards) — fine called once for a single board, but calling either once per board
 *  (as a naive board-library implementation would) is O(boards * cards); this is
 *  O(cards) total regardless of board count. */
export function allBoardStats(s: DocState): Record<string, BoardStats> {
  const out: Record<string, BoardStats> = {}
  for (const c of Object.values(s.cards)) {
    if (c.trashed) continue
    const stats = out[c.boardId] ?? (out[c.boardId] = { cardCount: 0, todoDone: 0, todoTotal: 0 })
    stats.cardCount++
    if (c.type === 'todo') {
      const items = (c.content as TodoContent).items
      stats.todoTotal += items.length
      stats.todoDone += items.filter((i) => i.done).length
    }
  }
  return out
}
