import { describe, it, expect } from 'vitest'
import { createFoliumStore } from '../store/store'
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

  it('renders a horizontalRule as a --- line, blank-line separated from neighboring paragraphs', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'above' }] },
        { type: 'horizontalRule' },
        { type: 'paragraph', content: [{ type: 'text', text: 'below' }] },
      ],
    }
    const md = tiptapToMarkdown(doc)
    expect(md).toBe('above\n\n---\n\nbelow')
  })

  it('renders a codeBlock as a fenced block tagged with its language, preserving code text verbatim', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'before' }] },
        {
          type: 'codeBlock',
          attrs: { language: 'ts' },
          // marks here prove the fence uses raw text, not the inline-mark pipeline
          content: [{ type: 'text', text: 'const x = 1 * 2', marks: [{ type: 'bold' }] }],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'after' }] },
      ],
    }
    const md = tiptapToMarkdown(doc)
    expect(md).toBe('before\n\n```ts\nconst x = 1 * 2\n```\n\nafter')
  })

  it('falls back to a plain fence for a codeBlock with no language attr', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'codeBlock', content: [{ type: 'text', text: 'plain code' }] }],
    }
    const md = tiptapToMarkdown(doc)
    expect(md).toBe('\n```\nplain code\n```\n')
  })

  it('renders a hardBreak inside a paragraph as a markdown line break', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'line one' }, { type: 'hardBreak' }, { type: 'text', text: 'line two' }],
        },
      ],
    }
    const md = tiptapToMarkdown(doc)
    expect(md).toBe('line one  \nline two')
  })
})

describe('boardToMarkdown', () => {
  it('renders board title, todos, tables and nested boards', () => {
    const store = createFoliumStore()
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

  it('renders a chart card as a data table', () => {
    const store = createFoliumStore()
    const s = store.getState()
    s.addCard(s.rootId, 'chart', {
      x: 0,
      y: 0,
      content: { title: 'Sales', rows: [['Label', 'Value'], ['A', '4'], ['B', '7']] } as never,
    })
    const md = boardToMarkdown(store.getState(), store.getState().rootId)
    expect(md).toContain('**Sales**')
    expect(md).toContain('| Label | Value |')
    expect(md).toContain('| A | 4 |')
  })
})
