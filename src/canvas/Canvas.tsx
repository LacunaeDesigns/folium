import React from 'react'
import { CardType } from '../model/types'
import { useAtlas, useAtlasStore, useDb } from '../store/context'
import { putBlob } from '../store/persist'
import { boardCards } from '../store/selectors'
import { DEFAULT_VIEW, useUi } from '../store/uiStore'
import { ToolId } from '../ui/Toolbar'
import { CardShell, DragState } from './CardShell'
import { Icon } from '../ui/Icons'
import { normRect, Rect, rectsIntersect, screenToWorld, zoomAt, clampZoom, Pt, safeCapture } from './coords'
import './canvas.css'

interface CtxMenu {
  x: number
  y: number
  cardId: string
}

export function Canvas({ boardId }: { boardId: string }) {
  const store = useAtlasStore()
  const db = useDb()
  const cards = useAtlas((s) => boardCards(s, boardId))
  const view = useUi((s) => s.views[boardId] ?? DEFAULT_VIEW)
  const setView = useUi((s) => s.setView)
  const activeTool = useUi((s) => s.activeTool)
  const setTool = useUi((s) => s.setTool)

  const viewportRef = React.useRef<HTMLDivElement>(null)
  const [drag, setDrag] = React.useState<DragState | null>(null)
  const [marquee, setMarquee] = React.useState<Rect | null>(null)
  const [ctxMenu, setCtxMenu] = React.useState<CtxMenu | null>(null)
  const [spaceDown, setSpaceDown] = React.useState(false)

  const panGesture = React.useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)
  const marqueeGesture = React.useRef<{ startX: number; startY: number } | null>(null)
  // ref mirror of `marquee` — pointer events can all land between renders
  const marqueeRect = React.useRef<Rect | null>(null)

  // space key for panning
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, [contenteditable="true"]')) return
      e.preventDefault()
      setSpaceDown(true)
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const clientToLocal = (clientX: number, clientY: number): Pt => {
    const r = viewportRef.current!.getBoundingClientRect()
    return { x: clientX - r.left, y: clientY - r.top }
  }

  const importFiles = React.useCallback(
    async (files: FileList | File[], world: Pt) => {
      const s = store.getState()
      const newIds: string[] = []
      let i = 0
      for (const file of Array.from(files)) {
        const blobId = await putBlob(db, file)
        const at = { x: world.x + i * 26, y: world.y + i * 26 }
        if (file.type.startsWith('image/')) {
          newIds.push(
            s.addCard(boardId, 'image', { ...at, content: { blobId } as never }),
          )
        } else {
          newIds.push(
            s.addCard(boardId, 'file', {
              ...at,
              content: { blobId, name: file.name, size: file.size, mime: file.type } as never,
            }),
          )
        }
        i++
      }
      if (newIds.length) useUi.getState().setSelection(newIds)
    },
    [boardId, db, store],
  )

  const uploadRef = React.useRef<HTMLInputElement>(null)

  // paste: files -> image/file cards, URLs -> link card
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      const vp = viewportRef.current
      if (!vp) return
      const center = screenToWorld(
        useUi.getState().views[boardId] ?? DEFAULT_VIEW,
        vp.clientWidth / 2,
        vp.clientHeight / 2,
      )
      if (e.clipboardData?.files.length) {
        e.preventDefault()
        void importFiles(e.clipboardData.files, center)
        return
      }
      const text = e.clipboardData?.getData('text')?.trim()
      if (text && /^https?:\/\/\S+$/i.test(text)) {
        e.preventDefault()
        const id = store.getState().addCard(boardId, 'link', {
          x: center.x,
          y: center.y,
          content: { url: text, title: '' } as never,
        })
        useUi.getState().setSelection([id])
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [boardId, importFiles, store])

  const placeAt = (tool: ToolId, world: Pt) => {
    const s = store.getState()
    let newId: string | null = null
    if (tool === 'board') {
      const { cardId } = s.createBoard(boardId, 'Untitled', { x: world.x, y: world.y })
      newId = cardId
    } else if (tool === 'upload') {
      uploadRef.current?.click()
      return
    } else if (tool === 'line' || tool === 'draw') {
      // handled by dedicated modes (phase 6)
      return
    } else {
      const typeMap: Partial<Record<ToolId, CardType>> = {
        note: 'note',
        link: 'link',
        todo: 'todo',
        column: 'column',
        comment: 'comment',
        table: 'table',
        swatch: 'swatch',
        sticky: 'sticky',
        shape: 'shape',
        image: 'image',
      }
      const type = typeMap[tool]
      if (!type) return
      newId = s.addCard(boardId, type, { x: world.x, y: world.y })
    }
    if (newId) useUi.getState().setSelection([newId])
  }

  const onPointerDown = (e: React.PointerEvent) => {
    setCtxMenu(null)
    const isPan = e.button === 1 || (e.button === 0 && spaceDown)
    if (isPan) {
      e.preventDefault()
      ;safeCapture(e.currentTarget as HTMLElement, e.pointerId)
      panGesture.current = { startX: e.clientX, startY: e.clientY, panX: view.pan.x, panY: view.pan.y }
      return
    }
    if (e.button !== 0) return
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains('canvas-world')) return

    const local = clientToLocal(e.clientX, e.clientY)
    if (activeTool) {
      const world = screenToWorld(view, local.x, local.y)
      placeAt(activeTool, world)
      if (!e.shiftKey) setTool(null)
      return
    }
    ;safeCapture(e.currentTarget as HTMLElement, e.pointerId)
    marqueeGesture.current = { startX: local.x, startY: local.y }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (panGesture.current) {
      const g = panGesture.current
      setView(boardId, {
        zoom: view.zoom,
        pan: { x: g.panX + (e.clientX - g.startX), y: g.panY + (e.clientY - g.startY) },
      })
      return
    }
    if (marqueeGesture.current) {
      const g = marqueeGesture.current
      const local = clientToLocal(e.clientX, e.clientY)
      const rect = normRect(g.startX, g.startY, local.x, local.y)
      marqueeRect.current = rect
      setMarquee(rect)
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (panGesture.current) {
      panGesture.current = null
      return
    }
    if (marqueeGesture.current) {
      marqueeGesture.current = null
      const rect = marqueeRect.current
      marqueeRect.current = null
      if (rect && (rect.w > 4 || rect.h > 4)) {
        const a = screenToWorld(view, rect.x, rect.y)
        const b = screenToWorld(view, rect.x + rect.w, rect.y + rect.h)
        const worldRect: Rect = { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }
        const hit = cards
          .filter((c) =>
            rectsIntersect(worldRect, { x: c.x, y: c.y, w: c.w, h: c.h ?? 80 }),
          )
          .map((c) => c.id)
        useUi.getState().setSelection(hit)
      } else {
        useUi.getState().clearSelection()
      }
      setMarquee(null)
    }
  }

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const local = clientToLocal(e.clientX, e.clientY)
      const factor = Math.exp(-e.deltaY * 0.0015)
      setView(boardId, zoomAt(view, local.x, local.y, view.zoom * factor))
    } else {
      const dx = e.shiftKey ? e.deltaY : e.deltaX
      const dy = e.shiftKey ? 0 : e.deltaY
      setView(boardId, { zoom: view.zoom, pan: { x: view.pan.x - dx, y: view.pan.y - dy } })
    }
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains('canvas-world')) return
    const local = clientToLocal(e.clientX, e.clientY)
    const world = screenToWorld(view, local.x, local.y)
    const id = store.getState().addCard(boardId, 'note', { x: world.x, y: world.y })
    useUi.getState().setSelection([id])
  }

  const onDrop = (e: React.DragEvent) => {
    const local = clientToLocal(e.clientX, e.clientY)
    const world = screenToWorld(view, local.x, local.y)
    if (e.dataTransfer.files.length) {
      e.preventDefault()
      void importFiles(e.dataTransfer.files, world)
      return
    }
    const tool = e.dataTransfer.getData('application/x-atlasnote-tool') as ToolId
    if (!tool) return
    e.preventDefault()
    placeAt(tool, world)
  }

  const zoomStep = (dir: 1 | -1) => {
    const el = viewportRef.current!
    setView(boardId, zoomAt(view, el.clientWidth / 2, el.clientHeight / 2, clampZoom(view.zoom * (dir > 0 ? 1.2 : 1 / 1.2))))
  }

  const fitToContent = () => {
    if (cards.length === 0) {
      setView(boardId, DEFAULT_VIEW)
      return
    }
    const el = viewportRef.current!
    const minX = Math.min(...cards.map((c) => c.x)) - 60
    const minY = Math.min(...cards.map((c) => c.y)) - 60
    const maxX = Math.max(...cards.map((c) => c.x + c.w)) + 60
    const maxY = Math.max(...cards.map((c) => c.y + (c.h ?? 160))) + 60
    const zoom = clampZoom(Math.min(el.clientWidth / (maxX - minX), el.clientHeight / (maxY - minY), 1))
    setView(boardId, {
      zoom,
      pan: {
        x: (el.clientWidth - (maxX - minX) * zoom) / 2 - minX * zoom,
        y: (el.clientHeight - (maxY - minY) * zoom) / 2 - minY * zoom,
      },
    })
  }

  const menuAction = (fn: () => void) => () => {
    fn()
    setCtxMenu(null)
  }

  return (
    <div
      ref={viewportRef}
      className={'canvas-viewport' + (spaceDown ? ' panning' : '') + (activeTool ? ' placing' : '')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
      onDragOver={(e) => {
        if (
          e.dataTransfer.types.includes('application/x-atlasnote-tool') ||
          e.dataTransfer.types.includes('Files')
        )
          e.preventDefault()
      }}
      onDrop={onDrop}
    >
      <div
        className="canvas-world"
        style={{ transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})` }}
      >
        {cards.map((card) => (
          <CardShell
            key={card.id}
            card={card}
            zoom={view.zoom}
            drag={drag}
            setDrag={setDrag}
            onContextMenu={(cardId, x, y) => setCtxMenu({ cardId, x, y })}
          />
        ))}
      </div>

      {marquee && (
        <div
          className="marquee"
          style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
        />
      )}

      {ctxMenu && (
        <div
          className="menu-pop"
          style={{ left: ctxMenu.x - (viewportRef.current?.getBoundingClientRect().left ?? 0), top: ctxMenu.y - (viewportRef.current?.getBoundingClientRect().top ?? 0) }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            className="menu-item"
            onClick={menuAction(() => {
              const ids = store.getState().duplicateCards(useUi.getState().selection)
              useUi.getState().setSelection(ids)
            })}
          >
            <Icon name="duplicate" size={15} /> Duplicate
          </button>
          <button
            className="menu-item"
            onClick={menuAction(() => store.getState().bringToFront(ctxMenu.cardId))}
          >
            <Icon name="fit" size={15} /> Bring to front
          </button>
          <div className="menu-sep" />
          <button
            className="menu-item danger"
            onClick={menuAction(() => {
              store.getState().trashCards(useUi.getState().selection)
              useUi.getState().clearSelection()
            })}
          >
            <Icon name="trash" size={15} /> Delete
          </button>
        </div>
      )}

      <input
        ref={uploadRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (!e.target.files?.length) return
          const vp = viewportRef.current!
          const center = screenToWorld(view, vp.clientWidth / 2, vp.clientHeight / 2)
          void importFiles(e.target.files, center)
          e.target.value = ''
        }}
      />

      <div className="zoom-pill">
        <button onClick={() => zoomStep(-1)} title="Zoom out">
          <Icon name="zoom-out" size={15} />
        </button>
        <button
          className="zoom-value"
          onClick={() => setView(boardId, { zoom: 1, pan: view.pan })}
          title="Reset zoom"
        >
          {Math.round(view.zoom * 100)}%
        </button>
        <button onClick={() => zoomStep(1)} title="Zoom in">
          <Icon name="zoom-in" size={15} />
        </button>
        <button onClick={fitToContent} title="Fit to content">
          <Icon name="fit" size={15} />
        </button>
      </div>
    </div>
  )
}
