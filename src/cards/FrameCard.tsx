import React from 'react'
import { CardBodyProps } from './registry'
import { FrameContent } from '../model/types'
import { useFolium, useFoliumStore } from '../store/context'
import { frameMemberCount } from '../store/selectors'
import { useDebouncedCommit } from './useEditing'

export function FrameCard({ card, readOnly }: CardBodyProps) {
  const content = card.content as FrameContent
  const store = useFoliumStore()
  const count = useFolium((s) => frameMemberCount(s, card.id))
  const [titleDraft, setTitleDraft] = React.useState(content.title)
  const commitTitle = useDebouncedCommit((v) => store.getState().updateContent(card.id, { title: v as string }))

  React.useEffect(() => setTitleDraft(content.title), [content.title])

  return (
    <div className="frame-card">
      <div className="frame-head">
        <input
          className="frame-title"
          placeholder="Frame"
          value={titleDraft}
          readOnly={readOnly}
          onChange={(e) => {
            setTitleDraft(e.target.value)
            commitTitle(e.target.value)
          }}
        />
        <span className="frame-count">{count}</span>
      </div>
    </div>
  )
}
