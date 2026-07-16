import React from 'react'
import { useDb, useFoliumStore } from '../store/context'
import { SnapshotMetaRow } from '../store/persist'
import { listSnapshots, restoreSnapshot } from '../store/snapshots'
import { useUi } from '../store/uiStore'
import { Icon } from './Icons'
import './panels.css'

function relTime(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function HistoryPanel() {
  const store = useFoliumStore()
  const db = useDb()
  const setHistoryOpen = useUi((s) => s.setHistoryOpen)
  const [items, setItems] = React.useState<SnapshotMetaRow[] | null>(null)
  const [busy, setBusy] = React.useState(false)

  const refresh = React.useCallback(() => {
    void listSnapshots(db).then(setItems)
  }, [db])
  React.useEffect(refresh, [refresh])

  const restore = async (m: SnapshotMetaRow) => {
    if (!confirm(`Restore the workspace from ${relTime(m.ts)}? Current state is saved as a new version first.`)) return
    setBusy(true)
    try {
      await restoreSnapshot(db, store, m.id)
      const s = store.getState()
      const ui = useUi.getState()
      // the open board may not exist in the restored doc — fall back to root
      if (!s.boards[ui.currentBoardId ?? '']) ui.setBoard(s.rootId)
      refresh()
    } catch {
      // nothing was touched (restore fails before mutating on any error) — say so
      alert('Restore failed — your workspace was not changed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="side-panel history-panel" onPointerDown={(e) => e.stopPropagation()}>
      <div className="tray-head">
        <Icon name="history" size={16} />
        <span className="tray-title">Version history</span>
        <span className="tray-count">{items?.length ?? ''}</span>
        <button className="icon-btn" onClick={() => setHistoryOpen(false)} title="Close">
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="tray-body">
        {items?.map((m) => (
          <div key={m.id} className="trash-item">
            <div className="trash-meta">
              <div className="trash-text">{relTime(m.ts)}</div>
              <div className="trash-sub">{m.nBoards} boards · {m.nCards} cards</div>
            </div>
            <button className="trash-restore" disabled={busy} onClick={() => void restore(m)} title="Restore this version">
              <Icon name="restore" size={14} /> Restore
            </button>
          </div>
        ))}
        {items?.length === 0 && (
          <div className="tray-empty">No versions yet. Snapshots are saved automatically as you work.</div>
        )}
      </div>
    </aside>
  )
}
