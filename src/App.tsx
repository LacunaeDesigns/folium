import React from 'react'
import { useStore } from 'zustand'
import { TopBar } from './ui/TopBar'
import { Toolbar } from './ui/Toolbar'
import { Canvas } from './canvas/Canvas'
import { UnsortedTray } from './ui/UnsortedTray'
import { TrashView } from './ui/TrashView'
import { HistoryPanel } from './ui/HistoryPanel'
import { SearchPanel } from './ui/SearchPanel'
import { TemplateGallery } from './ui/TemplateGallery'
import { CaptureModal } from './ui/CaptureModal'
import { ExportMenu } from './ui/ExportMenu'
import { PresentMode } from './ui/PresentMode'
import { LiveSessionPanel } from './ui/LiveSessionPanel'
import { HelpPanel } from './ui/HelpPanel'
import { SaveStatusIndicator } from './ui/SaveStatusIndicator'
import { useLive } from './live/host'
import { useSync, linkFolder, unlinkFolder, reconnect, syncNow, forcePushMine } from './store/sync'
import { useUpdateCheck } from './store/updateCheck'
import { relTime } from './cards/CommentCard'
import { useFolium, useFoliumStore, useDb } from './store/context'
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
import { useShortcuts, zOrderedIds, zBatchPatches } from './canvas/useShortcuts'
import { Icon } from './ui/Icons'
import './cards'

function ViewMenu({ onClose }: { onClose: () => void }) {
  const db = useDb()
  const appTheme = useUi((s) => s.appTheme)
  const fire = (op: string) => {
    window.dispatchEvent(new CustomEvent('folium:view', { detail: { op } }))
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

function ArrangeMenu({ onClose }: { onClose: () => void }) {
  const store = useFoliumStore()
  const selCount = useUi((s) => s.selection.length)
  const gap = <span style={{ display: 'inline-block', width: 15 }} />
  const fire = (op: string) => {
    window.dispatchEvent(new CustomEvent('folium:arrange', { detail: { op } }))
    onClose()
  }
  // Bring to front / Send to back act on the whole selection at once, in a
  // single updateCards batch (order preserved via zOrderedIds, z's computed
  // via zBatchPatches) so it's one undo step; Bring forward / Send backward
  // step a single card by one z-neighbour and have no coherent multi-select
  // meaning, so they route through the same single-selection-only shortcut op.
  const zTo = (dir: 'front' | 'back') => () => {
    const sel = useUi.getState().selection
    const ids = zOrderedIds(sel, (id) => store.getState().cards[id]?.z ?? 0, dir)
    store.getState().updateCards(zBatchPatches(ids, store.getState().cards, dir))
    onClose()
  }
  const alignDisabled = selCount < 2
  const distributeDisabled = selCount < 3
  const zDisabled = selCount < 1
  const stepDisabled = selCount !== 1
  return (
    <div className="menu-pop topbar-menu" onPointerDown={(e) => e.stopPropagation()}>
      <div className="menu-row">
        {(
          [
            ['align-left', 'Left'],
            ['align-centerX', 'Center'],
            ['align-right', 'Right'],
          ] as const
        ).map(([op, label]) => (
          <button
            key={op}
            className="menu-item"
            disabled={alignDisabled}
            title={'Align ' + label.toLowerCase()}
            onClick={() => fire(op)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="menu-row">
        {(
          [
            ['align-top', 'Top'],
            ['align-middleY', 'Middle'],
            ['align-bottom', 'Bottom'],
          ] as const
        ).map(([op, label]) => (
          <button
            key={op}
            className="menu-item"
            disabled={alignDisabled}
            title={'Align ' + label.toLowerCase()}
            onClick={() => fire(op)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="menu-sep" />
      <button className="menu-item" disabled={distributeDisabled} onClick={() => fire('distribute-h')}>
        {gap} Distribute horizontally
      </button>
      <button className="menu-item" disabled={distributeDisabled} onClick={() => fire('distribute-v')}>
        {gap} Distribute vertically
      </button>
      <div className="menu-sep" />
      <button className="menu-item" disabled={zDisabled} onClick={zTo('front')}>
        {gap} Bring to front
      </button>
      <button className="menu-item" disabled={stepDisabled} onClick={() => fire('step-forward')}>
        {gap} Bring forward
      </button>
      <button className="menu-item" disabled={stepDisabled} onClick={() => fire('step-back')}>
        {gap} Send backward
      </button>
      <button className="menu-item" disabled={zDisabled} onClick={zTo('back')}>
        {gap} Send to back
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
      {sync.status === 'conflict' && (
        <>
          <p className="sync-hint error">
            Newer changes were saved to “{sync.dirName}” from elsewhere, so this machine's edits
            weren't pushed (to avoid overwriting them). Reloading replaces this machine's boards
            with that newer version — anything edited here since the last sync will be lost;
            keeping this machine's boards instead overwrites the folder with them, losing the
            other machine's changes.
          </p>
          <div className="sync-row">
            <button className="sync-btn primary" disabled={sync.busy} onClick={() => void reconnect()}>
              Reload with the newer changes
            </button>
            <button
              className="sync-btn ghost"
              disabled={sync.busy}
              onClick={() => {
                if (
                  window.confirm(
                    `This will overwrite the newer changes saved in “${sync.dirName}” from another machine with this machine's boards. The other machine's changes will be lost.\n\nContinue?`,
                  )
                ) {
                  void forcePushMine()
                }
              }}
            >
              Keep this machine's boards
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
  const store = useFoliumStore()
  const rootId = useFolium((s) => s.rootId)
  const currentBoardId = useUi((s) => s.currentBoardId) ?? rootId
  const board = useFolium((s) => s.boards[currentBoardId])
  const crumbs = useFolium((s) => breadcrumbs(s, currentBoardId))
  const renameBoard = useFolium((s) => s.renameBoard)
  const activeTool = useUi((s) => s.activeTool)
  const setTool = useUi((s) => s.setTool)
  const setBoard = useUi((s) => s.setBoard)
  const trashOpen = useUi((s) => s.trashOpen)
  const setTrashOpen = useUi((s) => s.setTrashOpen)
  const historyOpen = useUi((s) => s.historyOpen)
  const setHistoryOpen = useUi((s) => s.setHistoryOpen)
  const searchOpen = useUi((s) => s.searchOpen)
  const captureOpen = useUi((s) => s.captureOpen)
  const presentationMode = useUi((s) => s.presentationMode)
  const appTheme = useUi((s) => s.appTheme)
  const showGrid = useUi((s) => s.showGrid)
  const [systemDark, setSystemDark] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches,
  )
  const effectiveTheme: 'light' | 'dark' = appTheme === 'system' ? (systemDark ? 'dark' : 'light') : appTheme
  const [menu, setMenu] = React.useState<'view' | 'arrange' | 'settings' | 'export' | 'live' | null>(null)
  const [templatesOpen, setTemplatesOpen] = React.useState(false)
  const [photosOpen, setPhotosOpen] = React.useState(false)
  const [helpOpen, setHelpOpen] = React.useState(false)
  const liveActive = useLive((s) => s.active)
  const updateAvailable = useUpdateCheck((s) => s.available)
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

  // hash routing: #/b/<boardId>; #/capture opens quick-capture then normalizes back;
  // back/forward supported
  React.useEffect(() => {
    const apply = () => {
      if (location.hash === '#/capture') {
        useUi.getState().setCaptureOpen(true)
        const board = useUi.getState().currentBoardId ?? rootId
        // replaceState (not location.hash=) so this doesn't push a history entry or
        // re-trigger 'hashchange' — otherwise this handler would loop on itself
        history.replaceState(null, '', '#/b/' + board)
        return
      }
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
          onArrange={() => setMenu(menu === 'arrange' ? null : 'arrange')}
          onSettings={() => setMenu(menu === 'settings' ? null : 'settings')}
          onTemplates={() => setTemplatesOpen(true)}
          onLive={() => setMenu(menu === 'live' ? null : 'live')}
          onHelp={() => setHelpOpen(true)}
          onUndo={() => store.temporal.getState().undo()}
          onRedo={() => store.temporal.getState().redo()}
          canUndo={canUndo}
          canRedo={canRedo}
          liveActive={liveActive}
          updateAvailable={updateAvailable}
          viewMenu={menu === 'view' && <ViewMenu onClose={() => setMenu(null)} />}
          arrangeMenu={menu === 'arrange' && <ArrangeMenu onClose={() => setMenu(null)} />}
          settingsMenu={menu === 'settings' && <SettingsMenu onClose={() => setMenu(null)} />}
          exportMenu={menu === 'export' && <ExportMenu boardId={currentBoardId} onClose={() => setMenu(null)} />}
          liveMenu={menu === 'live' && <LiveSessionPanel boardId={currentBoardId} />}
          saveStatus={<SaveStatusIndicator onOpenSettings={() => setMenu('settings')} />}
        />
      </header>
      <nav className="app-toolbar">
        <Toolbar
          activeTool={activeTool}
          onPickTool={(t) => setTool(activeTool === t ? null : t)}
          onOpenTrash={() => setTrashOpen(!trashOpen)}
          trashActive={trashOpen}
          onOpenHistory={() => setHistoryOpen(!historyOpen)}
          historyActive={historyOpen}
          onOpenPhotos={() => setPhotosOpen(true)}
        />
      </nav>
      <main
        className={'app-canvas' + (gridShown ? '' : ' no-grid')}
        data-board-bg={board.background ?? ''}
      >
        <Canvas boardId={currentBoardId} />
        <UnsortedTray boardId={currentBoardId} />
        {trashOpen && <TrashView />}
        {historyOpen && <HistoryPanel />}
      </main>
      {searchOpen && <SearchPanel />}
      {templatesOpen && (
        <TemplateGallery boardId={currentBoardId} onClose={() => setTemplatesOpen(false)} />
      )}
      {captureOpen && (
        <CaptureModal rootId={rootId} onClose={() => useUi.getState().setCaptureOpen(false)} />
      )}
      {photosOpen && (
        <PexelsPanel boardId={currentBoardId} onClose={() => setPhotosOpen(false)} />
      )}
      {presentationMode && <PresentMode boardId={currentBoardId} />}
      {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
    </div>
  )
}
