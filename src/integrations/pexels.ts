import { getPexelsKey } from '../store/settings'

export interface PexelsPhoto {
  id: number
  /** small image for the grid */
  thumb: string
  /** ~1MB image downloaded into the card */
  full: string
  alt: string
  photographer: string
}

const API = 'https://api.pexels.com/v1/search'

/** Search Pexels. Throws 'no-key' when the API key is missing. */
export async function searchPexels(
  query: string,
  page = 1,
): Promise<{ photos: PexelsPhoto[]; totalResults: number }> {
  const key = getPexelsKey()
  if (!key) throw new Error('no-key')
  const url = `${API}?query=${encodeURIComponent(query)}&per_page=24&page=${page}`
  const res = await fetch(url, { headers: { Authorization: key } })
  if (!res.ok) throw new Error(`pexels ${res.status}`)
  const data = await res.json()
  const photos: PexelsPhoto[] = (data.photos ?? []).map(
    (p: {
      id: number
      alt?: string
      photographer?: string
      src: Record<string, string>
    }) => ({
      id: p.id,
      thumb: p.src.tiny ?? p.src.small ?? p.src.medium,
      full: p.src.large ?? p.src.medium ?? p.src.original,
      alt: p.alt ?? '',
      photographer: p.photographer ?? '',
    }),
  )
  return { photos, totalResults: data.total_results ?? photos.length }
}

/** Fetch a Pexels image as a Blob for local storage. */
export async function fetchPexelsBlob(url: string): Promise<Blob> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`image ${res.status}`)
  return res.blob()
}
