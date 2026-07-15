import { describe, it, expect, vi, afterEach } from 'vitest'
import { nanoid } from 'nanoid'
import { createFoliumStore } from './store'
import { openDb } from './persist'
import * as persist from './persist'
import * as folderSync from './folderSync'
import { writeWorkspace, WORKSPACE_FILE } from './folderSync'
import { exportBackup } from '../export/json'
import { initFolderSync, useSync, syncNow, linkFolder, unlinkFolder } from './sync'

// FS_SUPPORTED is `typeof window.showDirectoryPicker === 'function'`, which jsdom never has —
// stub it on so these tests can exercise the 'linked' path (a real browser would supply it).
vi.mock('./folderSync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./folderSync')>()
  return { ...actual, FS_SUPPORTED: true }
})

// schedulePush() arms a real 1500ms setTimeout on every store change; sync.ts holds db/store/
// handle/timer as module singletons, so a stray timer from one test could fire against the next
// test's state. unlinkFolder() cancels any pending timer — real cleanup, not a test-only shim.
afterEach(async () => {
  await unlinkFolder()
  vi.restoreAllMocks()
})

/** A real FileSystemDirectoryHandle clones fine in IndexedDB (browsers special-case it); our
 *  in-memory test double can't, since it carries functions. Stub the persistence boundary so
 *  tests exercise sync.ts's real decision logic without fighting fake-indexeddb's clone check. */
function stubHandlePersistence(dir: FileSystemDirectoryHandle) {
  vi.spyOn(persist, 'loadSyncHandle').mockResolvedValue(dir)
  vi.spyOn(persist, 'saveSyncHandle').mockResolvedValue(undefined)
}

/** Minimal in-memory stand-in for a FileSystemDirectoryHandle, shared like a cloud-synced folder. */
function fakeDir() {
  const files: Record<string, string> = {}
  return {
    name: 'fake-folder',
    files,
    async getFileHandle(name: string, opts?: { create?: boolean }) {
      if (!(name in files) && !opts?.create) {
        throw new DOMException('not found', 'NotFoundError')
      }
      return {
        async createWritable() {
          return {
            async write(text: string) {
              files[name] = text
            },
            async close() {},
          }
        },
        async getFile() {
          return { text: async () => files[name] }
        },
      }
    },
    async queryPermission() {
      return 'granted' as const
    },
    async requestPermission() {
      return 'granted' as const
    },
  } as unknown as FileSystemDirectoryHandle & { files: Record<string, string> }
}

describe('push conflict guard', () => {
  it('does not clobber a newer workspace written by another machine', async () => {
    const dir = fakeDir()
    const db = openDb('test-' + nanoid(6))
    const store = createFoliumStore()
    stubHandlePersistence(dir)
    await initFolderSync(store, db)
    expect(useSync.getState().status).toBe('linked')

    // Another machine synced something newer into the shared folder after our boot reconcile.
    const remoteJson = await exportBackup(db, docOf(store), 'machine-b')
    const remote = { ...JSON.parse(remoteJson), exportedAt: Date.now() + 10_000 }
    await writeWorkspace(dir, JSON.stringify(remote))

    // We edit locally, unaware the folder has moved on, then a sync fires.
    store.getState().addCard(store.getState().rootId, 'note', { x: 1, y: 1 })
    await syncNow()

    expect(dir.files[WORKSPACE_FILE]).toBe(JSON.stringify(remote))
    expect(useSync.getState().status).toBe('conflict')
  })

  it('pushes normally when the folder has not moved on', async () => {
    const dir = fakeDir()
    const db = openDb('test-' + nanoid(6))
    const store = createFoliumStore()
    stubHandlePersistence(dir)
    await initFolderSync(store, db)

    store.getState().addCard(store.getState().rootId, 'note', { x: 1, y: 1 })
    await syncNow()

    const written = JSON.parse(dir.files[WORKSPACE_FILE])
    expect(written.doc.cards).toEqual(store.getState().cards)
    expect(useSync.getState().status).toBe('linked')
  })
})

describe('linkFolder — keep local, overwrite the folder', () => {
  it('does not raise a false conflict when the user chooses to keep local boards', async () => {
    const dir = fakeDir()
    const db = openDb('test-' + nanoid(6))
    const store = createFoliumStore()
    store.getState().addCard(store.getState().rootId, 'note', { x: 9, y: 9 })

    // The folder already holds an older workspace from a previous device — this machine has
    // never synced before, so it has no DOC_TS_KEY of its own yet.
    const olderJson = await exportBackup(db, docOf(createFoliumStore()), 'other-machine')
    const older = { ...JSON.parse(olderJson), exportedAt: Date.now() - 100_000 }
    await writeWorkspace(dir, JSON.stringify(older))

    vi.spyOn(persist, 'saveSyncHandle').mockResolvedValue(undefined)
    vi.spyOn(folderSync, 'pickDirectory').mockResolvedValue(dir)
    vi.spyOn(window, 'confirm').mockReturnValue(false) // Cancel = keep local, overwrite the folder

    await initFolderSync(store, db) // no handle saved yet -> status starts 'off'
    await linkFolder()

    expect(useSync.getState().status).toBe('linked')
    const written = JSON.parse(dir.files[WORKSPACE_FILE])
    expect(written.doc.cards).toEqual(store.getState().cards)
  })
})

function docOf(store: ReturnType<typeof createFoliumStore>) {
  const s = store.getState()
  return { rootId: s.rootId, boards: s.boards, cards: s.cards, lines: s.lines }
}
