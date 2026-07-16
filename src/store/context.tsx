import React from 'react'
import { useStore } from 'zustand'
import { FoliumState, FoliumStore, createFoliumStore } from './store'
import { FoliumDb, bindAutosave, bindBlobGc, gcBlobs, loadDoc, openDb } from './persist'
import { loadSettings } from './settings'
import { createTabSync } from './tabSync'
import { recordLocalSave } from './localSave'
import { checkForUpdates } from './updateCheck'
import { maybeSnapshot } from './snapshots'

interface FoliumContextValue {
  store: FoliumStore
  db: FoliumDb
}

const FoliumContext = React.createContext<FoliumContextValue | null>(null)

export function FoliumProvider({
  store,
  db,
  children,
}: FoliumContextValue & { children: React.ReactNode }) {
  return <FoliumContext.Provider value={{ store, db }}>{children}</FoliumContext.Provider>
}

export function useFoliumContext(): FoliumContextValue {
  const ctx = React.useContext(FoliumContext)
  if (!ctx) throw new Error('useFoliumContext outside FoliumProvider')
  return ctx
}

export function useFolium<T>(selector: (s: FoliumState) => T): T {
  return useStore(useFoliumContext().store, selector)
}

export function useFoliumStore(): FoliumStore {
  return useFoliumContext().store
}

export function useDb(): FoliumDb {
  return useFoliumContext().db
}

export async function bootFolium(): Promise<FoliumContextValue> {
  const db = openDb()
  const doc = await loadDoc(db)
  await loadSettings(db)
  const store = createFoliumStore(doc ?? undefined)
  if (!doc) {
    const { seedWelcome } = await import('./seed')
    seedWelcome(store)
    store.temporal.getState().clear()
  }
  const tabSync = createTabSync(store, db)
  bindAutosave(store, db, 600, {
    onWrite: (ts) => {
      tabSync.onWrite(ts)
      recordLocalSave(ts)
      // version snapshot alongside the save, at most once per interval (db-gated,
      // so a second open tab can't double-fire); best-effort, never blocks saving
      const s = store.getState()
      void maybeSnapshot(db, { rootId: s.rootId, boards: s.boards, cards: s.cards, lines: s.lines }, ts).catch(() => {})
    },
    isPaused: tabSync.isPaused,
  })
  bindBlobGc(store, db)
  // one-shot sweep for blobs orphaned last session: bindBlobGc now keeps a blob alive for as
  // long as it's reachable via the undo stack, so a permanent deletion right before the tab
  // closed can leave an orphan behind. The undo stack is empty at boot, so scanning just the
  // freshly loaded doc here safely collects it.
  if (doc) void gcBlobs(db, [doc])
  // boot snapshot: capture the state the session STARTED from (pre-edits), so
  // "before today's changes" is always restorable even for short sessions
  if (doc) void maybeSnapshot(db, doc).catch(() => {})
  // folder sync (optional, opt-in): reconnect a linked folder and pull newer remote data
  try {
    const { initFolderSync } = await import('./sync')
    await initFolderSync(store, db)
  } catch {
    /* sync is best-effort; never block boot on it */
  }
  // update-available check (best-effort, never blocks boot)
  void checkForUpdates(db)
  return { store, db }
}
