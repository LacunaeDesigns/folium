import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { setBulletList, setOrderedList } from './NoteCard'

function makeEditor(html: string) {
  return new Editor({
    extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true })],
    content: html,
  })
}

describe('list type switching', () => {
  it('setOrderedList converts an active bullet list directly to an ordered list', () => {
    const editor = makeEditor('<ul><li>hello</li></ul>')
    expect(editor.isActive('bulletList')).toBe(true)

    setOrderedList(editor)

    expect(editor.isActive('orderedList')).toBe(true)
    expect(editor.isActive('bulletList')).toBe(false)
    // TipTap's getText() always inserts blockSeparator newlines for nested
    // list/paragraph structures (true even for a freshly-constructed, never
    // toggled list) — trim to check content survived, not exact formatting
    expect(editor.getText().trim()).toBe('hello')
  })

  it('setBulletList converts an active ordered list directly to a bullet list', () => {
    const editor = makeEditor('<ol><li>hello</li></ol>')
    expect(editor.isActive('orderedList')).toBe(true)

    setBulletList(editor)

    expect(editor.isActive('bulletList')).toBe(true)
    expect(editor.isActive('orderedList')).toBe(false)
    expect(editor.getText().trim()).toBe('hello')
  })

  it('setBulletList still toggles a bullet list off when it is already active', () => {
    const editor = makeEditor('<ul><li>hello</li></ul>')
    setBulletList(editor)
    expect(editor.isActive('bulletList')).toBe(false)
    expect(editor.isActive('orderedList')).toBe(false)
    expect(editor.getText().trim()).toBe('hello')
  })

  it('setOrderedList still toggles an ordered list off when it is already active', () => {
    const editor = makeEditor('<ol><li>hello</li></ol>')
    setOrderedList(editor)
    expect(editor.isActive('orderedList')).toBe(false)
    expect(editor.isActive('bulletList')).toBe(false)
    expect(editor.getText().trim()).toBe('hello')
  })
})
