import { ChartKind } from '../model/types'

export interface ChartPoint {
  label: string
  value: number
}

export interface ChartSpec {
  chart: ChartKind
  title: string
  points: ChartPoint[]
  colors: string[]
}

/**
 * Pure, dependency-free SVG chart renderer.
 * MUST stay self-contained (no runtime imports, no module-scope refs) so the
 * HTML exporter can embed it verbatim via `renderChartSvg.toString()`.
 */
export function renderChartSvg(spec: ChartSpec): string {
  const W = 300
  const H = 200
  const esc = (s: string): string =>
    String(s == null ? '' : s).replace(
      /[&<>"]/g,
      (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[ch],
    )
  const points = spec.points || []
  const colors = spec.colors && spec.colors.length ? spec.colors : ['#2f6d5a']
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

  const total = points.reduce((a, p) => a + (p.value > 0 ? p.value : 0), 0)
  const max = points.reduce((a, p) => Math.max(a, p.value), 0)

  // Pie / donut -------------------------------------------------------------
  if (spec.chart === 'pie' || spec.chart === 'donut') {
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
      const v = points[i].value > 0 ? points[i].value : 0
      if (v <= 0) continue
      const a0 = (acc / total) * 360
      acc += v
      const a1 = (acc / total) * 360
      const laf = a1 - a0 > 180 ? 1 : 0
      const [x0o, y0o] = polar(a0, r)
      const [x1o, y1o] = polar(a1, r)
      const col = colors[i % colors.length]
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
      const [lx, ly] = polar((a0 + a1) / 2, r + 10)
      out +=
        '<text x="' + lx + '" y="' + ly + '" text-anchor="middle" dominant-baseline="middle" font-size="9" fill="#6e6857">' +
        esc(points[i].label) +
        '</text>'
    }
    return open + titleSvg + out + '</svg>'
  }

  // Bar / line --------------------------------------------------------------
  if (points.length === 0 || max <= 0) return open + titleSvg + placeholder + '</svg>'
  const padL = 10
  const padR = 10
  const padB = 22
  const x0 = padL
  const y0 = titleH
  const pw = W - padL - padR
  const ph = H - titleH - padB
  const baseY = y0 + ph
  const axis =
    '<line x1="' + x0 + '" y1="' + baseY + '" x2="' + (x0 + pw) + '" y2="' + baseY + '" stroke="#e2dac6" stroke-width="1"/>'
  const n = points.length
  let body = ''

  if (spec.chart === 'line') {
    const xat = (i: number): number => x0 + (n === 1 ? pw / 2 : (i * pw) / (n - 1))
    const yat = (v: number): number => baseY - (Math.max(0, v) / max) * ph
    const pts = points.map((p, i) => xat(i) + ',' + yat(p.value)).join(' ')
    body +=
      '<polyline points="' + pts + '" fill="none" stroke="' + colors[0] +
      '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
    for (let i = 0; i < n; i++) {
      body += '<circle cx="' + xat(i) + '" cy="' + yat(points[i].value) + '" r="2.5" fill="' + colors[0] + '"/>'
      body +=
        '<text x="' + xat(i) + '" y="' + (baseY + 12) + '" text-anchor="middle" font-size="9" fill="#6e6857">' +
        esc(points[i].label) +
        '</text>'
    }
  } else {
    // bar
    const slot = pw / n
    const bw = Math.min(slot * 0.6, 46)
    for (let i = 0; i < n; i++) {
      const v = Math.max(0, points[i].value)
      const bh = (v / max) * ph
      const cx = x0 + (i + 0.5) * slot
      const bx = cx - bw / 2
      const by = baseY - bh
      body += '<rect x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" rx="2" fill="' + colors[0] + '"/>'
      body +=
        '<text x="' + cx + '" y="' + (baseY + 12) + '" text-anchor="middle" font-size="9" fill="#6e6857">' +
        esc(points[i].label) +
        '</text>'
    }
  }
  return open + titleSvg + axis + body + '</svg>'
}
