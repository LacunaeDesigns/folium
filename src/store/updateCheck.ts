import { create } from 'zustand'

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
