import React from 'react'
import { CardBodyProps } from './registry'
import { BoardCardContent, BOARD_COLORS } from '../model/types'
import { BOARD_BACKGROUNDS } from '../model/backgrounds'
import { useAtlas, useAtlasStore } from '../store/context'
import { boardCardCount, boardTodoStats } from '../store/selectors'
import { useUi } from '../store/uiStore'
import { Icon, IconName } from '../ui/Icons'

export const BOARD_ICONS: IconName[] = ['board', 'note', 'image', 'todo', 'draw', 'palette', 'home', 'template']

export function BoardCard({ card, readOnly }: CardBodyProps) {
  const content = card.content as BoardCardContent
  const store = useAtlasStore()
  const board = useAtlas((s) => s.boards[content.boardId])
  const count = useAtlas((s) => (board ? boardCardCount(s, content.boardId) : 0))
  // primitive selectors so the fresh {done,total} object doesn't defeat
  // zustand's identity check and re-render on every unrelated store change
  const todoDone = useAtlas((s) => (board ? boardTodoStats(s, content.boardId).done : 0))
  const todoTotal = useAtlas((s) => (board ? boardTodoStats(s, content.boardId).total : 0))
  const isSelected = useUi((s) => s.selection.length === 1 && s.selection[0] === card.id)
  const [pickerOpen, setPickerOpen] = React.useState(false)

  if (!board) return <div className="board-card missing">Missing board</div>

  const open = () => {
    if (readOnly) return
    useUi.getState().setBoard(board.id)
  }

  return (
    <div className="board-card" onDoubleClick={open}>
      <div className="board-tile" style={{ background: board.color }}>
        <Icon name={(board.icon as IconName) || 'board'} size={26} strokeWidth={1.8} />
        {isSelected && !readOnly && (
          <button
            className="board-style-btn no-drag"
            title="Board style"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              setPickerOpen((v) => !v)
            }}
          >
            <Icon name="palette" size={13} />
          </button>
        )}
      </div>
      <input
        className="board-name no-drag"
        value={board.title}
        readOnly={readOnly}
        onChange={(e) => store.getState().renameBoard(board.id, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        onPointerDown={(e) => {
          // first click selects the card; editing only when already selected
          if (!isSelected) e.currentTarget.blur()
        }}
      />
      <div className="board-count">
        {count} {count === 1 ? 'card' : 'cards'}
      </div>
      {todoTotal > 0 && (
        <div className="board-count">
          {todoDone}/{todoTotal} tasks
        </div>
      )}

      {pickerOpen && isSelected && (
        <div className="menu-pop board-picker no-drag" onPointerDown={(e) => e.stopPropagation()}>
          <div className="picker-row">
            {BOARD_COLORS.map((c) => (
              <button
                key={c}
                className={'picker-color' + (board.color === c ? ' on' : '')}
                style={{ background: c }}
                onClick={() => store.getState().setBoardMeta(board.id, { color: c })}
              />
            ))}
          </div>
          <div className="picker-row">
            {BOARD_ICONS.map((ic) => (
              <button
                key={ic}
                className={'picker-icon' + (board.icon === ic ? ' on' : '')}
                onClick={() => store.getState().setBoardMeta(board.id, { icon: ic })}
              >
                <Icon name={ic} size={15} />
              </button>
            ))}
          </div>
          <div className="picker-row">
            {BOARD_BACKGROUNDS.map((bg) => (
              <button
                key={bg.id}
                className={'picker-bg' + ((board.background ?? 'default') === bg.id ? ' on' : '')}
                style={{ background: bg.swatch }}
                title={bg.label}
                onClick={() =>
                  store.getState().setBoardMeta(board.id, { background: bg.id === 'default' ? undefined : bg.id })
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
