import React from 'react'
import { CardBodyProps } from './registry'
import { TableContent } from '../model/types'
import { useFoliumStore } from '../store/context'
import { useUi } from '../store/uiStore'
import { useDebouncedCommit } from './useEditing'

// local draft + debounced commit per cell, so a keystroke doesn't flood the
// undo stack with an O(all cards) shallow copy — mirrors NoteCard's approach
function TableCell({
  value,
  readOnly,
  placeholder,
  onCommit,
}: {
  value: string
  readOnly?: boolean
  placeholder?: string
  onCommit: (v: string) => void
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
      value={draft}
      readOnly={readOnly}
      placeholder={placeholder}
      onChange={(e) => {
        setDraft(e.target.value)
        commit(e.target.value)
        autoGrow(e.target)
      }}
    />
  )
}

export function TableCard({ card, readOnly }: CardBodyProps) {
  const content = card.content as TableContent
  const store = useFoliumStore()
  const selected = useUi((s) => s.selection.length === 1 && s.selection[0] === card.id)
  const rows = content.rows

  const setRows = (next: string[][]) => store.getState().updateContent(card.id, { rows: next })

  const setCell = (r: number, c: number, v: string) => {
    const next = rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row))
    setRows(next)
  }

  const addRow = () => setRows([...rows, rows[0].map(() => '')])
  const delRow = () => rows.length > 2 && setRows(rows.slice(0, -1))
  const addCol = () => setRows(rows.map((r) => [...r, '']))
  const delCol = () => rows[0].length > 1 && setRows(rows.map((r) => r.slice(0, -1)))

  return (
    <div className="table-card">
      <table>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className={r === 0 ? 'thead' : undefined}>
              {row.map((cell, c) => (
                <td key={c}>
                  <TableCell
                    value={cell}
                    readOnly={readOnly}
                    placeholder={r === 0 ? 'Header' : ''}
                    onCommit={(v) => setCell(r, c, v)}
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
        </div>
      )}
    </div>
  )
}
