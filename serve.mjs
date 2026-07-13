// Folium desktop launcher server: serves dist/ and exits automatically once the
// last browser tab is closed. Each served page opens an SSE connection to
// /__keepalive (script injected below — the app itself is unaware of this);
// when no connections remain for GRACE_MS, the server shuts down.
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist')
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
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
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

server.listen(PORT, () => console.log(`Folium serving dist/ at http://localhost:${PORT}`))
