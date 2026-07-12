import { nanoid } from 'nanoid'
import { DocState, Template } from '../model/types'
import { AtlasDb } from './persist'
import { cloneBoardSubtree } from './store'
import { BUILTIN_TEMPLATES } from '../templates/builtins'

export async function listTemplates(db: AtlasDb): Promise<Template[]> {
  const user = await db.templates.toArray()
  return [...BUILTIN_TEMPLATES, ...user.sort((a, b) => a.name.localeCompare(b.name))]
}

export async function saveBoardAsTemplate(
  db: AtlasDb,
  state: DocState,
  boardId: string,
  name: string,
  description = '',
): Promise<Template> {
  const clone = cloneBoardSubtree(state, boardId)
  const template: Template = {
    id: 'user-' + nanoid(8),
    name,
    category: 'My templates',
    description,
    builtIn: false,
    snapshot: {
      rootBoardId: clone.rootBoardId,
      boards: clone.boards.map((b) =>
        b.id === clone.rootBoardId ? { ...b, parentId: null, title: name } : b,
      ),
      cards: clone.cards,
      lines: clone.lines,
    },
  }
  await db.templates.put(template)
  return template
}

export async function deleteUserTemplate(db: AtlasDb, id: string): Promise<void> {
  await db.templates.delete(id)
}
