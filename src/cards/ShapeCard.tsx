import React from 'react'
import { CardBodyProps } from './registry'
import { ShapeContent, ShapeKind } from '../model/types'
import { useFoliumStore } from '../store/context'
import { useUi } from '../store/uiStore'
import { useDebouncedCommit } from './useEditing'
import { isHexColor, isLight } from './color'

const SHAPE_COLORS = ['blue', 'green', 'yellow', 'orange', 'red', 'purple', 'gray'] as const
const KINDS: { kind: ShapeKind; label: string }[] = [
  { kind: 'rect', label: '▭' },
  { kind: 'ellipse', label: '◯' },
  { kind: 'diamond', label: '◇' },
]

function ShapeSvg({ kind, fill }: { kind: ShapeKind; fill: string }) {
  const color = isHexColor(fill) ? fill : `var(--card-${fill})`
  return (
    <svg className="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
      {kind === 'rect' && <rect x="2" y="2" width="96" height="96" rx="6" fill={color} />}
      {kind === 'ellipse' && <ellipse cx="50" cy="50" rx="48" ry="48" fill={color} />}
      {kind === 'diamond' && <polygon points="50,2 98,50 50,98 2,50" fill={color} />}
    </svg>
  )
}

export function ShapeCard({ card, readOnly }: CardBodyProps) {
  const content = card.content as ShapeContent
  const store = useFoliumStore()
  const selected = useUi((s) => s.selection.length === 1 && s.selection[0] === card.id)
  const [textDraft, setTextDraft] = React.useState(content.text)
  const commitText = useDebouncedCommit((v) => store.getState().updateContent(card.id, { text: v as string }))
  const commitFill = useDebouncedCommit((hex) => store.getState().updateContent(card.id, { fill: hex as string }))

  React.useEffect(() => setTextDraft(content.text), [content.text])

  const hex = isHexColor(content.fill) ? content.fill : null

  return (
    <div className={'shape-card' + (hex ? (isLight(hex) ? ' on-light' : ' on-dark') : '')}>
      {selected && !readOnly && (
        <div className="format-bar sticky-bar no-drag" onPointerDown={(e) => e.stopPropagation()}>
          {KINDS.map((k) => (
            <button
              key={k.kind}
              className={'fmt-btn' + (content.shape === k.kind ? ' on' : '')}
              onClick={() => store.getState().updateContent(card.id, { shape: k.kind })}
              title={k.kind}
            >
              {k.label}
            </button>
          ))}
          <span className="fmt-sep" />
          {SHAPE_COLORS.map((c) => (
            <button
              key={c}
              className={'color-dot bg-' + c + (content.fill === c ? ' on' : '')}
              onClick={() => store.getState().updateContent(card.id, { fill: c })}
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
              value={hex ?? '#4a90d9'}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => commitFill(e.target.value)}
            />
          </label>
        </div>
      )}
      <ShapeSvg kind={content.shape} fill={content.fill} />
      <textarea
        className={'shape-text' + (content.fill === 'gray' ? '' : '')}
        placeholder={readOnly ? '' : 'Text'}
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
