import React from 'react'
import { CardBodyProps } from './registry'
import { SwatchContent } from '../model/types'
import { useFoliumStore } from '../store/context'
import { useDebouncedCommit } from './useEditing'
import { isLight } from './color'

export function SwatchCard({ card, readOnly }: CardBodyProps) {
  const content = card.content as SwatchContent
  const store = useFoliumStore()
  const [nameDraft, setNameDraft] = React.useState(content.name)
  const commitName = useDebouncedCommit((v) => store.getState().updateContent(card.id, { name: v as string }))

  React.useEffect(() => setNameDraft(content.name), [content.name])

  return (
    <div className="swatch-card">
      <label className="swatch-block" style={{ background: content.hex }}>
        <span className="swatch-hex" style={{ color: isLight(content.hex) ? '#33373b' : '#fff' }}>
          {content.hex.toUpperCase()}
        </span>
        {!readOnly && (
          <input
            type="color"
            className="swatch-input no-drag"
            value={content.hex}
            onChange={(e) => store.getState().updateContent(card.id, { hex: e.target.value })}
          />
        )}
      </label>
      <input
        className="swatch-name"
        value={nameDraft}
        placeholder="Name"
        readOnly={readOnly}
        onChange={(e) => {
          setNameDraft(e.target.value)
          commitName(e.target.value)
        }}
      />
    </div>
  )
}
