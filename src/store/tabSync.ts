/**
 * Cross-tab sync: opening Folium in two tabs used to silently corrupt data — each tab
 * autosaved its own stale copy of the doc, and the last writer won without the other tab
 * ever noticing. This broadcasts a signal over BroadcastChannel whenever a tab finishes an
 * autosave write, and every other tab reloads the doc from IndexedDB in response — unless
 * that tab has unsaved local edits newer than the write it heard about, in which case it
 * keeps its own (newer) state and will broadcast it in turn once it autosaves. Latest edit
 * wins, matching the folder-sync merge philosophy in folderSync.ts.
 */
import { FoliumDb, loadDoc } from './persist'
import { FoliumStore } from './store'

export const CHANNEL_NAME = 'folium-tab-sync'

interface DocWrittenMessage {
  type: 'doc-written'
  ts: number
  tabId: string
}

function hasBroadcastChannel(): boolean {
  return typeof BroadcastChannel !== 'undefined'
}

export interface TabSync {
  /** Call after this tab's autosave write completes, with the write's timestamp. */
  onWrite: (ts: number) => void
  /** True while a cross-tab reload is being applied to the store (autosave should skip it). */
  isPaused: () => boolean
  dispose: () => void
}

/** No-op stand-in for environments without BroadcastChannel (feature-detected, silent). */
const noopTabSync: TabSync = {
  onWrite: () => {},
  isPaused: () => false,
  dispose: () => {},
}

/**
 * Wires up cross-tab sync for `store`/`db`. Returns hooks meant to be passed straight into
 * `bindAutosave`'s `onWrite`/`isPaused`, plus a `dispose` to tear the channel down.
 */
export function createTabSync(store: FoliumStore, db: FoliumDb): TabSync {
  if (!hasBroadcastChannel()) return noopTabSync

  const tabId = crypto.randomUUID()
  const channel = new BroadcastChannel(CHANNEL_NAME)
  let applying = false
  let lastLocalEditTs = 0

  // Track the most recent local edit so an incoming sync message can tell whether this tab's
  // unsaved changes are newer than what the other tab just wrote. Skipped while we're applying
  // a remote reload — that's not a local edit, it's the sync itself.
  const unsubEdit = store.subscribe(() => {
    if (applying) return
    lastLocalEditTs = Date.now()
  })

  channel.onmessage = (e: MessageEvent) => {
    const msg = e.data as DocWrittenMessage | undefined
    if (!msg || msg.type !== 'doc-written' || msg.tabId === tabId) return
    if (msg.ts <= lastLocalEditTs) return // our unsaved local edits are newer — latest edit wins, keep them
    void applyRemote()
  }

  async function applyRemote(): Promise<void> {
    const doc = await loadDoc(db)
    if (!doc) return
    applying = true
    try {
      store.getState().hydrate(doc)
    } finally {
      applying = false
    }
  }

  function onWrite(ts: number): void {
    channel.postMessage({ type: 'doc-written', ts, tabId } satisfies DocWrittenMessage)
  }

  function isPaused(): boolean {
    return applying
  }

  function dispose(): void {
    unsubEdit()
    channel.close()
  }

  return { onWrite, isPaused, dispose }
}
