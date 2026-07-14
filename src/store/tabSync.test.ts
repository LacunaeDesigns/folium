import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nanoid } from 'nanoid'
import { createFoliumStore } from './store'
import { openDb, saveDoc, loadDoc } from './persist'
import { createTabSync } from './tabSync'

/** wait a few event-loop turns for a fire-and-forget async op (loadDoc + hydrate) to settle */
async function flushAsync(turns = 5): Promise<void> {
  for (let i = 0; i < turns; i++) {
    await new Promise((r) => setTimeout(r, 0))
  }
}

/**
 * Faithful-enough stand-in for BroadcastChannel: routes postMessage to every other open
 * channel sharing the same name, and (like the real thing) never delivers a message back to
 * the sender. Delivery is synchronous, which keeps tests deterministic.
 */
class FakeBroadcastChannel {
  name: string
  onmessage: ((e: MessageEvent) => void) | null = null
  static registry = new Map<string, Set<FakeBroadcastChannel>>()

  constructor(name: string) {
    this.name = name
    const set = FakeBroadcastChannel.registry.get(name) ?? new Set()
    set.add(this)
    FakeBroadcastChannel.registry.set(name, set)
  }

  postMessage(data: unknown): void {
    const set = FakeBroadcastChannel.registry.get(this.name)
    if (!set) return
    for (const ch of set) {
      if (ch === this) continue
      ch.onmessage?.({ data } as MessageEvent)
    }
  }

  close(): void {
    FakeBroadcastChannel.registry.get(this.name)?.delete(this)
  }
}

/** A broken/naive channel that (unlike the real API) *does* echo back to the sender —
 *  used to prove tabSync's own tabId filter, not just the channel's self-suppression. */
class EchoingBroadcastChannel extends FakeBroadcastChannel {
  postMessage(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent)
    super.postMessage(data)
  }
}

function docOf(store: ReturnType<typeof createFoliumStore>) {
  const s = store.getState()
  return { rootId: s.rootId, boards: s.boards, cards: s.cards, lines: s.lines }
}

const realBroadcastChannel = globalThis.BroadcastChannel

beforeEach(() => {
  FakeBroadcastChannel.registry.clear()
  ;(globalThis as { BroadcastChannel: unknown }).BroadcastChannel = FakeBroadcastChannel
})

afterEach(() => {
  ;(globalThis as { BroadcastChannel: unknown }).BroadcastChannel = realBroadcastChannel
  vi.restoreAllMocks()
})

describe('createTabSync: feature detection', () => {
  it('no-ops silently when BroadcastChannel is unavailable', () => {
    ;(globalThis as { BroadcastChannel: unknown }).BroadcastChannel = undefined
    const db = openDb('test-' + nanoid(6))
    const store = createFoliumStore()
    const sync = createTabSync(store, db)
    expect(sync.isPaused()).toBe(false)
    expect(() => sync.onWrite(Date.now())).not.toThrow()
    expect(() => sync.dispose()).not.toThrow()
  })
})

describe('createTabSync: message routing between two fake tabs', () => {
  it('reloads a receiving tab from IndexedDB after another tab reports a write', async () => {
    const dbName = 'test-' + nanoid(6)
    const dbA = openDb(dbName)
    const dbB = openDb(dbName)
    const storeA = createFoliumStore()
    const storeB = createFoliumStore()
    const syncA = createTabSync(storeA, dbA)
    const syncB = createTabSync(storeB, dbB)

    // Tab A makes an edit and "autosaves" it (what bindAutosave would do on write completion).
    const cardId = storeA.getState().addCard(storeA.getState().rootId, 'note', { x: 1, y: 2 })
    await saveDoc(dbA, docOf(storeA))
    syncA.onWrite(Date.now())

    await flushAsync()

    expect(storeB.getState().cards[cardId]).toBeDefined()
    expect(await loadDoc(dbB)).toEqual(docOf(storeA))

    syncA.dispose()
    syncB.dispose()
  })

  it('a genuine conflict resolves latest-edit-wins: a newer local edit is not clobbered by an older broadcast', async () => {
    const dbName = 'test-' + nanoid(6)
    const dbA = openDb(dbName)
    const dbB = openDb(dbName)
    const storeA = createFoliumStore()
    const storeB = createFoliumStore()
    const syncA = createTabSync(storeA, dbA)
    const syncB = createTabSync(storeB, dbB)

    // A writes first, at an earlier timestamp.
    storeA.getState().addCard(storeA.getState().rootId, 'note', { x: 1, y: 2 })
    await saveDoc(dbA, docOf(storeA))
    const earlierTs = 1000

    // B has since made its own (newer) local edit that hasn't been saved/broadcast yet.
    vi.spyOn(Date, 'now').mockReturnValue(2000)
    const localCardId = storeB.getState().addCard(storeB.getState().rootId, 'note', { x: 9, y: 9 })
    vi.restoreAllMocks()

    // A's stale write arrives at B after B's local edit.
    syncA.onWrite(earlierTs)
    await flushAsync()

    // B keeps its own newer state instead of reloading A's older doc.
    expect(storeB.getState().cards[localCardId]).toBeDefined()

    syncA.dispose()
    syncB.dispose()
  })
})

describe('createTabSync: echo suppression', () => {
  it('ignores a doc-written message that carries this tab’s own id', async () => {
    ;(globalThis as { BroadcastChannel: unknown }).BroadcastChannel = EchoingBroadcastChannel
    const db = openDb('test-' + nanoid(6))
    const store = createFoliumStore()
    const sync = createTabSync(store, db)

    const cardId = store.getState().addCard(store.getState().rootId, 'note', { x: 0, y: 0 })
    await saveDoc(db, docOf(store))

    // Even though EchoingBroadcastChannel delivers the message back to the sender,
    // tabSync must recognize its own tabId and ignore it — isPaused should never flip true.
    expect(sync.isPaused()).toBe(false)
    sync.onWrite(Date.now())
    await flushAsync()
    expect(sync.isPaused()).toBe(false)
    expect(store.getState().cards[cardId]).toBeDefined()

    sync.dispose()
  })
})

describe('createTabSync: pause during apply', () => {
  it('flags isPaused while a remote reload is being applied to the store', async () => {
    const dbName = 'test-' + nanoid(6)
    const dbA = openDb(dbName)
    const dbB = openDb(dbName)
    const storeA = createFoliumStore()
    const storeB = createFoliumStore()
    const syncA = createTabSync(storeA, dbA)
    const syncB = createTabSync(storeB, dbB)

    storeA.getState().addCard(storeA.getState().rootId, 'note', { x: 1, y: 2 })
    await saveDoc(dbA, docOf(storeA))

    let pausedDuringHydrate = false
    storeB.subscribe(() => {
      if (syncB.isPaused()) pausedDuringHydrate = true
    })

    syncA.onWrite(Date.now())
    await flushAsync()

    expect(pausedDuringHydrate).toBe(true)
    // pause is released once the reload finishes
    expect(syncB.isPaused()).toBe(false)

    syncA.dispose()
    syncB.dispose()
  })

  it('a store change applied while paused is not counted as a local edit (no rebroadcast storm)', async () => {
    const dbName = 'test-' + nanoid(6)
    const dbA = openDb(dbName)
    const dbB = openDb(dbName)
    const storeA = createFoliumStore()
    const storeB = createFoliumStore()
    const syncA = createTabSync(storeA, dbA)
    const syncB = createTabSync(storeB, dbB)

    storeA.getState().addCard(storeA.getState().rootId, 'note', { x: 1, y: 2 })
    await saveDoc(dbA, docOf(storeA))

    const firstWriteTs = 5000
    syncA.onWrite(firstWriteTs)
    await flushAsync()

    // A stale re-broadcast of the *same* write (older/equal ts than what B just applied as
    // its own "edit") must not be treated as a newer local edit that blocks a later, genuinely
    // newer sync — i.e. applying the reload didn't bump B's lastLocalEditTs.
    storeA.getState().addCard(storeA.getState().rootId, 'note', { x: 3, y: 4 })
    await saveDoc(dbA, docOf(storeA))
    const secondWriteTs = firstWriteTs + 1
    syncA.onWrite(secondWriteTs)
    await flushAsync()

    expect(await loadDoc(dbB)).toEqual(docOf(storeA))

    syncA.dispose()
    syncB.dispose()
  })
})
