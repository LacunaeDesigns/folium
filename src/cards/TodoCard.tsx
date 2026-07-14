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

  const remove = (id: string) => {
    if (items.length === 1) return
    const idx = items.findIndex((it) => it.id === id)
    setItems(items.filter((it) => it.id !== id))
    requestAnimationFrame(() => {
      const prev = items[Math.max(0, idx - 1)]
      const el = document.querySelector<HTMLInputElement>(`[data-todo-item="${prev.id}"]`)
      el?.focus()
    })
  }

  // grow a to-do textarea to fit its wrapped content
  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  const doneCount = items.filter((it) => it.done).length

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
              // Enter splits the item at the caret into two tasks; Shift+Enter
              // drops a line break within the item instead
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                splitAt(it.id, (e.target as HTMLTextAreaElement).selectionStart ?? it.text.length)
              }
              // only a deliberate (non-repeated) backspace on an empty item removes
              // it, so holding backspace to clear text can't cascade-delete rows
              if (e.key === 'Backspace' && it.text === '' && !e.repeat) {
                e.preventDefault()
                remove(it.id)
              }
            }}
          />
        </div>
      ))}
      {items.length > 1 && (
        <div className="todo-progress">
          {doneCount}/{items.length}
        </div>
      )}
    </div>
  )
}
