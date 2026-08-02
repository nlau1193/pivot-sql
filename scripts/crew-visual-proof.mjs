import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const suppliedBase = process.argv[2]
const base = suppliedBase ?? 'http://127.0.0.1:5199'
const out = new URL('../output/crew-proof/', import.meta.url)
const outPath = fileURLToPath(out)
const artifactPath = (name) => fileURLToPath(new URL(name, out))
await mkdir(out, { recursive: true })

let server = null
process.on('exit', () => server?.kill('SIGTERM'))
async function reachable() {
  return fetch(base).then((response) => response.ok).catch(() => false)
}
if (!await reachable()) {
  if (suppliedBase) throw new Error(`No Star67 server at ${base}`)
  server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5199'], {
    cwd: new URL('..', import.meta.url),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  for (let attempt = 0; attempt < 120 && !await reachable(); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  if (!await reachable()) throw new Error('Could not start the local Star67 server')
}

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  recordVideo: { dir: outPath, size: { width: 1280, height: 900 } },
})
const page = await context.newPage()
const video = page.video()
const errors = []
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
page.on('pageerror', (error) => errors.push(error.message))

await page.goto(base, { waitUntil: 'networkidle' })
await page.locator('.intro-story summary').click()
await page.locator('.intro-crew').waitFor()
await page.screenshot({ path: artifactPath('intro-1280.png'), fullPage: true })

const wide = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
  portraits: [...document.querySelectorAll('.intro-crew img')].map((image) => ({
    src: image.getAttribute('src'),
    width: image.naturalWidth,
    height: image.naturalHeight,
    alt: image.getAttribute('alt'),
  })),
}))

await page.setViewportSize({ width: 320, height: 900 })
await page.locator('.intro-crew').waitFor()
await page.screenshot({ path: artifactPath('intro-320.png'), fullPage: true })
const narrowFits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

// 360 CSS px is the deterministic reflow equivalent of a 720 px window at
// 200% browser zoom. CSS `zoom` itself distorts layout metrics in headless
// Chromium and produces false horizontal-overflow failures.
await page.setViewportSize({ width: 360, height: 450 })
await page.screenshot({ path: artifactPath('intro-720-equivalent-200.png'), fullPage: false })
const zoomFits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

await page.setViewportSize({ width: 1280, height: 900 })
await page.getByRole('button', { name: 'Open my desk' }).click()
await page.locator('.ask-card').waitFor({ timeout: 120_000 })
await page.getByRole('button', { name: 'Your desk' }).click()
await page.getByRole('tab', { name: 'Progress' }).click()
await page.locator('.desk-crew').waitFor()
await page.screenshot({ path: artifactPath('progress-crew-1280.png'), fullPage: true })
const progress = await page.locator('.career-dossier .desk-crew').evaluate((crew) => ({
  names: [...crew.querySelectorAll('strong')].map((node) => node.textContent),
  portraits: [...crew.querySelectorAll('img')].map((image) => ({
    src: image.getAttribute('src'),
    width: image.naturalWidth,
    height: image.naturalHeight,
    alt: image.getAttribute('alt'),
    objectFit: getComputedStyle(image).objectFit,
  })),
}))

if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`)
if (wide.scrollWidth > wide.innerWidth) throw new Error('Wide intro has horizontal overflow')
if (!narrowFits) throw new Error('320px intro has horizontal overflow')
if (!zoomFits) throw new Error('720px-wide equivalent at 200% zoom has horizontal overflow')
if (wide.portraits.length !== 6) throw new Error(`Expected 6 intro portraits, found ${wide.portraits.length}`)
if (new Set(wide.portraits.map(({ src }) => src)).size !== 6) throw new Error('Intro portraits are not unique')
for (const portrait of wide.portraits) {
  if (portrait.width !== 1024 || portrait.height !== 1024) throw new Error(`Bad portrait: ${JSON.stringify(portrait)}`)
  if (!portrait.alt) throw new Error(`Missing alt text: ${portrait.src}`)
}
if (progress.names.join(',') !== 'Riff,Rex,Coco,Zi,Fin,Frosty') throw new Error(`Progress crew order drifted: ${progress.names.join(',')}`)
if (progress.portraits.length !== 6 || new Set(progress.portraits.map(({ src }) => src)).size !== 6) {
  throw new Error('Progress must render six unique portraits')
}
for (const portrait of progress.portraits) {
  if (portrait.width !== 1024 || portrait.height !== 1024 || portrait.objectFit !== 'contain' || !portrait.alt) {
    throw new Error(`Bad Progress portrait: ${JSON.stringify(portrait)}`)
  }
}

await page.waitForTimeout(700)
await context.close()
await video.saveAs(artifactPath('crew-walkthrough.webm'))
await browser.close()
server?.kill('SIGTERM')

console.log(`Crew visual proof: wide + 320px + 200% zoom + Progress green\nArtifacts: ${outPath}`)
