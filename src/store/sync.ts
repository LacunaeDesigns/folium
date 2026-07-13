import { create } from 'zustand'
import { AtlasDb, clearSyncHandle, getSetting, loadSyncHandle, saveSyncHandle, setSetting } from './persist'
import { AtlasStore } from './store'
import { getUserName } from './settings'
import { applyBackup, exportBackup, parseBackup } from '../export/json'
import {
  chooseSource,
  ensurePermission,
  FS_SUPPORTED,
  pickDirectory,
  readWorkspace,
  writeWorkspace,
} from './folderSync'

type SyncStatus = 'unsupported' | 'off' | 'linked' | 'needs-reconnect' | 'error'

interface SyncUiState {
  status: SyncStatus
  dirName: string | null
  lastSyncedAt: number | null
  busy: boolean
  error: string | null
}

export const useSync = create<SyncUiState>(() => ({
  status: FS_SUPPORTED ? 'off' : 'unsupported',
  dirName: null,
  lastSyncedAt: null,
  busy: false,
  error: null,
}))

let db: AtlasDb | null = null
let store: AtlasStore | null = null
let handle: FileSystemDirectoryHandle | null = null
let pushTimer: ReturnType<typeof setTimeout> | null = null
const PUSH_DELAY = 1500

const DOC_TS_KEY = 'docUpdatedAt'

function docState() {
  const s = store!.getState()
  return { rootId: s.rootId, boards: s.boards, cards: s.cards, lines: s.lines }
}

/** Build the current workspace backup and write it to the linked folder. */
async function push(): Promise<void> {
  if (!db || !store || !handle) return
  useSync.setState({ busy: true })
  try {
    const json = await exportBackup(db, docState(), getUserName())
    const ts = (JSON.parse(json) as { exportedAt: number }).exportedAt
    await writeWorkspace(handle, json)
    await setSetting(db, DOC_TS_KEY, ts)
    useSync.setState({ lastSyncedAt: ts, error: null })
  } catch (err) {
    useSync.setState({ status: 'error', error: (err as Error).message })
  } finally {
    useSync.setState({ busy: false })
  }
}

function schedulePush(): void {
  if (useSync.getState().status !== 'linked') return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void push()
  }, PUSH_DELAY)
}

export function flushSync(): void {
  if (pushTimer) {
    clearTimeout(pushTimer)
    pushTimer = null
    void push()
  }
}

/**
 * Compare the folder's workspace against local and load whichever is newer.
 * Boot path (no reload — runs before React renders).
 */
async function reconcile(): Promise<'loaded' | 'pushed'> {
  if (!db || !store || !handle) return 'pushed'
  const remoteText = await readWorkspace(handle)
  const localTs = await getSetting<number>(db, DOC_TS_KEY, 0)
  if (remoteText) {
    const remote = parseBackup(remoteText)
    if (chooseSource(localTs, remote.exportedAt) === 'remote') {
      await applyBackup(db, store, remote)
      await setSetting(db, DOC_TS_KEY, remote.exportedAt)
      useSync.setState({ lastSyncedAt: remote.exportedAt })
      return 'loaded'
    }
  }
  await push()
  return 'pushed'
}

/** Wire folder sync at boot. Reconnects silently if a handle was persisted and still permitted. */
export async function initFolderSync(atlasStore: AtlasStore, database: AtlasDb): Promise<void> {
  store = atlasStore
  db = database
  if (!FS_SUPPORTED) {
    useSync.setState({ status: 'unsupported' })
    return
  }
  // push to the folder on every change while linked
  store.subscribe(() => schedulePush())
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushSync)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushSync()
    })
  }

  const saved = await loadSyncHandle(database)
  if (!saved) {
    useSync.setState({ status: 'off' })
    return
  }
  handle = saved
  useSync.setState({ dirName: saved.name })
  // no prompt at boot — browsers require a gesture to re-grant a persisted handle
  if (await ensurePermission(saved, false)) {
    useSync.setState({ status: 'linked' })
    await reconcile()
  } else {
    useSync.setState({ status: 'needs-reconnect' })
  }
}

/** User picks a folder (gesture). Resolves the direction if the folder already has data. */
export async function linkFolder(): Promise<void> {
  if (!db || !store) return
  useSync.setState({ busy: true, error: null })
  try {
    const dir = await pickDirectory()
    if (!(await ensurePermission(dir, true))) {
      useSync.setState({ busy: false, error: 'Permission denied' })
      return
    }
    handle = dir
    const remoteText = await readWorkspace(dir)
    let loaded = false
    if (remoteText) {
      let stamp = 'a Folium workspace'
      try {
        stamp = 'a Folium workspace saved ' + new Date(parseBackup(remoteText).exportedAt).toLocaleString()
      } catch {
        /* fall through with generic label */
      }
      const loadIt = window.confirm(
        `This folder already contains ${stamp}.\n\nOK = load it onto this machine (replaces the boards here).\nCancel = keep this machine's boards and save them into the folder.`,
      )
      if (loadIt) {
        const remote = parseBackup(remoteText)
        await applyBackup(db, store, remote)
        await setSetting(db, DOC_TS_KEY, remote.exportedAt)
        loaded = true
      }
    }
    await saveSyncHandle(db, dir)
    useSync.setState({ status: 'linked', dirName: dir.name })
    if (loaded) {
      location.hash = ''
      location.reload()
      return
    }
    await push()
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') {
      // user cancelled the picker — no change
      useSync.setState({ busy: false })
      return
    }
    useSync.setState({ status: 'error', error: (err as Error).message })
  } finally {
    useSync.setState({ busy: false })
  }
}

/** Re-grant permission to a persisted handle after a reload (gesture). */
export async function reconnect(): Promise<void> {
  if (!handle) return
  useSync.setState({ busy: true, error: null })
  try {
    if (await ensurePermission(handle, true)) {
      useSync.setState({ status: 'linked' })
      const result = await reconcile()
      if (result === 'loaded') {
        location.hash = ''
        location.reload()
      }
    } else {
      useSync.setState({ error: 'Permission denied' })
    }
  } finally {
    useSync.setState({ busy: false })
  }
}

export async function syncNow(): Promise<void> {
  if (useSync.getState().status === 'linked') await push()
}

export async function unlinkFolder(): Promise<void> {
  if (!db) return
  if (pushTimer) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
  handle = null
  await clearSyncHandle(db)
  useSync.setState({ status: 'off', dirName: null, lastSyncedAt: null })
}
