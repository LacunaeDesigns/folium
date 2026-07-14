import { DocState, Template } from '../model/types'
import { FoliumDb, saveDoc } from '../store/persist'
import { FoliumStore } from '../store/store'

interface BackupBlob {
  id: string
  type: string
  b64: string
}

export interface Backup {
  app: string
  version: 1
  exportedAt: number
  doc: DocState
  blobs: BackupBlob[]
  templates: Template[]
  settings: { userName: string }
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

export async function exportBackup(db: FoliumDb, doc: DocState, userName: string): Promise<string> {
  const blobRows = await db.blobs.toArray()
  const templates = await db.templates.toArray()
  const backup: Backup = {
    app: 'folium',
    version: 1,
    exportedAt: Date.now(),
    doc,
    blobs: blobRows.map((r) => ({ id: r.id, type: r.type, b64: bufToB64(r.buf) })),
    templates,
    settings: { userName },
  }
  return JSON.stringify(backup)
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/** Parse + validate a backup. Throws on anything malformed — never returns partial. */
export function parseBackup(text: string): Backup {
  const backup = JSON.parse(text) as Backup
  if (
    !['folium', 'looseleaf', 'atlasnote'].includes(backup.app) || // accept prior brand ids
    !backup.doc?.rootId ||
    !isRecord(backup.doc.boards) ||
    !isRecord(backup.doc.cards) ||
    !isRecord(backup.doc.lines) ||
    !backup.doc.boards[backup.doc.rootId] ||
    !Array.isArray(backup.blobs)
  ) {
    throw new Error('Not a valid Folium backup file')
  }
  return backup
}

/** Write a (validated) backup into the db + store, replacing everything. */
export async function applyBackup(db: FoliumDb, store: FoliumStore, backup: Backup): Promise<void> {
  await db.blobs.clear()
  await db.blobs.bulkPut(backup.blobs.map((b) => ({ id: b.id, type: b.type, buf: b64ToBuf(b.b64) })))
  await db.templates.clear()
  if (backup.templates?.length) await db.templates.bulkPut(backup.templates)
  // persist the doc NOW — callers may reload immediately, before autosave's debounce fires
  await saveDoc(db, backup.doc)
  store.getState().hydrate(backup.doc)
}

/** Replaces the entire document, blobs and user templates from backup text. */
export async function importBackup(db: FoliumDb, store: FoliumStore, text: string): Promise<void> {
  // validate BEFORE touching the db — a rejected import must leave everything intact
  await applyBackup(db, store, parseBackup(text))
}
