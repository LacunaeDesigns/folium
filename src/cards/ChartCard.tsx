import React, { useState } from 'react'
import { CardBodyProps } from './registry'
import { ChartContent, ChartKind, BOARD_COLORS } from '../model/types'
import { useAtlasStore } from '../store/context'
import { useUi } from '../store/uiStore'
import { renderChartSvg } from '../charts/renderChart'

const KINDS: ChartKind[] = ['bar', 'line', 'pie', 'donut']

export function ChartCard({ card, readOnly }: CardBodyProps) {
  const content = card.content as ChartContent
  const store = useAtlasStore()
  const selected = useUi((s) => s.selection.length === 1 && s.selection[0] === card.id)
  const [editing, setEditing] = useState(false)
  const rows = content.rows

  const update = (patch: Partial<ChartContent>) => store.getState().updateContent(card.id, patch)
  const setRows = (next: string[][]) => update({ rows: next })
  const setCell = (r: number, c: number, v: string) =>
    setRows(rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row)))
  const addRow = () => setRows([...rows, ['', '']])
  const delRow = () => rows.length > 2 && setRows(rows.slice(0, -1))

  const svg = renderChartSvg({
    chart: content.chart,
    title: content.title,
    points: rows.slice(1).map((r) => ({ label: r[0] ?? '', value: parseFloat(r[1]) || 0 })),
    colors: BOARD_COLORS as unknown as string[],
  })

  const showGrid = editing && selected && !readOnly

  return (
    <div className="chart-card">
      {showGrid ? (
        <table className="chart-grid">
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className={r === 0 ? 'thead' : undefined}>
                {row.map((cell, c) => (
                  <td key={c}>
                    <input
                      value={cell}
                      placeholder={r === 0 ? (c === 0 ? 'Label' : 'Value') : ''}
                      onChange={(e) => setCell(r, c, e.target.value)}
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
            value={content.title}
            placeholder="Title"
            onChange={(e) => update({ title: e.target.value })}
          />
          <button onClick={() => setEditing((v) => !v)}>{editing ? 'Done' : 'Edit data'}</button>
          {showGrid && (
            <>
              <button onClick={addRow}>+ Row</button>
              <button onClick={delRow}>− Row</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
