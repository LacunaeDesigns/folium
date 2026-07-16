import Dexie, { Table } from 'dexie'
import { nanoid } from 'nanoid'
import { Card, DocState, Template } from '../model/types'
import { LEGACY_WELCOME_SNIPPET, welcomeNoteDoc } from './welcome'
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

/** Snapshot metadata — small rows so listing history never loads doc payloads. */
export interface SnapshotMetaRow {
  id: string
  ts: number
  nBoards: number
  nCards: number
}

/** Snapshot payload, fetched individually on restore. */
export interface SnapshotDocRow {
  id: string
  doc: DocState
}

/** NOTE: the Dexie database keeps its original 'atlasnote' id so pre-rebrand data survives. */
export class FoliumDb extends Dexie {
  doc!: Table<DocRow, string>
  blobs!: Table<BlobRow, string>
  templates!: Table<Template, string>
  settings!: Table<SettingRow, string>
  handles!: Table<HandleRow, string>
  snapshots!: Table<SnapshotMetaRow, string>
  snapshotDocs!: Table<SnapshotDocRow, string>

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
    // v3 adds local version snapshots: meta (indexed by ts) split from payloads so the
    // Version history list stays cheap to load
    this.version(3).stores({ snapshots: 'id, ts', snapshotDocs: 'id' })
  }
}

export function openDb(name = 'atlasnote'): FoliumDb {
  return new FoliumDb(name)
}

export async function saveDoc(db: FoliumDb, doc: DocState): Promise<void> {
  await db.doc.put({ id: 'doc', ...doc })
}

/* Pre-rebrand (AtlasNote-era) workspaces were seeded with a welcome image
 * pointing at an asset the 2026-07-13 rebrand deleted, and a welcome note
 * naming the old brand; the cards are data, so those docs stay stale forever
 * unless healed on load. The note is only replaced when it still contains the
 * legacy seed sentence verbatim — an edited note is user content and is left
 * alone. */
const LEGACY_ASSET_URLS: Record<string, string> = {
  '/brand/welcome-moodboard.png': '/brand/welcome.svg',
}

function tipTapText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as { text?: string; content?: unknown[] }
  const own = typeof n.text === 'string' ? n.text : ''
  const kids = Array.isArray(n.content) ? n.content.map(tipTapText).join(' ') : ''
  return own + kids
}

export function healLegacyAssetUrls(doc: DocState): DocState {
  let cards: DocState['cards'] | null = null
  for (const [id, card] of Object.entries(doc.cards)) {
    if (card.type === 'image') {
      const content = card.content as { url?: string }
      const next = content.url ? LEGACY_ASSET_URLS[content.url] : undefined
      if (!next) continue
      cards = cards ?? { ...doc.cards }
      cards[id] = { ...card, content: { ...content, url: next } as Card['content'] }
    } else if (card.type === 'note') {
      const content = card.content as { doc?: unknown }
      if (!tipTapText(content.doc).includes(LEGACY_WELCOME_SNIPPET)) continue
      cards = cards ?? { ...doc.cards }
      cards[id] = { ...card, content: { ...content, doc: welcomeNoteDoc() } as Card['content'] }
    }
  }
  return cards ? { ...doc, cards } : doc
}

export async function loadDoc(db: FoliumDb): Promise<DocState | null> {
  const row = await db.doc.get('doc')
  if (!row) return null
  const { id: _id, ...doc } = row
  return healLegacyAssetUrls(doc)
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
  b64Cache.delete(id)
  await db.blobs.delete(id)
}

const b64Cache = new Map<string, string>()

let currentAutosaveFlush: (() => void) | null = null

/** Base64 of a stored blob's bytes, cached by blob id. Folder sync re-exports every
 *  blob on every push, and blob ids are content-stable (a new id is minted whenever
 *  a blob's bytes change), so caching here turns a repeated full-image re-encode
 *  into a one-time cost per image. */
export function blobToB64Cached(id: string, buf: ArrayBuffer): string {
  let b64 = b64Cache.get(id)
  if (!b64) {
    const bytes = new Uint8Array(buf)
    let bin = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    b64 = btoa(bin)
    b64Cache.set(id, b64)
  }
  return b64
}

/** blobIds referenced by any card across any of the given doc-slice states (union) — live,
 *  in unsorted, still in trash, or only reachable via a zundo undo/redo entry. Trashed cards
 *  still count so trashing alone never garbage-collects a blob; including past/future states
 *  means a blob a Ctrl+Z could still restore is never collected out from under it. */
function cardBlobIds(states: readonly Partial<DocState>[]): Set<string> {
  const ids = new Set<string>()
  for (const state of states) {
    if (!state.cards) continue
    for (const card of Object.values(state.cards)) {
      const blobId = (card.content as { blobId?: string }).blobId
      if (blobId) ids.add(blobId)
    }
  }
  return ids
}

/**
 * Which of `candidateIds` are still referenced: by any card in any of `states` (regardless of
 * trashed state), or textually present in a saved template's JSON. The template check is a
 * conservative substring scan rather than a structural walk of the snapshot, so it can only
 * over-count (never wrongly delete a blob a template actually embeds).
 */
export function computeReferencedBlobIds(
  states: readonly Partial<DocState>[],
  templates: Template[],
  candidateIds: string[],
): Set<string> {
  const referenced = cardBlobIds(states)
  const remaining = candidateIds.filter((id) => !referenced.has(id))
  if (remaining.length && templates.length) {
    const templatesJson = JSON.stringify(templates)
    for (const id of remaining) {
      if (templatesJson.includes(id)) referenced.add(id)
    }
  }
  return referenced
}

/** Delete every stored blob not referenced by a card (in any of `states`), a saved template, or
 *  a retained version snapshot. Pass the current doc plus zundo's past/future states so a blob
 *  still reachable via undo/redo is never collected. Returns the deleted ids. */
export async function gcBlobs(db: FoliumDb, states: readonly Partial<DocState>[]): Promise<string[]> {
  const [allIdsRaw, templates, snapshotDocs] = await Promise.all([
    db.blobs.toCollection().primaryKeys(),
    db.templates.toArray(),
    db.snapshotDocs.toArray(),
  ])
  const allIds = allIdsRaw as unknown as string[]
  // retained version snapshots count as referencers — restoring one must find its images
  const referenced = computeReferencedBlobIds(
    [...states, ...snapshotDocs.map((r) => r.doc)],
    templates,
    allIds,
  )
  const orphaned = allIds.filter((id) => !referenced.has(id))
  await Promise.all(orphaned.map((id) => deleteBlob(db, id)))
  return orphaned
}

/**
 * Watches the store for permanent card deletions and garbage-collects orphaned blobs
 * afterward (fire-and-forget). A card vanishing from state.cards entirely — as opposed to
 * being merely marked trashed — is the generic signal for "permanently deleted", so this
 * covers emptyTrash and any future single-card permanent-delete path without needing to
 * know which action caused it. GC scans the current state plus zundo's undo/redo stacks, so a
 * blob still reachable via Ctrl+Z after the deletion survives until that undo entry falls off
 * the stack or the page reloads. Returns an unsubscribe function.
 */
export function bindBlobGc(store: FoliumStore, db: FoliumDb): () => void {
  return store.subscribe((state, prevState) => {
    for (const id in prevState.cards) {
      if (!(id in state.cards)) {
        const temporal = store.temporal.getState()
        void gcBlobs(db, [state, ...temporal.pastStates, ...temporal.futureStates])
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
  currentAutosaveFlush = flush
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
    if (currentAutosaveFlush === flush) currentAutosaveFlush = null
  }
}

/** Force the pending debounced autosave write to happen immediately (used by Ctrl+S).
 *  No-op if nothing is bound yet or nothing is currently pending. */
export function flushAutosave(): void {
  currentAutosaveFlush?.()
}
