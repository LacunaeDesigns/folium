import Peer, { DataConnection } from 'peerjs'
import { create } from 'zustand'
import { FoliumStore } from '../store/store'
import { applyLiveMsg, collectSyncCards, LiveMsg } from './protocol'
import { getUserName } from '../store/settings'

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function genCode(): string {
  let code = ''
  const rnd = crypto.getRandomValues(new Uint8Array(6))
  for (const b of rnd) code += CODE_ALPHABET[b % CODE_ALPHABET.length]
  return code
}

export function peerIdForCode(code: string): string {
  return 'folium-' + code.toLowerCase()
}

interface LiveState {
  active: boolean
  status: 'idle' | 'starting' | 'ready' | 'error'
  code: string | null
  boardId: string | null
  error: string | null
  peers: string[]
}

export const useLive = create<LiveState>(() => ({
  active: false,
  status: 'idle',
  code: null,
  boardId: null,
  error: null,
  peers: [],
}))

let peer: Peer | null = null
let conns: Map<string, { conn: DataConnection; name: string }> = new Map()
let unsubStore: (() => void) | null = null
let syncTimer: ReturnType<typeof setTimeout> | null = null

/** Boards visible to reviewers: subtree of the session board. */
function sessionBoards(store: FoliumStore, rootBoardId: string): string[] {
  const state = store.getState()
  const out = [rootBoardId]
  for (let i = 0; i < out.length; i++) {
    for (const card of Object.values(state.cards)) {
      if (card.boardId !== out[i] || card.trashed) continue
      if (card.content.kind === 'board' && card.content.boardId && state.boards[card.content.boardId]) {
        out.push(card.content.boardId)
      }
    }
  }
  return out
}

function broadcast(msg: LiveMsg): void {
  for (const { conn } of conns.values()) {
    if (conn.open) conn.send(msg)
  }
}

function sendSync(store: FoliumStore): void {
  const boardId = useLive.getState().boardId
  if (!boardId) return
  const cards = collectSyncCards(store.getState(), sessionBoards(store, boardId))
  broadcast({ t: 'cards-sync', cards })
}

function scheduleSync(store: FoliumStore): void {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => sendSync(store), 250)
}

export function startLiveSession(store: FoliumStore, boardId: string, attempt = 0): void {
  stopLiveSession()
  const code = genCode()
  useLive.setState({ active: true, status: 'starting', code, boardId, error: null, peers: [] })

  peer = new Peer(peerIdForCode(code))

  peer.on('open', () => {
    if (useLive.getState().code !== code) return
    useLive.setState({ status: 'ready' })
  })

  peer.on('error', (err: Error & { type?: string }) => {
    if (err.type === 'unavailable-id' && attempt < 3) {
      startLiveSession(store, boardId, attempt + 1)
      return
    }
    useLive.setState({ status: 'error', error: err.type ?? err.message })
  })

  peer.on('connection', (conn) => {
    conns.set(conn.connectionId, { conn, name: 'Reviewer' })
    conn.on('data', (raw) => {
      const msg = raw as LiveMsg
      if (msg && msg.t === 'hello') {
        const name = String(msg.name ?? 'Reviewer').slice(0, 60) || 'Reviewer'
        conns.set(conn.connectionId, { conn, name })
        useLive.setState({ peers: [...conns.values()].map((c) => c.name) })
        const title = store.getState().boards[boardId]?.title ?? 'Board'
        conn.send({ t: 'welcome', hostName: getUserName(), boardTitle: title } satisfies LiveMsg)
        sendSync(store)
        return
      }
      applyLiveMsg(store, msg)
    })
    const drop = () => {
      conns.delete(conn.connectionId)
      useLive.setState({ peers: [...conns.values()].map((c) => c.name) })
    }
    conn.on('close', drop)
    conn.on('error', drop)
  })

  unsubStore = store.subscribe(() => scheduleSync(store))
}

export function stopLiveSession(): void {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = null
  unsubStore?.()
  unsubStore = null
  for (const { conn } of conns.values()) conn.close()
  conns = new Map()
  peer?.destroy()
  peer = null
  useLive.setState({ active: false, status: 'idle', code: null, boardId: null, error: null, peers: [] })
}
