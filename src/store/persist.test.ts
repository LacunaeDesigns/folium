import { describe, it, expect } from 'vitest'
import { nanoid } from 'nanoid'
import { createAtlasStore } from './store'
import { openDb, saveDoc, loadDoc, putBlob, getBlob, deleteBlob } from './persist'

function docOf(store: ReturnType<typeof createAtlasStore>) {
  const s = store.getState()
  return { rootId: s.rootId, boards: s.boards, cards: s.cards, lines: s.lines }
}

describe('document persistence', () => {
  it('round-trips a document through IndexedDB', async () => {
    const db = openDb('test-' + nanoid(6))
    const store = createAtlasStore()
    const st = store.getState()
    const { boardId } = st.createBoard(st.rootId, 'Work')
    const a = store.getState().addCard(boardId, 'note', { x: 5, y: 6 })
    const b = store.getState().addCard(boardId, 'note', { x: 7, y: 8 })
    store.getState().addLine(boardId, { cardId: a }, { cardId: b })

    await saveDoc(db, docOf(store))
    const loaded = await loadDoc(db)

    expect(loaded).toEqual(docOf(store))
  })

  it('returns null when nothing was saved', async () => {
    const db = openDb('test-' + nanoid(6))
    expect(await loadDoc(db)).toBeNull()
  })

  it('save is a full replace — deleted entities disappear', async () => {
    const db = openDb('test-' + nanoid(6))
    const store = createAtlasStore()
    const id = store.getState().addCard(store.getState().rootId, 'note', { x: 0, y: 0 })
    await saveDoc(db, docOf(store))
    store.getState().trashCards([id])
    store.getState().emptyTrash()
    await saveDoc(db, docOf(store))
    const loaded = await loadDoc(db)
    expect(loaded!.cards[id]).toBeUndefined()
  })
})

/** fake-indexeddb clones lack Blob.text(); FileReader works in both jsdom and browsers */
function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsText(blob)
  })
}

describe('blob storage', () => {
  it('round-trips a blob', async () => {
    const db = openDb('test-' + nanoid(6))
    const id = await putBlob(db, new Blob(['hello atlas'], { type: 'text/plain' }))
    const back = await getBlob(db, id)
    expect(back).toBeDefined()
    expect(await readBlobText(back!)).toBe('hello atlas')
  })

  it('deleteBlob removes it', async () => {
    const db = openDb('test-' + nanoid(6))
    const id = await putBlob(db, new Blob(['x']))
    await deleteBlob(db, id)
    expect(await getBlob(db, id)).toBeUndefined()
  })
})

describe('backup import persistence (regression: review finding #1)', () => {
  it('importBackup persists the imported doc so a reload does not revert it', async () => {
    const { exportBackup, importBackup } = await import('../export/json')
    const { createAtlasStore } = await import('./store')

    // source doc with a card
    const src = createAtlasStore()
    src.getState().addCard(src.getState().rootId, 'sticky', { x: 1, y: 2, content: { text: 'from backup' } as never })
    const srcDoc = {
      rootId: src.getState().rootId,
      boards: src.getState().boards,
      cards: src.getState().cards,
      lines: src.getState().lines,
    }
    const dbA = openDb('test-' + nanoid(6))
    const json = await exportBackup(dbA, srcDoc, 'You')

    // target: different db + store; import, then simulate reload via loadDoc
    const dbB = openDb('test-' + nanoid(6))
    const target = createAtlasStore()
    await importBackup(dbB, target, json)
    const reloaded = await loadDoc(dbB)
    expect(reloaded).not.toBeNull()
    expect(reloaded!.rootId).toBe(srcDoc.rootId)
    expect(Object.keys(reloaded!.cards)).toHaveLength(1)
  })

  it('importBackup rejects backups missing cards/lines without touching the db', async () => {
    const { importBackup } = await import('../export/json')
    const { createAtlasStore } = await import('./store')
    const db = openDb('test-' + nanoid(6))
    await putBlob(db, new Blob(['keep me']))
    const store = createAtlasStore()
    const bad = JSON.stringify({ app: 'atlasnote', version: 1, doc: { rootId: 'x', boards: { x: {} } }, blobs: [], templates: [] })
    await expect(importBackup(db, store, bad)).rejects.toThrow()
    expect(await db.blobs.count()).toBe(1) // blobs untouched on rejection
  })
})
