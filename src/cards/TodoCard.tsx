import React from 'react'
import { nanoid } from 'nanoid'
import { CardBodyProps } from './registry'
import { TodoContent, TodoItem } from '../model/types'
import { useAtlasStore } from '../store/context'

export function TodoCard({ card, readOnly }: CardBodyProps) {
  const content = card.content as TodoContent
  const store = useAtlasStore()
  const items = content.items

  const setItems = (next: TodoItem[]) => store.getState().updateContent(card.id, { items: next })

  const update = (id: string, patch: Partial<TodoItem>) =>
    setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)))

  // split the item at the cursor: text before the caret stays, text after moves
  // to a new item below (caret at the end → an empty new row, as before)
  const splitAt = (id: string, cursor: number) => {
    const idx = items.findIndex((it) => it.id === id)
    const cur = items[idx]
    const before = cur.text.slice(0, cursor)
    const after = cur.text.slice(cursor)
    const fresh = { id: nanoid(6), text: after, done: false }
    const next = [...items]
    next[idx] = { ...cur, text: before }
    next.splice(idx + 1, 0, fresh)
    setItems(next)
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLTextAreaElement>(`[data-todo-item="${fresh.id}"]`)
      el?.focus()
      el?.setSelectionRange(0, 0)
    })
  }

  // Backspace at the very start of an item merges its text into the end of the
  // previous item and removes this row (mirrors a normal text editor merging two
  // paragraphs) — an empty item is just the degenerate case of this same merge
  const mergeIntoPrevious = (id: string) => {
    const idx = items.findIndex((it) => it.id === id)
    if (idx <= 0) return // no previous item to merge into
    const cur = items[idx]
    const prev = items[idx - 1]
    const caretPos = prev.text.length
    const next = items.filter((it) => it.id !== id)
    next[idx - 1] = { ...prev, text: prev.text + cur.text }
    setItems(next)
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLTextAreaElement>(`[data-todo-item="${prev.id}"]`)
      el?.focus()
      el?.setSelectionRange(caretPos, caretPos)
    })
  }

  // grow a to-do textarea to fit its wrapped content
  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  const doneCount = items.filter((it) => it.done).length

  const clearDone = () => setItems(items.filter((it) => !it.done))

  return (
    <div className="todo-card">
      <input
        className="todo-title"
        placeholder="To-do list"
        value={content.title}
        readOnly={readOnly}
        onChange={(e) => store.getState().updateContent(card.id, { title: e.target.value })}
      />
      {items.map((it) => (
        <div key={it.id} className={'todo-item' + (it.done ? ' done' : '')}>
          <input
            type="checkbox"
            checked={it.done}
            disabled={readOnly}
            onChange={(e) => update(it.id, { done: e.target.checked })}
          />
          <textarea
            className="todo-text"
            data-todo-item={it.id}
            ref={autoGrow}
            rows={1}
            spellCheck
            value={it.text}
            placeholder="To-do"
            readOnly={readOnly}
            onChange={(e) => {
              update(it.id, { text: e.target.value })
              autoGrow(e.target)
            }}
            onKeyDown={(e) => {
              if (readOnly) return
              const ta = e.target as HTMLTextAreaElement
              // Enter splits the item at the caret into two tasks; Shift+Enter
              // drops a line break within the item instead
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                e.stopPropagation()
                splitAt(it.id, ta.selectionStart ?? it.text.length)
                return
              }
              // a deliberate (non-repeated) backspace with the caret at the very
              // start merges this item into the end of the previous one, same as
              // backspacing at the start of a paragraph in a normal text editor.
              // stopPropagation is essential here: once handled locally, this key
              // must never reach the window-level Delete/Backspace shortcut that
              // trashes the selected card — see the CardShell fromFormField note
              if (e.key === 'Backspace' && !e.repeat && ta.selectionStart === 0 && ta.selectionEnd === 0) {
                e.preventDefault()
                e.stopPropagation()
                mergeIntoPrevious(it.id)
              }
            }}
          />
        </div>
      ))}
      {items.length > 1 && (
        <div className="todo-progress">
          <span>
            {doneCount}/{items.length}
          </span>
          {!readOnly && doneCount > 0 && (
            <button className="todo-clear-done no-drag" onClick={clearDone}>
              Clear done
            </button>
          )}
        </div>
      )}
    </div>
  )
}
