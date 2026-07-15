import React from 'react'
import { relTime } from '../cards/CommentCard'
import { useSync, flushSync, SyncStatus } from '../store/sync'
import { useLocalSave } from '../store/localSave'
import { flushAutosave } from '../store/persist'

export type SaveStatusDisplay = { kind: 'warning'; text: string } | { kind: 'saving' } | { kind: 'saved'; ts: number | null }

interface SyncSnapshot {
  status: SyncStatus
  busy: boolean
  lastSyncedAt: number | null
}

/** Which save/sync status the toolbar indicator should show, given sync + local-save state. */
export function saveStatusDisplay(sync: SyncSnapshot, localSavedAt: number | null): SaveStatusDisplay {
  if (sync.status === 'conflict') return { kind: 'warning', text: 'Sync conflict' }
  if (sync.status === 'error') return { kind: 'warning', text: 'Sync error' }
  if (sync.status === 'linked') {
    return sync.busy ? { kind: 'saving' } : { kind: 'saved', ts: sync.lastSyncedAt }
  }
  return { kind: 'saved', ts: localSavedAt }
}

export function SaveStatusIndicator({ onOpenSettings }: { onOpenSettings: () => void }) {
  const sync = useSync()
  const localSavedAt = useLocalSave((s) => s.lastSavedAt)
  const [pulse, setPulse] = React.useState(false)

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        flushAutosave()
        flushSync()
        setPulse(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  React.useEffect(() => {
    if (!pulse) return
    const t = setTimeout(() => setPulse(false), 1000)
    return () => clearTimeout(t)
  }, [pulse])

  const display = saveStatusDisplay(sync, localSavedAt)

  if (display.kind === 'warning') {
    return (
      <button className="save-status save-status-warning" onClick={onOpenSettings}>
        {display.text}
      </button>
    )
  }

  const text = display.kind === 'saving' ? 'Saving…' : display.ts ? `Saved ${relTime(display.ts)}` : 'Saved'

  return <span className={'save-status' + (pulse ? ' save-status-pulse' : '')}>{text}</span>
}
