import { createStore, StoreApi } from 'zustand/vanilla'
import { temporal, TemporalState } from 'zundo'
import { nanoid } from 'nanoid'
import { getUserName } from './settings'
import {
  Board,
  BoardSnapshot,
  Card,
  CardContent,
  CardType,
  DocState,
  Line,
  LineEnd,
  BOARD_COLORS,
  DEFAULT_CARD_SIZE,
} from '../model/types'

/** Detached copy of a card selection (with board subtrees + internal lines) for paste. */
export interface CardClip {
  originBoardId: string
  /** ids (within `cards`) that were directly selected — repositioned onto the target */
  rootIds: string[]
  cards: Card[]
  boards: Board[]
  lines: Line[]
}

export interface AtlasState extends DocState {
  addCard(
    boardId: string,
    type: CardType,
    opts?: {
      x?: number
      y?: number
      w?: number
      h?: number
      content?: Partial<CardContent>
      inUnsorted?: boolean
    },
  ): string
  updateCard(id: string, patch: Partial<Omit<Card, 'id' | 'content'>>): void
  updateContent(id: string, patch: Record<string, unknown>): void
  moveCards(ids: string[], dx: number, dy: number): void
  resizeCard(id: string, w: number, h?: number): void
  bringToFront(id: string): void
  sendToBack(id: string): void
  trashCards(ids: string[]): void
  restoreCards(ids: string[]): void
  emptyTrash(): void
  duplicateCards(ids: string[]): string[]
  createBoard(
    parentBoardId: string,
    title?: string,
    at?: { x: number; y: number },
  ): { boardId: string; cardId: string }
  renameBoard(id: string, title: string): void
  setBoardMeta(id: string, patch: Partial<Pick<Board, 'icon' | 'color' | 'theme'>>): void
  setCardColumn(cardId: string, colId: string | null, index: number, dropPos?: { x: number; y: number }): void
  addLine(boardId: string, from: LineEnd, to: LineEnd): string
  updateLine(id: string, patch: Partial<Omit<Line, 'id'>>): void
  deleteLine(id: string): void
  /** graft a copied card set onto a board with fresh ids; returns new top-level card ids */
  pasteClip(clip: CardClip, targetBoardId: string, at?: { x: number; y: number }): string[]
  /** replace the whole document (persistence load / JSON import) */
  hydrate(doc: DocState): void
  /** graft a snapshot's boards/cards/lines into the doc (template instantiation) */
  graftSnapshot(snapshot: BoardSnapshot, parentBoardId: string, at: { x: number; y: number }): string
}

type DocSlice = DocState

export type AtlasStore = StoreApi<AtlasState> & {
  temporal: StoreApi<TemporalState<DocSlice>>
}

export function defaultContent(type: CardType): CardContent {
  switch (type) {
    case 'note':
      return { kind: 'note', doc: null, bg: 'white' }
    case 'todo':
      return { kind: 'todo', title: '', items: [{ id: nanoid(6), text: '', done: false }] }
    case 'link':
      return { kind: 'link', url: '', title: '', description: '' }
    case 'image':
      return { kind: 'image', blobId: '', url: '', caption: '', naturalW: 0, naturalH: 0, pins: [] }
    case 'file':
      return { kind: 'file', blobId: '', name: '', size: 0, mime: '' }
    case 'board':
      return { kind: 'board', boardId: '' }
    case 'column':
      return { kind: 'column', title: '', collapsed: false }
    case 'comment':
      return { kind: 'comment', author: getUserName(), text: '', replies: [], ts: Date.now() }
    case 'table':
      return {
        kind: 'table',
        rows: [
          ['', ''],
          ['', ''],
          ['', ''],
        ],
      }
    case 'swatch':
      return { kind: 'swatch', hex: '#4c6ef5', name: 'Blue' }
    case 'sticky':
      return { kind: 'sticky', text: '', color: 'yellow' }
    case 'shape':
      return { kind: 'shape', shape: 'rect', fill: 'blue', text: '' }
    case 'ink':
      return { kind: 'ink', strokes: [], natW: 200, natH: 120 }
    case 'chart':
      return {
        kind: 'chart',
        chart: 'bar',
        title: '',
        rows: [
          ['Label', 'Value'],
          ['A', '4'],
          ['B', '7'],
          ['C', '3'],
        ],
      }
  }
}

function makeBoard(parentId: string | null, title: string, colorIndex: number): Board {
  return {
    id: nanoid(10),
    parentId,
    title,
    icon: 'board',
    color: BOARD_COLORS[colorIndex % BOARD_COLORS.length],
    theme: 'light',
    createdAt: Date.now(),
  }
}

export function emptyDoc(): DocState {
  const root = makeBoard(null, 'Home', 0)
  return { rootId: root.id, boards: { [root.id]: root }, cards: {}, lines: {} }
}

/** All board ids in the subtree rooted at boardId (via live + trashed board cards). */
function subtreeBoardIds(state: DocState, boardId: string): string[] {
  const out = [boardId]
  for (let i = 0; i < out.length; i++) {
    for (const card of Object.values(state.cards)) {
      if (card.boardId === out[i] && card.content.kind === 'board' && card.content.boardId) {
        if (state.boards[card.content.boardId]) out.push(card.content.boardId)
      }
    }
  }
  return out
}

/** Deep-clone the subtree rooted at boardId with fresh ids. Returns entities to merge. */
export function cloneBoardSubtree(
  state: DocState,
  boardId: string,
): { rootBoardId: string; boards: Board[]; cards: Card[]; lines: Line[] } {
  const boardIds = subtreeBoardIds(state, boardId)
  const boardSet = new Set(boardIds)
  const srcCards = Object.values(state.cards).filter((c) => boardSet.has(c.boardId) && !c.trashed)
  const srcLines = Object.values(state.lines).filter((l) => boardSet.has(l.boardId))

  const idMap = new Map<string, string>()
  for (const b of boardIds) idMap.set(b, nanoid(10))
  for (const c of srcCards) idMap.set(c.id, nanoid(10))

  const boards: Board[] = boardIds.map((bid) => {
    const src = state.boards[bid]
    return {
      ...src,
      id: idMap.get(bid)!,
      parentId: src.parentId && idMap.has(src.parentId) ? idMap.get(src.parentId)! : src.parentId,
      createdAt: Date.now(),
    }
  })

  const cards: Card[] = srcCards.map((c) => {
    const content = structuredClone(c.content) as CardContent
    if (content.kind === 'board' && content.boardId) {
      content.boardId = idMap.get(content.boardId) ?? content.boardId
    }
    return {
      ...c,
      id: idMap.get(c.id)!,
      boardId: idMap.get(c.boardId)!,
      colId: c.colId ? (idMap.get(c.colId) ?? null) : null,
      content,
      createdAt: Date.now(),
    }
  })

  const mapEnd = (end: LineEnd): LineEnd =>
    'cardId' in end ? { cardId: idMap.get(end.cardId) ?? end.cardId } : { ...end }

  const lines: Line[] = srcLines
    .filter((l) => {
      const ok = (e: LineEnd) => !('cardId' in e) || idMap.has(e.cardId)
      return ok(l.from) && ok(l.to)
    })
    .map((l) => ({
      ...l,
      id: nanoid(10),
      boardId: idMap.get(l.boardId)!,
      from: mapEnd(l.from),
      to: mapEnd(l.to),
    }))

  return { rootBoardId: idMap.get(boardId)!, boards, cards, lines }
}

/**
 * Build a detached snapshot of the given cards for the clipboard: the selected
 * cards, any members of copied columns, the full subtree of copied board cards,
 * and lines internal to the copied set. Ids stay original — paste re-ids them.
 */
export function collectClip(state: DocState, ids: string[]): CardClip | null {
  const roots = ids.map((id) => state.cards[id]).filter((c): c is Card => !!c && !c.trashed)
  if (!roots.length) return null
  const originBoardId = roots[0].boardId

  // pull members of any copied column along with it
  const rootSet = new Set(roots.map((c) => c.id))
  for (const c of Object.values(state.cards)) {
    if (c.colId && rootSet.has(c.colId) && !c.trashed) rootSet.add(c.id)
  }

  const cardsOut: Card[] = []
  const boardsOut: Board[] = []
  const linesOut: Line[] = []
  const seenCards = new Set<string>()
  const seenBoards = new Set<string>()
  const pushCard = (c: Card) => {
    if (seenCards.has(c.id)) return
    seenCards.add(c.id)
    cardsOut.push(c)
  }

  for (const id of rootSet) {
    const c = state.cards[id]
    if (c) pushCard(c)
  }

  // subtree of any copied board card
  for (const id of rootSet) {
    const c = state.cards[id]
    if (c?.content.kind === 'board' && c.content.boardId && state.boards[c.content.boardId]) {
      const boardIds = subtreeBoardIds(state, c.content.boardId)
      const boardSet = new Set(boardIds)
      for (const bid of boardIds) {
        if (!seenBoards.has(bid) && state.boards[bid]) {
          seenBoards.add(bid)
          boardsOut.push(state.boards[bid])
        }
      }
      for (const cc of Object.values(state.cards)) {
        if (boardSet.has(cc.boardId) && !cc.trashed) pushCard(cc)
      }
      for (const l of Object.values(state.lines)) {
        if (boardSet.has(l.boardId)) linesOut.push(l)
      }
    }
  }

  // lines on the origin board whose both ends are in the copied set
  for (const l of Object.values(state.lines)) {
    if (l.boardId !== originBoardId) continue
    const inSet = (e: LineEnd) => 'cardId' in e && rootSet.has(e.cardId)
    if (inSet(l.from) && inSet(l.to)) linesOut.push(l)
  }

  return structuredClone({
    originBoardId,
    rootIds: [...rootSet],
    cards: cardsOut,
    boards: boardsOut,
    lines: linesOut,
  })
}

export function createAtlasStore(initial?: DocState): AtlasStore {
  const doc = initial ?? emptyDoc()

  return createStore<AtlasState>()(
    temporal(
      (set, get) => ({
        ...doc,

        addCard(boardId, type, opts = {}) {
          const id = nanoid(10)
          const state = get()
          const maxZ = Object.values(state.cards).reduce(
            (m, c) => (c.boardId === boardId ? Math.max(m, c.z) : m),
            0,
          )
          const size = DEFAULT_CARD_SIZE[type]
          const base = defaultContent(type)
          const card: Card = {
            id,
            boardId,
            type,
            x: opts.x ?? 0,
            y: opts.y ?? 0,
            w: opts.w ?? size.w,
            h: opts.h ?? size.h,
            z: maxZ + 1,
            colId: null,
            colIndex: 0,
            inUnsorted: opts.inUnsorted ?? false,
            trashed: false,
            createdAt: Date.now(),
            content: { ...base, ...(opts.content as object) } as CardContent,
          }
          set((s) => ({ cards: { ...s.cards, [id]: card } }))
          return id
        },

        updateCard(id, patch) {
          set((s) => {
            const c = s.cards[id]
            if (!c) return s
            return { cards: { ...s.cards, [id]: { ...c, ...patch } } }
          })
        },

        updateContent(id, patch) {
          set((s) => {
            const c = s.cards[id]
            if (!c) return s
            return {
              cards: {
                ...s.cards,
                [id]: { ...c, content: { ...c.content, ...patch } as CardContent },
              },
            }
          })
        },

        moveCards(ids, dx, dy) {
          set((s) => {
            const cards = { ...s.cards }
            for (const id of ids) {
              const c = cards[id]
              if (c) cards[id] = { ...c, x: c.x + dx, y: c.y + dy }
            }
            return { cards }
          })
        },

        resizeCard(id, w, h) {
          set((s) => {
            const c = s.cards[id]
            if (!c) return s
            return { cards: { ...s.cards, [id]: { ...c, w, h } } }
          })
        },

        bringToFront(id) {
          set((s) => {
            const c = s.cards[id]
            if (!c) return s
            const maxZ = Object.values(s.cards).reduce(
              (m, k) => (k.boardId === c.boardId ? Math.max(m, k.z) : m),
              0,
            )
            return { cards: { ...s.cards, [id]: { ...c, z: maxZ + 1 } } }
          })
        },

        sendToBack(id) {
          set((s) => {
            const c = s.cards[id]
            if (!c) return s
            const minZ = Object.values(s.cards).reduce(
              (m, k) => (k.boardId === c.boardId ? Math.min(m, k.z) : m),
              c.z,
            )
            return { cards: { ...s.cards, [id]: { ...c, z: minZ - 1 } } }
          })
        },

        trashCards(ids) {
          set((s) => {
            const expand = new Set(ids)
            // a trashed column takes its members with it
            for (const c of Object.values(s.cards)) {
              if (c.colId && expand.has(c.colId)) expand.add(c.id)
            }
            const cards = { ...s.cards }
            for (const id of expand) {
              const c = cards[id]
              if (c) cards[id] = { ...c, trashed: true, colId: null, inUnsorted: false }
            }
            const lines: typeof s.lines = {}
            for (const [lid, l] of Object.entries(s.lines)) {
              const touches = (e: LineEnd) => 'cardId' in e && expand.has(e.cardId)
              if (!touches(l.from) && !touches(l.to)) lines[lid] = l
            }
            return { cards, lines }
          })
        },

        restoreCards(ids) {
          set((s) => {
            const cards = { ...s.cards }
            for (const id of ids) {
              const c = cards[id]
              if (!c) continue
              // if the card's board was deleted meanwhile, bring it home
              const boardId = s.boards[c.boardId] ? c.boardId : s.rootId
              cards[id] = { ...c, boardId, trashed: false, colId: null, inUnsorted: false }
            }
            return { cards }
          })
        },

        emptyTrash() {
          set((s) => {
            const deadCards = new Set<string>()
            const deadBoards = new Set<string>()
            for (const c of Object.values(s.cards)) {
              if (!c.trashed) continue
              deadCards.add(c.id)
              if (c.content.kind === 'board' && c.content.boardId && s.boards[c.content.boardId]) {
                for (const bid of subtreeBoardIds(s, c.content.boardId)) deadBoards.add(bid)
              }
            }
            for (const c of Object.values(s.cards)) {
              if (deadBoards.has(c.boardId)) deadCards.add(c.id)
            }
            const cards: typeof s.cards = {}
            for (const [id, c] of Object.entries(s.cards)) if (!deadCards.has(id)) cards[id] = c
            const boards: typeof s.boards = {}
            for (const [id, b] of Object.entries(s.boards)) if (!deadBoards.has(id)) boards[id] = b
            const lines: typeof s.lines = {}
            for (const [id, l] of Object.entries(s.lines)) {
              const dead = (e: LineEnd) => 'cardId' in e && deadCards.has(e.cardId)
              if (!deadBoards.has(l.boardId) && !dead(l.from) && !dead(l.to)) lines[id] = l
            }
            return { cards, boards, lines }
          })
        },

        duplicateCards(ids) {
          const newIds: string[] = []
          set((s) => {
            const cards = { ...s.cards }
            const boards = { ...s.boards }
            const lines = { ...s.lines }
            const touchedColumns = new Set<string>()
            for (const id of ids) {
              const src = cards[id]
              if (!src) continue
              const newId = nanoid(10)
              let content = structuredClone(src.content) as CardContent
              if (content.kind === 'board' && content.boardId && s.boards[content.boardId]) {
                const clone = cloneBoardSubtree(s, content.boardId)
                for (const b of clone.boards) boards[b.id] = b
                for (const c of clone.cards) cards[c.id] = c
                for (const l of clone.lines) lines[l.id] = l
                // cloned root board hangs off the same parent board as the duplicate card
                boards[clone.rootBoardId] = { ...boards[clone.rootBoardId], parentId: src.boardId }
                content = { kind: 'board', boardId: clone.rootBoardId }
              }
              const maxZ = Object.values(cards).reduce(
                (m, c) => (c.boardId === src.boardId ? Math.max(m, c.z) : m),
                0,
              )
              cards[newId] = {
                ...src,
                id: newId,
                x: src.x + 24,
                y: src.y + 24,
                z: maxZ + 1,
                // a duplicated column member slots in right after its original
                colIndex: src.colId ? src.colIndex + 0.5 : src.colIndex,
                content,
                createdAt: Date.now(),
              }
              if (src.colId) touchedColumns.add(src.colId)
              newIds.push(newId)
            }
            // recompact fractional indexes back to integers
            for (const colId of touchedColumns) {
              Object.values(cards)
                .filter((c) => c.colId === colId && !c.trashed)
                .sort((a, b) => a.colIndex - b.colIndex)
                .forEach((c, i) => {
                  cards[c.id] = { ...cards[c.id], colIndex: i }
                })
            }
            return { cards, boards, lines }
          })
          return newIds
        },

        createBoard(parentBoardId, title = 'Untitled', at) {
          const state = get()
          const colorIndex = Object.keys(state.boards).length
          const board = makeBoard(parentBoardId, title, colorIndex)
          set((s) => ({ boards: { ...s.boards, [board.id]: board } }))
          const cardId = get().addCard(parentBoardId, 'board', {
            x: at?.x ?? 0,
            y: at?.y ?? 0,
            content: { kind: 'board', boardId: board.id },
          })
          return { boardId: board.id, cardId }
        },

        renameBoard(id, title) {
          set((s) => {
            const b = s.boards[id]
            if (!b) return s
            return { boards: { ...s.boards, [id]: { ...b, title } } }
          })
        },

        setBoardMeta(id, patch) {
          set((s) => {
            const b = s.boards[id]
            if (!b) return s
            return { boards: { ...s.boards, [id]: { ...b, ...patch } } }
          })
        },

        setCardColumn(cardId, colId, index, dropPos) {
          set((s) => {
            const card = s.cards[cardId]
            if (!card) return s
            const cards = { ...s.cards }

            // pull out of the old column and compact
            if (card.colId) {
              const siblings = Object.values(cards)
                .filter((c) => c.colId === card.colId && c.id !== cardId && !c.trashed)
                .sort((a, b) => a.colIndex - b.colIndex)
              siblings.forEach((c, i) => {
                cards[c.id] = { ...cards[c.id], colIndex: i }
              })
            }

            if (colId) {
              const members = Object.values(cards)
                .filter((c) => c.colId === colId && c.id !== cardId && !c.trashed)
                .sort((a, b) => a.colIndex - b.colIndex)
              const clamped = Math.max(0, Math.min(index, members.length))
              members.forEach((c, i) => {
                cards[c.id] = { ...cards[c.id], colIndex: i >= clamped ? i + 1 : i }
              })
              const col = cards[colId]
              cards[cardId] = {
                ...cards[cardId],
                colId,
                colIndex: clamped,
                inUnsorted: false,
                boardId: col ? col.boardId : cards[cardId].boardId,
              }
            } else {
              cards[cardId] = {
                ...cards[cardId],
                colId: null,
                colIndex: 0,
                x: dropPos?.x ?? cards[cardId].x,
                y: dropPos?.y ?? cards[cardId].y,
              }
            }
            return { cards }
          })
        },

        addLine(boardId, from, to) {
          const id = nanoid(10)
          const line: Line = {
            id,
            boardId,
            from,
            to,
            curve: 0.2,
            arrowStart: false,
            arrowEnd: false,
            label: '',
          }
          set((s) => ({ lines: { ...s.lines, [id]: line } }))
          return id
        },

        updateLine(id, patch) {
          set((s) => {
            const l = s.lines[id]
            if (!l) return s
            return { lines: { ...s.lines, [id]: { ...l, ...patch } } }
          })
        },

        deleteLine(id) {
          set((s) => {
            const lines = { ...s.lines }
            delete lines[id]
            return { lines }
          })
        },

        pasteClip(clip, targetBoardId, at) {
          const newIds: string[] = []
          set((s) => {
            const idMap = new Map<string, string>()
            for (const b of clip.boards) idMap.set(b.id, nanoid(10))
            for (const c of clip.cards) idMap.set(c.id, nanoid(10))

            // position the free (non-column) origin-board cards so the group lands at `at`
            const rootSet = new Set(clip.rootIds)
            const originFree = clip.cards.filter((c) => c.boardId === clip.originBoardId && !c.colId)
            let offX = 24
            let offY = 24
            if (at && originFree.length) {
              offX = at.x - Math.min(...originFree.map((c) => c.x))
              offY = at.y - Math.min(...originFree.map((c) => c.y))
            }

            const maxZ = Object.values(s.cards).reduce(
              (m, c) => (c.boardId === targetBoardId ? Math.max(m, c.z) : m),
              0,
            )

            const boards = { ...s.boards }
            for (const b of clip.boards) {
              const nid = idMap.get(b.id)!
              boards[nid] = {
                ...b,
                id: nid,
                // subtree boards keep their (remapped) parent; the top one hangs off the target
                parentId: b.parentId && idMap.has(b.parentId) ? idMap.get(b.parentId)! : targetBoardId,
                createdAt: Date.now(),
              }
            }

            const cards = { ...s.cards }
            let zi = 1
            for (const c of clip.cards) {
              const nid = idMap.get(c.id)!
              const isOrigin = c.boardId === clip.originBoardId
              const onCanvas = isOrigin && !c.colId
              const content = structuredClone(c.content) as CardContent
              if (content.kind === 'board' && content.boardId) {
                content.boardId = idMap.get(content.boardId) ?? content.boardId
              }
              cards[nid] = {
                ...c,
                id: nid,
                boardId: isOrigin ? targetBoardId : idMap.get(c.boardId)!,
                colId: c.colId ? (idMap.get(c.colId) ?? null) : null,
                x: onCanvas ? c.x + offX : c.x,
                y: onCanvas ? c.y + offY : c.y,
                z: onCanvas ? maxZ + zi++ : c.z,
                inUnsorted: false,
                trashed: false,
                content,
                createdAt: Date.now(),
              }
              if (onCanvas && rootSet.has(c.id)) newIds.push(nid)
            }

            const lines = { ...s.lines }
            const mapEnd = (e: LineEnd): LineEnd =>
              'cardId' in e ? { cardId: idMap.get(e.cardId) ?? e.cardId } : { ...e }
            for (const l of clip.lines) {
              const ok = (e: LineEnd) => !('cardId' in e) || idMap.has(e.cardId)
              if (!ok(l.from) || !ok(l.to)) continue
              const nid = nanoid(10)
              lines[nid] = {
                ...l,
                id: nid,
                boardId: l.boardId === clip.originBoardId ? targetBoardId : idMap.get(l.boardId) ?? targetBoardId,
                from: mapEnd(l.from),
                to: mapEnd(l.to),
              }
            }

            return { boards, cards, lines }
          })
          return newIds
        },

        hydrate(doc) {
          set(doc)
        },

        graftSnapshot(snapshot, parentBoardId, at) {
          // re-id everything so repeated instantiation never collides
          const scratch: DocState = {
            rootId: snapshot.rootBoardId,
            boards: Object.fromEntries(snapshot.boards.map((b) => [b.id, b])),
            cards: Object.fromEntries(snapshot.cards.map((c) => [c.id, c])),
            lines: Object.fromEntries(snapshot.lines.map((l) => [l.id, l])),
          }
          const clone = cloneBoardSubtree(scratch, snapshot.rootBoardId)
          set((s) => {
            const boards = { ...s.boards }
            const cards = { ...s.cards }
            const lines = { ...s.lines }
            for (const b of clone.boards) boards[b.id] = b
            for (const c of clone.cards) cards[c.id] = c
            for (const l of clone.lines) lines[l.id] = l
            boards[clone.rootBoardId] = { ...boards[clone.rootBoardId], parentId: parentBoardId }
            return { boards, cards, lines }
          })
          get().addCard(parentBoardId, 'board', {
            x: at.x,
            y: at.y,
            content: { kind: 'board', boardId: clone.rootBoardId },
          })
          return clone.rootBoardId
        },
      }),
      {
        partialize: (state): DocSlice => ({
          rootId: state.rootId,
          boards: state.boards,
          cards: state.cards,
          lines: state.lines,
        }),
        limit: 100,
      },
    ),
  ) as AtlasStore
}
