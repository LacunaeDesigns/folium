import React from 'react'
import { Template } from '../model/types'
import { useAtlasStore, useDb } from '../store/context'
import { deleteUserTemplate, listTemplates, saveBoardAsTemplate } from '../store/templates'
import { DEFAULT_VIEW, useUi } from '../store/uiStore'
import { Icon } from './Icons'
import './panels.css'

/** Tiny abstract preview: card rects of the template's root board. */
function TemplatePreview({ t }: { t: Template }) {
  const rootCards = t.snapshot.cards.filter(
    (c) => c.boardId === t.snapshot.rootBoardId && !c.colId && !c.inUnsorted,
  )
  if (rootCards.length === 0) return <div className="tpl-preview" />
  const minX = Math.min(...rootCards.map((c) => c.x))
  const minY = Math.min(...rootCards.map((c) => c.y))
  const maxX = Math.max(...rootCards.map((c) => c.x + c.w))
  const maxY = Math.max(...rootCards.map((c) => c.y + (c.h ?? 90)))
  const colors: Record<string, string> = {
    board: '#4c6ef5',
    column: '#c9c6bf',
    image: '#a3a7aa',
    sticky: '#f9e76f',
    shape: '#bfe8b4',
    table: '#f9c97c',
    swatch: '#d4589c',
  }
  return (
    <svg className="tpl-preview" viewBox={`${minX - 10} ${minY - 10} ${maxX - minX + 20} ${maxY - minY + 20}`} preserveAspectRatio="xMidYMid meet">
      {rootCards.map((c) => (
        <rect
          key={c.id}
          x={c.x}
          y={c.y}
          width={c.w}
          height={c.h ?? 90}
          rx={8}
          fill={colors[c.type] ?? '#e8e6e1'}
          opacity={0.9}
        />
      ))}
    </svg>
  )
}

export function TemplateGallery({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const store = useAtlasStore()
  const db = useDb()
  const [templates, setTemplates] = React.useState<Template[]>([])
  const [saveName, setSaveName] = React.useState('')

  const refresh = React.useCallback(() => {
    void listTemplates(db).then(setTemplates)
  }, [db])

  React.useEffect(refresh, [refresh])

  const instantiate = (t: Template) => {
    const vp = document.querySelector('.canvas-viewport')
    const view = useUi.getState().views[boardId] ?? DEFAULT_VIEW
    const at = vp
      ? {
          x: (vp.clientWidth / 2 - view.pan.x) / view.zoom - 90,
          y: (vp.clientHeight / 2 - view.pan.y) / view.zoom - 80,
        }
      : { x: 120, y: 120 }
    const newBoardId = store.getState().graftSnapshot(t.snapshot, boardId, at)
    store.getState().renameBoard(newBoardId, t.name)
    onClose()
    useUi.getState().setBoard(newBoardId)
  }

  const saveCurrent = async () => {
    const name = saveName.trim()
    if (!name) return
    await saveBoardAsTemplate(db, store.getState(), boardId, name)
    setSaveName('')
    refresh()
  }

  const categories = [...new Set(templates.map((t) => t.category))]

  return (
    <div className="overlay" onPointerDown={onClose}>
      <div className="tpl-modal" onPointerDown={(e) => e.stopPropagation()}>
        <div className="tray-head">
          <Icon name="template" size={16} />
          <span className="tray-title">Templates</span>
          <button className="icon-btn" onClick={onClose} title="Close">
            <Icon name="close" size={14} />
          </button>
        </div>
        <div className="tpl-save-row">
          <input
            placeholder="Save current board as a template… (name)"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void saveCurrent()
            }}
          />
          <button className="tpl-save-btn" onClick={() => void saveCurrent()} disabled={!saveName.trim()}>
            Save
          </button>
        </div>
        <div className="tpl-body">
          {categories.map((cat) => (
            <div key={cat}>
              <div className="tpl-cat">{cat}</div>
              <div className="tpl-grid">
                {templates
                  .filter((t) => t.category === cat)
                  .map((t) => (
                    <div key={t.id} className="tpl-card">
                      <button className="tpl-hit" onClick={() => instantiate(t)} title={`Use “${t.name}”`}>
                        <TemplatePreview t={t} />
                        <div className="tpl-name">{t.name}</div>
                        <div className="tpl-desc">{t.description}</div>
                      </button>
                      {!t.builtIn && (
                        <button
                          className="tpl-delete"
                          title="Delete template"
                          onClick={() => {
                            void deleteUserTemplate(db, t.id).then(refresh)
                          }}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
