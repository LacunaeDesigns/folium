import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { AllSelection } from '@tiptap/pm/state'
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

  // Regression: selecting the whole note with Ctrl+A produces a ProseMirror
  // AllSelection, not a plain TextSelection. Chaining both list toggles into
  // one transaction (.toggleOrderedList().toggleBulletList().run()) silently
  // no-ops against an AllSelection, even though each toggle works fine on its
  // own — caught via manual browser testing, not by the earlier (TextSelection
  // -only) tests above, since setTextSelection() never produces an AllSelection.
  it('converts every item when switching list type across an Nth-item AllSelection (Ctrl+A)', () => {
    const editor = makeEditor(
      '<ol>' + Array.from({ length: 5 }, (_, i) => `<li>item ${i + 1}</li>`).join('') + '</ol>',
    )
    editor.view.dispatch(editor.state.tr.setSelection(new AllSelection(editor.state.doc)))
    expect(editor.isActive('orderedList')).toBe(true)

    setBulletList(editor)

    const json = editor.getJSON() as { content: { type: string }[] }
    expect(json.content).toHaveLength(1)
    expect(json.content[0].type).toBe('bulletList')
    expect(editor.getText().replace(/\n+/g, ' ').trim()).toBe(
      Array.from({ length: 5 }, (_, i) => `item ${i + 1}`).join(' '),
    )
  })

  // Regression: toggling a list *off* (not switching type) also silently
  // no-ops against a genuine AllSelection, even as a single, unchained
  // toggleBulletList() call — caught via manual browser testing (Ctrl+A on
  // an already-bulleted note, click the bullet button, nothing happens).
  it('toggles a bullet list off across an AllSelection (Ctrl+A) instead of silently no-oping', () => {
    const editor = makeEditor('<ul><li>solo</li></ul>')
    editor.view.dispatch(editor.state.tr.setSelection(new AllSelection(editor.state.doc)))
    expect(editor.isActive('bulletList')).toBe(true)

    setBulletList(editor)

    expect(editor.isActive('bulletList')).toBe(false)
    expect(editor.getText().trim()).toBe('solo')
  })

  it('toggles an ordered list off across an AllSelection (Ctrl+A) instead of silently no-oping', () => {
    const editor = makeEditor('<ol><li>solo</li></ol>')
    editor.view.dispatch(editor.state.tr.setSelection(new AllSelection(editor.state.doc)))
    expect(editor.isActive('orderedList')).toBe(true)

    setOrderedList(editor)

    expect(editor.isActive('orderedList')).toBe(false)
    expect(editor.getText().trim()).toBe('solo')
  })
})
