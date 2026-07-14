import React from 'react'
import { CardBodyProps } from './registry'
import { HeadingContent } from '../model/types'
import { useAtlasStore } from '../store/context'
import { useUi } from '../store/uiStore'

const LEVELS = [1, 2, 3] as const

export function HeadingCard({ card, readOnly }: CardBodyProps) {
  const content = card.content as HeadingContent
  const store = useAtlasStore()
  const selected = useUi((s) => s.selection.length === 1 && s.selection[0] === card.id)

  return (
    <div className="heading-card">
      {selected && !readOnly && (
        <div className="format-bar heading-bar no-drag" onPointerDown={(e) => e.stopPropagation()}>
          {LEVELS.map((lvl) => (
            <button
              key={lvl}
              className={'fmt-btn' + (content.level === lvl ? ' on' : '')}
              onClick={() => store.getState().updateContent(card.id, { level: lvl })}
              title={'Heading ' + lvl}
            >
              H{lvl}
            </button>
          ))}
        </div>
      )}
      <textarea
        className={'heading-text level-' + content.level}
        placeholder={readOnly ? '' : 'Heading'}
        value={content.text}
        readOnly={readOnly}
        onChange={(e) => store.getState().updateContent(card.id, { text: e.target.value })}
      />
    </div>
  )
}
