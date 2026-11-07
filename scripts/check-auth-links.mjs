// Checks the landing page's account and legal links. Account links must point
// at VITE_APP_ORIGIN (the web app), not at this site's /auth/... paths, which
// 404 on www.
//
//   npm test
//     Builds the page for several app origins into a temporary directory and
//     checks each. dist/ is left untouched.
//
//   npm test -- dist/index.html
//     Also checks an existing build against the VITE_APP_ORIGIN in the
//     environment (set it to the origin that build was made with).
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'vite'

const ROUTES = ['login', 'register']
const LEGAL = [
  'https://app.loomkeeper.com/legal/privacy',
  'https://app.loomkeeper.com/legal/terms',
]

const sourceDocument = readFileSync(
  new URL('../landing-page/index.html', import.meta.url),
  'utf8',
)
const countIn = (text, needle) => text.split(needle).length - 1

// Every account link in the source document, so a rewrite that misses some of
// them (or a document that loses them) fails rather than passing on "> 0".
const sourceHrefs = Object.fromEntries(
  ROUTES.map(route => [route, countIn(sourceDocument, `href="/auth/${route}"`)]),
)
const sourceSelectors = Object.fromEntries(
  ROUTES.map(route => [
    route,
    countIn(sourceDocument, `a[href="/auth/${route}"]`),
  ]),
)

const failures = []
const expect = (label, actual, ok) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}: ${actual}`)
  if (!ok) failures.push(label)
}

const buildFor = async (origin, outDir) => {
  process.env.VITE_APP_ORIGIN = origin

  await build({
    mode: 'production',
    logLevel: 'error',
    build: { outDir, emptyOutDir: true },
  })

  return readFileSync(join(outDir, 'index.html'), 'utf8')
}

const checkDocument = (html, origin) => {
  const count = needle => countIn(html, needle)

  for (const route of ROUTES) {
    expect(`source href="/auth/${route}"`, sourceHrefs[route], sourceHrefs[route] > 0)

    const href = `href="${origin}/auth/${route}"`
    expect(
      `${href} (source has ${sourceHrefs[route]})`,
      count(href),
      count(href) === sourceHrefs[route],
    )

    const selector = `a[${href}]`
    expect(
      `${selector} (source has ${sourceSelectors[route]})`,
      count(selector),
      count(selector) === sourceSelectors[route],
    )
  }

  // Any mention of an account route, quoted either way or unquoted, must be
  // prefixed by the app origin.
  const stray = [...html.matchAll(/\/auth\/(login|register)\b/g)].filter(
    match => !html.slice(0, match.index).endsWith(origin),
  )
  expect('account routes not on the app origin', stray.length, stray.length === 0)

  for (const url of LEGAL) {
    expect(`href="${url}"`, count(`href="${url}"`), count(`href="${url}"`) > 0)
  }
}

const [builtDocument] = process.argv.slice(2)
const builtOrigin = (process.env.VITE_APP_ORIGIN || '').replace(/\/+$/, '')

if (builtDocument) {
  console.log(`\n${builtDocument} (VITE_APP_ORIGIN=${builtOrigin || 'unset'})`)
  expect('VITE_APP_ORIGIN set for the build check', builtOrigin || 'unset', !!builtOrigin)
  if (builtOrigin) checkDocument(readFileSync(builtDocument, 'utf8'), builtOrigin)
}

const workDir = mkdtempSync(join(tmpdir(), 'loomkeeper-links-'))

try {
  const cases = [
    // [VITE_APP_ORIGIN as set, expected origin in the markup]
    ['https://app.loomkeeper.com', 'https://app.loomkeeper.com'],
    ['https://staging-app.example.test/', 'https://staging-app.example.test'],
    ['http://localhost:3000', 'http://localhost:3000'],
  ]

  for (const [index, [origin, expected]] of cases.entries()) {
    console.log(`\nVITE_APP_ORIGIN=${origin}`)
    checkDocument(await buildFor(origin, join(workDir, `case-${index}`)), expected)
  }

  console.log('\nVITE_APP_ORIGIN unset')
  let error
  try {
    await buildFor('', join(workDir, 'unset'))
  } catch (caught) {
    error = caught
  }
  expect(
    'build refuses to run',
    error ? error.message : 'built',
    /VITE_APP_ORIGIN is required/.test(error?.message ?? ''),
  )
} finally {
  rmSync(workDir, { recursive: true, force: true })
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}

console.log('\nall link checks passed')
