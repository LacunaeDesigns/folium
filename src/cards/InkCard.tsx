import React from 'react'
import { CardBodyProps } from './registry'
import { InkContent } from '../model/types'
import { strokesToPath } from '../canvas/InkLayer'
import { strokeOutlinePath } from '../model/inkOutline'

export function InkCard({ card }: CardBodyProps) {
  const content = card.content as InkContent
  return (
    <svg
      className="ink-card"
      viewBox={`0 0 ${content.natW} ${content.natH}`}
      preserveAspectRatio="none"
    >
      {content.strokes.map((s, i) =>
        s.pressures ? (
          <path key={i} d={strokeOutlinePath(s.points, s.pressures, s.width)} fill={s.color} stroke="none" />
        ) : (
          <path
            key={i}
            d={strokesToPath(s.points)}
            stroke={s.color}
            strokeWidth={s.width}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
      {content.strokes.map((s, i) => (
        <path
          key={'hit-' + i}
          className="ink-hit"
          d={strokesToPath(s.points)}
          strokeWidth={Math.max(s.width, 12)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}
