import { describe, it, expect } from 'vitest'
import { labelNewSeriesHeader } from './ChartCard'

describe('labelNewSeriesHeader', () => {
  it('labels the header cell at colIndex, leaving other header cells and body rows untouched', () => {
    const rows = [
      ['Label', 'V1', ''],
      ['a', '1', ''],
    ]
    expect(labelNewSeriesHeader(rows, 2)).toEqual([
      ['Label', 'V1', 'Series 2'],
      ['a', '1', ''],
    ])
  })

  it('numbers the series by its column position so appending stays sequential', () => {
    const rows = [['Label', '']]
    expect(labelNewSeriesHeader(rows, 1)).toEqual([['Label', 'Series 1']])
  })
})
