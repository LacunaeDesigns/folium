import React from 'react'
import { Card } from '../model/types'
import { useAtlasStore } from '../store/context'
import { useUi } from '../store/uiStore'
import { getCardBody } from '../cards/registry'
import { safeCapture } from './coords'
import { resolveCardDrop } from './dropTarget'

export interface DragState {
  ids: string[]
  dx: number
  dy: number
}

interface CardShellProps {
  card: Card
  zoom: number
  drag: DragState | null
  setDrag: (d: DragState | null) => void
  onContextMenu: (cardId: string, clientX: number, clientY: number) => void
  /** notify parent a card edge was targeted by the line tool */
  lineToolActive?: boolean
  onLineAnchor?: (cardId: string) => void
}

const DRAG_THRESHOLD = 4

export function CardShell({ card, zoom, drag, setDrag, onContextMenu, lineToolActive, onLineAnchor }: CardShellProps) {
  const store = useAtlasStore()
  const selection = useUi((s) => s.selection)
  const isSelected = selection.includes(card.id)
  const isDragging = !!drag && drag.ids.includes(card.id)

  const [resizePreview, setResizePreview] = React.useState<{ w: number; h?: number } | null>(null)

  const gesture = React.useRef<{
    startX: number
    startY: number
    ids: string[]
    dragging: boolean
    /** Alt held at drag start — duplicate the selection and drag the copies */
    alt: boolean
  } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1) return // middle = pan, let canvas handle
    e.stopPropagation()
    if (e.button === 2) {
      if (!useUi.getState().selection.includes(card.id)) useUi.getState().setSelection([card.id])
      onContextMenu(card.id, e.clientX, e.clientY)
      return
    }
    if (e.button !== 0) return

    if (lineToolActive && onLineAnchor) {
      onLineAnchor(card.id)
      return
    }

    // don't hijack pointer interactions inside editable content
    const target = e.target as HTMLElement
    if (target.closest('input, textarea, button, a, [contenteditable="true"], .no-drag')) {
      return
    }

    const ui = useUi.getState()
    if (e.shiftKey) {
      ui.toggleSelect(card.id)
      return
    }
    if (!ui.selection.includes(card.id)) ui.setSelection([card.id])

    gesture.current = {
      startX: e.clientX,
      startY: e.clientY,
      ids: useUi.getState().selection,
      dragging: false,
      alt: e.altKey,
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g) return
    const dx = (e.clientX - g.startX) / zoom
    const dy = (e.clientY - g.startY) / zoom
    if (!g.dragging) {
      if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < DRAG_THRESHOLD) return
      g.dragging = true
      // capture only once a drag starts — capturing on pointerdown retargets the
      // ensuing click/dblclick to the shell, killing double-click on card bodies
      safeCapture(e.currentTarget as HTMLElement, e.pointerId)
      // alt-drag duplicates the selection and drags the copies, leaving originals put
      if (g.alt) {
        const dupIds = store.getState().duplicateCards(g.ids)
        if (dupIds.length) {
          useUi.getState().setSelection(dupIds)
          g.ids = dupIds
        }
        g.alt = false
      }
    }
    setDrag({ ids: g.ids, dx, dy })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    if (g.dragging) {
      const dx = (e.clientX - g.startX) / zoom
      const dy = (e.clientY - g.startY) / zoom
      setDrag(null)
      // dropping onto a column moves the cards into it (columns themselves can't nest)
      const s = store.getState()
      const droppable = g.ids.every((id) => s.cards[id] && s.cards[id].type !== 'column')
      if (droppable) {
        const drop = resolveCardDrop(e.clientX, e.clientY, g.ids)
        if (drop?.kind === 'column') {
          g.ids.forEach((id, i) => s.setCardColumn(id, drop.colId, drop.index + i))
          return
        }
        if (drop?.kind === 'unsorted') {
          g.ids.forEach((id) => s.updateCard(id, { inUnsorted: true }))
          return
        }
      }
      if (dx !== 0 || dy !== 0) store.getState().moveCards(g.ids, dx, dy)
    } else if (!e.shiftKey) {
      useUi.getState().setSelection([card.id])
    }
  }

  // --- resize ---
  const resizeGesture = React.useRef<{
    startX: number
    startY: number
    startW: number
    startH?: number
    corner: boolean
  } | null>(null)

  const onResizeDown = (corner: boolean) => (e: React.PointerEvent) => {
    e.stopPropagation()
    if (e.button !== 0) return
    const el = e.currentTarget as HTMLElement
    safeCapture(el, e.pointerId)
    resizeGesture.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: card.w,
      startH: card.h,
      corner,
    }
  }

  const onResizeMove = (e: React.PointerEvent) => {
    const g = resizeGesture.current
    if (!g) return
    const w = Math.max(120, Math.round(g.startW + (e.clientX - g.startX) / zoom))
    const h =
      g.corner && g.startH !== undefined
        ? Math.max(60, Math.round(g.startH + (e.clientY - g.startY) / zoom))
        : g.startH
    setResizePreview({ w, h })
  }

  const onResizeUp = () => {
    const g = resizeGesture.current
    resizeGesture.current = null
    if (!g) return
    setResizePreview((preview) => {
      if (preview) store.getState().resizeCard(card.id, preview.w, preview.h)
      return null
    })
  }

  const Body = getCardBody(card.type)
  const w = resizePreview?.w ?? card.w
  const h = resizePreview?.h ?? card.h

  const style: React.CSSProperties = {
    left: card.x,
    top: card.y,
    width: w,
    height: h,
    zIndex: card.z,
    transform: isDragging ? `translate(${drag!.dx}px, ${drag!.dy}px)` : undefined,
  }

  return (
    <div
      className={
        'card-shell' +
        (isSelected ? ' selected' : '') +
        (isDragging ? ' dragging' : '') +
        (lineToolActive ? ' line-target' : '')
      }
      data-type={card.type}
      data-card-id={card.id}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Body card={card} />
      {isSelected && selection.length === 1 && (
        <>
          <div
            className="resize-handle edge"
            onPointerDown={onResizeDown(false)}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeUp}
          />
          {card.h !== undefined && (
            <div
              className="resize-handle corner"
              onPointerDown={onResizeDown(true)}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeUp}
            />
          )}
        </>
      )}
    </div>
  )
}
