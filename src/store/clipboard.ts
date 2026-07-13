import { CardClip } from './store'

// Session-scoped in-app clipboard for cards. Kept out of the doc store so it is
// neither persisted nor part of undo history, and survives board navigation.
let clip: CardClip | null = null

export function setClipboard(c: CardClip | null): void {
  clip = c
}

export function getClipboard(): CardClip | null {
  return clip
}

export function hasClipboard(): boolean {
  return clip !== null
}
