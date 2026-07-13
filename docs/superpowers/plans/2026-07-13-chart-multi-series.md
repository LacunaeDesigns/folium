# Chart Multi-Series Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a chart card plot multiple value series (grouped bars / multi-line) from an N-column grid, with a legend, rendering identically in-app and in the self-contained HTML export; pie/donut show the first series only.

**Architecture:** `renderChartSvg` takes a series-aware `ChartSpec` (`seriesNames[]`, `points[{label, values[]}]`, `palette[]`) and assigns every color by index from `palette`. A shared pure helper `rowsToChartData(rows)` maps the card's `string[][]` grid to `{seriesNames, points}`; both the React card and the HTML export embed it. Single-series data is just N=1 and renders as before (no legend).

**Tech Stack:** React 18 + TypeScript, Zustand, Vitest. No new dependencies.

## Global Constraints

- `renderChartSvg` AND `rowsToChartData` MUST be self-contained: no runtime imports, no module-scope refs, only params + locals + `Math`/`parseFloat`/`Number.isFinite` + string/array/regex ops. Both are embedded into the export via `.toString()`. (Type-only imports erase at compile — fine.)
- Values parsed with `parseFloat(x)` then non-finite coerced to `0`. Never throw on malformed input.
- Warm-paper palette: `BOARD_COLORS` from `src/model/types.ts` = `['#2f6d5a','#b4622d','#c24e3e','#b8912e','#5b7fa6','#7a5f96','#a64d79','#5f7040','#6b5138','#5c6062']`. The export inlines this same array verbatim.
- `ChartContent` is unchanged (`{ kind, chart, title, rows }`); only the interpretation of `rows` widens (`rows[0] = ['Label', <series names…>]`).
- Test runner: `npx vitest run <path>`. Build/type gate: `npm run build`.
- **Migration note:** Task 1 changes the `ChartSpec` interface, so `ChartCard.tsx` and `html.ts` stop compiling until Task 2. `npm run build` is expected to fail after Task 1 and pass again after Task 2. Task 1 is verified by `vitest` on the renderer; the build gate lands in Task 2.

---

### Task 1: Series-aware renderer + `rowsToChartData` helper

Rewrite `src/charts/renderChart.ts` to the multi-series API and migrate/expand its tests. Grouped bars, multi-line, bottom legend (bar/line only), pie/donut on series[0], all colors indexed from `palette`. The single-slice full-circle fix and floating-zero baseline are preserved.

**Files:**
- Modify (full rewrite): `src/charts/renderChart.ts`
- Modify (migrate + extend): `src/charts/renderChart.test.ts`

**Interfaces:**
- Produces:
  - `interface ChartPoint { label: string; values: number[] }`
  - `interface ChartData { seriesNames: string[]; points: ChartPoint[] }`
  - `interface ChartSpec { chart: ChartKind; title: string; seriesNames: string[]; points: ChartPoint[]; palette: string[] }`
  - `function rowsToChartData(rows: string[][]): ChartData`
  - `function renderChartSvg(spec: ChartSpec): string`

- [ ] **Step 1: Replace the test file with the migrated + expanded suite**

Overwrite `src/charts/renderChart.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/charts/renderChart.test.ts`
Expected: FAIL — `rowsToChartData` is not exported and the spec shape changed.

- [ ] **Step 3: Rewrite the renderer**

Overwrite `src/charts/renderChart.ts`:

```ts
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
        '<rect x="' + lx + '" y="' + (ly - 8) + '" width="8" height="8" rx="1.5" fill="' + color(s) + '"/>'
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/charts/renderChart.test.ts`
Expected: PASS (all tests, single- and multi-series).

- [ ] **Step 5: Sanity-check `.toString()` self-containment**

Read `rowsToChartData` and `renderChartSvg`; confirm each body references only its params, local `const`/`let`, `Math`, `parseFloat`, `Number.isFinite`, and string/array/regex ops — no imports at runtime, no module-scope vars. (`ChartKind` is type-only.)

- [ ] **Step 6: Commit**

```bash
git add src/charts/renderChart.ts src/charts/renderChart.test.ts
git commit -m "feat(chart): series-aware renderChartSvg + rowsToChartData helper"
```

---

### Task 2: Wire both callers to the new API (green the build + export)

Update the React card and the HTML export to build the new `ChartSpec` via `rowsToChartData`, and embed `rowsToChartData` into the export. No grid-UI change yet — the card still edits a single series; multi-series renders whenever the grid has extra columns. This task restores `npm run build` to green.

**Files:**
- Modify: `src/cards/ChartCard.tsx` (spec construction)
- Modify: `src/export/html.ts` (embed helper + `chart` cardBody case)

**Interfaces:**
- Consumes: `rowsToChartData`, `renderChartSvg`, `ChartSpec` (Task 1); `BOARD_COLORS` from `src/model/types.ts`.

- [ ] **Step 1: Update `ChartCard.tsx` spec construction**

In `src/cards/ChartCard.tsx`, change the import from `renderChart` to include the helper, and replace the `renderChartSvg({...})` call.

Change the import line:

```tsx
import { renderChartSvg, rowsToChartData } from '../charts/renderChart'
```

Replace the `const svg = renderChartSvg({ ... })` block with:

```tsx
  const data = rowsToChartData(content.rows)
  const svg = renderChartSvg({
    chart: content.chart,
    title: content.title,
    seriesNames: data.seriesNames,
    points: data.points,
    palette: BOARD_COLORS as unknown as string[],
  })
```

- [ ] **Step 2: Type-check the card in isolation**

Run: `npx tsc -b --noEmit` (or `npm run build`)
Expected: no errors in `ChartCard.tsx` (errors may remain in `html.ts` until Step 3).

- [ ] **Step 3: Update the HTML export**

In `src/export/html.ts`, the renderer import already exists (`import { renderChartSvg } from '../charts/renderChart'`). Extend it:

```ts
import { renderChartSvg, rowsToChartData } from '../charts/renderChart'
```

Immediately after the existing embed line `var renderChartSvg = ${renderChartSvg.toString()};`, add:

```js
var rowsToChartData = ${rowsToChartData.toString()};
```

Replace the `case 'chart':` line in the export's `cardBody` switch with:

```js
    case 'chart': { var cd = rowsToChartData(c.rows); return '<div class="chartc">'+renderChartSvg({chart:c.chart,title:c.title,seriesNames:cd.seriesNames,points:cd.points,palette:['#2f6d5a','#b4622d','#c24e3e','#b8912e','#5b7fa6','#7a5f96','#a64d79','#5f7040','#6b5138','#5c6062']})+'</div>'; }
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds (both callers now match the new interface).

- [ ] **Step 5: Full unit suite**

Run: `npx vitest run`
Expected: all suites pass.

- [ ] **Step 6: Verify the export end-to-end in the browser**

The single-series export must still render (the embed now includes two functions).
1. `preview_start` with `{ name: 'folium' }`.
2. Create a chart card, then trigger **Export → Share as HTML file**.
3. Open the exported file (serve it over `http://127.0.0.1:<port>` — `file://` is sandbox-blocked) and confirm the chart renders as inline SVG.
4. `read_console_messages` on the exported page — confirm **no** errors (this proves the embedded `rowsToChartData` + `renderChartSvg` run).

- [ ] **Step 7: Commit**

```bash
git add src/cards/ChartCard.tsx src/export/html.ts
git commit -m "feat(chart): route card + HTML export through series-aware spec"
```

---

### Task 3: Grid UI — add/remove series + name them

Give the card's data grid column operations so a user can actually create multi-series charts: editable series-name header cells (already inputs) plus `+ Series` / `− Series` buttons.

**Files:**
- Modify: `src/cards/ChartCard.tsx` (column mutators + control buttons)

**Interfaces:**
- Consumes: the existing `rows`/`setRows` helpers in `ChartCard.tsx`.

- [ ] **Step 1: Add the column mutators**

In `src/cards/ChartCard.tsx`, next to the existing `addRow` / `delRow`, add:

```tsx
  const addCol = () => setRows(rows.map((row, ri) => [...row, ri === 0 ? 'Series ' + row.length : '']))
  const delCol = () => rows[0].length > 2 && setRows(rows.map((row) => row.slice(0, -1)))
```

(`rows[0].length > 2` keeps at least one value column: `[label, value]`.)

- [ ] **Step 2: Add the control-strip buttons**

In the control strip, inside the `{showGrid && ( … )}` block that currently holds `+ Row` / `− Row`, add two buttons:

```tsx
              <button onClick={addCol}>+ Series</button>
              <button onClick={delCol}>− Series</button>
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Verify multi-series in-app in the browser**

1. `preview_start` with `{ name: 'folium' }` (reuse if running).
2. Create a chart card; select it; click **Edit data**.
3. Click **+ Series** — a third grid column appears; name it (e.g. "Costs") in the header, fill values for A/B/C.
4. Click **Done**. Confirm **grouped bars** (2 bars per label) with a **legend** showing both series names.
5. Switch to **line** — confirm **two polylines**. Switch to **pie** — confirm only the first series is plotted (no legend). Switch back to **bar**.
6. Click **− Series** (in Edit data) — confirm it returns to a single series and the legend disappears.
7. `read_console_messages` — confirm no errors.
8. `computer { action: 'screenshot' }` for proof (fall back to DOM/`javascript_tool` geometry checks if screenshot times out in this environment).

- [ ] **Step 5: Commit**

```bash
git add src/cards/ChartCard.tsx
git commit -m "feat(chart): add/remove series columns in the chart data grid"
```

---

## Verification summary

- **Unit:** `npx vitest run` — `rowsToChartData` + renderer (single- and multi-series) + existing suites all green.
- **Types/build:** `npm run build` green after Task 2 onward.
- **In-app:** grouped bars + legend, multi-line, pie uses series[0], add/remove series (Task 3 Step 4).
- **Export:** exported HTML draws the identical multi-series chart with no console errors (Task 2 Step 6; re-confirm with a multi-series card after Task 3).

## Out of scope (future specs)

- Reading data from a linked Table card.
- Axis ticks / gridlines / tooltips / animation.
- Context-menu "New chart" entry.
- Per-pie series picker (we use series[0]).
