import React from 'react'
import { useUi } from '../store/uiStore'

/** Double-click-to-edit gate; editing ends when the card leaves the selection. */
export function useEditing(cardId: string): [boolean, (v: boolean) => void] {
  const [editing, setEditing] = React.useState(false)
  const isSelected = useUi((s) => s.selection.includes(cardId))

  React.useEffect(() => {
    if (!isSelected) setEditing(false)
  }, [isSelected])

  return [editing, setEditing]
}

/** Debounced content commit helper (keeps undo history in readable chunks). */
export function useDebouncedCommit(fn: (v: unknown) => void, delay = 350) {
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = React.useRef(fn)
  const pending = React.useRef<unknown>(undefined)
  latest.current = fn
  // flush (not drop) an in-flight commit on unmount — otherwise the last
  // keystrokes vanish when the user switches boards mid-debounce
  React.useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
      latest.current(pending.current)
    }
  }, [])
  return React.useCallback(
    (v: unknown) => {
      pending.current = v
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        timer.current = null
        latest.current(v)
      }, delay)
    },
    [delay],
  )
}
