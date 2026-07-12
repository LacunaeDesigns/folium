import React from 'react'
import { Icon } from './Icons'
import './topbar.css'

export interface Crumb {
  id: string
  title: string
  color?: string
}

export function TopBar({
  crumbs,
  title,
  onNavigate,
  onTitleChange,
  onSearch,
  onExport,
  onView,
  onSettings,
  onTemplates,
  onLive,
  liveActive,
  rightExtra,
}: {
  crumbs: Crumb[]
  title: string
  onNavigate: (boardId: string) => void
  onTitleChange: (title: string) => void
  onSearch: () => void
  onExport: () => void
  onView: () => void
  onSettings: () => void
  onTemplates: () => void
  onLive: () => void
  liveActive?: boolean
  rightExtra?: React.ReactNode
}) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(title)
  React.useEffect(() => setDraft(title), [title])

  const commit = () => {
    setEditing(false)
    const t = draft.trim()
    if (t && t !== title) onTitleChange(t)
    else setDraft(title)
  }

  return (
    <div className="topbar">
      <div className="topbar-row">
        <div className="topbar-crumbs">
          <img src="/brand/logomark.png" alt="" className="topbar-logo" />
          {crumbs.map((c, i) => (
            <React.Fragment key={c.id}>
              {i > 0 && <span className="crumb-sep">/</span>}
              {c.color && i > 0 && <span className="crumb-swatch" style={{ background: c.color }} />}
              <button
                className={'crumb' + (i === crumbs.length - 1 ? ' current' : '')}
                onClick={() => onNavigate(c.id)}
              >
                {c.title}
              </button>
            </React.Fragment>
          ))}
        </div>
        <div className="topbar-icons">
          <button className="icon-btn" title="Search boards (Ctrl+K)" onClick={onSearch}>
            <Icon name="search" />
          </button>
          <button className="icon-btn" title="Settings" onClick={onSettings}>
            <Icon name="settings" />
          </button>
        </div>
      </div>
      <div className="titlebar">
        <div className="titlebar-side" />
        <div className="titlebar-center">
          {editing ? (
            <input
              className="board-title-input"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') {
                  setDraft(title)
                  setEditing(false)
                }
              }}
            />
          ) : (
            <h1 className="board-title" onDoubleClick={() => setEditing(true)} title="Double-click to rename">
              {title}
            </h1>
          )}
        </div>
        <div className="titlebar-side right">
          {rightExtra}
          <button className="chrome-btn" onClick={onLive}>
            <Icon name="broadcast" size={13} /> Live
            {liveActive && <span className="live-dot" />}
          </button>
          <button className="chrome-btn" onClick={onTemplates}>
            <Icon name="template" size={13} /> Templates
          </button>
          <button className="chrome-btn" onClick={onExport}>
            Export <Icon name="chevron-down" size={13} />
          </button>
          <button className="chrome-btn" onClick={onView}>
            View <Icon name="chevron-down" size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
