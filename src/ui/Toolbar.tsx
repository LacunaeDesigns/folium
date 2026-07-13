import React from 'react'
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
}: {
  activeTool: ToolId | null
  onPickTool: (tool: ToolId) => void
  onOpenTrash: () => void
  trashActive: boolean
}) {
  const [moreOpen, setMoreOpen] = React.useState(false)
  const moreRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!moreOpen) return
    const close = (e: PointerEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false)
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
        <div className="tool-more" ref={moreRef}>
          <button
            className={'tool-btn' + (moreOpen ? ' active' : '')}
            onClick={() => setMoreOpen((v) => !v)}
            title="More card types"
          >
            <span className="tool-icon">
              <Icon name="dots" size={19} />
            </span>
          </button>
          {moreOpen && (
            <div className="menu-pop tool-more-pop">
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
            </div>
          )}
        </div>
      </div>
      <div className="toolbar-group">{MEDIA_TOOLS.map(btn)}</div>
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
