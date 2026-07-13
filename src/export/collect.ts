import { Board, Card, DocState, Line } from '../model/types'
import { AtlasDb, getBlob } from '../store/persist'

export interface ExportBundle {
  rootBoardId: string
  boards: Board[]
  cards: Card[]
  lines: Line[]
  /** blobId -> data URL */
  blobs: Record<string, string>
  exportedAt: number
  appName: string
}

function subtreeBoards(state: DocState, boardId: string): string[] {
  const out = [boardId]
  for (let i = 0; i < out.length; i++) {
    for (const card of Object.values(state.cards)) {
      if (card.boardId !== out[i] || card.trashed) continue
      if (card.content.kind === 'board' && card.content.boardId && state.boards[card.content.boardId]) {
        out.push(card.content.boardId)
      }
    }
  }
  return out
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

const MAX_INLINE_BLOB = 16 * 1024 * 1024

export async function collectBoardExport(
  state: DocState,
  boardId: string,
  db: AtlasDb,
): Promise<ExportBundle> {
  const boardIds = subtreeBoards(state, boardId)
  const boardSet = new Set(boardIds)
  const cards = Object.values(state.cards).filter(
    (c) => boardSet.has(c.boardId) && !c.trashed && !c.inUnsorted,
  )
  const lines = Object.values(state.lines).filter((l) => boardSet.has(l.boardId))

  const blobs: Record<string, string> = {}
  for (const card of cards) {
    const c = card.content
    const blobId = c.kind === 'image' || c.kind === 'file' ? c.blobId : ''
    if (!blobId || blobs[blobId]) continue
    const blob = await getBlob(db, blobId)
    if (blob && blob.size <= MAX_INLINE_BLOB) {
      blobs[blobId] = await blobToDataUrl(blob)
    }
  }

  return {
    rootBoardId: boardId,
    boards: boardIds.map((id) => state.boards[id]),
    cards,
    lines,
    blobs,
    exportedAt: Date.now(),
    appName: 'Folium',
  }
}

export function downloadFile(name: string, content: string | Blob, mime = 'text/plain'): void {
  const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export function safeFilename(title: string): string {
  return title.replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'board'
}
