import React from 'react'
import { TopBar } from './ui/TopBar'
import { Toolbar } from './ui/Toolbar'
import { Canvas } from './canvas/Canvas'
import { useAtlas, useAtlasStore } from './store/context'
import { breadcrumbs } from './store/selectors'
import { useUi } from './store/uiStore'
import { useShortcuts } from './canvas/useShortcuts'
import './cards'

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
          onExport={() => {}}
          onView={() => {}}
          onSettings={() => {}}
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
      </main>
    </div>
  )
}
