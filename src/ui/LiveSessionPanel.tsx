import React from 'react'
import { useFoliumStore } from '../store/context'
import { startLiveSession, stopLiveSession, useLive } from '../live/host'
import { Icon } from './Icons'
import './panels.css'

export function LiveSessionPanel({ boardId }: { boardId: string }) {
  const store = useFoliumStore()
  const live = useLive()
  const [copied, setCopied] = React.useState(false)

  const fmtCode = (code: string) => code.slice(0, 3) + '-' + code.slice(3)

  return (
    <div className="menu-pop topbar-menu live-pop" onPointerDown={(e) => e.stopPropagation()}>
      {live.status === 'idle' && (
        <>
          <div className="live-hint">
            Reviewers open the <b>exported HTML file</b> of this board, click
            “Join live session” and enter your code. Their comments land on this
            board live.
          </div>
          <button className="live-start" onClick={() => startLiveSession(store, boardId)}>
            <Icon name="broadcast" size={15} /> Start live session
          </button>
        </>
      )}
      {live.status === 'starting' && <div className="live-hint">Connecting to signaling…</div>}
      {live.status === 'error' && (
        <>
          <div className="live-hint" style={{ color: 'var(--danger)' }}>
            Could not start: {live.error}
          </div>
          <button className="live-start" onClick={() => startLiveSession(store, boardId)}>
            Try again
          </button>
        </>
      )}
      {live.status === 'ready' && live.code && (
        <>
          <div className="live-code-label">Session code</div>
          <button
            className="live-code"
            title="Copy code"
            onClick={() => {
              void navigator.clipboard.writeText(fmtCode(live.code!))
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
          >
            {fmtCode(live.code)} {copied ? '✓' : ''}
          </button>
          <div className="live-hint">
            Share this code plus the exported HTML file (Export → Share as HTML).
          </div>
          <div className="live-peers">
            {live.peers.length === 0 && <span className="live-waiting">Waiting for reviewers…</span>}
            {live.peers.map((name, i) => (
              <span key={i} className="live-peer">
                ● {name}
              </span>
            ))}
          </div>
          <button className="live-end" onClick={stopLiveSession}>
            End session
          </button>
        </>
      )}
    </div>
  )
}
