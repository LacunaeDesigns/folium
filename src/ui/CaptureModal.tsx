import React from 'react'
import { useFoliumStore } from '../store/context'
import { Icon } from './Icons'
import './panels.css'

export function CaptureModal({ rootId, onClose }: { rootId: string; onClose: () => void }) {
  const store = useFoliumStore()
  const [text, setText] = React.useState('')

  const capture = () => {
    const value = text.trim()
    if (!value) return
    store.getState().addCard(rootId, 'note', {
      inUnsorted: true,
      content: {
        doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }] },
      } as never,
    })
    setText('')
  }

  return (
    <div className="overlay" onPointerDown={onClose}>
      <div className="search-modal" onPointerDown={(e) => e.stopPropagation()}>
        <div className="search-row">
          <Icon name="plus" size={16} />
          <input
            autoFocus
            placeholder="Quick note…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onClose()
                return
              }
              if (e.key !== 'Enter') return
              e.preventDefault()
              capture()
              if (!e.shiftKey) onClose()
            }}
          />
          <span className="capture-hint">→ Inbox</span>
        </div>
      </div>
    </div>
  )
}
