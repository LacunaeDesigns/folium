import React from 'react'
import { useStore } from 'zustand'
import { AtlasState, AtlasStore, createAtlasStore } from './store'
import { AtlasDb, bindAutosave, bindBlobGc, loadDoc, openDb } from './persist'
import { loadSettings } from './settings'

interface AtlasContextValue {
  store: AtlasStore
  db: AtlasDb
}

const AtlasContext = React.createContext<AtlasContextValue | null>(null)

export function AtlasProvider({
  store,
  db,
  children,
}: AtlasContextValue & { children: React.ReactNode }) {
  return <AtlasContext.Provider value={{ store, db }}>{children}</AtlasContext.Provider>
}

export function useAtlasContext(): AtlasContextValue {
  const ctx = React.useContext(AtlasContext)
  if (!ctx) throw new Error('useAtlasContext outside AtlasProvider')
  return ctx
}

export function useAtlas<T>(selector: (s: AtlasState) => T): T {
  return useStore(useAtlasContext().store, selector)
}

export function useAtlasStore(): AtlasStore {
  return useAtlasContext().store
}

export function useDb(): AtlasDb {
  return useAtlasContext().db
}

export async function bootAtlas(): Promise<AtlasContextValue> {
  const db = openDb()
  const doc = await loadDoc(db)
  await loadSettings(db)
  const store = createAtlasStore(doc ?? undefined)
  if (!doc) {
    const { seedWelcome } = await import('./seed')
    seedWelcome(store)
    store.temporal.getState().clear()
  }
  bindAutosave(store, db)
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
