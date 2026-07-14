import React from 'react'
import { CardBodyProps } from './registry'
import { StickerContent } from '../model/types'

export function StickerCard({ card }: CardBodyProps) {
  const content = card.content as StickerContent
  const size = Math.min(card.w, card.h ?? card.w)
  return (
    <div className="sticker-card" style={{ fontSize: size * 0.7 }}>
      {content.emoji}
    </div>
  )
}
