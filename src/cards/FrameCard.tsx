import React from 'react'
import { CardBodyProps } from './registry'
import { FrameContent } from '../model/types'
import { useAtlas, useAtlasStore } from '../store/context'
import { frameMemberCount } from '../store/selectors'

export function FrameCard({ card, readOnly }: CardBodyProps) {
  const content = card.content as FrameContent
  const store = useAtlasStore()
  const count = useAtlas((s) => frameMemberCount(s, card.id))

  return (
    <div className="frame-card">
      <div className="frame-head">
        <input
          className="frame-title"
          placeholder="Frame"
          value={content.title}
          readOnly={readOnly}
          onChange={(e) => store.getState().updateContent(card.id, { title: e.target.value })}
        />
        <span className="frame-count">{count}</span>
      </div>
    </div>
  )
}
