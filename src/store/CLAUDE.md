# Data-layer invariants

Applies to the document store, persistence, sync, and anything that mutates DocState. Breaking one of these loses user data silently.

1. **Serialization path.** Every persisted field on Board/Card/Line/DocState must be handled in the Backup shape in src/export/json.ts (`exportBackup` / `parseBackup` / `applyBackup`). Folder sync, manual JSON backup, and import all funnel through that one path — a missed field works locally but silently drops on every sync/export round-trip.
2. **Undo discipline.** zundo records a history entry on *every* `set()`, whether or not state changed. Mutators must bail out before calling `set()` in no-op cases (see the comment in `moveCards()` in store.ts). The undo-able document is partialized to `{rootId, boards, cards, lines}` with limit 100 — ephemeral UI state belongs in uiStore.ts, never here.
3. **Frame membership is not reactive.** It is recomputed only by explicit `reassignFrameMembership()` calls in the move/resize paths. Any new mutation that changes card or frame geometry must call it too, or containment silently desyncs.
4. **Blob GC.** `gcBlobs()` in persist.ts treats a blob as live if it is referenced by current state, zundo past/future states, saved templates, **or** retained version snapshots. Never delete blobs based on current state alone — undo can resurrect references.
5. **Database name is `atlasnote`.** Deliberate pre-rebrand legacy so existing user data survives; never rename it without a migration. `healLegacyAssetUrls()` in persist.ts is a one-time legacy content fix — leave it in place.
6. **Two sync systems, never cross-wired.** Folder sync (folderSync.ts + sync.ts: File System Access API, last-write-wins by `exportedAt`, explicit conflict UI offering reload vs force-push-mine) versus live sessions (src/live/: PeerJS, ephemeral). Separate stores: `useSync` vs `useLive`.
7. **Autosave is debounced.** 600 ms via `bindAutosave` in persist.ts, flushed on pagehide/visibilitychange — don't assume a mutation is on disk the moment the action returns.
8. **Stamp `Board.updatedAt`** in every action that changes a board's content — the board library sorts and reports by it.
