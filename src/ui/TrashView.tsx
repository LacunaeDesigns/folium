import React from 'react'
import { useAtlas, useAtlasStore } from '../store/context'
import { trashedCards } from '../store/selectors'
import { cardText } from '../store/search'
import { useUi } from '../store/uiStore'
import { Icon, IconName } from './Icons'
import './panels.css'

const TYPE_ICON: Record<string, IconName> = {
  note: 'note',
  todo: 'todo',
  link: 'link',
  image: 'image',
  file: 'upload',
  board: 'board',
  column: 'column',
  comment: 'comment',
  table: 'table',
  swatch: 'swatch',
  sticky: 'sticky',
  shape: 'shape',
  ink: 'draw',
}

export function TrashView() {
  const store = useAtlasStore()
  const items = useAtlas((s) => trashedCards(s))
  const boards = useAtlas((s) => s.boards)
  const setTrashOpen = useUi((s) => s.setTrashOpen)

  return (
    <aside className="side-panel trash-panel" onPointerDown={(e) => e.stopPropagation()}>
      <div className="tray-head">
        <Icon name="trash" size={16} />
        <span className="tray-title">Trash</span>
        <span className="tray-count">{items.length}</span>
        <button className="icon-btn" onClick={() => setTrashOpen(false)} title="Close">
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="tray-body">
        {items.map((c) => {
          const text = c.type === 'board' && c.content.kind === 'board'
            ? boards[c.content.boardId]?.title ?? 'Board'
            : cardText(c) || c.type
          return (
            <div key={c.id} className="trash-item">
              <Icon name={TYPE_ICON[c.type] ?? 'note'} size={15} />
              <div className="trash-meta">
                <div className="trash-text">{text.slice(0, 60) || c.type}</div>
                <div className="trash-sub">from {boards[c.boardId]?.title ?? 'deleted board'}</div>
              </div>
              <button
                className="trash-restore"
                onClick={() => store.getState().restoreCards([c.id])}
                title="Restore"
              >
                <Icon name="restore" size={14} /> Restore
              </button>
            </div>
          )
        })}
        {items.length === 0 && <div className="tray-empty">Trash is empty.</div>}
      </div>
      {items.length > 0 && (
        <div className="trash-foot">
          <button
            className="trash-empty-btn"
            onClick={() => {
              if (confirm('Permanently delete everything in the trash?')) {
                store.getState().emptyTrash()
              }
            }}
          >
            Empty trash
          </button>
        </div>
      )}
    </aside>
  )
}
