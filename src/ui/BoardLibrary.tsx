import React from 'react'
import { useFolium, useFoliumStore } from '../store/context'
import { allBoardStats, breadcrumbs, boardCards, BoardStats } from '../store/selectors'
import { relTime } from '../cards/CommentCard'
import { useUi } from '../store/uiStore'
import { BoardSchematic } from './BoardSchematic'
import { Icon } from './Icons'
import { Board } from '../model/types'
import './panels.css'

function BoardTile({
  board,
  stats,
  onJump,
}: {
  board: Board
  stats: BoardStats | undefined
  onJump: (boardId: string) => void
}) {
  const store = useFoliumStore()
  const crumbs = useFolium((s) => breadcrumbs(s, board.id))
  const cards = useFolium((s) => boardCards(s, board.id))
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(board.title)

  const parentCrumb = crumbs.slice(0, -1).map((b) => b.title).join(' / ')
  const commit = () => {
    setEditing(false)
    const t = draft.trim()
    if (t && t !== board.title) store.getState().renameBoard(board.id, t)
    else setDraft(board.title)
  }

  return (
    <div className="lib-tile">
      <button className="lib-tile-hit" onClick={() => onJump(board.id)} title={`Open "${board.title}"`}>
        <BoardSchematic cards={cards} />
      </button>
      <div className="lib-tile-body">
        {parentCrumb && <div className="lib-tile-crumb">{parentCrumb}</div>}
        {editing ? (
          <div className="lib-tile-title">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') {
                  setDraft(board.title)
                  setEditing(false)
                }
              }}
            />
          </div>
        ) : (
          <button
            className="lib-tile-title"
            onDoubleClick={() => {
              setDraft(board.title)
              setEditing(true)
            }}
            title="Double-click to rename"
          >
            {board.title}
          </button>
        )}
        <div className="lib-tile-meta">
          <span>{stats?.cardCount ?? 0} card{stats?.cardCount === 1 ? '' : 's'}</span>
          {!!stats?.todoTotal && <span>{stats.todoDone}/{stats.todoTotal} done</span>}
          <span>{relTime(board.updatedAt ?? board.createdAt)}</span>
        </div>
      </div>
    </div>
  )
}

export function BoardLibrary({ onClose }: { onClose: () => void }) {
  const store = useFoliumStore()
  const rootId = useFolium((s) => s.rootId)
  const boards = useFolium((s) => s.boards)
  // one pass over s.cards for every board's stats, computed once per render here —
  // not per tile, which would reintroduce the O(boards*cards) cost allBoardStats
  // exists to avoid (see its own doc comment in selectors.ts)
  const stats = useFolium(allBoardStats)
  const [query, setQuery] = React.useState('')

  const jump = (boardId: string) => {
    useUi.getState().setBoard(boardId)
    onClose()
  }

  const list = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = Object.values(boards)
    const filtered = q ? all.filter((b) => b.title.toLowerCase().includes(q)) : all
    return filtered.sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
  }, [boards, query])

  const newBoard = () => {
    const { boardId } = store.getState().createBoard(rootId, 'Untitled')
    jump(boardId)
  }

  return (
    <div className="overlay" onPointerDown={onClose}>
      <div className="lib-modal" onPointerDown={(e) => e.stopPropagation()}>
        <div className="tray-head">
          <Icon name="board" size={16} />
          <span className="tray-title">All boards</span>
          <button className="tpl-save-btn" onClick={newBoard}>
            <Icon name="plus" size={13} /> New board
          </button>
          <button className="icon-btn" onClick={onClose} title="Close">
            <Icon name="close" size={14} />
          </button>
        </div>
        <div className="lib-search-row">
          <input
            autoFocus
            placeholder="Search boards…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
            }}
          />
        </div>
        <div className="lib-grid">
          {list.map((b) => (
            <BoardTile key={b.id} board={b} stats={stats[b.id]} onJump={jump} />
          ))}
        </div>
      </div>
    </div>
  )
}
