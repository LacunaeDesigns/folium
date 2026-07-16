import { Card } from '../model/types'

const SCHEMATIC_COLORS: Record<string, string> = {
  board: '#4c6ef5',
  column: '#c9c6bf',
  image: '#a3a7aa',
  sticky: '#f9e76f',
  shape: '#bfe8b4',
  table: '#f9c97c',
  swatch: '#d4589c',
}

/** Tiny abstract preview: colored rects for a board's (or template's) root-level cards. */
export function BoardSchematic({ cards, className }: { cards: Card[]; className?: string }) {
  if (cards.length === 0) return <div className={className ?? 'tpl-preview'} />
  const minX = Math.min(...cards.map((c) => c.x))
  const minY = Math.min(...cards.map((c) => c.y))
  const maxX = Math.max(...cards.map((c) => c.x + c.w))
  const maxY = Math.max(...cards.map((c) => c.y + (c.h ?? 90)))
  return (
    <svg
      className={className ?? 'tpl-preview'}
      viewBox={`${minX - 10} ${minY - 10} ${maxX - minX + 20} ${maxY - minY + 20}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {cards.map((c) => (
        <rect
          key={c.id}
          x={c.x}
          y={c.y}
          width={c.w}
          height={c.h ?? 90}
          rx={8}
          fill={SCHEMATIC_COLORS[c.type] ?? '#e8e6e1'}
          opacity={0.9}
        />
      ))}
    </svg>
  )
}
