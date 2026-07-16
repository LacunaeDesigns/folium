import React from 'react'
import { CardBodyProps } from './registry'
import { HeadingContent } from '../model/types'
import { useFoliumStore } from '../store/context'
import { useUi } from '../store/uiStore'
import { useDebouncedCommit } from './useEditing'

const LEVELS = [1, 2, 3] as const

export function HeadingCard({ card, readOnly }: CardBodyProps) {
  const content = card.content as HeadingContent
  const store = useFoliumStore()
  const selected = useUi((s) => s.selection.length === 1 && s.selection[0] === card.id)
  const [textDraft, setTextDraft] = React.useState(content.text)
  const commitText = useDebouncedCommit((v) => store.getState().updateContent(card.id, { text: v as string }))

  React.useEffect(() => setTextDraft(content.text), [content.text])

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
        value={textDraft}
        readOnly={readOnly}
        onChange={(e) => {
          setTextDraft(e.target.value)
          commitText(e.target.value)
        }}
      />
    </div>
  )
}
