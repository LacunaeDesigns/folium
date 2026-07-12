import { describe, it, expect } from 'vitest'
import { createAtlasStore } from '../store/store'
import { boardToMarkdown, tiptapToMarkdown } from './markdown'
import { noteDoc, todoItems } from '../templates/builder'

describe('tiptapToMarkdown', () => {
  it('converts headings, paragraphs and marks', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'plain ' },
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    }
    const md = tiptapToMarkdown(doc)
    expect(md).toContain('## Title')
    expect(md).toContain('plain **bold**')
  })
})

describe('boardToMarkdown', () => {
  it('renders board title, todos, tables and nested boards', () => {
    const store = createAtlasStore()
    const s = store.getState()
    s.renameBoard(s.rootId, 'Root Board')
    s.addCard(s.rootId, 'todo', {
      x: 0,
      y: 10,
      content: { title: 'Tasks', items: todoItems('first', 'second') } as never,
    })
    s.addCard(s.rootId, 'table', {
      x: 0,
      y: 20,
      content: { rows: [['A', 'B'], ['1', '2']] } as never,
    })
    const { boardId } = s.createBoard(s.rootId, 'Child', { x: 0, y: 30 })
    store.getState().addCard(boardId, 'note', {
      x: 0,
      y: 0,
      content: { doc: noteDoc('# Inside', 'child text') } as never,
    })

    const md = boardToMarkdown(store.getState(), store.getState().rootId)
    expect(md).toContain('# Root Board')
    expect(md).toContain('- [ ] first')
    expect(md).toContain('| A | B |')
    expect(md).toContain('## Child')
    expect(md).toContain('child text')
  })
})
