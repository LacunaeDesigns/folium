import React from 'react'
import { CardBodyProps, getCardBody } from './registry'
import { Card, ColumnContent } from '../model/types'
import { useFolium, useFoliumStore } from '../store/context'
import { columnCards } from '../store/selectors'
import { DEFAULT_VIEW, useUi } from '../store/uiStore'
import { Icon } from '../ui/Icons'
import { resolveCardDrop } from '../canvas/dropTarget'
import { usePointerDragGesture } from '../canvas/usePointerDragGesture'
import { useDebouncedCommit } from './useEditing'

function ColumnMember({ card, readOnly }: { card: Card; readOnly?: boolean }) {
  const store = useFoliumStore()
  const selected = useUi((s) => s.selection.includes(card.id))
  const [dragXY, setDragXY] = React.useState<{ x: number; y: number } | null>(null)

  const Body = getCardBody(card.type)

  // this gesture is dragged by a distance threshold (5px) — see
  // usePointerDragGesture for the shared arm/capture/cancel-recovery machine
  const gesture = usePointerDragGesture<undefined>({
    threshold: 5,
    onDragMove: (e, _data, origin) => {
      // once dragging, suppress the browser's own selection-drag (e.g. Shift
      // held during the drag can otherwise start a native text selection
      // alongside this pointer-based one, which can end the gesture with a
      // pointercancel instead of a normal pointerup)
      e.preventDefault()
      setDragXY({ x: e.clientX - origin.x, y: e.clientY - origin.y })
    },
    onDragEnd: (e) => {
      setDragXY(null)
      const drop = resolveCardDrop(e.clientX, e.clientY, [card.id])
      const s = store.getState()
      if (drop?.kind === 'column') {
        s.setCardColumn(card.id, drop.colId, drop.index)
        return
      }
      if (drop?.kind === 'unsorted') {
        s.setCardColumn(card.id, null, 0)
        s.updateCard(card.id, { inUnsorted: true })
        return
      }
      // released on open canvas -> pop out at world position
      const vp = document.querySelector('.canvas-viewport')
      if (vp) {
        const r = vp.getBoundingClientRect()
        const boardId = useUi.getState().currentBoardId
        const view = (boardId && useUi.getState().views[boardId]) || DEFAULT_VIEW
        const wx = (e.clientX - r.left - view.pan.x) / view.zoom
        const wy = (e.clientY - r.top - view.pan.y) / view.zoom
        s.setCardColumn(card.id, null, 0, { x: wx - card.w / 2, y: wy - 20 })
      }
    },
    // the browser/OS aborted the gesture (e.g. a native selection-drag took
    // over, losing pointer capture) — reset rather than leave the member
    // stuck permanently "lifted" with a stray transform and inflated z-index
    onDragCancel: () => setDragXY(null),
    onClick: () => setDragXY(null),
  })

  const onPointerDown = (e: React.PointerEvent) => {
    if (readOnly || e.button !== 0) return
    e.stopPropagation()
    const target = e.target as HTMLElement
    if (target.closest('input, textarea, button, a, [contenteditable="true"], .no-drag')) return
    useUi.getState().setSelection([card.id])
    gesture.start(e, undefined)
  }

  return (
    <div
      className={'col-member' + (selected ? ' selected' : '') + (dragXY ? ' lifting' : '')}
      data-col-member={card.id}
      style={dragXY ? { transform: `translate(${dragXY.x}px, ${dragXY.y}px)`, zIndex: 99 } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={gesture.onPointerMove}
      onPointerUp={gesture.onPointerUp}
      onPointerCancel={gesture.onPointerCancel}
    >
      <div className={'col-member-chrome card-face-' + card.type}>
        <Body card={card} inColumn readOnly={readOnly} />
      </div>
    </div>
  )
}

export function ColumnCard({ card, readOnly }: CardBodyProps) {
  const content = card.content as ColumnContent
  const store = useFoliumStore()
  const members = useFolium((s) => columnCards(s, card.id))
  const [titleDraft, setTitleDraft] = React.useState(content.title)
  const commitTitle = useDebouncedCommit((v) => store.getState().updateContent(card.id, { title: v as string }))

  React.useEffect(() => setTitleDraft(content.title), [content.title])

  return (
    <div className="column-card">
      <div className="column-head">
        <input
          className="column-title"
          placeholder="Column"
          value={titleDraft}
          readOnly={readOnly}
          onChange={(e) => {
            setTitleDraft(e.target.value)
            commitTitle(e.target.value)
          }}
        />
        <span className="column-count">{members.length}</span>
        {!readOnly && (
          <button
            className="column-collapse no-drag"
            title={content.collapsed ? 'Expand' : 'Collapse'}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() =>
              store.getState().updateContent(card.id, { collapsed: !content.collapsed })
            }
          >
            <Icon name={content.collapsed ? 'chevron-right' : 'chevron-down'} size={14} />
          </button>
        )}
      </div>
      {!content.collapsed && (
        <div
          className="column-body"
          onDoubleClick={(e) => {
            if (readOnly) return
            const target = e.target as HTMLElement
            if (target.closest('[data-col-member], input, textarea, button, a')) return
            const s = store.getState()
            const id = s.addCard(card.boardId, 'note', {})
            s.setCardColumn(id, card.id, members.length)
            useUi.getState().setSelection([id])
          }}
        >
          {members.map((m) => (
            <ColumnMember key={m.id} card={m} readOnly={readOnly} />
          ))}
          {members.length === 0 && <div className="column-empty">Drag cards here</div>}
        </div>
      )}
    </div>
  )
}
