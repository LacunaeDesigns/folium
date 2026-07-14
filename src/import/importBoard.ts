import { nanoid } from 'nanoid'
import { FoliumStore } from '../store/store'
import { parseMarkdown, ParsedBlock } from './markdown'

const COLS = 3
const CARD_W = 280
const GAP = 26
const X0 = 60
const Y0 = 60

function estimateHeight(block: ParsedBlock): number {
  switch (block.kind) {
    case 'note':
      return 44 + block.estLines * 20
    case 'todo':
      return 48 + block.items.length * 26
    case 'table':
      return 20 + block.rows.length * 34
    case 'image':
      return 230
    case 'link':
      return 96
  }
}

/**
 * Import a markdown document as a new board under `parentBoardId`.
 * Returns the new board id.
 */
export function importMarkdownBoard(
  store: FoliumStore,
  parentBoardId: string,
  filename: string,
  md: string,
  at: { x: number; y: number } = { x: 80, y: 80 },
): string {
  const { title, blocks } = parseMarkdown(md)
  const name =
    title ||
    filename
      .replace(/\.(md|markdown|txt)$/i, '')
      .trim() ||
    'Imported board'

  const s = store.getState()
  const { boardId } = s.createBoard(parentBoardId, name, at)

  // masonry layout: place each block in the currently-shortest column
  const colY: number[] = Array(COLS).fill(Y0)
  for (const block of blocks) {
    const col = colY.indexOf(Math.min(...colY))
    const x = X0 + col * (CARD_W + GAP)
    const y = colY[col]
    const st = store.getState()
    switch (block.kind) {
      case 'note':
        st.addCard(boardId, 'note', { x, y, w: CARD_W, content: { doc: block.doc } as never })
        break
      case 'todo':
        st.addCard(boardId, 'todo', {
          x,
          y,
          w: CARD_W,
          content: {
            title: '',
            items: block.items.map((it) => ({ id: nanoid(6), text: it.text, done: it.done })),
          } as never,
        })
        break
      case 'table':
        st.addCard(boardId, 'table', { x, y, w: CARD_W + 60, content: { rows: block.rows } as never })
        break
      case 'image':
        st.addCard(boardId, 'image', {
          x,
          y,
          w: CARD_W,
          content: { url: block.url, caption: block.caption } as never,
        })
        break
      case 'link':
        st.addCard(boardId, 'link', {
          x,
          y,
          w: CARD_W,
          content: { url: block.url, title: block.title } as never,
        })
        break
    }
    colY[col] += estimateHeight(block) + GAP
  }

  return boardId
}
