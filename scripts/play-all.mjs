// Plays the ENTIRE ladder through the real UI: every mission solved with its
// canonical SQL, graded by the real grader, advancing like a real user.
// Proves end-to-end that no mission is broken, ungradable, or mis-keyed.
// Usage: PW_BROWSER=chromium|webkit|firefox node scripts/play-all.mjs [baseURL]
import { chromium, webkit, firefox } from 'playwright'
import { readFileSync } from 'node:fs'
import { MISSIONS, SCREEN_SIMS } from './missions-source.mjs'

const engines = { chromium, webkit, firefox }
const engineName = process.env.PW_BROWSER ?? 'chromium'
const BASE = process.argv[2] ?? 'http://localhost:5199'
let failures = 0

if (!engines[engineName]) throw new Error(`Unknown PW_BROWSER=${engineName}`)
console.log(`Full ladder: ${engineName} against ${BASE}`)
const browser = await engines[engineName].launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log('  PAGEERROR:', String(e.message).slice(0, 120)))

async function setEditor(sql) {
  const ok = await page.locator('.editor .cm-content').evaluate((el, text) => {
    const view = el.cmView?.view ?? el.cmView?.rootView?.view
    if (!view) return false
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
    return true
  }, sql)
  if (!ok) {
    await page.locator('.editor .cm-content').click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a')
    await page.keyboard.press('Delete')
    await page.keyboard.insertText(sql)
  }
}

await page.goto(BASE)
await page.getByRole('button', { name: /Open my desk/ }).click()
await page.locator('.ask-card').waitFor({ timeout: 120000 })

for (const m of MISSIONS) {
  const t0 = Date.now()
  try {
    // confirm the right mission is on screen
    await page.locator('.ask-title', { hasText: m.title }).waitFor({ timeout: 10000 })
    const traps = [
      ...(m.fingerprintSQL ? [{ sql: m.fingerprintSQL, message: m.fingerprintMessage }] : []),
      ...(m.extraFingerprints ?? []),
    ]
    for (let index = 0; index < traps.length; index++) {
      const trap = traps[index]
      await setEditor(trap.sql)
      await page.getByRole('button', { name: /Run/ }).click()
      const guidance = await page.locator('.verdict-wrong p').textContent({ timeout: 45000 })
      if (guidance?.trim() !== trap.message.trim()) throw new Error(`${m.id} trap ${index + 1} missed its authored guidance: ${guidance?.slice(0, 120)}`)
      console.log(`✓ ${m.id} wrong-result guidance ${index + 1}`)
    }
    await setEditor(m.canonical)
    await page.getByRole('button', { name: /Run/ }).click()
    await page.locator('.verdict-correct').waitFor({ timeout: 45000 })
    console.log(`✓ ${m.id} ${m.title} (${Date.now() - t0}ms)`)
    await page.getByRole('button', { name: /Next ask|Explore the warehouse/ }).click()
  } catch (e) {
    failures++
    console.log(`✗ ${m.id} ${m.title} — ${String(e).slice(0, 160)}`)
    const wrong = await page.locator('.verdict-wrong').textContent().catch(() => null)
    const err = await page.locator('.verdict-error').textContent().catch(() => null)
    if (wrong) console.log(`   verdict: ${wrong.slice(0, 200)}`)
    if (err) console.log(`   error: ${err.slice(0, 200)}`)
    await page.screenshot({ path: `/tmp/playfail-${m.id}.png` })
    // try to move on via the desk
    await page.getByRole('button', { name: 'Your desk' }).click().catch(() => {})
    const next = MISSIONS[MISSIONS.indexOf(m) + 1]
    if (next) {
      await page.locator('.queue-row', { hasText: next.title }).getByRole('button').click().catch(() => {})
    }
  }
}

// every company audition (unlock after the capstone); each row owns its own
// Start button and every set must play through blank on its own evidence.
const compiledSims = JSON.parse(readFileSync(new URL('../src/missions.compiled.json', import.meta.url), 'utf8')).sims
try {
  for (let simIndex = 0; simIndex < SCREEN_SIMS.length; simIndex++) {
    const sim = SCREEN_SIMS[simIndex]
    const company = compiledSims.find((compiled) => compiled.id === sim.id)?.company ?? ''
    // Each audition ends back in the workspace, so reopen the desk and enter
    // the interview-practice library before selecting the next company.
    await page.getByRole('button', { name: 'Your desk' }).click()
    const practiceCta = page.getByRole('button', { name: 'Start practice' })
    await practiceCta.waitFor({ state: 'visible' })
    await practiceCta.click()
    await page.getByRole('heading', { name: 'Choose an interview practice set' }).waitFor()
    await page.getByRole('button', { name: `Start ${company} audition` }).click()
    await page.locator('.sim-intro-title', { hasText: sim.title }).waitFor()
    if (sim.id === 'sim04') {
      const intro = (await page.locator('.sim-intro').textContent()) ?? ''
      if (!intro.includes('fictional Star67 screen')
        || !intro.includes("not a claim about Figma's interview format, planning process, or forecast governance")) {
        throw new Error(`sim04 lost its Figma anti-claim boundary: ${intro.slice(0, 180)}`)
      }
      console.log('✓ sim04 Figma anti-claim boundary')
    }
    for (const q of sim.questions) {
      const t0 = Date.now()
      // Same wrong-result contract as missions: every authored audition
      // fingerprint must surface exact coaching before the canonical answer.
      const traps = [
        ...(q.fingerprintSQL ? [{ sql: q.fingerprintSQL, message: q.fingerprintMessage }] : []),
        ...(q.extraFingerprints ?? []),
      ]
      for (let index = 0; index < traps.length; index++) {
        const trap = traps[index]
        await setEditor(trap.sql)
        await page.getByRole('button', { name: /Run/ }).click()
        const guidance = await page.locator('.verdict-wrong p').textContent({ timeout: 45000 })
        if (guidance?.trim() !== trap.message.trim()) throw new Error(`${q.id} trap ${index + 1} missed its authored guidance: ${guidance?.slice(0, 120)}`)
        console.log(`✓ ${q.id} wrong-result guidance ${index + 1}`)
      }
      await setEditor(q.canonical)
      await page.getByRole('button', { name: /Run/ }).click()
      await page.locator('.verdict-correct').waitFor({ timeout: 45000 })
      console.log(`✓ ${q.id} (${Date.now() - t0}ms)`)
      await page.getByRole('button', { name: /Next question|Finish the screen/ }).click()
    }
  }
} catch (e) {
  failures++
  console.log(`✗ screen sim — ${String(e).slice(0, 160)}`)
  await page.screenshot({ path: '/tmp/playfail-sim.png' })
}

await page.screenshot({ path: '/tmp/play-all-final.png' })
await browser.close()
const authoredAnswerCount = MISSIONS.length + SCREEN_SIMS.reduce((count, sim) => count + sim.questions.length, 0)
console.log(failures === 0 ? `\nFULL LADDER GREEN — ${authoredAnswerCount}/${authoredAnswerCount} authored answers solvable and graded correct.` : `\n${failures} FAILURES`)
process.exit(failures ? 1 : 0)
