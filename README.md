# Folium

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
- **Cross-machine sync** (Chrome/Edge, optional): Settings → *Cross-machine sync* →
  link a folder in a cloud-synced location (OneDrive, Dropbox, iCloud, Syncthing).
  Folium mirrors your whole workspace into that folder and reloads the newer copy
  when you open it elsewhere. Sequential use across machines (last save wins);
  IndexedDB remains the local default when unlinked. See "Cross-machine sync" below.
- **Importing Markdown**: drag `.md` files onto a board (or Export → *Import
  Markdown files*) and each becomes a board of typed cards — handy for bringing
  content over from any tool that exports Markdown. See
  [docs/importing.md](docs/importing.md).
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

## Cross-machine sync (detail)

Folium stores everything locally in IndexedDB by default. To carry boards between
your own machines:

1. Put a folder inside a service that syncs across your devices — OneDrive,
   Google Drive, Dropbox, iCloud Drive, or Syncthing all work; any folder that
   gets mirrored to your other machines is fair game. (A git repo works too, but
   it syncs on commit cadence and bloats history, so a cloud-synced folder is
   smoother.)
2. In Folium: **Settings (gear) → Cross-machine sync → Link a folder…** and pick
   that folder. Folium writes `folium-workspace.json` there and keeps it current
   on every change.
3. On your other machine, open Folium and link the **same** synced folder. If it
   already contains a workspace, Folium asks whether to load it (replacing local)
   or overwrite it with the local boards.

Notes and limits:
- **Chrome/Edge only** — this feature relies on the File System Access API, which
  those browsers implement and others don't. Other browsers keep working locally;
  the sync section shows a note instead of the folder picker.
- Designed for **sequential** use — edit on one machine, then another. Last save
  wins by timestamp. Editing the same board on two machines at once isn't safe
  (same as two browser tabs).
- After a reload the browser asks for folder permission again — click *Reconnect*
  in Settings.
- The whole workspace (including images, base64-encoded) is written on each save,
  so very large image collections make a large file.

## Bring your own Pexels key

The image picker can search [Pexels](https://www.pexels.com/) stock photos. Get
a free API key at [pexels.com/api](https://www.pexels.com/api/) and paste it into
**Settings → Pexels**. The key is stored only in your browser's local IndexedDB —
it's never synced (including via cross-machine sync) or sent anywhere except
Pexels' own API. Without a key, everything else in Folium works as normal; you
just won't see stock-photo search results.

## Browser support

Folium is built and tested against current **Chrome** and **Edge**. Other
Chromium-based browsers should work for core features. Cross-machine sync
specifically requires the File System Access API (Chrome/Edge only — see above).
Firefox and Safari aren't actively tested and may be missing features.

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free for any noncommercial
purpose; commercial use or redistribution requires a separate license from
the author.

## Contributing

Bug fixes and small features are welcome as PRs. See
[CONTRIBUTING.md](CONTRIBUTING.md) for dev setup and what's expected before you
open one.
