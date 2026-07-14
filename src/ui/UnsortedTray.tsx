import React from 'react'
import { useFolium, useFoliumStore } from '../store/context'
import { unsortedCards } from '../store/selectors'
import { DEFAULT_VIEW, useUi } from '../store/uiStore'
import { getCardBody } from '../cards/registry'
import { Card } from '../model/types'
import { Icon } from './Icons'
import { safeCapture } from '../canvas/coords'
import './panels.css'

function TrayItem({ card }: { card: Card }) {
  const store = useFoliumStore()
  const [dragXY, setDragXY] = React.useState<{ x: number; y: number } | null>(null)
  const gesture = React.useRef<{ startX: number; startY: number; dragging: boolean } | null>(null)
  const Body = getCardBody(card.type)

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('input, textarea, button, a, [contenteditable="true"], .no-drag')) return
    e.stopPropagation()
    safeCapture(e.currentTarget as HTMLElement, e.pointerId)
    gesture.current = { startX: e.clientX, startY: e.clientY, dragging: false }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g) return
    if (!g.dragging && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < 5) return
    g.dragging = true
    setDragXY({ x: e.clientX - g.startX, y: e.clientY - g.startY })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current
    gesture.current = null
    setDragXY(null)
    if (!g?.dragging) return
    // released over the canvas -> place there
    const vp = document.querySelector('.canvas-viewport')
    if (!vp) return
    const r = vp.getBoundingClientRect()
    const overTray = (document.elementsFromPoint(e.clientX, e.clientY) as HTMLElement[]).some((el) =>
      el.classList?.contains('unsorted-tray'),
    )
    if (overTray) return
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
      const boardId = useUi.getState().currentBoardId
      const view = (boardId && useUi.getState().views[boardId]) || DEFAULT_VIEW
      const wx = (e.clientX - r.left - view.pan.x) / view.zoom
      const wy = (e.clientY - r.top - view.pan.y) / view.zoom
      store.getState().updateCard(card.id, { inUnsorted: false, x: wx - card.w / 2, y: wy - 16 })
    }
  }

  return (
    <div
      className={'tray-item' + (dragXY ? ' lifting' : '')}
      style={dragXY ? { transform: `translate(${dragXY.x}px, ${dragXY.y}px)`, zIndex: 200, position: 'relative' } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="col-member-chrome">
        <Body card={card} inColumn />
      </div>
    </div>
  )
}

export function UnsortedTray({ boardId }: { boardId: string }) {
  const store = useFoliumStore()
  const items = useFolium((s) => unsortedCards(s, boardId))
  const open = useUi((s) => s.unsortedOpen)
  const setOpen = useUi((s) => s.setUnsortedOpen)
  const [quick, setQuick] = React.useState('')

  const quickAdd = () => {
    const text = quick.trim()
    if (!text) return
    store.getState().addCard(boardId, 'note', {
      inUnsorted: true,
      content: {
        doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] },
      } as never,
    })
    setQuick('')
  }

  if (!open) {
    return (
      <button className="unsorted-chip" onClick={() => setOpen(true)}>
        <b>{items.length}</b> Unsorted
      </button>
    )
  }

  return (
    <aside className="unsorted-tray" onPointerDown={(e) => e.stopPropagation()}>
      <div className="tray-head">
        <span className="tray-title">Unsorted</span>
        <span className="tray-count">{items.length}</span>
        <button className="icon-btn" onClick={() => setOpen(false)} title="Close">
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="tray-quick">
        <input
          placeholder="Quick note… (Enter)"
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') quickAdd()
          }}
        />
      </div>
      <div className="tray-body">
        {items.map((c) => (
          <TrayItem key={c.id} card={c} />
        ))}
        {items.length === 0 && (
          <div className="tray-empty">
            Drop cards here to file them later, or add a quick note above.
          </div>
        )}
      </div>
    </aside>
  )
}
