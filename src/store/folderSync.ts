/**
 * Optional cross-machine sync: mirror the whole workspace into a folder the user
 * picks via the File System Access API. Point that folder at a cloud-synced
 * location (OneDrive/Dropbox/etc.) and boards travel between machines.
 *
 * This file holds the thin, testable FS layer + the pure merge decision.
 * The controller/boot wiring lives in sync.ts.
 */

export const WORKSPACE_FILE = 'folium-workspace.json'

// Some TS DOM libs don't type showDirectoryPicker / permission methods yet.
type PermState = 'granted' | 'denied' | 'prompt'
interface DirHandleExt extends FileSystemDirectoryHandle {
  queryPermission?(o: { mode: 'read' | 'readwrite' }): Promise<PermState>
  requestPermission?(o: { mode: 'read' | 'readwrite' }): Promise<PermState>
}

export const FS_SUPPORTED =
  typeof window !== 'undefined' && typeof (window as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'

/** Open the native folder picker. Must be called from a user gesture. */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  const picker = (window as unknown as {
    showDirectoryPicker(o?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>
  }).showDirectoryPicker
  return picker({ mode: 'readwrite' })
}

/** Ensure read/write permission on a (possibly persisted) handle. `prompt` allows a permission dialog. */
export async function ensurePermission(
  handle: FileSystemDirectoryHandle,
  prompt: boolean,
): Promise<boolean> {
  const h = handle as DirHandleExt
  const opts = { mode: 'readwrite' as const }
  if (h.queryPermission && (await h.queryPermission(opts)) === 'granted') return true
  if (prompt && h.requestPermission && (await h.requestPermission(opts)) === 'granted') return true
  return false
}

export async function writeWorkspace(dir: FileSystemDirectoryHandle, text: string): Promise<void> {
  const fileHandle = await dir.getFileHandle(WORKSPACE_FILE, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(text)
  await writable.close()
}

/** Read the workspace file, or null if the folder doesn't contain one yet. */
export async function readWorkspace(dir: FileSystemDirectoryHandle): Promise<string | null> {
  try {
    const fileHandle = await dir.getFileHandle(WORKSPACE_FILE)
    const file = await fileHandle.getFile()
    return await file.text()
  } catch (err) {
    if ((err as DOMException)?.name === 'NotFoundError') return null
    throw err
  }
}

/** Last-write-wins by wall clock. Ties keep local so we never overwrite for nothing. */
export function chooseSource(localTs: number, remoteTs: number): 'local' | 'remote' {
  return remoteTs > localTs ? 'remote' : 'local'
}
