# Wave D Plan — flagship features

> **For agentic workers:** This is the wave-level plan: decisions, ordering, and per-feature
> specs for roadmap items 18–22 (`docs/audit-2026-07-16.md` §4). Each feature below gets its
> own detailed implementation plan (superpowers:writing-plans → subagent-driven-development)
> at the start of its build session — brainstorming for Wave D is done; the decisions here
> are settled and should not be re-litigated.

**Goal:** Ship the five Wave D flagship features: local version snapshots, board library,
quick capture, ink re-edit, PWA installability.

**Architecture:** All five build on existing seams — no architectural rework. Snapshots hook
the autosave pipeline; the board library reuses the TemplateGallery modal + schematic-SVG
preview patterns; quick capture reuses the Unsorted-tray card flag + Ctrl+K hotkey slot;
ink re-edit reopens retained stroke data into the existing InkLayer session; PWA adds
manifest/SW/icons around the existing serve.mjs + updateCheck machinery.

**Tech Stack:** React 18 + Vite + TypeScript, Zustand + zundo, Dexie (IndexedDB, db name
`atlasnote`), Vitest. No new runtime dependencies expected except possibly `vite-plugin-pwa`.

**Baseline (2026-07-16):** Waves A–C fully shipped, `main` @ `a13523e`,
`tsc -b --noEmit` clean, all tests passing.

---

## Decisions (settled 2026-07-16 with Rika)

1. **Snapshots are whole-workspace** (matches the one-Dexie-row persistence model), stored
   **locally only** — kept out of folder sync so sync payloads and conflict logic stay
   untouched.
2. **Dashboard = flat board library** over the existing single-document board tree, with
   schematic SVG tiles. Multiple independent workspaces are explicitly out of scope (Wave E+
   conversation at the earliest).
3. **Quick capture ships in layers:** in-app hotkey + capture modal + URL-addressable
   `#/capture` now; PWA jump-list/launch-handler/`.lnk`-hotkey glue lands inside the PWA
   task. Captures always file to the **root board's Unsorted tray ("Inbox")**.
4. **PWA replaces the desktop-exe REVISIT for now** — install + offline via manifest and
   service worker; the `.exe` question is deferred, re-opened only if the `.lnk` hotkey
   delay (see Task 20) grates in practice.

## Build order

Snapshots → quick capture → ink re-edit → board library → PWA. Each independently shippable.
Rationale: snapshots first de-risks everything after (any regression becomes recoverable);
PWA last because it touches the launch/update story and wants a stable app underneath.

---

### Task 18: Local version snapshots — "undo survives reload"

**Feature:** Periodic dated snapshots of the whole workspace, browsable and restorable from
a "Version history" UI.

**Anchors:**
- Storage: new Dexie table in `FoliumDb` (`src/store/persist.ts:30-48`) via
  `this.version(3).stores({ snapshots: 'id' })` — record ≈ `{ id, ts, doc: DocState,
  label? }`. Payload is the doc slice only (blobs stay in the shared `blobs` table,
  referenced by id — do NOT copy blob bytes per snapshot).
- Write trigger: the existing autosave `onWrite` hook (`bindAutosave`,
  `src/store/persist.ts:261-302`, wired in `src/store/context.tsx:54-60`). Snapshot at most
  once per interval (suggest 10 min) plus one on boot — autosave-driven, **never** an
  independent per-tab timer (two open tabs would race/duplicate).
- Retention: prune on write — suggest keep all from last hour, hourly for 24h, daily for
  30 days. Exact ladder is the implementer's call; cap total count.
- Restore: follow the established hydrate pattern exactly —
  `hydrate(doc)` + `store.temporal.getState().clear()` + normal save, as done by backup
  import (`src/export/json.ts:84`) and tab-sync (`src/store/tabSync.ts:67-80`). Restoring
  must snapshot the pre-restore state first (restore is itself undoable via history).
- **Gotcha (blob GC):** `computeReferencedBlobIds`/`gcBlobs`
  (`src/store/persist.ts:192-226`) must also treat blob ids referenced by retained
  snapshots as live, or old versions silently lose images. This is the highest-risk edge —
  test it explicitly.
- **Gotcha (settings scope):** snapshots capture `DocState` only — never settings, uiStore,
  or templates; restore must not touch those either.
- UI: "Version history" list (side-panel pattern, `src/ui/TrashView.tsx` +
  `panels.css .side-panel`) — timestamped entries, restore button with confirm, maybe
  card-count delta as a cheap diff hint.

**Verify:** edit → wait/flush → reload → Version history shows the snapshot → restore an
older one → boards revert, images intact, Ctrl+Z does not cross the restore, second tab
hydrates cleanly. Run blob GC after pruning and confirm snapshot-referenced blobs survive.

### Task 20 (built second): Quick capture → Inbox

**Feature:** From anywhere in the app, a hotkey opens a minimal capture modal; Enter files a
note card into the root board's Unsorted tray.

**Anchors:**
- Hotkey: register **above** the `isTyping()` guard in `src/canvas/useShortcuts.ts`
  (the Ctrl+K search binding at :108-112 is the exact precedent). Binding suggestion:
  `Alt+N` (check the existing bindings list for conflicts before choosing).
- Create action: `addCard(rootId, 'note', { inUnsorted: true, content: { doc: … } })` —
  same call `UnsortedTray.quickAdd()` already makes (`src/ui/UnsortedTray.tsx:78-88`).
  Always `rootId`, regardless of current board.
- Modal: new small component (overlay pattern from `src/ui/TemplateGallery.tsx` /
  `panels.css .overlay`), single text input, "→ Inbox" hint, Enter files + stays open or
  closes (implementer's pick — suggest Enter files+closes, Shift+Enter files+stays),
  Escape closes.
- URL layer: extend the hash routing in `src/App.tsx:394-405` so `#/capture` opens the app
  with the modal up (then normalizes the hash back to the current board). This is the hook
  the PWA task's jump-list/launch-handler glue depends on.
- Known ceiling (accepted): browser apps cannot register OS-global hotkeys; this hotkey
  works while the tab/window is focused. The near-global story arrives with Task 22.

**Verify:** hotkey works from canvas and while a card's text field is focused; captured note
appears in root board's tray with correct text; `#/capture` cold-load opens the modal.

### Task 21 (third): Ink re-edit

**Feature:** Re-open a committed ink card for editing — append strokes and erase strokes.
No per-point vertex editing (out of scope, keep it that way).

**Anchors:**
- Data is already there: `InkContent.strokes` retains raw points/pressure/color/width
  (`src/model/types.ts:138-154`) — nothing is baked flat.
- Entry: context-menu "Edit ink" (and/or double-click) on an ink card → load the card's
  strokes into an `InkLayer` session (`src/canvas/InkLayer.tsx`), translated from
  card-local back to world coords (`finalize()` at :64-106 rebased them to the card bbox —
  invert that: add card `x,y`).
- Exit: re-finalize with recomputed bounds into `updateCard` on the *existing* card id
  (not a new card); deleting the last stroke deletes the card. One undo entry for the
  whole edit session.
- Eraser: the live session's whole-stroke eraser (`strokeHits`, `InkLayer.tsx:20-28`)
  works as-is once strokes are loaded.
- Note `pointercancel` handling exists post-Wave-B (shared gesture hook) — keep it wired.

**Verify:** draw ink → commit → edit → append + erase strokes → bounds and position stay
correct at non-1 zoom → single Ctrl+Z reverts the whole edit session.

### Task 19 (fourth): Board library ("All boards")

**Feature:** Full-screen overlay listing every board in the workspace tree — schematic
tile, title, hierarchy hint, card count, last-edited — with search filtering, click-to-jump,
rename, and new-board.

**Anchors:**
- View: full-screen modal following `src/ui/TemplateGallery.tsx` (`.overlay` + modal card,
  `panels.css:166-379`), opened from TopBar and/or a shortcut; mounted in `App.tsx` like
  `templatesOpen`.
- Tiles: reuse/extract the schematic-SVG preview from `TemplatePreview`
  (`src/ui/TemplateGallery.tsx:10-44`) — colored rects from card geometry. No pixel
  rasterizer (none exists; don't build one).
- Data: all boards are already in memory (`s.boards`); compute per-board aggregates
  (counts, todo stats) in **one combined pass** over `s.cards`, not per-board scans
  (`boardCardCount` at `src/store/selectors.ts:34-49` is O(cards) each).
- **Prerequisite sub-task — `updatedAt` on Board:** `Board` has `createdAt` only
  (`src/model/types.ts:3-19`). Add `updatedAt`, stamped by card/line/board mutations for
  the owning board (a small helper in `store.ts` actions). Snapshots UI benefits too.
  Backfill: absent → fall back to `createdAt`.
- Actions per tile: open (jump via `useUi.setBoard`), rename (`renameBoard`,
  `store.ts:686-692`), new board at root (`createBoard`). Delete stays where it is today
  (trash the BoardCard); don't add a second deletion path.
- Search: filter by title match; reuse `src/store/search.ts` only if it's trivially
  applicable, else a simple `includes()` — don't over-build.

**Verify:** tree with nested boards renders all boards with sane previews; search narrows;
jump/rename work; open board with 500+ cards — overlay opens without jank.

### Task 22 (last): PWA installability

**Feature:** Install Folium as an app (manifest + icons + service worker + offline shell),
replacing the `create-shortcut.vbs` hack, plus the quick-capture global-ish hotkey glue.

**Anchors:**
- Manifest: `public/manifest.webmanifest` — name/short_name "Folium", `start_url: '/'`,
  `display: standalone`, theme/background colors from the brand palette, and a
  `shortcuts` entry "Quick capture" → `/#/capture`. Add `launch_handler:
  { client_mode: 'focus-existing' }` + a `launchQueue` consumer so re-launching `#/capture`
  focuses the running window and opens the modal. Link it + `theme-color` +
  `apple-touch-icon` in `index.html` (currently bare, 13 lines).
- Icons: derive 192×192, 512×512, and a maskable variant (PNG) from
  `public/brand/folium.svg`. Only `.svg`/`.ico` exist today.
- Service worker: precache the app shell (hashed `dist/` assets) + runtime-cache same-origin
  navigation. `vite-plugin-pwa` (generateSW) is the low-hassle default; hand-rolled is fine
  too. Localhost HTTP is a secure context — installable as-is.
- **Gotcha (serve.mjs):** `serve.mjs` string-replaces `</body>` to inject an SSE keepalive
  and sets `no-store` on `index.html` (lines ~98-118) — SW registration must not break the
  injection, and the SW should respect/not-fight the `no-store` index policy (network-first
  for navigations is the safe choice). `.webmanifest` MIME type is already registered
  (serve.mjs:32).
- **Gotcha (double update UX):** merge the GitHub-commit update check
  (`src/store/updateCheck.ts`) and the SW waiting-worker event into ONE "update available"
  notice — when a SW is registered, prefer the SW signal (it reflects the actually-served
  build); keep the GitHub check for non-installed/zip users.
- `.lnk` hotkey: extend/replace `create-shortcut.vbs` to create a shortcut targeting the
  installed PWA's `#/capture` launch with a "Shortcut key" assigned (e.g. Ctrl+Alt+F) —
  the de-facto OS-global capture hotkey. Document the known Windows `.lnk`-hotkey
  activation delay (~1s) in the README/Help.
- Offline honesty: board editing/search/export work offline already (IndexedDB + bundled
  assets); Pexels search and Live sessions (PeerJS public broker) are online-only —
  say so in Help rather than pretending full offline.

**Verify:** Lighthouse/Chrome installability check passes; install → standalone window with
correct icon; kill network → reload → app shell + boards load; jump-list "Quick capture"
works; new build → exactly one update notice; `serve.mjs` keepalive still auto-exits the
server after tabs close.

---

## Cross-cutting

- **Per-feature process:** each task = its own session-sized unit: detailed plan
  (superpowers:writing-plans, saved under `docs/superpowers/plans/`), then
  subagent-driven-development with spec + code-quality review per task, as in Waves A–C.
- **Tests:** every store/persist-level behavior above gets Vitest coverage (snapshot
  write/prune/restore, blob-GC retention, `updatedAt` stamping, capture `addCard` wiring,
  ink re-finalize bounds). UI overlays follow the existing light-touch test pattern.
- **Recon provenance:** file:line anchors above were mapped 2026-07-16 against `a13523e`
  by four recon passes + spot verification; re-verify anchors if `main` has moved.
