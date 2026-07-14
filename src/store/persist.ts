import Dexie, { Table } from 'dexie'
import { nanoid } from 'nanoid'
import { DocState, Template } from '../model/types'
import { FoliumStore } from './store'

interface DocRow extends DocState {
  id: string
}

/** stored as ArrayBuffer — Blob instances don't survive structured clone everywhere */
interface BlobRow {
  id: string
  buf: ArrayBuffer
  type: string
}

interface SettingRow {
  key: string
  value: unknown
}

/** Persisted FileSystemDirectoryHandle for folder sync (structured-cloneable). */
interface HandleRow {
  key: string
  handle: FileSystemDirectoryHandle
}

/** NOTE: the Dexie database keeps its original 'atlasnote' id so pre-rebrand data survives. */
export class FoliumDb extends Dexie {
  doc!: Table<DocRow, string>
  blobs!: Table<BlobRow, string>
  templates!: Table<Template, string>
  settings!: Table<SettingRow, string>
  handles!: Table<HandleRow, string>

  constructor(name = 'atlasnote') {
    super(name)
    this.version(1).stores({
      doc: 'id',
      blobs: 'id',
      templates: 'id',
      settings: 'key',
    })
    // v2 adds the folder-sync directory handle store; existing tables carry forward
    this.version(2).stores({ handles: 'key' })
  }
}

export function openDb(name = 'atlasnote'): FoliumDb {
  return new FoliumDb(name)
}

export async function saveDoc(db: FoliumDb, doc: DocState): Promise<void> {
  await db.doc.put({ id: 'doc', ...doc })
}

export async function loadDoc(db: FoliumDb): Promise<DocState | null> {
  const row = await db.doc.get('doc')
  if (!row) return null
  const { id: _id, ...doc } = row
  return doc
}

function blobToBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer()
  // jsdom's Blob has no arrayBuffer(); FileReader works everywhere
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as ArrayBuffer)
    r.onerror = () => reject(r.error)
    r.readAsArrayBuffer(blob)
  })
}

export async function putBlob(db: FoliumDb, blob: Blob): Promise<string> {
  const id = nanoid(12)
  const buf = await blobToBuffer(blob)
  await db.blobs.put({ id, buf, type: blob.type })
  return id
}

export async function getBlob(db: FoliumDb, id: string): Promise<Blob | undefined> {
  const row = await db.blobs.get(id)
  if (!row) return undefined
  return new Blob([row.buf], { type: row.type })
}

export async function deleteBlob(db: FoliumDb, id: string): Promise<void> {
  await db.blobs.delete(id)
}

/** blobIds referenced by any card in the doc — live, in unsorted, or still in trash.
 *  Trashed cards still count so trashing alone never garbage-collects a blob. */
function cardBlobIds(state: DocState): Set<string> {
  const ids = new Set<string>()
  for (const card of Object.values(state.cards)) {
    const blobId = (card.content as { blobId?: string }).blobId
    if (blobId) ids.add(blobId)
  }
  return ids
}

/**
 * Which of `candidateIds` are still referenced: by any card (regardless of trashed state),
 * or textually present in a saved template's JSON. The template check is a conservative
 * substring scan rather than a structural walk of the snapshot, so it can only over-count
 * (never wrongly delete a blob a template actually embeds).
 */
export function computeReferencedBlobIds(
  state: DocState,
  templates: Template[],
  candidateIds: string[],
): Set<string> {
  const referenced = cardBlobIds(state)
  const remaining = candidateIds.filter((id) => !referenced.has(id))
  if (remaining.length && templates.length) {
    const templatesJson = JSON.stringify(templates)
    for (const id of remaining) {
      if (templatesJson.includes(id)) referenced.add(id)
    }
  }
  return referenced
}

/** Delete every stored blob not referenced by a card or a saved template. Returns the deleted ids. */
export async function gcBlobs(db: FoliumDb, state: DocState): Promise<string[]> {
  const [allIdsRaw, templates] = await Promise.all([
    db.blobs.toCollection().primaryKeys(),
    db.templates.toArray(),
  ])
  const allIds = allIdsRaw as unknown as string[]
  const referenced = computeReferencedBlobIds(state, templates, allIds)
  const orphaned = allIds.filter((id) => !referenced.has(id))
  await Promise.all(orphaned.map((id) => deleteBlob(db, id)))
  return orphaned
}

/**
 * Watches the store for permanent card deletions and garbage-collects orphaned blobs
 * afterward (fire-and-forget). A card vanishing from state.cards entirely — as opposed to
 * being merely marked trashed — is the generic signal for "permanently deleted", so this
 * covers emptyTrash and any future single-card permanent-delete path without needing to
 * know which action caused it. Returns an unsubscribe function.
 */
export function bindBlobGc(store: FoliumStore, db: FoliumDb): () => void {
  return store.subscribe((state, prevState) => {
    for (const id in prevState.cards) {
      if (!(id in state.cards)) {
        void gcBlobs(db, state)
        return
      }
    }
  })
}

export async function getSetting<T>(db: FoliumDb, key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return row ? (row.value as T) : fallback
}

export async function setSetting(db: FoliumDb, key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}

const SYNC_HANDLE_KEY = 'syncDir'

export async function saveSyncHandle(db: FoliumDb, handle: FileSystemDirectoryHandle): Promise<void> {
  await db.handles.put({ key: SYNC_HANDLE_KEY, handle })
}

export async function loadSyncHandle(db: FoliumDb): Promise<FileSystemDirectoryHandle | null> {
  const row = await db.handles.get(SYNC_HANDLE_KEY)
  return row?.handle ?? null
}

export async function clearSyncHandle(db: FoliumDb): Promise<void> {
  await db.handles.delete(SYNC_HANDLE_KEY)
}

export interface AutosaveHooks {
  /** Called after an autosaved write completes (IndexedDB write has landed). */
  onWrite?: (ts: number) => void
  /** When true at the moment a store change fires, that change is not scheduled for autosave
   *  (used to suppress the write+broadcast storm from a cross-tab sync reload). */
  isPaused?: () => boolean
}

/** Debounced autosave: persists the doc slice on every store change. Returns unsubscribe. */
export function bindAutosave(store: FoliumStore, db: FoliumDb, delay = 600, hooks: AutosaveHooks = {}): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const write = () => {
    const s = store.getState()
    void saveDoc(db, { rootId: s.rootId, boards: s.boards, cards: s.cards, lines: s.lines }).then(() => {
      hooks.onWrite?.(Date.now())
    })
  }
  const unsub = store.subscribe(() => {
    if (hooks.isPaused?.()) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      write()
    }, delay)
  })
  // flush a pending save when the tab hides/closes — a debounce alone loses the last edits
  const flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
      write()
    }
  }
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flush()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
  }
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    flush()
    unsub()
  }
}
