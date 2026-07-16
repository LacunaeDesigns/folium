import React from 'react'
import { CardType } from '../model/types'
import { useFoliumStore } from '../store/context'
import { searchAll, SearchHit, SearchOpts } from '../store/search'
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
  chart: 'chart',
  frame: 'frame',
  heading: 'heading',
  sticker: 'sticker',
}

const TYPE_OPTIONS: { value: CardType; label: string }[] = [
  { value: 'board', label: 'Boards' },
  { value: 'note', label: 'Note' },
  { value: 'todo', label: 'To-do' },
  { value: 'link', label: 'Link' },
  { value: 'image', label: 'Image' },
  { value: 'file', label: 'File' },
  { value: 'column', label: 'Column' },
  { value: 'comment', label: 'Comment' },
  { value: 'table', label: 'Table' },
  { value: 'swatch', label: 'Color swatch' },
  { value: 'sticky', label: 'Sticky note' },
  { value: 'shape', label: 'Shape' },
  { value: 'ink', label: 'Drawing' },
  { value: 'chart', label: 'Chart' },
  { value: 'frame', label: 'Frame' },
  { value: 'heading', label: 'Heading' },
  { value: 'sticker', label: 'Sticker' },
]

const PAGE_SIZE = 30

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
  const store = useFoliumStore()
  const setSearchOpen = useUi((s) => s.setSearchOpen)
  const currentBoardId = useUi((s) => s.currentBoardId)
  const [query, setQuery] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState<CardType | 'all'>('all')
  const [thisBoardOnly, setThisBoardOnly] = React.useState(false)
  const [hits, setHits] = React.useState<SearchHit[]>([])
  const [total, setTotal] = React.useState(0)

  const baseOpts = (): SearchOpts => {
    const opts: SearchOpts = {}
    if (typeFilter !== 'all') opts.type = typeFilter
    if (thisBoardOnly && currentBoardId) opts.boardId = currentBoardId
    return opts
  }

  React.useEffect(() => {
    const { hits, total } = searchAll(store.getState(), query, baseOpts())
    setHits(hits)
    setTotal(total)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, typeFilter, thisBoardOnly, currentBoardId, store])

  const showMore = () => {
    const { hits: more } = searchAll(store.getState(), query, { ...baseOpts(), offset: hits.length })
    setHits((prev) => [...prev, ...more])
  }

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
          <>
            <div className="search-filters">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as CardType | 'all')}
                aria-label="Filter by type"
              >
                <option value="all">All types</option>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <button
                className={'filter-toggle' + (thisBoardOnly ? ' filter-toggle-active' : '')}
                onClick={() => setThisBoardOnly((v) => !v)}
                disabled={!currentBoardId}
              >
                {thisBoardOnly ? 'This board' : 'All boards'}
              </button>
            </div>
            <div className="search-results">
              {hits.map((h) => (
                <button key={h.kind + h.id} className="search-hit" onClick={() => openHit(h)}>
                  <Icon name={HIT_ICON[h.cardType ?? 'board'] ?? 'note'} size={15} />
                  <span className="hit-snippet">{h.snippet}</span>
                  <span className="hit-board">{h.kind === 'board' ? 'Board' : h.title}</span>
                </button>
              ))}
              {hits.length === 0 && <div className="tray-empty">No results for “{query}”.</div>}
              {hits.length < total && (
                <button className="search-more" onClick={showMore}>
                  Show {PAGE_SIZE} more
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
