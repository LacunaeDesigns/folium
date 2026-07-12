import { create } from 'zustand'
import { ToolId } from '../ui/Toolbar'

export interface BoardView {
  pan: { x: number; y: number }
  zoom: number
}

export const DEFAULT_VIEW: BoardView = { pan: { x: 0, y: 0 }, zoom: 1 }

interface UiState {
  currentBoardId: string | null
  selection: string[]
  activeTool: ToolId | null
  /** per-board pan/zoom, in-memory */
  views: Record<string, BoardView>
  trashOpen: boolean
  searchOpen: boolean
  unsortedOpen: boolean
  presentationMode: boolean

  setBoard(id: string): void
  setSelection(ids: string[]): void
  toggleSelect(id: string): void
  clearSelection(): void
  setTool(tool: ToolId | null): void
  setView(boardId: string, view: BoardView): void
  setTrashOpen(open: boolean): void
  setSearchOpen(open: boolean): void
  setUnsortedOpen(open: boolean): void
}

export const useUi = create<UiState>((set) => ({
  currentBoardId: null,
  selection: [],
  activeTool: null,
  views: {},
  trashOpen: false,
  searchOpen: false,
  unsortedOpen: false,
  presentationMode: false,

  setBoard: (id) => {
    set({ currentBoardId: id, selection: [], activeTool: null, trashOpen: false })
    const want = '#/b/' + id
    if (typeof location !== 'undefined' && location.hash !== want) location.hash = want
  },
  setSelection: (ids) => set({ selection: ids }),
  toggleSelect: (id) =>
    set((s) => ({
      selection: s.selection.includes(id)
        ? s.selection.filter((k) => k !== id)
        : [...s.selection, id],
    })),
  clearSelection: () => set({ selection: [] }),
  setTool: (tool) => set({ activeTool: tool }),
  setView: (boardId, view) => set((s) => ({ views: { ...s.views, [boardId]: view } })),
  setTrashOpen: (open) => set({ trashOpen: open }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setUnsortedOpen: (open) => set({ unsortedOpen: open }),
}))
