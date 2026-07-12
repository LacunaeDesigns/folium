import React from 'react'
import { CardBodyProps } from './registry'
import { ImageContent } from '../model/types'
import { useAtlasStore, useDb } from '../store/context'
import { putBlob } from '../store/persist'
import { useBlobUrl } from './blobUrl'
import { Icon } from '../ui/Icons'

export function ImageCard({ card, readOnly }: CardBodyProps) {
  const content = card.content as ImageContent
  const store = useAtlasStore()
  const db = useDb()
  const blobUrl = useBlobUrl(content.blobId)
  const src = content.blobId ? blobUrl : content.url || null
  const [urlDraft, setUrlDraft] = React.useState('')
  const fileRef = React.useRef<HTMLInputElement>(null)

  const pickFile = async (file: File) => {
    const blobId = await putBlob(db, file)
    store.getState().updateContent(card.id, { blobId, url: '' })
  }

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    if (content.naturalW !== img.naturalWidth || content.naturalH !== img.naturalHeight) {
      store.getState().updateContent(card.id, {
        naturalW: img.naturalWidth,
        naturalH: img.naturalHeight,
      })
    }
  }

  if (!src) {
    if (readOnly) return <div className="image-empty">No image</div>
    return (
      <div className="image-empty no-drag" onPointerDown={(e) => e.stopPropagation()}>
        <button className="image-pick" onClick={() => fileRef.current?.click()}>
          <Icon name="image" size={18} /> Choose image…
        </button>
        <div className="image-or">or paste a URL</div>
        <input
          className="image-url"
          placeholder="https://…"
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && urlDraft.trim()) {
              store.getState().updateContent(card.id, { url: urlDraft.trim(), blobId: '' })
            }
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void pickFile(f)
          }}
        />
      </div>
    )
  }

  return (
    <figure className="image-card">
      <img src={src} alt={content.caption} draggable={false} onLoad={onImgLoad} />
      {(content.caption || !readOnly) && (
        <figcaption>
          <input
            className="image-caption"
            value={content.caption}
            placeholder={readOnly ? '' : 'Add a caption'}
            readOnly={readOnly}
            onChange={(e) => store.getState().updateContent(card.id, { caption: e.target.value })}
          />
        </figcaption>
      )}
    </figure>
  )
}
