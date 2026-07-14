import { describe, it, expect } from 'vitest'
import { buildHtmlExport } from './html'
import { ExportBundle } from './collect'
import { Board, Card, Line } from '../model/types'

function makeBundle(lines: Line[]): ExportBundle {
  const board: Board = {
    id: 'b1',
    parentId: null,
    title: 'Test Board',
    icon: '',
    color: '#000',
    theme: 'light',
    createdAt: 0,
  }
  const card1: Card = {
    id: 'c1',
    boardId: 'b1',
    type: 'sticky',
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    z: 0,
    colId: null,
    colIndex: 0,
    frameId: null,
    inUnsorted: false,
    trashed: false,
    createdAt: 0,
    content: { kind: 'sticky', text: 'A', color: 'yellow' },
  }
  const card2: Card = { ...card1, id: 'c2', x: 300, y: 0 }
  return {
    rootBoardId: 'b1',
    boards: [board],
    cards: [card1, card2],
    lines,
    blobs: {},
    exportedAt: 0,
    appName: 'Folium',
  }
}

describe('buildHtmlExport line rendering', () => {
  it('mirrors the live renderer: per-line color/width/dash, arrowStart, and color-keyed markers', () => {
    const line: Line = {
      id: 'l1',
      boardId: 'b1',
      from: { cardId: 'c1' },
      to: { cardId: 'c2' },
      curve: 0,
      arrowStart: true,
      arrowEnd: true,
      label: 'hi',
      color: '#e6553f',
      width: 4,
      dash: true,
    }
    const html = buildHtmlExport(makeBundle([line]))

    // per-line stroke/width/dash wiring
    expect(html).toContain("(l.width||2)")
    expect(html).toContain('stroke-dasharray:6 6')
    // arrowStart is now emitted alongside arrowEnd, both keyed to a per-color marker
    expect(html).toContain('marker-start')
    expect(html).toContain('marker-end')
    expect(html).toContain('colorIds')
    // the fan-out algorithm was removed from LinesLayer.tsx (lines from a shared
    // anchor must converge on the exact point); the export must mirror that
    expect(html).not.toContain('fanT')
    expect(html).not.toContain('withFan')

    // the fixture's line data must round-trip into the embedded JSON
    expect(html).toContain('"color":"#e6553f"')
    expect(html).toContain('"width":4')
    expect(html).toContain('"dash":true')
    expect(html).toContain('"label":"hi"')
    expect(html).toContain('"arrowStart":true')
  })

  it('still renders a plain line with defaults when no styling is set', () => {
    const line: Line = {
      id: 'l2',
      boardId: 'b1',
      from: { cardId: 'c1' },
      to: { cardId: 'c2' },
      curve: 0,
      arrowStart: false,
      arrowEnd: false,
      label: '',
    }
    const html = buildHtmlExport(makeBundle([line]))
    expect(html).toContain('var(--soft)')
    expect(html).toContain('"id":"l2"')
  })
})

describe('buildHtmlExport frame rendering', () => {
  it('renders a frame card as a labeled box behind regular cards', () => {
    const bundle = makeBundle([])
    const frame: Card = {
      ...bundle.cards[0],
      id: 'f1',
      type: 'frame',
      x: 0,
      y: 0,
      w: 400,
      h: 300,
      z: 0,
      content: { kind: 'frame', title: 'My Section' },
    }
    bundle.cards.push(frame)
    const html = buildHtmlExport(bundle)

    expect(html).toContain('framec')
    expect(html).toContain('My Section')
    // frames get a very-negative z-index so they render behind regular cards,
    // mirroring CardShell.tsx's live-app behavior
    expect(html).toContain("c.type==='frame'")
    expect(html).toContain('frame:1') // TP (transparent) map entry
  })
})

describe('buildHtmlExport heading rendering', () => {
  it('renders a heading card with its level as a CSS class, and the fixture round-trips into the embedded JSON', () => {
    const bundle = makeBundle([])
    const heading: Card = {
      ...bundle.cards[0],
      id: 'h1',
      type: 'heading',
      content: { kind: 'heading', text: 'Chapter One', level: 2 },
    }
    bundle.cards.push(heading)
    const html = buildHtmlExport(bundle)

    // static JS-source fragments the viewer script uses to render a heading card
    expect(html).toContain("case 'heading'")
    expect(html).toContain('class="headingc h')
    expect(html).toContain('.headingc.h2{')
    // the fixture's card data must round-trip into the embedded JSON
    expect(html).toContain('"text":"Chapter One"')
    expect(html).toContain('"level":2')
  })
})
