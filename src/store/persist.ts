import Dexie, { Table } from 'dexie'
import { nanoid } from 'nanoid'
import { DocState, Template } from '../model/types'
import { AtlasStore } from './store'

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

export class AtlasDb extends Dexie {
  doc!: Table<DocRow, string>
  blobs!: Table<BlobRow, string>
  templates!: Table<Template, string>
  settings!: Table<SettingRow, string>

  constructor(name = 'atlasnote') {
    super(name)
    this.version(1).stores({
      doc: 'id',
      blobs: 'id',
      templates: 'id',
      settings: 'key',
    })
  }
}

export function openDb(name = 'atlasnote'): AtlasDb {
  return new AtlasDb(name)
}

export async function saveDoc(db: AtlasDb, doc: DocState): Promise<void> {
  await db.doc.put({ id: 'doc', ...doc })
}

export async function loadDoc(db: AtlasDb): Promise<DocState | null> {
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

export async function putBlob(db: AtlasDb, blob: Blob): Promise<string> {
  const id = nanoid(12)
  const buf = await blobToBuffer(blob)
  await db.blobs.put({ id, buf, type: blob.type })
  return id
}

export async function getBlob(db: AtlasDb, id: string): Promise<Blob | undefined> {
  const row = await db.blobs.get(id)
  if (!row) return undefined
  return new Blob([row.buf], { type: row.type })
}

export async function deleteBlob(db: AtlasDb, id: string): Promise<void> {
  await db.blobs.delete(id)
}

export async function getSetting<T>(db: AtlasDb, key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return row ? (row.value as T) : fallback
}

export async function setSetting(db: AtlasDb, key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}

/** Debounced autosave: persists the doc slice on every store change. Returns unsubscribe. */
export function bindAutosave(store: AtlasStore, db: AtlasDb, delay = 600): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const write = () => {
    const s = store.getState()
    void saveDoc(db, { rootId: s.rootId, boards: s.boards, cards: s.cards, lines: s.lines })
  }
  const unsub = store.subscribe(() => {
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
