import React from 'react'
import { useFolium } from '../store/context'
import { boardCards } from '../store/selectors'
import { useUi, BoardView } from '../store/uiStore'
import { zoomAt, safeCapture, Pt } from '../canvas/coords'
import { getCardBody } from '../cards/registry'
import { Icon } from './Icons'
import './panels.css'

export function frameCard(
  card: { x: number; y: number; w: number; h?: number },
  vw: number,
  vh: number,
): BoardView {
  const cardH = card.h ?? Math.min(500, Math.max(160, card.w * 0.8))
  const zoom = Math.min((vw * 0.7) / card.w, (vh * 0.7) / cardH, 1.6)
  return {
    zoom,
    pan: {
      x: vw / 2 - (card.x + card.w / 2) * zoom,
      y: vh / 2 - (card.y + cardH / 2) * zoom,
    },
  }
}

export function movedPastThreshold(dx: number, dy: number, threshold: number): boolean {
  return Math.hypot(dx, dy) > threshold
}

export function PresentMode({ boardId }: { boardId: string }) {
  const cards = useFolium((s) =>
    boardCards(s, boardId).slice().sort((a, b) => a.y - b.y || a.x - b.x),
  )
  const appTheme = useUi((s) => s.appTheme)
  const setPresentationMode = useUi((s) => s.setPresentationMode)
  const [index, setIndex] = React.useState(0)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const cardsRef = React.useRef(cards)
  cardsRef.current = cards
  const [view, setViewLocal] = React.useState<BoardView>({ zoom: 1, pan: { x: 0, y: 0 } })
  const [interacting, setInteracting] = React.useState(false)
  const gestureRef = React.useRef<{ startX: number; startY: number; panX: number; panY: number; moved: boolean; target: HTMLElement | null } | null>(null)
  const wheelIdleTimer = React.useRef<number | undefined>(undefined)

  const exit = React.useCallback(() => setPresentationMode(false), [setPresentationMode])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exit()
      else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault()
        setIndex((i) => Math.min(cards.length - 1, i + 1))
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        setIndex((i) => Math.max(0, i - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cards.length, exit])

  React.useLayoutEffect(() => {
    const stage = stageRef.current
    const list = cardsRef.current
    if (!stage || list.length === 0) return
    const card = list[Math.min(index, list.length - 1)]
    setViewLocal(frameCard(card, stage.clientWidth, stage.clientHeight))
  }, [index])

  const clientToLocal = (clientX: number, clientY: number): Pt => {
    const r = stageRef.current!.getBoundingClientRect()
    return { x: clientX - r.left, y: clientY - r.top }
  }

  const onStagePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return
    const cardTarget = (e.target as HTMLElement).closest('[data-card-index]') as HTMLElement | null
    safeCapture(e.currentTarget as HTMLElement, e.pointerId)
    gestureRef.current = { startX: e.clientX, startY: e.clientY, panX: view.pan.x, panY: view.pan.y, moved: false, target: cardTarget }
    setInteracting(true)
  }

  const onStagePointerMove = (e: React.PointerEvent) => {
    const g = gestureRef.current
    if (!g) return
    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY
    if (!g.moved && movedPastThreshold(dx, dy, 4)) g.moved = true
    setViewLocal((v) => ({ zoom: v.zoom, pan: { x: g.panX + dx, y: g.panY + dy } }))
  }

  const onStagePointerUp = (e: React.PointerEvent) => {
    const g = gestureRef.current
    gestureRef.current = null
    setInteracting(false)
    if (!g || g.moved) return
    if (g.target) setIndex(Number(g.target.dataset.cardIndex))
  }

  const onWheel = (e: WheelEvent) => {
    setInteracting(true)
    window.clearTimeout(wheelIdleTimer.current)
    wheelIdleTimer.current = window.setTimeout(() => setInteracting(false), 150)
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const local = clientToLocal(e.clientX, e.clientY)
      const factor = Math.exp(-e.deltaY * 0.0015)
      setViewLocal((v) => zoomAt(v, local.x, local.y, v.zoom * factor))
    } else {
      const dx = e.shiftKey ? e.deltaY : e.deltaX
      const dy = e.shiftKey ? 0 : e.deltaY
      setViewLocal((v) => ({ zoom: v.zoom, pan: { x: v.pan.x - dx, y: v.pan.y - dy } }))
    }
  }
  const onWheelRef = React.useRef(onWheel)
  onWheelRef.current = onWheel

  // native non-passive listener — React's synthetic wheel can't preventDefault the
  // browser's ctrl+wheel page zoom (mirrors src/canvas/Canvas.tsx)
  React.useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const h = (e: WheelEvent) => onWheelRef.current(e)
    el.addEventListener('wheel', h, { passive: false })
    return () => {
      el.removeEventListener('wheel', h)
      window.clearTimeout(wheelIdleTimer.current)
    }
  }, [])

  const zoomStep = (dir: 1 | -1) => {
    const stage = stageRef.current
    if (!stage) return
    setViewLocal((v) => zoomAt(v, stage.clientWidth / 2, stage.clientHeight / 2, v.zoom * (dir > 0 ? 1.2 : 1 / 1.2)))
  }

  const recenter = () => {
    const stage = stageRef.current
    const list = cardsRef.current
    if (!stage || list.length === 0) return
    setViewLocal(frameCard(list[Math.min(index, list.length - 1)], stage.clientWidth, stage.clientHeight))
  }

  if (cards.length === 0) {
    return (
      <div className="present-overlay" data-board-theme={appTheme}>
        <div className="present-empty">Nothing to present on this board.</div>
        <button className="present-exit" onClick={exit}>
          <Icon name="close" size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="present-overlay" data-board-theme={appTheme}>
      <div
        className="present-stage"
        ref={stageRef}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerUp}
      >
        <div
          className={'present-world' + (interacting ? ' no-transition' : '')}
          style={{ transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})` }}
        >
          {cards.map((c, i) => {
            const Body = getCardBody(c.type)
            return (
              <div
                key={c.id}
                className={'card-shell present-card' + (i === index ? ' focus' : '')}
                data-type={c.type}
                data-card-index={i}
                style={{ left: c.x, top: c.y, width: c.w, height: c.h, zIndex: c.z }}
              >
                <Body card={c} readOnly />
              </div>
            )
          })}
        </div>
      </div>
      <div className="present-hud">
        <button onClick={recenter} title="Recenter on current card">
          <Icon name="fit" size={16} />
        </button>
        <button onClick={() => setIndex((i) => Math.max(0, i - 1))} title="Previous">
          <Icon name="back" size={16} />
        </button>
        <span>
          {index + 1} / {cards.length}
        </span>
        <button onClick={() => setIndex((i) => Math.min(cards.length - 1, i + 1))} title="Next">
          <Icon name="chevron-right" size={16} />
        </button>
      </div>
      <div className="zoom-pill">
        <button onClick={() => zoomStep(-1)} title="Zoom out">
          <Icon name="zoom-out" size={15} />
        </button>
        <span className="zoom-value">{Math.round(view.zoom * 100)}%</span>
        <button onClick={() => zoomStep(1)} title="Zoom in">
          <Icon name="zoom-in" size={15} />
        </button>
      </div>
      <button className="present-exit" onClick={exit} title="Exit (Esc)">
        <Icon name="close" size={16} />
      </button>
    </div>
  )
}
