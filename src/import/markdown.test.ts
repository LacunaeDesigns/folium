import { describe, it, expect } from 'vitest'
import { parseMarkdown } from './markdown'
import { importMarkdownBoard } from './importBoard'
import { createAtlasStore } from '../store/store'
import { tiptapText } from '../store/search'
import { boardCards } from '../store/selectors'
import { TodoContent, TableContent, LinkContent, ImageContent, NoteContent } from '../model/types'

describe('parseMarkdown', () => {
  it('uses a leading h1 as the title and splits sections into note blocks', () => {
    const { title, blocks } = parseMarkdown(
      '# My Board\n\nIntro paragraph.\n\n## Section A\n\nBody of A.\n\n## Section B\n\nBody of B.',
    )
    expect(title).toBe('My Board')
    const notes = blocks.filter((b) => b.kind === 'note')
    expect(notes).toHaveLength(3) // intro + A + B
    expect(tiptapText(notes[1].doc)).toContain('Section A')
    expect(tiptapText(notes[1].doc)).toContain('Body of A')
  })

  it('turns task-list runs into todo blocks', () => {
    const { blocks } = parseMarkdown('- [ ] first thing\n- [x] second thing\n- [ ] third')
    expect(blocks).toHaveLength(1)
    const todo = blocks[0]
    if (todo.kind !== 'todo') throw new Error('expected todo')
    expect(todo.items).toHaveLength(3)
    expect(todo.items[1].done).toBe(true)
    expect(todo.items[1].text).toBe('second thing')
  })

  it('turns pipe tables into table blocks (separator row stripped)', () => {
    const { blocks } = parseMarkdown('| Name | Cost |\n| --- | --- |\n| Gear | $6,500 |')
    const table = blocks[0]
    if (table.kind !== 'table') throw new Error('expected table')
    expect(table.rows).toEqual([
      ['Name', 'Cost'],
      ['Gear', '$6,500'],
    ])
  })

  it('turns standalone images and bare links into image/link blocks', () => {
    const { blocks } = parseMarkdown(
      '![moodboard shot](https://example.com/a.png)\n\nhttps://youtu.be/dQw4w9WgXcQ\n\n[Design ref](https://example.com/ref)',
    )
    expect(blocks.map((b) => b.kind)).toEqual(['image', 'link', 'link'])
    const img = blocks[0] as { kind: 'image'; url: string; caption: string }
    expect(img.url).toBe('https://example.com/a.png')
    expect(img.caption).toBe('moodboard shot')
    const link = blocks[2] as { kind: 'link'; url: string; title: string }
    expect(link.title).toBe('Design ref')
  })

  it('keeps bullet lists inside notes and parses inline bold/links into marks', () => {
    const { blocks } = parseMarkdown('Some **bold** text with a [link](https://x.com).\n\n- alpha\n- beta')
    const note = blocks[0]
    if (note.kind !== 'note') throw new Error('expected note')
    const json = JSON.stringify(note.doc)
    expect(json).toContain('"bold"')
    expect(json).toContain('https://x.com')
    expect(tiptapText(note.doc)).toContain('alpha')
  })

  it('handles empty input gracefully', () => {
    const { title, blocks } = parseMarkdown('   \n\n  ')
    expect(title).toBe('')
    expect(blocks).toHaveLength(0)
  })
})

describe('importMarkdownBoard', () => {
  it('creates a new board with cards for each block', () => {
    const store = createAtlasStore()
    const s = store.getState()
    const md = [
      '# Imported Board',
      '',
      'Welcome paragraph.',
      '',
      '- [ ] migrate everything',
      '',
      '| A | B |',
      '| - | - |',
      '| 1 | 2 |',
      '',
      '![shot](https://example.com/x.png)',
      '',
      'https://example.com/page',
    ].join('\n')

    const boardId = importMarkdownBoard(store, s.rootId, 'fallback-name.md', md)
    const state = store.getState()
    expect(state.boards[boardId].title).toBe('Imported Board')
    expect(state.boards[boardId].parentId).toBe(state.rootId)

    const cards = Object.values(state.cards).filter((c) => c.boardId === boardId)
    const types = cards.map((c) => c.type).sort()
    expect(types).toEqual(['image', 'link', 'note', 'table', 'todo'])
    // cards are laid out, not stacked on one point
    const positions = new Set(cards.map((c) => `${c.x},${c.y}`))
    expect(positions.size).toBe(cards.length)
    // and a board card for it exists on the parent
    expect(
      boardCards(state, state.rootId).some(
        (c) => c.content.kind === 'board' && c.content.boardId === boardId,
      ),
    ).toBe(true)
  })

  it('falls back to the filename when there is no h1', () => {
    const store = createAtlasStore()
    const boardId = importMarkdownBoard(store, store.getState().rootId, 'My Milanote Export.md', 'just a paragraph')
    expect(store.getState().boards[boardId].title).toBe('My Milanote Export')
  })
})
