import React from 'react'
import { safeCapture } from './coords'

/** Minimal shape of a pointer event the gesture machine reads/calls — satisfied
 *  by React.PointerEvent for real call sites, and by small fake objects in
 *  tests (no jsdom PointerEvent construction needed). */
export interface PointerEventLike {
  clientX: number
  clientY: number
  buttons: number
  pointerId: number
  ctrlKey: boolean
  shiftKey: boolean
  currentTarget: EventTarget | null
  preventDefault: () => void
}

export interface PointerDragOrigin {
  x: number
  y: number
}

export interface PointerDragCallbacks<TData> {
  /** px of movement (from the pointerdown point) before the drag "really"
   *  starts; 0 or omitted (the default) starts dragging immediately, at the
   *  moment `start` is called — matching resize/connect-handle, which have no
   *  click-vs-drag distinction at all. */
  threshold?: number
  /** Fires once, exactly when the drag transitions from armed to actually
   *  dragging (threshold crossed, or immediately when threshold is 0).
   *  Pointer capture (via the codebase's safeCapture) happens immediately
   *  before this fires, using the same event's target/pointerId. */
  onDragStart?: (e: PointerEventLike, data: TData, origin: PointerDragOrigin) => void
  /** Fires on every move once dragging (never before the threshold is
   *  crossed). */
  onDragMove: (e: PointerEventLike, data: TData, origin: PointerDragOrigin) => void
  /** Fires once dragging ends: either a normal pointerup, or a move event that
   *  reports the primary button already released (pointer capture was
   *  silently lost — recover here rather than leave the gesture stuck). */
  onDragEnd: (e: PointerEventLike, data: TData, origin: PointerDragOrigin) => void
  /** Fires on pointercancel, but only if the drag had actually started
   *  dragging — reset without committing anything. */
  onDragCancel?: (data: TData) => void
  /** Fires instead of onDragEnd when the gesture ends (pointerup, or the same
   *  buttons-lost recovery above) before the threshold was ever crossed —
   *  i.e. a plain click. Never fires when threshold is 0. */
  onClick?: (e: PointerEventLike, data: TData) => void
}

export interface PointerDragGesture<TData> {
  /** Call from the element's own onPointerDown, after it has already filtered
   *  out the buttons/targets it doesn't want to start a drag (right-click,
   *  buttons/links, etc.), with whatever per-gesture data this drag needs. */
  start: (e: PointerEventLike, data: TData) => void
  onPointerMove: (e: PointerEventLike) => void
  onPointerUp: (e: PointerEventLike) => void
  onPointerCancel: () => void
}

export interface GestureState<TData> {
  startX: number
  startY: number
  dragging: boolean
  data: TData
}

/** Anything with a mutable `.current` — a React ref, or (in tests) a plain
 *  `{ current: null }` object. */
export interface MutableRef<T> {
  current: T
}

/** The actual "threshold drag + pointer capture + cancel/recovery" state
 *  machine, factored out of the four hand-rolled copies in CardShell
 *  (card-drag, connect-handle, resize) and ColumnCard (ColumnMember). Each
 *  call site keeps its own click-vs-drag pre-filtering and its own
 *  per-gesture payload (`TData`, a plain mutable object it can read/write
 *  across callbacks); this factory only owns the arm -> threshold -> capture
 *  -> move -> commit/cancel shape, so it never has to be re-implemented (and
 *  re-fixed) per call site.
 *
 *  Plain, framework-free factory (no React hooks) so the state machine can be
 *  unit-tested directly — see usePointerDragGesture.test.ts. `usePointerDragGesture`
 *  below is a thin React wrapper around it. */
export function createPointerDragGesture<TData = undefined>(
  callbacks: PointerDragCallbacks<TData>,
  stateRef: MutableRef<GestureState<TData> | null>,
): PointerDragGesture<TData> {
  const threshold = callbacks.threshold ?? 0

  return {
    start(e, data) {
      const dragging = threshold <= 0
      stateRef.current = { startX: e.clientX, startY: e.clientY, dragging, data }
      if (dragging) {
        safeCapture(e.currentTarget as Element, e.pointerId)
        callbacks.onDragStart?.(e, data, { x: e.clientX, y: e.clientY })
      }
    },

    onPointerMove(e) {
      const st = stateRef.current
      if (!st) return
      const origin: PointerDragOrigin = { x: st.startX, y: st.startY }
      // the primary button is no longer held — capture was silently lost
      // (e.g. the OS aborted the gesture without ever firing pointercancel);
      // recover by finishing right here instead of leaving the gesture stuck
      if ((e.buttons & 1) === 0) {
        stateRef.current = null
        if (st.dragging) callbacks.onDragEnd(e, st.data, origin)
        else callbacks.onClick?.(e, st.data)
        return
      }
      if (!st.dragging) {
        if (threshold > 0 && Math.hypot(e.clientX - st.startX, e.clientY - st.startY) < threshold) return
        st.dragging = true
        safeCapture(e.currentTarget as Element, e.pointerId)
        callbacks.onDragStart?.(e, st.data, origin)
      }
      callbacks.onDragMove(e, st.data, origin)
    },

    onPointerUp(e) {
      const st = stateRef.current
      stateRef.current = null
      if (!st) return
      const origin: PointerDragOrigin = { x: st.startX, y: st.startY }
      if (st.dragging) callbacks.onDragEnd(e, st.data, origin)
      else callbacks.onClick?.(e, st.data)
    },

    onPointerCancel() {
      const st = stateRef.current
      stateRef.current = null
      if (st?.dragging) callbacks.onDragCancel?.(st.data)
    },
  }
}

/** React wrapper: keeps the in-progress gesture state in a ref (persists
 *  across renders) and rebuilds the callback-closures fresh every render —
 *  same non-memoized idiom CardShell already uses for its own handlers, so
 *  callers never need to worry about stale props/state inside a callback. */
export function usePointerDragGesture<TData = undefined>(
  callbacks: PointerDragCallbacks<TData>,
): PointerDragGesture<TData> {
  const stateRef = React.useRef<GestureState<TData> | null>(null)
  return createPointerDragGesture(callbacks, stateRef)
}
