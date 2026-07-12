import { AtlasDb, getSetting, setSetting } from './persist'

let userName = 'You'

export function getUserName(): string {
  return userName
}

export async function loadSettings(db: AtlasDb): Promise<void> {
  userName = await getSetting(db, 'userName', 'You')
}

export async function saveUserName(db: AtlasDb, name: string): Promise<void> {
  userName = name.trim() || 'You'
  await setSetting(db, 'userName', userName)
}
