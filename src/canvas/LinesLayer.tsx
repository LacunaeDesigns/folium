import React from 'react'
import { Line, LineEnd } from '../model/types'
import { useAtlas, useAtlasStore } from '../store/context'
import { linesOnBoard } from '../store/selectors'
import { BoardView, useUi } from '../store/uiStore'
import { Icon } from '../ui/Icons'
import { DragState } from './CardShell'
import { Pt, Rect } from './coords'

interface WorldRects {
  get(cardId: string): Rect | null
}

/** Measure a card's world rect from the DOM (accounts for live drag transforms). */
function makeRectSource(viewportEl: HTMLElement | null, view: BoardView): WorldRects {
  const cache = new Map<string, Rect | null>()
  return {
    get(cardId: string) {
      if (cache.has(cardId)) return cache.get(cardId)!
      let rect: Rect | null = null
      if (viewportEl) {
        const el = viewportEl.querySelector(`[data-card-id="${cardId}"]`)
        if (el) {
          const r = (el as HTMLElement).getBoundingClientRect()
          const vp = viewportEl.getBoundingClientRect()
          rect = {
            x: (r.left - vp.left - view.pan.x) / view.zoom,
            y: (r.top - vp.top - view.pan.y) / view.zoom,
            w: r.width / view.zoom,
            h: r.height / view.zoom,
          }
        }
      }
      cache.set(cardId, rect)
      return rect
    },
  }
}

function endPoint(end: LineEnd, rects: WorldRects, toward: Pt): Pt | null {
  if ('cardId' in end) {
    const r = rects.get(end.cardId)
    if (!r) return null
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
  const store = useAtlasStore()
  const lines = useAtlas((s) => linesOnBoard(s, boardId))
  const selectedLine = useUi((s) => s.selectedLine)
  const [labelEdit, setLabelEdit] = React.useState<string | null>(null)
  const [endDrag, setEndDrag] = React.useState<{ lineId: string; which: 'from' | 'to'; pt: Pt } | null>(null)
  // bump to re-measure after mount so lines attach to freshly-rendered cards
  const [, setTick] = React.useState(0)
  React.useEffect(() => {
    const t = requestAnimationFrame(() => setTick((v) => v + 1))
    return () => cancelAnimationFrame(t)
  }, [lines.length, drag])

  const rects = makeRectSource(viewportEl, view)

  const toWorld = (clientX: number, clientY: number): Pt => {
    const vp = viewportEl!.getBoundingClientRect()
    return {
      x: (clientX - vp.left - view.pan.x) / view.zoom,
      y: (clientY - vp.top - view.pan.y) / view.zoom,
    }
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
    if (!endDrag) return
    setEndDrag({ ...endDrag, pt: toWorld(e.clientX, e.clientY) })
  }

  const onEndPointerUp = (e: React.PointerEvent) => {
    if (!endDrag) return
    const { lineId, which } = endDrag
    setEndDrag(null)
    // attach to a card if released over one
    const stack = document.elementsFromPoint(e.clientX, e.clientY)
    let end: LineEnd = toWorld(e.clientX, e.clientY)
    for (const el of stack) {
      const shell = (el as HTMLElement).closest?.('[data-card-id]')
      if (shell) {
        end = { cardId: shell.getAttribute('data-card-id')! }
        break
      }
    }
    store.getState().updateLine(lineId, { [which]: end } as Partial<Line>)
  }

  const renderLine = (line: Line) => {
    const dragging = endDrag?.lineId === line.id ? endDrag : null
    const fromEnd: LineEnd = dragging?.which === 'from' ? dragging.pt : line.from
    const toEnd: LineEnd = dragging?.which === 'to' ? dragging.pt : line.to

    const cFrom = centerOf(fromEnd, rects)
    const cTo = centerOf(toEnd, rects)
    if (!cFrom || !cTo) return null
    const a = endPoint(fromEnd, rects, cTo)
    const b = endPoint(toEnd, rects, cFrom)
    if (!a || !b) return null

    const { d, mid } = linePath(a, b, line.curve)
    const isSel = selectedLine === line.id

    return (
      <g key={line.id} className={'line-g' + (isSel ? ' selected' : '')}>
        <path
          className="line-hit"
          d={d}
          onPointerDown={(e) => {
            e.stopPropagation()
            useUi.getState().setSelectedLine(line.id)
          }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            setLabelEdit(line.id)
          }}
        />
        <path
          className="line-vis"
          d={d}
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
          </>
        )}
        {isSel && (
          <foreignObject x={mid.x - 70} y={mid.y + 12} width={150} height={36} className="line-toolbar-fo">
            <div className="line-toolbar no-drag" onPointerDown={(e) => e.stopPropagation()}>
              <button
                className={line.arrowEnd ? 'on' : ''}
                title="Arrow at end"
                onClick={() => store.getState().updateLine(line.id, { arrowEnd: !line.arrowEnd })}
              >
                →
              </button>
              <button
                className={line.arrowStart ? 'on' : ''}
                title="Arrow at start"
                onClick={() => store.getState().updateLine(line.id, { arrowStart: !line.arrowStart })}
              >
                ←
              </button>
              <button
                title="Straight / curved"
                onClick={() => store.getState().updateLine(line.id, { curve: line.curve === 0 ? 0.2 : 0 })}
              >
                ~
              </button>
              <button title="Label" onClick={() => setLabelEdit(line.id)}>
                Aa
              </button>
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
    <svg className="lines-layer">
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
