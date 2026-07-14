import React from 'react'
import { useStore } from 'zustand'
import { FoliumState, FoliumStore, createFoliumStore } from './store'
import { FoliumDb, bindAutosave, bindBlobGc, loadDoc, openDb } from './persist'
import { loadSettings } from './settings'
import { createTabSync } from './tabSync'

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
  bindAutosave(store, db, 600, { onWrite: tabSync.onWrite, isPaused: tabSync.isPaused })
  bindBlobGc(store, db)
  // folder sync (optional, opt-in): reconnect a linked folder and pull newer remote data
  try {
    const { initFolderSync } = await import('./sync')
    await initFolderSync(store, db)
  } catch {
    /* sync is best-effort; never block boot on it */
  }
  return { store, db }
}
