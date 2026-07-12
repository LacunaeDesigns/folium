import React from 'react'
import { useAtlasStore } from '../store/context'
import { boardCards } from '../store/selectors'
import { useUi } from '../store/uiStore'

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.isContentEditable
  )
}

export function useShortcuts() {
  const store = useAtlasStore()

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUi.getState()
      const mod = e.ctrlKey || e.metaKey

      if (mod && e.key.toLowerCase() === 'z') {
        if (isTyping()) return
        e.preventDefault()
        if (e.shiftKey) store.temporal.getState().redo()
        else store.temporal.getState().undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        if (isTyping()) return
        e.preventDefault()
        store.temporal.getState().redo()
        return
      }
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        ui.setSearchOpen(!ui.searchOpen)
        return
      }

      if (isTyping()) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (ui.selectedLine) {
          e.preventDefault()
          store.getState().deleteLine(ui.selectedLine)
          ui.setSelectedLine(null)
          return
        }
        if (ui.selection.length === 0) return
        e.preventDefault()
        store.getState().trashCards(ui.selection)
        ui.clearSelection()
        return
      }
      if (mod && e.key.toLowerCase() === 'd') {
        if (ui.selection.length === 0) return
        e.preventDefault()
        const ids = store.getState().duplicateCards(ui.selection)
        ui.setSelection(ids)
        return
      }
      if (mod && e.key.toLowerCase() === 'a') {
        if (!ui.currentBoardId) return
        e.preventDefault()
        ui.setSelection(boardCards(store.getState(), ui.currentBoardId).map((c) => c.id))
        return
      }
      if (e.key === 'Escape') {
        ui.clearSelection()
        ui.setTool(null)
        ui.setSearchOpen(false)
        ui.setTrashOpen(false)
        return
      }
      if (e.key.startsWith('Arrow')) {
        if (ui.selection.length === 0) return
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        store.getState().moveCards(ui.selection, dx, dy)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [store])
}
