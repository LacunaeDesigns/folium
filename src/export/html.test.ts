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
    // fan-out algorithm ported from LinesLayer.tsx
    expect(html).toContain('sideOf')
    expect(html).toContain('fanT')
    expect(html).toContain('withFan')

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
