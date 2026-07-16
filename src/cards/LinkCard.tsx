import React from 'react'
import { CardBodyProps } from './registry'
import { LinkContent } from '../model/types'
import { useFoliumStore } from '../store/context'
import { Icon } from '../ui/Icons'
import { useDebouncedCommit } from './useEditing'

export function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/,
  )
  return m ? m[1] : null
}

export function isMapsUrl(url: string): boolean {
  return /google\.com\/maps|maps\.google\.com|goo\.gl\/maps|maps\.app\.goo\.gl/i.test(url)
}

export function mapsPlaceName(url: string): string | null {
  const m = url.match(/\/maps\/place\/([^/@?]+)/i)
  if (!m) return null
  const raw = m[1].replace(/\+/g, ' ')
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export type DocKind = 'doc' | 'sheet' | 'slides' | 'notion'

export function isDocUrl(url: string): DocKind | null {
  if (/docs\.google\.com\/document/i.test(url)) return 'doc'
  if (/docs\.google\.com\/spreadsheets/i.test(url)) return 'sheet'
  if (/docs\.google\.com\/presentation/i.test(url)) return 'slides'
  if (/notion\.(so|site)/i.test(url)) return 'notion'
  return null
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
  const store = useFoliumStore()
  const [draft, setDraft] = React.useState('')
  const [titleDraft, setTitleDraft] = React.useState(content.title)
  const [descDraft, setDescDraft] = React.useState(content.description)
  const commitTitle = useDebouncedCommit((v) => store.getState().updateContent(card.id, { title: v as string }))
  const commitDesc = useDebouncedCommit((v) => store.getState().updateContent(card.id, { description: v as string }))

  React.useEffect(() => setTitleDraft(content.title), [content.title])
  React.useEffect(() => setDescDraft(content.description), [content.description])

  const commitUrl = (raw: string) => {
    let url = raw.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    const yt = youtubeId(url)
    const doc = isDocUrl(url)
    let defaultTitle: string
    if (yt) defaultTitle = 'YouTube video'
    else if (isMapsUrl(url)) defaultTitle = mapsPlaceName(url) || 'Map location'
    else if (doc === 'doc') defaultTitle = 'Google Doc'
    else if (doc === 'sheet') defaultTitle = 'Google Sheet'
    else if (doc === 'slides') defaultTitle = 'Google Slides'
    else if (doc === 'notion') defaultTitle = 'Notion page'
    else defaultTitle = domainOf(url)
    store.getState().updateContent(card.id, {
      url,
      title: content.title || defaultTitle,
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
  const isMap = !yt && isMapsUrl(content.url)
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
      {isMap && (
        <div className="link-thumb link-thumb-maps">
          <Icon name="pin" size={44} />
          <a
            className="link-play no-drag"
            href={content.url}
            target="_blank"
            rel="noreferrer"
            title="Open in Maps"
          >
            <Icon name="pin" size={22} />
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
          value={titleDraft}
          placeholder="Title"
          readOnly={readOnly}
          onChange={(e) => {
            setTitleDraft(e.target.value)
            commitTitle(e.target.value)
          }}
        />
        <textarea
          className="link-desc"
          value={descDraft}
          placeholder={readOnly ? '' : 'Add a description'}
          readOnly={readOnly}
          rows={descDraft ? undefined : 1}
          onChange={(e) => {
            setDescDraft(e.target.value)
            commitDesc(e.target.value)
          }}
        />
      </div>
    </div>
  )
}
