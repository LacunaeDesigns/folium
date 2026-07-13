import React from 'react'
import { CardType, LineEnd } from '../model/types'
import { LinesLayer } from './LinesLayer'
import { InkLayer } from './InkLayer'
import { useAtlas, useAtlasStore, useDb } from '../store/context'
import { putBlob, getBlob } from '../store/persist'
import { collectClip } from '../store/store'
import { getClipboard, setClipboard, hasClipboard } from '../store/clipboard'
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
  /** null = right-clicked empty canvas (board menu) */
  cardId: string | null
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
  const [pendingLineFrom, setPendingLineFrom] = React.useState<LineEnd | null>(null)
  const [cursorWorld, setCursorWorld] = React.useState<Pt | null>(null)

  // reset in-progress line when the tool changes
  React.useEffect(() => {
    if (activeTool !== 'line') setPendingLineFrom(null)
  }, [activeTool])

  const completeLine = (to: LineEnd) => {
    if (!pendingLineFrom) return
    const id = store.getState().addLine(boardId, pendingLineFrom, to)
    setPendingLineFrom(null)
    setTool(null)
    useUi.getState().setSelectedLine(id)
  }

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
        // markdown files import as whole boards
        if (/\.(md|markdown)$/i.test(file.name)) {
          const { importMarkdownBoard } = await import('../import/importBoard')
          const text = await file.text()
          importMarkdownBoard(store, boardId, file.name, text, {
            x: world.x + i * 26,
            y: world.y + i * 26,
          })
          i++
          continue
        }
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

  // Add-image / Upload toolbar buttons open the OS file picker immediately.
  // Dispatched synchronously from the button click so the .click() stays inside
  // the browser's user-activation window (a useEffect would lose it and be blocked).
  React.useEffect(() => {
    const onPick = (e: Event) => {
      const input = uploadRef.current
      if (!input) return
      input.accept = (e as CustomEvent).detail?.accept ?? ''
      input.click()
    }
    window.addEventListener('folium:pick-files', onPick)
    return () => window.removeEventListener('folium:pick-files', onPick)
  }, [])

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
      // in-app card clipboard takes precedence over stale OS text
      if (hasClipboard()) {
        e.preventDefault()
        const ids = store.getState().pasteClip(getClipboard()!, boardId, center)
        if (ids.length) useUi.getState().setSelection(ids)
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
    if (activeTool === 'line') {
      const world = screenToWorld(view, local.x, local.y)
      if (!pendingLineFrom) setPendingLineFrom({ x: world.x, y: world.y })
      else completeLine({ x: world.x, y: world.y })
      return
    }
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
    if (pendingLineFrom) {
      const local = clientToLocal(e.clientX, e.clientY)
      setCursorWorld(screenToWorld(view, local.x, local.y))
    }
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

  const onWheel = (e: WheelEvent) => {
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
  const onWheelRef = React.useRef(onWheel)
  onWheelRef.current = onWheel

  // native non-passive listener — React's synthetic wheel can't preventDefault the
  // browser's ctrl+wheel page zoom, so zooming the board also zoomed Chrome itself
  React.useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const h = (e: WheelEvent) => onWheelRef.current(e)
    el.addEventListener('wheel', h, { passive: false })
    return () => el.removeEventListener('wheel', h)
  }, [])

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

  // View-menu commands from the top bar
  React.useEffect(() => {
    const onView = (e: Event) => {
      const op = (e as CustomEvent<{ op: string }>).detail.op
      if (op === 'zoom-in') zoomStep(1)
      else if (op === 'zoom-out') zoomStep(-1)
      else if (op === 'zoom-reset') setView(boardId, { zoom: 1, pan: view.pan })
      else if (op === 'fit') fitToContent()
    }
    window.addEventListener('atlas:view', onView)
    return () => window.removeEventListener('atlas:view', onView)
  })

  const menuAction = (fn: () => void) => () => {
    fn()
    setCtxMenu(null)
  }

  // world point where the context menu was opened (for "New <card>" placement)
  const menuWorld = (): Pt => {
    if (!ctxMenu) return { x: 0, y: 0 }
    const local = clientToLocal(ctxMenu.x, ctxMenu.y)
    return screenToWorld(view, local.x, local.y)
  }

  const createAt = (type: CardType) => {
    const world = menuWorld()
    const id =
      type === 'board'
        ? store.getState().createBoard(boardId, 'Untitled', world).cardId
        : store.getState().addCard(boardId, type, { x: world.x, y: world.y })
    useUi.getState().setSelection([id])
  }

  const copySelection = () =>
    setClipboard(collectClip(store.getState(), useUi.getState().selection))
  const cutSelection = () => {
    const sel = useUi.getState().selection
    setClipboard(collectClip(store.getState(), sel))
    store.getState().trashCards(sel)
    useUi.getState().clearSelection()
  }
  const pasteAtMenu = () => {
    const clip = getClipboard()
    if (!clip) return
    const ids = store.getState().pasteClip(clip, boardId, menuWorld())
    if (ids.length) useUi.getState().setSelection(ids)
  }

  const focusColumnTitle = (cardId: string) => {
    requestAnimationFrame(() => {
      const el = viewportRef.current?.querySelector(
        `[data-card-id="${cardId}"] .column-title`,
      ) as HTMLInputElement | null
      el?.focus()
      el?.select()
    })
  }

  // image replace: pick a new file and swap the card's blob in place
  const replaceRef = React.useRef<HTMLInputElement>(null)
  const replaceTarget = React.useRef<string | null>(null)
  const replaceImage = (cardId: string) => {
    replaceTarget.current = cardId
    replaceRef.current?.click()
  }
  const downloadImage = async (cardId: string) => {
    const card = store.getState().cards[cardId]
    if (!card || card.content.kind !== 'image') return
    const { blobId, url } = card.content
    if (blobId) {
      const blob = await getBlob(db, blobId)
      if (!blob) return
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = 'image'
      a.click()
      URL.revokeObjectURL(href)
    } else if (url) {
      const a = document.createElement('a')
      a.href = url
      a.target = '_blank'
      a.rel = 'noopener'
      a.click()
    }
  }

  return (
    <div
      ref={viewportRef}
      className={'canvas-viewport' + (spaceDown ? ' panning' : '') + (activeTool ? ' placing' : '')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
      onDragOver={(e) => {
        if (
          e.dataTransfer.types.includes('application/x-atlasnote-tool') ||
          e.dataTransfer.types.includes('Files')
        )
          e.preventDefault()
      }}
      onDrop={onDrop}
      onContextMenu={(e) => {
        // board menu only when the empty canvas is right-clicked; cards open
        // their own menu via CardShell's pointerdown handler
        const t = e.target as HTMLElement
        if (t === viewportRef.current || t.classList.contains('canvas-world')) {
          e.preventDefault()
          setCtxMenu({ x: e.clientX, y: e.clientY, cardId: null })
        }
      }}
    >
      <div
        className="canvas-world"
        style={{ transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})` }}
      >
        <LinesLayer
          boardId={boardId}
          view={view}
          viewportEl={viewportRef.current}
          drag={drag}
          pendingFrom={pendingLineFrom}
          cursor={cursorWorld}
        />
        {cards.map((card) => (
          <CardShell
            key={card.id}
            card={card}
            zoom={view.zoom}
            drag={drag}
            setDrag={setDrag}
            onContextMenu={(cardId, x, y) => setCtxMenu({ cardId, x, y })}
            lineToolActive={activeTool === 'line'}
            onLineAnchor={(cardId) => {
              if (!pendingLineFrom) setPendingLineFrom({ cardId })
              else completeLine({ cardId })
            }}
          />
        ))}
      </div>

      {activeTool === 'draw' && (
        <InkLayer boardId={boardId} view={view} viewportEl={viewportRef.current} />
      )}

      {marquee && (
        <div
          className="marquee"
          style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
        />
      )}

      {ctxMenu && (() => {
        const cardId = ctxMenu.cardId
        const card = cardId ? store.getState().cards[cardId] : null
        const type = card?.type
        // clamp inside the viewport so the menu never spills off-screen / behind the board
        const vp = viewportRef.current
        const rect = vp?.getBoundingClientRect()
        const MENU_W = 200
        const MENU_H = cardId ? 300 : 340
        const PAD = 8
        const rawX = ctxMenu.x - (rect?.left ?? 0)
        const rawY = ctxMenu.y - (rect?.top ?? 0)
        const left = Math.max(PAD, Math.min(rawX, (vp?.clientWidth ?? 0) - MENU_W - PAD))
        const top = Math.max(PAD, Math.min(rawY, (vp?.clientHeight ?? 0) - MENU_H - PAD))
        const gap = <span style={{ display: 'inline-block', width: 15 }} />
        return (
        <div
          className="menu-pop"
          style={{ left, top }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {!cardId ? (
            <>
              <button
                className="menu-item"
                onClick={menuAction(() =>
                  useUi.getState().setSelection(boardCards(store.getState(), boardId).map((c) => c.id)),
                )}
              >
                {gap} Select all
              </button>
              {hasClipboard() && (
                <button className="menu-item" onClick={menuAction(pasteAtMenu)}>
                  {gap} Paste
                </button>
              )}
              <div className="menu-sep" />
              {([
                ['note', 'note'],
                ['link', 'link'],
                ['todo', 'to-do'],
              ] as const).map(([t, label]) => (
                <button key={t} className="menu-item" onClick={menuAction(() => createAt(t))}>
                  <Icon name={t} size={15} /> New {label}
                </button>
              ))}
              <button className="menu-item" onClick={menuAction(() => setTool('line'))}>
                <Icon name="line" size={15} /> New line
              </button>
              {([
                ['board', 'board'],
                ['column', 'column'],
                ['comment', 'comment'],
                ['table', 'table'],
              ] as const).map(([t, label]) => (
                <button key={t} className="menu-item" onClick={menuAction(() => createAt(t))}>
                  <Icon name={t} size={15} /> New {label}
                </button>
              ))}
            </>
          ) : (
            <>
              <button className="menu-item" onClick={menuAction(cutSelection)}>
                {gap} Cut
              </button>
              <button className="menu-item" onClick={menuAction(copySelection)}>
                {gap} Copy
              </button>
              <div className="menu-sep" />
              {type === 'image' && (
                <>
                  <button className="menu-item" onClick={menuAction(() => replaceImage(cardId))}>
                    <Icon name="image" size={15} /> Replace image
                  </button>
                  <button className="menu-item" onClick={menuAction(() => void downloadImage(cardId))}>
                    <Icon name="download" size={15} /> Download image
                  </button>
                  <div className="menu-sep" />
                </>
              )}
              {type === 'column' && (
                <>
                  <button className="menu-item" onClick={menuAction(() => focusColumnTitle(cardId))}>
                    {gap} Rename
                  </button>
                  <div className="menu-sep" />
                </>
              )}
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
                onClick={menuAction(() => store.getState().bringToFront(cardId))}
              >
                {gap} Bring to front
              </button>
              <button
                className="menu-item"
                onClick={menuAction(() => store.getState().sendToBack(cardId))}
              >
                {gap} Send to back
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
            </>
          )}
        </div>
        )
      })()}

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

      <input
        ref={replaceRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0]
          const cardId = replaceTarget.current
          e.target.value = ''
          replaceTarget.current = null
          if (!file || !cardId) return
          const blobId = await putBlob(db, file)
          store.getState().updateContent(cardId, { blobId, url: '', naturalW: 0, naturalH: 0 })
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
