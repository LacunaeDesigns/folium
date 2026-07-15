import React from 'react'
import { useFoliumStore } from '../store/context'
import { collectClip } from '../store/store'
import { setClipboard } from '../store/clipboard'
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

function isEditableField(el: Element): boolean {
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return true
  // checking the attribute directly (rather than the .isContentEditable IDL
  // property) works the same in real browsers, since ProseMirror's `dom.
  // contentEditable = "true"` assignment reflects to the attribute there —
  // but unlike .isContentEditable, it's also supported by jsdom in tests
  return el.getAttribute('contenteditable') === 'true'
}

/** True if `el` has actual highlighted text, not just a collapsed cursor.
 *  A note's rich-text body is a contentEditable div, not an input/textarea —
 *  it has no .selectionStart/.selectionEnd at all (those only exist on
 *  HTMLInputElement/HTMLTextAreaElement), so a highlighted selection inside
 *  it has to be read from window.getSelection() instead. */
function hasHighlightedText(el: Element): boolean {
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    const field = el as HTMLInputElement | HTMLTextAreaElement
    return typeof field.selectionStart === 'number' && field.selectionStart !== field.selectionEnd
  }
  const sel = window.getSelection()
  return !!sel && !sel.isCollapsed && sel.rangeCount > 0
}

/** What Ctrl+C/X should act on, given the currently focused element.
 *  A plain click into a card's own form field (e.g. a column title) never
 *  changes ui.selection by design — otherwise merely clicking to type would
 *  reselect the card. That means Ctrl+C right after such a click had nothing
 *  valid to copy: either ui.selection was empty/stale, or the blanket
 *  isTyping() guard blocked the shortcut outright. Falls back to the card
 *  the focused field belongs to, unless the field actually has text selected
 *  (highlighted) — in which case the browser's own native text copy should
 *  win, signalled by returning []. */
export function resolveCopyTargetIds(activeEl: Element | null, selection: string[]): string[] {
  if (!activeEl || !isEditableField(activeEl)) return selection
  if (hasHighlightedText(activeEl)) return []

  const cardId = (activeEl as HTMLElement).closest('[data-card-id]')?.getAttribute('data-card-id')
  return cardId ? [cardId] : []
}

export function useShortcuts() {
  const store = useFoliumStore()

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
      // copy / cut selected cards to the in-app clipboard (paste is handled by
      // the canvas 'paste' listener so files/URLs keep working too) — handled
      // ahead of the blanket isTyping() gate below, since resolveCopyTargetIds
      // already accounts for being focused in a card's own form field (e.g. a
      // column title, which never changes ui.selection on a plain click)
      if (mod && e.key.toLowerCase() === 'c') {
        const ids = resolveCopyTargetIds(document.activeElement, ui.selection)
        if (ids.length === 0) {
          // deferring to native text copy — clear any earlier card clipboard
          // so a later paste doesn't resurrect a stale card instead of the
          // plain text the user just copied
          setClipboard(null)
          return
        }
        e.preventDefault()
        setClipboard(collectClip(store.getState(), ids))
        return
      }
      if (mod && e.key.toLowerCase() === 'x') {
        const ids = resolveCopyTargetIds(document.activeElement, ui.selection)
        if (ids.length === 0) {
          setClipboard(null)
          return
        }
        e.preventDefault()
        setClipboard(collectClip(store.getState(), ids))
        store.getState().trashCards(ids)
        ui.clearSelection()
        return
      }

      if (isTyping()) return

      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.repeat) {
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
      // Shift+1: fit board, Shift+2: zoom to selection (Figma muscle memory)
      if (e.shiftKey && !mod && (e.key === '1' || e.key === '!')) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('folium:view', { detail: { op: 'fit' } }))
        return
      }
      if (e.shiftKey && !mod && (e.key === '2' || e.key === '@')) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('folium:view', { detail: { op: 'fit-selection' } }))
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
