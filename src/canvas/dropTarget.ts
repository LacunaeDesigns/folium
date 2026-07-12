export type CardDrop =
  | { kind: 'column'; colId: string; index: number }
  | { kind: 'unsorted' }
  | null

/** DOM hit-testing for card drops onto columns / the unsorted tray (zoom-proof). */
export function resolveCardDrop(clientX: number, clientY: number, excludeIds: string[]): CardDrop {
  const stack = document.elementsFromPoint(clientX, clientY) as HTMLElement[]
  for (const el of stack) {
    if (el.classList?.contains('unsorted-tray') || el.closest?.('.unsorted-tray')) {
      return { kind: 'unsorted' }
    }
    const colEl = (el.closest?.('[data-type="column"]') as HTMLElement | null) ?? null
    if (colEl) {
      const colId = colEl.getAttribute('data-card-id')!
      if (excludeIds.includes(colId)) continue
      const members = [...colEl.querySelectorAll<HTMLElement>('[data-col-member]')].filter(
        (m) => !excludeIds.includes(m.getAttribute('data-col-member')!),
      )
      let index = 0
      for (const m of members) {
        const r = m.getBoundingClientRect()
        if (clientY > r.top + r.height / 2) index++
      }
      return { kind: 'column', colId, index }
    }
  }
  return null
}
