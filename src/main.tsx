import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/pt-serif/700.css'
import './styles/tokens.css'
import './styles/global.css'
import App from './App'
import { AtlasProvider, bootAtlas } from './store/context'

const root = ReactDOM.createRoot(document.getElementById('root')!)

bootAtlas().then(({ store, db }) => {
  if (import.meta.env.DEV) {
    ;(window as unknown as Record<string, unknown>).__atlas = { store, db }
    void Promise.all([
      import('./export/collect'),
      import('./export/html'),
      import('./export/markdown'),
      import('./live/viewerScript'),
      import('peerjs/dist/peerjs.min.js?raw'),
    ]).then(([collect, html, md, viewer, peerRaw]) => {
      Object.assign((window as unknown as { __atlas: object }).__atlas, {
        collectBoardExport: collect.collectBoardExport,
        buildHtmlExport: html.buildHtmlExport,
        boardToMarkdown: md.boardToMarkdown,
        viewerLiveJs: viewer.VIEWER_LIVE_JS,
        peerjsRaw: (peerRaw as { default: string }).default,
      })
    })
  }
  root.render(
    <React.StrictMode>
      <AtlasProvider store={store} db={db}>
        <App />
      </AtlasProvider>
    </React.StrictMode>,
  )
})
