/** Perceived-luminance check so text stays readable on arbitrary card colors. */
export function isLight(hex: string): boolean {
  const m = hex.replace('#', '')
  if (m.length < 6) return true
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b > 150
}

export function isHexColor(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v)
}
