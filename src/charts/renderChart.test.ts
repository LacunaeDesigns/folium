import { describe, it, expect } from 'vitest'
import { renderChartSvg, rowsToChartData } from './renderChart'

const PALETTE = ['#2f6d5a', '#b4622d', '#c24e3e']

const bars = {
  chart: 'bar' as const,
  title: '',
  seriesNames: ['V'],
  points: [
    { label: 'A', values: [4] },
    { label: 'B', values: [8] },
  ],
  palette: PALETTE,
}

describe('rowsToChartData', () => {
  it('reads header cells 1..N as series names', () => {
    const d = rowsToChartData([['Label', 'Sales', 'Costs'], ['A', '3', '5']])
    expect(d.seriesNames).toEqual(['Sales', 'Costs'])
  })

  it('maps each row to index-aligned numeric values', () => {
    const d = rowsToChartData([['Label', 'Sales', 'Costs'], ['A', '3', '5'], ['B', '7', '2']])
    expect(d.points).toEqual([
      { label: 'A', values: [3, 5] },
      { label: 'B', values: [7, 2] },
    ])
  })

  it('coerces missing / malformed cells to 0', () => {
    const d = rowsToChartData([['Label', 'S1', 'S2'], ['A', '', 'x']])
    expect(d.points[0].values).toEqual([0, 0])
  })

  it('treats a single value column as one series', () => {
    const d = rowsToChartData([['Label', 'Value'], ['A', '4']])
    expect(d.seriesNames).toEqual(['Value'])
    expect(d.points[0].values).toEqual([4])
  })
})

describe('renderChartSvg', () => {
  it('renders a bar chart with one rect per point', () => {
    const svg = renderChartSvg(bars)
    expect(svg).toContain('<svg')
    expect((svg.match(/<rect/g) || []).length).toBe(2)
  })

  it('scales bar heights to the value range', () => {
    const svg = renderChartSvg(bars)
    const heights = [...svg.matchAll(/<rect[^>]*height="([\d.]+)"/g)].map((m) => parseFloat(m[1]))
    const sorted = heights.slice().sort((a, b) => a - b)
    expect(sorted[1] / sorted[0]).toBeCloseTo(2, 1)
  })

  it('renders a single-series line chart as one polyline', () => {
    expect((renderChartSvg({ ...bars, chart: 'line' }).match(/<polyline/g) || []).length).toBe(1)
  })

  it('renders pie and donut as paths', () => {
    expect(renderChartSvg({ ...bars, chart: 'pie' })).toContain('<path')
    expect(renderChartSvg({ ...bars, chart: 'donut' })).toContain('<path')
  })

  it('shows a placeholder when all values are zero', () => {
    const svg = renderChartSvg({ ...bars, points: [{ label: 'A', values: [0] }] })
    expect(svg).toContain('Add data')
    expect(svg).not.toContain('<rect')
  })

  it('escapes label text', () => {
    const svg = renderChartSvg({ ...bars, points: [{ label: '<b>', values: [3] }] })
    expect(svg).toContain('&lt;b&gt;')
    expect(svg).not.toContain('<b>')
  })

  it('handles a single data point without throwing', () => {
    expect(renderChartSvg({ ...bars, points: [{ label: 'Solo', values: [5] }] })).toContain('<svg')
  })

  it('draws a single full-circle pie slice as a circle (not a degenerate arc)', () => {
    const svg = renderChartSvg({ ...bars, chart: 'pie', points: [{ label: 'Solo', values: [5] }] })
    expect(svg).toContain('<circle')
    expect(svg).not.toMatch(/<path d="M [\d.]+ [\d.]+ L ([\d.]+) ([\d.]+) A [\d.]+ [\d.]+ 0 \d 1 \1 \2/)
  })

  it('draws a single full-circle donut slice as an even-odd ring', () => {
    const svg = renderChartSvg({ ...bars, chart: 'donut', points: [{ label: 'Solo', values: [5] }] })
    expect(svg).toContain('fill-rule="evenodd"')
  })

  it('treats non-finite values as zero instead of poisoning the scale', () => {
    const svg = renderChartSvg({ ...bars, points: [{ label: 'A', values: [NaN] }, { label: 'B', values: [6] }] })
    expect(svg).toContain('<rect')
    expect(svg).not.toContain('NaN')
  })

  it('renders bars for all-negative data instead of the empty placeholder', () => {
    const svg = renderChartSvg({ ...bars, points: [{ label: 'A', values: [-4] }, { label: 'B', values: [-8] }] })
    expect(svg).toContain('<rect')
    expect(svg).not.toContain('Add data')
  })

  it('draws negative bars below the zero line and positive bars above it', () => {
    const svg = renderChartSvg({ ...bars, points: [{ label: 'P', values: [5] }, { label: 'N', values: [-5] }] })
    const zeroY = parseFloat((svg.match(/<line[^>]*y1="([\d.]+)"/) as RegExpMatchArray)[1])
    const rects = [...svg.matchAll(/<rect[^>]*y="([\d.]+)"[^>]*height="([\d.]+)"/g)].map((m) => ({
      y: parseFloat(m[1]),
      h: parseFloat(m[2]),
    }))
    expect(rects[0].y).toBeLessThan(zeroY)
    expect(rects[1].y).toBeCloseTo(zeroY, 1)
    expect(rects[1].y + rects[1].h).toBeGreaterThan(zeroY)
  })

  // --- multi-series ---

  const multi = {
    chart: 'bar' as const,
    title: '',
    seriesNames: ['Sales', 'Costs'],
    points: [
      { label: 'A', values: [4, 2] },
      { label: 'B', values: [8, 3] },
    ],
    palette: PALETTE,
  }

  it('draws one bar per series per label (grouped bars)', () => {
    const svg = renderChartSvg(multi)
    expect((svg.match(/<rect/g) || []).length).toBe(4) // 2 labels x 2 series
  })

  it('colors grouped bars by series from the palette', () => {
    const svg = renderChartSvg(multi)
    expect(svg).toContain('fill="' + PALETTE[0] + '"')
    expect(svg).toContain('fill="' + PALETTE[1] + '"')
  })

  it('draws one polyline per series for a multi-line chart', () => {
    const svg = renderChartSvg({ ...multi, chart: 'line' })
    expect((svg.match(/<polyline/g) || []).length).toBe(2)
  })

  it('shows a legend only when there is more than one series', () => {
    expect(renderChartSvg(multi)).toContain('>Sales<')
    expect(renderChartSvg(multi)).toContain('>Costs<')
    expect(renderChartSvg(bars)).not.toContain('>V<') // single series: no legend
  })

  it('plots only the first series for pie/donut', () => {
    // series[0] = [4, 8] -> two slices; extra series ignored
    const svg = renderChartSvg({ ...multi, chart: 'pie' })
    expect((svg.match(/<path/g) || []).length).toBe(2)
  })
})
