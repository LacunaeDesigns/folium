import { describe, it, expect } from 'vitest'
import { chooseSource, readWorkspace, writeWorkspace, WORKSPACE_FILE } from './folderSync'

/** Minimal in-memory stand-in for a FileSystemDirectoryHandle. */
function fakeDir(seed: Record<string, string> = {}) {
  const files = { ...seed }
  return {
    name: 'fake-folder',
    files,
    async getFileHandle(name: string, opts?: { create?: boolean }) {
      if (!(name in files) && !opts?.create) {
        throw new DOMException('not found', 'NotFoundError')
      }
      return {
        async createWritable() {
          return {
            async write(text: string) {
              files[name] = text
            },
            async close() {},
          }
        },
        async getFile() {
          return { text: async () => files[name] }
        },
      }
    },
    async queryPermission() {
      return 'granted' as const
    },
    async requestPermission() {
      return 'granted' as const
    },
  } as unknown as FileSystemDirectoryHandle & { files: Record<string, string> }
}

describe('chooseSource', () => {
  it('prefers the side with the newer timestamp', () => {
    expect(chooseSource(100, 200)).toBe('remote')
    expect(chooseSource(200, 100)).toBe('local')
  })
  it('keeps local when timestamps tie (no needless overwrite)', () => {
    expect(chooseSource(100, 100)).toBe('local')
  })
})

describe('writeWorkspace / readWorkspace', () => {
  it('round-trips workspace text through the folder', async () => {
    const dir = fakeDir()
    await writeWorkspace(dir, '{"hello":"folium"}')
    expect((dir as never as { files: Record<string, string> }).files[WORKSPACE_FILE]).toBe(
      '{"hello":"folium"}',
    )
    expect(await readWorkspace(dir)).toBe('{"hello":"folium"}')
  })

  it('returns null when the folder has no workspace file yet', async () => {
    const dir = fakeDir()
    expect(await readWorkspace(dir)).toBeNull()
  })

  it('reads an existing workspace file placed by another machine', async () => {
    const dir = fakeDir({ [WORKSPACE_FILE]: '{"from":"machine-a"}' })
    expect(await readWorkspace(dir)).toBe('{"from":"machine-a"}')
  })
})
