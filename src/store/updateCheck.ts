import { create } from 'zustand'
import { FoliumDb, getSetting, setSetting } from './persist'

/** True when the remote repo has moved on since this build, and the user hasn't already
 *  dismissed that specific update. */
export function isUpdateAvailable(
  buildTime: number,
  remoteCommitDate: number,
  dismissedAt: number | null,
): boolean {
  if (remoteCommitDate <= buildTime) return false
  return dismissedAt === null || remoteCommitDate > dismissedAt
}

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

/** True when we checked recently enough that another network call isn't warranted yet. */
export function shouldSkipCheck(lastCheckedAt: number | null, now: number): boolean {
  return lastCheckedAt !== null && now - lastCheckedAt < CHECK_INTERVAL_MS
}

interface UpdateCheckState {
  available: boolean
  /** The remote commit timestamp behind the current `available` verdict, if any — recorded so
   *  dismissUpdate() (added in a later task) knows exactly what to mark as dismissed. */
  remoteTs: number | null
}

export const useUpdateCheck = create<UpdateCheckState>(() => ({
  available: false,
  remoteTs: null,
}))

const LAST_CHECKED_KEY = 'updateLastCheckedAt'
const DISMISSED_KEY = 'updateDismissedAt'
const COMMITS_URL = 'https://api.github.com/repos/LacunaeDesigns/folium/commits/main'

/** Best-effort: checks the public repo for a newer commit than this build, at most once
 *  per day. Any failure (offline, rate-limited, malformed response) is swallowed — this is
 *  a nice-to-have notice, never something that should affect app usability. */
export async function checkForUpdates(db: FoliumDb): Promise<void> {
  try {
    const lastCheckedAt = await getSetting<number | null>(db, LAST_CHECKED_KEY, null)
    const now = Date.now()
    if (shouldSkipCheck(lastCheckedAt, now)) return

    const res = await fetch(COMMITS_URL, { headers: { Accept: 'application/vnd.github+json' } })
    if (!res.ok) return
    const data = (await res.json()) as { commit?: { committer?: { date?: string } } }
    const dateStr = data.commit?.committer?.date
    if (!dateStr) return
    const remoteTs = new Date(dateStr).getTime()
    if (Number.isNaN(remoteTs)) return

    await setSetting(db, LAST_CHECKED_KEY, now)
    const dismissedAt = await getSetting<number | null>(db, DISMISSED_KEY, null)
    useUpdateCheck.setState({
      available: isUpdateAvailable(__BUILD_TIME__, remoteTs, dismissedAt),
      remoteTs,
    })
  } catch {
    // offline / rate-limited / malformed — no update shown, nothing else affected
  }
}

/** Records the currently-known remote commit as dismissed, so today's notice goes away
 *  but a genuinely newer commit later still surfaces. */
export async function dismissUpdate(db: FoliumDb): Promise<void> {
  const { remoteTs } = useUpdateCheck.getState()
  if (remoteTs === null) return
  await setSetting(db, DISMISSED_KEY, remoteTs)
  useUpdateCheck.setState({ available: false })
}
