import { describe, it, expect } from 'vitest'
import { useLocalSave, recordLocalSave } from './localSave'

describe('useLocalSave', () => {
  it('starts with no recorded save', () => {
    expect(useLocalSave.getState().lastSavedAt).toBeNull()
  })

  it('records the timestamp of the latest save', () => {
    recordLocalSave(1000)
    expect(useLocalSave.getState().lastSavedAt).toBe(1000)
    recordLocalSave(2000)
    expect(useLocalSave.getState().lastSavedAt).toBe(2000)
  })
})
