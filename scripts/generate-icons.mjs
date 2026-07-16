// Regenerates the PWA icons in public/icons/ from the brand SVG.
// sharp is intentionally NOT a project dependency (end-user installs would
// ship its native binary via serve.mjs's npm install). To regenerate:
//   npm install --no-save sharp && node scripts/generate-icons.mjs
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SRC = path.join(BASE, 'public', 'brand', 'folium.svg')
const OUT = path.join(BASE, 'public', 'icons')
await mkdir(OUT, { recursive: true })

// density raises the SVG rasterization resolution so downscaling stays crisp
for (const size of [192, 512]) {
  await sharp(SRC, { density: 300 })
    .resize(size, size)
    .png()
    .toFile(path.join(OUT, `folium-${size}.png`))
}

// Maskable: the OS may crop to a circle — keep the mark inside the central
// safe zone by rendering it at 60% onto a brand-background square.
const inner = Math.round(512 * 0.6)
const mark = await sharp(SRC, { density: 300 }).resize(inner, inner).png().toBuffer()
await sharp({
  create: { width: 512, height: 512, channels: 4, background: '#fbf8f0' },
})
  .composite([{ input: mark, gravity: 'centre' }])
  .png()
  .toFile(path.join(OUT, 'folium-maskable-512.png'))

console.log('icons written to public/icons/')
