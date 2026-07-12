import React from 'react'
import { TopBar } from './ui/TopBar'
import { Toolbar, ToolId } from './ui/Toolbar'
import { useAtlas } from './store/context'
import { breadcrumbs } from './store/selectors'

export default function App() {
  const [activeTool, setActiveTool] = React.useState<ToolId | null>(null)
  const rootId = useAtlas((s) => s.rootId)
  const [currentBoardId, setCurrentBoardId] = React.useState(rootId)
  const board = useAtlas((s) => s.boards[currentBoardId])
  const crumbs = useAtlas((s) => breadcrumbs(s, currentBoardId))
  const renameBoard = useAtlas((s) => s.renameBoard)

  // fall back to root if the current board disappears (e.g. deleted)
  React.useEffect(() => {
    if (!board) setCurrentBoardId(rootId)
  }, [board, rootId])

  if (!board) return null

  return (
    <div className="app-shell" data-board-theme={board.theme}>
      <header className="app-header">
        <TopBar
          crumbs={crumbs.map((b) => ({ id: b.id, title: b.title, color: b.color }))}
          title={board.title}
          onNavigate={setCurrentBoardId}
          onTitleChange={(t) => renameBoard(currentBoardId, t)}
          onSearch={() => {}}
          onExport={() => {}}
          onView={() => {}}
          onSettings={() => {}}
        />
      </header>
      <nav className="app-toolbar">
        <Toolbar
          activeTool={activeTool}
          onPickTool={(t) => setActiveTool((cur) => (cur === t ? null : t))}
          onOpenTrash={() => {}}
          trashActive={false}
        />
      </nav>
      <main className="app-canvas" />
    </div>
  )
}
