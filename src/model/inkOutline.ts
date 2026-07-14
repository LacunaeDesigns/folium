/**
 * Pure helpers for rendering variable-width ink strokes from per-point
 * pressure data. Shared by InkLayer (live drawing) and InkCard (canvas).
 * `strokeOutlinePath` is also embedded into the static HTML export via
 * `.toString()` (see src/export/html.ts) — it MUST stay self-contained,
 * with no closures over anything outside its own arguments.
 */

interface OutlinePt {
  x: number
  y: number
}

/** True if the pressures carry real per-point variation — not just the
 *  mouse/no-sensor default (constant 0.5) or the browser's constant-0 fallback. */
export function hasMeaningfulPressure(pressures: number[]): boolean {
  return pressures.some((p) => p !== 0 && p !== 0.5)
}

/**
 * Build a filled outline polygon (SVG path `d`) for a variable-width stroke.
 * `points` are flat [x0,y0,x1,y1,...] pairs; `pressures` has one 0..1 value
 * per point. Half-width is scaled roughly 0.4x-1.6x by pressure and smoothed
 * with neighbors. Returns '' for degenerate input (fewer than 2 points).
 */
export function strokeOutlinePath(points: number[], pressures: number[], baseWidth: number): string {
  const n = Math.min(Math.floor(points.length / 2), pressures.length)
  if (n < 2) return ''
  const smoothed: number[] = []
  for (let i = 0; i < n; i++) {
    const a = pressures[Math.max(0, i - 1)]
    const b = pressures[i]
    const c = pressures[Math.min(n - 1, i + 1)]
    smoothed.push((a + b + c) / 3)
  }
  const left: OutlinePt[] = []
  const right: OutlinePt[] = []
  for (let i = 0; i < n; i++) {
    const x = points[i * 2]
    const y = points[i * 2 + 1]
    const px = i > 0 ? points[(i - 1) * 2] : x
    const py = i > 0 ? points[(i - 1) * 2 + 1] : y
    const nx = i < n - 1 ? points[(i + 1) * 2] : x
    const ny = i < n - 1 ? points[(i + 1) * 2 + 1] : y
    const len = Math.hypot(nx - px, ny - py)
    const ox = len > 1e-6 ? -(ny - py) / len : 0
    const oy = len > 1e-6 ? (nx - px) / len : 0
    const p = Math.max(0, Math.min(1, smoothed[i]))
    const hw = (baseWidth / 2) * (0.4 + p * 1.2)
    left.push({ x: x + ox * hw, y: y + oy * hw })
    right.push({ x: x - ox * hw, y: y - oy * hw })
  }
  const all = left.concat(right.reverse())
  let d = `M ${all[0].x} ${all[0].y}`
  for (let i = 1; i < all.length; i++) d += ` L ${all[i].x} ${all[i].y}`
  return d + ' Z'
}
