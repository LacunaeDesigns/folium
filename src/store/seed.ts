import { FoliumStore } from './store'
import { noteDoc, todoItems } from '../templates/builder'
import { welcomeNoteDoc } from './welcome'

/** First-run welcome content on the Home board: a hero row that says what
 *  Folium is, then a tour row where every major card type demos itself. */
export function seedWelcome(store: FoliumStore): void {
  const s = store.getState()
  const home = s.rootId

  // ---- hero row ----
  s.addCard(home, 'note', {
    x: 60,
    y: 60,
    w: 340,
    content: { doc: welcomeNoteDoc() } as never,
  })

  s.addCard(home, 'image', {
    x: 440,
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
        'Right-click a card — lock it, align it, recolor it',
        'Open Templates (top right)',
        'Draw on the canvas with the Draw tool',
        'Export this board as an HTML file',
      ),
    } as never,
  })

  // ---- tour row: each major card type demos itself ----
  s.addCard(home, 'heading', {
    x: 60,
    y: 500,
    content: { text: 'A quick tour', level: 2 } as never,
  })

  const col = s.addCard(home, 'column', { x: 60, y: 570, content: { title: 'Columns stack cards' } as never })
  const inCol = s.addCard(home, 'note', {
    x: 0,
    y: 0,
    content: { doc: noteDoc('Drag cards in — they snap into a tidy stack.') } as never,
  })
  s.setCardColumn(inCol, col, 0)
  const inCol2 = s.addCard(home, 'note', {
    x: 0,
    y: 0,
    content: { doc: noteDoc('Drag me out to set me free.'), bg: 'green' } as never,
  })
  s.setCardColumn(inCol2, col, 1)

  s.addCard(home, 'table', {
    x: 350,
    y: 570,
    w: 330,
    content: {
      rows: [
        ['Task', 'Status'],
        ['Sketch the layout', 'Done'],
        ['Pick a palette', 'In progress'],
        ['Tab moves cell to cell', 'Try it'],
      ],
    } as never,
  })

  s.addCard(home, 'chart', {
    x: 720,
    y: 570,
    w: 320,
    content: {
      chart: 'bar',
      title: 'Charts read tables like this one',
      rows: [
        ['Day', 'Cards'],
        ['Mon', '3'],
        ['Tue', '5'],
        ['Wed', '8'],
      ],
    } as never,
  })

  // frame first so it sits behind its members
  s.addCard(home, 'frame', {
    x: 1090,
    y: 540,
    w: 430,
    h: 300,
    content: { title: 'Frames group things' } as never,
  })
  const from = s.addCard(home, 'shape', {
    x: 1120,
    y: 600,
    content: { shape: 'rect', fill: 'blue', text: 'Drag from an edge…' } as never,
  })
  const to = s.addCard(home, 'shape', {
    x: 1330,
    y: 700,
    content: { shape: 'ellipse', fill: 'green', text: '…to connect' } as never,
  })
  s.addLine(home, { cardId: from }, { cardId: to })

  // ---- tips row ----
  s.addCard(home, 'sticky', {
    x: 60,
    y: 900,
    content: { text: 'Right-click the canvas for grid & snap-to-grid', color: 'green' } as never,
  })

  s.addCard(home, 'link', {
    x: 350,
    y: 900,
    w: 330,
    content: {
      url: 'https://github.com/LacunaeDesigns/folium',
      title: 'Folium is source-available',
      description: 'Read the code and grab updates on GitHub.',
    } as never,
  })

  // ---- nested-board demo ----
  const sample = s.createBoard(home, 'Sample Project', { x: 720, y: 900 })
  const scol = s.addCard(sample.boardId, 'column', { x: 380, y: 60, content: { title: 'Ideas' } as never })
  const idea = s.addCard(sample.boardId, 'note', {
    x: 0,
    y: 0,
    content: { doc: noteDoc('A first idea — drag me out of the column.') } as never,
  })
  s.setCardColumn(idea, scol, 0)
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
