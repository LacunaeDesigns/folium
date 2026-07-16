import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setClipboard, hasClipboard, setClipboardStamped, clipMatchesNative } from './clipboard'
import { CardClip } from './store'

const clip: CardClip = {
  originBoardId: 'board1',
  rootIds: ['card1'],
  cards: [],
  boards: [],
  lines: [],
}

/** let a microtask-queued .catch()/.then() handler run before assertions */
async function flush(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0))
}

function stubClipboard(writeText: (text: string) => Promise<void>): void {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true,
  })
}

describe('clipMatchesNative / setClipboardStamped', () => {
  const original = (navigator as unknown as { clipboard?: Clipboard }).clipboard

  beforeEach(() => {
    setClipboard(null)
  })

  afterEach(() => {
    setClipboard(null)
    Object.defineProperty(navigator, 'clipboard', {
      value: original,
      configurable: true,
      writable: true,
    })
  })

  it('matches the sentinel that was written to the native clipboard', async () => {
    let written = ''
    stubClipboard((text) => {
      written = text
      return Promise.resolve()
    })
    setClipboardStamped(clip)
    await flush()

    expect(hasClipboard()).toBe(true)
    expect(clipMatchesNative(written)).toBe(true)
  })

  it('does not match unrelated native text', async () => {
    stubClipboard(() => Promise.resolve())
    setClipboardStamped(clip)
    await flush()

    expect(clipMatchesNative('unrelated text')).toBe(false)
  })

  it('does not match when native clipboard text is undefined', async () => {
    stubClipboard(() => Promise.resolve())
    setClipboardStamped(clip)
    await flush()

    expect(clipMatchesNative(undefined)).toBe(false)
  })

  it('falls back to clip-always-wins when the native write rejects', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')))
    setClipboardStamped(clip)
    await flush()

    expect(clipMatchesNative('anything')).toBe(true)
    expect(clipMatchesNative(undefined)).toBe(true)
  })

  it('falls back to clip-always-wins when navigator.clipboard is unavailable', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    setClipboardStamped(clip)

    expect(clipMatchesNative('anything')).toBe(true)
    expect(clipMatchesNative(undefined)).toBe(true)
  })

  it('setClipboard(null) clears the clip and the sentinel', async () => {
    stubClipboard(() => Promise.resolve())
    setClipboardStamped(clip)
    await flush()

    setClipboard(null)

    expect(hasClipboard()).toBe(false)
    expect(clipMatchesNative(undefined)).toBe(false)
    expect(clipMatchesNative('')).toBe(false)
  })
})
