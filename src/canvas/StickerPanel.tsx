import React from 'react'
import { useUi } from '../store/uiStore'

const STICKER_EMOJIS = [
  '⭐', '❤️', '✅', '🔥', '✨', '📌', '🚀', '💡',
  '🎯', '👍', '🙌', '⚡', '🎉', '📍', '🚩', '💬',
  '🔔', '⏰', '🌟', '💯', '😀', '😂', '🥳', '🤔',
]

/** Emoji palette shown while the sticker tool is armed — pick the active
 *  emoji here, then click the canvas to place it (see Canvas.placeAt). */
export function StickerPanel() {
  const emoji = useUi((s) => s.stickerEmoji)
  const setStickerEmoji = useUi((s) => s.setStickerEmoji)
  return (
    <div className="sticker-panel" onPointerDown={(e) => e.stopPropagation()}>
      {STICKER_EMOJIS.map((e) => (
        <button
          key={e}
          className={'sticker-choice' + (emoji === e ? ' on' : '')}
          onClick={() => setStickerEmoji(e)}
          title={e}
        >
          {e}
        </button>
      ))}
    </div>
  )
}
