import React from 'react'
import { CardBodyProps } from './registry'
import { StickyContent } from '../model/types'
import { useFoliumStore } from '../store/context'
import { useUi } from '../store/uiStore'

const STICKY_COLORS = ['yellow', 'orange', 'red', 'green', 'blue', 'purple'] as const

export function StickyCard({ card, readOnly }: CardBodyProps) {
  const content = card.content as StickyContent
  const store = useFoliumStore()
  const selected = useUi((s) => s.selection.length === 1 && s.selection[0] === card.id)

  return (
    <div className={'sticky-card bg-' + content.color}>
      {selected && !readOnly && (
        <div className="format-bar sticky-bar no-drag" onPointerDown={(e) => e.stopPropagation()}>
          {STICKY_COLORS.map((c) => (
            <button
              key={c}
              className={'color-dot bg-' + c + (content.color === c ? ' on' : '')}
              onClick={() => store.getState().updateContent(card.id, { color: c })}
              title={c}
            />
          ))}
        </div>
      )}
      <textarea
        className="sticky-text"
        placeholder={readOnly ? '' : 'Sticky note'}
        value={content.text}
        readOnly={readOnly}
        onChange={(e) => store.getState().updateContent(card.id, { text: e.target.value })}
      />
    </div>
  )
}
