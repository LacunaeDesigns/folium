import { describe, it, expect } from 'vitest'
import { isLight, isHexColor } from './color'

describe('isLight', () => {
  it('classifies white as light and black as dark', () => {
    expect(isLight('#ffffff')).toBe(true)
    expect(isLight('#000000')).toBe(false)
  })
})

describe('isHexColor', () => {
  it('accepts #rrggbb only', () => {
    expect(isHexColor('#a1b2c3')).toBe(true)
    expect(isHexColor('yellow')).toBe(false)
    expect(isHexColor('#fff')).toBe(false)
  })
})
