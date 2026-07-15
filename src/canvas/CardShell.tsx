import React from 'react'
import { Card } from '../model/types'
import { useFoliumStore } from '../store/context'
import { SnapGuides, useUi } from '../store/uiStore'
import { getCardBody } from '../cards/registry'
import { safeCapture } from './coords'
import { resolveCardDrop } from './dropTarget'

export interface DragState {
  ids: string[]
  dx: number
  dy: number
}

// selected cards render above the rest of the stack so their format bar,
// resize handles and connect handles are always clickable, even when a
// higher-z sibling card would otherwise sit in front of the whole thing —
// the boost stays well below .snap-guide (9999) / .lines-layer (10000) in
// canvas.css, which must always render above every card regardless of
// selection
const SELECTED_Z_BOOST = 5000

export function cardZIndex(card: Card, isSelected: boolean): number {
  // frames always render behind regular cards, regardless of their own z
  if (card.type === 'frame') return card.z - 1_000_000
  return isSelected ? card.z + SELECTED_Z_BOOST : card.z
}

interface WRect {
  x: number
  y: number
  w: number
  h: number
}

/** how close (in screen px) a card edge must be to another card's edge to snap */
const SNAP_SCREEN_PX = 6

/** Snap a dragged bounding box against static card rects: if any edge/center of
 *  the moved bbox lands within threshold of a target's edge/center, nudge dx/dy
 *  so they coincide, and describe guide lines (world coords) for the overlay. */
function snapDelta(
  bbox: WRect,
  targets: WRect[],
  dx: number,
  dy: number,
  th: number,
): { dx: number; dy: number; guides: SnapGuides | null } {
  const mx = bbox.x + dx
  const my = bbox.y + dy
  const candX = [mx, mx + bbox.w / 2, mx + bbox.w]
  const candY = [my, my + bbox.h / 2, my + bbox.h]
  let bestX: { adj: number; at: number; t: WRect } | null = null
  let bestY: { adj: number; at: number; t: WRect } | null = null
  for (const t of targets) {
    for (const tx of [t.x, t.x + t.w / 2, t.x + t.w]) {
      for (const cx of candX) {
        const d = tx - cx
        if (Math.abs(d) <= th && (!bestX || Math.abs(d) < Math.abs(bestX.adj))) bestX = { adj: d, at: tx, t }
      }
    }
    for (const ty of [t.y, t.y + t.h / 2, t.y + t.h]) {
      for (const cy of candY) {
        const d = ty - cy
        if (Math.abs(d) <= th && (!bestY || Math.abs(d) < Math.abs(bestY.adj))) bestY = { adj: d, at: ty, t }
      }
    }
  }
  const sdx = dx + (bestX?.adj ?? 0)
  const sdy = dy + (bestY?.adj ?? 0)
  if (!bestX && !bestY) return { dx, dy, guides: null }
  const fx = bbox.x + sdx
  const fy = bbox.y + sdy
  return {
    dx: sdx,
    dy: sdy,
    guides: {
      v: bestX
        ? { x: bestX.at, y1: Math.min(fy, bestX.t.y), y2: Math.max(fy + bbox.h, bestX.t.y + bestX.t.h) }
        : null,
      h: bestY
        ? { y: bestY.at, x1: Math.min(fx, bestY.t.x), x2: Math.max(fx + bbox.w, bestY.t.x + bestY.t.w) }
        : null,
    },
  }
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
  onConnectEnd?: (clientX: number, clientY: number, ctrlKey: boolean) => void
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

export const CardShell = React.memo(function CardShell({ card, zoom, drag, setDrag, onContextMenu, lineToolActive, onLineAnchor, onConnectStart, onConnectMove, onConnectEnd }: CardShellProps) {
  const store = useFoliumStore()
  // per-card boolean selectors so selecting card A doesn't re-render card B
  const isSelected = useUi((s) => s.selection.includes(card.id))
  const isSolo = useUi((s) => s.selection.length === 1 && s.selection[0] === card.id)
  const isDragging = !!drag && drag.ids.includes(card.id)

  const [resizePreview, setResizePreview] = React.useState<{ w: number; h?: number; x: number; y: number } | null>(null)

  const gesture = React.useRef<{
    startX: number
    startY: number
    ids: string[]
    dragging: boolean
    /** Alt held at drag start — duplicate the selection and drag the copies */
    alt: boolean
    /** started on an input/textarea — a drag past the threshold cancels focus/text-selection */
    fromFormField: boolean
    /** snap candidates + dragged bbox, measured once when the drag starts */
    targets?: WRect[]
    bbox?: WRect
    /** last applied (possibly snapped) deltas — the commit must use these, not
     *  raw pointer deltas, or the card would jump off its snapped position */
    lastDx?: number
    lastDy?: number
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

    // buttons/links/rich-text content/opt-outs never participate in a card drag —
    // a checkbox or plain text field still can (see fromFormField below), so a
    // click-and-move past the threshold drags the card instead of placing a
    // cursor or selecting text, while a plain click still focuses/types/toggles
    // exactly as before
    const target = e.target as HTMLElement
    if (target.closest('button, a, [contenteditable="true"], .no-drag')) {
      return
    }
    const fromFormField = !!target.closest('input, textarea')

    const ui = useUi.getState()
    if (e.shiftKey) {
      if (fromFormField) return // preserve existing shift-click behavior on form fields
      ui.toggleSelect(card.id)
      return
    }
    // a plain click into a checkbox/text field must NOT change selection — only
    // committing to an actual drag (past the threshold, in onPointerMove) should,
    // otherwise merely clicking to type would select the card, and a stray
    // keystroke afterward could trigger the global "delete selected cards"
    // shortcut instead of being a harmless no-op
    if (!fromFormField && !ui.selection.includes(card.id)) ui.setSelection([card.id])

    gesture.current = {
      startX: e.clientX,
      startY: e.clientY,
      ids: fromFormField ? (ui.selection.includes(card.id) ? ui.selection : [card.id]) : useUi.getState().selection,
      dragging: false,
      alt: e.altKey,
      fromFormField,
    }
  }

  // shared by pointerup and by the "button already released" fallback below —
  // finishes the drag exactly as a normal release would
  const finishDrag = (g: NonNullable<typeof gesture.current>, clientX: number, clientY: number) => {
    // commit the last previewed (snapped) deltas so the drop lands exactly
    // where the preview showed it
    const dx = g.lastDx ?? (clientX - g.startX) / zoom
    const dy = g.lastDy ?? (clientY - g.startY) / zoom
    useUi.getState().setSnapGuides(null)
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
      else if (!e.shiftKey && !g.fromFormField) useUi.getState().setSelection([card.id])
      return
    }
    let dx = (e.clientX - g.startX) / zoom
    let dy = (e.clientY - g.startY) / zoom
    if (!g.dragging) {
      if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < DRAG_THRESHOLD) return
      g.dragging = true
      // capture only once a drag starts — capturing on pointerdown retargets the
      // ensuing click/dblclick to the shell, killing double-click on card bodies
      safeCapture(e.currentTarget as HTMLElement, e.pointerId)
      // a drag that started on a checkbox/text field cancels its focus and any
      // in-progress text selection, so moving the pointer repositions the card
      // instead of continuing to select text — selection is committed here too,
      // since a plain click on a form field deliberately leaves it untouched
      if (g.fromFormField) {
        useUi.getState().setSelection(g.ids)
        ;(document.activeElement as HTMLElement | null)?.blur()
        window.getSelection()?.removeAllRanges()
      }
      // alt-drag duplicates the selection and drags the copies, leaving originals put
      if (g.alt) {
        const dupIds = store.getState().duplicateCards(g.ids)
        if (dupIds.length) {
          useUi.getState().setSelection(dupIds)
          g.ids = dupIds
        }
        g.alt = false
      }
      // measure snap candidates once per drag: every other top-level card on
      // the canvas (world coords), plus the dragged selection's bounding box
      const worldEl = (e.currentTarget as HTMLElement).closest('.canvas-world') as HTMLElement | null
      if (worldEl) {
        const o = worldEl.getBoundingClientRect()
        const toW = (r: DOMRect): WRect => ({
          x: (r.left - o.left) / zoom,
          y: (r.top - o.top) / zoom,
          w: r.width / zoom,
          h: r.height / zoom,
        })
        const targets: WRect[] = []
        let bx1 = Infinity, by1 = Infinity, bx2 = -Infinity, by2 = -Infinity
        for (const el of Array.from(worldEl.querySelectorAll<HTMLElement>(':scope > .card-shell[data-card-id]'))) {
          const r = toW(el.getBoundingClientRect())
          if (g.ids.includes(el.getAttribute('data-card-id')!)) {
            bx1 = Math.min(bx1, r.x)
            by1 = Math.min(by1, r.y)
            bx2 = Math.max(bx2, r.x + r.w)
            by2 = Math.max(by2, r.y + r.h)
            continue
          }
          if (el.dataset.type === 'ink') continue // full-canvas overlay, not a snap target
          targets.push(r)
        }
        if (bx1 < Infinity) g.bbox = { x: bx1, y: by1, w: bx2 - bx1, h: by2 - by1 }
        g.targets = targets
      }
    }
    // once dragging from a form field, keep suppressing the browser's own
    // text-selection-drag for the rest of the gesture
    if (g.fromFormField) e.preventDefault()
    // smart-guide snapping (hold Ctrl to move freely)
    let guides: SnapGuides | null = null
    if (g.bbox && g.targets?.length && !e.ctrlKey) {
      const snapped = snapDelta(g.bbox, g.targets, dx, dy, SNAP_SCREEN_PX / zoom)
      dx = snapped.dx
      dy = snapped.dy
      guides = snapped.guides
    }
    useUi.getState().setSnapGuides(guides)
    g.lastDx = dx
    g.lastDy = dy
    setDrag({ ids: g.ids, dx, dy })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    if (g.dragging) {
      finishDrag(g, e.clientX, e.clientY)
    } else if (!e.shiftKey && !g.fromFormField) {
      useUi.getState().setSelection([card.id])
    }
  }

  // the browser/OS aborted the gesture outright (e.g. losing capture) — discard
  // rather than commit, so the card snaps back instead of jumping to wherever
  // the pointer happened to be
  const onPointerCancel = () => {
    const g = gesture.current
    gesture.current = null
    if (g?.dragging) {
      useUi.getState().setSnapGuides(null)
      setDrag(null)
    }
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
      onConnectEnd?.(e.clientX, e.clientY, e.ctrlKey)
      return
    }
    onConnectMove?.(e.clientX, e.clientY)
  }
  const onHandleUp = (e: React.PointerEvent) => {
    if (!connecting.current) return
    connecting.current = false
    onConnectEnd?.(e.clientX, e.clientY, e.ctrlKey)
  }
  const onHandleCancel = () => {
    if (!connecting.current) return
    connecting.current = false
    // off-screen coordinates guarantee no card is found, so this aborts
    // without creating a connection
    onConnectEnd?.(-999999, -999999, false)
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
      if (preview) {
        if (card.type === 'frame') {
          store.getState().resizeFrame(card.id, preview.x, preview.y, preview.w, preview.h ?? card.h ?? 320)
        } else {
          store.getState().updateCard(card.id, { x: preview.x, y: preview.y, w: preview.w, h: preview.h })
        }
      }
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
    zIndex: cardZIndex(card, isSelected),
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
      {isSolo &&
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
})
