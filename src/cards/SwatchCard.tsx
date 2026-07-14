import React from 'react'
import { CardBodyProps } from './registry'
import { SwatchContent } from '../model/types'
import { useFoliumStore } from '../store/context'

function isLight(hex: string): boolean {
  const m = hex.replace('#', '')
  if (m.length < 6) return true
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b > 150
}

export function SwatchCard({ card, readOnly }: CardBodyProps) {
  const content = card.content as SwatchContent
  const store = useFoliumStore()

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
        value={content.name}
        placeholder="Name"
        readOnly={readOnly}
        onChange={(e) => store.getState().updateContent(card.id, { name: e.target.value })}
      />
    </div>
  )
}
