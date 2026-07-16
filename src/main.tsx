import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/karla/400.css'
import '@fontsource/karla/500.css'
import '@fontsource/karla/600.css'
import '@fontsource/karla/700.css'
import '@fontsource/fraunces/600.css'
import '@fontsource/fraunces/700.css'
import './styles/tokens.css'
import './styles/global.css'
import App from './App'
import { FoliumProvider, bootFolium } from './store/context'
import { registerSW } from 'virtual:pwa-register'
import { setSwUpdateReady } from './store/updateCheck'

// registerType is 'prompt': a rebuilt SW waits until the user clicks the update
// banner's Reload, which calls updateSW(true) — activate + reload in one step.
const updateSW = registerSW({
  onNeedRefresh() {
    setSwUpdateReady(() => void updateSW(true))
  },
})

const root = ReactDOM.createRoot(document.getElementById('root')!)

bootFolium().then(({ store, db }) => {
  if (import.meta.env.DEV) {
    ;(window as unknown as Record<string, unknown>).__folium = { store, db }
    void Promise.all([
      import('./export/collect'),
      import('./export/html'),
      import('./export/markdown'),
      import('./live/viewerScript'),
      import('peerjs/dist/peerjs.min.js?raw'),
      import('./export/json'),
      import('./store/folderSync'),
    ]).then(([collect, html, md, viewer, peerRaw, json, fsync]) => {
      Object.assign((window as unknown as { __folium: object }).__folium, {
        collectBoardExport: collect.collectBoardExport,
        buildHtmlExport: html.buildHtmlExport,
        boardToMarkdown: md.boardToMarkdown,
        viewerLiveJs: viewer.VIEWER_LIVE_JS,
        peerjsRaw: (peerRaw as { default: string }).default,
        exportBackup: json.exportBackup,
        parseBackup: json.parseBackup,
        applyBackup: json.applyBackup,
        writeWorkspace: fsync.writeWorkspace,
        readWorkspace: fsync.readWorkspace,
        chooseSource: fsync.chooseSource,
      })
    })
  }
  root.render(
    <React.StrictMode>
      <FoliumProvider store={store} db={db}>
        <App />
      </FoliumProvider>
    </React.StrictMode>,
  )
})
