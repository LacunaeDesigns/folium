import React from 'react'
import { useDb, useFoliumStore } from '../store/context'
import { useUi, DEFAULT_VIEW } from '../store/uiStore'
import { getPexelsKey } from '../store/settings'
import { searchPexels, fetchPexelsBlob, PexelsPhoto } from '../integrations/pexels'
import { putBlob } from '../store/persist'
import { screenToWorld } from '../canvas/coords'
import './pexels.css'

type Status = 'idle' | 'loading' | 'error' | 'empty'

export function PexelsPanel({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const db = useDb()
  const store = useFoliumStore()
  const [query, setQuery] = React.useState('')
  const [photos, setPhotos] = React.useState<PexelsPhoto[]>([])
  const [page, setPage] = React.useState(1)
  const [status, setStatus] = React.useState<Status>('idle')
  const [adding, setAdding] = React.useState<number | null>(null)
  const added = React.useRef(0)
  const hasKey = !!getPexelsKey()

  const run = async (q: string, p: number) => {
    if (!q.trim()) return
    setStatus('loading')
    try {
      const { photos } = await searchPexels(q, p)
      setPhotos(photos)
      setPage(p)
      setStatus(photos.length ? 'idle' : 'empty')
    } catch {
      setStatus('error')
    }
  }

  const pick = async (photo: PexelsPhoto) => {
    if (adding !== null) return
    setAdding(photo.id)
    try {
      const blob = await fetchPexelsBlob(photo.full)
      const blobId = await putBlob(db, blob)
      const vp = document.querySelector('.canvas-viewport') as HTMLElement | null
      const view = useUi.getState().views[boardId] ?? DEFAULT_VIEW
      const n = added.current++
      const center = vp
        ? screenToWorld(view, vp.clientWidth / 2 + n * 26, vp.clientHeight / 2 + n * 26)
        : { x: n * 26, y: n * 26 }
      const caption = photo.photographer ? `Photo: ${photo.photographer} / Pexels` : ''
      const id = store.getState().addCard(boardId, 'image', {
        x: center.x,
        y: center.y,
        content: { blobId, caption } as never,
      })
      useUi.getState().setSelection([id])
    } catch {
      setStatus('error')
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="pexels-overlay" onPointerDown={onClose}>
      <div className="pexels-panel" onPointerDown={(e) => e.stopPropagation()}>
        <div className="pexels-head">
          <input
            autoFocus
            className="pexels-search"
            placeholder="Search free photos on Pexels…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') run(query, 1)
            }}
          />
          <button className="pexels-close" title="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        {!hasKey && (
          <div className="pexels-msg">Add your Pexels API key in Settings to search for photos.</div>
        )}
        {hasKey && status === 'loading' && <div className="pexels-msg">Searching…</div>}
        {hasKey && status === 'error' && (
          <div className="pexels-msg">Couldn’t reach Pexels — check your API key and connection.</div>
        )}
        {hasKey && status === 'empty' && <div className="pexels-msg">No photos found.</div>}

        {photos.length > 0 && (
          <div className="pexels-grid">
            {photos.map((p) => (
              <button
                key={p.id}
                className="pexels-thumb"
                title={p.alt || p.photographer}
                onClick={() => pick(p)}
                disabled={adding !== null}
              >
                <img src={p.thumb} alt={p.alt} loading="lazy" />
                {adding === p.id && <span className="pexels-adding">Adding…</span>}
              </button>
            ))}
          </div>
        )}

        {photos.length > 0 && (
          <div className="pexels-foot">
            <button disabled={page <= 1 || status === 'loading'} onClick={() => run(query, page - 1)}>
              Prev
            </button>
            <span>Page {page}</span>
            <button disabled={status === 'loading'} onClick={() => run(query, page + 1)}>
              Next
            </button>
            <span className="pexels-credit">Photos provided by Pexels</span>
          </div>
        )}
      </div>
    </div>
  )
}
