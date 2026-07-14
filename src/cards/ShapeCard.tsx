import React from 'react'
import { CardBodyProps } from './registry'
import { ShapeContent, ShapeKind } from '../model/types'
import { useFoliumStore } from '../store/context'
import { useUi } from '../store/uiStore'

const SHAPE_COLORS = ['blue', 'green', 'yellow', 'orange', 'red', 'purple', 'gray'] as const
const KINDS: { kind: ShapeKind; label: string }[] = [
  { kind: 'rect', label: '▭' },
  { kind: 'ellipse', label: '◯' },
  { kind: 'diamond', label: '◇' },
]

function ShapeSvg({ kind, fill }: { kind: ShapeKind; fill: string }) {
  const color = `var(--card-${fill})`
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

  return (
    <div className="shape-card">
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
        </div>
      )}
      <ShapeSvg kind={content.shape} fill={content.fill} />
      <textarea
        className={'shape-text' + (content.fill === 'gray' ? '' : '')}
        placeholder={readOnly ? '' : 'Text'}
        value={content.text}
        readOnly={readOnly}
        onChange={(e) => store.getState().updateContent(card.id, { text: e.target.value })}
      />
    </div>
  )
}
