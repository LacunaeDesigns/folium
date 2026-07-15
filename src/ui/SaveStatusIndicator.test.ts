import { describe, it, expect } from 'vitest'
import { saveStatusDisplay } from './SaveStatusIndicator'

const base = { status: 'off' as const, busy: false, lastSyncedAt: null }

describe('saveStatusDisplay', () => {
  it('shows a conflict warning regardless of local save state', () => {
    expect(saveStatusDisplay({ ...base, status: 'conflict' }, 123)).toEqual({
      kind: 'warning',
      text: 'Sync conflict',
    })
  })

  it('shows an error warning regardless of local save state', () => {
    expect(saveStatusDisplay({ ...base, status: 'error' }, 123)).toEqual({
      kind: 'warning',
      text: 'Sync error',
    })
  })

  it('shows "saving" while a linked push is in flight', () => {
    expect(saveStatusDisplay({ ...base, status: 'linked', busy: true }, null)).toEqual({ kind: 'saving' })
  })

  it('shows the folder-sync timestamp when linked and idle', () => {
    expect(saveStatusDisplay({ ...base, status: 'linked', lastSyncedAt: 555 }, 111)).toEqual({
      kind: 'saved',
      ts: 555,
    })
  })

  it('falls back to the local save timestamp when not linked', () => {
    expect(saveStatusDisplay({ ...base, status: 'off' }, 111)).toEqual({ kind: 'saved', ts: 111 })
    expect(saveStatusDisplay({ ...base, status: 'unsupported' }, 111)).toEqual({ kind: 'saved', ts: 111 })
    expect(saveStatusDisplay({ ...base, status: 'needs-reconnect' }, 111)).toEqual({ kind: 'saved', ts: 111 })
  })
})
