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
})
