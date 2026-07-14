import React from 'react'
import { Line, LineEnd } from '../model/types'
import { curveFromMidpoint, elbowPath } from '../model/lineRoute'
import { useFolium, useFoliumStore } from '../store/context'
import { linesOnBoard } from '../store/selectors'
import { BoardView, useUi } from '../store/uiStore'
import { Icon } from '../ui/Icons'
import { DragState } from './CardShell'
import { Pt, Rect } from './coords'

const LINE_COLORS: (string | null)[] = [null, '#e6553f', '#4f8cf0', '#3fae5c']

interface WorldRects {
  get(cardId: string): Rect | null
}

/** Measure a card's world rect from the DOM (accounts for live drag transforms).
 *  Positions are measured RELATIVE to the transformed world origin (originEl, the
 *  lines layer itself, which sits at world 0,0), so the pan cancels out — measuring
 *  against the untransformed viewport minus view.pan drifts by a frame while panning. */
function makeRectSource(originEl: Element | null, viewportEl: HTMLElement | null, zoom: number): WorldRects {
  const cache = new Map<string, Rect | null>()
  const origin = originEl?.getBoundingClientRect()
  return {
    get(cardId: string) {
      if (cache.has(cardId)) return cache.get(cardId)!
      let rect: Rect | null = null
      if (origin && viewportEl) {
        const el = viewportEl.querySelector(`[data-card-id="${cardId}"]`)
        if (el) {
          const r = (el as HTMLElement).getBoundingClientRect()
          rect = {
            x: (r.left - origin.left) / zoom,
            y: (r.top - origin.top) / zoom,
            w: r.width / zoom,
            h: r.height / zoom,
          }
        }
      }
      cache.set(cardId, rect)
      return rect
    },
  }
}

// Attach to the side the user dropped the end on (ax, ay normalized), at that
// position along the edge — not the auto-picked facing edge.
function edgeAnchor(r: Rect, ax: number, ay: number): Pt {
  const px = r.x + ax * r.w
  const py = r.y + ay * r.h
  const dx = px - (r.x + r.w / 2)
  const dy = py - (r.y + r.h / 2)
  if (Math.abs(dx) * r.h > Math.abs(dy) * r.w) {
    return { x: dx > 0 ? r.x + r.w : r.x, y: py }
  }
  return { x: px, y: dy > 0 ? r.y + r.h : r.y }
}

function endPoint(end: LineEnd, rects: WorldRects, toward: Pt): Pt | null {
  if ('cardId' in end) {
    const r = rects.get(end.cardId)
    if (!r) return null
    // a hand-placed end sticks to the side it was dropped on
    if (end.ax != null && end.ay != null) return edgeAnchor(r, end.ax, end.ay)
    const cx = r.x + r.w / 2
    const cy = r.y + r.h / 2
    const dx = toward.x - cx
    const dy = toward.y - cy
    // pick the side facing the other end
    if (Math.abs(dx) * r.h > Math.abs(dy) * r.w) {
      return { x: dx > 0 ? r.x + r.w : r.x, y: cy }
    }
    return { x: cx, y: dy > 0 ? r.y + r.h : r.y }
  }
  return { x: end.x, y: end.y }
}

function centerOf(end: LineEnd, rects: WorldRects): Pt | null {
  if ('cardId' in end) {
    const r = rects.get(end.cardId)
    if (!r) return null
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
  }
  return { x: end.x, y: end.y }
}

// Direction an end's connection point exits, for elbow routing. Card-attached
// ends sit exactly on one edge of the rect (endPoint/edgeAnchor put them
// there); free ends pick the dominant axis toward the other point.
function isHorizontalEnd(end: LineEnd, point: Pt, other: Pt, rects: WorldRects): boolean {
  if ('cardId' in end) {
    const r = rects.get(end.cardId)
    if (!r) return true
    return Math.abs(point.x - r.x) < 0.5 || Math.abs(point.x - (r.x + r.w)) < 0.5
  }
  return Math.abs(other.x - point.x) >= Math.abs(other.y - point.y)
}

export function linePath(a: Pt, b: Pt, curve: number): { d: string; mid: Pt } {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = b.x - a.x
  const dy = b.y - a.y
  const cx = mx - dy * curve
  const cy = my + dx * curve
  return {
    d: `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`,
    mid: { x: (a.x + 2 * cx + b.x) / 4, y: (a.y + 2 * cy + b.y) / 4 },
  }
}

export function LinesLayer({
  boardId,
  view,
  viewportEl,
  drag,
  pendingFrom,
  cursor,
}: {
  boardId: string
  view: BoardView
  viewportEl: HTMLElement | null
  drag: DragState | null
  /** line-tool in-progress start end */
  pendingFrom: LineEnd | null
  /** world cursor position for pending preview */
  cursor: Pt | null
}) {
  const store = useFoliumStore()
  const lines = useFolium((s) => linesOnBoard(s, boardId))
  const selectedLine = useUi((s) => s.selectedLine)
  const [labelEdit, setLabelEdit] = React.useState<string | null>(null)
  const [endDrag, setEndDragState] = React.useState<{ lineId: string; which: 'from' | 'to'; pt: Pt } | null>(null)
  // ref mirror — pointer events can all land between renders
  const endDragRef = React.useRef<typeof endDrag>(null)
  const setEndDrag = (v: typeof endDrag) => {
    endDragRef.current = v
    setEndDragState(v)
  }
  const [midDrag, setMidDragState] = React.useState<{ lineId: string; a: Pt; b: Pt; curve: number } | null>(null)
  const midDragRef = React.useRef<typeof midDrag>(null)
  const setMidDrag = (v: typeof midDrag) => {
    midDragRef.current = v
    setMidDragState(v)
  }
  const [bodyDrag, setBodyDragState] = React.useState<{
    lineId: string
    start: Pt
    origFrom: LineEnd
    origTo: LineEnd
    from: LineEnd
    to: LineEnd
  } | null>(null)
  const bodyDragRef = React.useRef<typeof bodyDrag>(null)
  const setBodyDrag = (v: typeof bodyDrag) => {
    bodyDragRef.current = v
    setBodyDragState(v)
  }
  // the SVG sits at world origin inside the transformed canvas-world; measuring
  // against it (not the viewport + view.pan) keeps lines glued to cards while panning
  const svgRef = React.useRef<SVGSVGElement>(null)
  // Cards' DOM geometry (size/position) changes in the very same commit that
  // resizes/zooms/drags them, so reading getBoundingClientRect() during *this*
  // render sees the pre-commit layout — one render stale. useLayoutEffect runs
  // synchronously right after commit (before paint), so bumping state there
  // forces one more render that measures the already-committed DOM, with no
  // visible flash of the stale position.
  //
  // This runs after every commit (no dependency array) rather than only when
  // `drag`/`zoom`/`lines.length` change: a plain drag-and-drop's card-move commit
  // doesn't reliably touch any of those three (depends on how React batches the
  // drag-end state update against the store commit), so gating on them left some
  // drops permanently one render stale until an unrelated re-render (e.g. panning)
  // happened to measure fresh DOM. The ref guards against looping — it only ever
  // schedules one catch-up render per real commit.
  const caughtUpRef = React.useRef(false)
  const [, setTick] = React.useState(0)
  React.useLayoutEffect(() => {
    if (caughtUpRef.current) {
      caughtUpRef.current = false
      return
    }
    caughtUpRef.current = true
    setTick((v) => v + 1)
  })

  const rects = makeRectSource(svgRef.current, viewportEl, view.zoom)

  const toWorld = (clientX: number, clientY: number): Pt => {
    const o = svgRef.current?.getBoundingClientRect()
    if (!o) return { x: 0, y: 0 }
    return { x: (clientX - o.left) / view.zoom, y: (clientY - o.top) / view.zoom }
  }

  const onEndPointerDown = (line: Line, which: 'from' | 'to') => (e: React.PointerEvent) => {
    e.stopPropagation()
    const el = e.currentTarget as Element
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* synthetic */
    }
    setEndDrag({ lineId: line.id, which, pt: toWorld(e.clientX, e.clientY) })
  }

  const onEndPointerMove = (e: React.PointerEvent) => {
    const cur = endDragRef.current
    if (!cur) return
    setEndDrag({ ...cur, pt: toWorld(e.clientX, e.clientY) })
  }

  const onEndPointerUp = (e: React.PointerEvent) => {
    const cur = endDragRef.current
    if (!cur) return
    const { lineId, which } = cur
    setEndDrag(null)
    // attach to a card if released over one, remembering where on the card the
    // end was dropped so it sticks to that side
    const stack = document.elementsFromPoint(e.clientX, e.clientY)
    let end: LineEnd = toWorld(e.clientX, e.clientY)
    for (const el of stack) {
      const shell = (el as HTMLElement).closest?.('[data-card-id]')
      if (shell) {
        const cardId = shell.getAttribute('data-card-id')!
        const r = rects.get(cardId)
        if (r && r.w && r.h) {
          const w = toWorld(e.clientX, e.clientY)
          const ax = Math.min(1, Math.max(0, (w.x - r.x) / r.w))
          const ay = Math.min(1, Math.max(0, (w.y - r.y) / r.h))
          end = { cardId, ax, ay }
        } else {
          end = { cardId }
        }
        break
      }
    }
    store.getState().updateLine(lineId, { [which]: end } as Partial<Line>)
  }

  const onMidPointerDown = (line: Line, a: Pt, b: Pt) => (e: React.PointerEvent) => {
    e.stopPropagation()
    const el = e.currentTarget as Element
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* synthetic */
    }
    setMidDrag({ lineId: line.id, a, b, curve: line.curve })
  }

  const onMidPointerMove = (e: React.PointerEvent) => {
    const cur = midDragRef.current
    if (!cur) return
    const p = toWorld(e.clientX, e.clientY)
    const curve = curveFromMidpoint(cur.a.x, cur.a.y, cur.b.x, cur.b.y, p.x, p.y, cur.curve)
    setMidDrag({ ...cur, curve })
  }

  const onMidPointerUp = (e: React.PointerEvent) => {
    const cur = midDragRef.current
    if (!cur) return
    setMidDrag(null)
    store.getState().updateLine(cur.lineId, { curve: cur.curve })
  }

  const translateEnd = (end: LineEnd, dx: number, dy: number): LineEnd => {
    if ('cardId' in end) return end
    return { x: end.x + dx, y: end.y + dy }
  }

  const onBodyPointerDown = (line: Line) => (e: React.PointerEvent) => {
    e.stopPropagation()
    if (e.button !== 0) return
    const wasSelected = selectedLine === line.id
    useUi.getState().setSelectedLine(line.id)
    if (!wasSelected) return
    const el = e.currentTarget as Element
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* synthetic */
    }
    setBodyDrag({
      lineId: line.id,
      start: toWorld(e.clientX, e.clientY),
      origFrom: line.from,
      origTo: line.to,
      from: line.from,
      to: line.to,
    })
  }

  const onBodyPointerMove = (e: React.PointerEvent) => {
    const cur = bodyDragRef.current
    if (!cur) return
    const pt = toWorld(e.clientX, e.clientY)
    const dx = pt.x - cur.start.x
    const dy = pt.y - cur.start.y
    setBodyDrag({ ...cur, from: translateEnd(cur.origFrom, dx, dy), to: translateEnd(cur.origTo, dx, dy) })
  }

  const onBodyPointerUp = (e: React.PointerEvent) => {
    const cur = bodyDragRef.current
    if (!cur) return
    setBodyDrag(null)
    store.getState().updateLine(cur.lineId, { from: cur.from, to: cur.to })
  }

  const renderLine = (line: Line) => {
    const dragging = endDrag?.lineId === line.id ? endDrag : null
    const dragBody = bodyDrag?.lineId === line.id ? bodyDrag : null
    const fromEnd: LineEnd = dragging?.which === 'from'
      ? dragging.pt
      : dragBody
        ? dragBody.from
        : line.from
    const toEnd: LineEnd = dragging?.which === 'to'
      ? dragging.pt
      : dragBody
        ? dragBody.to
        : line.to

    const cFrom = centerOf(fromEnd, rects)
    const cTo = centerOf(toEnd, rects)
    if (!cFrom || !cTo) return null
    const a = endPoint(fromEnd, rects, cTo)
    const b = endPoint(toEnd, rects, cFrom)
    if (!a || !b) return null

    const dragMid = midDrag?.lineId === line.id ? midDrag : null
    const curve = dragMid ? dragMid.curve : line.curve
    let d: string
    let mid: Pt
    if (line.elbow) {
      const aHoriz = isHorizontalEnd(fromEnd, a, b, rects)
      const bHoriz = isHorizontalEnd(toEnd, b, a, rects)
      const routed = elbowPath(a.x, a.y, b.x, b.y, aHoriz, bHoriz)
      d = routed.d
      mid = { x: routed.midX, y: routed.midY }
    } else {
      const straight = linePath(a, b, curve)
      d = straight.d
      mid = straight.mid
    }
    const isSel = selectedLine === line.id

    return (
      <g key={line.id} className={'line-g' + (isSel ? ' selected' : '')}>
        <path
          className="line-hit"
          d={d}
          onPointerDown={onBodyPointerDown(line)}
          onPointerMove={onBodyPointerMove}
          onPointerUp={onBodyPointerUp}
          onDoubleClick={(e) => {
            e.stopPropagation()
            setLabelEdit(line.id)
          }}
        />
        <path
          className="line-vis"
          d={d}
          // inline style (not SVG presentation attrs) so per-line overrides beat
          // the .line-vis class rules; undefined falls back to the stylesheet
          style={{
            stroke: line.color ?? undefined,
            strokeWidth: line.width ?? undefined,
            strokeDasharray: line.dash ? '6 6' : undefined,
          }}
          markerEnd={line.arrowEnd ? 'url(#arrowhead)' : undefined}
          markerStart={line.arrowStart ? 'url(#arrowhead-start)' : undefined}
        />
        {line.label && labelEdit !== line.id && (
          <text className="line-label" x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="middle">
            {line.label}
          </text>
        )}
        {isSel && (
          <>
            <circle
              className="line-end"
              cx={a.x}
              cy={a.y}
              r={6 / view.zoom}
              onPointerDown={onEndPointerDown(line, 'from')}
              onPointerMove={onEndPointerMove}
              onPointerUp={onEndPointerUp}
            />
            <circle
              className="line-end"
              cx={b.x}
              cy={b.y}
              r={6 / view.zoom}
              onPointerDown={onEndPointerDown(line, 'to')}
              onPointerMove={onEndPointerMove}
              onPointerUp={onEndPointerUp}
            />
            {!line.elbow && (
              <circle
                className="line-mid"
                cx={mid.x}
                cy={mid.y}
                r={6 / view.zoom}
                onPointerDown={onMidPointerDown(line, a, b)}
                onPointerMove={onMidPointerMove}
                onPointerUp={onMidPointerUp}
              />
            )}
          </>
        )}
        {isSel && (
          <foreignObject x={mid.x - 135} y={mid.y + 12} width={280} height={36} className="line-toolbar-fo">
            <div className="line-toolbar no-drag" onPointerDown={(e) => e.stopPropagation()}>
              <button
                className={line.arrowStart ? 'on' : ''}
                title="Arrowhead at start"
                onClick={() => store.getState().updateLine(line.id, { arrowStart: !line.arrowStart })}
              >
                ⟵
              </button>
              <button
                className={line.arrowEnd ? 'on' : ''}
                title="Arrowhead at end"
                onClick={() => store.getState().updateLine(line.id, { arrowEnd: !line.arrowEnd })}
              >
                ⟶
              </button>
              <button
                title="Straight / curved"
                onClick={() =>
                  store.getState().updateLine(
                    line.id,
                    line.elbow ? { elbow: false, curve: 0.2 } : { curve: line.curve === 0 ? 0.2 : 0 }
                  )
                }
              >
                ~
              </button>
              <button
                className={line.elbow ? 'on' : ''}
                title="Elbow line"
                onClick={() => store.getState().updateLine(line.id, { elbow: !line.elbow })}
              >
                ⌐
              </button>
              <button title="Label" onClick={() => setLabelEdit(line.id)}>
                Aa
              </button>
              <button
                className={line.width === 4 ? 'on' : ''}
                title="Thin / thick"
                onClick={() => store.getState().updateLine(line.id, { width: line.width === 4 ? 2 : 4 })}
              >
                ▬
              </button>
              <button
                className={line.dash ? 'on' : ''}
                title="Dashed"
                onClick={() => store.getState().updateLine(line.id, { dash: !line.dash })}
              >
                ┄
              </button>
              {LINE_COLORS.map((c) => (
                <button
                  key={c ?? 'default'}
                  className={'line-color-swatch' + ((line.color ?? null) === c ? ' on' : '')}
                  style={c ? { backgroundColor: c } : undefined}
                  title={c ?? 'Default color'}
                  onClick={() => store.getState().updateLine(line.id, { color: c ?? undefined })}
                />
              ))}
              <button
                title="Delete line"
                className="danger"
                onClick={() => {
                  store.getState().deleteLine(line.id)
                  useUi.getState().setSelectedLine(null)
                }}
              >
                ✕
              </button>
            </div>
          </foreignObject>
        )}
        {labelEdit === line.id && (
          <foreignObject x={mid.x - 80} y={mid.y - 16} width={160} height={32}>
            <input
              className="line-label-input no-drag"
              autoFocus
              defaultValue={line.label}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  store.getState().updateLine(line.id, { label: (e.target as HTMLInputElement).value })
                  setLabelEdit(null)
                }
                if (e.key === 'Escape') setLabelEdit(null)
              }}
              onBlur={(e) => {
                store.getState().updateLine(line.id, { label: e.target.value })
                setLabelEdit(null)
              }}
            />
          </foreignObject>
        )}
      </g>
    )
  }

  // pending line preview while the line tool is placing
  let pending: React.ReactNode = null
  if (pendingFrom && cursor) {
    const cFrom = centerOf(pendingFrom, rects)
    if (cFrom) {
      const a = endPoint(pendingFrom, rects, cursor)
      if (a) {
        const { d } = linePath(a, cursor, 0.2)
        pending = <path className="line-vis pending" d={d} />
      }
    }
  }

  return (
    <svg className="lines-layer" ref={svgRef}>
      <defs>
        <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 1 L 9 5 L 0 9" fill="none" stroke="context-stroke" strokeWidth="1.8" strokeLinecap="round" />
        </marker>
        <marker id="arrowhead-start" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 1 L 9 5 L 0 9" fill="none" stroke="context-stroke" strokeWidth="1.8" strokeLinecap="round" />
        </marker>
      </defs>
      {lines.map(renderLine)}
      {pending}
    </svg>
  )
}
