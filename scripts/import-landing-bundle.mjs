// One-time importer for the single-file landing-page export.
//
// The design tool emits one HTML file with every image and font inlined as
// gzipped base64 in a __bundler/manifest block, plus the real markup as a
// JSON-encoded string in a __bundler/template block. The browser then has to
// download ~6.6MB, inflate it with DecompressionStream and swap the whole
// document in — which is why the page showed a splash and an "Unpacking..."
// indicator before anything appeared.
//
// This writes the assets out as ordinary files the CDN can cache and rewrites
// the markup to point at them, so the page is plain HTML that renders on first
// paint. Re-run it if the design tool produces a new export:
//
//   node scripts/import-landing-bundle.mjs <bundle.html> public/landing-page
//
// sharp is optional and only used to downscale oversized photographs; without
// it the images are copied through untouched.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'

const [bundlePath, outDir] = process.argv.slice(2)

if (!bundlePath || !outDir) {
  console.error(
    'usage: node scripts/import-landing-bundle.mjs <bundle.html> <out-dir>',
  )
  process.exit(1)
}

// Photographs wider than this are downscaled. The widest slot in the layout is
// a 1080px container, so this still covers a 2x display.
const MAX_IMAGE_WIDTH = 1400
const JPEG_QUALITY = 82

const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'font/woff2': 'woff2',
  'font/woff': 'woff',
}

let sharp = null
try {
  ;({ default: sharp } = await import('sharp'))
} catch {
  console.warn('sharp not installed — images copied without downscaling')
}

const lines = readFileSync(bundlePath, 'utf8').split('\n')

const payloadAfter = tag => {
  const index = lines.findIndex(line =>
    line.includes(`<script type="__bundler/${tag}">`),
  )

  if (index === -1) {
    throw new Error(`bundle has no __bundler/${tag} block`)
  }

  return JSON.parse(lines[index + 1])
}

const manifest = payloadAfter('manifest')
let template = payloadAfter('template')

const assetsDir = join(outDir, 'assets')
rmSync(assetsDir, { recursive: true, force: true })
mkdirSync(assetsDir, { recursive: true })

let originalBytes = 0
let writtenBytes = 0

for (const [uuid, asset] of Object.entries(manifest)) {
  const extension = EXTENSIONS[asset.mime]

  if (!extension) {
    throw new Error(`unmapped mime type ${asset.mime} for asset ${uuid}`)
  }

  let buffer = Buffer.from(asset.data, 'base64')

  if (asset.compressed) {
    buffer = gunzipSync(buffer)
  }

  originalBytes += buffer.length

  if (sharp && asset.mime === 'image/jpeg') {
    const { width } = await sharp(buffer).metadata()

    if (width > MAX_IMAGE_WIDTH) {
      buffer = await sharp(buffer)
        .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer()
      console.log(`  downscaled ${uuid.slice(0, 8)} from ${width}px`)
    }
  }

  const filename = `${uuid}.${extension}`
  writeFileSync(join(assetsDir, filename), buffer)
  writtenBytes += buffer.length

  // The export references assets by bare uuid, in `<img src="uuid">` and in
  // `src: url("uuid")` inside @font-face. Both are relative to the document.
  template = template.replaceAll(uuid, `assets/${filename}`)
}

const leftover = template.match(
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?!\.)/,
)

if (leftover) {
  throw new Error(`unrewritten asset reference remains: ${leftover[0]}`)
}

// The export declares its feature flags as a literal, under a comment asking
// for them to be wired to a flag service. Splice the integration in directly
// after that literal so it can seed FLAGS before the export calls applyFlags(),
// which is what keeps the page from painting once with the defaults and again
// with the real values.
const FLAGS_ANCHOR = '/*EDITMODE-END*/;'
const anchorAt = template.indexOf(FLAGS_ANCHOR)

if (anchorAt === -1) {
  throw new Error(
    `export has no ${FLAGS_ANCHOR} anchor — the flags literal moved, so the ` +
      'host integration cannot be injected; update scripts/import-landing-bundle.mjs',
  )
}

const integration = readFileSync(
  new URL('./landing-integration.js', import.meta.url),
  'utf8',
)
const insertionPoint = anchorAt + FLAGS_ANCHOR.length

template =
  template.slice(0, insertionPoint) +
  '\n\n' +
  integration.replace(/\n$/, '') +
  '\n' +
  template.slice(insertionPoint)

writeFileSync(join(outDir, 'index.html'), template)

const mb = bytes => `${(bytes / 1024 / 1024).toFixed(2)}MB`
console.log(`assets:   ${Object.keys(manifest).length}`)
console.log(`payload:  ${mb(originalBytes)} -> ${mb(writtenBytes)}`)
console.log(`document: ${mb(readFileSync(bundlePath).length)} -> ${mb(template.length)}`)
