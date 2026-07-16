import React from 'react'
import { CardBodyProps } from './registry'
import { TableContent } from '../model/types'
import { useFoliumStore } from '../store/context'
import { useUi } from '../store/uiStore'
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

// local draft + debounced commit per cell, so a keystroke doesn't flood the
// undo stack with an O(all cards) shallow copy — mirrors NoteCard's approach
function TableCell({
  value,
  row,
  col,
  readOnly,
  placeholder,
  onCommit,
  onFocusCell,
  onNavigate,
  onPasteGrid,
}: {
  value: string
  row: number
  col: number
  readOnly?: boolean
  placeholder?: string
  onCommit: (v: string) => void
  onFocusCell: (r: number, c: number) => void
  onNavigate: (r: number, c: number, key: 'Tab' | 'ShiftTab' | 'Enter') => void
  onPasteGrid: (r: number, c: number, text: string) => void
}) {
  const [draft, setDraft] = React.useState(value)
  const commit = useDebouncedCommit((v) => onCommit(v as string))

  React.useEffect(() => setDraft(value), [value])

  // grow a cell's textarea to fit its wrapped content, same approach as TodoCard
  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  return (
    <textarea
      ref={autoGrow}
      rows={1}
      data-row={row}
      data-col={col}
      value={draft}
      readOnly={readOnly}
      placeholder={placeholder}
      onFocus={() => onFocusCell(row, col)}
      onChange={(e) => {
        setDraft(e.target.value)
        commit(e.target.value)
        autoGrow(e.target)
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
        if (readOnly) return
        const text = e.clipboardData.getData('text/plain')
        if (/[\t\n]/.test(text)) {
          e.preventDefault()
          onPasteGrid(row, col, text)
        }
      }}
    />
  )
}

export function TableCard({ card, readOnly }: CardBodyProps) {
  const content = card.content as TableContent
  const store = useFoliumStore()
  const selected = useUi((s) => s.selection.length === 1 && s.selection[0] === card.id)
  const rows = content.rows
  const rootRef = React.useRef<HTMLDivElement>(null)
  const [lastCell, setLastCell] = React.useState<{ r: number; c: number } | null>(null)

  const setRows = (next: string[][]) => store.getState().updateContent(card.id, { rows: next })

  const setCell = (r: number, c: number, v: string) => {
    const next = rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row))
    setRows(next)
  }

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
  const delCol = () => setRows(removeColAt(rows, colIdx, 0, 1))
  const moveRowUp = () => setRows(moveRow(rows, rowIdx, rowIdx - 1))
  const moveRowDown = () => setRows(moveRow(rows, rowIdx, rowIdx + 1))
  const moveColLeft = () => setRows(moveCol(rows, colIdx, colIdx - 1))
  const moveColRight = () => setRows(moveCol(rows, colIdx, colIdx + 1))

  return (
    <div className="table-card" ref={rootRef}>
      <table>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className={r === 0 ? 'thead' : undefined}>
              {row.map((cell, c) => (
                <td key={c}>
                  <TableCell
                    value={cell}
                    row={r}
                    col={c}
                    readOnly={readOnly}
                    placeholder={r === 0 ? 'Header' : ''}
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
      {selected && !readOnly && (
        <div className="table-controls no-drag" onPointerDown={(e) => e.stopPropagation()}>
          <button onClick={addRow}>+ Row</button>
          <button onClick={delRow}>− Row</button>
          <button onClick={addCol}>+ Col</button>
          <button onClick={delCol}>− Col</button>
          <button onClick={moveRowUp}>Row ↑</button>
          <button onClick={moveRowDown}>Row ↓</button>
          <button onClick={moveColLeft}>Col ←</button>
          <button onClick={moveColRight}>Col →</button>
        </div>
      )}
    </div>
  )
}
