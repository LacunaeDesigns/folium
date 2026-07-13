import { describe, it, expect } from 'vitest'
import { renderChartSvg } from './renderChart'

const bars = {
  chart: 'bar' as const,
  title: '',
  points: [
    { label: 'A', value: 4 },
    { label: 'B', value: 8 },
  ],
  colors: ['#2f6d5a'],
}

describe('renderChartSvg', () => {
  it('renders a bar chart with one rect per point', () => {
    const svg = renderChartSvg(bars)
    expect(svg).toContain('<svg')
    expect((svg.match(/<rect/g) || []).length).toBe(2)
  })

  it('scales bar heights to the max value', () => {
    const svg = renderChartSvg(bars)
    const heights = [...svg.matchAll(/height="([\d.]+)"/g)].map((m) => parseFloat(m[1]))
    const sorted = heights.slice().sort((a, b) => a - b)
    expect(sorted[1] / sorted[0]).toBeCloseTo(2, 1)
  })

  it('renders a line chart as a polyline', () => {
    expect(renderChartSvg({ ...bars, chart: 'line' })).toContain('<polyline')
  })

  it('renders pie and donut as paths', () => {
    expect(renderChartSvg({ ...bars, chart: 'pie' })).toContain('<path')
    expect(renderChartSvg({ ...bars, chart: 'donut' })).toContain('<path')
  })

  it('shows a placeholder when all values are zero', () => {
    const svg = renderChartSvg({ ...bars, points: [{ label: 'A', value: 0 }] })
    expect(svg).toContain('Add data')
    expect(svg).not.toContain('<rect')
  })

  it('escapes label text', () => {
    const svg = renderChartSvg({ ...bars, points: [{ label: '<b>', value: 3 }] })
    expect(svg).toContain('&lt;b&gt;')
    expect(svg).not.toContain('<b>')
  })

  it('handles a single data point without throwing', () => {
    expect(renderChartSvg({ ...bars, points: [{ label: 'Solo', value: 5 }] })).toContain('<svg')
  })

  it('draws a single full-circle pie slice as a circle (not a degenerate arc)', () => {
    const svg = renderChartSvg({ ...bars, chart: 'pie', points: [{ label: 'Solo', value: 5 }] })
    expect(svg).toContain('<circle')
    // a lone slice must not collapse to a zero-length arc with identical endpoints
    expect(svg).not.toMatch(/<path d="M [\d.]+ [\d.]+ L ([\d.]+) ([\d.]+) A [\d.]+ [\d.]+ 0 \d 1 \1 \2/)
  })

  it('draws a single full-circle donut slice as an even-odd ring', () => {
    const svg = renderChartSvg({ ...bars, chart: 'donut', points: [{ label: 'Solo', value: 5 }] })
    expect(svg).toContain('fill-rule="evenodd"')
  })

  it('still splits a multi-slice pie into per-slice paths', () => {
    const svg = renderChartSvg({ ...bars, chart: 'pie' })
    expect((svg.match(/<path/g) || []).length).toBe(2)
  })

  it('treats non-finite values as zero instead of poisoning the scale', () => {
    const svg = renderChartSvg({ ...bars, points: [{ label: 'A', value: NaN }, { label: 'B', value: 6 }] })
    expect(svg).toContain('<rect')
    expect(svg).not.toContain('NaN')
  })

  it('renders bars for all-negative data instead of the empty placeholder', () => {
    const svg = renderChartSvg({ ...bars, points: [{ label: 'A', value: -4 }, { label: 'B', value: -8 }] })
    expect(svg).toContain('<rect')
    expect(svg).not.toContain('Add data')
  })

  it('gives symmetric +/- values equal bar heights around a mid-chart zero line', () => {
    const svg = renderChartSvg({ ...bars, points: [{ label: 'P', value: 5 }, { label: 'N', value: -5 }] })
    const heights = [...svg.matchAll(/<rect[^>]*height="([\d.]+)"/g)].map((m) => parseFloat(m[1]))
    expect(heights.length).toBe(2)
    expect(heights[0]).toBeCloseTo(heights[1], 1)
  })

  it('draws negative bars below the zero line and positive bars above it', () => {
    const svg = renderChartSvg({ ...bars, points: [{ label: 'P', value: 5 }, { label: 'N', value: -5 }] })
    const zeroY = parseFloat((svg.match(/<line[^>]*y1="([\d.]+)"/) as RegExpMatchArray)[1])
    const rects = [...svg.matchAll(/<rect[^>]*y="([\d.]+)"[^>]*height="([\d.]+)"/g)].map((m) => ({
      y: parseFloat(m[1]),
      h: parseFloat(m[2]),
    }))
    expect(rects[0].y).toBeLessThan(zeroY) // positive bar top is above the zero line
    expect(rects[1].y).toBeCloseTo(zeroY, 1) // negative bar starts at the zero line
    expect(rects[1].y + rects[1].h).toBeGreaterThan(zeroY) // …and extends below it
  })

  it('makes the line cross the zero baseline for mixed data', () => {
    const svg = renderChartSvg({ ...bars, chart: 'line', points: [{ label: 'A', value: 3 }, { label: 'B', value: -3 }] })
    const zeroY = parseFloat((svg.match(/<line[^>]*y1="([\d.]+)"/) as RegExpMatchArray)[1])
    const ys = (svg.match(/<polyline points="([^"]+)"/) as RegExpMatchArray)[1]
      .split(' ')
      .map((pt) => parseFloat(pt.split(',')[1]))
    expect(Math.min(...ys)).toBeLessThan(zeroY)
    expect(Math.max(...ys)).toBeGreaterThan(zeroY)
  })
})
