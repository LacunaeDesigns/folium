import { nanoid } from 'nanoid'
import { CardClip } from './store'

// Session-scoped in-app clipboard for cards. Kept out of the doc store so it is
// neither persisted nor part of undo history, and survives board navigation.
let clip: CardClip | null = null

// Freshness marker for the OS clipboard: when a card clip is set via
// setClipboardStamped, we also write a unique sentinel to the native
// clipboard. A later paste can then tell whether the OS clipboard still
// holds what we just copied/cut, or whether something external (browser
// text, an OS screenshot) has replaced it since — see clipMatchesNative.
let sentinel: string | null = null
// true if the native write couldn't be confirmed (API unavailable, or the
// write rejected) — degrades clipMatchesNative back to today's
// clip-always-wins behavior rather than silently breaking card paste.
let stampFailed = false

export function setClipboard(c: CardClip | null): void {
  clip = c
  if (c === null) {
    sentinel = null
    stampFailed = false
  }
}

export function getClipboard(): CardClip | null {
  return clip
}

export function hasClipboard(): boolean {
  return clip !== null
}

/** Set the card clip and stamp the native clipboard with a fresh sentinel so
 *  a later paste can confirm the OS clipboard still carries what was just
 *  copied/cut. Must be called from within the same user gesture as the copy
 *  (keydown/click) so the async native write is permitted. Accepts null
 *  (collectClip's result when there's nothing to copy) as a passthrough to
 *  setClipboard(null), so call sites can stay one-liners. */
export function setClipboardStamped(c: CardClip | null): void {
  setClipboard(c)
  if (c === null) return
  const s = `folium-clip:${nanoid()}`
  sentinel = s
  stampFailed = false
  const clipboard = navigator.clipboard as Clipboard | undefined
  if (!clipboard?.writeText) {
    stampFailed = true
    return
  }
  clipboard.writeText(s).catch(() => {
    stampFailed = true
  })
}

/** Whether the in-app card clip should win a paste: true only when a clip
 *  exists AND either the native clipboard still carries our stamp, or
 *  stamping it failed earlier (fallback to clip-always-wins). */
export function clipMatchesNative(nativeText: string | undefined): boolean {
  if (clip === null) return false
  if (stampFailed) return true
  return nativeText === sentinel
}
