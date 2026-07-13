import { AtlasDb, getSetting, setSetting } from './persist'

let userName = 'You'
// Pexels API key — kept in local IndexedDB only, never part of the exported workspace
let pexelsKey = ''
// App-wide appearance, independent of per-board themes
let appTheme: 'light' | 'dark' = 'light'

export function getUserName(): string {
  return userName
}

export function getPexelsKey(): string {
  return pexelsKey
}

export function getAppTheme(): 'light' | 'dark' {
  return appTheme
}

export async function loadSettings(db: AtlasDb): Promise<void> {
  userName = await getSetting(db, 'userName', 'You')
  pexelsKey = await getSetting(db, 'pexelsApiKey', '')
  appTheme = await getSetting(db, 'appTheme', 'light')
}

export async function saveAppTheme(db: AtlasDb, theme: 'light' | 'dark'): Promise<void> {
  appTheme = theme
  await setSetting(db, 'appTheme', theme)
}

export async function saveUserName(db: AtlasDb, name: string): Promise<void> {
  userName = name.trim() || 'You'
  await setSetting(db, 'userName', userName)
}

export async function savePexelsKey(db: AtlasDb, key: string): Promise<void> {
  pexelsKey = key.trim()
  await setSetting(db, 'pexelsApiKey', pexelsKey)
}
