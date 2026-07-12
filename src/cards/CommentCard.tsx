import React from 'react'
import { nanoid } from 'nanoid'
import { CardBodyProps } from './registry'
import { CommentContent, CommentReply } from '../model/types'
import { useAtlasStore } from '../store/context'
import { getUserName } from '../store/settings'

export function relTime(ts: number): string {
  const d = Date.now() - ts
  if (d < 60_000) return 'just now'
  if (d < 3_600_000) return Math.floor(d / 60_000) + 'm ago'
  if (d < 86_400_000) return Math.floor(d / 3_600_000) + 'h ago'
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function Avatar({ name }: { name: string }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase()
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  const hue = Math.abs(hash) % 360
  return (
    <span className="cmt-avatar" style={{ background: `hsl(${hue} 55% 55%)` }}>
      {initial}
    </span>
  )
}

export function CommentCard({ card, readOnly }: CardBodyProps) {
  const content = card.content as CommentContent
  const store = useAtlasStore()
  const [reply, setReply] = React.useState('')

  const addReply = () => {
    const text = reply.trim()
    if (!text) return
    const r: CommentReply = { id: nanoid(6), author: getUserName(), text, ts: Date.now() }
    store.getState().updateContent(card.id, { replies: [...content.replies, r] })
    setReply('')
  }

  return (
    <div className="comment-card">
      <div className="cmt-head">
        <Avatar name={content.author} />
        <span className="cmt-author">{content.author}</span>
        <span className="cmt-time">{relTime(content.ts)}</span>
      </div>
      <textarea
        className="cmt-text"
        placeholder="Write a comment…"
        value={content.text}
        readOnly={readOnly}
        rows={Math.max(1, Math.min(6, content.text.split('\n').length))}
        onChange={(e) => store.getState().updateContent(card.id, { text: e.target.value })}
      />
      {content.replies.map((r) => (
        <div key={r.id} className="cmt-reply">
          <Avatar name={r.author} />
          <div className="cmt-reply-body">
            <div className="cmt-head">
              <span className="cmt-author">{r.author}</span>
              <span className="cmt-time">{relTime(r.ts)}</span>
            </div>
            <div className="cmt-reply-text">{r.text}</div>
          </div>
        </div>
      ))}
      {!readOnly && (
        <div className="cmt-reply-row">
          <input
            className="cmt-reply-input"
            placeholder="Reply…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addReply()
            }}
          />
        </div>
      )}
    </div>
  )
}
