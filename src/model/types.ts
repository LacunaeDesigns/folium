export type BoardTheme = 'light' | 'dark'

export interface Board {
  id: string
  parentId: string | null
  title: string
  /** icon key from BOARD_ICONS */
  icon: string
  /** hex accent used for the board card + breadcrumb swatch */
  color: string
  theme: BoardTheme
  createdAt: number
}

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
  | 'frame'

export interface TodoItem {
  id: string
  text: string
  done: boolean
}

export interface CommentReply {
  id: string
  author: string
  text: string
  ts: number
}

export interface ImagePin {
  id: string
  /** anchor position as fraction of image size (0..1) */
  fx: number
  fy: number
  author: string
  text: string
  replies: CommentReply[]
  ts: number
}

export type ShapeKind = 'rect' | 'ellipse' | 'diamond'

export interface NoteContent {
  kind: 'note'
  /** TipTap JSON document */
  doc: unknown
  bg: string
}
export interface TodoContent {
  kind: 'todo'
  title: string
  items: TodoItem[]
}
export interface LinkContent {
  kind: 'link'
  url: string
  title: string
  description: string
}
export interface ImageContent {
  kind: 'image'
  /** blob id in the blobs store, or empty when url is used */
  blobId: string
  /** external URL alternative to blobId */
  url: string
  caption: string
  naturalW: number
  naturalH: number
  pins: ImagePin[]
}
export interface FileContent {
  kind: 'file'
  blobId: string
  name: string
  size: number
  mime: string
}
export interface BoardCardContent {
  kind: 'board'
  boardId: string
}
export interface ColumnContent {
  kind: 'column'
  title: string
  collapsed: boolean
}
export interface CommentContent {
  kind: 'comment'
  author: string
  text: string
  replies: CommentReply[]
  ts: number
}
export interface TableContent {
  kind: 'table'
  /** rows[0] is the header row */
  rows: string[][]
}
export interface SwatchContent {
  kind: 'swatch'
  hex: string
  name: string
}
export interface StickyContent {
  kind: 'sticky'
  text: string
  color: string
}
export interface ShapeContent {
  kind: 'shape'
  shape: ShapeKind
  fill: string
  text: string
}
export interface InkContent {
  kind: 'ink'
  /** strokes in card-local coordinates */
  strokes: { points: number[]; color: string; width: number }[]
  /** natural (creation-time) dimensions — viewBox for scaling on resize */
  natW: number
  natH: number
}

export type ChartKind = 'bar' | 'line' | 'pie' | 'donut'

export interface ChartContent {
  kind: 'chart'
  chart: ChartKind
  title: string
  /** rows[0] is the header ['Label','Value']; each later row is [label, value] */
  rows: string[][]
}

export interface FrameContent {
  kind: 'frame'
  title: string
}

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
  | FrameContent

export interface Card {
  id: string
  boardId: string
  type: CardType
  x: number
  y: number
  w: number
  /** undefined = auto height */
  h?: number
  z: number
  /** column membership */
  colId: string | null
  colIndex: number
  /** frame (section) membership — cards keep their own x/y, moving/resizing the frame cascades to members */
  frameId: string | null
  inUnsorted: boolean
  trashed: boolean
  createdAt: number
  content: CardContent
}

// A card-attached end may carry a normalized drop anchor (ax, ay in 0..1): the
// spot the user dragged the end onto, so it attaches to that side instead of the
// auto-picked facing edge. Absent ax/ay → auto (line-tool default).
export type LineEnd = { cardId: string; ax?: number; ay?: number } | { x: number; y: number }

export interface Line {
  id: string
  boardId: string
  from: LineEnd
  to: LineEnd
  /** 0 = straight, positive bows the curve */
  curve: number
  arrowStart: boolean
  arrowEnd: boolean
  label: string
  color?: string
  width?: number
  dash?: boolean
}

export interface TemplateMeta {
  id: string
  name: string
  category: string
  description: string
  builtIn: boolean
}

/** Serialized sub-tree of boards/cards/lines rooted at `rootBoardId` */
export interface BoardSnapshot {
  rootBoardId: string
  boards: Board[]
  cards: Card[]
  lines: Line[]
}

export interface Template extends TemplateMeta {
  snapshot: BoardSnapshot
}

export interface DocState {
  rootId: string
  boards: Record<string, Board>
  cards: Record<string, Card>
  lines: Record<string, Line>
}

export const BOARD_COLORS = [
  '#2f6d5a',
  '#b4622d',
  '#c24e3e',
  '#b8912e',
  '#5b7fa6',
  '#7a5f96',
  '#a64d79',
  '#5f7040',
  '#6b5138',
  '#5c6062',
] as const

export const NOTE_COLORS = [
  'white',
  'gray',
  'yellow',
  'orange',
  'red',
  'green',
  'blue',
  'purple',
  'dark',
] as const

export const DEFAULT_CARD_SIZE: Record<CardType, { w: number; h?: number }> = {
  note: { w: 248 },
  todo: { w: 248 },
  link: { w: 248 },
  image: { w: 280 },
  file: { w: 248 },
  board: { w: 180 },
  column: { w: 280 },
  comment: { w: 260 },
  table: { w: 360 },
  swatch: { w: 200 },
  sticky: { w: 180, h: 180 },
  shape: { w: 160, h: 120 },
  ink: { w: 200, h: 120 },
  chart: { w: 300 },
  frame: { w: 480, h: 320 },
}
