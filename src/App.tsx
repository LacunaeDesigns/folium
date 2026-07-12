import React from 'react'
import { TopBar } from './ui/TopBar'
import { Toolbar, ToolId } from './ui/Toolbar'

export default function App() {
  const [activeTool, setActiveTool] = React.useState<ToolId | null>(null)
  const [title, setTitle] = React.useState('Home')

  return (
    <div className="app-shell">
      <header className="app-header">
        <TopBar
          crumbs={[{ id: 'home', title: 'Home' }]}
          title={title}
          onNavigate={() => {}}
          onTitleChange={setTitle}
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
