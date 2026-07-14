/**
 * Pure helpers for connector-line routing math. `elbowPath` is also embedded
 * into the static HTML export via `.toString()` (see src/export/html.ts) —
 * it MUST stay self-contained, with no imports and no closures over anything
 * outside its own arguments.
 */

/**
 * Route an orthogonal (right-angle) connector between (ax,ay) and (bx,by).
 * `aHoriz`/`bHoriz` say whether each end exits horizontally (left/right) vs
 * vertically (top/bottom). Both horizontal → H-V-H through the x midpoint;
 * both vertical → V-H-V through the y midpoint; mixed → a single corner.
 * Returns the path `d` plus the midpoint of the central segment (or the
 * corner itself for the mixed case), used for label/toolbar placement.
 */
export function elbowPath(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  aHoriz: boolean,
  bHoriz: boolean
): { d: string; midX: number; midY: number } {
  if (aHoriz && bHoriz) {
    const midX = (ax + bx) / 2
    return {
      d: `M ${ax} ${ay} L ${midX} ${ay} L ${midX} ${by} L ${bx} ${by}`,
      midX,
      midY: (ay + by) / 2,
    }
  }
  if (!aHoriz && !bHoriz) {
    const midY = (ay + by) / 2
    return {
      d: `M ${ax} ${ay} L ${ax} ${midY} L ${bx} ${midY} L ${bx} ${by}`,
      midX: (ax + bx) / 2,
      midY,
    }
  }
  const cx = aHoriz ? bx : ax
  const cy = aHoriz ? ay : by
  return { d: `M ${ax} ${ay} L ${cx} ${cy} L ${bx} ${by}`, midX: cx, midY: cy }
}

/**
 * Given a quadratic-bezier line from (ax,ay) to (bx,by), solve the `curve`
 * value that would put the curve's visual midpoint at pointer (px,py) —
 * used by the drag-to-bend mid handle. Bails (returns `currentCurve`
 * unchanged) when a/b are coincident. Clamped to [-1.5, 1.5] and snapped to
 * 0 near-straight so it's easy to straighten a line back out.
 */
export function curveFromMidpoint(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
  currentCurve: number
): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-6) return currentCurve
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  const cx = 2 * px - mx
  const cy = 2 * py - my
  let curve = ((cx - mx) * -dy + (cy - my) * dx) / len2
  curve = Math.max(-1.5, Math.min(1.5, curve))
  if (Math.abs(curve) < 0.02) curve = 0
  return curve
}
