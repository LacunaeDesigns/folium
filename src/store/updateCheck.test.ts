import { describe, it, expect } from 'vitest'
import { isUpdateAvailable, shouldSkipCheck } from './updateCheck'

describe('isUpdateAvailable', () => {
  it('is false when the remote commit is not newer than this build', () => {
    expect(isUpdateAvailable(1000, 1000, null)).toBe(false)
    expect(isUpdateAvailable(1000, 500, null)).toBe(false)
  })

  it('is true when the remote commit is newer and nothing was dismissed', () => {
    expect(isUpdateAvailable(1000, 2000, null)).toBe(true)
  })

  it('is false once the current remote commit has been dismissed', () => {
    expect(isUpdateAvailable(1000, 2000, 2000)).toBe(false)
  })

  it('is true again when an even newer commit appears after a dismissal', () => {
    expect(isUpdateAvailable(1000, 3000, 2000)).toBe(true)
  })
})

describe('shouldSkipCheck', () => {
  it('does not skip when never checked before', () => {
    expect(shouldSkipCheck(null, 1_000_000)).toBe(false)
  })

  it('skips when checked less than 24h ago', () => {
    const now = 1_000_000_000
    expect(shouldSkipCheck(now - 60_000, now)).toBe(true)
  })

  it('does not skip when checked more than 24h ago', () => {
    const now = 1_000_000_000
    const dayMs = 24 * 60 * 60 * 1000
    expect(shouldSkipCheck(now - dayMs - 1, now)).toBe(false)
  })
})
