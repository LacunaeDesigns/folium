import { nanoid } from 'nanoid'
import { DocState } from '../model/types'
import { FoliumDb, SnapshotMetaRow } from './persist'

/** Minimum gap between automatic snapshots. */
export const SNAPSHOT_INTERVAL_MS = 10 * 60_000

const HOUR = 3600_000
const DAY = 24 * HOUR

/**
 * Retention ladder: keep everything under 1h old, the newest per hour bucket under 24h,
 * the newest per day bucket under 30d, nothing older. Buckets are keyed by each entry's
 * age (floor of age), so the ladder thins history gradually instead of all at once.
 */
export function computeRetainedIds(
  entries: readonly { id: string; ts: number }[],
  now: number,
): Set<string> {
  const keep = new Set<string>()
  const buckets = new Set<string>()
  const sorted = [...entries].sort((a, b) => b.ts - a.ts)
  for (const e of sorted) {
    const age = now - e.ts
    if (age < HOUR) {
      keep.add(e.id)
      continue
    }
    const bucket = age < DAY ? 'h' + Math.floor(age / HOUR) : age < 30 * DAY ? 'd' + Math.floor(age / DAY) : null
    if (bucket && !buckets.has(bucket)) {
      buckets.add(bucket)
      keep.add(e.id)
    }
  }
  return keep
}

/** Write a snapshot of the doc slice, then prune both tables to the retention ladder. */
export async function writeSnapshot(db: FoliumDb, doc: DocState, now = Date.now()): Promise<string> {
  const id = nanoid(12)
  const meta: SnapshotMetaRow = {
    id,
    ts: now,
    nBoards: Object.keys(doc.boards).length,
    nCards: Object.values(doc.cards).filter((c) => !c.trashed).length,
  }
  await db.transaction('rw', db.snapshots, db.snapshotDocs, async () => {
    await db.snapshots.put(meta)
    await db.snapshotDocs.put({ id, doc })
    const all = await db.snapshots.toArray()
    const retained = computeRetainedIds(all, now)
    const drop = all.filter((m) => !retained.has(m.id)).map((m) => m.id)
    if (drop.length) {
      await db.snapshots.bulkDelete(drop)
      await db.snapshotDocs.bulkDelete(drop)
    }
  })
  return id
}

export async function listSnapshots(db: FoliumDb): Promise<SnapshotMetaRow[]> {
  return db.snapshots.orderBy('ts').reverse().toArray()
}

/**
 * Interval-gated snapshot: writes only when the newest stored snapshot is at least
 * SNAPSHOT_INTERVAL_MS old. The gate reads the db (not module state) so two open tabs
 * share it. Returns whether a snapshot was written.
 */
export async function maybeSnapshot(db: FoliumDb, doc: DocState, now = Date.now()): Promise<boolean> {
  const newest = await db.snapshots.orderBy('ts').last()
  if (newest && now - newest.ts < SNAPSHOT_INTERVAL_MS) return false
  await writeSnapshot(db, doc, now)
  return true
}
