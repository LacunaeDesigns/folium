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
  onHelp,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  liveActive,
  liveMenu,
  exportMenu,
  viewMenu,
  settingsMenu,
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
  onHelp: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo?: boolean
  canRedo?: boolean
  liveActive?: boolean
  /** popovers rendered inside each button's own .menu-anchor so they drop from their button */
  liveMenu?: React.ReactNode
  exportMenu?: React.ReactNode
  viewMenu?: React.ReactNode
  settingsMenu?: React.ReactNode
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

  const parents = crumbs.slice(0, -1)

  return (
    <div className="topbar">
      <div className="topbar-row">
        <img src="/brand/folium.svg" alt="" className="topbar-logo" />
        <nav className="topbar-crumbs">
          {parents.map((c) => (
            <React.Fragment key={c.id}>
              <button className="crumb" onClick={() => onNavigate(c.id)}>
                {c.color && <span className="crumb-swatch" style={{ background: c.color }} />}
                {c.title}
              </button>
              <span className="crumb-sep">/</span>
            </React.Fragment>
          ))}
          {editing ? (
            <input
              className="board-title-input"
              value={draft}
              autoFocus
              size={Math.max(6, draft.length)}
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
        </nav>
        <div className="topbar-actions">
          <button
            className="icon-btn"
            title="Undo (Ctrl+Z)"
            disabled={canUndo === false}
            onClick={onUndo}
          >
            <Icon name="undo" />
          </button>
          <button
            className="icon-btn"
            title="Redo (Ctrl+Shift+Z)"
            disabled={canRedo === false}
            onClick={onRedo}
          >
            <Icon name="redo" />
          </button>
          <button className="icon-btn" title="Search boards (Ctrl+K)" onClick={onSearch}>
            <Icon name="search" />
          </button>
          <span className="menu-anchor">
            <button className="chrome-btn" onClick={onLive}>
              <Icon name="broadcast" size={13} /> Live
              {liveActive && <span className="live-dot" />}
            </button>
            {liveMenu}
          </span>
          <button className="chrome-btn" onClick={onTemplates}>
            <Icon name="template" size={13} /> Templates
          </button>
          <span className="menu-anchor">
            <button className="chrome-btn" onClick={onExport}>
              Export <Icon name="chevron-down" size={13} />
            </button>
            {exportMenu}
          </span>
          <span className="menu-anchor">
            <button className="chrome-btn" onClick={onView}>
              View <Icon name="chevron-down" size={13} />
            </button>
            {viewMenu}
          </span>
          <span className="menu-anchor">
            <button className="icon-btn" title="Settings" onClick={onSettings}>
              <Icon name="settings" />
            </button>
            {settingsMenu}
          </span>
          <button className="icon-btn" title="Help" onClick={onHelp}>
            <Icon name="help" />
          </button>
        </div>
      </div>
    </div>
  )
}
