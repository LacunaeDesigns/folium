import React from 'react'
import { useFolium } from '../store/context'
import { boardCards } from '../store/selectors'
import { useUi } from '../store/uiStore'
import { getCardBody } from '../cards/registry'
import { Icon } from './Icons'
import './panels.css'

export function PresentMode({ boardId }: { boardId: string }) {
  const cards = useFolium((s) =>
    boardCards(s, boardId).slice().sort((a, b) => a.y - b.y || a.x - b.x),
  )
  const appTheme = useUi((s) => s.appTheme)
  const setPresentationMode = useUi((s) => s.setPresentationMode)
  const [index, setIndex] = React.useState(0)
  const stageRef = React.useRef<HTMLDivElement>(null)

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

  const card = cards[Math.min(index, cards.length - 1)]
  const stage = stageRef.current
  const vw = stage?.clientWidth ?? window.innerWidth
  const vh = stage?.clientHeight ?? window.innerHeight
  const cardH = card.h ?? Math.min(500, Math.max(160, card.w * 0.8))
  const scale = Math.min((vw * 0.7) / card.w, (vh * 0.7) / cardH, 1.6)
  const tx = vw / 2 - (card.x + card.w / 2) * scale
  const ty = vh / 2 - (card.y + cardH / 2) * scale

  return (
    <div className="present-overlay" data-board-theme={appTheme}>
      <div className="present-stage" ref={stageRef}>
        <div
          className="present-world"
          style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}
        >
          {cards.map((c, i) => {
            const Body = getCardBody(c.type)
            return (
              <div
                key={c.id}
                className={'card-shell present-card' + (i === index ? ' focus' : '')}
                data-type={c.type}
                style={{ left: c.x, top: c.y, width: c.w, height: c.h, zIndex: c.z }}
                onClick={() => setIndex(i)}
              >
                <Body card={c} readOnly />
              </div>
            )
          })}
        </div>
      </div>
      <div className="present-hud">
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
      <button className="present-exit" onClick={exit} title="Exit (Esc)">
        <Icon name="close" size={16} />
      </button>
    </div>
  )
}
