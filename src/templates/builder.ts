import { FoliumState, cloneBoardSubtree, createFoliumStore } from '../store/store'
import { Template, TodoItem } from '../model/types'
import { nanoid } from 'nanoid'

/** Build a TipTap doc from simple strings: '# ' heading, '## ' subheading, else paragraph. */
export function noteDoc(...blocks: string[]): unknown {
  return {
    type: 'doc',
    content: blocks.map((b) => {
      if (b.startsWith('# ')) {
        return { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: b.slice(2) }] }
      }
      if (b.startsWith('## ')) {
        return { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: b.slice(3) }] }
      }
      if (b === '') return { type: 'paragraph' }
      return { type: 'paragraph', content: [{ type: 'text', text: b }] }
    }),
  }
}

export function todoItems(...texts: string[]): TodoItem[] {
  return texts.map((text) => ({ id: nanoid(6), text, done: false }))
}

export interface TemplateMetaInput {
  id: string
  name: string
  category: string
  description: string
}

/**
 * Author a template by building a real board in a scratch store,
 * then snapshotting its subtree.
 */
export function buildTemplate(
  meta: TemplateMetaInput,
  build: (s: FoliumState, boardId: string) => void,
): Template {
  const store = createFoliumStore()
  const st = store.getState()
  const { boardId } = st.createBoard(st.rootId, meta.name)
  build(store.getState(), boardId)
  const clone = cloneBoardSubtree(store.getState(), boardId)
  return {
    ...meta,
    builtIn: true,
    snapshot: {
      rootBoardId: clone.rootBoardId,
      boards: clone.boards.map((b) => (b.id === clone.rootBoardId ? { ...b, parentId: null } : b)),
      cards: clone.cards,
      lines: clone.lines,
    },
  }
}
