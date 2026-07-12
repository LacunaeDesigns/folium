import React from 'react'
import { CardBodyProps } from './registry'
import { InkContent } from '../model/types'
import { strokesToPath } from '../canvas/InkLayer'

export function InkCard({ card }: CardBodyProps) {
  const content = card.content as InkContent
  return (
    <svg
      className="ink-card"
      viewBox={`0 0 ${content.natW} ${content.natH}`}
      preserveAspectRatio="none"
    >
      {content.strokes.map((s, i) => (
        <path
          key={i}
          d={strokesToPath(s.points)}
          stroke={s.color}
          strokeWidth={s.width}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}
