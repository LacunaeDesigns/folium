/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // The manifest is hand-authored in public/manifest.webmanifest and
      // linked from index.html.
      manifest: false,
      // New SWs wait until the user opts in via the update banner (see
      // src/store/updateCheck.ts) instead of reloading tabs out from under them.
      registerType: 'prompt',
      workbox: {
        // index.html is deliberately NOT precached: serve.mjs injects its SSE
        // keepalive snippet into HTML at serve time, and a cache-first shell
        // would drop it — the launcher would think every tab is closed and
        // shut down under a live window. Navigations go network-first instead.
        globPatterns: ['**/*.{js,css,svg,png,ico,woff,woff2,webmanifest}'],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'folium-pages' },
          },
        ],
      },
    }),
  ],
  define: {
    __BUILD_TIME__: JSON.stringify(Date.now()),
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
