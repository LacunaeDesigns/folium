import React from 'react'
import { useAtlasStore, useDb } from '../store/context'
import { collectBoardExport, downloadFile, safeFilename } from '../export/collect'
import { buildHtmlExport } from '../export/html'
import { boardToMarkdown } from '../export/markdown'
import { exportBackup, importBackup } from '../export/json'
import { getUserName } from '../store/settings'
import { VIEWER_LIVE_JS } from '../live/viewerScript'
import peerjsRaw from 'peerjs/dist/peerjs.min.js?raw'
import { importMarkdownBoard } from '../import/importBoard'
import { useUi } from '../store/uiStore'
import { Icon } from './Icons'

export function ExportMenu({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const store = useAtlasStore()
  const db = useDb()
  const importRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState<string | null>(null)

  const docState = () => {
    const s = store.getState()
    return { rootId: s.rootId, boards: s.boards, cards: s.cards, lines: s.lines }
  }
  const boardTitle = () => store.getState().boards[boardId]?.title ?? 'board'

  const exportHtml = async (autoPrint: boolean) => {
    setBusy(autoPrint ? 'print' : 'html')
    try {
      const bundle = await collectBoardExport(docState(), boardId, db)
      const liveLayer = peerjsRaw + '\n' + VIEWER_LIVE_JS
      const html = buildHtmlExport(
        bundle,
        autoPrint ? 'setTimeout(function(){window.print()},500);' : liveLayer,
      )
      if (autoPrint) {
        const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
        window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      } else {
        downloadFile(safeFilename(boardTitle()) + '.html', html, 'text/html')
      }
    } finally {
      setBusy(null)
      onClose()
    }
  }

  const exportMd = () => {
    const md = boardToMarkdown(docState(), boardId)
    downloadFile(safeFilename(boardTitle()) + '.md', md, 'text/markdown')
    onClose()
  }

  const backup = async () => {
    setBusy('backup')
    try {
      const json = await exportBackup(db, docState(), getUserName())
      downloadFile('folium-backup-' + new Date().toISOString().slice(0, 10) + '.json', json, 'application/json')
    } finally {
      setBusy(null)
      onClose()
    }
  }

  const mdRef = React.useRef<HTMLInputElement>(null)

  const onImportMarkdown = async (files: FileList) => {
    let lastBoard: string | null = null
    let i = 0
    for (const file of Array.from(files)) {
      const text = await file.text()
      lastBoard = importMarkdownBoard(store, boardId, file.name, text, { x: 80 + i * 40, y: 80 + i * 40 })
      i++
    }
    onClose()
    if (lastBoard && files.length === 1) useUi.getState().setBoard(lastBoard)
  }

  const onImportFile = async (file: File) => {
    const text = await file.text()
    try {
      if (!confirm('Importing a backup REPLACES all current boards, cards and files. Continue?')) return
      await importBackup(db, store, text)
      useLocationReload()
    } catch (err) {
      alert('Import failed: ' + (err as Error).message)
    }
  }

  return (
    <div className="menu-pop topbar-menu" onPointerDown={(e) => e.stopPropagation()}>
      <button className="menu-item" disabled={!!busy} onClick={() => void exportHtml(false)}>
        <Icon name="broadcast" size={15} /> {busy === 'html' ? 'Exporting…' : 'Share as HTML file'}
      </button>
      <button className="menu-item" onClick={exportMd}>
        <Icon name="note" size={15} /> Export as Markdown
      </button>
      <button className="menu-item" disabled={!!busy} onClick={() => void exportHtml(true)}>
        <Icon name="export" size={15} /> Print / PDF
      </button>
      <div className="menu-sep" />
      <button className="menu-item" disabled={!!busy} onClick={() => void backup()}>
        <Icon name="download" size={15} /> {busy === 'backup' ? 'Backing up…' : 'Back up all data (JSON)'}
      </button>
      <button className="menu-item" onClick={() => importRef.current?.click()}>
        <Icon name="upload" size={15} /> Import backup…
      </button>
      <button className="menu-item" onClick={() => mdRef.current?.click()}>
        <Icon name="template" size={15} /> Import Markdown… (Milanote)
      </button>
      <input
        ref={mdRef}
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void onImportMarkdown(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={importRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onImportFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function useLocationReload() {
  location.hash = ''
  location.reload()
}
