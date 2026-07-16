import { BoardView } from '../store/uiStore'

/** world-space spacing of the canvas dot grid; must match the
 *  `background-size` values in src/styles/global.css (currently 24px 24px). */
export const GRID_SIZE = 24

export interface Pt {
  x: number
  y: number
}

/** setPointerCapture that tolerates already-released/synthetic pointers */
export function safeCapture(el: Element, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId)
  } catch {
    /* pointer already gone — gesture still works via bubbling */
  }
}

/** screen (client) px inside the canvas element -> world coordinates */
export function screenToWorld(view: BoardView, sx: number, sy: number): Pt {
  return { x: (sx - view.pan.x) / view.zoom, y: (sy - view.pan.y) / view.zoom }
}

export function worldToScreen(view: BoardView, wx: number, wy: number): Pt {
  return { x: wx * view.zoom + view.pan.x, y: wy * view.zoom + view.pan.y }
}

export function clampZoom(z: number): number {
  return Math.min(2.5, Math.max(0.15, z))
}

/** zoom keeping the given screen point fixed */
export function zoomAt(view: BoardView, sx: number, sy: number, nextZoom: number): BoardView {
  const z = clampZoom(nextZoom)
  const wx = (sx - view.pan.x) / view.zoom
  const wy = (sy - view.pan.y) / view.zoom
  return { zoom: z, pan: { x: sx - wx * z, y: sy - wy * z } }
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function normRect(x1: number, y1: number, x2: number, y2: number): Rect {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  }
}
