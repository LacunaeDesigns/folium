import React from 'react'
import { useStore } from 'zustand'
import { TopBar } from './ui/TopBar'
import { Toolbar } from './ui/Toolbar'
import { Canvas } from './canvas/Canvas'
import { UnsortedTray } from './ui/UnsortedTray'
import { TrashView } from './ui/TrashView'
import { SearchPanel } from './ui/SearchPanel'
import { TemplateGallery } from './ui/TemplateGallery'
import { ExportMenu } from './ui/ExportMenu'
import { PresentMode } from './ui/PresentMode'
import { LiveSessionPanel } from './ui/LiveSessionPanel'
import { HelpPanel } from './ui/HelpPanel'
import { useLive } from './live/host'
import { useSync, linkFolder, unlinkFolder, reconnect, syncNow } from './store/sync'
import { relTime } from './cards/CommentCard'
import { useAtlas, useAtlasStore, useDb } from './store/context'
import { breadcrumbs } from './store/selectors'
import {
  saveUserName,
  getUserName,
  savePexelsKey,
  getPexelsKey,
  getAppTheme,
  saveAppTheme,
  getShowGrid,
  saveShowGrid,
  AppTheme,
} from './store/settings'
import { PexelsPanel } from './ui/PexelsPanel'
import { useUi } from './store/uiStore'
import { useShortcuts } from './canvas/useShortcuts'
import { Icon } from './ui/Icons'
import './cards'

function ViewMenu({ onClose }: { onClose: () => void }) {
  const db = useDb()
  const appTheme = useUi((s) => s.appTheme)
  const fire = (op: string) => {
    window.dispatchEvent(new CustomEvent('atlas:view', { detail: { op } }))
    onClose()
  }
  return (
    <div className="menu-pop topbar-menu" onPointerDown={(e) => e.stopPropagation()}>
      <button className="menu-item" onClick={() => fire('zoom-in')}>
        <Icon name="zoom-in" size={15} /> Zoom in
      </button>
      <button className="menu-item" onClick={() => fire('zoom-out')}>
        <Icon name="zoom-out" size={15} /> Zoom out
      </button>
      <button className="menu-item" onClick={() => fire('zoom-reset')}>
        <Icon name="search" size={15} /> Zoom to 100%
      </button>
      <button className="menu-item" onClick={() => fire('fit')}>
        <Icon name="fit" size={15} /> Fit to content
      </button>
      <button className="menu-item" onClick={() => fire('fit-selection')}>
        <Icon name="fit" size={15} /> Zoom to selection
      </button>
      <div className="menu-sep" />
      <button
        className="menu-item"
        onClick={() => {
          const next = appTheme === 'dark' ? 'light' : 'dark'
          useUi.getState().setAppTheme(next)
          void saveAppTheme(db, next)
          onClose()
        }}
      >
        <Icon name="palette" size={15} /> {appTheme === 'dark' ? 'Light mode' : 'Dark mode'}
      </button>
      <button
        className="menu-item"
        onClick={() => {
          useUi.getState().setPresentationMode(true)
          onClose()
        }}
      >
        <Icon name="play" size={15} /> Present
      </button>
    </div>
  )
}

function SyncSection() {
  const sync = useSync()

  if (sync.status === 'unsupported') {
    return (
      <div className="sync-block">
        <label className="settings-label">Cross-machine sync</label>
        <p className="sync-hint">
          Folder sync needs Chrome or Edge. In this browser your work stays saved locally on this
          machine.
        </p>
      </div>
    )
  }

  return (
    <div className="sync-block">
      <label className="settings-label">Cross-machine sync</label>
      {sync.status === 'off' && (
        <>
          <p className="sync-hint">
            Link a folder in a synced location (OneDrive, Dropbox, iCloud…) and Folium keeps your
            whole workspace saved there, so it appears on your other machines.
          </p>
          <button className="sync-btn primary" disabled={sync.busy} onClick={() => void linkFolder()}>
            {sync.busy ? 'Linking…' : 'Link a folder…'}
          </button>
        </>
      )}
      {sync.status === 'needs-reconnect' && (
        <>
          <p className="sync-hint">
            Reconnect “{sync.dirName}” to resume syncing (browsers ask permission again after a
            reload).
          </p>
          <button className="sync-btn primary" disabled={sync.busy} onClick={() => void reconnect()}>
            Reconnect
          </button>
        </>
      )}
      {sync.status === 'linked' && (
        <>
          <p className="sync-hint">
            Synced to <b>{sync.dirName}</b>
            {sync.lastSyncedAt ? ` · saved ${relTime(sync.lastSyncedAt)}` : ''}
            {sync.busy ? ' · saving…' : ''}
          </p>
          <div className="sync-row">
            <button className="sync-btn" disabled={sync.busy} onClick={() => void syncNow()}>
              Sync now
            </button>
            <button className="sync-btn ghost" onClick={() => void unlinkFolder()}>
              Unlink
            </button>
          </div>
        </>
      )}
      {sync.status === 'error' && (
        <>
          <p className="sync-hint error">Sync error: {sync.error}</p>
          <button className="sync-btn" disabled={sync.busy} onClick={() => void linkFolder()}>
            Re-link a folder…
          </button>
        </>
      )}
    </div>
  )
}

function SettingsMenu({ onClose }: { onClose: () => void }) {
  const db = useDb()
  const [name, setName] = React.useState(getUserName())
  const [pexels, setPexels] = React.useState(getPexelsKey())
  const appTheme = useUi((s) => s.appTheme)
  const showGrid = useUi((s) => s.showGrid)
  return (
    <div className="menu-pop topbar-menu settings-pop" onPointerDown={(e) => e.stopPropagation()}>
      <label className="settings-label">Appearance</label>
      <div className="settings-theme-row">
        {(['light', 'dark', 'system'] as const).map((t) => (
          <button
            key={t}
            className={'settings-theme-opt' + (appTheme === t ? ' active' : '')}
            onClick={() => {
              useUi.getState().setAppTheme(t)
              void saveAppTheme(db, t as AppTheme)
            }}
          >
            {t === 'light' ? 'Light' : t === 'dark' ? 'Dark' : 'System'}
          </button>
        ))}
      </div>
      <div className="settings-sep" />
      <label className="settings-label">Preferences</label>
      <button
        className="settings-toggle"
        onClick={() => {
          const next = !showGrid
          useUi.getState().setShowGrid(next)
          void saveShowGrid(db, next)
        }}
      >
        <Icon name="dots" size={15} /> {showGrid ? 'Hide grid' : 'Show grid'}
      </button>
      <div className="settings-sep" />
      <label className="settings-label">Your name (used on comments)</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            void saveUserName(db, name)
            onClose()
          }
        }}
        onBlur={() => void saveUserName(db, name)}
      />
      <div className="settings-sep" />
      <label className="settings-label">Pexels API key (for free photo search)</label>
      <input
        type="password"
        placeholder="Paste your key from pexels.com/api"
        value={pexels}
        onChange={(e) => setPexels(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            void savePexelsKey(db, pexels)
            onClose()
          }
        }}
        onBlur={() => void savePexelsKey(db, pexels)}
      />
      <div className="settings-sep" />
      <SyncSection />
    </div>
  )
}

export default function App() {
  const store = useAtlasStore()
  const rootId = useAtlas((s) => s.rootId)
  const currentBoardId = useUi((s) => s.currentBoardId) ?? rootId
  const board = useAtlas((s) => s.boards[currentBoardId])
  const crumbs = useAtlas((s) => breadcrumbs(s, currentBoardId))
  const renameBoard = useAtlas((s) => s.renameBoard)
  const activeTool = useUi((s) => s.activeTool)
  const setTool = useUi((s) => s.setTool)
  const setBoard = useUi((s) => s.setBoard)
  const trashOpen = useUi((s) => s.trashOpen)
  const setTrashOpen = useUi((s) => s.setTrashOpen)
  const searchOpen = useUi((s) => s.searchOpen)
  const presentationMode = useUi((s) => s.presentationMode)
  const appTheme = useUi((s) => s.appTheme)
  const showGrid = useUi((s) => s.showGrid)
  const [systemDark, setSystemDark] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches,
  )
  const effectiveTheme: 'light' | 'dark' = appTheme === 'system' ? (systemDark ? 'dark' : 'light') : appTheme
  const [menu, setMenu] = React.useState<'view' | 'settings' | 'export' | 'live' | null>(null)
  const [templatesOpen, setTemplatesOpen] = React.useState(false)
  const [photosOpen, setPhotosOpen] = React.useState(false)
  const [helpOpen, setHelpOpen] = React.useState(false)
  const liveActive = useLive((s) => s.active)
  const canUndo = useStore(store.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(store.temporal, (s) => s.futureStates.length > 0)

  useShortcuts()

  // load the persisted app-wide theme + grid preference once settings are ready
  React.useEffect(() => {
    useUi.getState().setAppTheme(getAppTheme())
    useUi.getState().setShowGrid(getShowGrid())
  }, [])

  // follow the OS theme while appTheme is 'system'
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // apply the app-wide theme to <html> so it covers the whole page, body included
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme)
  }, [effectiveTheme])

  // hash routing: #/b/<boardId>; back/forward supported
  React.useEffect(() => {
    const apply = () => {
      const m = location.hash.match(/^#\/b\/(.+)$/)
      const id = m ? m[1] : rootId
      const target = store.getState().boards[id] ? id : rootId
      if (useUi.getState().currentBoardId !== target) useUi.getState().setBoard(target)
    }
    apply()
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [rootId, store])

  // close top bar menus on outside click
  React.useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menu])

  // fall back to root if the current board disappears (e.g. deleted)
  React.useEffect(() => {
    if (!board) setBoard(rootId)
  }, [board, rootId, setBoard])

  if (!board) return null

  const gridShown = board.gridHidden === undefined ? showGrid : !board.gridHidden

  return (
    <div className="app-shell" data-board-theme={effectiveTheme}>
      <header className="app-header">
        <TopBar
          crumbs={crumbs.map((b) => ({ id: b.id, title: b.title, color: b.color }))}
          title={board.title}
          onNavigate={setBoard}
          onTitleChange={(t) => renameBoard(currentBoardId, t)}
          onSearch={() => useUi.getState().setSearchOpen(true)}
          onExport={() => setMenu(menu === 'export' ? null : 'export')}
          onView={() => setMenu(menu === 'view' ? null : 'view')}
          onSettings={() => setMenu(menu === 'settings' ? null : 'settings')}
          onTemplates={() => setTemplatesOpen(true)}
          onLive={() => setMenu(menu === 'live' ? null : 'live')}
          onHelp={() => setHelpOpen(true)}
          onUndo={() => store.temporal.getState().undo()}
          onRedo={() => store.temporal.getState().redo()}
          canUndo={canUndo}
          canRedo={canRedo}
          liveActive={liveActive}
          rightExtra={
            <span className="menu-anchor">
              {menu === 'view' && <ViewMenu onClose={() => setMenu(null)} />}
              {menu === 'settings' && <SettingsMenu onClose={() => setMenu(null)} />}
              {menu === 'export' && <ExportMenu boardId={currentBoardId} onClose={() => setMenu(null)} />}
              {menu === 'live' && <LiveSessionPanel boardId={currentBoardId} />}
            </span>
          }
        />
      </header>
      <nav className="app-toolbar">
        <Toolbar
          activeTool={activeTool}
          onPickTool={(t) => setTool(activeTool === t ? null : t)}
          onOpenTrash={() => setTrashOpen(!trashOpen)}
          trashActive={trashOpen}
          onOpenPhotos={() => setPhotosOpen(true)}
        />
      </nav>
      <main className={'app-canvas' + (gridShown ? '' : ' no-grid')}>
        <Canvas boardId={currentBoardId} />
        <UnsortedTray boardId={currentBoardId} />
        {trashOpen && <TrashView />}
      </main>
      {searchOpen && <SearchPanel />}
      {templatesOpen && (
        <TemplateGallery boardId={currentBoardId} onClose={() => setTemplatesOpen(false)} />
      )}
      {photosOpen && (
        <PexelsPanel boardId={currentBoardId} onClose={() => setPhotosOpen(false)} />
      )}
      {presentationMode && <PresentMode boardId={currentBoardId} />}
      {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
    </div>
  )
}
