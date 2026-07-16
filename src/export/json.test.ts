import { describe, it, expect } from 'vitest'
import { nanoid } from 'nanoid'
import { createFoliumStore } from '../store/store'
import { openDb } from '../store/persist'
import { Template } from '../model/types'
import { applyBackup, Backup } from './json'

function docOf(store: ReturnType<typeof createFoliumStore>) {
  const s = store.getState()
  return { rootId: s.rootId, boards: s.boards, cards: s.cards, lines: s.lines }
}

function makeBackup(overrides: Partial<Backup> = {}): Backup {
  return {
    app: 'folium',
    version: 1,
    exportedAt: Date.now(),
    doc: docOf(createFoliumStore()),
    blobs: [],
    templates: [],
    settings: { userName: 'tester' },
    ...overrides,
  }
}

describe('applyBackup: transactional blob import (regression: corrupt blob must not wipe local blobs)', () => {
  it('throws on a corrupt blob b64 and leaves pre-existing blobs untouched', async () => {
    const db = openDb('test-' + nanoid(6))
    const store = createFoliumStore()
    await db.blobs.put({ id: 'existing', type: 'image/png', buf: new Uint8Array([1, 2, 3]).buffer })

    const backup = makeBackup({
      blobs: [{ id: 'bad', type: 'image/png', b64: '!!!not-base64!!!' }],
    })

    await expect(applyBackup(db, store, backup)).rejects.toThrow()

    expect(await db.blobs.count()).toBe(1)
    expect(await db.blobs.get('existing')).toBeDefined()
    expect(await db.blobs.get('bad')).toBeUndefined()
  })

  it('replaces blobs, templates and doc on a valid import', async () => {
    const db = openDb('test-' + nanoid(6))
    const store = createFoliumStore()
    await db.blobs.put({ id: 'stale-blob', type: 'text/plain', buf: new Uint8Array([9]).buffer })
    const staleTemplate: Template = {
      id: 'stale-template',
      name: 'Stale',
      category: 'misc',
      description: '',
      builtIn: false,
      snapshot: { rootBoardId: 'b', boards: [], cards: [], lines: [] },
    }
    await db.templates.put(staleTemplate)

    const newTemplate: Template = { ...staleTemplate, id: 'new-template', name: 'New' }
    const backup = makeBackup({
      blobs: [{ id: 'new-blob', type: 'text/plain', b64: btoa('hello') }],
      templates: [newTemplate],
    })

    await applyBackup(db, store, backup)

    expect(await db.blobs.get('stale-blob')).toBeUndefined()
    const row = await db.blobs.get('new-blob')
    expect(row).toBeDefined()
    // compared as plain arrays: fake-indexeddb's structured clone can hand back a typed array
    // from a different realm than this test's, which toEqual treats as unequal even when the
    // byte values match
    expect(Array.from(new Uint8Array(row!.buf))).toEqual(Array.from(new TextEncoder().encode('hello')))

    expect(await db.templates.get('stale-template')).toBeUndefined()
    expect(await db.templates.get('new-template')).toBeDefined()

    expect(docOf(store)).toEqual(backup.doc)
  })
})

describe('applyBackup: undo stack (regression: sync/import must not pollute undo)', () => {
  it('clears undo history after hydrating from a backup', async () => {
    const db = openDb('test-' + nanoid(6))
    const store = createFoliumStore()
    store.getState().addCard(store.getState().rootId, 'note', { x: 1, y: 1 })
    expect(store.temporal.getState().pastStates.length).toBeGreaterThan(0)

    const backup = makeBackup()
    await applyBackup(db, store, backup)

    expect(store.temporal.getState().pastStates.length).toBe(0)
  })
})
