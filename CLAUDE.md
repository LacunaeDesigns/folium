# Folium — project instructions

Local-first freeform board/canvas app (React 18 + TypeScript, Vite 8, PWA). Single developer, public repo (github.com/LacunaeDesigns/folium) under **PolyForm Noncommercial 1.0.0** — don't vendor code with incompatible licenses; contribution/relicense terms are in CONTRIBUTING.md. Targets Chrome/Edge only (File System Access API, PWA); Firefox/Safari untested.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on **5173** (strictPort — errors if the port is taken). **No service worker in dev.** |
| `npm test` / `npm run test:watch` | Vitest — config lives in vite.config.ts (there is no vitest.config.ts) |
| `npx tsc --noEmit` | Typecheck |
| `npm run build` | `tsc -b && vite build` → dist/ with the service worker |
| `.claude/launch.json → folium-dist` | Serves the real dist build on **4173** via serve.mjs — the only way to exercise SW/PWA |
| `npm install --no-save sharp && node scripts/generate-icons.mjs` | Regenerate PWA icons (sharp is deliberately not a devDependency) |

## Verify in the right environment

- Anything touching the service worker, PWA install/manifest, offline, the update banner, or `#/capture` relaunch **must be verified against the built dist** (`folium-dist` launch config, port 4173). `npm run dev` has no service worker at all.
- serve.mjs quirks: it injects a keepalive SSE script into served HTML, self-terminates ~20s after the last tab closes, and if 4173 is already bound it silently opens a tab on the existing (possibly stale) instance — rebuild and restart before trusting what you see.
- Everything else: the `folium` launch config (Vite dev, 5173).

## Definition of done

Never claim a change is complete without running `npm test` and `npx tsc --noEmit` and showing the result. Also run `npm run build` when the change touches build/PWA config, and always before the end-of-session push. CI (.github/workflows/ci.yml) runs exactly these three.

A **user-facing feature** is not done until, in the same unit of work:

- the README feature list reflects it,
- the in-app Help panel (`src/ui/HelpPanel.tsx` — the app's own documentation, drifts silently) covers it, including any new shortcut,
- a `docs/<topic>.md` page exists and is linked from README when the feature has real usage detail (model: docs/importing.md).

## Workflow — scale to the change

- **Small fix / polish:** inline, test-first, single agent.
- **Feature-sized work, or anything touching store/sync/persistence/export-import:** full subagent-driven-development pipeline — implementer + spec review + code-quality review per task (the Waves A–D pattern). When a plan is written first, save it as `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`.

## Git

- Conventional commits: `type(scope): imperative lowercase subject`, no trailing period; long subjects append a clarifying clause after ` -- ` or an em dash. Scopes are feature-named — canvas, store, ui, cards, pwa, sync, help, present, notes, export, ink, app, …
- Commit freely in small commits as work lands; **push to origin/main only at session end** once tests + typecheck + build are green. The repo is public — a push is a publish.
- Author identity is `Rika Lim <9069583+LacunaeDesigns@users.noreply.github.com>`. Never commit with the work email.

## Testing conventions

- Colocated `<Name>.test.ts` (never `.test.tsx`) next to the source it tests; vitest globals on; jsdom environment; IndexedDB comes from `fake-indexeddb/auto` in src/test/setup.ts — don't mock indexedDB yourself.
- Exercise real store/model code; `vi.mock` is a last resort (only src/store/sync.test.ts uses it today).
- Logic-level tests are **required** for changes under src/store/, src/model/, src/export/, src/import/, src/charts/, and canvas logic. UI `.tsx` components need no render tests — there is no React Testing Library here; don't add it.

## Architecture in one screen

- One zustand vanilla store (src/store/store.ts) wrapped in zundo `temporal` — the undo-able state is strictly `{rootId, boards, cards, lines}`. Ephemeral UI state (selection, panels, tool, theme) lives in src/store/uiStore.ts, never in the doc store.
- Data model: src/model/types.ts. Flat normalized DocState; nested boards are just cards of type `'board'` whose content points at a board id.
- Persistence: Dexie/IndexedDB, database name **`atlasnote`** — deliberate pre-rebrand legacy so old data survives; never rename it.
- A new card type touches four places: CardType union + content interface (model/types.ts), `defaultContent()` + `DEFAULT_CARD_SIZE` (store/store.ts), a new `cards/<Type>Card.tsx`, and `registerCardBody` in cards/index.ts.
- Theme-sensitive colors are CSS custom properties in src/styles/tokens.css, defined under both `:root` and the dark selectors (`:root[data-theme='dark']`, `[data-board-theme='dark']`) — never hardcode hex in components.
- Folder sync (File System Access API, last-write-wins) and live sessions (PeerJS, src/live/) are **separate mechanisms** with separate stores — don't conflate them.
- **Data-layer invariants (serialization path, undo, blob GC, frame membership): see src/store/CLAUDE.md.** The one never to miss: a new persisted field on Board/Card/Line must be added to the Backup shape in src/export/json.ts, or folder sync and export silently drop it.
- Dev-only console debugging: `window.__folium` exposes the store/db/helpers under `npm run dev`.

## Stale-doc warnings

- docs/audit-2026-07-16.md is a frozen snapshot: Waves A–D have fully shipped since; only Wave E items (sync merge logic, touch/tablet input, React/Zustand/TipTap major upgrades, memoized selectors) remain open. Its file:line anchors are stale — re-locate before acting on them.
- .checkpoint/ledger.json resume hints can lag reality — cross-check `git log` before trusting a "next step".
