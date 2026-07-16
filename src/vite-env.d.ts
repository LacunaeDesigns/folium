/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Wall-clock time (ms) this build was produced, injected by vite.config.ts's `define`.
 *  Used to detect when the deployed repo has moved on since this copy was built —
 *  see src/store/updateCheck.ts. */
declare const __BUILD_TIME__: number
