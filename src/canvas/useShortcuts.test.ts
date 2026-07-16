import { describe, it, expect } from 'vitest'
import { resolveCopyTargetIds, zOrderedIds } from './useShortcuts'

describe('resolveCopyTargetIds', () => {
  it('returns the ui selection when nothing is focused', () => {
    expect(resolveCopyTargetIds(null, ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('returns the ui selection when focus is on a non-form-field element', () => {
    const div = document.createElement('div')
    expect(resolveCopyTargetIds(div, ['a'])).toEqual(['a'])
  })

  it('falls back to the enclosing card when a form field is focused with no text selected', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-card-id', 'col1')
    const input = document.createElement('input')
    input.value = 'Column title'
    wrapper.appendChild(input)
    document.body.appendChild(wrapper)
    input.setSelectionRange(3, 3) // collapsed cursor, nothing selected

    expect(resolveCopyTargetIds(input, ['stale-selection'])).toEqual(['col1'])
    wrapper.remove()
  })

  it('defers to native copy (returns []) when the focused field has an actual text selection', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-card-id', 'col1')
    const input = document.createElement('input')
    input.value = 'Column title'
    wrapper.appendChild(input)
    document.body.appendChild(wrapper)
    input.setSelectionRange(0, 3) // "Col" actually highlighted

    expect(resolveCopyTargetIds(input, ['stale-selection'])).toEqual([])
    wrapper.remove()
  })

  it('returns [] when a form field is focused but is not inside any card', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.setSelectionRange(0, 0)

    expect(resolveCopyTargetIds(input, ['stale-selection'])).toEqual([])
    input.remove()
  })

  it('treats a textarea the same as an input', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-card-id', 'note1')
    const textarea = document.createElement('textarea')
    textarea.value = 'hello'
    wrapper.appendChild(textarea)
    document.body.appendChild(wrapper)
    textarea.setSelectionRange(2, 2)

    expect(resolveCopyTargetIds(textarea, [])).toEqual(['note1'])
    wrapper.remove()
  })

  // A note's rich-text body is a contentEditable div, not an input/textarea —
  // it has no .selectionStart/.selectionEnd at all, so highlighted text inside
  // it must be detected via window.getSelection() instead.
  it('defers to native copy when a contentEditable element has an actual highlighted selection', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-card-id', 'note1')
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    editable.textContent = 'hello world'
    wrapper.appendChild(editable)
    document.body.appendChild(wrapper)

    const range = document.createRange()
    range.setStart(editable.firstChild!, 0)
    range.setEnd(editable.firstChild!, 5) // "hello" highlighted
    const sel = window.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)

    expect(resolveCopyTargetIds(editable, ['stale-selection'])).toEqual([])
    wrapper.remove()
  })

  it('falls back to the enclosing card when a contentEditable element has only a collapsed cursor', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-card-id', 'note1')
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    editable.textContent = 'hello world'
    wrapper.appendChild(editable)
    document.body.appendChild(wrapper)

    const range = document.createRange()
    range.setStart(editable.firstChild!, 3)
    range.collapse(true)
    const sel = window.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)

    expect(resolveCopyTargetIds(editable, ['stale-selection'])).toEqual(['note1'])
    wrapper.remove()
  })
})

describe('zOrderedIds', () => {
  const z: Record<string, number> = { a: 3, b: 1, c: 2 }
  it('ascends for bring-to-front so stacking is preserved', () => {
    expect(zOrderedIds(['a', 'b', 'c'], (id) => z[id], 'front')).toEqual(['b', 'c', 'a'])
  })
  it('descends for send-to-back', () => {
    expect(zOrderedIds(['a', 'b', 'c'], (id) => z[id], 'back')).toEqual(['a', 'c', 'b'])
  })
})
