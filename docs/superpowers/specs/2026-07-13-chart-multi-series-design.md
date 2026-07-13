# Chart Card — Multi-Series Support (Design)

**Status:** approved design, pre-plan
**Builds on:** `2026-07-13-chart-card-design.md` (single-series chart card, shipped on `feat/chart-card`)
**Goal:** Let a chart card plot **multiple value series** — grouped bars and multi-line — from an N-column data grid, rendering identically in-app and in the self-contained HTML export. Pie/donut show the first series only.

## Scope

In scope:
- N value columns in the chart's own grid (`Label | Series A | Series B | …`).
- Grouped bar and multi-line rendering with a color legend.
- Column (series) add/remove + inline series-name editing in the card grid.
- Export + markdown parity.

Explicitly **out of scope** (separate future specs, per the roadmap): reading data from a linked Table card; axis ticks/gridlines/tooltips/animation; context-menu "New chart" entry. Pie/donut series-picker (we use series[0]).

## Data model

`ChartContent` is **unchanged** (`{ kind, chart, title, rows: string[][] }`). Only the interpretation of `rows` widens:

- `rows[0]` = header: `['Label', 'Series A', 'Series B', …]`. Cells `1..N` name the series.
- Each later row: `[label, v1, v2, …]`.
- **Backward-compatible:** an existing `['Label','Value']` card is exactly one series named "Value". No migration, no default-content change (the default stays a single "Value" series).

## Renderer (`src/charts/renderChart.ts`)

### Interface change (breaking, internal — 2 callers + tests, all in-repo)

```ts
export interface ChartSeries { name: string; color: string }
export interface ChartPoint { label: string; values: number[] } // one entry per series, index-aligned to spec.series
export interface ChartSpec {
  chart: ChartKind
  title: string
  series: ChartSeries[]
  points: ChartPoint[]
}
```

### Shared grid→spec helper (single source of truth for both callers)

```ts
export function rowsToSeries(rows: string[][], palette: string[]): { series: ChartSeries[]; points: ChartPoint[] }
```

- `series = (rows[0] ?? []).slice(1).map((name, i) => ({ name, color: palette[i % palette.length] }))`
- `points = rows.slice(1).map(r => ({ label: r[0] ?? '', values: series.map((_, i) => parseFloat(r[i + 1]) || 0) }))`
- Must stay **pure / self-contained** (only params, locals, `parseFloat`, array ops) — it is embedded into the HTML export via `.toString()` exactly like `renderChartSvg`.

### `renderChartSvg` behavior

- **Value sanitization** stays: `renderChartSvg` still coerces non-finite values to 0 (defense-in-depth; `rowsToSeries` already does `|| 0`).
- **Range:** `lo`/`hi` computed across **all** series values (flattened), always including 0 — the floating-zero baseline from the single-series work extends directly.
- **Grouped bars:** within each label slot (`pw / nLabels`), draw `nSeries` sub-bars side by side, each colored `series[j].color`. Sub-bar width derives from an inner group width (≈0.8 of the slot) divided by `nSeries`. Positive bars grow up from the zero line, negative down (unchanged sign logic, per series).
- **Multi-line:** one `<polyline>` + dot markers per series, each `series[j].color`, sharing axes.
- **Pie / donut:** use `series[0]` values only (`point.values[0]`). Empty/zero → existing "Add data" placeholder. The full-circle single-slice fix stays.
- **Legend:** rendered **only when `series.length > 1`** — a compact bottom band (~14px) of `swatch + name` entries left-to-right; the plot area height shrinks by the legend band. `series.length === 1` draws **no legend**, so single-series charts render byte-identically to today.
- Still returns one self-contained SVG string; the `.toString()` export embed is unaffected.

## Callers

**`src/cards/ChartCard.tsx`:**
```ts
const { series, points } = rowsToSeries(content.rows, BOARD_COLORS)
const svg = renderChartSvg({ chart: content.chart, title: content.title, series, points })
```
Grid UI gains:
- Header cells `1..N` editable → series names (already inputs; extend to all columns).
- **`+ Series`**: append a value column — header gets `Series {N}`, every row gets `''`.
- **`− Series`**: remove the last column, **guarded** so ≥1 value column remains (rows never drop below `[label, value]`).
- `+ Row` / `− Row` unchanged; a new row spans the current column count.

**`src/export/html.ts`:** embed `rowsToSeries` alongside `renderChartSvg` (both via `.toString()`), and rewrite the `chart` `cardBody` case to:
```js
var sp = rowsToSeries(c.rows, PALETTE);
return '<div class="chartc">' + renderChartSvg({chart:c.chart, title:c.title, series:sp.series, points:sp.points}) + '</div>';
```
where `PALETTE` is the same hardcoded `BOARD_COLORS` array already inlined there.

**`src/export/markdown.ts`:** no change — `cardToMarkdown` already renders `rows` as a full table, so N columns work automatically.

## Testing (`src/charts/renderChart.test.ts`)

Existing single-series tests migrate to the new `series`/`values` spec shape. New coverage:
- `rowsToSeries`: parses header into series (names + palette colors); maps rows to index-aligned `values`; single-value-column grid → one series; short/empty rows → `0`.
- Grouped bar: `nLabels × nSeries` rects; sub-bars colored per series.
- Multi-line: `nSeries` polylines, distinct colors.
- Legend present iff `series.length > 1`.
- Pie/donut plot series[0] only.
- **Regression:** a one-series spec renders identically to the pre-change single-series output (no legend, same geometry).
- Parity: the card and export both go through `rowsToSeries` (shared helper guarantees it).

## Verification

- Unit: `npx vitest run` green (migrated + new tests).
- Build/types: `npm run build` green.
- In-app (browser preview `folium`): create chart, add a 2nd series via `+ Series`, confirm grouped bars + legend; switch to line → 2 polylines; switch to pie → first series only; edit data → live re-render.
- Export: exported HTML draws the identical multi-series chart with **zero console errors** (the `.toString()` embed of both `renderChartSvg` and `rowsToSeries`).

## Risks

- **`.toString()` self-containment now covers two functions.** `rowsToSeries` must reference nothing external (no imports, no module-scope refs) or the export copy throws. Verified by the export browser check.
- **Legend/plot layout in a fixed 300×200 viewBox** — legend band must not crowd out the plot for small cards; keep it compact and single-row.
