import { describe, it, expect } from 'vitest'
import { nextSectionIndex } from './HelpPanel'

describe('nextSectionIndex', () => {
  it('wraps in both directions and handles Home/End', () => {
    expect(nextSectionIndex(0, 'ArrowUp', 13)).toBe(12)
    expect(nextSectionIndex(12, 'ArrowDown', 13)).toBe(0)
    expect(nextSectionIndex(5, 'Home', 13)).toBe(0)
    expect(nextSectionIndex(5, 'End', 13)).toBe(12)
    expect(nextSectionIndex(5, 'a', 13)).toBeNull()
  })
})
