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
  /** drag-to-connect from an edge handle (ax, ay = normalized handle position) */
  onConnectStart?: (cardId: string, ax: number, ay: number) => void
  onConnectMove?: (clientX: number, clientY: number) => void
  onConnectEnd?: (clientX: number, clientY: number) => void
}

const DRAG_THRESHOLD = 8

// edge-center connection handles: [css class, ax, ay]
const CONNECT_HANDLES: [string, number, number][] = [
  ['ch-top', 0.5, 0],
  ['ch-right', 1, 0.5],
  ['ch-bottom', 0.5, 1],
  ['ch-left', 0, 0.5],
]

// boards connect as a single unit — one handle at the centre instead of 4 edge ones
const BOARD_CONNECT_HANDLES: [string, number, number][] = [['ch-center', 0.5, 0.5]]

// four resize corners: [css class, dirX, dirY]
const RESIZE_CORNERS: [string, number, number][] = [
  ['rc-tl', -1, -1],
  ['rc-tr', 1, -1],
  ['rc-bl', -1, 1],
  ['rc-br', 1, 1],
]

export function CardShell({ card, zoom, drag, setDrag, onContextMenu, lineToolActive, onLineAnchor, onConnectStart, onConnectMove, onConnectEnd }: CardShellProps) {
  const store = useAtlasStore()
  const selection = useUi((s) => s.selection)
  const isSelected = selection.includes(card.id)
  const isDragging = !!drag && drag.ids.includes(card.id)

  const [resizePreview, setResizePreview] = React.useState<{ w: number; h?: number; x: number; y: number } | null>(null)

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
      // right-clicking inside an editable field should open the browser's native
      // menu (spellcheck suggestions, cut/copy/paste), not the card menu
      if ((e.target as HTMLElement).closest('input, textarea, [contenteditable="true"]')) return
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

  // shared by pointerup and by the "button already released" fallback below —
  // finishes the drag exactly as a normal release would
  const finishDrag = (g: NonNullable<typeof gesture.current>, clientX: number, clientY: number) => {
    const dx = (clientX - g.startX) / zoom
    const dy = (clientY - g.startY) / zoom
    setDrag(null)
    // dropping onto a column moves the cards into it (columns themselves can't nest)
    const s = store.getState()
    const droppable = g.ids.every((id) => s.cards[id] && s.cards[id].type !== 'column')
    if (droppable) {
      const drop = resolveCardDrop(clientX, clientY, g.ids)
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
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g) return
    // the primary button is no longer held — a multi-card drag can end up with
    // the pointerup landing on a *different* selected card (each only reacts to
    // the shared drag state, so only the one actually clicked tracks pointerup),
    // which otherwise leaves this gesture stuck forever and re-triggers a drag
    // the next time the cursor merely hovers this card. Finish it here instead.
    if ((e.buttons & 1) === 0) {
      gesture.current = null
      if (g.dragging) finishDrag(g, e.clientX, e.clientY)
      else if (!e.shiftKey) useUi.getState().setSelection([card.id])
      return
    }
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
      finishDrag(g, e.clientX, e.clientY)
    } else if (!e.shiftKey) {
      useUi.getState().setSelection([card.id])
    }
  }

  // the browser/OS aborted the gesture outright (e.g. losing capture) — discard
  // rather than commit, so the card snaps back instead of jumping to wherever
  // the pointer happened to be
  const onPointerCancel = () => {
    const g = gesture.current
    gesture.current = null
    if (g?.dragging) setDrag(null)
  }

  // --- drag-to-connect from an edge handle ---
  const connecting = React.useRef(false)
  const onHandleDown = (ax: number, ay: number) => (e: React.PointerEvent) => {
    e.stopPropagation()
    if (e.button !== 0) return
    safeCapture(e.currentTarget as HTMLElement, e.pointerId)
    connecting.current = true
    onConnectStart?.(card.id, ax, ay)
  }
  const onHandleMove = (e: React.PointerEvent) => {
    if (!connecting.current) return
    if ((e.buttons & 1) === 0) {
      // button already released — pointerup was likely missed; finish here
      // instead of leaving a pending line stuck to the cursor
      connecting.current = false
      onConnectEnd?.(e.clientX, e.clientY)
      return
    }
    onConnectMove?.(e.clientX, e.clientY)
  }
  const onHandleUp = (e: React.PointerEvent) => {
    if (!connecting.current) return
    connecting.current = false
    onConnectEnd?.(e.clientX, e.clientY)
  }
  const onHandleCancel = () => {
    if (!connecting.current) return
    connecting.current = false
    // off-screen coordinates guarantee no card is found, so this aborts
    // without creating a connection
    onConnectEnd?.(-999999, -999999)
  }

  // --- resize --- dirX/dirY: which edge each handle drives (-1 left/top, +1
  // right/bottom, 0 fixed); the opposite edge stays anchored, so a corner drag
  // resizes diagonally and repositions the card as needed.
  const resizeGesture = React.useRef<{
    startX: number
    startY: number
    startW: number
    startH?: number
    startCardX: number
    startCardY: number
    dirX: number
    dirY: number
  } | null>(null)

  const onResizeDown = (dirX: number, dirY: number) => (e: React.PointerEvent) => {
    e.stopPropagation()
    if (e.button !== 0) return
    safeCapture(e.currentTarget as HTMLElement, e.pointerId)
    resizeGesture.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: card.w,
      startH: card.h,
      startCardX: card.x,
      startCardY: card.y,
      dirX,
      dirY,
    }
  }

  const commitResize = () => {
    const g = resizeGesture.current
    resizeGesture.current = null
    if (!g) return
    setResizePreview((preview) => {
      if (preview) store.getState().updateCard(card.id, { x: preview.x, y: preview.y, w: preview.w, h: preview.h })
      return null
    })
  }

  const onResizeMove = (e: React.PointerEvent) => {
    const g = resizeGesture.current
    if (!g) return
    const dx = (e.clientX - g.startX) / zoom
    const dy = (e.clientY - g.startY) / zoom
    let w = g.startW
    let h = g.startH
    let x = g.startCardX
    let y = g.startCardY
    if (g.dirX !== 0) {
      w = Math.max(120, Math.round(g.startW + g.dirX * dx))
      if (g.dirX < 0) x = Math.round(g.startCardX + (g.startW - w)) // right edge anchored
    }
    if (g.dirY !== 0 && g.startH !== undefined) {
      h = Math.max(60, Math.round(g.startH + g.dirY * dy))
      if (g.dirY < 0) y = Math.round(g.startCardY + (g.startH - h)) // bottom edge anchored
    }
    setResizePreview({ w, h, x, y })
    // button already released — pointerup was likely missed; commit this move
    // instead of leaving the resize stuck
    if ((e.buttons & 1) === 0) commitResize()
  }

  const onResizeUp = () => commitResize()

  const onResizeCancel = () => {
    // discard rather than commit — reverts to the card's original size
    resizeGesture.current = null
    setResizePreview(null)
  }

  const Body = getCardBody(card.type)
  const w = resizePreview?.w ?? card.w
  const h = resizePreview?.h ?? card.h

  const style: React.CSSProperties = {
    left: resizePreview?.x ?? card.x,
    top: resizePreview?.y ?? card.y,
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
      onPointerCancel={onPointerCancel}
      onContextMenu={(e) => {
        // allow the native menu (spellcheck) inside editable fields; suppress it
        // elsewhere so the card's own context menu is the only one that shows
        if (!(e.target as HTMLElement).closest('input, textarea, [contenteditable="true"]')) e.preventDefault()
      }}
      // cards move via pointer events, so suppress native HTML5 drag (dragging
      // selected text or an image would otherwise show a ghost that follows the
      // cursor); the rich-text editor keeps its own drag for node reordering
      onDragStart={(e) => {
        if (!(e.target as HTMLElement).closest?.('.ProseMirror')) e.preventDefault()
      }}
    >
      <Body card={card} />
      {isSelected &&
        selection.length === 1 &&
        card.type !== 'board' &&
        RESIZE_CORNERS.map(([cls, dirX, dirY]) => (
          <div
            key={cls}
            className={'resize-handle corner ' + cls}
            onPointerDown={onResizeDown(dirX, dirY)}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeUp}
            onPointerCancel={onResizeCancel}
          />
        ))}
      {!lineToolActive &&
        (card.type === 'board' ? BOARD_CONNECT_HANDLES : CONNECT_HANDLES).map(([cls, ax, ay]) => (
          <div
            key={cls}
            className={'connect-handle ' + cls}
            title="Drag to connect"
            onPointerDown={onHandleDown(ax, ay)}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleCancel}
          />
        ))}
    </div>
  )
}
