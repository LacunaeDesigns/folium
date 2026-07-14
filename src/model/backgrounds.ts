/**
 * Curated per-board canvas backgrounds (Wave 2). `id` matches Board.background;
 * 'default' in the picker maps back to `undefined` (the current paper). The
 * actual CSS lives in src/styles/global.css (`.app-canvas[data-board-bg=...]`)
 * and is mirrored in the HTML export (src/export/html.ts) for parity — `swatch`
 * here is only the small preview shown on the picker button.
 */
export interface BoardBackground {
  id: string
  label: string
  /** CSS `background` shorthand for the picker swatch preview */
  swatch: string
}

export const BOARD_BACKGROUNDS: BoardBackground[] = [
  { id: 'default', label: 'Default', swatch: '#f3eee3' },
  { id: 'sage', label: 'Sage', swatch: '#eef1e8' },
  { id: 'sand', label: 'Sand', swatch: '#f0e6d3' },
  { id: 'blush', label: 'Blush', swatch: '#f5e8e2' },
  { id: 'slate', label: 'Slate', swatch: '#ecedf0' },
  {
    id: 'dots',
    label: 'Dots',
    swatch: 'radial-gradient(#d9d0bb 1.2px, transparent 1.2px) 0 0/8px 8px, #f3eee3',
  },
  {
    id: 'ruled',
    label: 'Ruled',
    swatch: 'repeating-linear-gradient(to bottom, transparent 0 6px, #d9d0bb 6px 7px), #f3eee3',
  },
  {
    id: 'grid',
    label: 'Grid',
    swatch:
      'linear-gradient(to right, #d9d0bb 1px, transparent 1px) 0 0/8px 8px, linear-gradient(to bottom, #d9d0bb 1px, transparent 1px) 0 0/8px 8px, #f3eee3',
  },
]
