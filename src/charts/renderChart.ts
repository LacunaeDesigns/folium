import { ChartKind } from '../model/types'

export interface ChartPoint {
  label: string
  values: number[]
}

export interface ChartData {
  seriesNames: string[]
  points: ChartPoint[]
}

export interface ChartSpec {
  chart: ChartKind
  title: string
  seriesNames: string[]
  points: ChartPoint[]
  palette: string[]
}

/**
 * Map the card's raw grid to chart data. rows[0] is the header
 * ['Label', <series names…>]; each later row is [label, v1, v2, …].
 * MUST stay self-contained — embedded into the HTML export via `.toString()`.
 */
export function rowsToChartData(rows: string[][]): ChartData {
  const header = rows[0] || []
  const seriesNames = header.slice(1)
  const n = seriesNames.length
  const points = rows.slice(1).map((r) => {
    const values: number[] = []
    for (let i = 0; i < n; i++) {
      const v = parseFloat(r[i + 1])
      values.push(Number.isFinite(v) ? v : 0)
    }
    return { label: r[0] == null ? '' : r[0], values: values }
  })
  return { seriesNames: seriesNames, points: points }
}

/**
 * Pure, dependency-free SVG chart renderer. Every color is indexed from
 * `spec.palette` (series j -> palette[j]; pie slice i -> palette[i]).
 * MUST stay self-contained so the HTML exporter can embed it via `.toString()`.
 */
export function renderChartSvg(spec: ChartSpec): string {
  const W = 300
  const H = 200
  const esc = (s: string): string =>
    String(s == null ? '' : s).replace(
      /[&<>"]/g,
      (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[ch],
    )
  const palette = spec.palette && spec.palette.length ? spec.palette : ['#2f6d5a']
  const names = spec.seriesNames && spec.seriesNames.length ? spec.seriesNames : ['']
  const nS = names.length
  const points = (spec.points || []).map((p) => {
    const vs: number[] = []
    for (let s = 0; s < nS; s++) {
      const v = (p.values || [])[s]
      vs.push(Number.isFinite(v) ? v : 0)
    }
    return { label: p.label, values: vs }
  })
  const color = (i: number): string => palette[i % palette.length]
  const titleH = spec.title ? 22 : 8
  const open =
    '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" font-family="Karla, sans-serif">'
  const titleSvg = spec.title
    ? '<text x="' + W / 2 + '" y="15" text-anchor="middle" font-size="13" font-weight="600" fill="#2c2a23">' +
      esc(spec.title) +
      '</text>'
    : ''
  const placeholder =
    '<text x="' + W / 2 + '" y="' + H / 2 + '" text-anchor="middle" font-size="12" fill="#a49b84">Add data</text>'

  const isBarLine = spec.chart === 'bar' || spec.chart === 'line'
  const showLegend = nS > 1 && isBarLine
  const legendH = showLegend ? 16 : 0
  let legendSvg = ''
  if (showLegend) {
    const ly = H - 5
    let lx = 10
    for (let s = 0; s < nS; s++) {
      const nm = names[s] || 'Series ' + (s + 1)
      legendSvg +=
        '<circle cx="' + (lx + 4) + '" cy="' + (ly - 4) + '" r="4" fill="' + color(s) + '"/>'
      legendSvg += '<text x="' + (lx + 11) + '" y="' + (ly - 1) + '" font-size="9" fill="#6e6857">' + esc(nm) + '</text>'
      lx += 11 + nm.length * 5 + 12
    }
  }

  // Pie / donut — first series only, colored per slice --------------------
  if (spec.chart === 'pie' || spec.chart === 'donut') {
    const total = points.reduce((a, p) => a + (p.values[0] > 0 ? p.values[0] : 0), 0)
    if (total <= 0) return open + titleSvg + placeholder + '</svg>'
    const cx = W / 2
    const cy = titleH + (H - titleH) / 2
    const r = Math.min(W, H - titleH) / 2 - 16
    const ir = spec.chart === 'donut' ? r * 0.55 : 0
    const polar = (ang: number, rad: number): [number, number] => {
      const a = ((ang - 90) * Math.PI) / 180
      return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]
    }
    let acc = 0
    let out = ''
    for (let i = 0; i < points.length; i++) {
      const v = points[i].values[0] > 0 ? points[i].values[0] : 0
      if (v <= 0) continue
      const a0 = (acc / total) * 360
      acc += v
      const a1 = (acc / total) * 360
      const col = color(i)
      if (a1 - a0 >= 359.999) {
        if (ir > 0) {
          out +=
            '<path fill-rule="evenodd" d="M ' + (cx - r) + ' ' + cy +
            ' A ' + r + ' ' + r + ' 0 1 0 ' + (cx + r) + ' ' + cy +
            ' A ' + r + ' ' + r + ' 0 1 0 ' + (cx - r) + ' ' + cy +
            ' M ' + (cx - ir) + ' ' + cy +
            ' A ' + ir + ' ' + ir + ' 0 1 0 ' + (cx + ir) + ' ' + cy +
            ' A ' + ir + ' ' + ir + ' 0 1 0 ' + (cx - ir) + ' ' + cy +
            ' Z" fill="' + col + '"/>'
        } else {
          out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + col + '"/>'
        }
      } else {
        const laf = a1 - a0 > 180 ? 1 : 0
        const [x0o, y0o] = polar(a0, r)
        const [x1o, y1o] = polar(a1, r)
        let d: string
        if (ir > 0) {
          const [x0i, y0i] = polar(a0, ir)
          const [x1i, y1i] = polar(a1, ir)
          d =
            'M ' + x0o + ' ' + y0o + ' A ' + r + ' ' + r + ' 0 ' + laf + ' 1 ' + x1o + ' ' + y1o +
            ' L ' + x1i + ' ' + y1i + ' A ' + ir + ' ' + ir + ' 0 ' + laf + ' 0 ' + x0i + ' ' + y0i + ' Z'
        } else {
          d = 'M ' + cx + ' ' + cy + ' L ' + x0o + ' ' + y0o + ' A ' + r + ' ' + r + ' 0 ' + laf + ' 1 ' + x1o + ' ' + y1o + ' Z'
        }
        out += '<path d="' + d + '" fill="' + col + '"/>'
      }
      const [lx, ly] = polar((a0 + a1) / 2, r + 10)
      out +=
        '<text x="' + lx + '" y="' + ly + '" text-anchor="middle" dominant-baseline="middle" font-size="9" fill="#6e6857">' +
        esc(points[i].label) +
        '</text>'
    }
    return open + titleSvg + out + '</svg>'
  }

  // Bar / line — floating zero baseline across all series ------------------
  let lo = 0
  let hi = 0
  for (let i = 0; i < points.length; i++) {
    for (let s = 0; s < nS; s++) {
      lo = Math.min(lo, points[i].values[s])
      hi = Math.max(hi, points[i].values[s])
    }
  }
  const range = hi - lo
  if (points.length === 0 || range === 0) return open + titleSvg + placeholder + legendSvg + '</svg>'
  const padL = 10
  const padR = 10
  const padB = 22
  const x0 = padL
  const plotTop = titleH
  const pw = W - padL - padR
  const ph = H - titleH - padB - legendH
  const plotBottom = plotTop + ph
  const yat = (v: number): number => plotBottom - ((v - lo) / range) * ph
  const zeroY = yat(0)
  const labelY = plotBottom + 12
  const axis =
    '<line x1="' + x0 + '" y1="' + zeroY + '" x2="' + (x0 + pw) + '" y2="' + zeroY + '" stroke="#e2dac6" stroke-width="1"/>'
  const n = points.length
  let body = ''

  if (spec.chart === 'line') {
    const xat = (i: number): number => x0 + (n === 1 ? pw / 2 : (i * pw) / (n - 1))
    for (let s = 0; s < nS; s++) {
      const pts = points.map((p, i) => xat(i) + ',' + yat(p.values[s])).join(' ')
      body +=
        '<polyline points="' + pts + '" fill="none" stroke="' + color(s) +
        '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
      for (let i = 0; i < n; i++) {
        body += '<circle cx="' + xat(i) + '" cy="' + yat(points[i].values[s]) + '" r="2.5" fill="' + color(s) + '"/>'
      }
    }
    for (let i = 0; i < n; i++) {
      body +=
        '<text x="' + xat(i) + '" y="' + labelY + '" text-anchor="middle" font-size="9" fill="#6e6857">' +
        esc(points[i].label) +
        '</text>'
    }
  } else {
    // grouped bars — sub-bars share the label slot, colored by series
    const slot = pw / n
    const groupW = Math.min(slot * 0.7, 50)
    const barW = groupW / nS
    const gap = nS > 1 ? 1.5 : 0
    for (let i = 0; i < n; i++) {
      const groupStart = x0 + i * slot + (slot - groupW) / 2
      for (let s = 0; s < nS; s++) {
        const yv = yat(points[i].values[s])
        const by = Math.min(yv, zeroY)
        const bh = Math.abs(yv - zeroY)
        const bx = groupStart + s * barW
        body +=
          '<rect x="' + bx + '" y="' + by + '" width="' + Math.max(0, barW - gap) + '" height="' + bh +
          '" rx="1.5" fill="' + color(s) + '"/>'
      }
      const cx = x0 + (i + 0.5) * slot
      body +=
        '<text x="' + cx + '" y="' + labelY + '" text-anchor="middle" font-size="9" fill="#6e6857">' +
        esc(points[i].label) +
        '</text>'
    }
  }
  return open + titleSvg + axis + body + legendSvg + '</svg>'
}
