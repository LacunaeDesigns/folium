import React from 'react'
import { useFoliumStore } from '../store/context'
import { BoardView, useUi } from '../store/uiStore'
import { Icon } from '../ui/Icons'
import { Pt } from './coords'
import { hasMeaningfulPressure, strokeOutlinePath } from '../model/inkOutline'

interface Stroke {
  points: number[]
  color: string
  width: number
  /** one pressure value per point, recorded live; stripped before persisting
   *  if it carries no real per-point variation (see hasMeaningfulPressure) */
  pressures?: number[]
}

const INK_COLORS = ['#33373b', '#d64541', '#4c6ef5', '#4caf6e', '#e56937', '#8e5cd9']
const INK_WIDTHS = [2, 3, 6]

function strokeHits(stroke: Stroke, p: Pt, threshold: number): boolean {
  const pts = stroke.points
  for (let i = 0; i + 1 < pts.length; i += 2) {
    const dx = pts[i] - p.x
    const dy = pts[i + 1] - p.y
    if (dx * dx + dy * dy < threshold * threshold) return true
  }
  return false
}

export function strokesToPath(points: number[]): string {
  if (points.length < 2) return ''
  let d = `M ${points[0]} ${points[1]}`
  for (let i = 2; i + 1 < points.length; i += 2) d += ` L ${points[i]} ${points[i + 1]}`
  return d
}

/** Freehand drawing session — active while the draw tool is selected. */
export function InkLayer({
  boardId,
  view,
  viewportEl,
}: {
  boardId: string
  view: BoardView
  viewportEl: HTMLElement | null
}) {
  const store = useFoliumStore()
  const draw = useUi((s) => s.draw)
  const setDraw = useUi((s) => s.setDraw)
  const [strokes, setStrokes] = React.useState<Stroke[]>([])
  const strokesRef = React.useRef<Stroke[]>([])
  strokesRef.current = strokes
  const current = React.useRef<Stroke | null>(null)
  const [, force] = React.useReducer((n: number) => n + 1, 0)

  const toWorld = (clientX: number, clientY: number): Pt => {
    const vp = viewportEl!.getBoundingClientRect()
    return {
      x: (clientX - vp.left - view.pan.x) / view.zoom,
      y: (clientY - vp.top - view.pan.y) / view.zoom,
    }
  }

  const finalize = React.useCallback(() => {
    // include a stroke still being drawn (e.g. Esc pressed mid-stroke)
    const live = current.current
    current.current = null
    const liveClean = live && !hasMeaningfulPressure(live.pressures ?? []) ? { ...live, pressures: undefined } : live
    const all =
      liveClean && liveClean.width > 0 && liveClean.points.length >= 4
        ? [...strokesRef.current, liveClean]
        : strokesRef.current
    if (!all.length) return
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity
    for (const s of all) {
      for (let i = 0; i + 1 < s.points.length; i += 2) {
        minX = Math.min(minX, s.points[i])
        maxX = Math.max(maxX, s.points[i])
        minY = Math.min(minY, s.points[i + 1])
        maxY = Math.max(maxY, s.points[i + 1])
      }
    }
    const pad = 10
    minX -= pad
    minY -= pad
    maxX += pad
    maxY += pad
    const natW = Math.max(40, maxX - minX)
    const natH = Math.max(40, maxY - minY)
    const rebased = all.map((s) => ({
      ...s,
      points: s.points.map((v, i) => (i % 2 === 0 ? v - minX : v - minY)),
    }))
    const st = store.getState()
    const id = st.addCard(boardId, 'ink', {
      x: minX,
      y: minY,
      content: { kind: 'ink', strokes: rebased, natW, natH } as never,
    })
    st.resizeCard(id, natW, natH)
    strokesRef.current = []
    setStrokes([])
  }, [boardId, store])

  // finalize when the draw tool is dropped (unmount)
  React.useEffect(() => () => finalize(), [finalize])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    try {
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    } catch {
      /* synthetic */
    }
    const p = toWorld(e.clientX, e.clientY)
    if (draw.eraser) {
      setStrokes((prev) => prev.filter((s) => !strokeHits(s, p, 12 / view.zoom)))
      current.current = { points: [], color: '', width: 0 } // erase-drag marker
      return
    }
    current.current = { points: [p.x, p.y], color: draw.color, width: draw.width, pressures: [e.pressure || 0] }
    force()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!current.current) return
    const p = toWorld(e.clientX, e.clientY)
    if (draw.eraser) {
      setStrokes((prev) => prev.filter((s) => !strokeHits(s, p, 12 / view.zoom)))
      return
    }
    current.current.points.push(p.x, p.y)
    current.current.pressures!.push(e.pressure || 0)
    force()
  }

  const onPointerUp = () => {
    const c = current.current
    current.current = null
    if (!c || draw.eraser || c.points.length < 4) {
      force()
      return
    }
    // drop the pressure array unless it carries real per-point variation, so
    // mouse-drawn strokes persist and render exactly as they did before
    const clean = hasMeaningfulPressure(c.pressures ?? []) ? c : { ...c, pressures: undefined }
    setStrokes((prev) => [...prev, clean])
  }

  return (
    <>
      <div
        className={'ink-overlay' + (draw.eraser ? ' erasing' : '')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        // the OS/browser aborted the gesture (e.g. a pen/touch interruption) —
        // commit the in-progress stroke exactly as a normal pointerup would,
        // so it's preserved instead of silently discarded by the next stroke
        onPointerCancel={onPointerUp}
      >
        <svg className="lines-layer" style={{ overflow: 'visible' }}>
          <g transform={`translate(${view.pan.x} ${view.pan.y}) scale(${view.zoom})`}>
            {strokes.map((s, i) =>
              s.pressures && hasMeaningfulPressure(s.pressures) ? (
                <path key={i} d={strokeOutlinePath(s.points, s.pressures, s.width)} fill={s.color} stroke="none" />
              ) : (
                <path key={i} d={strokesToPath(s.points)} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              ),
            )}
            {current.current && !draw.eraser && (
              current.current.pressures && hasMeaningfulPressure(current.current.pressures) ? (
                <path
                  d={strokeOutlinePath(current.current.points, current.current.pressures, current.current.width)}
                  fill={current.current.color}
                  stroke="none"
                />
              ) : (
                <path
                  d={strokesToPath(current.current.points)}
                  stroke={current.current.color}
                  strokeWidth={current.current.width}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )
            )}
          </g>
        </svg>
      </div>
      <div className="draw-panel" onPointerDown={(e) => e.stopPropagation()}>
        {INK_COLORS.map((c) => (
          <button
            key={c}
            className={'draw-color' + (draw.color === c && !draw.eraser ? ' on' : '')}
            style={{ background: c }}
            onClick={() => setDraw({ color: c, eraser: false })}
            title={c}
          />
        ))}
        <span className="fmt-sep" />
        {INK_WIDTHS.map((w) => (
          <button
            key={w}
            className={'draw-width' + (draw.width === w && !draw.eraser ? ' on' : '')}
            onClick={() => setDraw({ width: w, eraser: false })}
            title={`${w}px`}
          >
            <span style={{ width: w + 2, height: w + 2, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
          </button>
        ))}
        <span className="fmt-sep" />
        <button
          className={'draw-eraser' + (draw.eraser ? ' on' : '')}
          onClick={() => setDraw({ eraser: !draw.eraser })}
          title="Eraser (removes whole strokes)"
        >
          <Icon name="eraser" size={15} />
        </button>
        <button
          className="draw-done"
          onClick={() => {
            finalize()
            useUi.getState().setTool(null)
          }}
        >
          Done
        </button>
      </div>
    </>
  )
}
