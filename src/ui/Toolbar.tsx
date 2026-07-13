import React from 'react'
import { createPortal } from 'react-dom'
import { Icon, IconName } from './Icons'
import './toolbar.css'

export type ToolId =
  | 'note'
  | 'link'
  | 'todo'
  | 'line'
  | 'board'
  | 'column'
  | 'comment'
  | 'table'
  | 'swatch'
  | 'sticky'
  | 'shape'
  | 'image'
  | 'upload'
  | 'draw'

interface ToolDef {
  id: ToolId
  icon: IconName
  label: string
}

const MAIN_TOOLS: ToolDef[] = [
  { id: 'note', icon: 'note', label: 'Note' },
  { id: 'link', icon: 'link', label: 'Link' },
  { id: 'todo', icon: 'todo', label: 'To-do' },
  { id: 'line', icon: 'line', label: 'Line' },
  { id: 'board', icon: 'board', label: 'Board' },
  { id: 'column', icon: 'column', label: 'Column' },
  { id: 'comment', icon: 'comment', label: 'Comment' },
  { id: 'table', icon: 'table', label: 'Table' },
]

const MORE_TOOLS: ToolDef[] = [
  { id: 'swatch', icon: 'swatch', label: 'Color swatch' },
  { id: 'sticky', icon: 'sticky', label: 'Sticky note' },
  { id: 'shape', icon: 'shape', label: 'Shape' },
]

const MEDIA_TOOLS: ToolDef[] = [
  { id: 'image', icon: 'image', label: 'Add image' },
  { id: 'upload', icon: 'upload', label: 'Upload' },
  { id: 'draw', icon: 'draw', label: 'Draw' },
]

export function Toolbar({
  activeTool,
  onPickTool,
  onOpenTrash,
  trashActive,
  onOpenPhotos,
}: {
  activeTool: ToolId | null
  onPickTool: (tool: ToolId) => void
  onOpenTrash: () => void
  trashActive: boolean
  onOpenPhotos: () => void
}) {
  const [moreOpen, setMoreOpen] = React.useState(false)
  const moreBtnRef = React.useRef<HTMLButtonElement>(null)
  const morePopRef = React.useRef<HTMLDivElement>(null)
  const [morePos, setMorePos] = React.useState({ left: 0, top: 0 })

  // The flyout is portaled to <body> so it escapes the tool dock's
  // overflow-y:auto clip (which also clips horizontally), then anchored
  // to the right of the "More" button.
  const toggleMore = () => {
    const r = moreBtnRef.current?.getBoundingClientRect()
    if (r) setMorePos({ left: r.right + 6, top: r.top })
    setMoreOpen((v) => !v)
  }

  React.useEffect(() => {
    if (!moreOpen) return
    const close = (e: PointerEvent) => {
      const t = e.target as Node
      if (!moreBtnRef.current?.contains(t) && !morePopRef.current?.contains(t)) setMoreOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [moreOpen])

  const btn = (t: ToolDef) => (
    <button
      key={t.id}
      className={'tool-btn' + (activeTool === t.id ? ' active' : '')}
      onClick={() => {
        // Add-image / Upload open the file picker immediately rather than
        // arming a tool that needs a second click on the canvas
        if (t.id === 'image' || t.id === 'upload') {
          window.dispatchEvent(
            new CustomEvent('folium:pick-files', {
              detail: { accept: t.id === 'image' ? 'image/*' : '' },
            }),
          )
          return
        }
        onPickTool(t.id)
      }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-atlasnote-tool', t.id)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      title={t.label}
    >
      <span className="tool-icon">
        <Icon name={t.icon} size={19} />
      </span>
      <span className="tool-label">{t.label}</span>
    </button>
  )

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        {MAIN_TOOLS.map(btn)}
        <div className="tool-more">
          <button
            ref={moreBtnRef}
            className={'tool-btn' + (moreOpen ? ' active' : '')}
            onClick={toggleMore}
            title="More card types"
          >
            <span className="tool-icon">
              <Icon name="dots" size={19} />
            </span>
          </button>
          {moreOpen &&
            createPortal(
              <div
                ref={morePopRef}
                className="menu-pop"
                style={{ position: 'fixed', left: morePos.left, top: morePos.top }}
              >
                {MORE_TOOLS.map((t) => (
                  <button
                    key={t.id}
                    className="menu-item"
                    onClick={() => {
                      onPickTool(t.id)
                      setMoreOpen(false)
                    }}
                  >
                    <Icon name={t.icon} size={16} /> {t.label}
                  </button>
                ))}
              </div>,
              document.body,
            )}
        </div>
      </div>
      <div className="toolbar-group">
        {MEDIA_TOOLS.map(btn)}
        <button className="tool-btn" onClick={onOpenPhotos} title="Free stock photos (Pexels)">
          <span className="tool-icon">
            <Icon name="search" size={19} />
          </span>
          <span className="tool-label">Photos</span>
        </button>
      </div>
      <div className="toolbar-spacer" />
      <div className="toolbar-group bottom">
        <button className={'tool-btn' + (trashActive ? ' active' : '')} onClick={onOpenTrash} title="Trash">
          <span className="tool-icon">
            <Icon name="trash" size={19} />
          </span>
          <span className="tool-label">Trash</span>
        </button>
      </div>
    </div>
  )
}
