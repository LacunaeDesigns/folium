import React from 'react'
import { Card } from '../model/types'

export interface CardBodyProps {
  card: Card
  /** true while the card sits inside a column (affects sizing) */
  inColumn?: boolean
  /** true in read-only contexts (presentation, exported viewer) */
  readOnly?: boolean
}

type BodyComponent = React.ComponentType<CardBodyProps>

/* Placeholder body — replaced per-type as card components land */
function PlaceholderBody({ card }: CardBodyProps) {
  return (
    <div
      style={{
        padding: 12,
        minHeight: 40,
        fontSize: 12,
        color: 'var(--ink-soft)',
      }}
    >
      {card.type}
    </div>
  )
}

const registry: Partial<Record<Card['type'], BodyComponent>> = {}

export function registerCardBody(type: Card['type'], component: BodyComponent) {
  registry[type] = component
}

export function getCardBody(type: Card['type']): BodyComponent {
  return registry[type] ?? PlaceholderBody
}
