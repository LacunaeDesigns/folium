import React from 'react'
import { CardBodyProps } from './registry'
import { StickyContent } from '../model/types'
import { useFoliumStore } from '../store/context'
import { useUi } from '../store/uiStore'
import { useDebouncedCommit } from './useEditing'
import { isHexColor, isLight } from './color'

const STICKY_COLORS = ['yellow', 'orange', 'red', 'green', 'blue', 'purple'] as const

export function StickyCard({ card, readOnly }: CardBodyProps) {
  const content = card.content as StickyContent
  const store = useFoliumStore()
  const selected = useUi((s) => s.selection.length === 1 && s.selection[0] === card.id)
  const [textDraft, setTextDraft] = React.useState(content.text)
  const commitText = useDebouncedCommit((v) => store.getState().updateContent(card.id, { text: v as string }))
  const commitColor = useDebouncedCommit((hex) => store.getState().updateContent(card.id, { color: hex as string }))

  React.useEffect(() => setTextDraft(content.text), [content.text])

  const hex = isHexColor(content.color) ? content.color : null

  return (
    <div
      className={'sticky-card' + (hex ? (isLight(hex) ? ' on-light' : ' on-dark') : ' bg-' + content.color)}
      style={hex ? { background: hex } : undefined}
    >
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
          <label
            className="color-dot color-dot-custom"
            style={hex ? { background: hex } : undefined}
            title="Custom color"
          >
            <input
              type="color"
              value={hex ?? '#ffd966'}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => commitColor(e.target.value)}
            />
          </label>
        </div>
      )}
      <textarea
        className="sticky-text"
        placeholder={readOnly ? '' : 'Sticky note'}
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
