/** DOM hit-testing for card drops onto columns (zoom-proof). */
export function resolveCardDrop(clientX: number, clientY: number, excludeIds: string[]) {
  const stack = document.elementsFromPoint(clientX, clientY) as HTMLElement[]
  for (const el of stack) {
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
      return { colId, index }
    }
  }
  return null
}
