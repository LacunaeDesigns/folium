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

  const addAfter = (id: string) => {
    const idx = items.findIndex((it) => it.id === id)
    const next = [...items]
    const fresh = { id: nanoid(6), text: '', done: false }
    next.splice(idx + 1, 0, fresh)
    setItems(next)
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLInputElement>(`[data-todo-item="${fresh.id}"]`)
      el?.focus()
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
          <input
            className="todo-text"
            data-todo-item={it.id}
            value={it.text}
            placeholder="To-do"
            readOnly={readOnly}
            onChange={(e) => update(it.id, { text: e.target.value })}
            onKeyDown={(e) => {
              if (readOnly) return
              if (e.key === 'Enter') {
                e.preventDefault()
                addAfter(it.id)
              }
              if (e.key === 'Backspace' && it.text === '') {
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
