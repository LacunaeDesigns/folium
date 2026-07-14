import { create } from 'zustand'
import { ToolId } from '../ui/Toolbar'

export interface BoardView {
  pan: { x: number; y: number }
  zoom: number
}

/* default pan clears the floating tool dock on the left */
export const DEFAULT_VIEW: BoardView = { pan: { x: 96, y: 0 }, zoom: 1 }

export interface DrawSettings {
  color: string
  width: number
  eraser: boolean
}

/** live alignment guides shown while dragging cards (world coordinates) */
export interface SnapGuides {
  v: { x: number; y1: number; y2: number } | null
  h: { y: number; x1: number; x2: number } | null
}

interface UiState {
  currentBoardId: string | null
  selection: string[]
  /** selected line id (mutually exclusive with card selection in practice) */
  selectedLine: string | null
  activeTool: ToolId | null
  /** per-board pan/zoom, in-memory */
  views: Record<string, BoardView>
  draw: DrawSettings
  trashOpen: boolean
  searchOpen: boolean
  unsortedOpen: boolean
  presentationMode: boolean
  /** app-wide appearance, applied to <html>; independent of per-board themes */
  appTheme: 'light' | 'dark'
  snapGuides: SnapGuides | null

  setBoard(id: string): void
  setSelection(ids: string[]): void
  toggleSelect(id: string): void
  clearSelection(): void
  setSelectedLine(id: string | null): void
  setTool(tool: ToolId | null): void
  setView(boardId: string, view: BoardView): void
  setDraw(patch: Partial<DrawSettings>): void
  setTrashOpen(open: boolean): void
  setSearchOpen(open: boolean): void
  setUnsortedOpen(open: boolean): void
  setPresentationMode(on: boolean): void
  setAppTheme(theme: 'light' | 'dark'): void
  setSnapGuides(g: SnapGuides | null): void
}

export const useUi = create<UiState>((set) => ({
  currentBoardId: null,
  selection: [],
  selectedLine: null,
  activeTool: null,
  views: {},
  draw: { color: '#33373b', width: 3, eraser: false },
  trashOpen: false,
  searchOpen: false,
  unsortedOpen: false,
  presentationMode: false,
  appTheme: 'light',
  snapGuides: null,

  setBoard: (id) => {
    set({ currentBoardId: id, selection: [], selectedLine: null, activeTool: null, trashOpen: false })
    const want = '#/b/' + id
    if (typeof location !== 'undefined' && location.hash !== want) location.hash = want
  },
  setSelection: (ids) => set({ selection: ids, selectedLine: null }),
  toggleSelect: (id) =>
    set((s) => ({
      selection: s.selection.includes(id)
        ? s.selection.filter((k) => k !== id)
        : [...s.selection, id],
      selectedLine: null,
    })),
  clearSelection: () => set({ selection: [], selectedLine: null }),
  setSelectedLine: (id) => set({ selectedLine: id, selection: id ? [] : [] }),
  setTool: (tool) => set({ activeTool: tool }),
  setView: (boardId, view) => set((s) => ({ views: { ...s.views, [boardId]: view } })),
  setDraw: (patch) => set((s) => ({ draw: { ...s.draw, ...patch } })),
  setTrashOpen: (open) => set({ trashOpen: open }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setUnsortedOpen: (open) => set({ unsortedOpen: open }),
  setPresentationMode: (on) => set({ presentationMode: on }),
  setAppTheme: (theme) => set({ appTheme: theme }),
  setSnapGuides: (g) => set({ snapGuides: g }),
}))
