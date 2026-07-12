import React from 'react'
import { useAtlasStore } from '../store/context'
import { searchAll, SearchHit } from '../store/search'
import { useUi } from '../store/uiStore'
import { Icon, IconName } from './Icons'
import './panels.css'

const HIT_ICON: Record<string, IconName> = {
  board: 'board',
  note: 'note',
  todo: 'todo',
  link: 'link',
  image: 'image',
  file: 'upload',
  column: 'column',
  comment: 'comment',
  table: 'table',
  swatch: 'swatch',
  sticky: 'sticky',
  shape: 'shape',
  ink: 'draw',
}

export function focusCard(boardId: string, cardId: string | undefined, cardPos?: { x: number; y: number; w: number }) {
  const ui = useUi.getState()
  ui.setBoard(boardId)
  if (!cardId || !cardPos) return
  // wait a tick for the board to mount, then center the card
  setTimeout(() => {
    const vp = document.querySelector('.canvas-viewport')
    if (!vp) return
    const zoom = 1
    useUi.getState().setView(boardId, {
      zoom,
      pan: {
        x: vp.clientWidth / 2 - (cardPos.x + cardPos.w / 2) * zoom,
        y: vp.clientHeight / 3 - cardPos.y * zoom,
      },
    })
    useUi.getState().setSelection([cardId])
  }, 30)
}

export function SearchPanel() {
  const store = useAtlasStore()
  const setSearchOpen = useUi((s) => s.setSearchOpen)
  const [query, setQuery] = React.useState('')
  const [hits, setHits] = React.useState<SearchHit[]>([])

  React.useEffect(() => {
    setHits(searchAll(store.getState(), query))
  }, [query, store])

  const openHit = (h: SearchHit) => {
    setSearchOpen(false)
    if (h.kind === 'board') {
      focusCard(h.boardId, undefined)
      return
    }
    const card = store.getState().cards[h.cardId!]
    if (!card) return
    if (card.inUnsorted) {
      focusCard(h.boardId, undefined)
      useUi.getState().setUnsortedOpen(true)
      return
    }
    // cards in a column: open board, select, don't recenter precisely
    focusCard(h.boardId, h.cardId, card.colId ? undefined : { x: card.x, y: card.y, w: card.w })
  }

  return (
    <div className="overlay" onPointerDown={() => setSearchOpen(false)}>
      <div className="search-modal" onPointerDown={(e) => e.stopPropagation()}>
        <div className="search-row">
          <Icon name="search" size={16} />
          <input
            autoFocus
            placeholder="Search boards and cards…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearchOpen(false)
              if (e.key === 'Enter' && hits.length) openHit(hits[0])
            }}
          />
          <kbd>esc</kbd>
        </div>
        {query.trim() !== '' && (
          <div className="search-results">
            {hits.map((h) => (
              <button key={h.kind + h.id} className="search-hit" onClick={() => openHit(h)}>
                <Icon name={HIT_ICON[h.cardType ?? 'board'] ?? 'note'} size={15} />
                <span className="hit-snippet">{h.snippet}</span>
                <span className="hit-board">{h.kind === 'board' ? 'Board' : h.title}</span>
              </button>
            ))}
            {hits.length === 0 && <div className="tray-empty">No results for “{query}”.</div>}
          </div>
        )}
      </div>
    </div>
  )
}
