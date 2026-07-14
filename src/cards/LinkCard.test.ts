import { describe, it, expect } from 'vitest'
import { youtubeId, isMapsUrl, mapsPlaceName, isDocUrl } from './LinkCard'

describe('isMapsUrl', () => {
  it('matches google.com/maps place links', () => {
    expect(isMapsUrl('https://www.google.com/maps/place/Eiffel+Tower/@48.8,2.2,17z')).toBe(true)
  })
  it('matches maps.google.com links', () => {
    expect(isMapsUrl('https://maps.google.com/?q=Central+Park')).toBe(true)
  })
  it('matches goo.gl/maps short links', () => {
    expect(isMapsUrl('https://goo.gl/maps/abc123')).toBe(true)
  })
  it('matches maps.app.goo.gl short links', () => {
    expect(isMapsUrl('https://maps.app.goo.gl/xyz789')).toBe(true)
  })
  it('does not match unrelated urls', () => {
    expect(isMapsUrl('https://example.com/maps-are-fun')).toBe(false)
  })
})

describe('mapsPlaceName', () => {
  it('extracts and decodes a place name with plus-encoded spaces', () => {
    expect(mapsPlaceName('https://www.google.com/maps/place/Eiffel+Tower/@48.8,2.2,17z')).toBe(
      'Eiffel Tower',
    )
  })
  it('url-decodes percent-encoded characters', () => {
    expect(
      mapsPlaceName('https://www.google.com/maps/place/Caf%C3%A9+de+Flore/@48.8,2.3,17z'),
    ).toBe('Café de Flore')
  })
  it('returns null when there is no /place/ segment', () => {
    expect(mapsPlaceName('https://maps.google.com/?q=Central+Park')).toBeNull()
  })
})

describe('isDocUrl', () => {
  it('detects Google Docs', () => {
    expect(isDocUrl('https://docs.google.com/document/d/abc123/edit')).toBe('doc')
  })
  it('detects Google Sheets', () => {
    expect(isDocUrl('https://docs.google.com/spreadsheets/d/abc123/edit')).toBe('sheet')
  })
  it('detects Google Slides', () => {
    expect(isDocUrl('https://docs.google.com/presentation/d/abc123/edit')).toBe('slides')
  })
  it('detects Notion pages via notion.so', () => {
    expect(isDocUrl('https://www.notion.so/My-Page-abc123')).toBe('notion')
  })
  it('detects Notion pages via notion.site', () => {
    expect(isDocUrl('https://myworkspace.notion.site/My-Page-abc123')).toBe('notion')
  })
  it('returns null for non-doc urls', () => {
    expect(isDocUrl('https://example.com/whatever')).toBeNull()
  })
})

describe('youtubeId (existing behavior, unaffected)', () => {
  it('still extracts a video id', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=abcdefghijk')).toBe('abcdefghijk')
  })
})

describe('fallthrough', () => {
  it('a plain domain matches none of the special detectors', () => {
    const url = 'https://example.com/some/page'
    expect(youtubeId(url)).toBeNull()
    expect(isMapsUrl(url)).toBe(false)
    expect(isDocUrl(url)).toBeNull()
  })
})
