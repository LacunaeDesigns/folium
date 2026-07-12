import React from 'react'
import { CardBodyProps } from './registry'
import { LinkContent } from '../model/types'
import { useAtlasStore } from '../store/context'
import { Icon } from '../ui/Icons'

export function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/,
  )
  return m ? m[1] : null
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function LinkCard({ card, readOnly }: CardBodyProps) {
  const content = card.content as LinkContent
  const store = useAtlasStore()
  const [draft, setDraft] = React.useState('')

  const commitUrl = (raw: string) => {
    let url = raw.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    const yt = youtubeId(url)
    store.getState().updateContent(card.id, {
      url,
      title: content.title || (yt ? 'YouTube video' : domainOf(url)),
    })
  }

  if (!content.url) {
    if (readOnly) return <div className="link-empty">No link</div>
    return (
      <div className="link-empty no-drag" onPointerDown={(e) => e.stopPropagation()}>
        <Icon name="link" size={16} />
        <input
          className="link-input"
          placeholder="Paste or type a link…"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitUrl(draft)
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text')
            if (text) {
              e.preventDefault()
              commitUrl(text)
            }
          }}
        />
      </div>
    )
  }

  const yt = youtubeId(content.url)
  const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domainOf(content.url))}&sz=32`

  return (
    <div className="link-card">
      {yt && (
        <div className="link-thumb">
          <img src={`https://img.youtube.com/vi/${yt}/hqdefault.jpg`} alt="" draggable={false} />
          <a
            className="link-play no-drag"
            href={content.url}
            target="_blank"
            rel="noreferrer"
            title="Open video"
          >
            <Icon name="play" size={22} />
          </a>
        </div>
      )}
      <div className="link-body">
        <div className="link-url-row">
          <img className="link-favicon" src={favicon} alt="" draggable={false} />
          <a className="link-url no-drag" href={content.url} target="_blank" rel="noreferrer">
            {content.url}
          </a>
        </div>
        <input
          className="link-title"
          value={content.title}
          placeholder="Title"
          readOnly={readOnly}
          onChange={(e) => store.getState().updateContent(card.id, { title: e.target.value })}
        />
        <textarea
          className="link-desc"
          value={content.description}
          placeholder={readOnly ? '' : 'Add a description'}
          readOnly={readOnly}
          rows={content.description ? undefined : 1}
          onChange={(e) => store.getState().updateContent(card.id, { description: e.target.value })}
        />
      </div>
    </div>
  )
}
