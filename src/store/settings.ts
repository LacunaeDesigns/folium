import { AtlasDb, getSetting, setSetting } from './persist'

export type AppTheme = 'light' | 'dark' | 'system'

let userName = 'You'
// Pexels API key — kept in local IndexedDB only, never part of the exported workspace
let pexelsKey = ''
// App-wide appearance, independent of per-board themes
let appTheme: AppTheme = 'light'
// global default for the canvas dot grid; per-board overrides live on Board.gridHidden
let showGrid = true

export function getUserName(): string {
  return userName
}

export function getPexelsKey(): string {
  return pexelsKey
}

export function getAppTheme(): AppTheme {
  return appTheme
}

export function getShowGrid(): boolean {
  return showGrid
}

export async function loadSettings(db: AtlasDb): Promise<void> {
  userName = await getSetting(db, 'userName', 'You')
  pexelsKey = await getSetting(db, 'pexelsApiKey', '')
  appTheme = await getSetting(db, 'appTheme', 'light')
  showGrid = await getSetting(db, 'showGrid', true)
}

export async function saveAppTheme(db: AtlasDb, theme: AppTheme): Promise<void> {
  appTheme = theme
  await setSetting(db, 'appTheme', theme)
}

export async function saveShowGrid(db: AtlasDb, show: boolean): Promise<void> {
  showGrid = show
  await setSetting(db, 'showGrid', show)
}

export async function saveUserName(db: AtlasDb, name: string): Promise<void> {
  userName = name.trim() || 'You'
  await setSetting(db, 'userName', userName)
}

export async function savePexelsKey(db: AtlasDb, key: string): Promise<void> {
  pexelsKey = key.trim()
  await setSetting(db, 'pexelsApiKey', pexelsKey)
}
