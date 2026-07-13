# Chart card — design spec

**Date:** 2026-07-13
**Status:** Approved, pre-implementation
**Context:** Unshipped Wave 4 item from the Canva whiteboard gap analysis. Folium
holds tabular data in a Table card but cannot plot it. This adds a self-contained
`chart` card type that renders bar / line / pie / donut from its own built-in
data grid, and — critically — draws identically inside the self-contained HTML
export.

## Goals

- A new `chart` card type, created from the toolbar like any other card.
- Four chart kinds: **bar, line, pie, donut**.
- Data lives in the card's own mini grid (no dependency on a linked Table).
- Single series (one label column + one value column) for v1.
- The chart draws the same in-app and in the exported standalone HTML file.
- Warm-paper theme (viridian / russet / sand), light + dark aware.

## Non-goals (v1)

- Multi-series data (grouped bars / multi-line) — deferred; the data model and
  renderer should not make it *impossible*, but it is not built now.
- Reading data from a linked Table card — deferred.
- Axis tick scales, gridlines beyond a baseline, tooltips, animation.
- Chart rendering inside Markdown export (degrade to a data table instead).

## Data model

Add to `src/model/types.ts`:

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

- `'chart'` added to the `CardType` union.
- `ChartContent` added to the `CardContent` union.
- Values stored as strings (mirrors `TableContent`); parsed to numbers at render
  time via `parseFloat`, with non-numeric / blank → 0.
- `DEFAULT_CARD_SIZE.chart = { w: 300, h: 240 }`.

Default content (`defaultContent` in `src/store/store.ts`):

```ts
case 'chart':
  return {
    kind: 'chart',
    chart: 'bar',
    title: '',
    rows: [['Label', 'Value'], ['A', '4'], ['B', '7'], ['C', '3']],
  }
```

A freshly dropped card shows a real 3-bar chart immediately.

## The renderer — `src/charts/renderChart.ts`

One exported **pure, dependency-free, primitive-only** function:

```ts
export interface ChartSpec {
  chart: ChartKind
  title: string
  points: { label: string; value: number }[]
  colors: string[]   // categorical palette, passed in so the fn stays theme-agnostic
}

export function renderChartSvg(spec: ChartSpec): string
```

Returns a complete `<svg viewBox="0 0 W H">…</svg>` string. Constraints that make
it embeddable in the export via `.toString()`:

- No imports, no module-scope closure references, no TS-only runtime constructs.
- Only primitives, `Math`, string building, and its own inline helpers.
- Self-escapes label text (own `esc` helper) — must not rely on the export's `esc`.

Four branches sharing one SVG frame:

- **bar** — one rect per point, height scaled to the max value; baseline axis;
  labels under each bar; single accent fill.
- **line** — polyline through scaled points + small circle markers; same axis frame.
- **pie** — one arc-path wedge per point sized by its share of the total; wedge
  colors cycle `colors`.
- **donut** — pie with an inner-radius cutout.

Behavior:

- All values 0 (or no rows) → a centered "Add data" placeholder `<text>`, no bars.
- Single data row → renders one bar / one full-circle pie, no crash.
- `title` drawn as a `<text>` header when non-empty.

The exact palette values, mark sizing, and label treatment are taken from the
**dataviz skill** at implementation time. Placeholder palette = the warm-paper
categorical set already in `types.ts` (`BOARD_COLORS`), accent = `--accent`
(`#2f6d5a`).

## Chart card component — `src/cards/ChartCard.tsx`

Mirrors `TableCard.tsx` structure and idioms:

- The **SVG chart is always the card face**, rendered from card content via
  `dangerouslySetInnerHTML={{ __html: renderChartSvg(spec) }}`.
- `spec.colors` built in the component (themed palette), so the renderer stays pure.
- When `selected && !readOnly`, a control strip appears — `className="... no-drag"`,
  `onPointerDown={e => e.stopPropagation()}` (same guard as TableCard):
  - a 4-way chart-type switcher (bar / line / pie / donut) → `updateContent(id, { chart })`.
  - an **"Edit data"** toggle (local `useState`) that swaps the chart face for a
    mini editable grid identical to TableCard's, fixed at 2 columns (label + value):
    `+ Row / − Row` controls; cell edits call `updateContent(id, { rows })`.
- Read-only / exported contexts render chart only, never the controls.

Registered in `src/cards/index.ts`: `registerCardBody('chart', ChartCard)`.

## Toolbar & icon

- Add `'chart'` to the `ToolDef` id union and to `MORE_TOOLS` in `src/ui/Toolbar.tsx`
  (`{ id: 'chart', icon: 'chart', label: 'Chart' }`), alongside swatch/sticky/shape.
- Add a `chart` icon to `src/ui/Icons.tsx` (simple bar-chart glyph, matching the
  existing icon style).

## Export

**HTML — `src/export/html.ts`:**

- Inject the shared function into the export script once, near `esc`:
  `var renderChartSvg = ${renderChartSvg.toString()};`
  (import `renderChartSvg` at the top of html.ts to interpolate its source.)
- Add to the `cardBody` switch:
  ```js
  case 'chart':
    return '<div class="chartc">' +
      renderChartSvg({ chart:c.chart, title:c.title,
        points: c.rows.slice(1).map(function(r){ return { label:r[0], value:parseFloat(r[1])||0 }; }),
        colors: [/* warm-paper palette literals */] }) + '</div>';
  ```
- Add `.chartc` styling to the export `<style>` block (svg `width:100%;display:block`).

**Markdown — `src/export/markdown.ts`:**

- Charts degrade to a titled data table (reuse the existing table row
  serialization). Round-trips the data, not the visual.

## Styling — `src/cards/cards.css`

- `.chart-card` wrapper; chart `svg { width:100%; display:block }`.
- Control strip styled like `.table-controls`.
- Light + dark aware; warm-paper palette.

## Testing

`src/charts/renderChart.test.ts` — unit tests for the load-bearing shared renderer:

- Each of the four kinds returns a non-empty string containing `<svg`.
- Bar/line heights scale relative to the max value.
- All-zero / empty input → placeholder, no `<rect>`/wedge marks.
- Single-row input does not crash.
- Label text is HTML-escaped.

Card interaction is verified manually (matches how TableCard is covered — it has
no component test). `tsc` clean + `npm run build` green are release gates.

## File-touch summary

| File | Change |
|------|--------|
| `src/model/types.ts` | `ChartKind`, `ChartContent`, union entries, `DEFAULT_CARD_SIZE` |
| `src/store/store.ts` | `defaultContent` `case 'chart'` |
| `src/charts/renderChart.ts` | new — pure `renderChartSvg` |
| `src/charts/renderChart.test.ts` | new — unit tests |
| `src/cards/ChartCard.tsx` | new — card component |
| `src/cards/index.ts` | register `chart` body |
| `src/cards/cards.css` | `.chart-card` styles |
| `src/ui/Toolbar.tsx` | `chart` tool entry |
| `src/ui/Icons.tsx` | `chart` icon |
| `src/export/html.ts` | import + embed renderer, `case 'chart'`, `.chartc` CSS |
| `src/export/markdown.ts` | chart → data-table fallback |

## Risks

- **`.toString()` faithfulness** — the renderer must stay fully self-contained;
  any accidental module-scope reference would break the exported copy. Mitigated
  by keeping it primitive-only and covered by the export path being exercised
  manually before shipping.
- **Value parsing** — malformed numbers must not throw; `parseFloat(...)||0`
  everywhere the grid feeds the renderer.
