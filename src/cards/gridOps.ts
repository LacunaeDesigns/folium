/** Grid helpers for TableCard/ChartCard. All are pure: they return a new
 *  rows array (or the input unchanged when a constraint blocks the op).
 *  Convention: rows[0] is the header and is never moved or removed;
 *  `minCol` protects leading columns (the chart label column). */

export function insertRowAt(rows: string[][], afterIndex: number): string[][] {
  const width = rows[0]?.length ?? 0
  const next = rows.slice()
  next.splice(afterIndex + 1, 0, Array(width).fill(''))
  return next
}

export function removeRowAt(rows: string[][], index: number, minRows = 2): string[][] {
  if (index === 0) return rows
  if (rows.length <= minRows) return rows
  return rows.filter((_, i) => i !== index)
}

export function moveRow(rows: string[][], from: number, to: number): string[][] {
  if (from === 0 || to === 0) return rows
  if (from < 0 || from >= rows.length || to < 0 || to >= rows.length) return rows
  if (from === to) return rows
  const next = rows.slice()
  const [row] = next.splice(from, 1)
  next.splice(to, 0, row)
  return next
}

export function insertColAt(rows: string[][], afterIndex: number): string[][] {
  return rows.map((row) => {
    const next = row.slice()
    next.splice(afterIndex + 1, 0, '')
    return next
  })
}

export function removeColAt(rows: string[][], index: number, minCol = 0, minCols = 2): string[][] {
  if (index < minCol) return rows
  const width = rows[0]?.length ?? 0
  if (width <= minCols) return rows
  return rows.map((row) => row.filter((_, i) => i !== index))
}

export function moveCol(rows: string[][], from: number, to: number, minCol = 0): string[][] {
  if (from < minCol || to < minCol) return rows
  const width = rows[0]?.length ?? 0
  if (from < 0 || from >= width || to < 0 || to >= width) return rows
  if (from === to) return rows
  return rows.map((row) => {
    const next = row.slice()
    const [cell] = next.splice(from, 1)
    next.splice(to, 0, cell)
    return next
  })
}

export function applyTsvPaste(rows: string[][], anchorRow: number, anchorCol: number, text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const cells = lines.map((line) => line.split('\t'))

  const rowCount = Math.max(rows.length, anchorRow + cells.length)
  const colCount = Math.max(rows[0]?.length ?? 0, anchorCol + Math.max(...cells.map((c) => c.length)))

  const next: string[][] = []
  for (let r = 0; r < rowCount; r++) {
    const srcRow = rows[r] ?? []
    const row: string[] = []
    for (let c = 0; c < colCount; c++) {
      row.push(srcRow[c] ?? '')
    }
    next.push(row)
  }

  for (let i = 0; i < cells.length; i++) {
    const r = anchorRow + i
    for (let j = 0; j < cells[i].length; j++) {
      const c = anchorCol + j
      next[r][c] = cells[i][j]
    }
  }

  return next
}

export function nextCellPos(
  r: number,
  c: number,
  rowCount: number,
  colCount: number,
  key: 'Tab' | 'ShiftTab' | 'Enter',
): { r: number; c: number } | null {
  if (key === 'Tab') {
    if (c + 1 < colCount) return { r, c: c + 1 }
    if (r + 1 < rowCount) return { r: r + 1, c: 0 }
    return null
  }
  if (key === 'ShiftTab') {
    if (c - 1 >= 0) return { r, c: c - 1 }
    if (r - 1 >= 0) return { r: r - 1, c: colCount - 1 }
    return null
  }
  if (key === 'Enter') {
    if (r + 1 < rowCount) return { r: r + 1, c }
    return null
  }
  return null
}
