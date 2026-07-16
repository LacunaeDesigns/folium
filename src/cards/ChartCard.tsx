import React, { useState, useEffect, useRef } from 'react'
import { CardBodyProps } from './registry'
import { ChartContent, ChartKind, BOARD_COLORS } from '../model/types'
import { useFoliumStore } from '../store/context'
import { useUi } from '../store/uiStore'
import { renderChartSvg, rowsToChartData } from '../charts/renderChart'
import { useDebouncedCommit } from './useEditing'
import {
  insertRowAt,
  removeRowAt,
  moveRow,
  insertColAt,
  removeColAt,
  moveCol,
  applyTsvPaste,
  nextCellPos,
} from './gridOps'

const KINDS: ChartKind[] = ['bar', 'line', 'pie', 'donut']

// local draft + debounced commit per cell, so a keystroke doesn't flood the
// undo stack with a full-grid copy — mirrors NoteCard's approach
function ChartCell({
  value,
  row,
  col,
  placeholder,
  onCommit,
  onFocusCell,
  onNavigate,
  onPasteGrid,
}: {
  value: string
  row: number
  col: number
  placeholder?: string
  onCommit: (v: string) => void
  onFocusCell: (r: number, c: number) => void
  onNavigate: (r: number, c: number, key: 'Tab' | 'ShiftTab' | 'Enter') => void
  onPasteGrid: (r: number, c: number, text: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const commit = useDebouncedCommit((v) => onCommit(v as string))

  useEffect(() => setDraft(value), [value])

  return (
    <input
      data-row={row}
      data-col={col}
      value={draft}
      placeholder={placeholder}
      onFocus={() => onFocusCell(row, col)}
      onChange={(e) => {
        setDraft(e.target.value)
        commit(e.target.value)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Tab') {
          e.preventDefault()
          onNavigate(row, col, e.shiftKey ? 'ShiftTab' : 'Tab')
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          onNavigate(row, col, 'Enter')
        }
      }}
      onPaste={(e) => {
        const text = e.clipboardData.getData('text/plain')
        if (/[\t\n]/.test(text)) {
          e.preventDefault()
          onPasteGrid(row, col, text)
        }
      }}
    />
  )
}

export function ChartCard({ card, readOnly }: CardBodyProps) {
  const content = card.content as ChartContent
  const store = useFoliumStore()
  const selected = useUi((s) => s.selection.length === 1 && s.selection[0] === card.id)
  const [editing, setEditing] = useState(false)
  const rows = content.rows
  const rootRef = useRef<HTMLDivElement>(null)
  const [lastCell, setLastCell] = useState<{ r: number; c: number } | null>(null)

  const update = (patch: Partial<ChartContent>) => store.getState().updateContent(card.id, patch)
  const setRows = (next: string[][]) => update({ rows: next })
  const setCell = (r: number, c: number, v: string) =>
    setRows(rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row)))

  const focusCell = (r: number, c: number) => {
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-row="${r}"][data-col="${c}"]`)
    el?.focus()
  }

  const navigate = (r: number, c: number, key: 'Tab' | 'ShiftTab' | 'Enter') => {
    const next = nextCellPos(r, c, rows.length, rows[0].length, key)
    if (next) focusCell(next.r, next.c)
  }

  const pasteGrid = (r: number, c: number, text: string) => setRows(applyTsvPaste(rows, r, c, text))

  const rowIdx = lastCell?.r ?? rows.length - 1
  const colIdx = lastCell?.c ?? rows[0].length - 1

  const addRow = () => setRows(insertRowAt(rows, rowIdx))
  const delRow = () => setRows(removeRowAt(rows, rowIdx))
  const addCol = () => setRows(insertColAt(rows, colIdx))
  const delCol = () => setRows(removeColAt(rows, colIdx, 1, 2))
  const moveRowUp = () => setRows(moveRow(rows, rowIdx, rowIdx - 1))
  const moveRowDown = () => setRows(moveRow(rows, rowIdx, rowIdx + 1))
  const moveColLeft = () => setRows(moveCol(rows, colIdx, colIdx - 1, 1))
  const moveColRight = () => setRows(moveCol(rows, colIdx, colIdx + 1, 1))

  const [titleDraft, setTitleDraft] = useState(content.title)
  const commitTitle = useDebouncedCommit((v) => update({ title: v as string }))

  useEffect(() => setTitleDraft(content.title), [content.title])

  const data = rowsToChartData(content.rows)
  const svg = renderChartSvg({
    chart: content.chart,
    title: content.title,
    seriesNames: data.seriesNames,
    points: data.points,
    palette: BOARD_COLORS as unknown as string[],
  })

  const showGrid = editing && selected && !readOnly

  return (
    <div className="chart-card" ref={rootRef}>
      {showGrid ? (
        <table className="chart-grid">
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className={r === 0 ? 'thead' : undefined}>
                {row.map((cell, c) => (
                  <td key={c}>
                    <ChartCell
                      value={cell}
                      row={r}
                      col={c}
                      placeholder={r === 0 ? (c === 0 ? 'Label' : 'Value') : ''}
                      onCommit={(v) => setCell(r, c, v)}
                      onFocusCell={(r2, c2) => setLastCell({ r: r2, c: c2 })}
                      onNavigate={navigate}
                      onPasteGrid={pasteGrid}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="chart-svg" dangerouslySetInnerHTML={{ __html: svg }} />
      )}
      {selected && !readOnly && (
        <div className="chart-controls no-drag" onPointerDown={(e) => e.stopPropagation()}>
          <div className="chart-kinds">
            {KINDS.map((k) => (
              <button key={k} className={content.chart === k ? 'on' : ''} onClick={() => update({ chart: k })}>
                {k}
              </button>
            ))}
          </div>
          <input
            className="chart-title-input"
            value={titleDraft}
            placeholder="Title"
            onChange={(e) => {
              setTitleDraft(e.target.value)
              commitTitle(e.target.value)
            }}
          />
          <button onClick={() => setEditing((v) => !v)}>{editing ? 'Done' : 'Edit data'}</button>
          {showGrid && (
            <>
              <button onClick={addRow}>+ Row</button>
              <button onClick={delRow}>− Row</button>
              <button onClick={addCol}>+ Series</button>
              <button onClick={delCol}>− Series</button>
              <button onClick={moveRowUp}>Row ↑</button>
              <button onClick={moveRowDown}>Row ↓</button>
              <button onClick={moveColLeft}>Col ←</button>
              <button onClick={moveColRight}>Col →</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
