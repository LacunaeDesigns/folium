import { create } from 'zustand'

interface LocalSaveState {
  lastSavedAt: number | null
}

/** Tracks when the local IndexedDB autosave last completed, for the toolbar save indicator. */
export const useLocalSave = create<LocalSaveState>(() => ({
  lastSavedAt: null,
}))

export function recordLocalSave(ts: number): void {
  useLocalSave.setState({ lastSavedAt: ts })
}
