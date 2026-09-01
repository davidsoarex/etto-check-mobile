/**
 * Gera as variantes PWA a partir da arte fonte.
 *
 * Coloque o arquivo em:
 *   branding/echeck-icon-source.png
 *   (ou branding/echeck-icon-source.jpg)
 *
 * Depois: npm run icons:generate
 *
 * Não redesenha a arte — só redimensiona, com padding extra nas versões maskable.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceCandidates = [
  path.join(repoRoot, 'branding', 'echeck-icon-source.png'),
  path.join(repoRoot, 'branding', 'echeck-icon-source.jpg'),
]
const source = sourceCandidates.find((candidate) => fs.existsSync(candidate))

if (!source) {
  console.error(
    'Arquivo fonte ausente. Coloque a arte em branding/echeck-icon-source.png (ou .jpg) e rode npm run icons:generate',
  )
  process.exit(1)
}

const outDir = path.join(repoRoot, 'public', 'icons')
fs.mkdirSync(outDir, { recursive: true })

const MASKABLE_INSET = 0.1
const MASKABLE_BACKGROUND = { r: 5, g: 10, b: 24, alpha: 1 }

async function writeCover(size, dest) {
  await sharp(source).resize(size, size, { fit: 'cover', position: 'centre' }).png().toFile(dest)
}

async function writeMaskable(size, dest) {
  const inner = Math.round(size * (1 - MASKABLE_INSET * 2))
  const inset = Math.round((size - inner) / 2)
  const innerBuf = await sharp(source).resize(inner, inner, { fit: 'cover', position: 'centre' }).png().toBuffer()
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: MASKABLE_BACKGROUND,
    },
  })
    .composite([{ input: innerBuf, left: inset, top: inset }])
    .png()
    .toFile(dest)
}

await writeCover(192, path.join(outDir, 'icon-192.png'))
await writeCover(512, path.join(outDir, 'icon-512.png'))
await writeMaskable(192, path.join(outDir, 'icon-192-maskable.png'))
await writeMaskable(512, path.join(outDir, 'icon-512-maskable.png'))
await writeCover(180, path.join(outDir, 'apple-touch-icon.png'))
await writeCover(32, path.join(outDir, 'favicon-32.png'))

console.log(`OK: ícones gerados a partir de ${path.relative(repoRoot, source)}`)
