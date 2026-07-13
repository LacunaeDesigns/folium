# Looseleaf

A fully local, freeform visual workspace — boards, cards, columns, lines,
whiteboard tools, templates and live review sessions. Everything is stored in your
browser (IndexedDB); nothing leaves your machine except live sessions you start
yourself.

## Run it

```bash
npm install
npm run dev        # → http://localhost:5173
```

Production build (static, servable from anywhere):

```bash
npm run build      # outputs dist/
npm run preview    # serve the build locally
```

Tests: `npm test` (Vitest).

## What's inside

- **Cards**: rich-text notes (bold/italic/highlight/lists/checklists/headings),
  to-do lists, links (favicon + YouTube preview), images (upload / paste / URL),
  files (with audio/video preview), tables, color swatches, comments.
- **Whiteboard tools**: freehand drawing straight onto the canvas (colors, widths,
  stroke eraser), sticky notes, shapes (rect / ellipse / diamond).
- **Structure**: infinitely nestable boards with breadcrumbs and hash routing,
  columns with drag-in/out and reordering, lines with arrowheads, curves and labels.
- **Canvas**: drag, multi-select (marquee/shift), resize, pan (space or middle
  mouse), zoom (Ctrl+wheel), context menus, undo/redo, keyboard shortcuts
  (Del, Ctrl+Z/Y, Ctrl+D, Ctrl+A, Ctrl+K, arrows).
- **Organization**: per-board Unsorted tray with quick capture, Trash with restore,
  global search (Ctrl+K) that jumps to the matching card, light/dark board themes.
- **Templates**: Portfolio Review, Storyboard, World Building, Game Development,
  Moodboard, Project Plan, Brainstorm — plus "save current board as template".
- **Sharing**: export any board as a **self-contained HTML file** (images inlined,
  nested boards navigable, comment pins visible, print-to-PDF built in), Markdown
  export, full JSON backup/import.
- **Migrating from Milanote**: export boards from Milanote as Markdown, then drag
  the `.md` files onto Looseleaf (or Export → *Import Markdown…*) — each becomes a
  board of typed cards. For a full-fidelity one-off migration (layout + images),
  see [docs/milanote-migration.md](docs/milanote-migration.md).
- **Live review sessions**: start a session to get a code; a reviewer opens the
  exported HTML anywhere, clicks *Join live session*, and their comments, image
  pins and replies land on your board in real time over an encrypted peer-to-peer
  connection (PeerJS signaling, no accounts, comment-only access).
- **Presentation mode**: fullscreen step-through of a board (View → Present).

## Portfolio review workflow

1. Templates → **Portfolio Review** (duplicate per candidate).
2. Drop their images/videos onto the board; annotate with numbered comment pins.
3. Export → **Share as HTML file** and send it over chat.
4. Optionally click **Live** and share the code — the reviewee can respond with
   comments and pins directly onto your board while you're both online.

## Data

All data lives in the browser profile that opened the app (IndexedDB,
`atlasnote` database). Use Export → *Back up all data (JSON)* for backups and
*Import backup* to restore or migrate.
