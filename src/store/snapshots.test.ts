import { describe, it, expect } from 'vitest'
import { nanoid } from 'nanoid'
import { loadDoc, openDb } from './persist'
import { createFoliumStore } from './store'
import {
  SNAPSHOT_INTERVAL_MS,
  computeRetainedIds,
  listSnapshots,
  maybeSnapshot,
  restoreSnapshot,
  writeSnapshot,
} from './snapshots'

function docOf(store: ReturnType<typeof createFoliumStore>) {
  const s = store.getState()
  return { rootId: s.rootId, boards: s.boards, cards: s.cards, lines: s.lines }
}

const HOUR = 3600_000
const DAY = 24 * HOUR

describe('computeRetainedIds', () => {
  it('keeps everything from the last hour', () => {
    const now = 100 * DAY
    const entries = [
      { id: 'a', ts: now - 5 * 60_000 },
      { id: 'b', ts: now - 30 * 60_000 },
      { id: 'c', ts: now - 59 * 60_000 },
    ]
    expect(computeRetainedIds(entries, now)).toEqual(new Set(['a', 'b', 'c']))
  })

  it('keeps only the newest snapshot per hour bucket inside 24h', () => {
    const now = 100 * DAY
    const base = now - 3 * HOUR // same hour bucket, both older than 1h
    const entries = [
      { id: 'newer', ts: base + 20 * 60_000 },
      { id: 'older', ts: base + 10 * 60_000 },
    ]
    expect(computeRetainedIds(entries, now)).toEqual(new Set(['newer']))
  })

  it('keeps one per day between 24h and 30d, drops older than 30d', () => {
    const now = 100 * DAY
    const entries = [
      { id: 'd1a', ts: now - 2 * DAY },
      { id: 'd1b', ts: now - 2 * DAY - HOUR }, // same day bucket as d1a
      { id: 'd2', ts: now - 10 * DAY },
      { id: 'ancient', ts: now - 40 * DAY },
    ]
    expect(computeRetainedIds(entries, now)).toEqual(new Set(['d1a', 'd2']))
  })
})

describe('writeSnapshot / listSnapshots', () => {
  it('stores meta and payload, lists newest-first, and prunes on write', async () => {
    const db = openDb('test-' + nanoid(6))
    const store = createFoliumStore()
    const now = 100 * DAY
    await writeSnapshot(db, docOf(store), now - 40 * DAY) // will be pruned
    await writeSnapshot(db, docOf(store), now - 10 * 60_000)
    await writeSnapshot(db, docOf(store), now)
    const metas = await listSnapshots(db)
    expect(metas.map((m) => m.ts)).toEqual([now, now - 10 * 60_000])
    expect(metas[0].nBoards).toBeGreaterThan(0)
    const payloads = await db.snapshotDocs.toArray()
    expect(payloads.map((p) => p.id).sort()).toEqual(metas.map((m) => m.id).sort())
  })
})

describe('maybeSnapshot', () => {
  it('writes when no snapshot exists, then gates by interval', async () => {
    const db = openDb('test-' + nanoid(6))
    const store = createFoliumStore()
    const t0 = 100 * DAY
    expect(await maybeSnapshot(db, docOf(store), t0)).toBe(true)
    expect(await maybeSnapshot(db, docOf(store), t0 + SNAPSHOT_INTERVAL_MS - 1)).toBe(false)
    expect(await maybeSnapshot(db, docOf(store), t0 + SNAPSHOT_INTERVAL_MS)).toBe(true)
    expect((await listSnapshots(db)).length).toBe(2)
  })
})

describe('restoreSnapshot', () => {
  it('hydrates the store, persists the doc, clears undo, and safety-snapshots first', async () => {
    const db = openDb('test-' + nanoid(6))
    const store = createFoliumStore()
    const s = store.getState()
    const id = await writeSnapshot(db, docOf(store), Date.now() - 5 * 60_000)
    // mutate after the snapshot
    s.addCard(s.rootId, 'sticky', { content: { text: 'later edit' } as never })
    const cardCountBefore = Object.keys(store.getState().cards).length
    await restoreSnapshot(db, store, id)
    // store reverted to snapshot state
    expect(Object.keys(store.getState().cards).length).toBeLessThan(cardCountBefore)
    // undo cannot cross the restore boundary
    expect(store.temporal.getState().pastStates.length).toBe(0)
    // restored doc is persisted immediately (not waiting for autosave)
    const persisted = await loadDoc(db)
    expect(Object.keys(persisted!.cards)).toEqual(Object.keys(store.getState().cards))
    // the pre-restore state was snapshotted, so restore is itself reversible
    const metas = await listSnapshots(db)
    expect(metas.length).toBe(2)
    expect(metas[0].nCards).toBe(cardCountBefore)
  })

  it('throws on an unknown snapshot id and leaves state untouched', async () => {
    const db = openDb('test-' + nanoid(6))
    const store = createFoliumStore()
    const before = docOf(store)
    await expect(restoreSnapshot(db, store, 'nope')).rejects.toThrow()
    expect(docOf(store)).toEqual(before)
  })
})
