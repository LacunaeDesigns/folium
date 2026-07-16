import React from 'react'
import { Card } from '../model/types'
import { useFolium, useFoliumStore } from '../store/context'
import { columnCards } from '../store/selectors'
import { SnapGuides, useUi } from '../store/uiStore'
import { getCardBody } from '../cards/registry'
import { resolveCardDrop } from './dropTarget'
import { usePointerDragGesture } from './usePointerDragGesture'
import { Icon } from '../ui/Icons'

// stable reference for non-column cards, so the members subscription below
// never causes them to re-render just because some other card's selection changed
const EMPTY_MEMBERS: Card[] = []

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

// column members render via ColumnMember, not CardShell, so editing one never
// boosts anything on its own — the column itself has to come forward, or an
// editing member's escaped format bar stays covered by a sibling column/card
export function columnContainsSelection(members: Pick<Card, 'id'>[], selection: string[]): boolean {
  return members.some((m) => selection.includes(m.id))
}

// a plain click on a card only ever moves selection, never blurs — so a text
// field focused elsewhere (e.g. a column title clicked earlier) stays "active"
// after selecting a different card, and isTyping()-gated shortcuts like
// Ctrl+C/X silently no-op instead of acting on the new selection
export function blurActiveFormField(): void {
  const active = document.activeElement as HTMLElement | null
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
    active.blur()
  }
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
  // only columns ever need this — non-column cards get the stable EMPTY_MEMBERS
  // reference back, so this subscription is a no-op for the common case
  const members = useFolium((s) => (card.type === 'column' ? columnCards(s, card.id) : EMPTY_MEMBERS))
  const hasSelectedMember = useUi((s) => card.type === 'column' && columnContainsSelection(members, s.selection))
  const isDragging = !!drag && drag.ids.includes(card.id)

  const [resizePreview, setResizePreview] = React.useState<{ w: number; h?: number; x: number; y: number } | null>(null)

  interface CardDragData {
    ids: string[]
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
  }

  const cardDrag = usePointerDragGesture<CardDragData>({
    threshold: DRAG_THRESHOLD,
    onDragStart: (e, data) => {
      // a drag that started on a checkbox/text field cancels its focus and any
      // in-progress text selection, so moving the pointer repositions the card
      // instead of continuing to select text — selection is committed here too,
      // since a plain click on a form field deliberately leaves it untouched
      if (data.fromFormField) {
        useUi.getState().setSelection(data.ids)
        ;(document.activeElement as HTMLElement | null)?.blur()
        window.getSelection()?.removeAllRanges()
      }
      // alt-drag duplicates the selection and drags the copies, leaving originals put
      if (data.alt) {
        const dupIds = store.getState().duplicateCards(data.ids)
        if (dupIds.length) {
          useUi.getState().setSelection(dupIds)
          data.ids = dupIds
        }
        data.alt = false
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
          if (data.ids.includes(el.getAttribute('data-card-id')!)) {
            bx1 = Math.min(bx1, r.x)
            by1 = Math.min(by1, r.y)
            bx2 = Math.max(bx2, r.x + r.w)
            by2 = Math.max(by2, r.y + r.h)
            continue
          }
          if (el.dataset.type === 'ink') continue // full-canvas overlay, not a snap target
          targets.push(r)
        }
        if (bx1 < Infinity) data.bbox = { x: bx1, y: by1, w: bx2 - bx1, h: by2 - by1 }
        data.targets = targets
      }
    },
    onDragMove: (e, data, origin) => {
      // once dragging from a form field, keep suppressing the browser's own
      // text-selection-drag for the rest of the gesture
      if (data.fromFormField) e.preventDefault()
      let dx = (e.clientX - origin.x) / zoom
      let dy = (e.clientY - origin.y) / zoom
      // smart-guide snapping (hold Ctrl to move freely)
      let guides: SnapGuides | null = null
      if (data.bbox && data.targets?.length && !e.ctrlKey) {
        const snapped = snapDelta(data.bbox, data.targets, dx, dy, SNAP_SCREEN_PX / zoom)
        dx = snapped.dx
        dy = snapped.dy
        guides = snapped.guides
      }
      useUi.getState().setSnapGuides(guides)
      data.lastDx = dx
      data.lastDy = dy
      setDrag({ ids: data.ids, dx, dy })
    },
    onDragEnd: (e, data, origin) => {
      // commit the last previewed (snapped) deltas so the drop lands exactly
      // where the preview showed it
      const dx = data.lastDx ?? (e.clientX - origin.x) / zoom
      const dy = data.lastDy ?? (e.clientY - origin.y) / zoom
      useUi.getState().setSnapGuides(null)
      setDrag(null)
      // dropping onto a column moves the cards into it (columns themselves can't nest)
      const s = store.getState()
      const droppable = data.ids.every((id) => s.cards[id] && s.cards[id].type !== 'column')
      if (droppable) {
        const drop = resolveCardDrop(e.clientX, e.clientY, data.ids)
        if (drop?.kind === 'column') {
          data.ids.forEach((id, i) => s.setCardColumn(id, drop.colId, drop.index + i))
          return
        }
        if (drop?.kind === 'unsorted') {
          data.ids.forEach((id) => s.updateCard(id, { inUnsorted: true }))
          return
        }
      }
      if (dx !== 0 || dy !== 0) store.getState().moveCards(data.ids, dx, dy)
    },
    // the browser/OS aborted the gesture outright (e.g. losing capture) — discard
    // rather than commit, so the card snaps back instead of jumping to wherever
    // the pointer happened to be
    onDragCancel: () => {
      useUi.getState().setSnapGuides(null)
      setDrag(null)
    },
    onClick: (e, data) => {
      if (!e.shiftKey && !data.fromFormField) useUi.getState().setSelection([card.id])
    },
  })

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
    if (!fromFormField && !ui.selection.includes(card.id)) {
      // a click on a plain (non-form-field) part of a card only moves
      // selection — it never blurs anything on its own, so a text field left
      // focused elsewhere (e.g. a column title clicked earlier) silently eats
      // the next Ctrl+C/X as "still typing" instead of copying the newly
      // selected card
      blurActiveFormField()
      ui.setSelection([card.id])
    }

    // a locked card is still selectable (above) so it can be unlocked, but it
    // must not arm a drag
    if (card.locked) return

    cardDrag.start(e, {
      ids: fromFormField ? (ui.selection.includes(card.id) ? ui.selection : [card.id]) : useUi.getState().selection,
      alt: e.altKey,
      fromFormField,
    })
  }

  // --- drag-to-connect from an edge handle --- no movement threshold — a
  // handle starts connecting immediately on pointerdown.
  const connectGesture = usePointerDragGesture<{ ax: number; ay: number }>({
    onDragStart: (_e, data) => onConnectStart?.(card.id, data.ax, data.ay),
    onDragMove: (e) => onConnectMove?.(e.clientX, e.clientY),
    onDragEnd: (e) => onConnectEnd?.(e.clientX, e.clientY, e.ctrlKey),
    // off-screen coordinates guarantee no card is found, so this aborts
    // without creating a connection
    onDragCancel: () => onConnectEnd?.(-999999, -999999, false),
  })
  const onHandleDown = (ax: number, ay: number) => (e: React.PointerEvent) => {
    e.stopPropagation()
    if (e.button !== 0) return
    connectGesture.start(e, { ax, ay })
  }

  // --- resize --- dirX/dirY: which edge each handle drives (-1 left/top, +1
  // right/bottom, 0 fixed); the opposite edge stays anchored, so a corner drag
  // resizes diagonally and repositions the card as needed. No movement
  // threshold — a resize handle starts resizing immediately on pointerdown.
  interface ResizeData {
    dirX: number
    dirY: number
    startW: number
    startH?: number
    startCardX: number
    startCardY: number
    /** last computed preview — the commit reads this, not the terminating
     *  event's own coordinates (matches the original: a plain pointerup never
     *  recomputes, it just commits whatever the last move already previewed) */
    preview?: { w: number; h?: number; x: number; y: number }
  }

  const resizeGesture = usePointerDragGesture<ResizeData>({
    onDragMove: (e, data, origin) => {
      const dx = (e.clientX - origin.x) / zoom
      const dy = (e.clientY - origin.y) / zoom
      let w = data.startW
      let h = data.startH
      let x = data.startCardX
      let y = data.startCardY
      if (data.dirX !== 0) {
        w = Math.max(120, Math.round(data.startW + data.dirX * dx))
        if (data.dirX < 0) x = Math.round(data.startCardX + (data.startW - w)) // right edge anchored
      }
      if (data.dirY !== 0 && data.startH !== undefined) {
        h = Math.max(60, Math.round(data.startH + data.dirY * dy))
        if (data.dirY < 0) y = Math.round(data.startCardY + (data.startH - h)) // bottom edge anchored
      }
      data.preview = { w, h, x, y }
      setResizePreview(data.preview)
    },
    onDragEnd: (_e, data) => {
      setResizePreview(null)
      const preview = data.preview
      if (!preview) return
      if (card.type === 'frame') {
        store.getState().resizeFrame(card.id, preview.x, preview.y, preview.w, preview.h ?? card.h ?? 320)
      } else {
        store.getState().updateCard(card.id, { x: preview.x, y: preview.y, w: preview.w, h: preview.h })
      }
    },
    // discard rather than commit — reverts to the card's original size
    onDragCancel: () => setResizePreview(null),
  })

  const onResizeDown = (dirX: number, dirY: number) => (e: React.PointerEvent) => {
    e.stopPropagation()
    if (e.button !== 0) return
    resizeGesture.start(e, {
      dirX,
      dirY,
      startW: card.w,
      startH: card.h,
      startCardX: card.x,
      startCardY: card.y,
    })
  }

  const Body = getCardBody(card.type)
  const w = resizePreview?.w ?? card.w
  const h = resizePreview?.h ?? card.h

  const style: React.CSSProperties = {
    left: resizePreview?.x ?? card.x,
    top: resizePreview?.y ?? card.y,
    width: w,
    height: h,
    zIndex: cardZIndex(card, isSelected || hasSelectedMember),
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
      onPointerMove={cardDrag.onPointerMove}
      onPointerUp={cardDrag.onPointerUp}
      onPointerCancel={cardDrag.onPointerCancel}
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
      {card.locked && (
        <div className="lock-badge" aria-hidden>
          <Icon name="lock" size={12} />
        </div>
      )}
      {isSolo &&
        !card.locked &&
        card.type !== 'board' &&
        RESIZE_CORNERS.map(([cls, dirX, dirY]) => (
          <div
            key={cls}
            className={'resize-handle corner ' + cls}
            onPointerDown={onResizeDown(dirX, dirY)}
            onPointerMove={resizeGesture.onPointerMove}
            onPointerUp={resizeGesture.onPointerUp}
            onPointerCancel={resizeGesture.onPointerCancel}
          />
        ))}
      {!lineToolActive &&
        (card.type === 'board' ? BOARD_CONNECT_HANDLES : CONNECT_HANDLES).map(([cls, ax, ay]) => (
          <div
            key={cls}
            className={'connect-handle ' + cls}
            title="Drag to connect"
            onPointerDown={onHandleDown(ax, ay)}
            onPointerMove={connectGesture.onPointerMove}
            onPointerUp={connectGesture.onPointerUp}
            onPointerCancel={connectGesture.onPointerCancel}
          />
        ))}
    </div>
  )
})
