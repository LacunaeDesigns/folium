import React from 'react'
import { nanoid } from 'nanoid'
import { CardBodyProps } from './registry'
import { ImageContent, ImagePin, CommentReply } from '../model/types'
import { useAtlasStore, useDb } from '../store/context'
import { putBlob } from '../store/persist'
import { useBlobUrl } from './blobUrl'
import { Icon } from '../ui/Icons'
import { useUi } from '../store/uiStore'
import { getUserName } from '../store/settings'
import { Avatar, relTime } from './CommentCard'

function PinPopover({
  pin,
  index,
  onReply,
  onDelete,
  onClose,
  readOnly,
}: {
  pin: ImagePin
  index: number
  onReply: (text: string) => void
  onDelete: () => void
  onClose: () => void
  readOnly?: boolean
}) {
  const [draft, setDraft] = React.useState('')
  return (
    <div className="pin-pop no-drag" onPointerDown={(e) => e.stopPropagation()}>
      <div className="cmt-head">
        <span className="pin-badge">{index + 1}</span>
        <Avatar name={pin.author} />
        <span className="cmt-author">{pin.author}</span>
        <span className="cmt-time">{relTime(pin.ts)}</span>
        <button className="pin-close" onClick={onClose} title="Close">
          <Icon name="close" size={12} />
        </button>
      </div>
      <div className="pin-text">{pin.text}</div>
      {pin.replies.map((r) => (
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
        <>
          <input
            className="cmt-reply-input"
            placeholder="Reply…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) {
                onReply(draft.trim())
                setDraft('')
              }
            }}
          />
          <button className="pin-delete" onClick={onDelete}>
            Delete pin
          </button>
        </>
      )}
    </div>
  )
}

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

  return <ImageView card={card} src={src} readOnly={readOnly} onImgLoad={onImgLoad} />
}

function ImageView({
  card,
  src,
  readOnly,
  onImgLoad,
}: {
  card: CardBodyProps['card']
  src: string
  readOnly?: boolean
  onImgLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void
}) {
  const content = card.content as ImageContent
  const store = useAtlasStore()
  const isSelected = useUi((s) => s.selection.length === 1 && s.selection[0] === card.id)
  const [pinMode, setPinMode] = React.useState(false)
  const [openPin, setOpenPin] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!isSelected) {
      setPinMode(false)
      setOpenPin(null)
    }
  }, [isSelected])

  const setPins = (pins: ImagePin[]) => store.getState().updateContent(card.id, { pins })

  const addPin = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pinMode) return
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    const pin: ImagePin = {
      id: nanoid(6),
      fx: (e.clientX - r.left) / r.width,
      fy: (e.clientY - r.top) / r.height,
      author: getUserName(),
      text: '',
      replies: [],
      ts: Date.now(),
    }
    setPins([...(content.pins ?? []), pin])
    setPinMode(false)
    setOpenPin(pin.id)
  }

  const pins = content.pins ?? []
  const open = pins.find((p) => p.id === openPin)
  const openIdx = pins.findIndex((p) => p.id === openPin)

  return (
    <figure className="image-card">
      <div className={'image-wrap' + (pinMode ? ' pinning' : '')} onClick={addPin}>
        <img src={src} alt={content.caption} draggable={false} onLoad={onImgLoad} />
        {pins.map((p, i) => (
          <button
            key={p.id}
            className="image-pin no-drag"
            style={{ left: p.fx * 100 + '%', top: p.fy * 100 + '%' }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              setOpenPin(openPin === p.id ? null : p.id)
            }}
            title={p.text || 'Comment pin'}
          >
            {i + 1}
          </button>
        ))}
        {isSelected && !readOnly && (
          <button
            className={'image-pin-toggle no-drag' + (pinMode ? ' on' : '')}
            title="Add a comment pin"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              setPinMode((v) => !v)
            }}
          >
            <Icon name="pin" size={14} />
          </button>
        )}
        {open && (
          <div className="pin-anchor" style={{ left: open.fx * 100 + '%', top: open.fy * 100 + '%' }}>
            {open.text === '' && !readOnly ? (
              <div className="pin-pop no-drag" onPointerDown={(e) => e.stopPropagation()}>
                <input
                  className="cmt-reply-input"
                  autoFocus
                  placeholder="What about this spot?"
                  onKeyDown={(e) => {
                    const v = (e.target as HTMLInputElement).value.trim()
                    if (e.key === 'Enter' && v) {
                      setPins(pins.map((p) => (p.id === open.id ? { ...p, text: v } : p)))
                    }
                    if (e.key === 'Escape') {
                      setPins(pins.filter((p) => p.id !== open.id))
                      setOpenPin(null)
                    }
                  }}
                />
              </div>
            ) : (
              <PinPopover
                pin={open}
                index={openIdx}
                readOnly={readOnly}
                onClose={() => setOpenPin(null)}
                onDelete={() => {
                  setPins(pins.filter((p) => p.id !== open.id))
                  setOpenPin(null)
                }}
                onReply={(text) => {
                  const r: CommentReply = { id: nanoid(6), author: getUserName(), text, ts: Date.now() }
                  setPins(pins.map((p) => (p.id === open.id ? { ...p, replies: [...p.replies, r] } : p)))
                }}
              />
            )}
          </div>
        )}
      </div>
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
