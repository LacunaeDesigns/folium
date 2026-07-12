import React from 'react'
import { useDb } from '../store/context'
import { getBlob } from '../store/persist'

const cache = new Map<string, string>()

/** Resolve a stored blob id to a stable object URL. */
export function useBlobUrl(blobId: string): string | null {
  const db = useDb()
  const [url, setUrl] = React.useState<string | null>(cache.get(blobId) ?? null)

  React.useEffect(() => {
    if (!blobId) {
      setUrl(null)
      return
    }
    const hit = cache.get(blobId)
    if (hit) {
      setUrl(hit)
      return
    }
    let alive = true
    getBlob(db, blobId).then((blob) => {
      if (!alive || !blob) return
      const u = URL.createObjectURL(blob)
      cache.set(blobId, u)
      setUrl(u)
    })
    return () => {
      alive = false
    }
  }, [blobId, db])

  return url
}
