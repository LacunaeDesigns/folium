import React from 'react'
import { TopBar } from './ui/TopBar'
import { Toolbar } from './ui/Toolbar'
import { Canvas } from './canvas/Canvas'
import { UnsortedTray } from './ui/UnsortedTray'
import { TrashView } from './ui/TrashView'
import { SearchPanel } from './ui/SearchPanel'
import { TemplateGallery } from './ui/TemplateGallery'
import { useAtlas, useAtlasStore, useDb } from './store/context'
import { breadcrumbs } from './store/selectors'
import { saveUserName, getUserName } from './store/settings'
import { useUi } from './store/uiStore'
import { useShortcuts } from './canvas/useShortcuts'
import { Icon } from './ui/Icons'
import './cards'

function ViewMenu({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const store = useAtlasStore()
  const theme = useAtlas((s) => s.boards[boardId]?.theme)
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
      <div className="menu-sep" />
      <button
        className="menu-item"
        onClick={() => {
          store.getState().setBoardMeta(boardId, { theme: theme === 'dark' ? 'light' : 'dark' })
          onClose()
        }}
      >
        <Icon name="palette" size={15} /> {theme === 'dark' ? 'Light board' : 'Dark board'}
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

function SettingsMenu({ onClose }: { onClose: () => void }) {
  const db = useDb()
  const [name, setName] = React.useState(getUserName())
  return (
    <div className="menu-pop topbar-menu settings-pop" onPointerDown={(e) => e.stopPropagation()}>
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
  const [menu, setMenu] = React.useState<'view' | 'settings' | 'export' | null>(null)
  const [templatesOpen, setTemplatesOpen] = React.useState(false)

  useShortcuts()

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

  return (
    <div className="app-shell" data-board-theme={board.theme}>
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
          rightExtra={
            <span className="menu-anchor">
              {menu === 'view' && <ViewMenu boardId={currentBoardId} onClose={() => setMenu(null)} />}
              {menu === 'settings' && <SettingsMenu onClose={() => setMenu(null)} />}
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
        />
      </nav>
      <main className="app-canvas">
        <Canvas boardId={currentBoardId} />
        <UnsortedTray boardId={currentBoardId} />
        {trashOpen && <TrashView />}
      </main>
      {searchOpen && <SearchPanel />}
      {templatesOpen && (
        <TemplateGallery boardId={currentBoardId} onClose={() => setTemplatesOpen(false)} />
      )}
    </div>
  )
}
