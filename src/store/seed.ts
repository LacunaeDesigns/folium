import { FoliumStore } from './store'
import { noteDoc, todoItems } from '../templates/builder'

/** First-run welcome content on the Home board. */
export function seedWelcome(store: FoliumStore): void {
  const s = store.getState()
  const home = s.rootId

  s.addCard(home, 'note', {
    x: 60,
    y: 60,
    w: 320,
    content: {
      doc: noteDoc(
        '# Welcome to Folium 👋',
        'Your own loose-leaf workspace — cards, boards and sketches, all stored on this machine.',
        '',
        '## The basics',
        'Pick a tool on the left, then click the canvas. Double-click empty space for a quick note. Drag cards anywhere; drag onto a column to stack them.',
      ),
    } as never,
  })

  s.addCard(home, 'image', {
    x: 430,
    y: 60,
    w: 380,
    content: { url: '/brand/welcome.svg', caption: 'Boards can hold anything' } as never,
  })

  s.addCard(home, 'sticky', {
    x: 860,
    y: 60,
    content: { text: 'Press Ctrl+K to search everything', color: 'yellow' } as never,
  })

  s.addCard(home, 'todo', {
    x: 860,
    y: 290,
    content: {
      title: 'Try this',
      items: todoItems(
        'Drag this card around',
        'Open Templates (top right)',
        'Draw on the canvas with the Draw tool',
        'Export this board as an HTML file',
      ),
    } as never,
  })

  const sample = s.createBoard(home, 'Sample Project', { x: 430, y: 420 })
  const col = s.addCard(sample.boardId, 'column', { x: 380, y: 60, content: { title: 'Ideas' } as never })
  const idea = s.addCard(sample.boardId, 'note', {
    x: 0,
    y: 0,
    content: { doc: noteDoc('A first idea — drag me out of the column.') } as never,
  })
  s.setCardColumn(idea, col, 0)
  s.addCard(sample.boardId, 'note', {
    x: 60,
    y: 60,
    content: { doc: noteDoc('# Sample Project', 'Boards nest inside boards. Use the breadcrumbs to go back up.'), bg: 'blue' } as never,
  })
  s.addCard(sample.boardId, 'comment', {
    x: 60,
    y: 260,
    content: { text: 'Comments keep feedback next to the work.' } as never,
  })
}
