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
  latest.current = fn
  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  return React.useCallback(
    (v: unknown) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => latest.current(v), delay)
    },
    [delay],
  )
}
