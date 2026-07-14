# Contributing

## Dev setup

```bash
npm install
npm run dev        # → http://localhost:5173
```

## Before opening a PR

```bash
npm test           # Vitest
npx tsc --noEmit   # typecheck
```

Both should pass.

## Code style

Match the surrounding code — no separate style guide, no linter config to fight.

## PRs

Bug fixes and small features are welcome as PRs directly. For anything bigger
(new card types, architectural changes, etc.), open an issue first so we can
talk through the approach before you put the work in.
