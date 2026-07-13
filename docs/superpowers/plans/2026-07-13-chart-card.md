# Chart Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `chart` card type that plots its own built-in data grid as bar / line / pie / donut, rendering identically in-app and in the self-contained HTML export.

**Architecture:** A single pure function `renderChartSvg(spec)` produces an SVG string; the React `ChartCard` renders it with `dangerouslySetInnerHTML`, and the HTML exporter embeds the *same* function verbatim via `.toString()`. Data lives in the card's own `rows: string[][]` grid (label + value), single series.

**Tech Stack:** React 18 + TypeScript, Zustand store, Vitest. No new dependencies.

## Global Constraints

- `renderChartSvg` MUST be self-contained: no runtime imports, no module-scope closure references, primitives + `Math` + string ops only. `.toString()` must yield runnable JS for the export. (Type-only imports are fine — they erase at compile.)
- Values are stored as strings and parsed with `parseFloat(x) || 0` everywhere they feed the renderer. Never throw on malformed numbers.
- Warm-paper palette: accent `#2f6d5a`; categorical set = `BOARD_COLORS` from `src/model/types.ts` (`['#2f6d5a','#b4622d','#c24e3e','#b8912e','#5b7fa6','#7a5f96','#a64d79','#5f7040','#6b5138','#5c6062']`).
- Follow existing card idioms: `TableCard` for the grid + control strip (`no-drag`, `onPointerDown` stopPropagation), `registerCardBody` for registration.
- Test runner: `npx vitest run <path>`. Build/type gate: `npm run build` (runs `tsc -b && vite build`).

---

### Task 1: Data model, defaults & text serialization

Adds the `chart` type and satisfies every compile-forced exhaustive switch so `tsc` stays green.

**Files:**
- Modify: `src/model/types.ts` (add `ChartKind`, `ChartContent`, union entries, `DEFAULT_CARD_SIZE`)
- Modify: `src/store/store.ts:76-105` (`defaultContent` — add `case 'chart'`)
- Modify: `src/store/search.ts:29-55` (`cardText` — add `case 'chart'`)
- Modify: `src/export/markdown.ts:67-119` (`cardToMarkdown` — add `case 'chart'`)
- Test: `src/export/markdown.test.ts` (add a chart→table test)

**Interfaces:**
- Produces: `ChartKind = 'bar'|'line'|'pie'|'donut'`; `ChartContent { kind:'chart'; chart:ChartKind; title:string; rows:string[][] }`; `'chart'` in `CardType`; `DEFAULT_CARD_SIZE.chart = { w: 300 }` (auto height, like `table`).

- [ ] **Step 1: Add the types**

In `src/model/types.ts`, add `'chart'` to the `CardType` union (after `'ink'`):

```ts
export type CardType =
  | 'note'
  | 'todo'
  | 'link'
  | 'image'
  | 'file'
  | 'board'
  | 'column'
  | 'comment'
  | 'table'
  | 'swatch'
  | 'sticky'
  | 'shape'
  | 'ink'
  | 'chart'
```

Add the content interface (after `InkContent`):

```ts
export type ChartKind = 'bar' | 'line' | 'pie' | 'donut'

export interface ChartContent {
  kind: 'chart'
  chart: ChartKind
  title: string
  /** rows[0] is the header ['Label','Value']; each later row is [label, value] */
  rows: string[][]
}
```

Add `ChartContent` to the `CardContent` union (after `InkContent`):

```ts
export type CardContent =
  | NoteContent
  | TodoContent
  | LinkContent
  | ImageContent
  | FileContent
  | BoardCardContent
  | ColumnContent
  | CommentContent
  | TableContent
  | SwatchContent
  | StickyContent
  | ShapeContent
  | InkContent
  | ChartContent
```

Add the default size to `DEFAULT_CARD_SIZE` (after the `ink` entry):

```ts
  ink: { w: 200, h: 120 },
  chart: { w: 300 },
```

- [ ] **Step 2: Add the `defaultContent` case**

In `src/store/store.ts`, inside `defaultContent`'s `switch (type)`, add before the closing brace:

```ts
    case 'chart':
      return {
        kind: 'chart',
        chart: 'bar',
        title: '',
        rows: [
          ['Label', 'Value'],
          ['A', '4'],
          ['B', '7'],
          ['C', '3'],
        ],
      }
```

- [ ] **Step 3: Add the `cardText` (search) case**

In `src/store/search.ts`, inside `cardText`'s `switch (c.kind)`, add before the closing brace:

```ts
    case 'chart':
      return [c.title, ...c.rows.flat()].join(' ')
```

- [ ] **Step 4: Add the Markdown fallback case**

In `src/export/markdown.ts`, inside `cardToMarkdown`'s `switch (c.kind)`, add before the closing brace:

```ts
    case 'chart': {
      const [head, ...rows] = c.rows
      const table = head
        ? [
            '| ' + head.join(' | ') + ' |',
            '| ' + head.map(() => '---').join(' | ') + ' |',
            ...rows.map((r) => '| ' + r.join(' | ') + ' |'),
          ].join('\n')
        : ''
      return (c.title ? `**${c.title}**\n\n` : '') + table
    }
```

- [ ] **Step 5: Write the failing Markdown test**

In `src/export/markdown.test.ts`, add inside the `describe('boardToMarkdown', ...)` block:

```ts
  it('renders a chart card as a data table', () => {
    const store = createAtlasStore()
    const s = store.getState()
    s.addCard(s.rootId, 'chart', {
      x: 0,
      y: 0,
      content: { title: 'Sales', rows: [['Label', 'Value'], ['A', '4'], ['B', '7']] } as never,
    })
    const md = boardToMarkdown(store.getState(), store.getState().rootId)
    expect(md).toContain('**Sales**')
    expect(md).toContain('| Label | Value |')
    expect(md).toContain('| A | 4 |')
  })
```

- [ ] **Step 6: Run the test**

Run: `npx vitest run src/export/markdown.test.ts`
Expected: PASS (all tests in the file, including the new one).

- [ ] **Step 7: Verify types compile**

Run: `npm run build`
Expected: build succeeds — no `tsc` errors about missing `chart` cases in `DEFAULT_CARD_SIZE`, `defaultContent`, `cardText`, or `cardToMarkdown`.

- [ ] **Step 8: Commit**

```bash
git add src/model/types.ts src/store/store.ts src/store/search.ts src/export/markdown.ts src/export/markdown.test.ts
git commit -m "feat(chart): add chart card data model, defaults & markdown fallback"
```

---

### Task 2: The shared SVG renderer

The load-bearing piece — pure, tested, and safe to embed via `.toString()`.

**Files:**
- Create: `src/charts/renderChart.ts`
- Test: `src/charts/renderChart.test.ts`

**Interfaces:**
- Consumes: `ChartKind` (type-only) from Task 1.
- Produces: `renderChartSvg(spec: ChartSpec): string`; `ChartSpec { chart:ChartKind; title:string; points:{label:string;value:number}[]; colors:string[] }`; `ChartPoint { label:string; value:number }`.

- [ ] **Step 1: Write the failing tests**

Create `src/charts/renderChart.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/charts/renderChart.test.ts`
Expected: FAIL — cannot resolve `./renderChart`.

- [ ] **Step 3: Implement `renderChartSvg`**

Create `src/charts/renderChart.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify passing**

Run: `npx vitest run src/charts/renderChart.test.ts`
Expected: PASS (all 7 tests).

- [ ] **Step 5: Sanity-check `.toString()` self-containment**

Manual review (no tooling needed): read `renderChartSvg` and confirm its body uses only its parameters, local `const`/`let`, `Math`, and string/array/regex operations — no references to `ChartKind` at runtime (type-only), no imported functions, no module-level variables. If any external reference exists, inline it. This is what lets Task 5 embed the function verbatim.

- [ ] **Step 6: Commit**

```bash
git add src/charts/renderChart.ts src/charts/renderChart.test.ts
git commit -m "feat(chart): pure renderChartSvg (bar/line/pie/donut) with tests"
```

---

### Task 3: ChartCard component, registration & styles

Renders the chart on the canvas and provides the type switcher + editable grid.

**Files:**
- Create: `src/cards/ChartCard.tsx`
- Modify: `src/cards/index.ts` (register the body)
- Modify: `src/cards/cards.css` (append chart styles)

**Interfaces:**
- Consumes: `renderChartSvg` (Task 2); `ChartContent`, `BOARD_COLORS` (Task 1); `CardBodyProps` from `./registry`; `useAtlasStore`, `useUi`.
- Produces: `ChartCard` React component; `registerCardBody('chart', ChartCard)`.

- [ ] **Step 1: Create the component**

Create `src/cards/ChartCard.tsx` (mirrors `TableCard.tsx` structure):

```tsx
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
```

- [ ] **Step 2: Register the body**

In `src/cards/index.ts`, add the import (after the `InkCard` import) and the registration (after the `ink` line):

```ts
import { ChartCard } from './ChartCard'
```
```ts
registerCardBody('chart', ChartCard)
```

- [ ] **Step 3: Append styles**

Add to `src/cards/cards.css`:

```css
.chart-card { padding: 8px; }
.chart-card .chart-svg { width: 100%; }
.chart-card .chart-svg svg { width: 100%; height: auto; display: block; }
.chart-grid { width: 100%; border-collapse: collapse; font-size: 12px; }
.chart-grid td { border: 1px solid var(--border); padding: 0; }
.chart-grid input { width: 100%; border: 0; background: none; font: inherit; padding: 4px 6px; color: inherit; }
.chart-grid .thead input { font-weight: 600; }
.chart-controls { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; align-items: center; }
.chart-controls button { font: inherit; font-size: 11px; padding: 2px 6px; border: 1px solid var(--border); border-radius: 4px; background: var(--chrome); cursor: pointer; color: var(--soft); }
.chart-controls button.on { background: var(--accent); color: #fff; border-color: var(--accent); }
.chart-kinds { display: flex; gap: 3px; }
.chart-title-input { font: inherit; font-size: 11px; padding: 2px 6px; border: 1px solid var(--border); border-radius: 4px; background: none; color: inherit; width: 90px; }
```

- [ ] **Step 4: Type-check**

Run: `npm run build`
Expected: build succeeds. (No visual verification yet — the toolbar entry lands in Task 4.)

- [ ] **Step 5: Commit**

```bash
git add src/cards/ChartCard.tsx src/cards/index.ts src/cards/cards.css
git commit -m "feat(chart): ChartCard component with type switcher and data grid"
```

---

### Task 4: Toolbar tool, icon & placement wiring

Makes the chart card creatable from the UI.

**Files:**
- Modify: `src/ui/Icons.tsx` (add `'chart'` to `IconName`, add the glyph)
- Modify: `src/ui/Toolbar.tsx:6-20` (add `'chart'` to `ToolId`), `:39-43` (add to `MORE_TOOLS`)
- Modify: `src/canvas/Canvas.tsx:190-201` (add `chart: 'chart'` to `typeMap`)

**Interfaces:**
- Consumes: `CardType`/`chart` from Task 1; `ChartCard` registration from Task 3.
- Produces: a "Chart" entry in the toolbar's "More" flyout that places a `chart` card.

- [ ] **Step 1: Add the icon name and glyph**

In `src/ui/Icons.tsx`, add `| 'chart'` to the `IconName` union (near `'table'`). Then add a `chart` entry to the icon map (place it near the `table` entry, following the same `<>...</>` fragment style):

```tsx
  chart: (
    <>
      <line x1="4" y1="20" x2="20" y2="20" />
      <rect x="5.5" y="11" width="3.2" height="7" rx="0.5" />
      <rect x="10.4" y="7" width="3.2" height="11" rx="0.5" />
      <rect x="15.3" y="13" width="3.2" height="5" rx="0.5" />
    </>
  ),
```

- [ ] **Step 2: Add the ToolId and toolbar entry**

In `src/ui/Toolbar.tsx`, add `| 'chart'` to the `ToolId` union (after `'draw'`). Add to `MORE_TOOLS`:

```ts
const MORE_TOOLS: ToolDef[] = [
  { id: 'swatch', icon: 'swatch', label: 'Color swatch' },
  { id: 'sticky', icon: 'sticky', label: 'Sticky note' },
  { id: 'shape', icon: 'shape', label: 'Shape' },
  { id: 'chart', icon: 'chart', label: 'Chart' },
]
```

- [ ] **Step 3: Wire placement**

In `src/canvas/Canvas.tsx`, add to the `typeMap` in `placeAt` (after the `shape` entry):

```ts
        shape: 'shape',
        image: 'image',
        chart: 'chart',
```

- [ ] **Step 4: Build and run the app**

Run: `npm run build`
Expected: build succeeds.

Then verify in the browser preview (dev server config name `folium`):
1. `preview_start` with `{ name: 'folium' }`.
2. Open the "More card types" (dots) flyout in the toolbar; confirm a **Chart** entry with a bar-chart icon.
3. Click it, then click the canvas — a chart card appears showing a 3-bar chart (A/B/C).
4. Select the card; confirm the control strip shows bar/line/pie/donut buttons, a Title field, and "Edit data".
5. Click **line**, **pie**, **donut** in turn — the chart face updates each time.
6. Click **Edit data**, change a value, confirm the chart re-renders on **Done**.
7. `read_console_messages` — confirm no errors.
8. `computer {action:'screenshot'}` — capture the pie/donut render as proof.

- [ ] **Step 5: Commit**

```bash
git add src/ui/Icons.tsx src/ui/Toolbar.tsx src/canvas/Canvas.tsx
git commit -m "feat(chart): toolbar entry, icon and canvas placement for chart card"
```

---

### Task 5: Self-contained HTML export

Draws the same chart inside the exported standalone HTML file.

**Files:**
- Modify: `src/export/html.ts` (import renderer; embed via `.toString()`; add `cardBody` case; add `.chartc` CSS)

**Interfaces:**
- Consumes: `renderChartSvg` (Task 2); `ChartContent` shape (`chart`, `title`, `rows`).
- Produces: exported charts render as inline SVG in the standalone viewer.

- [ ] **Step 1: Import the renderer**

At the top of `src/export/html.ts`, add:

```ts
import { renderChartSvg } from '../charts/renderChart'
```

- [ ] **Step 2: Embed the function into the export script**

In the returned template literal, immediately after the `var esc = ...;` line (around line 125), inject the shared renderer:

```js
var renderChartSvg = ${renderChartSvg.toString()};
```

(Written as an interpolation inside the template literal — `${renderChartSvg.toString()}` runs at export time and inlines the compiled function source.)

- [ ] **Step 3: Add the `cardBody` case**

In the export's `cardBody` `switch (c.kind)` (the plain-JS block near line 171), add a `chart` case alongside `table`:

```js
    case 'chart': return '<div class="chartc">'+renderChartSvg({chart:c.chart,title:c.title,points:c.rows.slice(1).map(function(r){return {label:r[0],value:parseFloat(r[1])||0};}),colors:['#2f6d5a','#b4622d','#c24e3e','#b8912e','#5b7fa6','#7a5f96','#a64d79','#5f7040','#6b5138','#5c6062']})+'</div>';
```

- [ ] **Step 4: Add export CSS**

In the export `<style>` block (near the `table.tbl` rules, around line 84), add:

```css
.chartc{padding:8px}
.chartc svg{width:100%;height:auto;display:block}
```

- [ ] **Step 5: Build and verify the export end-to-end**

Run: `npm run build`
Expected: build succeeds.

In the browser preview:
1. On a board with a chart card, trigger **Export → HTML** (self-contained file).
2. Open the exported `.html` file in the browser (`preview_start` with `{ url: 'file:///<path-to-export>' }` or navigate to it).
3. Confirm the chart renders as inline SVG identical to the in-app card (test bar AND pie/donut).
4. `read_console_messages` on the exported page — confirm no JS errors from the embedded `renderChartSvg`.
5. `computer {action:'screenshot'}` — capture the exported chart as proof.

If the exported chart is blank or throws: inspect the embedded `var renderChartSvg = ...` in the exported HTML source — a broken embed means the function referenced something external; return to Task 2 Step 5 and inline it.

- [ ] **Step 6: Commit**

```bash
git add src/export/html.ts
git commit -m "feat(chart): render charts in self-contained HTML export"
```

---

## Verification summary

- **Unit:** `npx vitest run` — renderer (7 tests) + markdown fallback + existing suite all green.
- **Types/build:** `npm run build` green after every task.
- **In-app:** chart card creatable, all four kinds switch live, grid editing works (Task 4 Step 4).
- **Export:** exported HTML draws the identical chart with no console errors (Task 5 Step 5).

## Out of scope (deferred, per spec)

- Multi-series data (grouped bars / multi-line).
- Reading data from a linked Table card.
- Axis ticks/gridlines, tooltips, animation.
- Context-menu "New chart" entry (toolbar path is sufficient for v1).
