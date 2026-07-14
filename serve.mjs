// Folium desktop launcher server: builds dist/ when it's missing or older than
// the source, serves it, opens the browser, and exits automatically once the
// last browser tab is closed. Each served page opens an SSE connection to
// /__keepalive (script injected below — the app itself is unaware of this);
// when no connections remain for GRACE_MS, the server shuts down.
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { readdirSync, statSync } from 'node:fs'
import { spawnSync, spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(BASE, 'dist')
const PORT = Number(process.env.PORT || 4173)
const GRACE_MS = Number(process.env.GRACE_MS || 20_000) // survive refreshes / brief reconnects
const INITIAL_GRACE_MS = Number(process.env.INITIAL_GRACE_MS || 120_000) // browser never opened

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

const KEEPALIVE_SNIPPET =
  '<script>new EventSource("/__keepalive")</script>'

/** Newest mtime (ms) across the files that feed the build. */
function newestSourceMtime() {
  let newest = 0
  const visit = (p) => {
    const s = statSync(p, { throwIfNoEntry: false })
    if (!s) return
    if (s.isDirectory()) {
      for (const name of readdirSync(p)) visit(path.join(p, name))
    } else if (s.mtimeMs > newest) {
      newest = s.mtimeMs
    }
  }
  for (const rel of ['src', 'public', 'index.html', 'package.json', 'vite.config.ts']) {
    visit(path.join(BASE, rel))
  }
  return newest
}

// Build when dist/ is missing or older than the source (e.g. after `git pull`).
const distIndex = path.join(ROOT, 'index.html')
const distStat = statSync(distIndex, { throwIfNoEntry: false })
if (!distStat || distStat.mtimeMs < newestSourceMtime()) {
  console.log(distStat ? 'Source changed — rebuilding…' : 'First run — building the app…')
  // (re)install deps when node_modules is missing or the lockfile changed under it
  const installedLock = statSync(path.join(BASE, 'node_modules', '.package-lock.json'), { throwIfNoEntry: false })
  const repoLock = statSync(path.join(BASE, 'package-lock.json'), { throwIfNoEntry: false })
  if (!installedLock || (repoLock && repoLock.mtimeMs > installedLock.mtimeMs)) {
    const i = spawnSync('npm install', { cwd: BASE, shell: true, stdio: 'inherit' })
    if (i.status !== 0) {
      console.error('npm install failed — see output above.')
      process.exit(i.status ?? 1)
    }
  }
  const b = spawnSync('npm run build', { cwd: BASE, shell: true, stdio: 'inherit' })
  if (b.status !== 0) {
    console.error('Build failed — see output above.')
    process.exit(b.status ?? 1)
  }
}

/** Open the default browser at the app URL (Windows / macOS / Linux). */
function openBrowser(url) {
  if (process.env.FOLIUM_NO_OPEN) return
  if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' })
  else if (process.platform === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' })
  else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' })
}

const startTime = Date.now()
let connections = 0
let lastDrop = startTime

setInterval(() => {
  const idle = Date.now() - lastDrop
  if (connections === 0 && idle > (lastDrop === startTime ? INITIAL_GRACE_MS : GRACE_MS)) {
    console.log('No open tabs — shutting down.')
    process.exit(0)
  }
}, 2000)

async function serveFile(res, filePath) {
  const data = await readFile(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const immutable = /-[\w-]{8,}\.\w+$/.test(path.basename(filePath)) // vite's hashed assets
  // index.html must never be cached, or the browser keeps loading an old
  // shell that points at stale hashed bundles (hard-refresh won't fix that).
  const cache = immutable
    ? 'public, max-age=31536000, immutable'
    : ext === '.html'
      ? 'no-store, no-cache, must-revalidate'
      : 'no-cache'
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': cache,
  })
  if (ext === '.html') {
    res.end(data.toString('utf8').replace('</body>', KEEPALIVE_SNIPPET + '</body>'))
  } else {
    res.end(data)
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (url.pathname === '/__keepalive') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    res.write(': connected\n\n')
    connections++
    const ping = setInterval(() => res.write(': ping\n\n'), 15_000)
    req.on('close', () => {
      clearInterval(ping)
      connections--
      if (connections <= 0) {
        connections = 0
        lastDrop = Date.now()
      }
    })
    return
  }

  try {
    let filePath = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)))
    if (!filePath.startsWith(ROOT)) throw new Error('forbidden')
    let s = await stat(filePath).catch(() => null)
    if (!s || s.isDirectory()) filePath = path.join(ROOT, 'index.html') // SPA fallback
    await serveFile(res, filePath)
  } catch {
    res.writeHead(404)
    res.end('not found')
  }
})

// If Folium is already running, just open another tab on it and bow out.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Folium is already running at http://localhost:${PORT} — opening it.`)
    openBrowser(`http://localhost:${PORT}`)
    setTimeout(() => process.exit(0), 1000)
  } else {
    throw err
  }
})

server.listen(PORT, () => {
  console.log(`Folium serving dist/ at http://localhost:${PORT}`)
  openBrowser(`http://localhost:${PORT}`)
})
