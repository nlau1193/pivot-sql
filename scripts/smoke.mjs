// End-to-end smoke: drives the REAL user flow in a headless browser.
// Usage: node scripts/smoke.mjs [baseURL]   (default http://localhost:5199)
// Exits non-zero on any failed step. This is the proof harness, not unit theater.
import { readFileSync } from 'node:fs'
import { chromium, webkit, firefox } from 'playwright'
import { MISSIONS, SCREEN_SIMS } from './missions-source.mjs'

const compiledContent = JSON.parse(readFileSync(new URL('../src/missions.compiled.json', import.meta.url), 'utf8'))
const expectedBadgeCount = compiledContent.progression.badges.length
const expectedDeskCrew = ['Riff', 'Rex', 'Coco', 'Zi', 'Fin', 'Frosty']
const scenarioSource = readFileSync(new URL('../src/packs/parkline-fpa/scenarios.ts', import.meta.url), 'utf8')
const AUTHORED_SCENARIO_SHAPE = [...scenarioSource.matchAll(/\{\s*id:\s*'([^']+)'[\s\S]*?missionIds:\s*\[([^\]]*)\]\s*\}/g)].map((match) => {
  const missionIds = [...match[2].matchAll(/'([^']+)'/g)].map((missionMatch) => missionMatch[1])
  return {
    id: match[1],
    title: match[0].match(/title:\s*'([^']+)'/)?.[1] ?? match[1],
    missionIds,
    parts: missionIds.length,
  }
})
const SEAT_BOOK_SCENARIO = AUTHORED_SCENARIO_SHAPE.find((scenario) => scenario.id === 'seat-book-review')
const PLANNING_CLOSE_SCENARIO = AUTHORED_SCENARIO_SHAPE.find((scenario) => scenario.id === 'planning-close')
const ARR_SUBLEDGER_SCENARIO = AUTHORED_SCENARIO_SHAPE.find((scenario) => scenario.id === 'arr-subledger-control')
const ARR_SUBLEDGER_MISSION_IDS = ['m100', 'm101', 'm102', 'm103', 'm104', 'm105', 'm106', 'm107', 'm108']
const CUSTOMER_LIFECYCLE_SCENARIO = AUTHORED_SCENARIO_SHAPE.find((scenario) => scenario.id === 'customer-lifecycle-council')
const CUSTOMER_LIFECYCLE_MISSION_IDS = ['m109', 'm110', 'm111', 'm112', 'm113', 'm114', 'm115', 'm116', 'm117']
const CUSTOMER_OWNERSHIP_SCENARIO = AUTHORED_SCENARIO_SHAPE.find((scenario) => scenario.id === 'customer-ownership-control')
const CUSTOMER_OWNERSHIP_MISSION_IDS = ['m118', 'm119', 'm120', 'm121', 'm122', 'm123', 'm124', 'm125', 'm126', 'm127']
const REFORECAST_OUTCOME_SCENARIO = AUTHORED_SCENARIO_SHAPE.find((scenario) => scenario.id === 'reforecast-outcome-review')
const REFORECAST_OUTCOME_MISSION_IDS = ['m128', 'm129', 'm130', 'm131', 'm132', 'm133', 'm134', 'm135', 'm136']
const SHARED_SERVICES_ALLOCATION_SCENARIO = AUTHORED_SCENARIO_SHAPE.find((scenario) => scenario.id === 'shared-services-allocation-review')
const SHARED_SERVICES_ALLOCATION_MISSION_IDS = ['m137', 'm138', 'm139', 'm140', 'm141', 'm142', 'm143', 'm144', 'm145']
const COST_TO_SERVE_SCENARIO = AUTHORED_SCENARIO_SHAPE.find((scenario) => scenario.id === 'cost-to-serve-review')
const COST_TO_SERVE_MISSION_IDS = ['m146', 'm147', 'm148', 'm149', 'm150', 'm151', 'm152', 'm153', 'm154', 'm155']
const CONTRACTOR_CONSULTING_COST_SCENARIO = AUTHORED_SCENARIO_SHAPE.find((scenario) => scenario.id === 'contractor-consulting-cost-review')
const CONTRACTOR_CONSULTING_COST_MISSION_IDS = ['m156', 'm157', 'm158', 'm159', 'm160', 'm161', 'm162']
const TRAVEL_EXPENSE_SCENARIO = AUTHORED_SCENARIO_SHAPE.find((scenario) => scenario.id === 'travel-expense-operating-review')
const TRAVEL_EXPENSE_MISSION_IDS = ['m163', 'm164', 'm165', 'm166', 'm167', 'm168', 'm169', 'm170']
const REVENUE_CLOSE_USAGE_SCENARIO = AUTHORED_SCENARIO_SHAPE.find((scenario) => scenario.id === 'revenue-close-usage-review')
const REVENUE_CLOSE_USAGE_MISSION_IDS = ['m171', 'm172', 'm173', 'm174', 'm175', 'm176', 'm177', 'm178', 'm179']
const engines = { chromium, webkit, firefox }
const engineName = process.env.PW_BROWSER ?? 'chromium'

const BASE = process.argv[2] ?? 'http://localhost:5199'
const BASE_ORIGIN = new URL(BASE).origin
const results = []
let browser

function step(name, ok, note = '') {
  results.push({ name, ok, note })
  console.log(`${ok ? '✓' : '✗'} ${name}${note ? ` — ${note}` : ''}`)
}

function canonicalJSONStringify(value) {
  const visit = (candidate) => {
    if (Array.isArray(candidate)) return candidate.map(visit)
    if (!candidate || typeof candidate !== 'object') return candidate
    return Object.fromEntries(Object.keys(candidate).sort().map((key) => [key, visit(candidate[key])]))
  }
  return JSON.stringify(visit(value))
}

function changedObjectFields(before, after) {
  const fields = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])
  return [...fields].filter((field) => canonicalJSONStringify(before?.[field]) !== canonicalJSONStringify(after?.[field])).sort()
}

async function setEditor(page, sql) {
  // CodeMirror: click into the editor, select-all, type replacement
  await page.locator('.editor .cm-content').click()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a')
  await page.keyboard.press('Delete')
  // Use the same visible keyboard path a learner has. A private CodeMirror
  // instance is not a stable automation API, and dispatching into an adapter
  // that is between React renders can leave the controlled value stale.
  if (sql) await page.keyboard.insertText(sql)
}

async function runQuery(page) {
  await page.getByRole('button', { name: /Run/ }).click()
}

async function openScenarioLibrary(page) {
  await page.locator('.path-chooser').waitFor()
  await page.getByRole('button', { name: /Browse projects: Practice projects/i }).click()
  await page.locator('.scenario-library').waitFor()
}

async function readEditorText(page) {
  return page.locator('.editor .cm-content').evaluate((el) => {
    // Read what the user can actually see. Some CodeMirror adapters retain an
    // old internal view reference briefly after React switches questions.
    // CodeMirror renders one .cm-line per document line; textContent alone
    // silently removes the line boundaries and can turn valid SQL into
    // `aliasFROM table` when a smoke step restores the document.
    return Array.from(el.querySelectorAll('.cm-line'))
      .map((line) => {
        const copy = line.cloneNode(true)
        copy.querySelectorAll('.cm-placeholder').forEach((placeholder) => placeholder.remove())
        return copy.textContent ?? ''
      })
      .join('\n')
  })
}

function timerSeconds(value) {
  const [minutes, seconds] = value.split(':').map(Number)
  return minutes * 60 + seconds
}

async function keepFirstParty(context, failPath = null, failTimes = Infinity) {
  const blocked = []
  let failures = 0
  await context.route('**/*', async (route) => {
    const requestURL = new URL(route.request().url())
    if (failPath && failures < failTimes && requestURL.origin === BASE_ORIGIN && requestURL.pathname === failPath) {
      failures += 1
      await route.fulfill({ status: 503, contentType: 'text/plain', body: 'smoke outage' })
    } else if (requestURL.protocol === 'blob:' || requestURL.protocol === 'data:' || requestURL.origin === BASE_ORIGIN) {
      await route.continue()
    } else {
      blocked.push(requestURL.href)
      await route.abort()
    }
  })
  return blocked
}

try {
  browser = await engines[engineName].launch()

  // A failed parquet response is a retryable network interruption, not corrupt
  // SQL/data. The successful retry is chunked so progress must advance while
  // the GL transfer is still in flight instead of jumping after arrayBuffer().
  const downloadContext = await browser.newContext()
  await keepFirstParty(downloadContext, '/data/fct_gl_transactions.parquet', 1)
  const downloadPage = await downloadContext.newPage()
  await downloadPage.addInitScript(() => {
    const realFetch = window.fetch.bind(window)
    window.__pivotDocumentSentinel = `${Date.now()}-${Math.random()}`
    window.__pivotCold = { glFetches: 0, chunksSent: 0, bytesSent: 0, totalBytes: 0, release: null, dataRequests: [] }
    window.fetch = async (...args) => {
      const requestURL = new URL(typeof args[0] === 'string' ? args[0] : args[0].url, location.href)
      if (requestURL.pathname.startsWith('/data/')) {
        window.__pivotCold.dataRequests.push({ path: requestURL.pathname, revision: requestURL.searchParams.get('v') })
      }
      if (requestURL.pathname === '/data/fct_gl_transactions.parquet') window.__pivotCold.glFetches += 1
      const response = await realFetch(...args)
      if (response.ok && requestURL.pathname === '/data/manifest.json') {
        response.clone().json().then((manifest) => {
          window.__pivotCold.totalBytes = Object.values(manifest.tables).reduce((sum, table) => sum + table.bytes, 0)
        }).catch(() => {})
      }
      if (!response.ok || requestURL.pathname !== '/data/fct_gl_transactions.parquet') return response

      const bytes = new Uint8Array(await response.arrayBuffer())
      const chunkSize = Math.ceil(bytes.byteLength / 4)
      let chunk = 0
      let releaseGate
      const gate = new Promise((resolve) => { releaseGate = resolve })
      window.__pivotCold.release = () => {
        releaseGate()
        window.__pivotCold.release = null
      }
      const body = new ReadableStream({
        async pull(controller) {
          if (chunk === 2) await gate
          const offset = chunk * chunkSize
          if (offset >= bytes.byteLength) {
            controller.close()
            return
          }
          const end = Math.min(offset + chunkSize, bytes.byteLength)
          controller.enqueue(bytes.slice(offset, end))
          chunk += 1
          window.__pivotCold.chunksSent = chunk
          window.__pivotCold.bytesSent = end
        },
      })
      return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers })
    }
  })
  await downloadPage.goto(BASE)
  await downloadPage.getByRole('button', { name: /Open my desk|Back to my desk/ }).click()
  const downloadError = downloadPage.getByRole('heading', { name: /download was interrupted/i })
  await downloadError.waitFor({ timeout: 30000 })
  const downloadText = await downloadPage.locator('.intro-card').textContent()
  const documentSentinel = await downloadPage.evaluate(() => window.__pivotDocumentSentinel)
  const cleanState = await downloadPage.evaluate(() => {
    return window.__engine.isCold()
  })
  const retryButton = downloadPage.getByRole('button', { name: /try.*again/i })
  const retryVisible = await retryButton.isVisible().catch(() => false)
  const retryEnabled = retryVisible && await retryButton.isEnabled().catch(() => false)
  const technicalDetails = downloadPage.locator('.technical-details')
  if (await technicalDetails.isVisible().catch(() => false)) await technicalDetails.locator('summary').click()
  await downloadPage.setViewportSize({ width: 320, height: 800 })
  const narrowErrorFits = await downloadPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  await downloadPage.setViewportSize({ width: 1280, height: 720 })
  let streamedProgress = null
  let progressMatchesBytes = false
  let retriedFetch = false
  let recovered = false
  let queryWorked = false
  let sameDocument = false
  let revisionedData = false
  let dataRevision = null
  if (retryEnabled) {
    const pageURL = downloadPage.url()
    await retryButton.click()
    retriedFetch = await downloadPage.waitForFunction(() => window.__pivotCold.glFetches === 2, null, { timeout: 10_000 }).then(() => true).catch(() => false)
    const chunksReady = retriedFetch && await downloadPage.waitForFunction(() => window.__pivotCold.chunksSent === 2, null, { timeout: 20_000 }).then(() => true).catch(() => false)
    const progressUpdated = chunksReady && await downloadPage.waitForFunction(() => {
      const value = Number(document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow'))
      return window.__pivotCold.totalBytes > 0 && value > 5
    }, null, { timeout: 5_000 }).then(() => true).catch(() => false)
    if (progressUpdated) {
      const progress = await downloadPage.evaluate(() => {
        const value = Number(document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow'))
        const expected = 5 + 90 * (window.__pivotCold.bytesSent / window.__pivotCold.totalBytes)
        return { value, expected }
      })
      streamedProgress = progress.value
      progressMatchesBytes = Number.isFinite(progress.value) && progress.value > 5 && progress.value < 95 && Math.abs(progress.value - progress.expected) <= 2
    }
    await downloadPage.evaluate(() => window.__pivotCold.release?.()).catch(() => {})
    if (retriedFetch) {
      await downloadPage.locator('.ask-card').waitFor({ timeout: 120000 }).catch(() => null)
      recovered = await downloadPage.locator('.ask-card').isVisible().catch(() => false)
      queryWorked = recovered && await downloadPage.evaluate(async () => {
        const result = await window.__engine.runRaw('SELECT count(*) FROM dim_vendor')
        return Number(result.rows[0][0]) > 0
      }).catch(() => false)
      sameDocument = downloadPage.url() === pageURL
        && await downloadPage.evaluate((sentinel) => window.__pivotDocumentSentinel === sentinel, documentSentinel)
        && downloadContext.pages().length === 1
      const revisionProof = recovered && await downloadPage.evaluate(() => {
        const requests = window.__pivotCold.dataRequests
        const revisions = [...new Set(requests.map((request) => request.revision))]
        const paths = new Set(requests.map((request) => request.path))
        return {
          revision: revisions.length === 1 ? revisions[0] : null,
          ok: paths.size === 13 && paths.has('/data/manifest.json') && revisions.length === 1 && Boolean(revisions[0]),
        }
      })
      revisionedData = Boolean(revisionProof?.ok)
      dataRevision = revisionProof?.revision ?? null
    }
  }
  const coldRecovery = {
    truthful: !/magic bytes/i.test(downloadText),
    cleanState,
    retryVisible,
    retryEnabled,
    narrowErrorFits,
    retriedFetch,
    streamedProgress,
    progressMatchesBytes,
    recovered,
    queryWorked,
    sameDocument,
    revisionedData,
    dataRevision,
  }
  step('cold-load outage is truthful and recovers in place with streamed progress', Object.values(coldRecovery).every(Boolean), JSON.stringify(coldRecovery))
  await downloadContext.close()

  // A truncated 200 response is still an interrupted download. Do not let
  // DuckDB turn it into a confusing parquet magic-byte error.
  const shortReadContext = await browser.newContext()
  await keepFirstParty(shortReadContext)
  await shortReadContext.route('**/data/fct_gl_transactions.parquet*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/octet-stream', body: Buffer.alloc(32) })
  })
  const shortReadPage = await shortReadContext.newPage()
  await shortReadPage.goto(BASE)
  await shortReadPage.getByRole('button', { name: /Open my desk|Back to my desk/ }).click()
  const shortReadHeading = shortReadPage.getByRole('heading', { name: /download was interrupted/i })
  await shortReadHeading.waitFor({ timeout: 30000 })
  const shortReadText = await shortReadPage.locator('.intro-card').textContent()
  step('truncated 200 data is reported as an interrupted download', !/magic bytes|didn't wake up/i.test(shortReadText ?? ''), shortReadText?.slice(0, 160))
  await shortReadContext.close()

  const manifestOutageContext = await browser.newContext()
  await keepFirstParty(manifestOutageContext)
  await manifestOutageContext.route('**/data/manifest.json*', async (route) => {
    await route.abort('failed')
  })
  const manifestOutagePage = await manifestOutageContext.newPage()
  await manifestOutagePage.goto(BASE)
  await manifestOutagePage.getByRole('button', { name: /Open my desk|Back to my desk/ }).click()
  await manifestOutagePage.getByRole('heading', { name: /download was interrupted/i }).waitFor({ timeout: 30000 })
  const manifestOutageText = await manifestOutagePage.locator('.intro-card').textContent()
  step('manifest network failure is reported as an interrupted download', !/magic bytes|didn't wake up/i.test(manifestOutageText ?? ''), manifestOutageText?.slice(0, 160))
  await manifestOutageContext.close()

  // Reproduce the cross-mission overlap that used to let m01's grader overwrite
  // m02's temp tables and paint the exact canonical m02 answer red.
  const raceContext = await browser.newContext()
  await keepFirstParty(raceContext)
  const racePage = await raceContext.newPage()
  await racePage.goto(BASE)
  await racePage.getByRole('button', { name: /Open my desk|Back to my desk/ }).click()
  await racePage.locator('.ask-card').waitFor({ timeout: 120000 })
  await racePage.evaluate(() => {
    window.__pivotGradingDelayStarted = false
    window.__pivotGradingDelayMs = 1400
  })
  await runQuery(racePage)
  await racePage.waitForFunction(() => window.__pivotGradingDelayStarted === true, null, { timeout: 30000 })
  await racePage.evaluate((mission) => {
    const key = 'pivot.progress.v1'
    const progress = JSON.parse(localStorage.getItem(key) ?? '{"pulls":{}}')
    progress.pulls ??= {}
    progress.pulls[mission.id] = {
      missionId: mission.id,
      completedAt: new Date().toISOString(),
      sql: mission.canonical,
      title: mission.title,
    }
    localStorage.setItem(key, JSON.stringify(progress))
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(progress) }))
  }, MISSIONS[0])
  await racePage.getByRole('button', { name: 'Your desk' }).click()
  await racePage.getByRole('button', { name: /Start next task: Next guided task/i }).click()
  await setEditor(racePage, MISSIONS[1].canonical)
  await runQuery(racePage)
  await racePage.locator('.verdict-correct').waitFor({ timeout: 30000 })
  await racePage.waitForTimeout(1600)
  const raceState = await racePage.evaluate(() => ({
    m02: !!JSON.parse(localStorage.getItem('pivot.progress.v2') ?? '{"pulls":{}}').pulls?.m02,
    currentTitle: document.querySelector('.ask-title')?.textContent ?? '',
    correct: !!document.querySelector('.verdict-correct'),
  }))
  step('overlapping missions keep grading isolated', raceState.m02 && raceState.correct && raceState.currentTitle.includes(MISSIONS[1].title), JSON.stringify(raceState))
  await raceContext.close()

  // Imported/stale campaign receipts can carry an ID that is not in the
  // authored pack. Preserve that evidence for migration, but never let it
  // become a learner-facing completion, title, or reopen target.
  const unknownProgressContext = await browser.newContext()
  await keepFirstParty(unknownProgressContext)
  await unknownProgressContext.addInitScript(() => {
    const receipt = {
      receiptId: 'receipt:campaign:mystery',
      missionId: 'mystery',
      completedAt: new Date().toISOString(),
      sql: 'SELECT 1;',
      title: 'mystery',
      contentRevision: 'smoke',
      mode: 'campaign',
      hintLevel: 0,
      attemptId: null,
    }
    localStorage.setItem('pivot.progress.v2', JSON.stringify({ version: 2, pulls: { mystery: receipt } }))
  })
  const unknownProgressPage = await unknownProgressContext.newPage()
  await unknownProgressPage.goto(BASE)
  await unknownProgressPage.getByRole('button', { name: 'Open my desk', exact: true }).waitFor()
  const unknownIntro = await unknownProgressPage.locator('body').innerText()
  await unknownProgressPage.getByRole('button', { name: 'Open my desk', exact: true }).click()
  await unknownProgressPage.locator('.workspace').waitFor({ timeout: 120000 })
  await unknownProgressPage.getByRole('button', { name: 'Your desk', exact: true }).click()
  const unknownDesk = await unknownProgressPage.getByRole('dialog').innerText()
  const unknownProgressHidden = !unknownIntro.includes('Welcome back')
    && unknownIntro.includes('Learn SQL one clear question at a time')
    && unknownDesk.includes('Saved queries (0)')
    && !unknownDesk.includes('mystery')
  step('unknown imported progress stays out of learner-facing counts and copy', unknownProgressHidden, JSON.stringify({ introReturning: unknownIntro.includes('Welcome back'), desk: unknownDesk.slice(0, 240) }))
  await unknownProgressContext.close()

  // The coaching surface has one visible action. It is advisory; the
  // deterministic editor/grader remains the only path that can change work.
  const solutionContext = await browser.newContext()
  await keepFirstParty(solutionContext)
  const solutionPage = await solutionContext.newPage()
  await solutionPage.goto(BASE)
  await solutionPage.getByRole('button', { name: /Open my desk|Back to my desk/ }).click()
  await solutionPage.locator('.ask-card').waitFor({ timeout: 120000 })
  await setEditor(solutionPage, MISSIONS[0].canonical)
  await runQuery(solutionPage)
  await solutionPage.locator('.verdict-correct').waitFor({ timeout: 30000 })
  await solutionPage.getByRole('button', { name: /Next ask/ }).click()
  await solutionPage.locator('.ask-title', { hasText: MISSIONS[1].title }).waitFor({ timeout: 30000 })
  const verifiedM02 = compiledContent.missions.find((mission) => mission.id === 'm02')?.solution ?? ''
  const solutionCoachButton = solutionPage.getByRole('button', { name: 'Give me the next step', exact: true })
  await solutionCoachButton.click()
  await solutionPage.locator('.coach-response').waitFor({ timeout: 15000 })
  const solutionCoachProof = await solutionPage.evaluate(() => ({
    directive: document.querySelector('.ask-card__directive')?.textContent?.trim() ?? '',
    source: document.querySelector('.coach-response__eyebrow')?.textContent?.trim() ?? '',
    route: document.querySelector('.coach-panel__route')?.textContent?.trim() ?? '',
    controls: Array.from(document.querySelectorAll('.coach-panel__actions button')).map((button) => button.textContent?.trim() ?? ''),
    actionClass: document.querySelector('.coach-panel__action')?.className ?? '',
  }))
  step(
    'the learner sees one private built-in next step before running a query',
    /Start here.*Riff’s task/i.test(solutionCoachProof.directive)
      && /built-in.*private/i.test(solutionCoachProof.source)
      && /current result|current draft|draft has not produced/i.test(solutionCoachProof.route)
      && solutionCoachProof.controls.length === 1
      && solutionCoachProof.controls[0] === 'Give me the next step'
      && /btn-ghost/.test(solutionCoachProof.actionClass),
    JSON.stringify(solutionCoachProof),
  )
  await setEditor(solutionPage, verifiedM02)
  const solutionBeforeRun = await readEditorText(solutionPage)
  await runQuery(solutionPage)
  await solutionPage.locator('.verdict-correct').waitFor({ timeout: 30000 })
  step(
    'The authored query runs through DuckDB and grades green',
    verifiedM02.length > 0 && solutionBeforeRun === verifiedM02,
    JSON.stringify({ exact: solutionBeforeRun === verifiedM02, length: solutionBeforeRun.length }),
  )
  await solutionContext.close()

  // Learner-chosen aliases and predicate order are presentation, not SQL
  // correctness. Seed prior receipts so the real app opens the active-roster
  // boundary, then continue through the alias-sensitive lesson in the same UI
  // the learner uses.
  const aliasContext = await browser.newContext()
  await keepFirstParty(aliasContext)
  const boundaryMission = MISSIONS.find((mission) => mission.id === 'm86')
  const aliasMission = MISSIONS.find((mission) => mission.id === 'm91')
  if (!boundaryMission) throw new Error('m86 is missing from the authored mission source')
  if (!aliasMission) throw new Error('m91 is missing from the authored mission source')
  const boundaryMissionIndex = MISSIONS.findIndex((mission) => mission.id === boundaryMission.id)
  const priorAliasMissions = MISSIONS.slice(0, boundaryMissionIndex).map((mission) => ({ id: mission.id, title: mission.title }))
  await aliasContext.addInitScript(({ missions }) => {
    const completedAt = '2026-07-16T00:00:00.000Z'
    const receipts = Object.fromEntries(missions.map(({ id, title }) => {
      const receiptId = `smoke:alias:${id}`
      return [receiptId, {
        receiptId,
        missionId: id,
        completedAt,
        sql: 'SELECT 1',
        title,
        contentRevision: 'smoke',
        mode: 'campaign',
        hintLevel: 0,
        attemptId: null,
      }]
    }))
    localStorage.setItem('pivot.progress.v2', JSON.stringify({
      version: 2,
      pulls: {},
      simDone: {},
      solveReceipts: receipts,
      quarantinedReceiptIds: [],
      auditionAttempts: {},
      quarantinedAttemptIds: [],
      drafts: {},
      draftTombstones: {},
      seenBadgeIds: [],
      importedEnvelopeIds: [],
      lastMissionId: null,
      lastSeenAt: completedAt,
    }))
  }, { missions: priorAliasMissions })
  const aliasPage = await aliasContext.newPage()
  await aliasPage.goto(BASE)
  await aliasPage.getByRole('button', { name: /Open my desk|Back to my desk/ }).click()
  await aliasPage.locator('.ask-title', { hasText: boundaryMission.title }).waitFor({ timeout: 120000 })
  const aliasContract = await aliasPage.locator('.grading-contract').textContent()
  step(
    'deliverable explains learner aliases are flexible',
    /any aliases you like/i.test(aliasContract ?? '')
      && /values, column count, rows, and requested order/i.test(aliasContract ?? ''),
    aliasContract?.slice(0, 160) ?? '',
  )
  const reversedBoundarySQL = boundaryMission.canonical.replace(
    `(termination_date IS NULL OR termination_date > DATE '2026-06-30')`,
    `(DATE '2026-06-30' < termination_date OR termination_date IS NULL)`,
  )
  if (reversedBoundarySQL === boundaryMission.canonical) throw new Error('m86 active-boundary predicate was not reversed')
  await setEditor(aliasPage, reversedBoundarySQL)
  await runQuery(aliasPage)
  await aliasPage.locator('.verdict-correct, .verdict-wrong').waitFor({ timeout: 30000 })
  const boundaryVerdict = await aliasPage.locator('.verdict-correct, .verdict-wrong').textContent()
  step('equivalent active-boundary predicate order grades correct', !!await aliasPage.locator('.verdict-correct').count(), boundaryVerdict?.slice(0, 120) ?? '')

  for (const missionId of ['m87', 'm88', 'm89', 'm90']) {
    const mission = MISSIONS.find((candidate) => candidate.id === missionId)
    if (!mission) throw new Error(`${missionId} is missing from the authored mission source`)
    await aliasPage.getByRole('button', { name: /Next ask/ }).click()
    await aliasPage.locator('.ask-title', { hasText: mission.title }).waitFor({ timeout: 30000 })
    await setEditor(aliasPage, mission.canonical)
    await runQuery(aliasPage)
    await aliasPage.locator('.verdict-correct').waitFor({ timeout: 30000 })
  }
  await aliasPage.getByRole('button', { name: /Next ask/ }).click()
  await aliasPage.locator('.ask-title', { hasText: aliasMission.title }).waitFor({ timeout: 120000 })
  await setEditor(aliasPage, aliasMission.fingerprintSQL)
  await runQuery(aliasPage)
  await aliasPage.locator('.verdict-wrong').waitFor({ timeout: 30000 })
  const missingManagerCost = await aliasPage.locator('.verdict-wrong').textContent()
  step('wrong managed-pod logic remains wrong', /manager.{0,30}own|own.{0,30}manager/is.test(missingManagerCost), missingManagerCost?.slice(0, 120) ?? '')
  const swappedColumnSQL = aliasMission.canonical.replace(
    'SELECT manager_id, manager_name, division, direct_reports,',
    'SELECT manager_name, manager_id, division, direct_reports,',
  )
  if (swappedColumnSQL === aliasMission.canonical) throw new Error('m91 output columns were not swapped')
  await setEditor(aliasPage, swappedColumnSQL)
  await runQuery(aliasPage)
  await aliasPage.locator('.verdict-wrong').waitFor({ timeout: 30000 })
  const swappedColumnVerdict = await aliasPage.locator('.verdict-wrong').textContent()
  step('column order remains part of the requested result shape', !!await aliasPage.locator('.verdict-wrong').count(), swappedColumnVerdict?.slice(0, 120) ?? '')
  const flexibleAliasSQL = aliasMission.canonical
    .replaceAll('report_cost', 'direct_report_cost')
    .replaceAll('manager_cost', 'self_cost')
  await setEditor(aliasPage, flexibleAliasSQL)
  await runQuery(aliasPage)
  await aliasPage.locator('.verdict-correct, .verdict-wrong').waitFor({ timeout: 30000 })
  const aliasVerdict = await aliasPage.locator('.verdict-correct, .verdict-wrong').textContent()
  step('equivalent learner aliases grade correct', !!await aliasPage.locator('.verdict-correct').count(), aliasVerdict?.slice(0, 120) ?? '')
  await aliasContext.close()

  // A historically bounded lookup can be expressed with BETWEEN just as
  // correctly as <=. Prove the real m98 grading path accepts that equivalent
  // spelling without either a false red verdict or a false coaching note.
  const cutoffContext = await browser.newContext()
  await keepFirstParty(cutoffContext)
  const cutoffMission = MISSIONS.find((mission) => mission.id === 'm98')
  if (!cutoffMission) throw new Error('m98 is missing from the authored mission source')
  const cutoffMissionIndex = MISSIONS.findIndex((mission) => mission.id === cutoffMission.id)
  const cutoffPrereqs = MISSIONS.slice(0, cutoffMissionIndex).map((mission) => ({ id: mission.id, title: mission.title }))
  await cutoffContext.addInitScript(({ missions }) => {
    const completedAt = '2026-07-16T00:00:00.000Z'
    const receipts = Object.fromEntries(missions.map(({ id, title }) => {
      const receiptId = `smoke:cutoff:${id}`
      return [receiptId, {
        receiptId,
        missionId: id,
        completedAt,
        sql: 'SELECT 1',
        title,
        contentRevision: 'smoke',
        mode: 'campaign',
        hintLevel: 0,
        attemptId: null,
      }]
    }))
    localStorage.setItem('pivot.progress.v2', JSON.stringify({
      version: 2,
      pulls: {},
      simDone: {},
      solveReceipts: receipts,
      quarantinedReceiptIds: [],
      auditionAttempts: {},
      quarantinedAttemptIds: [],
      drafts: {},
      draftTombstones: {},
      seenBadgeIds: [],
      importedEnvelopeIds: [],
      lastMissionId: null,
      lastSeenAt: completedAt,
    }))
  }, { missions: cutoffPrereqs })
  const cutoffPage = await cutoffContext.newPage()
  await cutoffPage.goto(BASE)
  await cutoffPage.getByRole('button', { name: /Open my desk|Back to my desk/ }).click()
  await cutoffPage.locator('.ask-title', { hasText: cutoffMission.title }).waitFor({ timeout: 120000 })
  const betweenCutoffSQL = cutoffMission.canonical.replace(
    `assigned_on <= DATE '2026-06-30'`,
    `assigned_on BETWEEN DATE '1900-01-01' AND DATE '2026-06-30'`,
  )
  if (betweenCutoffSQL === cutoffMission.canonical) throw new Error('m98 assignment cutoff was not rewritten')
  await setEditor(cutoffPage, betweenCutoffSQL)
  await runQuery(cutoffPage)
  await cutoffPage.locator('.verdict-correct, .verdict-wrong').waitFor({ timeout: 30000 })
  const cutoffVerdict = await cutoffPage.locator('.verdict-correct, .verdict-wrong').textContent()
  step(
    'equivalent cutoff BETWEEN syntax grades correct without false coaching',
    !!await cutoffPage.locator('.verdict-correct').count() && !await cutoffPage.locator('.coaching-note').count(),
    cutoffVerdict?.slice(0, 120) ?? '',
  )
  await cutoffContext.close()

  // Existing Parkline evidence can be non-contiguous because the main ladder
  // deliberately allows a two-ahead grace. The assignment must show that
  // evidence without opening two gaps or pretending later parts are sequentially
  // reachable.
  const scenarioEdgeContext = await browser.newContext()
  await keepFirstParty(scenarioEdgeContext)
  await scenarioEdgeContext.addInitScript(() => {
    const completedAt = '2026-07-16T00:00:00.000Z'
    const receipt = {
      receiptId: 'smoke:tiered:m02',
      missionId: 'm02',
      completedAt,
      sql: 'SELECT 1',
      title: 'Prior Star67 evidence',
      contentRevision: 'smoke',
      mode: 'campaign',
      hintLevel: 0,
      attemptId: null,
    }
    localStorage.setItem('pivot.progress.v2', JSON.stringify({
      version: 2,
      pulls: { m02: receipt },
      simDone: {},
      solveReceipts: { [receipt.receiptId]: receipt },
      quarantinedReceiptIds: [],
      auditionAttempts: {},
      quarantinedAttemptIds: [],
      drafts: {},
      draftTombstones: {},
      seenBadgeIds: [],
      importedEnvelopeIds: [],
      lastMissionId: 'm02',
      lastSeenAt: completedAt,
    }))
  })
  const scenarioEdgePage = await scenarioEdgeContext.newPage()
  await scenarioEdgePage.goto(BASE)
  await scenarioEdgePage.getByRole('button', { name: /Open my desk|Back to my desk/ }).click()
  await scenarioEdgePage.locator('.ask-card').waitFor({ timeout: 120000 })
  await scenarioEdgePage.getByRole('button', { name: 'Your desk' }).click()
  await openScenarioLibrary(scenarioEdgePage)
  const scenarioEdge = await scenarioEdgePage.locator('[data-scenario="first-week"]').evaluate((row) => ({ parts: row.getAttribute('data-parts'), copy: row.textContent ?? '' }))
  await scenarioEdgePage.locator('[data-scenario="first-week"] button').click()
  const scenarioEdgeTitle = await scenarioEdgePage.locator('.ask-title').textContent()
  step(
    'scenario preserves prior evidence but continues at the earliest missing part',
    scenarioEdge.parts === '5' && /1 of 5 tasks complete/i.test(scenarioEdge.copy) && scenarioEdgeTitle?.includes(MISSIONS[0].title),
    JSON.stringify({ ...scenarioEdge, title: scenarioEdgeTitle }),
  )
  await scenarioEdgeContext.close()

  // Scenario selection is explicit navigation state. It must not be inferred
  // from a mission id because missions can belong to more than one scenario,
  // and it must not fall back to the global ladder after a correct solve.
  const scenarioRouteContext = await browser.newContext()
  await keepFirstParty(scenarioRouteContext)
  const scenarioRoutePage = await scenarioRouteContext.newPage()
  await scenarioRoutePage.goto(BASE)
  await scenarioRoutePage.getByRole('button', { name: /Open my desk|Back to my desk/ }).click()
  await scenarioRoutePage.locator('.ask-card').waitFor({ timeout: 120000 })
  await scenarioRoutePage.getByRole('button', { name: 'Your desk' }).click()
  await openScenarioLibrary(scenarioRoutePage)
  await scenarioRoutePage.locator('[data-scenario="seat-book-review"] button').click()
  const seatBookFirst = MISSIONS.find((mission) => mission.id === 'm93')
  const seatBookSecond = MISSIONS.find((mission) => mission.id === 'm94')
  const globalFirst = MISSIONS.find((mission) => mission.id === 'm01')
  if (!SEAT_BOOK_SCENARIO || !seatBookFirst || !seatBookSecond || !globalFirst) {
    throw new Error('scenario continuity fixtures are missing from authored content')
  }
  await scenarioRoutePage.locator('.ask-title', { hasText: seatBookFirst.title }).waitFor({ timeout: 15000 })
  const seatBookFirstContext = await scenarioRoutePage.locator('[data-scenario-context="seat-book-review"]').textContent()
  const selectedSession = await scenarioRoutePage.evaluate(() => {
    const raw = localStorage.getItem('pivot.pathSession.v1.parkline-fpa')
    try { return raw ? JSON.parse(raw) : null } catch { return null }
  })
  step(
    'scenario selection keeps explicit identity and content-derived position',
    new RegExp(`Part\\s+1\\s+of\\s+${SEAT_BOOK_SCENARIO.parts}`, 'i').test(seatBookFirstContext ?? '')
      && selectedSession?.lastPathId === 'scenario-library'
      && selectedSession?.lastScenarioId === 'seat-book-review',
    JSON.stringify({ context: seatBookFirstContext, session: selectedSession }),
  )
  await setEditor(scenarioRoutePage, seatBookFirst.canonical)
  await runQuery(scenarioRoutePage)
  await scenarioRoutePage.locator('.verdict-correct').waitFor({ timeout: 30000 })
  await scenarioRoutePage.getByRole('button', { name: 'Next part' }).click()
  await scenarioRoutePage.locator('.ask-title', { hasText: seatBookSecond.title }).waitFor({ timeout: 15000 })
  const seatBookSecondState = await scenarioRoutePage.evaluate(({ scenarioId, parts, globalTitle }) => {
    const context = document.querySelector(`[data-scenario-context="${scenarioId}"]`)
    const title = document.querySelector('.ask-title')?.textContent ?? ''
    return {
      context: context?.textContent ?? '',
      title,
      withinScenario: new RegExp(`Part\\s+2\\s+of\\s+${parts}`, 'i').test(context?.textContent ?? ''),
      avoidedGlobalLadder: !title.includes(globalTitle),
    }
  }, { scenarioId: 'seat-book-review', parts: SEAT_BOOK_SCENARIO.parts, globalTitle: globalFirst.title })
  step(
    'correct scenario part advances within its arc instead of the global ladder',
    seatBookSecondState.withinScenario && seatBookSecondState.avoidedGlobalLadder && seatBookSecondState.title.includes(seatBookSecond.title),
    JSON.stringify(seatBookSecondState),
  )
  await scenarioRoutePage.reload()
  await scenarioRoutePage.getByRole('button', { name: /Open my desk|Back to my desk/ }).click()
  await scenarioRoutePage.locator('.ask-title', { hasText: seatBookSecond.title }).waitFor({ timeout: 120000 })
  const resumedScenario = await scenarioRoutePage.locator('[data-scenario-context="seat-book-review"]').textContent()
  step(
    'reload resumes the earliest incomplete part of the saved scenario',
    new RegExp(`Part\\s+2\\s+of\\s+${SEAT_BOOK_SCENARIO.parts}`, 'i').test(resumedScenario ?? ''),
    resumedScenario ?? '',
  )
  await scenarioRoutePage.getByRole('button', { name: 'Your desk' }).click()
  await scenarioRoutePage.locator('.path-chooser').waitFor()
  await scenarioRoutePage.getByRole('button', { name: /Start next task: Next guided task/i }).click()
  await scenarioRoutePage.locator('.ask-title', { hasText: globalFirst.title }).waitFor({ timeout: 15000 })
  const departedScenarioSession = await scenarioRoutePage.evaluate(() => {
    const raw = localStorage.getItem('pivot.pathSession.v1.parkline-fpa')
    try { return raw ? JSON.parse(raw) : null } catch { return null }
  })
  step(
    'direct queue navigation leaves the active scenario without erasing its bookmark',
    departedScenarioSession?.lastPathId === 'mission-ladder'
      && departedScenarioSession?.lastScenarioId === 'seat-book-review'
      && await scenarioRoutePage.locator('[data-scenario-context]').count() === 0,
    JSON.stringify(departedScenarioSession),
  )
  await scenarioRoutePage.reload()
  await scenarioRoutePage.getByRole('button', { name: /Open my desk|Back to my desk/ }).click()
  await scenarioRoutePage.locator('.ask-title', { hasText: globalFirst.title }).waitFor({ timeout: 120000 })
  step(
    'reload respects the departed broad path instead of resurrecting a scenario',
    await scenarioRoutePage.locator('[data-scenario-context]').count() === 0,
    await scenarioRoutePage.locator('.ask-title').textContent() ?? '',
  )
  await scenarioRouteContext.close()

  // v1 path-session records shipped before scenario identity existed. Missing
  // or unknown scenario ids must degrade to the ordinary global ladder rather
  // than blocking boot or guessing from an overlapping mission.
  const scenarioFallbackContext = await browser.newContext()
  await keepFirstParty(scenarioFallbackContext)
  await scenarioFallbackContext.addInitScript(() => {
    const key = 'pivot.pathSession.v1.parkline-fpa'
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify({
        packId: 'parkline-fpa',
        lastPathId: 'scenario-library',
        updatedAt: '2026-07-16T00:00:00.000Z',
      }))
    }
  })
  const scenarioFallbackPage = await scenarioFallbackContext.newPage()
  await scenarioFallbackPage.goto(BASE)
  await scenarioFallbackPage.getByRole('button', { name: /Open my desk|Back to my desk/ }).click()
  await scenarioFallbackPage.locator('.ask-title', { hasText: globalFirst.title }).waitFor({ timeout: 120000 })
  step(
    'legacy path session without scenario id falls back to the global ladder',
    await scenarioFallbackPage.locator('[data-scenario-context]').count() === 0,
    await scenarioFallbackPage.locator('.ask-title').textContent() ?? '',
  )
  await scenarioFallbackPage.evaluate(() => {
    localStorage.setItem('pivot.pathSession.v1.parkline-fpa', JSON.stringify({
      packId: 'parkline-fpa',
      lastPathId: 'scenario-library',
      lastScenarioId: 'not-an-authored-scenario',
      updatedAt: '2026-07-16T00:00:00.000Z',
    }))
  })
  await scenarioFallbackPage.reload()
  await scenarioFallbackPage.getByRole('button', { name: /Open my desk|Back to my desk/ }).click()
  await scenarioFallbackPage.locator('.ask-title', { hasText: globalFirst.title }).waitFor({ timeout: 120000 })
  step(
    'unknown saved scenario id falls back without inventing scenario context',
    await scenarioFallbackPage.locator('[data-scenario-context]').count() === 0,
    await scenarioFallbackPage.locator('.ask-title').textContent() ?? '',
  )
  await scenarioFallbackContext.close()

  // m09-m14 belong to both board-sprint and planning-close. Their shared
  // receipts must produce different next targets from each explicit scenario.
  const overlappingScenarioContext = await browser.newContext()
  await keepFirstParty(overlappingScenarioContext)
  await overlappingScenarioContext.addInitScript(({ missionIds }) => {
    const completedAt = '2026-07-16T00:00:00.000Z'
    const receipts = Object.fromEntries(missionIds.map((missionId) => {
      const receiptId = `smoke:overlap:${missionId}`
      return [receiptId, {
        receiptId,
        missionId,
        completedAt,
        sql: 'SELECT 1',
        title: `Prior ${missionId} evidence`,
        contentRevision: 'smoke',
        mode: 'campaign',
        hintLevel: 0,
        attemptId: null,
      }]
    }))
    localStorage.setItem('pivot.progress.v2', JSON.stringify({
      version: 2,
      pulls: Object.fromEntries(Object.values(receipts).map((receipt) => [receipt.missionId, receipt])),
      simDone: {},
      solveReceipts: receipts,
      quarantinedReceiptIds: [],
      auditionAttempts: {},
      quarantinedAttemptIds: [],
      drafts: {},
      draftTombstones: {},
      seenBadgeIds: [],
      importedEnvelopeIds: [],
      lastMissionId: missionIds.at(-1) ?? null,
      lastSeenAt: completedAt,
    }))
  }, { missionIds: ['m06', 'm07', 'm08', 'm09', 'm10', 'm11', 'm12', 'm13', 'm14'] })
  const overlappingScenarioPage = await overlappingScenarioContext.newPage()
  await overlappingScenarioPage.goto(BASE)
  await overlappingScenarioPage.getByRole('button', { name: /Open my desk|Back to my desk/ }).click()
  await overlappingScenarioPage.locator('.ask-card').waitFor({ timeout: 120000 })
  await overlappingScenarioPage.getByRole('button', { name: 'Your desk' }).click()
  await openScenarioLibrary(overlappingScenarioPage)
  const overlappingCards = await overlappingScenarioPage.evaluate(() => {
    const read = (id) => {
      const row = document.querySelector(`[data-scenario="${id}"]`)
      return { copy: row?.textContent ?? '', action: row?.querySelector('button')?.textContent?.trim() ?? '' }
    }
    return { board: read('board-sprint'), planning: read('planning-close') }
  })
  step(
    'overlapping receipts retain independent scenario progress',
    /9 of 9 tasks complete/i.test(overlappingCards.board.copy)
      && overlappingCards.board.action === 'Revisit'
      && /6 of 12 tasks complete/i.test(overlappingCards.planning.copy)
      && overlappingCards.planning.action === 'Continue',
    JSON.stringify(overlappingCards),
  )
  await overlappingScenarioPage.locator('[data-scenario="planning-close"] button').click()
  const planningNext = MISSIONS.find((mission) => mission.id === 'm15')
  if (!PLANNING_CLOSE_SCENARIO || !planningNext) throw new Error('overlapping scenario fixtures are missing from authored content')
  await overlappingScenarioPage.locator('.ask-title', { hasText: planningNext.title }).waitFor({ timeout: 15000 })
  const planningContext = await overlappingScenarioPage.locator('[data-scenario-context="planning-close"]').textContent()
  step(
    'explicit overlapping scenario opens its own earliest incomplete part',
    new RegExp(`Part\\s+7\\s+of\\s+${PLANNING_CLOSE_SCENARIO.parts}`, 'i').test(planningContext ?? ''),
    planningContext ?? '',
  )
  await overlappingScenarioContext.close()

  // The final scenario part should close the loop back to the workday card,
  // not fall into the global ladder or leave a dead-end result panel.
  const completedScenarioContext = await browser.newContext()
  await keepFirstParty(completedScenarioContext)
  const seatBookFinal = MISSIONS.find((mission) => mission.id === 'm99')
  if (!seatBookFinal || !SEAT_BOOK_SCENARIO) throw new Error('completed scenario fixtures are missing from authored content')
  const completedSeatBookMissions = MISSIONS.filter((mission) => ['m93', 'm94', 'm95', 'm96', 'm97', 'm98'].includes(mission.id))
  await completedScenarioContext.addInitScript(({ missions }) => {
    const completedAt = '2026-07-16T00:00:00.000Z'
    const receipts = Object.fromEntries(missions.map(({ id, title }) => {
      const receiptId = `smoke:scenario-complete:${id}`
      return [receiptId, {
        receiptId,
        missionId: id,
        completedAt,
        sql: 'SELECT 1',
        title,
        contentRevision: 'smoke',
        mode: 'campaign',
        hintLevel: 0,
        attemptId: null,
      }]
    }))
    localStorage.setItem('pivot.progress.v2', JSON.stringify({
      version: 2,
      pulls: Object.fromEntries(Object.values(receipts).map((receipt) => [receipt.missionId, receipt])),
      simDone: {},
      solveReceipts: receipts,
      quarantinedReceiptIds: [],
      auditionAttempts: {},
      quarantinedAttemptIds: [],
      drafts: {},
      draftTombstones: {},
      seenBadgeIds: [],
      importedEnvelopeIds: [],
      lastMissionId: missions.at(-1)?.id ?? null,
      lastSeenAt: completedAt,
    }))
    localStorage.setItem('pivot.pathSession.v1.parkline-fpa', JSON.stringify({
      packId: 'parkline-fpa',
      lastPathId: 'scenario-library',
      lastScenarioId: 'seat-book-review',
      updatedAt: completedAt,
    }))
  }, { missions: completedSeatBookMissions.map(({ id, title }) => ({ id, title })) })
  const completedScenarioPage = await completedScenarioContext.newPage()
  await completedScenarioPage.goto(BASE)
  await completedScenarioPage.getByRole('button', { name: /Open my desk|Back to my desk/ }).click()
  await completedScenarioPage.locator('.ask-title', { hasText: seatBookFinal.title }).waitFor({ timeout: 120000 })
  await setEditor(completedScenarioPage, seatBookFinal.canonical)
  await runQuery(completedScenarioPage)
  await completedScenarioPage.locator('.verdict-correct').waitFor({ timeout: 30000 })
  await completedScenarioPage.getByRole('button', { name: 'Finish workday' }).click()
  await openScenarioLibrary(completedScenarioPage)
  const completedScenarioCard = completedScenarioPage.locator('[data-scenario="seat-book-review"][data-active="true"]')
  await completedScenarioCard.waitFor({ timeout: 15000 })
  const completedScenarioState = await completedScenarioCard.evaluate((card) => ({
    copy: card.textContent ?? '',
    action: card.querySelector('button')?.textContent?.trim() ?? '',
  }))
  step(
    'final scenario part returns to its active completed workday card',
    new RegExp(`${SEAT_BOOK_SCENARIO.parts}\\s+of\\s+${SEAT_BOOK_SCENARIO.parts}\\s+tasks complete`, 'i').test(completedScenarioState.copy)
      && /current project/i.test(completedScenarioState.copy)
      && completedScenarioState.action === 'Revisit',
    JSON.stringify(completedScenarioState),
  )
  await completedScenarioContext.close()

  const context = await browser.newContext()
  const blockedThirdParty = await keepFirstParty(context)
  const page = await context.newPage()
  const pageErrors = []
  const privateApiRequests = []
  page.on('pageerror', (e) => pageErrors.push(String(e.message)))
  page.on('request', (request) => {
    const requestURL = new URL(request.url())
    if (requestURL.origin === BASE_ORIGIN && requestURL.pathname.startsWith('/api/')) {
      privateApiRequests.push(requestURL.pathname)
    }
  })

  // 1. Cold start
  await page.goto(BASE)
  await page.getByRole('button', { name: /Open my desk|Back to my desk/ }).waitFor({ timeout: 15000 })
  step('intro card renders', true)
  await page.getByRole('button', { name: /Open my desk|Back to my desk/ }).click()

  // 2. Warehouse loads
  await page.locator('.ask-card').waitFor({ timeout: 120000 })
  step('warehouse loaded, workspace visible', true)

  const abortListenerProbe = await page.evaluate(async () => {
    let target = null
    const probe = { adds: 0, removes: 0 }
    const add = AbortSignal.prototype.addEventListener
    const remove = AbortSignal.prototype.removeEventListener
    AbortSignal.prototype.addEventListener = function (type, listener, options) {
      if (type === 'abort' && target?.signal === this) probe.adds += 1
      return add.call(this, type, listener, options)
    }
    AbortSignal.prototype.removeEventListener = function (type, listener, options) {
      if (type === 'abort' && target?.signal === this) probe.removes += 1
      return remove.call(this, type, listener, options)
    }
    try {
      target = new AbortController()
      for (let i = 0; i < 3; i += 1) await window.__engine.runDisplay('SELECT 1 AS listener_probe', target.signal)
      return { ...probe, signalAborted: target.signal.aborted }
    } finally {
      AbortSignal.prototype.addEventListener = add
      AbortSignal.prototype.removeEventListener = remove
    }
  })
  step(
    'display queries release caller abort listeners',
    abortListenerProbe.adds === 3 && abortListenerProbe.removes === 3 && !abortListenerProbe.signalAborted,
    JSON.stringify(abortListenerProbe),
  )
  const missionGuide = await page.locator('.ask-byline--character').evaluate(async (byline) => {
    const image = byline.querySelector('img')
    if (image && !image.complete) {
      await new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true })
        image.addEventListener('error', resolve, { once: true })
      })
    }
    const frame = byline.querySelector('.ask-byline__portrait-frame')
    const frameBox = frame?.getBoundingClientRect()
    const imageStyle = image ? getComputedStyle(image) : null
    return {
      name: byline.querySelector('.byline-name')?.textContent?.trim() ?? '',
      role: byline.querySelector('.byline-role')?.textContent?.trim() ?? '',
      alt: image?.getAttribute('alt') ?? '',
      src: image?.getAttribute('src') ?? '',
      naturalWidth: image?.naturalWidth ?? 0,
      naturalHeight: image?.naturalHeight ?? 0,
      objectFit: imageStyle?.objectFit ?? '',
      frameWidth: Math.round(frameBox?.width ?? 0),
      frameHeight: Math.round(frameBox?.height ?? 0),
    }
  })
  step(
    'first Star67 ask is delivered by Riff with an intact readable portrait',
    missionGuide.name === 'Riff'
      && missionGuide.role === 'CFO'
      && /Riff.*giraffe.*Star67/i.test(missionGuide.alt)
      && /riff-giraffe\.png$/.test(missionGuide.src)
      && missionGuide.naturalWidth === 1024
      && missionGuide.naturalHeight === 1024
      && missionGuide.objectFit === 'contain'
      && missionGuide.frameWidth >= 64
      && missionGuide.frameHeight >= 64,
    JSON.stringify(missionGuide),
  )
  const visibleWorkplaceCopy = await page.locator('.topbar, .ask-card, #database-navigator').allTextContents()
  step(
    'learner-visible workplace copy says Star67 without leaking the legacy pack name',
    visibleWorkplaceCopy.some((copy) => /Star67/i.test(copy))
      && visibleWorkplaceCopy.some((copy) => /Star67 practice workspace/i.test(copy))
      && visibleWorkplaceCopy.every((copy) => !/Parkline|finance workspace/i.test(copy)),
    visibleWorkplaceCopy.join(' | ').slice(0, 180),
  )
  step('warehouse boots first-party-only', true, blockedThirdParty.length ? `blocked ${[...new Set(blockedThirdParty.map((u) => new URL(u).host))].join(', ')}` : 'no third-party requests')
  const runtimeLabel = (await page.locator('.topbar-runtime').textContent())?.trim()
  step(
    'local workspace identifies where work is saved',
    runtimeLabel === 'Saved on this device',
    `label=${JSON.stringify(runtimeLabel)}`,
  )

  // 2b. DATABASE OBJECTS: bind the visible product hierarchy to DuckDB's live
  // catalog, then drive disclosure, preview recovery, insertion, filtering, and
  // the same semantic navigator through both narrow drawer breakpoints.
  const databaseNavigator = page.locator('#database-navigator')
  await databaseNavigator.getByRole('heading', { name: 'Tables (12)' }).waitFor({ timeout: 15000 })
  const semanticNavigator = await page.getByRole('complementary', { name: 'Database objects' }).count()
  const navigatorRuntime = await page.evaluate(async () => {
    const identity = await window.__engine.runRaw('SELECT current_database(), current_schema()')
    const relations = await window.__engine.runRaw(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_catalog = current_database() AND table_schema = current_schema()
      ORDER BY table_name
    `)
    const allColumns = await window.__engine.runRaw(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_catalog = current_database()
        AND table_schema = current_schema()
      ORDER BY table_name, ordinal_position
    `)
    const fields = allColumns.rows.map((row) => ({ relation: String(row[0]), name: String(row[1]), type: String(row[2]) }))
    return {
      database: String(identity.rows[0][0]),
      schema: String(identity.rows[0][1]),
      relations: relations.rows.map((row) => ({ name: String(row[0]), type: String(row[1]).toUpperCase() })),
      fields,
      glColumnCount: fields.filter((field) => field.relation === 'fct_gl_transactions').length,
    }
  })
  const navigatorText = await databaseNavigator.textContent()
  const navigatorIdentityOK = semanticNavigator === 1
    && /Warehouse status\s*Ready on this device/.test(navigatorText)
    && /Star67\s*\/\s*Practice warehouse\s*\/\s*main/.test(navigatorText)
    && !/Finance warehouse/.test(navigatorText)
    && navigatorText.includes(`Local catalog · ${navigatorRuntime.database}.${navigatorRuntime.schema}`)
    && navigatorRuntime.schema === 'main'
  step('Database objects separates product hierarchy from live DuckDB identity', navigatorIdentityOK, `${navigatorRuntime.database}.${navigatorRuntime.schema}`)

  const relationRows = databaseNavigator.locator('[data-relation-name]')
  const visibleRelations = await relationRows.count()
  const viewBadges = await relationRows.locator('.database-relation__type').allTextContents()
  const usedRelations = await databaseNavigator.locator('[data-used-in-ask="true"]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-relation-name')))
  const relationMeta = await relationRows.locator('.database-relation__meta').allTextContents()
  const liveTrainingRelations = navigatorRuntime.relations.filter((relation) => relation.type === 'VIEW')
  step(
    'Database objects lists 12 live views with row counts and ask relevance',
    visibleRelations === 12
      && liveTrainingRelations.length === 12
      && viewBadges.every((badge) => badge.trim() === 'View')
      && relationMeta.every((meta) => /[\d,]+ rows/.test(meta))
      && JSON.stringify(usedRelations) === JSON.stringify(['fct_gl_transactions']),
    `${visibleRelations} rows | used ${usedRelations.join(', ')}`,
  )

  await page.evaluate(() => {
    window.__pivotNavigatorPreviewFaults = 1
    window.__pivotNavigatorPreviewRelease = null
    window.__pivotRawHook = async (sql, proceed) => {
      if (/^SELECT \* FROM "fct_gl_transactions" LIMIT 3$/i.test(String(sql).trim()) && window.__pivotNavigatorPreviewFaults > 0) {
        window.__pivotNavigatorPreviewFaults -= 1
        await new Promise((resolve) => { window.__pivotNavigatorPreviewRelease = resolve })
        throw new Error('__smoke_navigator_preview_fault__')
      }
      return proceed()
    }
  })
  const glRelation = databaseNavigator.locator('[data-relation-name="fct_gl_transactions"]')
  await glRelation.locator('[data-relation-toggle]').click()
  await glRelation.getByText('Loading sample rows…').waitFor()
  await page.evaluate(() => window.__pivotNavigatorPreviewRelease?.())
  await glRelation.getByText('Sample rows unavailable.').waitFor()
  const navigatorRetryVisible = await glRelation.getByRole('button', { name: 'Retry' }).isVisible()
  await glRelation.getByRole('button', { name: 'Retry' }).click()
  await glRelation.locator('.sample-scroll table').waitFor({ timeout: 15000 })
  const profileText = await glRelation.locator('.database-profile').textContent()
  const typedColumns = await glRelation.locator('.database-column__type').count()
  step(
    'table profile exposes typed columns and retryable sample preview',
    navigatorRetryVisible
      && profileText.includes('Table details')
      && profileText.includes('Grain')
      && profileText.includes(`Columns (${navigatorRuntime.glColumnCount})`)
      && profileText.includes('Sample rows')
      && typedColumns === navigatorRuntime.glColumnCount,
    `${typedColumns} typed columns`,
  )
  await page.evaluate(() => { delete window.__pivotRawHook; delete window.__pivotNavigatorPreviewFaults; delete window.__pivotNavigatorPreviewRelease })

  const navigatorOriginalEditor = await readEditorText(page)
  await glRelation.getByRole('button', { name: 'Use table fct_gl_transactions in the editor' }).click()
  await glRelation.getByRole('button', { name: 'Use column account_id in the editor' }).click()
  const insertedNavigatorText = await readEditorText(page)
  step(
    'table and column insertion land in the SQL editor',
    /fct_gl_transactions\s+account_id\s+SELECT/.test(insertedNavigatorText),
    insertedNavigatorText.slice(0, 80),
  )
  await setEditor(page, navigatorOriginalEditor)

  const navigatorFilter = databaseNavigator.getByLabel('Filter tables or columns')
  await navigatorFilter.fill('posted_at')
  const filteredRelations = await databaseNavigator.locator('[data-relation-name]').count()
  const filterMatchText = await databaseNavigator.locator('.database-relation__match').textContent()
  await databaseNavigator.getByRole('button', { name: 'Clear database filter' }).click()
  const clearedRelations = await databaseNavigator.locator('[data-relation-name]').count()
  step(
    'database filter matches a column and clears back to all views',
    filteredRelations === 1 && /posted_at/.test(filterMatchText) && clearedRelations === 12,
    `${filteredRelations} → ${clearedRelations}`,
  )

  const navigatorSeparator = page.getByRole('separator', { name: 'Resize database objects panel' })
  const navigatorWidthBefore = await databaseNavigator.evaluate((element) => Math.round(element.getBoundingClientRect().width))
  await navigatorSeparator.focus()
  await page.keyboard.press('Shift+ArrowRight')
  const navigatorWidthAfter = await databaseNavigator.evaluate((element) => Math.round(element.getBoundingClientRect().width))
  await navigatorSeparator.dblclick()
  const navigatorWidthReset = await databaseNavigator.evaluate((element) => Math.round(element.getBoundingClientRect().width))
  step(
    'database navigator resizes by keyboard and resets deterministically',
    navigatorWidthAfter === navigatorWidthBefore + 40 && navigatorWidthReset === 330,
    `${navigatorWidthBefore} → ${navigatorWidthAfter} → ${navigatorWidthReset}`,
  )

  const workbookOpener = databaseNavigator.getByRole('button', { name: 'See all fields' })
  await workbookOpener.click()
  const workbookSheet = page.locator('[data-warehouse-workbench-sheet]')
  const dataWorkbook = workbookSheet.locator('[data-data-workbook="true"]')
  const relationshipsTab = dataWorkbook.locator('[data-workbook-tab="relationships"] [role="tab"]')
  const relationshipCanvas = dataWorkbook.locator('.relationship-canvas')
  await dataWorkbook.waitFor()
  await relationshipCanvas.waitFor()
  await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'tab' && document.activeElement?.textContent?.trim().endsWith('Relationships'))

  const relationshipShape = await dataWorkbook.evaluate((workbook) => {
    const canvas = workbook.querySelector('.relationship-canvas')
    const relationshipShell = workbook.querySelector('[data-workbook-tab="relationships"]')
    return {
      summary: workbook.querySelector('.data-workbook__heading p')?.textContent?.trim() ?? '',
      tables: canvas?.querySelectorAll('.relationship-canvas__card').length ?? 0,
      fields: canvas?.querySelectorAll('.relationship-canvas__fields li').length ?? 0,
      paths: canvas?.querySelectorAll('.relationship-canvas__edges path').length ?? 0,
      viewportHeight: canvas?.querySelector('.relationship-canvas__viewport')?.clientHeight ?? 0,
      pinned: !!relationshipShell && !relationshipShell.querySelector('.data-workbook__tab-close'),
      selected: relationshipShell?.querySelector('[role="tab"]')?.getAttribute('aria-selected'),
      guidance: canvas?.textContent?.includes('Lines are analysis guidance, not database-enforced keys or cardinality.') ?? false,
      constraintWarning: canvas?.textContent?.includes('not claims about database constraints or cardinality') ?? false,
    }
  })
  step(
    'Relationships is a pinned workbook sheet with the whole live catalog and honest path guidance',
    relationshipShape.tables === 12 && relationshipShape.fields === 83 && relationshipShape.paths === 11
      && relationshipShape.viewportHeight >= 100
      && /12 tables · 83 fields · 11 relationships/.test(relationshipShape.summary)
      && relationshipShape.pinned && relationshipShape.selected === 'true'
      && relationshipShape.guidance && relationshipShape.constraintWarning,
    JSON.stringify(relationshipShape),
  )

  const renderedFields = await relationshipCanvas.locator('.relationship-canvas__card').evaluateAll((cards) => cards.flatMap((card) => {
    const relation = card.querySelector('h3')?.textContent?.trim() ?? ''
    return Array.from(card.querySelectorAll('.relationship-canvas__fields li')).map((field) => ({
      key: `${relation}.${field.querySelector('code')?.textContent?.trim() ?? ''}`,
      type: field.querySelector('span')?.textContent?.trim() ?? '',
    }))
  }))
  const liveFieldTypes = new Map(navigatorRuntime.fields.map((field) => [`${field.relation}.${field.name}`, field.type]))
  const renderedPathText = await relationshipCanvas.locator('.relationship-canvas__sr-only li').allTextContents()
  const renderedPathPairs = renderedPathText.map((text) => {
    const match = text.trim().replace(/\s+/g, ' ').match(/^(\S+) dot (\S+) connects to (\S+) dot (\S+)\.$/)
    return match ? [`${match[1]}.${match[2]}`, `${match[3]}.${match[4]}`] : []
  })
  const fieldsExact = renderedFields.length === navigatorRuntime.fields.length
    && new Set(renderedFields.map((field) => field.key)).size === navigatorRuntime.fields.length
    && renderedFields.every((field) => field.key && liveFieldTypes.get(field.key) === field.type)
  const pathsExact = renderedPathPairs.length === 11 && renderedPathPairs.every(([from, to]) => (
    from && to && liveFieldTypes.has(from) && liveFieldTypes.get(from) === liveFieldTypes.get(to)
  ))
  step('Relationship canvas renders every live typed field once and validates every mapped endpoint', fieldsExact && pathsExact, `fields=${renderedFields.length} relationships=${renderedPathPairs.length}`)

  const relationshipSearch = relationshipCanvas.getByLabel('Find a table or field')
  await relationshipSearch.fill('account_id')
  const accountSearchResult = relationshipCanvas.getByRole('button', { name: 'dim_account · account_id', exact: true })
  await accountSearchResult.focus()
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.activeElement?.querySelector('h3')?.textContent?.trim() === 'dim_account')
  const focusedSearchState = await relationshipCanvas.evaluate((canvas) => ({
    relation: document.activeElement?.querySelector('h3')?.textContent?.trim() ?? '',
    card: canvas.querySelector('.relationship-canvas__card--focused h3')?.textContent?.trim() ?? '',
    field: canvas.querySelector('.relationship-canvas__field--focused code')?.textContent?.trim() ?? '',
    query: canvas.querySelector('.relationship-canvas__search input')?.value ?? '',
    expanded: canvas.querySelector('.relationship-canvas__search input')?.getAttribute('aria-expanded') ?? '',
    resultPopovers: canvas.querySelectorAll('.relationship-canvas__search-results').length,
  }))
  step(
    'relationship search focuses the exact live field in its table card',
    focusedSearchState.relation === 'dim_account'
      && focusedSearchState.card === 'dim_account' && focusedSearchState.field === 'account_id'
      && focusedSearchState.query === 'account_id' && focusedSearchState.expanded === 'false'
      && focusedSearchState.resultPopovers === 0,
    JSON.stringify(focusedSearchState),
  )

  const accountCard = relationshipCanvas.getByRole('article', { name: /^dim_account\./ })
  await accountCard.getByRole('button', { name: 'Open dim_account as a table' }).click()
  const accountTab = dataWorkbook.locator('[data-workbook-tab="table:dim_account"] [role="tab"]')
  const accountPanel = dataWorkbook.locator('[data-workbook-panel="table:dim_account"]')
  const accountGrid = accountPanel.getByRole('grid', { name: 'dim_account data sheet' })
  await accountGrid.waitFor({ timeout: 15000 })
  await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'tab' && document.activeElement?.textContent?.trim() === 'dim_account')
  const accountFirstCell = accountGrid.locator('tbody td').first()
  await accountFirstCell.click()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')

  await relationshipsTab.click()
  const vendorCard = relationshipCanvas.getByRole('article', { name: /^dim_vendor\./ })
  await vendorCard.getByRole('button', { name: 'Open dim_vendor as a table' }).click()
  const vendorTabShell = dataWorkbook.locator('[data-workbook-tab="table:dim_vendor"]')
  await dataWorkbook.getByRole('grid', { name: 'dim_vendor data sheet' }).waitFor({ timeout: 15000 })
  const multiTabShape = await dataWorkbook.evaluate((workbook) => ({
    tabs: Array.from(workbook.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent?.trim() ?? ''),
    tablePanels: workbook.querySelectorAll('[data-workbook-panel^="table:"]').length,
    active: workbook.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() ?? '',
  }))
  step(
    'workbook keeps two live table sheets beside the pinned Relationships sheet',
    JSON.stringify(multiTabShape.tabs) === JSON.stringify(['↔Relationships', 'dim_account', 'dim_vendor'])
      && multiTabShape.tablePanels === 2 && multiTabShape.active === 'dim_vendor',
    JSON.stringify(multiTabShape),
  )

  await vendorTabShell.locator('.data-workbook__tab-close').click()
  await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'tab' && document.activeElement?.textContent?.trim() === 'dim_account')
  const accountSelectedAfterVendorClose = await accountTab.getAttribute('aria-selected')
  const retainedAccountState = {
    coordinate: (await accountPanel.locator('.table-sheet__formula > span').textContent())?.trim() ?? '',
    selectedCells: await accountGrid.locator('td[data-selected="true"]').count(),
  }
  step(
    'switching workbook tabs preserves each mounted table sheet state',
    retainedAccountState.coordinate === 'B2' && retainedAccountState.selectedCells === 1,
    JSON.stringify(retainedAccountState),
  )
  const accountTabShell = dataWorkbook.locator('[data-workbook-tab="table:dim_account"]')
  await accountTabShell.locator('.data-workbook__tab-close').click()
  await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'tab' && document.activeElement?.textContent?.trim().endsWith('Relationships'))
  const relationshipStateAfterClose = await dataWorkbook.evaluate((workbook) => ({
    tabs: workbook.querySelectorAll('[role="tab"]').length,
    selected: workbook.querySelector('[data-workbook-tab="relationships"] [role="tab"]')?.getAttribute('aria-selected'),
    search: workbook.querySelector('.relationship-canvas__search input')?.value ?? '',
  }))
  step(
    'closing the active workbook tab selects its prior table, then the pinned Relationships sheet',
    accountSelectedAfterVendorClose === 'true' && relationshipStateAfterClose.tabs === 1
      && relationshipStateAfterClose.selected === 'true' && relationshipStateAfterClose.search === 'account_id',
    `${focusedSearchState.relation} search → dim_vendor → dim_account → Relationships`,
  )

  await dataWorkbook.getByRole('button', { name: 'Hide workbook' }).click()
  await workbookSheet.waitFor({ state: 'hidden' })
  await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'See all fields')
  step('closing the workbook restores the field-map opener', focusedSearchState.relation === 'dim_account')

  // The workbook's table-tab loading and error states are deliberate surfaces
  // (role=status loading, error + Retry). Force each through the real loadRelation
  // path by stubbing the read-only engine seam for one table, then confirm the message and
  // recovery render correctly.
  await workbookOpener.click()
  await dataWorkbook.waitFor()
  await relationshipCanvas.waitFor()
  await page.evaluate(() => {
    window.__pivotRawHook = async (sql, proceed) => {
      if (/SELECT\s+\*\s+FROM\s+"dim_department"/i.test(String(sql))) {
        throw new Error('__workbook_load_fault__')
      }
      return proceed()
    }
  })
  await relationshipCanvas.getByRole('article', { name: /^dim_department\./ }).getByRole('button', { name: 'Open dim_department as a table' }).click()
  const deptErrorPanel = dataWorkbook.locator('[data-workbook-panel="table:dim_department"]')
  await deptErrorPanel.locator('.data-workbook__table-message--error').waitFor({ timeout: 15000 })
  const deptErrorState = await deptErrorPanel.evaluate((panel) => ({
    loadState: panel.getAttribute('data-load-state'),
    message: panel.querySelector('.data-workbook__table-message--error')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    hasRetry: !!panel.querySelector('button:not([aria-label])'),
    rowsLabel: panel.querySelector('h2')?.textContent?.trim() ?? '',
  }))
  step(
    'workbook table load failure shows a deliberate error with retry',
    deptErrorState.loadState === 'error'
      && /could not load/i.test(deptErrorState.message)
      && /retry/i.test(deptErrorState.message)
      && deptErrorState.hasRetry,
    JSON.stringify(deptErrorState),
  )
  // Restore runRaw and retry; the table should recover into a real sheet.
  await page.evaluate(() => {
    delete window.__pivotRawHook
  })
  await deptErrorPanel.getByRole('button').filter({ hasText: /retry/i }).click()
  await deptErrorPanel.getByRole('grid', { name: 'dim_department data sheet' }).waitFor({ timeout: 15000 })
  const deptRecoveredState = await deptErrorPanel.evaluate((panel) => ({
    loadState: panel.getAttribute('data-load-state'),
    gridRows: panel.querySelectorAll('[role="grid"] tbody tr').length,
  }))
  step(
    'workbook table retry recovers into a real data sheet',
    deptRecoveredState.loadState === 'ready' && deptRecoveredState.gridRows > 0,
    JSON.stringify(deptRecoveredState),
  )
  // Close the recovered tab to return to a clean Relationships sheet.
  await dataWorkbook.locator('[data-workbook-tab="table:dim_department"] .data-workbook__tab-close').click()
  await dataWorkbook.getByRole('button', { name: 'Hide workbook' }).click()
  await workbookSheet.waitFor({ state: 'hidden' })

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(() => {
    const engine = window.__engine
    const original = engine.runRaw
    window.__restoreWorkbenchRunRaw = () => { engine.runRaw = original }
    engine.runRaw = async function (...args) {
      if (/SELECT\s+\*\s+FROM\s+"fct_gl_transactions"/i.test(String(args[0]))) {
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      return original.apply(this, args)
    }
  })
  await glRelation.getByRole('button', { name: 'Open sheet' }).click()
  const dataSheet = page.locator('[data-warehouse-workbench-sheet]')
  const dataGrid = dataSheet.getByRole('grid', { name: 'fct_gl_transactions data sheet' })
  await dataSheet.getByRole('status').waitFor()
  await page.locator('.editor .cm-content').click()
  await dataGrid.waitFor({ timeout: 15000 })
  const readyFocusState = await page.evaluate(() => ({
    stayedInEditor: !!document.activeElement?.closest('.editor'),
    className: document.activeElement?.className ?? '',
  }))
  await page.evaluate(() => { window.__restoreWorkbenchRunRaw?.(); delete window.__restoreWorkbenchRunRaw })
  step(
    'warehouse sheet readiness does not steal focus from the SQL editor',
    readyFocusState.stayedInEditor,
    readyFocusState.className,
  )
  const workbenchSeparator = page.locator('.warehouse-workbench__resizer')
  const desktopWorkbenchShape = await page.evaluate(() => {
    const task = document.querySelector('[data-task-workspace]')
    const sheet = document.querySelector('[data-warehouse-workbench-sheet]')
    const separator = document.querySelector('.warehouse-workbench__resizer')
    const ask = task?.querySelector('.ask-card')
    const editor = task?.querySelector('.editor-block')
    const taskBox = task?.getBoundingClientRect()
    const sheetBox = sheet?.getBoundingClientRect()
    const askBox = ask?.getBoundingClientRect()
    const editorBox = editor?.getBoundingClientRect()
    const visibleInViewport = (box) => !!box && box.width > 0 && box.height > 0
      && box.top >= 0 && box.bottom <= window.innerHeight
      && box.left >= 0 && box.right <= window.innerWidth
    return {
      askVisible: visibleInViewport(askBox) && !!taskBox && askBox.top >= taskBox.top && askBox.bottom <= taskBox.bottom,
      editorMounted: !!editorBox && editorBox.width > 0 && editorBox.height > 0,
      taskScrollable: !!task && task.scrollHeight > task.clientHeight + 1,
      taskScrollTop: task?.scrollTop ?? 0,
      sheetVisible: visibleInViewport(sheetBox),
      sheetTop: sheetBox?.top ?? null,
      sheetHeight: sheetBox?.height ?? null,
      taskBeforeSheet: !!taskBox && !!sheetBox && taskBox.bottom <= sheetBox.top,
      separatorRole: separator?.getAttribute('role'),
      separatorOrientation: separator?.getAttribute('aria-orientation'),
      separatorMin: Number(separator?.getAttribute('aria-valuemin')),
      separatorMax: Number(separator?.getAttribute('aria-valuemax')),
      separatorNow: Number(separator?.getAttribute('aria-valuenow')),
    }
  })
  await page.locator('.editor-block').evaluate((editor) => {
    // Centering the mounted editor makes the same user-visible scroll
    // deterministic on WebKit Linux, where `nearest` can leave the editor's
    // bottom edge just outside the flex scroll pane while the sheet is fixed.
    editor.scrollIntoView({ block: 'center' })
  })
  const scrolledTaskShape = await page.evaluate(({ sheetTop, sheetHeight }) => {
    const task = document.querySelector('[data-task-workspace]')
    const editor = task?.querySelector('.editor-block')
    const sheet = document.querySelector('[data-warehouse-workbench-sheet]')
    const taskBox = task?.getBoundingClientRect()
    const editorBox = editor?.getBoundingClientRect()
    const sheetBox = sheet?.getBoundingClientRect()
    return {
      editorVisible: !!taskBox && !!editorBox && editorBox.width > 0 && editorBox.height > 0
        && editorBox.top >= taskBox.top && editorBox.bottom <= taskBox.bottom,
      taskScrollTop: task?.scrollTop ?? 0,
      sheetVisible: !!sheetBox && sheetBox.width > 0 && sheetBox.height > 0
        && sheetBox.top >= 0 && sheetBox.bottom <= window.innerHeight,
      sheetStationary: !!sheetBox && typeof sheetTop === 'number' && typeof sheetHeight === 'number'
        && Math.abs(sheetBox.top - sheetTop) <= 1 && Math.abs(sheetBox.height - sheetHeight) <= 1,
    }
  }, {
    sheetTop: desktopWorkbenchShape.sheetTop,
    sheetHeight: desktopWorkbenchShape.sheetHeight,
  })
  step(
    'desktop workbench keeps the workbook fixed while its task pane scrolls from ask to editor',
    desktopWorkbenchShape.askVisible && desktopWorkbenchShape.editorMounted
      && desktopWorkbenchShape.taskScrollable && desktopWorkbenchShape.sheetVisible
      && desktopWorkbenchShape.taskBeforeSheet && scrolledTaskShape.editorVisible
      && scrolledTaskShape.taskScrollTop > desktopWorkbenchShape.taskScrollTop
      && scrolledTaskShape.sheetVisible && scrolledTaskShape.sheetStationary,
    JSON.stringify({ initial: desktopWorkbenchShape, scrolled: scrolledTaskShape }),
  )
  step(
    'warehouse workbench exposes a bounded horizontal separator',
    desktopWorkbenchShape.separatorRole === 'separator'
      && desktopWorkbenchShape.separatorOrientation === 'horizontal'
      && Number.isFinite(desktopWorkbenchShape.separatorMin)
      && Number.isFinite(desktopWorkbenchShape.separatorMax)
      && Number.isFinite(desktopWorkbenchShape.separatorNow)
      && desktopWorkbenchShape.separatorMin <= desktopWorkbenchShape.separatorNow
      && desktopWorkbenchShape.separatorNow <= desktopWorkbenchShape.separatorMax
      && desktopWorkbenchShape.separatorNow === Math.max(
        desktopWorkbenchShape.separatorMin,
        Math.min(420, desktopWorkbenchShape.separatorMax),
      ),
    JSON.stringify(desktopWorkbenchShape),
  )

  const defaultSheetHeight = desktopWorkbenchShape.separatorNow
  await workbenchSeparator.focus()
  await page.keyboard.press('ArrowUp')
  await page.waitForFunction((before) => Number(document.querySelector('.warehouse-workbench__resizer')?.getAttribute('aria-valuenow')) !== before, defaultSheetHeight)
  const keyboardSheetHeight = Number(await workbenchSeparator.getAttribute('aria-valuenow'))
  step(
    'warehouse sheet height changes from the keyboard',
    keyboardSheetHeight > defaultSheetHeight,
    `${defaultSheetHeight} → ${keyboardSheetHeight}`,
  )

  const separatorBox = await workbenchSeparator.boundingBox()
  if (!separatorBox) throw new Error('warehouse workbench separator has no pointer target')
  await page.mouse.move(separatorBox.x + separatorBox.width / 2, separatorBox.y + separatorBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(separatorBox.x + separatorBox.width / 2, separatorBox.y - 52, { steps: 4 })
  await page.mouse.up()
  await page.waitForFunction((before) => Number(document.querySelector('.warehouse-workbench__resizer')?.getAttribute('aria-valuenow')) !== before, keyboardSheetHeight)
  const pointerSheetState = await page.evaluate(() => {
    const separator = document.querySelector('.warehouse-workbench__resizer')
    const now = Number(separator?.getAttribute('aria-valuenow'))
    const min = Number(separator?.getAttribute('aria-valuemin'))
    const max = Number(separator?.getAttribute('aria-valuemax'))
    const storageKey = 'pivot.warehouseWorkbenchSheetHeight.v1'
    return { now, min, max, storageKey, storedHeight: localStorage.getItem(storageKey) }
  })
  step(
    'pointer resizing persists the clamped warehouse sheet height',
    pointerSheetState.now !== keyboardSheetHeight
      && pointerSheetState.now >= pointerSheetState.min
      && pointerSheetState.now <= pointerSheetState.max
      && /\.v\d+$/.test(pointerSheetState.storageKey)
      && Number(pointerSheetState.storedHeight) === pointerSheetState.now,
    JSON.stringify(pointerSheetState),
  )
  const sheetShape = await dataGrid.evaluate((grid) => ({
    rows: grid.querySelectorAll('tbody tr').length,
    columns: grid.querySelectorAll('.table-sheet__sort').length,
    stickyHeader: getComputedStyle(grid.querySelector('thead th')).position,
    stickyRows: getComputedStyle(grid.querySelector('.table-sheet__row-number')).position,
    summary: grid.closest('.table-sheet')?.querySelector('.table-sheet__header p')?.textContent?.trim() ?? '',
    preview: grid.closest('.table-sheet')?.querySelector('.table-sheet__truncated')?.textContent?.trim() ?? '',
  }))
  const sheetReadOnly = await dataSheet.getByText('Read only', { exact: true }).isVisible()
  const firstSheetCell = dataGrid.locator('tbody td').first()
  await firstSheetCell.click()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  const selectedCoordinate = (await dataSheet.locator('.table-sheet__formula > span').textContent())?.trim()
  const selectedCells = await dataGrid.locator('td[data-selected="true"]').count()
  step(
    'sheet opens 200 real warehouse rows with frozen coordinates',
    sheetReadOnly && sheetShape.rows === 200 && sheetShape.columns === navigatorRuntime.glColumnCount
      && sheetShape.stickyHeader === 'sticky' && sheetShape.stickyRows === 'sticky'
      && /^200 rows returned/.test(sheetShape.summary)
      && /Showing 200 of 2,736,642 total rows/.test(sheetShape.preview),
    JSON.stringify(sheetShape),
  )
  step(
    'sheet supports Excel-like keyboard cell navigation',
    selectedCoordinate === 'B2' && selectedCells === 1,
    `${selectedCoordinate} | selected=${selectedCells}`,
  )
  const firstVisibleValue = (await firstSheetCell.textContent())?.trim() ?? ''
  await dataSheet.getByPlaceholder('Filter loaded rows').fill(firstVisibleValue)
  const filteredSheetRows = await dataGrid.locator('tbody tr').count()
  await dataSheet.getByPlaceholder('Filter loaded rows').fill('')
  const firstColumnHeader = dataGrid.locator('thead th[role="columnheader"]:not(.table-sheet__corner)').first()
  await firstColumnHeader.getByRole('button').click()
  const firstHeaderSort = await firstColumnHeader.getAttribute('aria-sort')
  await firstColumnHeader.getByRole('button').click()
  const secondHeaderSort = await firstColumnHeader.getAttribute('aria-sort')
  await firstColumnHeader.getByRole('button').click()
  const thirdHeaderSort = await firstColumnHeader.getAttribute('aria-sort')
  step(
    'sheet filtering and tri-state column sorting stay interactive',
    filteredSheetRows > 0 && filteredSheetRows <= 200
      && firstHeaderSort === 'ascending' && secondHeaderSort === 'descending' && thirdHeaderSort === 'none',
    `filter=${filteredSheetRows} | sort=${firstHeaderSort} → ${secondHeaderSort} → ${thirdHeaderSort}`,
  )

  const focusFilter = dataSheet.getByPlaceholder('Filter loaded rows')
  await focusFilter.fill(firstVisibleValue)
  const focusModeButton = dataWorkbook.getByRole('button', { name: 'Focus on workbook' })
  await focusModeButton.click()
  await page.waitForFunction(() => document.querySelector('[data-data-workbook]')?.getAttribute('data-focus-mode') === 'true')
  const desktopFocusState = await page.evaluate((expectedFilter) => {
    const workbook = document.querySelector('[data-data-workbook]')
    const task = document.querySelector('[data-task-workspace]')
    const workbench = document.querySelector('.warehouse-workbench')
    const sheet = document.querySelector('[data-warehouse-workbench-sheet]')
    const toggle = workbook?.querySelector('[aria-label="Show task beside workbook"]')
    const workbenchBox = workbench?.getBoundingClientRect()
    const sheetBox = sheet?.getBoundingClientRect()
    return {
      focusMode: workbook?.getAttribute('data-focus-mode'),
      togglePressed: toggle?.getAttribute('aria-pressed'),
      activeTab: workbook?.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() ?? '',
      taskMounted: !!task?.querySelector('.ask-card') && !!task?.querySelector('.editor-block'),
      taskHidden: task?.hasAttribute('hidden') ?? false,
      taskInert: task?.hasAttribute('inert') ?? false,
      resizers: document.querySelectorAll('.warehouse-workbench__resizer').length,
      workbenchHeight: Math.round(workbenchBox?.height ?? 0),
      sheetHeight: Math.round(sheetBox?.height ?? 0),
      coordinate: sheet?.querySelector('.table-sheet__formula > span')?.textContent?.trim() ?? '',
      filter: sheet?.querySelector('input[placeholder="Filter loaded rows"]')?.value ?? '',
      expectedFilter,
    }
  }, firstVisibleValue)
  step(
    'workbook focus mode fills the desktop workbench while preserving the mounted task',
    desktopFocusState.focusMode === 'true' && desktopFocusState.togglePressed === 'true'
      && desktopFocusState.taskMounted && desktopFocusState.taskHidden && desktopFocusState.taskInert
      && desktopFocusState.resizers === 0 && desktopFocusState.workbenchHeight > 0
      && Math.abs(desktopFocusState.workbenchHeight - desktopFocusState.sheetHeight) <= 1,
    JSON.stringify(desktopFocusState),
  )
  step(
    'entering focus mode retains the active tab, selected cell, and filter',
    desktopFocusState.activeTab === 'fct_gl_transactions' && desktopFocusState.coordinate === 'B2'
      && desktopFocusState.filter === firstVisibleValue,
    JSON.stringify(desktopFocusState),
  )

  await dataGrid.focus()
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelector('[data-data-workbook]')?.getAttribute('data-focus-mode') === 'false')
  const desktopFocusExitState = await page.evaluate((expectedFilter) => {
    const workbook = document.querySelector('[data-data-workbook]')
    const task = document.querySelector('[data-task-workspace]')
    const sheet = document.querySelector('[data-warehouse-workbench-sheet]')
    return {
      workbookVisible: !!workbook && workbook.getBoundingClientRect().height > 0,
      focusMode: workbook?.getAttribute('data-focus-mode'),
      togglePressed: workbook?.querySelector('[aria-label="Focus on workbook"]')?.getAttribute('aria-pressed'),
      activeTab: workbook?.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() ?? '',
      tablePanels: workbook?.querySelectorAll('[data-workbook-panel^="table:"]').length ?? 0,
      coordinate: sheet?.querySelector('.table-sheet__formula > span')?.textContent?.trim() ?? '',
      filter: sheet?.querySelector('input[placeholder="Filter loaded rows"]')?.value ?? '',
      expectedFilter,
      taskHidden: task?.hasAttribute('hidden') ?? true,
      taskInert: task?.hasAttribute('inert') ?? true,
      resizers: document.querySelectorAll('.warehouse-workbench__resizer').length,
    }
  }, firstVisibleValue)
  step(
    'first Escape exits focus mode without closing the workbook or table',
    desktopFocusExitState.workbookVisible && desktopFocusExitState.focusMode === 'false'
      && desktopFocusExitState.activeTab === 'fct_gl_transactions' && desktopFocusExitState.tablePanels === 1,
    JSON.stringify(desktopFocusExitState),
  )
  step(
    'split view restores the task and resizer without losing workbook state',
    desktopFocusExitState.togglePressed === 'false' && desktopFocusExitState.coordinate === 'B2'
      && desktopFocusExitState.filter === firstVisibleValue && !desktopFocusExitState.taskHidden
      && !desktopFocusExitState.taskInert && desktopFocusExitState.resizers === 1,
    JSON.stringify(desktopFocusExitState),
  )
  await focusFilter.fill('')

  const hydrationPage = await context.newPage()
  await hydrationPage.setViewportSize({ width: 1440, height: 1000 })
  await hydrationPage.goto(BASE)
  const hydrationDeskButton = hydrationPage.getByRole('button', { name: /Open my desk|Back to my desk/ })
  if (await hydrationDeskButton.isVisible()) await hydrationDeskButton.click()
  await hydrationPage.locator('.ask-card').waitFor({ timeout: 120000 })
  const hydrationNavigator = hydrationPage.locator('#database-navigator')
  await hydrationNavigator.getByRole('heading', { name: 'Tables (12)' }).waitFor({ timeout: 15000 })
  const hydrationWorkbook = hydrationPage.locator('[data-data-workbook="true"]')
  await hydrationWorkbook.waitFor({ state: 'attached', timeout: 15000 })
  const hydratedWorkbookIdentity = await hydrationWorkbook.evaluate((workbook) => ({
    tabs: Array.from(workbook.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent?.trim() ?? ''),
    active: workbook.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() ?? '',
    activePanel: workbook.querySelector('[data-workbook-panel]:not([hidden])')?.getAttribute('data-workbook-panel') ?? '',
  }))
  step(
    'fresh workspace restores the persisted workbook tab and active identity after the live catalog arrives',
    JSON.stringify(hydratedWorkbookIdentity.tabs) === JSON.stringify(['↔Relationships', 'fct_gl_transactions'])
      && hydratedWorkbookIdentity.active === 'fct_gl_transactions'
      && hydratedWorkbookIdentity.activePanel === 'table:fct_gl_transactions',
    JSON.stringify(hydratedWorkbookIdentity),
  )
  const hydrationGlRelation = hydrationNavigator.locator('[data-relation-name="fct_gl_transactions"]')
  const hydrationOpenSheet = hydrationGlRelation.getByRole('button', { name: 'Open sheet' })
  if (!await hydrationOpenSheet.isVisible()) await hydrationGlRelation.getByRole('button').first().click()
  await hydrationOpenSheet.click()
  await hydrationPage.getByRole('grid', { name: 'fct_gl_transactions data sheet' }).waitFor({ timeout: 15000 })
  const hydratedSheetHeight = Number(await hydrationPage.locator('.warehouse-workbench__resizer').getAttribute('aria-valuenow'))
  step(
    'warehouse sheet preference hydrates in a fresh workspace',
    hydratedSheetHeight === pointerSheetState.now,
    `${pointerSheetState.now} → ${hydratedSheetHeight}`,
  )
  await hydrationPage.close()

  await dataWorkbook.getByRole('button', { name: 'Hide workbook' }).click()
  await dataSheet.waitFor({ state: 'hidden' })
  await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Open sheet')
  await glRelation.getByRole('button', { name: 'Open sheet' }).click()
  const reopenedDataSheet = page.locator('[data-warehouse-workbench-sheet]')
  await reopenedDataSheet.getByRole('grid', { name: 'fct_gl_transactions data sheet' }).waitFor({ timeout: 15000 })
  const retainedWorkbookState = await reopenedDataSheet.evaluate((sheet) => ({
    tabs: Array.from(sheet.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent?.trim() ?? ''),
    active: sheet.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() ?? '',
    coordinate: sheet.querySelector('.table-sheet__formula > span')?.textContent?.trim() ?? '',
  }))
  const reopenedSeparator = page.locator('.warehouse-workbench__resizer')
  const reopenedSheetHeight = Number(await reopenedSeparator.getAttribute('aria-valuenow'))
  const reopenedSeparatorMin = Number(await reopenedSeparator.getAttribute('aria-valuemin'))
  const reopenedSeparatorMax = Number(await reopenedSeparator.getAttribute('aria-valuemax'))
  const expectedResetSheetHeight = Math.max(reopenedSeparatorMin, Math.min(420, reopenedSeparatorMax))
  await reopenedSeparator.dblclick()
  await page.waitForFunction((expected) => Number(document.querySelector('.warehouse-workbench__resizer')?.getAttribute('aria-valuenow')) === expected, expectedResetSheetHeight)
  const resetSheetHeight = Number(await reopenedSeparator.getAttribute('aria-valuenow'))
  step(
    'dismissing and reopening retains the workbook tab and sheet state while double-click resets height',
    JSON.stringify(retainedWorkbookState.tabs) === JSON.stringify(['↔Relationships', 'fct_gl_transactions'])
      && retainedWorkbookState.active === 'fct_gl_transactions' && retainedWorkbookState.coordinate === 'B2'
      && reopenedSheetHeight === pointerSheetState.now && resetSheetHeight === expectedResetSheetHeight,
    `${JSON.stringify(retainedWorkbookState)} | ${pointerSheetState.now} → ${reopenedSheetHeight} → ${resetSheetHeight}`,
  )
  await reopenedDataSheet.getByRole('button', { name: 'Hide workbook' }).click()
  await reopenedDataSheet.waitFor({ state: 'hidden' })

  await page.setViewportSize({ width: 640, height: 800 })
  const dataOpener = page.getByRole('button', { name: 'Open database objects' })
  await dataOpener.click()
  const databaseDialog = page.getByRole('dialog', { name: 'Database objects' })
  await databaseDialog.waitFor()
  await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Close')
  const drawer640 = await page.evaluate(() => {
    const dialog = document.querySelector('#database-navigator')
    const box = dialog?.getBoundingClientRect()
    return {
      fits: document.documentElement.scrollWidth <= window.innerWidth && !!box && box.left >= 0 && box.right <= window.innerWidth,
      focused: document.activeElement?.textContent?.trim() ?? '',
      modal: dialog?.getAttribute('aria-modal'),
    }
  })
  step('narrow Database objects opens as a focused, viewport-safe modal', drawer640.fits && drawer640.focused === 'Close' && drawer640.modal === 'true', JSON.stringify(drawer640))

  await databaseDialog.getByRole('button', { name: 'See all fields' }).click()
  await workbookSheet.waitFor()
  await relationshipCanvas.waitFor()
  await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'tab' && document.activeElement?.textContent?.trim().endsWith('Relationships'))
  const narrowRelationshipShape = await workbookSheet.evaluate((sheet) => {
    const workbook = sheet.querySelector('[data-data-workbook]')
    const panel = workbook?.querySelector('[data-workbook-panel="relationships"]')
    const canvas = workbook?.querySelector('.relationship-canvas')
    const list = canvas?.querySelector('.relationship-canvas__list')
    const viewport = canvas?.querySelector('.relationship-canvas__viewport')
    return {
      sheetHeight: Math.round(sheet.getBoundingClientRect().height),
      viewportHeight: window.innerHeight,
      panelClientHeight: panel?.clientHeight ?? 0,
      panelScrollHeight: panel?.scrollHeight ?? 0,
      listDisplay: list ? getComputedStyle(list).display : '',
      listTables: list?.querySelectorAll(':scope > article').length ?? 0,
      listPaths: list?.querySelectorAll('.relationship-canvas__path-list li').length ?? 0,
      canvasHidden: viewport ? getComputedStyle(viewport).display === 'none' : false,
      docFits: document.documentElement.scrollWidth <= window.innerWidth,
      askPresent: !!document.querySelector('.ask-card'),
      focused: document.activeElement?.textContent?.trim() ?? '',
    }
  })
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Data')
  step(
    'narrow Relationships uses the complete list fallback, scrolls internally, and restores Data on Escape',
    narrowRelationshipShape.sheetHeight <= Math.min(560, Math.ceil(narrowRelationshipShape.viewportHeight * 0.9)) + 1
      && narrowRelationshipShape.panelScrollHeight > narrowRelationshipShape.panelClientHeight
      && narrowRelationshipShape.listDisplay === 'grid' && narrowRelationshipShape.listTables === 12
      && narrowRelationshipShape.listPaths === 11 && narrowRelationshipShape.canvasHidden
      && narrowRelationshipShape.docFits && narrowRelationshipShape.askPresent
      && narrowRelationshipShape.focused.endsWith('Relationships'),
    JSON.stringify(narrowRelationshipShape),
  )

  await dataOpener.click()
  await databaseDialog.waitFor()
  await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Close')

  const narrowGlRelation = databaseDialog.locator('[data-relation-name="fct_gl_transactions"]')
  const narrowSheetButton = narrowGlRelation.getByRole('button', { name: 'Open sheet' })
  if (!await narrowSheetButton.isVisible()) await narrowGlRelation.getByRole('button').first().click()
  await narrowSheetButton.click()
  const narrowDataSheet = page.locator('[data-warehouse-workbench-sheet]')
  const narrowDataGrid = narrowDataSheet.getByRole('grid', { name: 'fct_gl_transactions data sheet' })
  await narrowDataGrid.waitFor({ timeout: 15000 })
  const narrowSheetShape = await narrowDataSheet.evaluate((sheet) => {
    const grid = sheet.querySelector('.table-sheet__grid')
    const task = document.querySelector('[data-task-workspace]')
    const ask = task?.querySelector('.ask-card')
    const editor = task?.querySelector('.editor-block')
    const separator = document.querySelector('.warehouse-workbench__resizer')
    return {
      sheetHeight: Math.round(sheet.getBoundingClientRect().height),
      viewportHeight: window.innerHeight,
      gridClientHeight: grid?.clientHeight ?? 0,
      gridScrollHeight: grid?.scrollHeight ?? 0,
      separatorHidden: !separator || getComputedStyle(separator).display === 'none',
      taskPrecedesSheet: !!task && !!(task.compareDocumentPosition(sheet) & Node.DOCUMENT_POSITION_FOLLOWING),
      askAndEditorPresent: !!ask && !!editor && ask.getBoundingClientRect().height > 0 && editor.getBoundingClientRect().height > 0,
      askPrecedesEditor: !!ask && !!editor && !!(ask.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING),
      docFits: document.documentElement.scrollWidth <= window.innerWidth,
    }
  })
  step(
    'narrow workbench stacks task before a bounded, internally scrolling sheet',
    narrowSheetShape.sheetHeight <= Math.min(560, Math.ceil(narrowSheetShape.viewportHeight * 0.9)) + 1
      && narrowSheetShape.gridScrollHeight > narrowSheetShape.gridClientHeight
      && narrowSheetShape.separatorHidden && narrowSheetShape.taskPrecedesSheet
      && narrowSheetShape.askAndEditorPresent && narrowSheetShape.askPrecedesEditor && narrowSheetShape.docFits,
    JSON.stringify(narrowSheetShape),
  )

  await page.setViewportSize({ width: 720, height: 450 })
  const zoomSheetShape = await narrowDataSheet.evaluate((sheet) => {
    const sheetBox = sheet.getBoundingClientRect()
    const grid = sheet.querySelector('.table-sheet__grid')
    const close = sheet.querySelector('[aria-label="Close fct_gl_transactions table tab"]')?.getBoundingClientRect()
    const footer = sheet.querySelector('.table-sheet__footer')?.getBoundingClientRect()
    return {
      sheetHeight: Math.round(sheetBox.height),
      viewportHeight: window.innerHeight,
      gridClientHeight: grid?.clientHeight ?? 0,
      gridScrollHeight: grid?.scrollHeight ?? 0,
      controlsFit: !!close && !!footer && close.bottom <= sheetBox.bottom && footer.bottom <= sheetBox.bottom,
    }
  })
  step(
    'zoom-equivalent sheet keeps its controls and scrolling grid inside the viewport budget',
    zoomSheetShape.sheetHeight <= Math.min(560, Math.ceil(zoomSheetShape.viewportHeight * 0.9)) + 1
      && zoomSheetShape.gridClientHeight > 0
      && zoomSheetShape.gridScrollHeight > zoomSheetShape.gridClientHeight
      && zoomSheetShape.controlsFit,
    JSON.stringify(zoomSheetShape),
  )
  await page.setViewportSize({ width: 640, height: 800 })
  const narrowFocusButton = narrowDataSheet.getByRole('button', { name: 'Focus on workbook' })
  // A preceding 200%-equivalent viewport can leave the sheet scrolled below
  // the fold on slower CI runners. Make the next control explicitly visible
  // before clicking it so the browser proof tests the product action rather
  // than Playwright's implicit scroll race.
  await narrowFocusButton.scrollIntoViewIfNeeded()
  await narrowFocusButton.waitFor({ state: 'visible', timeout: 15000 })
  await narrowFocusButton.click()
  await page.waitForFunction(() => document.querySelector('[data-data-workbook]')?.getAttribute('data-focus-mode') === 'true')
  const narrowFocusState = await page.evaluate(() => {
    const main = document.querySelector('.main')
    const workbench = document.querySelector('.warehouse-workbench')
    const sheet = document.querySelector('[data-warehouse-workbench-sheet]')
    const grid = sheet?.querySelector('.table-sheet__grid')
    const task = document.querySelector('[data-task-workspace]')
    const workbook = document.querySelector('[data-data-workbook]')
    const mainBox = main?.getBoundingClientRect()
    const workbenchBox = workbench?.getBoundingClientRect()
    const sheetBox = sheet?.getBoundingClientRect()
    return {
      viewportHeight: window.innerHeight,
      mainHeight: Math.round(mainBox?.height ?? 0),
      workbenchHeight: Math.round(workbenchBox?.height ?? 0),
      sheetHeight: Math.round(sheetBox?.height ?? 0),
      gridClientHeight: grid?.clientHeight ?? 0,
      gridScrollHeight: grid?.scrollHeight ?? 0,
      docFits: document.documentElement.scrollWidth <= window.innerWidth,
      sheetFits: !!sheetBox && sheetBox.top >= 0 && sheetBox.bottom <= window.innerHeight + 1,
      activeTab: workbook?.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() ?? '',
      taskMounted: !!task?.querySelector('.ask-card') && !!task?.querySelector('.editor-block'),
      taskHidden: task?.hasAttribute('hidden') ?? false,
      taskInert: task?.hasAttribute('inert') ?? false,
      resizers: document.querySelectorAll('.warehouse-workbench__resizer').length,
    }
  })
  step(
    'narrow focus mode fills the usable pane with a live scrolling grid',
    narrowFocusState.mainHeight > 0 && narrowFocusState.workbenchHeight > 0
      && Math.abs(narrowFocusState.workbenchHeight - narrowFocusState.sheetHeight) <= 1
      && narrowFocusState.gridClientHeight > 0 && narrowFocusState.gridScrollHeight > narrowFocusState.gridClientHeight
      && narrowFocusState.docFits && narrowFocusState.sheetFits && narrowFocusState.activeTab === 'fct_gl_transactions'
      && narrowFocusState.taskMounted && narrowFocusState.taskHidden && narrowFocusState.taskInert
      && narrowFocusState.resizers === 0,
    JSON.stringify(narrowFocusState),
  )

  await narrowDataGrid.focus()
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelector('[data-data-workbook]')?.getAttribute('data-focus-mode') === 'false')
  const narrowFocusExitState = await page.evaluate(() => {
    const workbook = document.querySelector('[data-data-workbook]')
    const task = document.querySelector('[data-task-workspace]')
    return {
      focusMode: workbook?.getAttribute('data-focus-mode'),
      activeTab: workbook?.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() ?? '',
      tablePanels: workbook?.querySelectorAll('[data-workbook-panel^="table:"]').length ?? 0,
      taskVisible: !!task && !task.hasAttribute('hidden') && !task.hasAttribute('inert'),
      tableCloseVisible: !!workbook?.querySelector('[aria-label="Close fct_gl_transactions table tab"]'),
    }
  })
  step(
    'narrow first Escape restores split view without closing the table',
    narrowFocusExitState.focusMode === 'false' && narrowFocusExitState.activeTab === 'fct_gl_transactions'
      && narrowFocusExitState.tablePanels === 1 && narrowFocusExitState.taskVisible
      && narrowFocusExitState.tableCloseVisible,
    JSON.stringify(narrowFocusExitState),
  )
  await narrowDataSheet.locator('[data-workbook-tab="table:fct_gl_transactions"] .data-workbook__tab-close').click()
  await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'tab' && document.activeElement?.textContent?.trim().endsWith('Relationships'))
  await page.keyboard.press('Escape')
  await narrowDataSheet.waitFor({ state: 'hidden' })
  await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Data')
  await dataOpener.click()
  await databaseDialog.waitFor()
  await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Close')

  await databaseDialog.evaluate((dialog) => {
    const focusable = Array.from(dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'))
      .filter((element) => element.getClientRects().length > 0
        && !(element.tagName !== 'SUMMARY' && element.closest('details:not([open])')))
    focusable.at(-1)?.focus()
  })
  await page.keyboard.press('Tab')
  const navigatorTrapped = await page.evaluate(() => ({
    inside: document.querySelector('#database-navigator')?.contains(document.activeElement) ?? false,
    focused: document.activeElement?.textContent?.trim() ?? '',
  }))
  step('Database objects drawer wraps Tab to Close', navigatorTrapped.inside && navigatorTrapped.focused === 'Close', JSON.stringify(navigatorTrapped))
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Data')
  const navigatorEscape = await page.evaluate(() => ({
    modal: document.querySelector('#database-navigator')?.getAttribute('aria-modal'),
    focused: document.activeElement?.textContent?.trim() ?? '',
  }))
  step('Escape closes Database objects and restores its opener', navigatorEscape.modal === null && navigatorEscape.focused === 'Data', JSON.stringify(navigatorEscape))

  await page.setViewportSize({ width: 320, height: 800 })
  await dataOpener.click()
  await page.getByRole('dialog', { name: 'Database objects' }).waitFor()
  await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Close')
  const drawer320Fits = await page.evaluate(() => {
    const box = document.querySelector('#database-navigator')?.getBoundingClientRect()
    return document.documentElement.scrollWidth <= window.innerWidth && !!box && box.left >= 0 && box.right <= window.innerWidth
  })
  step('Database objects remains available without overflow at 320 CSS pixels', drawer320Fits)

  await page.getByRole('dialog', { name: 'Database objects' }).getByRole('button', { name: 'See all fields' }).click()
  await workbookSheet.waitFor()
  await relationshipCanvas.waitFor()
  await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'tab' && document.activeElement?.textContent?.trim().endsWith('Relationships'))
  const relationship320Shape = await workbookSheet.evaluate((sheet) => {
    const list = sheet.querySelector('.relationship-canvas__list')
    const firstCard = list?.querySelector(':scope > article')
    const sheetBox = sheet.getBoundingClientRect()
    return {
      columns: list ? getComputedStyle(list).gridTemplateColumns.split(' ').filter(Boolean).length : 0,
      listDisplay: list ? getComputedStyle(list).display : '',
      tables: list?.querySelectorAll(':scope > article').length ?? 0,
      paths: list?.querySelectorAll('.relationship-canvas__path-list li').length ?? 0,
      docFits: document.documentElement.scrollWidth <= window.innerWidth,
      cardFits: !!firstCard && firstCard.getBoundingClientRect().left >= sheetBox.left
        && firstCard.getBoundingClientRect().right <= sheetBox.right,
      sheetHeight: Math.round(sheetBox.height),
      viewportHeight: window.innerHeight,
    }
  })
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'Data')
  step(
    'Relationships remains a complete single-column workbook sheet at 320 CSS pixels',
    relationship320Shape.columns === 1 && relationship320Shape.listDisplay === 'grid'
      && relationship320Shape.tables === 12 && relationship320Shape.paths === 11
      && relationship320Shape.docFits && relationship320Shape.cardFits
      && relationship320Shape.sheetHeight <= Math.min(560, Math.ceil(relationship320Shape.viewportHeight * 0.9)) + 1,
    JSON.stringify(relationship320Shape),
  )
  await page.setViewportSize({ width: 1280, height: 720 })

  // 3. Mission 1: pre-filled query runs and grades green with ZERO typing
  const editorText = await readEditorText(page)
  step('mission 1 pre-filled', editorText.includes('count(*)'), editorText.slice(0, 60))
  const namedEditor = page.getByRole('textbox', { name: 'SQL editor', exact: true })
  step('SQL editor has a usable accessible name', await namedEditor.count() === 1)
  await page.locator('.editor .cm-content').click()
  const editorFocusState = await page.evaluate(() => {
    const block = document.querySelector('.editor-block')
    const style = block ? getComputedStyle(block) : null
    return { focusWithin: block?.matches(':focus-within') ?? false, shadow: style?.boxShadow ?? 'none' }
  })
  step('SQL editor has visible keyboard focus', editorFocusState.focusWithin && editorFocusState.shadow !== 'none', JSON.stringify(editorFocusState))
  await page.keyboard.press('Escape')
  await page.keyboard.press('Tab')
  const editorExitState = await page.evaluate(() => ({
    focused: document.activeElement?.textContent?.trim() ?? '',
    tag: document.activeElement?.tagName ?? '',
    hint: document.querySelector('.editor-keyboard-hint')?.textContent?.trim() ?? '',
  }))
  step('SQL editor explains and supports keyboard exit', editorExitState.tag === 'BUTTON' && /Run/.test(editorExitState.focused) && /Esc.*Tab/i.test(editorExitState.hint), JSON.stringify(editorExitState))
  await setEditor(page, '')
  await page.locator('.editor .cm-content').click()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Tab')
  const blankEditorExit = await page.evaluate(() => ({
    focused: document.activeElement?.textContent?.trim() ?? '',
    outside: !document.querySelector('.editor-block')?.contains(document.activeElement),
  }))
  step('blank SQL can leave the editor without a disabled-focus trap', blankEditorExit.outside && blankEditorExit.focused === 'Your desk', JSON.stringify(blankEditorExit))
  await setEditor(page, editorText)
  const adaptiveHelpButton = page.getByRole('button', { name: 'Give me the next step', exact: true })
  step('one adaptive coaching action is visible before a completed result', await adaptiveHelpButton.isVisible())
  const t0 = Date.now()
  await runQuery(page)
  await page.locator('.verdict-correct').waitFor({ timeout: 30000 })
  step('mission 1 graded correct', true, `${Date.now() - t0}ms from click to green`)

  // A completed mission must remain navigable even when a later retry hits a
  // normal SQL error. The error detail and raw disclosure are useful, but they
  // cannot strand the learner at a finished desk.
  await setEditor(page, 'SELECT * FROM table_that_does_not_exist;')
  await runQuery(page)
  await page.locator('.verdict-error').waitFor({ timeout: 30000 })
  const deliveredAfterError = page.locator('.delivered-bar')
  step(
    'a completed mission keeps Next ask after a later SQL error',
    await deliveredAfterError.isVisible() && await deliveredAfterError.getByRole('button', { name: /Next ask/ }).isVisible(),
  )
  const rawDisclosure = page.locator('.disclosure')
  await rawDisclosure.waitFor({ state: 'visible' })
  if (await rawDisclosure.getAttribute('aria-expanded') !== 'true') await rawDisclosure.click()
  step(
    'engine error disclosure exposes its expanded region',
    await rawDisclosure.getAttribute('aria-expanded') === 'true'
      && await page.locator('#raw-engine-error').isVisible(),
  )
  await deliveredAfterError.getByRole('button', { name: /Next ask/ }).click()
  await page.locator('.ask-card').waitFor()

  // 4. Next ask navigation
  step('advanced to mission 2', (await page.locator('.ask-title').textContent())?.includes('One number for the board deck'))

  // 5. Wrong answer → warm diagnostic (not a bare red X)
  await setEditor(page, `SELECT sum(amount) FROM fct_gl_transactions WHERE account_id = '4000'`)
  await runQuery(page)
  await page.locator('.verdict-wrong, .verdict-correct').waitFor({ timeout: 30000 })
  const wrongText = await page.locator('.verdict-wrong').textContent().catch(() => null)
  step('wrong answer gets a diagnostic', !!wrongText && wrongText.length > 40, (wrongText ?? '').slice(0, 90))

  // One stable action adapts to the evidence already on screen. Its evidence
  // is bound to the SQL that produced the result and the local response never
  // leaves the browser.
  const reviewButton = page.getByRole('button', { name: 'Give me the next step', exact: true })
  step(
    'a completed result keeps the single coaching action available',
    await reviewButton.isVisible() && await reviewButton.isEnabled(),
  )

  const staleReviewSQL = `${await readEditorText(page)}\n-- refresh Frosty's evidence`
  await setEditor(page, staleReviewSQL)
  await page.waitForFunction(() => document.querySelector('.workspace')?.getAttribute('data-run-evidence-state') === 'stale')
  const staleReviewState = await page.evaluate(() => ({
    route: document.querySelector('.coach-panel__route')?.textContent?.trim() ?? '',
    responseVisible: !!document.querySelector('.coach-response'),
  }))
  step(
    'editing SQL makes the current coaching response stale',
    /current draft|draft has not produced a current result/i.test(staleReviewState.route)
      && !staleReviewState.responseVisible,
    JSON.stringify(staleReviewState),
  )

  await runQuery(page)
  await page.locator('.verdict-wrong').waitFor({ timeout: 30000 })
  await page.waitForFunction(() => document.querySelector('.workspace')?.getAttribute('data-run-evidence-state') === 'current')
  const refreshedReviewReady = await reviewButton.isEnabled()

  await page.setViewportSize({ width: 320, height: 800 })
  const narrowReviewShape = await page.evaluate(() => {
    const panel = document.querySelector('.coach-panel')
    const button = document.querySelector('.coach-panel__action')
    const panelBox = panel?.getBoundingClientRect()
    const buttonBox = button?.getBoundingClientRect()
    const inside = (box) => !!panelBox && !!box
      && box.left >= panelBox.left - 1
      && box.right <= panelBox.right + 1
    return {
      documentFits: document.documentElement.scrollWidth <= window.innerWidth,
      buttonFits: inside(buttonBox),
    }
  })
  step(
    'the single coaching action stays legible without horizontal overflow at 320 CSS pixels',
    narrowReviewShape.documentFits
      && narrowReviewShape.buttonFits,
    JSON.stringify(narrowReviewShape),
  )
  await page.setViewportSize({ width: 1280, height: 720 })

  // A completed result routes the one action to an advisory review. The local
  // build must not call a cloud endpoint or mutate graded evidence.
  await page.waitForFunction(() => {
    const read = () => Object.keys(localStorage)
      .filter((key) => key.startsWith('pivot.progress.'))
      .sort()
      .map((key) => localStorage.getItem(key))
      .join('\u0001')
    const first = read()
    return new Promise((resolve) => setTimeout(() => resolve(read() === first), 600))
  }, { timeout: 5000 }).catch(() => {})
  const reviewCoachRequests = []
  const recordReviewCoachRequest = (request) => {
    if (new URL(request.url()).pathname === '/api/coach') reviewCoachRequests.push(request)
  }
  page.on('request', recordReviewCoachRequest)
  const reviewProofBefore = await page.evaluate(() => {
    const raw = Object.keys(localStorage)
      .filter((key) => key.startsWith('pivot.progress.'))
      .sort()
      .map((key) => localStorage.getItem(key)).join('\u0001')
    // The review invariant is about GRADED EVIDENCE, not the whole progress
    // blob: a review click must not create, remove, or alter pulls/solves/
    // attempts/badges/quarantines. Drafts and lastSeenAt are legitimate
    // user-state that may drift on a debounced autosave; they are not evidence.
    let parsed = {}
    try { parsed = JSON.parse(localStorage.getItem('pivot.progress.v2') ?? '{}') } catch { parsed = {} }
    const evidence = {
      pulls: parsed.pulls,
      solveReceipts: parsed.solveReceipts,
      auditionAttempts: parsed.auditionAttempts,
      simDone: parsed.simDone,
      seenBadgeIds: parsed.seenBadgeIds,
      quarantinedReceiptIds: parsed.quarantinedReceiptIds,
      quarantinedAttemptIds: parsed.quarantinedAttemptIds,
    }
    return {
      progress: { 'pivot.progress.v2': raw },
      evidence,
      result: document.querySelector('.results [data-table-sheet="true"]')?.textContent ?? '',
      verdict: document.querySelector('.verdict-wrong')?.textContent ?? '',
      runEvidence: document.querySelector('.workspace')?.getAttribute('data-run-evidence-state') ?? '',
    }
  })
  const reviewSQLBefore = await readEditorText(page)
  await reviewButton.click()
  await page.locator('.coach-response').waitFor({ timeout: 15000 })
  const reviewProofAfter = await page.evaluate(() => {
    const raw = Object.keys(localStorage)
      .filter((key) => key.startsWith('pivot.progress.'))
      .sort()
      .map((key) => localStorage.getItem(key)).join('\u0001')
    let parsed = {}
    try { parsed = JSON.parse(localStorage.getItem('pivot.progress.v2') ?? '{}') } catch { parsed = {} }
    const evidence = {
      pulls: parsed.pulls,
      solveReceipts: parsed.solveReceipts,
      auditionAttempts: parsed.auditionAttempts,
      simDone: parsed.simDone,
      seenBadgeIds: parsed.seenBadgeIds,
      quarantinedReceiptIds: parsed.quarantinedReceiptIds,
      quarantinedAttemptIds: parsed.quarantinedAttemptIds,
    }
    const focused = document.activeElement
    return {
      progress: { 'pivot.progress.v2': raw },
      evidence,
      result: document.querySelector('.results [data-table-sheet="true"]')?.textContent ?? '',
      verdict: document.querySelector('.verdict-wrong')?.textContent ?? '',
      runEvidence: document.querySelector('.workspace')?.getAttribute('data-run-evidence-state') ?? '',
      source: document.querySelector('.coach-response__eyebrow')?.textContent?.trim() ?? '',
      assessment: document.querySelector('.coach-response__assessment')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      focused: `${focused?.tagName ?? 'none'}.${focused?.className ?? ''}`,
      route: document.querySelector('.coach-panel__route')?.textContent?.trim() ?? '',
    }
  })
  const reviewSQLAfter = await readEditorText(page)
  page.off('request', recordReviewCoachRequest)

  const localPreview = ['localhost', '127.0.0.1', '::1'].includes(new URL(BASE).hostname)
  step(
    'the adaptive action returns an explicitly advisory private assessment',
    refreshedReviewReady
      && localPreview
      && reviewCoachRequests.length === 0
      && /built-in.*private/i.test(reviewProofAfter.source)
      && /Frosty’s read/i.test(reviewProofAfter.assessment)
      && /On track|Needs revision|Uncertain/.test(reviewProofAfter.assessment)
      && /Advisory/i.test(reviewProofAfter.assessment)
      && /current result|current draft/i.test(reviewProofAfter.route),
    JSON.stringify({
      localPreview,
      requests: reviewCoachRequests.length,
      source: reviewProofAfter.source,
      assessment: reviewProofAfter.assessment,
      route: reviewProofAfter.route,
    }),
  )
  // The review invariant is about GRADED EVIDENCE: the coaching click
  // must not create, remove, or alter pulls/solves/attempts/badges/quarantines.
  // Drafts and lastSeenAt are legitimate user-state that may drift on a
  // debounced autosave; they are not evidence and are out of scope here.
  const evidenceUnchanged = canonicalJSONStringify(reviewProofAfter.evidence) === canonicalJSONStringify(reviewProofBefore.evidence)
  const reviewImmutabilityOk = reviewSQLAfter === reviewSQLBefore
    && reviewProofAfter.result === reviewProofBefore.result
    && reviewProofAfter.verdict === reviewProofBefore.verdict
    && reviewProofAfter.verdict.length > 0
    && evidenceUnchanged
    && reviewProofAfter.runEvidence === reviewProofBefore.runEvidence
    && reviewProofAfter.runEvidence === 'current'
  let evidenceDelta = null
  if (!evidenceUnchanged) {
    const beforeKeys = new Set(Object.keys(reviewProofBefore.evidence ?? {}))
    const afterKeys = new Set(Object.keys(reviewProofAfter.evidence ?? {}))
    evidenceDelta = {
      added: [...afterKeys].filter((k) => !beforeKeys.has(k)),
      removed: [...beforeKeys].filter((k) => !afterKeys.has(k)),
      changed: [...afterKeys].filter((k) => beforeKeys.has(k) && canonicalJSONStringify(reviewProofBefore.evidence[k]) !== canonicalJSONStringify(reviewProofAfter.evidence[k])),
    }
  }
  step(
    'coaching leaves SQL, result, exact verdict, and graded evidence unchanged',
    reviewImmutabilityOk,
    JSON.stringify({
      sqlUnchanged: reviewSQLAfter === reviewSQLBefore,
      resultUnchanged: reviewProofAfter.result === reviewProofBefore.result,
      verdictUnchanged: reviewProofAfter.verdict === reviewProofBefore.verdict,
      evidenceUnchanged,
      runEvidence: `${reviewProofBefore.runEvidence} → ${reviewProofAfter.runEvidence}`,
      evidenceDelta,
    }),
  )

  // Drafts route the same action back to a nudge and never pretend that stale
  // results are current. There are no second/hidden hint buttons to discover.
  const draftCoachRequests = []
  const recordDraftCoachRequest = (request) => {
    if (new URL(request.url()).pathname === '/api/coach') draftCoachRequests.push(request)
  }
  page.on('request', recordDraftCoachRequest)
  await setEditor(page, `${await readEditorText(page)}\n-- start a fresh draft`)
  await page.waitForFunction(() => document.querySelector('.workspace')?.getAttribute('data-run-evidence-state') === 'stale')
  await reviewButton.click()
  await page.locator('.coach-response').waitFor({ timeout: 15000 })
  const draftCoachProof = await page.evaluate(() => ({
    source: document.querySelector('.coach-response__eyebrow')?.textContent?.trim() ?? '',
    route: document.querySelector('.coach-panel__route')?.textContent?.trim() ?? '',
    assessment: document.querySelector('.coach-response__assessment')?.textContent?.trim() ?? '',
    controls: Array.from(document.querySelectorAll('.coach-panel button')).map((button) => button.textContent?.trim()),
    hiddenOldControls: Array.from(document.querySelectorAll('.coach-panel button'))
      .filter((button) => /Schema|Relationships|Rehearse|Review my attempt|Show me|Stuck\?/i.test(button.textContent ?? ''))
      .map((button) => button.textContent?.trim()),
  }))
  page.off('request', recordDraftCoachRequest)
  step(
    'one adaptive action is the only coaching control on a stale draft',
    draftCoachRequests.length === 0
      && /built-in.*private/i.test(draftCoachProof.source)
      && /current draft|draft has not produced a current result/i.test(draftCoachProof.route)
      && !draftCoachProof.assessment
      && draftCoachProof.controls.length === 1
      && draftCoachProof.controls[0] === 'Give me the next step'
      && draftCoachProof.hiddenOldControls.length === 0,
    JSON.stringify({ ...draftCoachProof, requests: draftCoachRequests.length }),
  )

  // 6. Right answer for mission 2
  await page.evaluate(() => {
    window.__pivotOriginalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function () { throw new DOMException('Smoke quota full', 'QuotaExceededError') }
  })
  const m02LearnerAliasSQL = `SELECT round(sum(amount), 2) AS A FROM fct_gl_transactions WHERE account_id = '4000' AND txn_date BETWEEN DATE '2026-03-01' AND DATE '2026-03-31'`
  await setEditor(page, m02LearnerAliasSQL)
  await runQuery(page)
  await page.locator('.verdict-correct').waitFor({ timeout: 30000 })
  step('mission 2 accepts a learner-chosen output alias', true)
  const storageWarning = await page.locator('.storage-warning').textContent()
  step('storage failure keeps the solved tab usable', /still works.*isn't saving/is.test(storageWarning) && !!await page.locator('.verdict-correct').count(), storageWarning.slice(0, 100))
  await page.evaluate(() => { Storage.prototype.setItem = window.__pivotOriginalSetItem })

  // Keep Run in place while it is busy. Replacing it with Cancel at the same
  // coordinates turned an ordinary double-click into an accidental restart.
  await page.evaluate(() => {
    window.__pivotDisplayCalls = 0
    window.__pivotDisplayHook = async (sql, signal, proceed) => {
      window.__pivotDisplayCalls += 1
      return proceed()
    }
  })
  await setEditor(page, 'SELECT count(*) AS customers FROM dim_customer')
  const runBox = await page.getByRole('button', { name: /Run/ }).boundingBox()
  await page.mouse.click(runBox.x + runBox.width / 2, runBox.y + runBox.height / 2, { clickCount: 2, delay: 40 })
  await page.locator('.table-sheet__grid tbody td', { hasText: '9,500' }).waitFor({ timeout: 30000 })
  const doubleRunState = await page.evaluate(() => ({
    calls: window.__pivotDisplayCalls,
    cancelled: /cancelled/i.test(document.querySelector('.results')?.textContent ?? ''),
  }))
  step('double-click Run starts once without cancelling', doubleRunState.calls === 1 && !doubleRunState.cancelled, JSON.stringify(doubleRunState))
  await page.evaluate(() => { delete window.__pivotDisplayHook })

  // 7. Error translation: bad column name
  await setEditor(page, `SELECT dept FROM fct_gl_transactions LIMIT 5`)
  await runQuery(page)
  await page.locator('.verdict-error').waitFor({ timeout: 30000 })
  let errText = await page.locator('.verdict-error').textContent()
  step('error is translated (no bare Binder Error)', !errText.startsWith('Binder'), errText.slice(0, 90))

  // A local-only build must not let a free-form DuckDB table function turn a
  // learner query into a remote request. The context route blocks any such
  // request; the invariant is stronger: the guard must prevent the attempt.
  const blockedBeforeRemoteSQL = blockedThirdParty.length
  await setEditor(page, `SELECT * FROM read_parquet('https://example.com/remote.parquet')`)
  await runQuery(page)
  await page.locator('.verdict-error').waitFor({ timeout: 30000 })
  const remoteSQLText = await page.locator('.verdict-error').textContent()
  step(
    'remote SQL sources are rejected before any outbound request',
    blockedThirdParty.length === blockedBeforeRemoteSQL
      && /stays on this device|nothing was sent anywhere/i.test(remoteSQLText ?? ''),
    JSON.stringify({ attemptedRequests: blockedThirdParty.length - blockedBeforeRemoteSQL, copy: remoteSQLText?.slice(0, 140) }),
  )

  // Restore the ordinary binder error before the coaching assertions below;
  // both tests intentionally share this long-lived real user-flow page.
  await setEditor(page, `SELECT dept FROM fct_gl_transactions LIMIT 5`)
  await runQuery(page)
  await page.locator('.verdict-error').waitFor({ timeout: 30000 })
  errText = await page.locator('.verdict-error').textContent()

  // Frosty is learner-invoked and advisory. An offline build answers locally;
  // an AI-enabled deployment makes exactly one explicit first-party POST.
  // Neither transport may edit SQL or replace the deterministic verdict.
  const coachRequests = []
  const recordCoachRequest = (request) => {
    if (new URL(request.url()).pathname === '/api/coach') coachRequests.push(request)
  }
  page.on('request', recordCoachRequest)
  await page.waitForTimeout(150)
  const coachResponseBeforeClick = await page.locator('.coach-response').count()
  step(
    'Frosty waits for an explicit learner action',
    coachRequests.length === 0 && coachResponseBeforeClick === 0,
    `requests=${coachRequests.length} responses=${coachResponseBeforeClick}`,
  )
  const sqlBeforeCoach = await readEditorText(page)
  const explainErrorButton = page.getByRole('button', { name: 'Give me the next step', exact: true })
  await explainErrorButton.click()
  await page.locator('.coach-response').waitFor({ timeout: 15000 })
  const coachState = await page.evaluate(() => ({
    source: document.querySelector('.coach-response__eyebrow')?.textContent?.trim() ?? '',
    stillError: !!document.querySelector('.verdict-error'),
    focused: document.activeElement?.textContent?.trim() ?? '',
  }))
  const sqlAfterCoach = await readEditorText(page)
  const verdictAfterCoach = await page.locator('.verdict-error').textContent()
  const remoteCoach = /Frosty · AI coaching/i.test(coachState.source)
  const coachTransportIsExpected = remoteCoach
    ? coachRequests.length === 1
      && coachRequests[0].method() === 'POST'
      && new URL(coachRequests[0].url()).origin === new URL(BASE).origin
    : coachRequests.length === 0
  step(
    'Frosty explains the error without editing SQL or grading it',
    coachTransportIsExpected
      && sqlAfterCoach === sqlBeforeCoach
      && coachState.stillError
      && verdictAfterCoach === errText
      && coachState.focused === 'Give me the next step'
      && /Frosty · (?:AI coaching|built-in, private guidance)/i.test(coachState.source),
    JSON.stringify({
      requests: coachRequests.length,
      transport: remoteCoach ? 'first-party POST' : 'offline',
      sqlUnchanged: sqlAfterCoach === sqlBeforeCoach,
      verdictUnchanged: verdictAfterCoach === errText,
      ...coachState,
    }),
  )
  page.off('request', recordCoachRequest)

  // A close double-quoted identifier typo is not the Excel text-value trap.
  await setEditor(page, `SELECT "ammount" FROM fct_gl_transactions LIMIT 1`)
  await runQuery(page)
  await page.locator('.verdict-error').waitFor({ timeout: 30000 })
  const quotedTypoText = await page.locator('.verdict-error').textContent()
  step('quoted identifier typo suggests real column', /Did you mean.*amount/is.test(quotedTypoText) && !/quote style is the trap/i.test(quotedTypoText), quotedTypoText.slice(0, 100))

  // 9. THE CRASH TEST: deliberate comma cross-join on the big table
  await setEditor(page, `SELECT count(DISTINCT a.je_id || b.je_id) FROM fct_gl_transactions a, fct_gl_transactions b`)
  await runQuery(page)
  // must eventually show a warm error (timeout/restart) — and the app must survive
  await page.locator('.verdict-error').waitFor({ timeout: 60000 })
  const crashText = await page.locator('.verdict-error').textContent()
  step('runaway cross-join handled warmly', /too big|restarted|more memory/i.test(crashText), crashText.slice(0, 90))

  // 10. Engine still alive after restart
  await setEditor(page, `SELECT count(*) FROM dim_customer`)
  await runQuery(page)
  await page.locator('[data-table-sheet="true"]').waitFor({ timeout: 60000 })
  step('engine recovered after restart', true)

  // 11. Desk: simple directions + interview ready + progress persisted
  const deskOpener = page.getByRole('button', { name: 'Your desk' })
  await deskOpener.click()
  await page.locator('.path-chooser').waitFor()
  step('desk opens with simple directions', true)
  const pathChooser = await page.evaluate(() => {
    const root = document.querySelector('.path-chooser')
    const cards = Array.from(document.querySelectorAll('.path-card')).map((card) => ({
      id: card.getAttribute('data-path-id'),
      title: card.querySelector('.path-card-title')?.textContent?.trim() ?? '',
      locked: card.classList.contains('path-card--locked'),
    }))
    const copy = root?.textContent ?? ''
    return {
      present: !!root,
      count: cards.length,
      ids: cards.map((c) => c.id),
      screenLocked: cards.find((c) => c.id === 'screen-practice')?.locked === true,
      noHud: !/\bXP\b|earn XP|daily streak|coins?|confetti|level up|lives remaining/i.test(copy),
      openWorld: /what would you like to do|switch anytime/i.test(copy),
    }
  })
  step(
    'desk shows four plain-language directions',
    pathChooser.present
      && pathChooser.count === 4
      && pathChooser.ids.join(',') === 'mission-ladder,scenario-library,free-explore,screen-practice'
      && pathChooser.screenLocked
      && pathChooser.noHud
      && pathChooser.openWorld,
    JSON.stringify(pathChooser),
  )
  const optionalSurfaces = await page.evaluate(() => ({
    workplaceTools: !!document.querySelector('.workplace-tools'),
    futureDesks: !!document.querySelector('.future-desks'),
    coreDirections: document.querySelectorAll('.path-card').length,
    copy: document.querySelector('.path-chooser')?.textContent ?? '',
  }))
  step(
    'desk keeps the core directions focused',
    !optionalSurfaces.workplaceTools
      && !optionalSurfaces.futureDesks
      && optionalSurfaces.coreDirections === 4
      && /what would you like to do|switch anytime/i.test(optionalSurfaces.copy),
    JSON.stringify(optionalSurfaces),
  )
  await openScenarioLibrary(page)
  await page.waitForFunction(() => document.activeElement?.id === 'scenario-library-title')
  const scenarioLibrary = await page.evaluate((authoredScenarios) => {
    const scenarios = Array.from(document.querySelectorAll('.scenario-row')).map((row) => ({
      id: row.getAttribute('data-scenario'),
      parts: Number(row.getAttribute('data-parts')),
      status: row.getAttribute('data-status'),
      active: row.getAttribute('data-active') === 'true',
      copy: row.textContent ?? '',
    }))
    const expectedById = new Map(authoredScenarios.map((scenario) => [scenario.id, scenario]))
    const actualById = new Map(scenarios.map((scenario) => [scenario.id, scenario]))
    const rank = (scenario) => scenario.active ? 0 : scenario.status === 'in-progress' ? 1 : scenario.status === 'not-started' ? 2 : 3
    const untouchedIds = scenarios.filter((scenario) => scenario.status === 'not-started').map((scenario) => scenario.id)
    const expectedUntouchedIds = authoredScenarios.slice().reverse().map((scenario) => scenario.id).filter((id) => untouchedIds.includes(id))
    return {
      present: !!document.querySelector('.scenario-library'),
      isolated: !document.querySelector('.path-chooser') && !document.querySelector('.queue-part'),
      focused: document.activeElement?.id === 'scenario-library-title',
      scenarios,
      catalogMatches: scenarios.length === authoredScenarios.length
        && scenarios.every((scenario) => expectedById.get(scenario.id)?.parts === scenario.parts)
        && authoredScenarios.every((scenario) => actualById.has(scenario.id)),
      ranked: scenarios.every((scenario, index) => index === 0 || rank(scenarios[index - 1]) <= rank(scenario)),
      untouchedIds,
      expectedUntouchedIds,
    }
  }, AUTHORED_SCENARIO_SHAPE.map(({ id, parts }) => ({ id, parts })))
  step(
    'Browse projects opens a focused project view',
    scenarioLibrary.present && scenarioLibrary.isolated && scenarioLibrary.focused,
    JSON.stringify({ present: scenarioLibrary.present, isolated: scenarioLibrary.isolated, focused: scenarioLibrary.focused }),
  )
  step(
    'desk shows variable-length scenario library',
    scenarioLibrary.catalogMatches
      && scenarioLibrary.scenarios.some((scenario) => scenario.id === 'org-manager-review')
      && scenarioLibrary.scenarios.some((scenario) => scenario.id === 'seat-book-review' && scenario.parts === SEAT_BOOK_SCENARIO?.parts && new RegExp(`0 of ${SEAT_BOOK_SCENARIO?.parts} tasks complete`, 'i').test(scenario.copy))
      && scenarioLibrary.scenarios.some((scenario) => scenario.id === 'arr-subledger-control' && scenario.parts === ARR_SUBLEDGER_SCENARIO?.parts)
      && ARR_SUBLEDGER_SCENARIO?.missionIds.join(',') === ARR_SUBLEDGER_MISSION_IDS.join(',')
      && scenarioLibrary.scenarios.every((scenario) => /tasks complete/i.test(scenario.copy)),
    JSON.stringify(scenarioLibrary),
  )
  step(
    'customer lifecycle council renders its authored workday depth',
    CUSTOMER_LIFECYCLE_SCENARIO?.missionIds.join(',') === CUSTOMER_LIFECYCLE_MISSION_IDS.join(',')
      && scenarioLibrary.scenarios.some((scenario) => scenario.id === CUSTOMER_LIFECYCLE_SCENARIO.id
        && scenario.parts === CUSTOMER_LIFECYCLE_SCENARIO.parts
        && new RegExp(`0 of ${CUSTOMER_LIFECYCLE_SCENARIO.parts} tasks complete`, 'i').test(scenario.copy)),
    JSON.stringify({ authored: CUSTOMER_LIFECYCLE_SCENARIO, rendered: scenarioLibrary.scenarios.find((scenario) => scenario.id === 'customer-lifecycle-council') }),
  )
  step(
    'customer ownership control renders its authored ordered workday',
    CUSTOMER_OWNERSHIP_SCENARIO?.missionIds.join(',') === CUSTOMER_OWNERSHIP_MISSION_IDS.join(',')
      && scenarioLibrary.scenarios.some((scenario) => scenario.id === CUSTOMER_OWNERSHIP_SCENARIO.id
        && scenario.parts === CUSTOMER_OWNERSHIP_SCENARIO.parts
        && new RegExp(`0 of ${CUSTOMER_OWNERSHIP_SCENARIO.parts} tasks complete`, 'i').test(scenario.copy)),
    JSON.stringify({ authored: CUSTOMER_OWNERSHIP_SCENARIO, rendered: scenarioLibrary.scenarios.find((scenario) => scenario.id === 'customer-ownership-control') }),
  )
  step(
    'reforecast outcome review renders its authored nine-part workday',
    REFORECAST_OUTCOME_SCENARIO?.missionIds.join(',') === REFORECAST_OUTCOME_MISSION_IDS.join(',')
      && REFORECAST_OUTCOME_SCENARIO.parts === 9
      && scenarioLibrary.scenarios.some((scenario) => scenario.id === REFORECAST_OUTCOME_SCENARIO.id
        && scenario.parts === 9
        && /0 of 9 tasks complete/i.test(scenario.copy)),
    JSON.stringify({ authored: REFORECAST_OUTCOME_SCENARIO, rendered: scenarioLibrary.scenarios.find((scenario) => scenario.id === 'reforecast-outcome-review') }),
  )
  step(
    'shared-services allocation review renders its authored workday depth',
    SHARED_SERVICES_ALLOCATION_SCENARIO?.missionIds.join(',') === SHARED_SERVICES_ALLOCATION_MISSION_IDS.join(',')
      && SHARED_SERVICES_ALLOCATION_SCENARIO.parts === SHARED_SERVICES_ALLOCATION_MISSION_IDS.length
      && scenarioLibrary.scenarios.some((scenario) => scenario.id === SHARED_SERVICES_ALLOCATION_SCENARIO.id
        && scenario.parts === SHARED_SERVICES_ALLOCATION_SCENARIO.parts
        && new RegExp(`0 of ${SHARED_SERVICES_ALLOCATION_SCENARIO.parts} tasks complete`, 'i').test(scenario.copy)),
    JSON.stringify({ authored: SHARED_SERVICES_ALLOCATION_SCENARIO, rendered: scenarioLibrary.scenarios.find((scenario) => scenario.id === 'shared-services-allocation-review') }),
  )
  step(
    'cost-to-serve review renders its authored workday depth',
    COST_TO_SERVE_SCENARIO?.missionIds.join(',') === COST_TO_SERVE_MISSION_IDS.join(',')
      && COST_TO_SERVE_SCENARIO.parts === COST_TO_SERVE_MISSION_IDS.length
      && scenarioLibrary.scenarios.some((scenario) => scenario.id === COST_TO_SERVE_SCENARIO.id
        && scenario.parts === COST_TO_SERVE_SCENARIO.parts
        && new RegExp(`0 of ${COST_TO_SERVE_SCENARIO.parts} tasks complete`, 'i').test(scenario.copy)),
    JSON.stringify({ authored: COST_TO_SERVE_SCENARIO, rendered: scenarioLibrary.scenarios.find((scenario) => scenario.id === 'cost-to-serve-review') }),
  )
  step(
    'contractor and consulting cost review renders its authored workday depth',
    CONTRACTOR_CONSULTING_COST_SCENARIO?.missionIds.join(',') === CONTRACTOR_CONSULTING_COST_MISSION_IDS.join(',')
      && CONTRACTOR_CONSULTING_COST_SCENARIO.parts === CONTRACTOR_CONSULTING_COST_MISSION_IDS.length
      && scenarioLibrary.scenarios.some((scenario) => scenario.id === CONTRACTOR_CONSULTING_COST_SCENARIO.id
        && scenario.parts === CONTRACTOR_CONSULTING_COST_SCENARIO.parts
        && new RegExp(`0 of ${CONTRACTOR_CONSULTING_COST_SCENARIO.parts} tasks complete`, 'i').test(scenario.copy)),
    JSON.stringify({ authored: CONTRACTOR_CONSULTING_COST_SCENARIO, rendered: scenarioLibrary.scenarios.find((scenario) => scenario.id === 'contractor-consulting-cost-review') }),
  )
  step(
    'travel and expense operating review renders its authored workday depth',
    TRAVEL_EXPENSE_SCENARIO?.missionIds.join(',') === TRAVEL_EXPENSE_MISSION_IDS.join(',')
      && TRAVEL_EXPENSE_SCENARIO.parts === TRAVEL_EXPENSE_MISSION_IDS.length
      && scenarioLibrary.scenarios.some((scenario) => scenario.id === TRAVEL_EXPENSE_SCENARIO.id
        && scenario.parts === TRAVEL_EXPENSE_SCENARIO.parts
        && new RegExp(`0 of ${TRAVEL_EXPENSE_SCENARIO.parts} tasks complete`, 'i').test(scenario.copy)),
    JSON.stringify({ authored: TRAVEL_EXPENSE_SCENARIO, rendered: scenarioLibrary.scenarios.find((scenario) => scenario.id === 'travel-expense-operating-review') }),
  )
  step(
    'revenue close and usage review renders its authored workday depth',
    REVENUE_CLOSE_USAGE_SCENARIO?.missionIds.join(',') === REVENUE_CLOSE_USAGE_MISSION_IDS.join(',')
      && REVENUE_CLOSE_USAGE_SCENARIO.parts === REVENUE_CLOSE_USAGE_MISSION_IDS.length
      && scenarioLibrary.scenarios.some((scenario) => scenario.id === REVENUE_CLOSE_USAGE_SCENARIO.id
        && scenario.parts === REVENUE_CLOSE_USAGE_SCENARIO.parts
        && new RegExp(`0 of ${REVENUE_CLOSE_USAGE_SCENARIO.parts} tasks complete`, 'i').test(scenario.copy)),
    JSON.stringify({ authored: REVENUE_CLOSE_USAGE_SCENARIO, rendered: scenarioLibrary.scenarios.find((scenario) => scenario.id === 'revenue-close-usage-review') }),
  )
  step(
    'scenario library prioritizes active and partial work before untouched workdays newest-first',
    scenarioLibrary.ranked && scenarioLibrary.untouchedIds.join(',') === scenarioLibrary.expectedUntouchedIds.join(','),
    JSON.stringify({ order: scenarioLibrary.scenarios.map((scenario) => `${scenario.id}:${scenario.status}${scenario.active ? ':active' : ''}`), expectedUntouched: scenarioLibrary.expectedUntouchedIds }),
  )
  const newestAuthoredScenario = AUTHORED_SCENARIO_SHAPE.at(-1)
  if (!newestAuthoredScenario) throw new Error('scenario source has no authored workdays')
  const scenarioSearch = page.getByRole('searchbox', { name: 'Find a project' })
  await scenarioSearch.fill(newestAuthoredScenario.title)
  await page.waitForFunction((id) => {
    const rows = Array.from(document.querySelectorAll('.scenario-row'))
    return rows.length === 1 && rows[0]?.getAttribute('data-scenario') === id
  }, newestAuthoredScenario.id)
  const searchedScenarioIds = await page.locator('.scenario-row').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-scenario')))
  step(
    'project search narrows the library to the matching project',
    searchedScenarioIds.length === 1 && searchedScenarioIds[0] === newestAuthoredScenario.id,
    JSON.stringify(searchedScenarioIds),
  )
  await scenarioSearch.fill('')
  const scenarioFilter = page.getByRole('combobox', { name: 'Filter projects' })
  await scenarioFilter.selectOption('in-progress')
  await page.waitForFunction(() => {
    const rows = Array.from(document.querySelectorAll('.scenario-row'))
    return rows.length > 0 && rows.every((row) => row.getAttribute('data-status') === 'in-progress')
  })
  const inProgressScenarioIds = await page.locator('.scenario-row').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-scenario')))
  step('project status filter shows only in-progress projects', inProgressScenarioIds.length > 0, JSON.stringify(inProgressScenarioIds))
  await scenarioFilter.selectOption('all')
  await page.getByRole('button', { name: /All directions/i }).click()
  await page.locator('.path-chooser').waitFor()
  const scenarioBackState = await page.evaluate(() => ({
    directions: !!document.querySelector('.path-chooser'),
    scenarios: !!document.querySelector('.scenario-library'),
  }))
  step('project Back returns to the simple directions', scenarioBackState.directions && !scenarioBackState.scenarios, JSON.stringify(scenarioBackState))
  await openScenarioLibrary(page)
  await page.locator('[data-scenario="first-week"] button').click()
  await page.locator('.ask-card').waitFor({ timeout: 15000 })
  const assignmentAsk = await page.evaluate(() => {
    const card = document.querySelector('.ask-card')
    return {
      explore: card?.classList.contains('explore-card') ?? true,
      text: card?.textContent?.slice(0, 120) ?? '',
    }
  })
  step('scenario library opens the next ask in a chosen arc', !assignmentAsk.explore, assignmentAsk.text)
  await page.getByRole('button', { name: 'Your desk' }).click()
  await openScenarioLibrary(page)
  await page.locator('[data-scenario="seat-book-review"] button').click()
  const seatBookMission = MISSIONS.find((mission) => mission.id === 'm93')
  await page.locator('.ask-title', { hasText: seatBookMission?.title ?? '__missing_m93__' }).waitFor({ timeout: 15000 })
  const seatBookAsk = await page.locator('.ask-title').textContent()
  step(
    'licensed-seat book review opens at m93',
    Boolean(seatBookMission) && seatBookAsk?.includes(seatBookMission.title) === true,
    `${seatBookMission?.id ?? 'm93 missing'} · ${seatBookAsk ?? 'no ask title'}`,
  )
  await page.getByRole('button', { name: 'Your desk' }).click()
  await openScenarioLibrary(page)
  await page.locator('[data-scenario="customer-ownership-control"] button').click()
  const customerOwnershipMission = MISSIONS.find((mission) => mission.id === CUSTOMER_OWNERSHIP_MISSION_IDS[0])
  await page.locator('.ask-title', { hasText: customerOwnershipMission?.title ?? '__missing_m118__' }).waitFor({ timeout: 15000 })
  const customerOwnershipAsk = await page.locator('.ask-title').textContent()
  step(
    'customer ownership control opens at its authored first mission',
    Boolean(customerOwnershipMission) && customerOwnershipAsk?.includes(customerOwnershipMission.title) === true,
    `${customerOwnershipMission?.id ?? 'm118 missing'} · ${customerOwnershipAsk ?? 'no ask title'}`,
  )
  await page.getByRole('button', { name: 'Your desk' }).click()
  await openScenarioLibrary(page)
  await page.locator('[data-scenario="reforecast-outcome-review"] button').click()
  const reforecastOutcomeMission = MISSIONS.find((mission) => mission.id === REFORECAST_OUTCOME_MISSION_IDS[0])
  await page.locator('.ask-title', { hasText: reforecastOutcomeMission?.title ?? '__missing_m128__' }).waitFor({ timeout: 15000 })
  const reforecastOutcomeAsk = await page.locator('.ask-title').textContent()
  step(
    'reforecast outcome review opens at its authored first mission',
    Boolean(reforecastOutcomeMission) && reforecastOutcomeAsk?.includes(reforecastOutcomeMission.title) === true,
    `${reforecastOutcomeMission?.id ?? 'm128 missing'} · ${reforecastOutcomeAsk ?? 'no ask title'}`,
  )
  await setEditor(page, reforecastOutcomeMission.canonical)
  await runQuery(page)
  await page.locator('.verdict-correct').waitFor({ timeout: 30000 })
  await page.locator('.results [data-table-sheet="true"]').waitFor({ timeout: 15000 })
  const reforecastInventoryFormatting = await page.evaluate(() => {
    const sheet = document.querySelector('.results [data-table-sheet="true"]')
    const headers = [...(sheet?.querySelectorAll('.table-sheet__column-name') ?? [])]
      .map((header) => header.textContent?.trim() ?? '')
    const valuesFor = (column) => {
      const index = headers.indexOf(column)
      return index < 0
        ? []
        : [...(sheet?.querySelectorAll(`tbody td[data-column="${index}"]`) ?? [])]
          .map((cell) => cell.textContent?.trim() ?? '')
    }
    return {
      budgetRows: valuesFor('budget_rows'),
      loadedUsd: valuesFor('loaded_usd'),
    }
  })
  step(
    'result sheet keeps row counts plain while formatting budget dollars as money',
    reforecastInventoryFormatting.budgetRows.join(',') === '1,091,864'
      && reforecastInventoryFormatting.budgetRows.every((value) => !value.includes('$'))
      && reforecastInventoryFormatting.loadedUsd.length === 2
      && reforecastInventoryFormatting.loadedUsd.every((value) => value.startsWith('$')),
    JSON.stringify(reforecastInventoryFormatting),
  )
  await page.getByRole('button', { name: 'Your desk' }).click()
  await openScenarioLibrary(page)
  await page.locator('[data-scenario="shared-services-allocation-review"] button').click()
  const sharedServicesAllocationMission = MISSIONS.find((mission) => mission.id === SHARED_SERVICES_ALLOCATION_MISSION_IDS[0])
  await page.locator('.ask-title', { hasText: sharedServicesAllocationMission?.title ?? '__missing_m137__' }).waitFor({ timeout: 15000 })
  const sharedServicesAllocationAsk = await page.locator('.ask-title').textContent()
  step(
    'shared-services allocation review opens at its authored first mission',
    Boolean(sharedServicesAllocationMission) && sharedServicesAllocationAsk?.includes(sharedServicesAllocationMission.title) === true,
    `${sharedServicesAllocationMission?.id ?? 'm137 missing'} · ${sharedServicesAllocationAsk ?? 'no ask title'}`,
  )
  await setEditor(page, sharedServicesAllocationMission.canonical)
  await runQuery(page)
  await page.locator('.verdict-correct').waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: 'Your desk' }).click()
  await openScenarioLibrary(page)
  await page.locator('[data-scenario="cost-to-serve-review"] button').click()
  const costToServeMission = MISSIONS.find((mission) => mission.id === COST_TO_SERVE_MISSION_IDS[0])
  await page.locator('.ask-title', { hasText: costToServeMission?.title ?? '__missing_m146__' }).waitFor({ timeout: 15000 })
  const costToServeAsk = await page.locator('.ask-title').textContent()
  step(
    'cost-to-serve review opens at its authored first mission',
    Boolean(costToServeMission) && costToServeAsk?.includes(costToServeMission.title) === true,
    `${costToServeMission?.id ?? 'm146 missing'} · ${costToServeAsk ?? 'no ask title'}`,
  )
  await setEditor(page, costToServeMission.canonical)
  await runQuery(page)
  await page.locator('.verdict-correct').waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: 'Your desk' }).click()
  await openScenarioLibrary(page)
  await page.locator('[data-scenario="contractor-consulting-cost-review"] button').click()
  const contractorConsultingCostMission = MISSIONS.find((mission) => mission.id === CONTRACTOR_CONSULTING_COST_MISSION_IDS[0])
  await page.locator('.ask-title', { hasText: contractorConsultingCostMission?.title ?? '__missing_m156__' }).waitFor({ timeout: 15000 })
  const contractorConsultingCostAsk = await page.locator('.ask-title').textContent()
  step(
    'contractor and consulting cost review opens at its authored first mission',
    Boolean(contractorConsultingCostMission) && contractorConsultingCostAsk?.includes(contractorConsultingCostMission.title) === true,
    `${contractorConsultingCostMission?.id ?? 'm156 missing'} · ${contractorConsultingCostAsk ?? 'no ask title'}`,
  )
  await setEditor(page, contractorConsultingCostMission.canonical)
  await runQuery(page)
  await page.locator('.verdict-correct').waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: 'Your desk' }).click()
  await openScenarioLibrary(page)
  await page.locator('[data-scenario="travel-expense-operating-review"] button').click()
  const travelExpenseMission = MISSIONS.find((mission) => mission.id === TRAVEL_EXPENSE_MISSION_IDS[0])
  await page.locator('.ask-title', { hasText: travelExpenseMission?.title ?? '__missing_m163__' }).waitFor({ timeout: 15000 })
  const travelExpenseAsk = await page.locator('.ask-title').textContent()
  step(
    'travel and expense operating review opens at its authored first mission',
    Boolean(travelExpenseMission) && travelExpenseAsk?.includes(travelExpenseMission.title) === true,
    `${travelExpenseMission?.id ?? 'm163 missing'} · ${travelExpenseAsk ?? 'no ask title'}`,
  )
  await setEditor(page, travelExpenseMission.canonical)
  await runQuery(page)
  await page.locator('.verdict-correct').waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: 'Your desk' }).click()
  await openScenarioLibrary(page)
  await page.locator('[data-scenario="revenue-close-usage-review"] button').click()
  const revenueCloseUsageMission = MISSIONS.find((mission) => mission.id === REVENUE_CLOSE_USAGE_MISSION_IDS[0])
  await page.locator('.ask-title', { hasText: revenueCloseUsageMission?.title ?? '__missing_m171__' }).waitFor({ timeout: 15000 })
  const revenueCloseUsageAsk = await page.locator('.ask-title').textContent()
  step(
    'revenue close and usage review opens at its authored first mission',
    Boolean(revenueCloseUsageMission) && revenueCloseUsageAsk?.includes(revenueCloseUsageMission.title) === true,
    `${revenueCloseUsageMission?.id ?? 'm171 missing'} · ${revenueCloseUsageAsk ?? 'no ask title'}`,
  )
  await setEditor(page, revenueCloseUsageMission.canonical)
  await runQuery(page)
  await page.locator('.verdict-correct').waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: 'Your desk' }).click()
  await page.locator('.path-chooser').waitFor()
  await page.getByRole('button', { name: /Explore data: Explore company data/i }).click()
  await page.locator('.explore-card').waitFor({ timeout: 15000 })
  const exploreVisible = await page.locator('.explore-card').textContent()
  step('explore path opens free data mode', /No ask selected|Explore Star67/i.test(exploreVisible ?? '') && /saved queries and skill progress stay put|continue the last direction/i.test(exploreVisible ?? ''), (exploreVisible ?? '').slice(0, 120))
  await page.getByRole('button', { name: 'Your desk' }).click()
  await page.locator('.path-chooser').waitFor()
  const pathPersisted = await page.evaluate(() => {
    const continueStrip = document.querySelector('.path-continue')
    const current = document.querySelector('.path-card[data-current="true"]')
    const raw = localStorage.getItem('pivot.pathSession.v1.parkline-fpa')
    let session = null
    try { session = raw ? JSON.parse(raw) : null } catch { session = null }
    return {
      continueId: continueStrip?.getAttribute('data-last-path') ?? null,
      continueCopy: continueStrip?.textContent ?? '',
      currentId: current?.getAttribute('data-path-id') ?? null,
      sessionPath: session?.lastPathId ?? null,
    }
  })
  step(
    'desk remembers last open-world direction after explore',
    pathPersisted.continueId === 'free-explore'
      && pathPersisted.currentId === 'free-explore'
      && pathPersisted.sessionPath === 'free-explore'
      && /Continue where you left off/i.test(pathPersisted.continueCopy)
      && /your work is saved/i.test(pathPersisted.continueCopy),
    JSON.stringify(pathPersisted),
  )
  await page.getByRole('button', { name: /Continue: Explore company data/i }).click()
  await page.locator('.explore-card').waitFor({ timeout: 15000 })
  step('continue strip restores free explore without punishing progress', true)
  await page.getByRole('button', { name: 'Your desk' }).click()
  await page.locator('.path-chooser').waitFor()
  await page.getByRole('button', { name: /Start next task: Next guided task/i }).click()
  await page.locator('.ask-card').waitFor({ timeout: 15000 })
  const missionAsk = await page.locator('.ask-card').first().evaluate((el) => !el.classList.contains('explore-card'))
  step('next guided task returns to a checked finance request', missionAsk)
  await page.getByRole('button', { name: 'Your desk' }).click()
  await page.locator('.path-chooser').waitFor()
  const deskA11y = await page.evaluate(() => {
    const desk = document.querySelector('.desk')
    return {
      role: desk?.getAttribute('role'),
      modal: desk?.getAttribute('aria-modal'),
      focused: document.activeElement?.textContent?.trim() ?? '',
      inside: !!desk?.contains(document.activeElement),
    }
  })
  step('desk opens as a focused modal dialog', deskA11y.role === 'dialog' && deskA11y.modal === 'true' && deskA11y.inside && deskA11y.focused === 'Close', JSON.stringify(deskA11y))
  await page.evaluate(() => {
    const dialog = document.querySelector('.desk')
    const focusable = Array.from(dialog?.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])') ?? [])
      .filter((element) => element.getClientRects().length > 0
        && !(element.tagName !== 'SUMMARY' && element.closest('details:not([open])')))
    focusable.at(-1)?.focus()
  })
  await page.keyboard.press('Tab')
  const deskTrapped = await page.evaluate(() => ({
    inside: document.querySelector('.desk')?.contains(document.activeElement) ?? false,
    focused: document.activeElement?.textContent?.trim() ?? '',
  }))
  step('desk wraps Tab from its true last control to Close', deskTrapped.inside && deskTrapped.focused === 'Close', JSON.stringify(deskTrapped))

  // The desk tabs use the APG automatic-activation pattern: arrow navigation
  // moves focus and selection together, with Home/End and wraparound.
  const deskTabKeys = ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowLeft', 'Home', 'End']
  const savedTabLabel = (await page.locator('.desk-tabs').getByRole('tab', { name: /Saved queries/ }).textContent())?.trim() ?? 'Saved queries'
  const deskTabExpected = ['Progress', savedTabLabel, 'My work', savedTabLabel, 'My work', savedTabLabel]
  await page.locator('.desk-tabs').getByRole('tab', { name: 'My work', exact: true }).focus()
  const deskTabStates = []
  for (const key of deskTabKeys) {
    await page.keyboard.press(key)
    deskTabStates.push(await page.evaluate(() => {
      const selected = document.querySelector('.desk-tabs [role="tab"][aria-selected="true"]')
      const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null
      return {
        selected: selected?.textContent?.trim() ?? '',
        focused: focused?.textContent?.trim() ?? '',
        focusedRole: focused?.getAttribute('role') ?? '',
        focusedTabIndex: focused?.getAttribute('tabindex') ?? '',
      }
    }))
  }
  step(
    'desk tabs activate and focus together across arrows, Home, and End',
    deskTabStates.length === deskTabExpected.length
      && deskTabStates.every((state, index) => state.selected === deskTabExpected[index]
        && state.focused === deskTabExpected[index]
        && state.focusedRole === 'tab'
        && state.focusedTabIndex === '0'),
    JSON.stringify(deskTabStates),
  )
  await page.locator('.desk-tabs').getByRole('tab', { name: 'Progress', exact: true }).click()
  const hightouchSim = SCREEN_SIMS.find((sim) => sim.id === 'sim01')
  const affirmSim = SCREEN_SIMS.find((sim) => sim.id === 'sim05')
  if (!hightouchSim || !affirmSim) throw new Error('sim01 and sim05 must both exist in the authored practice source')
  const staleSharedProcessClaim = /Navan|shared editor|most of your list|live SQL interview assessment|interviewer who cares more/i
  step(
    'practice source keeps its provenance boundary',
    /fictional Star67/i.test(hightouchSim.intro)
      && /Hightouch/i.test(hightouchSim.intro)
      && /not a claim/i.test(hightouchSim.intro)
      && !staleSharedProcessClaim.test(hightouchSim.intro)
      && /fictional Star67/i.test(affirmSim.intro)
      && /Affirm/i.test(affirmSim.intro)
      && /not a claim/i.test(affirmSim.intro)
      && /interview|process/i.test(affirmSim.intro),
    `sim01=${hightouchSim.intro.slice(0, 100)} | sim05=${affirmSim.intro.slice(0, 100)}`,
  )

  // PROGRESS-007 — focused progress, motion gates, narrow/zoom, reduced-motion
  await page.waitForFunction((expectedCount) => {
    const images = Array.from(document.querySelectorAll('.desk-crew img'))
    return images.length === expectedCount && images.every((image) => image.complete && image.naturalWidth > 0)
  }, expectedDeskCrew.length)
  const progressVisual = await page.evaluate(() => {
    const crew = document.querySelector('.desk-crew')
    const crewMembers = Array.from(document.querySelectorAll('.desk-crew__member'))
    const crewImages = crewMembers.map((member) => member.querySelector('img')).filter(Boolean)
    const seals = Array.from(document.querySelectorAll('.evidence-seal'))
    const hero = document.querySelector('.dossier-hero')
    const kicker = document.querySelector('.dossier-kicker')
    const sealGrid = document.querySelector('.evidence-seal-grid')
    const future = document.querySelector('.future-skills')
    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      || (document.querySelector('.desk')?.scrollWidth ?? 0) > (document.querySelector('.desk')?.clientWidth ?? 0) + 1
    return {
      crewLabel: crew?.getAttribute('aria-label') ?? '',
      crewMembers: crewMembers.length,
      crewNames: crewMembers.map((member) => member.querySelector('strong')?.textContent?.trim() ?? ''),
      crewImages: crewImages.map((image) => ({
        alt: image.getAttribute('alt') ?? '',
        src: image.getAttribute('src') ?? '',
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        objectFit: getComputedStyle(image).objectFit,
      })),
      seals: seals.length,
      focusSeals: document.querySelectorAll('.evidence-seal-grid--focus .evidence-seal').length,
      visibleSeals: seals.filter((seal) => seal.getClientRects().length > 0).length,
      earned: seals.filter((seal) => seal.getAttribute('data-earned') === 'true').length,
      building: seals.filter((seal) => seal.getAttribute('data-earned') === 'false').length,
      revealing: seals.filter((seal) => seal.getAttribute('data-reveal') === 'true').length,
      guided: seals.filter((seal) => !!seal.getAttribute('data-guide')).length,
      described: seals.filter((seal) => !!seal.querySelector('.evidence-seal__description')?.textContent?.trim()).length,
      progressLabels: seals.filter((seal) => !!seal.querySelector('.evidence-seal__progress')?.textContent?.trim()).length,
      nextEvidence: seals.filter((seal) => !!seal.querySelector('.evidence-seal__next')?.textContent?.trim()).length,
      companyCards: document.querySelectorAll('.company-card').length,
      heroOk: !!hero && !!document.getElementById('dossier-title'),
      kicker: kicker?.textContent?.trim() ?? '',
      heroCopy: hero?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      sealGridDisplay: sealGrid ? getComputedStyle(sealGrid).display : '',
      futureClosed: !!future && !future.hasAttribute('open'),
      futureSummary: future?.querySelector('summary')?.textContent?.trim() ?? '',
      evidenceAriaLabels: seals.map((seal) => seal.querySelector('.evidence-seal__evidence')?.getAttribute('aria-label') ?? ''),
      progressCopy: seals.map((seal) => seal.querySelector('.evidence-seal__progress')?.textContent?.trim() ?? ''),
      overflow,
      runtime: document.querySelector('.topbar-runtime')?.textContent?.trim() ?? '',
    }
  })
  step(
    'progress mounts the Star67 crew, one next skill, earned skills, and a closed later-skills list',
    progressVisual.heroOk
      && /Star67 crew at your desk/i.test(progressVisual.crewLabel)
      && progressVisual.crewMembers === expectedDeskCrew.length
      && JSON.stringify(progressVisual.crewNames) === JSON.stringify(expectedDeskCrew)
      && new Set(progressVisual.crewImages.map((image) => image.src)).size === expectedDeskCrew.length
      && progressVisual.crewImages.every((image) => image.naturalWidth === 1024
        && image.naturalHeight === 1024
        && image.objectFit === 'contain'
        && /Star67/i.test(image.alt))
      && expectedBadgeCount === 37
      && progressVisual.seals === expectedBadgeCount
      && progressVisual.focusSeals === 1
      && progressVisual.revealing <= 1
      && progressVisual.guided === expectedBadgeCount
      && progressVisual.described === expectedBadgeCount
      && progressVisual.progressLabels === expectedBadgeCount
      && progressVisual.nextEvidence === expectedBadgeCount
      && progressVisual.companyCards === 0
      && progressVisual.kicker === 'Your SQL practice'
      && /guided tasks/i.test(progressVisual.heroCopy)
      && /practice sets/i.test(progressVisual.heroCopy)
      && progressVisual.evidenceAriaLabels.filter(Boolean).every((label) => /supporting evidence/i.test(label))
      && progressVisual.progressCopy.filter(Boolean).every((label) => /guided task/i.test(label))
      && progressVisual.sealGridDisplay === 'grid'
      && progressVisual.futureClosed
      && /more skill/i.test(progressVisual.futureSummary)
      && !progressVisual.overflow,
    JSON.stringify(progressVisual),
  )
  step(
    'local save state stays visible beside progress',
    /Saved on this device/i.test(progressVisual.runtime),
    progressVisual.runtime,
  )

  // Focus receipt: focus the Progress tab itself with keyboard modality.
  const tabFocusRing = await page.locator('.desk-tabs').getByRole('tab', { name: 'Progress', exact: true }).evaluate((el) => {
    try { el.focus({ focusVisible: true }) } catch { el.focus() }
    // If the engine still refuses :focus-visible, synthesize keyboard modality then refocus.
    if (!(typeof el.matches === 'function' && el.matches(':focus-visible'))) {
      try {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
        el.focus({ focusVisible: true })
      } catch { el.focus() }
    }
    const style = getComputedStyle(el)
    const matchesFocusVisible = typeof el.matches === 'function' && el.matches(':focus-visible')
    const outlineVisible = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth || '0') >= 2
    const ringVisible = matchesFocusVisible || outlineVisible
      || (style.boxShadow !== 'none' && /rgb|rgba/i.test(style.boxShadow))
    const sheetHasRing = Array.from(document.styleSheets).some((sheet) => {
      try {
        return Array.from(sheet.cssRules || []).some((rule) =>
          rule.selectorText?.includes('.tab:focus-visible') && /outline/i.test(rule.cssText),
        )
      } catch { return false }
    })
    return {
      ok: el.classList.contains('tab')
        && document.activeElement === el
        && (ringVisible || (sheetHasRing && matchesFocusVisible !== false && document.activeElement === el && outlineVisible)),
      isSelf: document.activeElement === el,
      matchesFocusVisible,
      outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
      boxShadow: style.boxShadow,
      sheetHasRing,
      text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
    }
  })
  const focusOk = !!(tabFocusRing.isSelf && (
    tabFocusRing.ok
    || tabFocusRing.matchesFocusVisible
    || String(tabFocusRing.outline || '').startsWith('solid')
    || tabFocusRing.sheetHasRing
  ))
  step('Progress tab shows a visible focus ring', focusOk, JSON.stringify(tabFocusRing))

  // 320 CSS px: progress cards stay single-column with no horizontal overflow.
  await page.setViewportSize({ width: 320, height: 800 })
  await page.waitForTimeout(80)
  const narrowCasebook = await page.evaluate(() => {
    const desk = document.querySelector('.desk')
    const sealGrid = document.querySelector('.evidence-seal-grid')
    const firstSeal = document.querySelector('.evidence-seal')
    const crew = document.querySelector('.desk-crew')
    const docOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    const deskOverflow = desk ? desk.scrollWidth > desk.clientWidth + 1 : true
    const sealFits = firstSeal
      ? firstSeal.getBoundingClientRect().right <= (desk?.getBoundingClientRect().right ?? window.innerWidth) + 1
      : false
    return {
      sealColumns: sealGrid ? getComputedStyle(sealGrid).gridTemplateColumns.split(' ').length : 0,
      docOverflow,
      deskOverflow,
      sealFits,
      crewFits: !!crew && crew.getBoundingClientRect().right <= (desk?.getBoundingClientRect().right ?? window.innerWidth) + 1,
    }
  })
  step(
    'progress cards fit without horizontal overflow at 320 CSS pixels',
    narrowCasebook.sealColumns === 1
      && !narrowCasebook.docOverflow
      && !narrowCasebook.deskOverflow
      && narrowCasebook.sealFits
      && narrowCasebook.crewFits,
    JSON.stringify(narrowCasebook),
  )

  // 200% zoom-equivalent content viewport (half of 1440×900) still keeps progress in bounds.
  await page.setViewportSize({ width: 720, height: 450 })
  await page.waitForTimeout(80)
  const zoomCasebook = await page.evaluate(() => {
    const desk = document.querySelector('.desk')
    const seals = document.querySelectorAll('.evidence-seal').length
    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      || (desk ? desk.scrollWidth > desk.clientWidth + 1 : true)
    const crew = document.querySelector('.desk-crew')
    return {
      seals,
      overflow,
      crewVisible: !!crew && crew.getClientRects().length > 0,
    }
  })
  step(
    'progress remains in-bounds at a 200% zoom-equivalent viewport',
    zoomCasebook.seals === expectedBadgeCount && zoomCasebook.crewVisible && !zoomCasebook.overflow,
    JSON.stringify(zoomCasebook),
  )

  // Reduced motion: the one-shot badge motion freezes at the delivered final state.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reducedMotion = await page.evaluate(() => {
    const seal = document.querySelector('.evidence-seal')
    seal?.classList.add('evidence-seal--reveal')
    const mark = seal?.querySelector('.evidence-seal__mark')
    const markStyle = mark ? getComputedStyle(mark) : null
    return {
      markAnimation: markStyle?.animationName ?? '',
      markOpacity: markStyle ? Number(markStyle.opacity) : -1,
    }
  })
  step(
    'reduced motion freezes the badge at its final delivered state',
    (reducedMotion.markAnimation === 'none' || reducedMotion.markAnimation === '')
      && reducedMotion.markOpacity === 1,
    JSON.stringify(reducedMotion),
  )
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1280, height: 800 })

  // Revisit: blank building badges never claim a one-shot reveal on reload of the tab.
  await page.getByRole('tab', { name: /Saved queries/ }).click()
  await page.locator('.desk-tabs').getByRole('tab', { name: 'Progress', exact: true }).click()
  const revisitReveal = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.evidence-seal')).every((seal) => seal.getAttribute('data-reveal') === 'false'),
  )
  step('skill reveals do not replay on revisit', revisitReveal)

  await page.getByRole('tab', { name: /Saved queries/ }).click()
  const pulls = await page.locator('.pull-item').count()
  step('completed queries are saved', pulls >= 2, `${pulls} saved queries`)

  // 11b. ROUND-1 REGRESSIONS
  await page.keyboard.press('Escape')
  await page.waitForTimeout(100)
  const deskEscape = await page.evaluate(() => ({
    closed: !document.querySelector('.desk'),
    focused: document.activeElement?.textContent?.trim() ?? '',
  }))
  step('Escape closes desk and restores its opener', deskEscape.closed && deskEscape.focused === 'Your desk', JSON.stringify(deskEscape))
  if (!deskEscape.closed) await page.getByRole('button', { name: 'Close' }).click()
  // (a) worker restart must fully restore the warehouse (detached-buffer P0)
  const restartOK = await page.evaluate(async () => {
    try {
      await window.__engine.restart()
      const r = await window.__engine.runRaw('SELECT count(*) FROM dim_vendor')
      return { ok: true, v: String(r.rows[0][0]) }
    } catch (e) { return { ok: false, err: String(e).slice(0, 120) } }
  })
  step('restart() restores all tables', restartOK.ok && Number(restartOK.v) > 0, JSON.stringify(restartOK))
  const coalescedRestart = await page.evaluate(async () => {
    try {
      await Promise.all([window.__engine.restart(), window.__engine.restart()])
      const r = await window.__engine.runRaw('SELECT count(*) FROM dim_vendor')
      return { ok: true, v: String(r.rows[0][0]) }
    } catch (e) { return { ok: false, err: String(e).slice(0, 120) } }
  })
  step('concurrent restarts coalesce cleanly', coalescedRestart.ok && Number(coalescedRestart.v) > 0, JSON.stringify(coalescedRestart))
  // (b) statement injection is blocked
  await setEditor(page, `SELECT 1) __x; DROP VIEW dim_vendor; SELECT * FROM (SELECT 1`)
  await runQuery(page)
  await page.locator('.verdict-error').waitFor({ timeout: 15000 })
  const injText = await page.locator('.verdict-error').textContent()
  const vendorAlive = await page.evaluate(async () => {
    const r = await window.__engine.runRaw('SELECT count(*) FROM dim_vendor').catch(() => null)
    return r ? Number(r.rows[0][0]) : -1
  })
  step('injection blocked, warehouse intact', /One query at a time/i.test(injText) && vendorAlive > 0, `${injText.slice(0, 50)} · vendor rows ${vendorAlive}`)
  // (c) DDL gets the read-only teaching message
  await setEditor(page, `DROP TABLE dim_customer`)
  await runQuery(page)
  await page.locator('.verdict-error').waitFor({ timeout: 15000 })
  const ddlText = await page.locator('.verdict-error').textContent()
  step('DDL gets read-only message', /read-only/i.test(ddlText), ddlText.slice(0, 70))
  // (d) Notes/Docs smart quotes get a specific paste correction, not raw parser hostility
  await setEditor(page, `SELECT ‘Café’’s’ AS label`)
  await runQuery(page)
  await page.locator('.verdict-error').waitFor({ timeout: 15000 })
  const smartQuoteText = await page.locator('.verdict-error').textContent()
  step('smart-quote paste gets warm fix', /curly quotes.*straight quotes/is.test(smartQuoteText), smartQuoteText.slice(0, 90))
  // (e) dates render as dates, not epoch ms
  await setEditor(page, `SELECT date_trunc('month', txn_date)::DATE AS month, sum(amount) AS revenue FROM fct_gl_transactions WHERE account_id = '4000' AND txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-02-28' GROUP BY 1 ORDER BY 1`)
  await runQuery(page)
  await page.locator('.table-sheet__grid').waitFor({ timeout: 30000 })
  const firstCell = await page.locator('.table-sheet__grid tbody td').first().textContent()
  step('dates render as dates', /^\d{4}-\d{2}-\d{2}$/.test(firstCell.trim()), firstCell)
  // (f) editor stays usable with tall results (flex collapse P0)
  await setEditor(page, `SELECT * FROM dim_department`)
  await runQuery(page)
  await page.locator('.table-sheet__grid').waitFor({ timeout: 30000 })
  const edH = await page.locator('.editor-block').boundingBox()
  step('editor visible under tall results', !!edH && edH.height > 100, `editor height ${edH?.height}px`)

  // 11c. ROUND-2 REGRESSIONS
  // decimals scale correctly; trailing comment after ; is fine
  await setEditor(page, `SELECT 1.5 * 2 AS x, 99.99 AS amount; -- checked with Priya`)
  await runQuery(page)
  await page.locator('.table-sheet__grid').waitFor({ timeout: 30000 })
  const decCells = await page.locator('.table-sheet__grid tbody td').allTextContents()
  step('decimals + trailing comment ok', decCells[0].trim() === '3' && /\$99\.99/.test(decCells[1]), decCells.join(' | '))

  // Comment delimiters inside a real string are data, not trailing comments.
  await setEditor(page, `SELECT 'abc--def' AS label`)
  await runQuery(page)
  await page.locator('.table-sheet__grid').waitFor({ timeout: 30000 })
  const dashLiteral = await page.locator('.table-sheet__grid tbody td').first().textContent()
  step('comment marker inside string stays data', dashLiteral.trim() === 'abc--def', dashLiteral)

  // 12. Reload: progress survives, returning-user card
  await page.reload()
  await page.getByRole('button', { name: 'Back to my desk' }).waitFor({ timeout: 15000 })
  step('progress survives reload (returning card)', true)

  // 13. A result-equal answer must stay correct when SQL uses a named ordered
  // window and a harmless comment. The old raw regex falsely rejected both.
  const m13 = MISSIONS.find((m) => m.id === 'm13')
  await page.evaluate((ids) => {
    const key = 'pivot.progress.v1'
    const p = JSON.parse(localStorage.getItem(key) ?? '{"pulls":{},"simDone":{}}')
    p.pulls ??= {}
    p.simDone ??= {}
    for (const id of ids) p.pulls[id] ??= { missionId: id, completedAt: new Date().toISOString(), sql: 'smoke prerequisite', title: id }
    localStorage.setItem(key, JSON.stringify(p))
  }, MISSIONS.slice(0, 12).map((m) => m.id))
  await page.reload()
  await page.getByRole('button', { name: 'Back to my desk' }).click()
  await page.locator('.ask-title', { hasText: m13.title }).waitFor({ timeout: 120000 })

  // A grading infrastructure fault must explain itself and keep Run available;
  // silence here strands the learner even though her query itself executed.
  await page.evaluate(() => {
    window.__pivotGradingFault = '__smoke_grader_fault__'
  })
  await setEditor(page, m13.canonical)
  await runQuery(page)
  await page.locator('.verdict-error').waitFor({ timeout: 30000 })
  const graderFaultText = await page.locator('.verdict-error').textContent()
  step('grading fault is explicit and retryable', /answer checker hiccupped.*not your SQL/is.test(graderFaultText) && await page.getByRole('button', { name: /Run/ }).isEnabled(), graderFaultText.slice(0, 100))
  await page.evaluate(() => { delete window.__pivotGradingFault })

  // Cancel after display but before grading finishes must never save or paint a
  // green result. The raw DuckDB work can finish; its generation is stale.
  await page.evaluate(() => {
    window.__pivotGradingDelayStarted = false
    window.__pivotGradingDelayMs = 1200
  })
  await setEditor(page, m13.canonical)
  await runQuery(page)
  await page.waitForFunction(() => window.__pivotGradingDelayStarted === true, null, { timeout: 30000 })
  await page.locator('.editor .cm-content').click()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Tab')
  const runningEditorExit = await page.evaluate(() => ({
    focused: document.activeElement?.textContent?.trim() ?? '',
    outside: !document.querySelector('.editor-block .cm-editor')?.contains(document.activeElement),
  }))
  step('running SQL exits the editor onto Cancel', runningEditorExit.outside && runningEditorExit.focused === 'Cancel', JSON.stringify(runningEditorExit))
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.locator('.verdict-error').waitFor({ timeout: 5000 })
  await page.waitForTimeout(1400)
  const cancelledGrade = await page.evaluate(() => ({
    saved: !!JSON.parse(localStorage.getItem('pivot.progress.v2') ?? '{"pulls":{}}').pulls?.m13,
    green: !!document.querySelector('.verdict-correct'),
  }))
  step('cancel during grading cannot deliver', !cancelledGrade.saved && !cancelledGrade.green, JSON.stringify(cancelledGrade))
  await page.evaluate(() => { delete window.__pivotGradingDelayMs; delete window.__pivotGradingDelayStarted })

  // A visible sentinel typed as text is not SQL NULL. The old canonicalizer
  // collapsed both to the same value and could falsely deliver m13.
  const nullLookalikeSQL = `WITH m AS (
    SELECT date_trunc('month', txn_date)::DATE AS month, sum(amount) AS revenue
    FROM fct_gl_transactions
    WHERE account_id IN ('4000', '4010')
      AND txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-06-30'
    GROUP BY 1
  )
  SELECT month, round(revenue, 2) AS revenue,
    CASE
      WHEN lag(revenue) OVER (ORDER BY month) IS NULL THEN '␀'
      ELSE round(100.0 * (revenue - lag(revenue) OVER (ORDER BY month)) / lag(revenue) OVER (ORDER BY month), 1)::VARCHAR
    END AS mom_growth_pct
  FROM m ORDER BY month`
  await setEditor(page, nullLookalikeSQL)
  await runQuery(page)
  await page.locator('.verdict-wrong').waitFor({ timeout: 30000 })
  step('text NULL lookalike cannot pass grading', true)

  const namedWindowSQL = m13.canonical
    .replaceAll('OVER (ORDER BY month)', 'OVER "monthly order"')
    .replace(' FROM m ORDER BY month', ' FROM m WINDOW "monthly order" AS /* chronological */ (ORDER BY month) ORDER BY month')
  await setEditor(page, namedWindowSQL)
  await runQuery(page)
  await page.locator('.verdict-correct').waitFor({ timeout: 30000 })
  step('result-equal quoted named window + comment grades correct', true)

  // The query result is a read-only working sheet, not a static HTML table.
  // Prove the spreadsheet interactions on a real, correctly graded multi-row
  // mission while keeping display state separate from the source result and
  // its saved delivery receipt.
  const resultSheet = page.locator('.results [data-table-sheet="true"]')
  await resultSheet.waitFor({ timeout: 30000 })
  const resultGrid = resultSheet.getByRole('grid')
  const resultRowsBefore = await resultGrid.locator('tbody tr').count()
  const resultColumnsBefore = await resultGrid.locator('thead [role="columnheader"]').count() - 1
  const resultSourceRowsBefore = await resultGrid.locator('tbody tr').evaluateAll((rows) => rows.map((row) => row.querySelector('td')?.getAttribute('data-source-row') ?? ''))
  // The green verdict can paint one React turn before its durable pull reaches
  // localStorage. Anchor the immutability check to this exact answer receipt so
  // a legitimate persistence turn is not mistaken for a sheet-side mutation.
  await page.waitForFunction((sql) => {
    const saved = JSON.parse(localStorage.getItem('pivot.progress.v2') ?? '{"pulls":{}}').pulls?.m13
    return saved?.sql === sql
  }, namedWindowSQL)
  const resultProofBefore = await page.evaluate(() => {
    const receipt = JSON.parse(localStorage.getItem('pivot.progress.v2') ?? '{"pulls":{}}').pulls?.m13 ?? null
    return {
      receipt,
      receiptKeys: Object.keys(receipt ?? {}),
      verdict: document.querySelector('.verdict-correct')?.textContent ?? '',
    }
  })
  step(
    'correct multi-row mission renders the query-result sheet',
    resultRowsBefore > 1 && resultColumnsBefore > 1 && resultSourceRowsBefore.every(Boolean),
    `${resultRowsBefore} rows · ${resultColumnsBefore} columns`,
  )

  const firstResultCell = resultGrid.getByRole('gridcell').first()
  await firstResultCell.click()
  const selectionBefore = await resultSheet.evaluate((sheet) => ({
    active: sheet.querySelector('[role="grid"]')?.getAttribute('aria-activedescendant') ?? '',
    coordinate: sheet.querySelector('.table-sheet__formula > span')?.textContent ?? '',
    focused: document.activeElement === sheet.querySelector('[role="grid"]'),
    selected: sheet.querySelector('[role="gridcell"][aria-selected="true"]')?.id ?? '',
  }))
  await resultGrid.press('ArrowRight')
  const selectionAfter = await resultSheet.evaluate((sheet) => ({
    active: sheet.querySelector('[role="grid"]')?.getAttribute('aria-activedescendant') ?? '',
    coordinate: sheet.querySelector('.table-sheet__formula > span')?.textContent ?? '',
    focused: document.activeElement === sheet.querySelector('[role="grid"]'),
    selected: sheet.querySelector('[role="gridcell"][aria-selected="true"]')?.id ?? '',
  }))
  step(
    'result sheet cell selection and Arrow navigation retain grid focus',
    selectionBefore.focused && selectionAfter.focused
      && selectionBefore.active === selectionBefore.selected
      && selectionAfter.active === selectionAfter.selected
      && selectionAfter.active !== selectionBefore.active
      && selectionAfter.coordinate !== selectionBefore.coordinate,
    `${selectionBefore.coordinate} → ${selectionAfter.coordinate}`,
  )

  const clipboardStubbed = await page.evaluate(() => {
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (value) => { window.__pivotSmokeClipboard = String(value) } },
      })
      window.__pivotSmokeClipboard = ''
      return true
    } catch {
      return false
    }
  })
  const selectedFormulaValue = (await resultSheet.locator('.table-sheet__formula output').textContent())?.trim() ?? ''
  await resultGrid.press(process.platform === 'darwin' ? 'Meta+c' : 'Control+c')
  await page.waitForFunction(() => {
    const sheet = document.querySelector('.results [data-table-sheet="true"]')
    return sheet?.querySelector('.table-sheet__copy')?.textContent?.trim() === 'Copied'
      || /Clipboard access is unavailable/i.test(sheet?.querySelector('[aria-live="polite"]')?.textContent ?? '')
  })
  const copyProof = await resultSheet.evaluate((sheet) => ({
    copied: window.__pivotSmokeClipboard ?? '',
    button: sheet.querySelector('.table-sheet__copy')?.textContent?.trim() ?? '',
    status: sheet.querySelector('[aria-live="polite"]')?.textContent?.trim() ?? '',
  }))
  step(
    'result sheet copies the selected cell with an announced status',
    clipboardStubbed
      ? copyProof.copied === selectedFormulaValue && copyProof.button === 'Copied' && /copied to the clipboard/i.test(copyProof.status)
      : (copyProof.button === 'Copied' && /copied to the clipboard/i.test(copyProof.status))
        || /Clipboard access is unavailable/i.test(copyProof.status),
    JSON.stringify(copyProof),
  )

  const firstResultHeader = resultGrid.locator('thead th').nth(1)
  const firstResultSort = firstResultHeader.locator('.table-sheet__sort')
  await firstResultSort.click()
  await page.waitForFunction(() => document.querySelector('.results [data-table-sheet="true"] thead th:nth-child(2)')?.getAttribute('aria-sort') === 'ascending')
  await firstResultSort.click()
  await page.waitForFunction(() => document.querySelector('.results [data-table-sheet="true"] thead th:nth-child(2)')?.getAttribute('aria-sort') === 'descending')
  const resultSourceRowsSorted = await resultGrid.locator('tbody tr').evaluateAll((rows) => rows.map((row) => row.querySelector('td')?.getAttribute('data-source-row') ?? ''))
  step(
    'result sheet sort reorders only the display projection',
    resultSourceRowsSorted.join(',') !== resultSourceRowsBefore.join(',')
      && [...resultSourceRowsSorted].sort().join(',') === [...resultSourceRowsBefore].sort().join(',')
      && await firstResultHeader.getAttribute('aria-sort') === 'descending',
    `${resultSourceRowsBefore.join(',')} → ${resultSourceRowsSorted.join(',')}`,
  )

  const filterNeedle = (await resultGrid.locator('tbody td[data-column="0"]').first().textContent())?.trim() ?? ''
  const resultFilter = resultSheet.getByPlaceholder('Filter loaded rows')
  await resultFilter.fill(filterNeedle)
  await page.waitForFunction((rowCount) => {
    const visible = document.querySelectorAll('.results [data-table-sheet="true"] tbody tr').length
    return visible > 0 && visible < rowCount
  }, resultRowsBefore)
  const filteredResultRows = await resultGrid.locator('tbody tr').count()
  const filteredFooter = await resultSheet.locator('.table-sheet__footer').textContent()
  await resultFilter.fill('')
  await page.waitForFunction((rowCount) => document.querySelectorAll('.results [data-table-sheet="true"] tbody tr').length === rowCount, resultRowsBefore)

  const formattedNumericNeedle = (await resultGrid.locator('tbody td[data-column="1"]').first().textContent())?.trim() ?? ''
  const rawNumericNeedle = formattedNumericNeedle.replace(/[$,()]/g, '')
  await resultFilter.fill(rawNumericNeedle)
  await page.waitForFunction((rowCount) => {
    const visible = document.querySelectorAll('.results [data-table-sheet="true"] tbody tr').length
    return visible > 0 && visible < rowCount
  }, resultRowsBefore)
  const rawNumericFilterRows = await resultGrid.locator('tbody tr').count()
  await resultFilter.fill('')
  await page.waitForFunction((rowCount) => document.querySelectorAll('.results [data-table-sheet="true"] tbody tr').length === rowCount, resultRowsBefore)
  step(
    'result sheet filter accepts raw numeric input as well as formatted money',
    rawNumericNeedle.length > 0
      && rawNumericNeedle !== formattedNumericNeedle
      && rawNumericFilterRows > 0
      && rawNumericFilterRows < resultRowsBefore,
    `${formattedNumericNeedle} via ${rawNumericNeedle} → ${rawNumericFilterRows}/${resultRowsBefore}`,
  )

  const firstResultResizer = resultSheet.getByRole('separator').first()
  const widthBefore = Number(await firstResultResizer.getAttribute('aria-valuenow'))
  const columnStyleBefore = await resultGrid.locator('colgroup col').nth(1).evaluate((column) => column.style.width)
  await firstResultResizer.focus()
  await firstResultResizer.press('Shift+ArrowRight')
  await page.waitForFunction((before) => Number(document.querySelector('.results [data-table-sheet="true"] [role="separator"]')?.getAttribute('aria-valuenow')) > before, widthBefore)
  const widthAfter = Number(await firstResultResizer.getAttribute('aria-valuenow'))
  const columnStyleAfter = await resultGrid.locator('colgroup col').nth(1).evaluate((column) => column.style.width)
  step(
    'result sheet column resize works from the keyboard',
    widthAfter > widthBefore
      && columnStyleAfter !== columnStyleBefore
      && columnStyleAfter === `${widthAfter}px`
      && await firstResultResizer.getAttribute('aria-valuetext') === `${widthAfter} pixels wide`
      && await firstResultResizer.evaluate((handle) => document.activeElement === handle),
    `${widthBefore}px → ${widthAfter}px`,
  )

  const resultSourceRowsAfter = await resultGrid.locator('tbody tr').evaluateAll((rows) => rows.map((row) => row.querySelector('td')?.getAttribute('data-source-row') ?? ''))
  const resultProofAfter = await page.evaluate(() => {
    const receipt = JSON.parse(localStorage.getItem('pivot.progress.v2') ?? '{"pulls":{}}').pulls?.m13 ?? null
    return {
      receipt,
      receiptKeys: Object.keys(receipt ?? {}),
      verdict: document.querySelector('.verdict-correct')?.textContent ?? '',
    }
  })
  const receiptStable = canonicalJSONStringify(resultProofAfter.receipt) === canonicalJSONStringify(resultProofBefore.receipt)
  const changedReceiptFields = changedObjectFields(resultProofBefore.receipt, resultProofAfter.receipt)
  const receiptKeyOrderChanged = resultProofAfter.receiptKeys.join(',') !== resultProofBefore.receiptKeys.join(',')
  step(
    'result sort, filter, copy, and resize leave grading and source rows unchanged',
    filteredResultRows > 0 && filteredResultRows < resultRowsBefore
      && new RegExp(`${resultRowsBefore} loaded`).test(filteredFooter ?? '')
      && resultSourceRowsAfter.length === resultRowsBefore
      && [...resultSourceRowsAfter].sort().join(',') === [...resultSourceRowsBefore].sort().join(',')
      && receiptStable
      && resultProofAfter.verdict === resultProofBefore.verdict
      && !!resultProofAfter.verdict,
    `${filteredResultRows}/${resultRowsBefore} filtered · receipt values stable=${receiptStable} · changed fields=${changedReceiptFields.join(',') || 'none'} · key order changed=${receiptKeyOrderChanged}`,
  )

  // Exact result equality delivers the work even when a source-pattern guard
  // cannot prove the production-safe construct. Keep the guard as coaching,
  // never as a false red answer for equivalent SQL.
  const coachingContext = await browser.newContext()
  await keepFirstParty(coachingContext)
  const coachingPrereqs = MISSIONS.slice(0, 12).map((mission) => ({ id: mission.id, title: mission.title }))
  await coachingContext.addInitScript(({ missions }) => {
    const completedAt = '2026-07-16T00:00:00.000Z'
    const receipts = Object.fromEntries(missions.map(({ id, title }) => {
      const receiptId = `smoke:coaching:${id}`
      return [receiptId, {
        receiptId,
        missionId: id,
        completedAt,
        sql: 'SELECT 1',
        title,
        contentRevision: 'smoke',
        mode: 'campaign',
        hintLevel: 0,
        attemptId: null,
      }]
    }))
    localStorage.setItem('pivot.progress.v2', JSON.stringify({
      version: 2,
      pulls: {},
      simDone: {},
      solveReceipts: receipts,
      quarantinedReceiptIds: [],
      auditionAttempts: {},
      quarantinedAttemptIds: [],
      drafts: {},
      draftTombstones: {},
      seenBadgeIds: [],
      importedEnvelopeIds: [],
      lastMissionId: null,
      lastSeenAt: completedAt,
    }))
  }, { missions: coachingPrereqs })
  const coachingPage = await coachingContext.newPage()
  await coachingPage.goto(BASE)
  await coachingPage.getByRole('button', { name: /Open my desk|Back to my desk/ }).click()
  await coachingPage.locator('.ask-title', { hasText: m13.title }).waitFor({ timeout: 120000 })
  const unorderedWindowSQL = m13.canonical.replaceAll(/OVER \(ORDER BY month\)/g, 'OVER ()')
  await setEditor(coachingPage, unorderedWindowSQL)
  await runQuery(coachingPage)
  await coachingPage.locator('.verdict-correct .coaching-note').waitFor({ timeout: 30000 })
  const coachingText = await coachingPage.locator('.coaching-note').textContent()
  step(
    'result-equal source-pattern miss delivers with a production guard',
    /ORDER BY.*inside.*OVER|previous row.*luck/is.test(coachingText),
    coachingText.slice(0, 120),
  )
  await coachingContext.close()

  // Completing the first practice set must route to a blank second set. A
  // restarted set clears only its own drafts, keeps one timer across its four
  // questions, and resets grading.
  const firstSim = SCREEN_SIMS[0]
  const secondSim = SCREEN_SIMS[1]
  if (!firstSim || !secondSim) throw new Error('smoke requires two screen variants')
  const practiceLabels = ['Customer metrics', 'Workforce planning', 'Close debugging', 'Plan outcomes', 'Revenue sensitivity']
  await page.evaluate(({ missionIds, firstSimIds, secondSimIds }) => {
    const now = new Date().toISOString()
    // Practice routing is a ProgressV2 contract. Start from a clean authority
    // instead of mixing a legacy fixture into an unrelated browser scenario:
    // duplicate imported receipts can legitimately quarantine evidence.
    localStorage.removeItem('pivot.progress.v1')
    localStorage.setItem('pivot.progress.v1', JSON.stringify({
      pulls: {},
      simDone: Object.fromEntries(firstSimIds.map((id) => [id, {
        missionId: id,
        completedAt: '2026-01-01T00:00:00.000Z',
        sql: 'smoke complete',
        title: id,
      }])),
    }))
    const v2Key = 'pivot.progress.v2'
    const p2 = {
      version: 2,
      pulls: {},
      simDone: {},
      solveReceipts: {},
      quarantinedReceiptIds: [],
      auditionAttempts: {},
      quarantinedAttemptIds: [],
      drafts: {},
      draftTombstones: {},
      seenBadgeIds: [],
      importedEnvelopeIds: [],
      lastMissionId: null,
      lastSeenAt: null,
    }
    for (const id of missionIds) {
      const receiptId = `smoke:practice-unlock:${id}`
      const receipt = {
        receiptId,
        missionId: id,
        completedAt: now,
        sql: 'SELECT 1',
        title: id,
        contentRevision: 'smoke',
        mode: 'campaign',
        hintLevel: 0,
        attemptId: null,
      }
      p2.pulls[id] = receipt
      p2.solveReceipts[receiptId] = receipt
    }
    p2.lastMissionId = missionIds.at(-1) ?? null
    p2.lastSeenAt = now
    localStorage.setItem(v2Key, JSON.stringify(p2))

    localStorage.setItem(`pivot.draft.${firstSimIds[0]}`, 'SELECT 111 AS keep_other_set_draft')
    for (const id of secondSimIds) localStorage.setItem(`pivot.draft.${id}`, 'SELECT 999 AS leaked_prior_answer')
  }, {
    missionIds: MISSIONS.map((m) => m.id),
    firstSimIds: firstSim.questions.map((q) => q.id),
    secondSimIds: secondSim.questions.map((q) => q.id),
  })
  await page.reload()
  await page.getByRole('button', { name: 'Back to my desk' }).click()
  await page.locator('.ask-card').waitFor({ timeout: 120000 })
  await page.getByRole('button', { name: 'Your desk' }).click()
  await page.getByRole('button', { name: /Start practice: SQL practice/ }).click()
  const screenProgressText = await page.locator('.scenario-library-head p').textContent()
  const practiceLibraryText = await page.locator('.scenario-library').textContent()
  step(
    'practice library uses plain set labels without employer names',
    /Practice set 1: Customer metrics/i.test(practiceLibraryText ?? '')
      && /Practice set 2: Workforce planning/i.test(practiceLibraryText ?? '')
      && !/Hightouch|Datadog|1Password|Figma|Affirm/i.test(practiceLibraryText ?? ''),
    practiceLibraryText?.slice(0, 240) ?? '',
  )
  await page.getByRole('tab', { name: 'Progress', exact: true }).click()
  await page.waitForFunction(() => {
    const earnedIds = Array.from(document.querySelectorAll('.evidence-seal[data-earned="true"]'))
      .map((seal) => seal.getAttribute('data-badge-id')).filter(Boolean)
    const seen = JSON.parse(localStorage.getItem('pivot.progress.v2') ?? '{"seenBadgeIds":[]}').seenBadgeIds ?? []
    return earnedIds.length > 1 && earnedIds.every((id) => seen.includes(id))
  })
  const backfilledSeals = await page.evaluate(() => {
    const seals = Array.from(document.querySelectorAll('.evidence-seal'))
    const earnedIds = seals.filter((seal) => seal.getAttribute('data-earned') === 'true')
      .map((seal) => seal.getAttribute('data-badge-id')).filter(Boolean)
    const seen = JSON.parse(localStorage.getItem('pivot.progress.v2') ?? '{"seenBadgeIds":[]}').seenBadgeIds ?? []
    return {
      earnedIds,
      revealing: seals.filter((seal) => seal.getAttribute('data-reveal') === 'true').length,
      allAcknowledged: earnedIds.every((id) => seen.includes(id)),
      seenCount: seen.length,
    }
  })
  step(
    'backfilled skill badges acknowledge every earned badge while animating at most one',
    backfilledSeals.earnedIds.length > 1
      && backfilledSeals.revealing <= 1
      && backfilledSeals.allAcknowledged,
    JSON.stringify(backfilledSeals),
  )
  await page.locator('.desk-tabs').getByRole('tab', { name: /Saved queries/ }).click()
  await page.locator('.desk-tabs').getByRole('tab', { name: 'Progress', exact: true }).click()
  const backfillRevisitReveals = await page.locator('.evidence-seal[data-reveal="true"]').count()
  step('backfilled skill badges do not replay on Progress revisit', backfillRevisitReveals === 0, `${backfillRevisitReveals} replaying`)
  await page.locator('.desk-tabs').getByRole('tab', { name: 'My work', exact: true }).click()
  // Returning to My work preserves the already-open practice library.
  await page.locator('.scenario-row', { has: page.getByRole('heading', { name: /Practice set 2: Workforce planning/, exact: true }) }).getByRole('button', { name: 'Start practice set 2' }).click()
  await page.waitForFunction((expected) => {
    const used = Array.from(document.querySelectorAll('[data-used-in-ask="true"]'))
      .map((element) => element.getAttribute('data-relation-name')).filter(Boolean).sort()
    return JSON.stringify(used) === JSON.stringify(expected)
  }, [...secondSim.questions[0].tables].sort())
  const auditionUsedRelations = (await databaseNavigator.locator('[data-used-in-ask="true"]').evaluateAll((elements) => (
    elements.map((element) => element.getAttribute('data-relation-name')).filter(Boolean).sort()
  )))
  const expectedAuditionRelations = [...secondSim.questions[0].tables].sort()
  step(
    'practice questions mark their exact tables in Database objects',
    JSON.stringify(auditionUsedRelations) === JSON.stringify(expectedAuditionRelations),
    `${auditionUsedRelations.join(', ')} | expected ${expectedAuditionRelations.join(', ')}`,
  )
  const newSetTitle = await page.locator('.sim-intro-title').textContent()
  const newSetEditor = (await readEditorText(page)).trim()
  const draftIsolation = await page.evaluate(({ firstId, secondIds, auditionId }) => {
    const progress = JSON.parse(localStorage.getItem('pivot.progress.v2') ?? '{}')
    const attempts = Object.values(progress.auditionAttempts ?? {})
      .filter((attempt) => attempt.auditionId === auditionId)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.attemptId.localeCompare(b.attemptId))
    const attempt = attempts.at(-1)
    return {
      currentAttemptId: attempt?.attemptId ?? null,
      otherSet: progress.drafts?.[`mission:${firstId}`]?.sql ?? null,
      legacySelected: secondIds.map((id) => progress.drafts?.[`mission:${id}`]?.sql ?? null),
      selectedAttempt: secondIds.map((id) => progress.drafts?.[`attempt:${attempt?.attemptId}:${id}`]?.sql ?? null),
    }
  }, {
    firstId: firstSim.questions[0].id,
    secondIds: secondSim.questions.map((q) => q.id),
    auditionId: secondSim.id,
  })
  const startedAttemptId = draftIsolation.currentAttemptId
  step(
    'completed first simulation routes to a blank second set',
    newSetTitle === practiceLabels[1] && newSetEditor === '' && /1 of \d+ complete/i.test(screenProgressText ?? ''),
    `${screenProgressText?.trim()} | ${newSetTitle} | ${newSetEditor.slice(0, 40)}`,
  )
  step(
    'new attempt is blank without deleting migration-source drafts',
    !!startedAttemptId
      && draftIsolation.otherSet === 'SELECT 111 AS keep_other_set_draft'
      && draftIsolation.legacySelected.every((draft) => draft === 'SELECT 999 AS leaked_prior_answer')
      && draftIsolation.selectedAttempt.every((draft) => draft === null),
    JSON.stringify(draftIsolation),
  )
  await setEditor(page, 'SELECT 999 AS should_clear_on_same_question_retake')
  await page.waitForTimeout(2200)
  const agedTimerText = await page.locator('.sim-timer').textContent()
  await page.getByRole('button', { name: 'Your desk' }).click()
  await page.getByRole('button', { name: /Start practice: SQL practice/ }).click()
  await page.getByRole('button', { name: 'Restart practice set 2' }).click()
  await page.waitForTimeout(100)
  const retakeEditor = (await readEditorText(page)).trim()
  const restartAttemptState = await page.evaluate(({ auditionId, oldAttemptId, questionIds }) => {
    const progress = JSON.parse(localStorage.getItem('pivot.progress.v2') ?? '{}')
    const attempts = Object.values(progress.auditionAttempts ?? {})
      .filter((attempt) => attempt.auditionId === auditionId)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.attemptId.localeCompare(b.attemptId))
    const currentAttemptId = attempts.at(-1)?.attemptId ?? null
    return {
      currentAttemptId,
      oldDraft: progress.drafts?.[`attempt:${oldAttemptId}:${questionIds[0]}`]?.sql ?? null,
      newDrafts: questionIds.map((id) => progress.drafts?.[`attempt:${currentAttemptId}:${id}`]?.sql ?? null),
    }
  }, {
    auditionId: secondSim.id,
    oldAttemptId: startedAttemptId,
    questionIds: secondSim.questions.map((question) => question.id),
  })
  const restartTimerText = await page.locator('.sim-timer').textContent()
  await page.waitForTimeout(2200)
  const firstTimerText = await page.locator('.sim-timer').textContent()
  await setEditor(page, secondSim.questions[0].canonical)
  await runQuery(page)
  await page.locator('.verdict-correct').waitFor({ timeout: 30000 })
  const linkedAttemptEvidence = await page.evaluate(({ attemptId, questionId }) => {
    const progress = JSON.parse(localStorage.getItem('pivot.progress.v2') ?? '{}')
    const attempt = progress.auditionAttempts?.[attemptId]
    const receiptId = attempt?.solves?.[questionId]
    const receipt = progress.solveReceipts?.[receiptId]
    return { attemptId: attempt?.attemptId ?? null, receiptId: receiptId ?? null, receiptAttemptId: receipt?.attemptId ?? null }
  }, { attemptId: restartAttemptState.currentAttemptId, questionId: secondSim.questions[0].id })
  step(
    'correct simulation answer marks this attempt delivered',
    await page.locator('.delivered-chip').count() === 1,
  )
  step(
    'simulation solve receipt is bound to the active attempt',
    !!linkedAttemptEvidence.receiptId
      && linkedAttemptEvidence.attemptId === restartAttemptState.currentAttemptId
      && linkedAttemptEvidence.receiptAttemptId === restartAttemptState.currentAttemptId,
    JSON.stringify(linkedAttemptEvidence),
  )
  await page.getByRole('button', { name: 'Next question' }).click()
  await page.waitForTimeout(1100)
  const secondTimerText = await page.locator('.sim-timer').textContent()
  const nextEditor = (await readEditorText(page)).trim()
  const nextAttemptState = await page.evaluate(({ attemptId, questionId }) => {
    const progress = JSON.parse(localStorage.getItem('pivot.progress.v2') ?? '{}')
    return {
      attemptExists: !!progress.auditionAttempts?.[attemptId],
      nextDraft: progress.drafts?.[`attempt:${attemptId}:${questionId}`]?.sql ?? null,
    }
  }, { attemptId: restartAttemptState.currentAttemptId, questionId: secondSim.questions[1].id })
  step(
    'simulation same-question restart creates a blank isolated attempt',
    retakeEditor === ''
      && restartAttemptState.currentAttemptId !== startedAttemptId
      && restartAttemptState.oldDraft === 'SELECT 999 AS should_clear_on_same_question_retake'
      && restartAttemptState.newDrafts.every((draft) => draft === null),
    JSON.stringify(restartAttemptState),
  )
  step(
    'simulation restart resets the set timer',
    timerSeconds(agedTimerText) >= 2 && timerSeconds(restartTimerText) <= 1,
    `${agedTimerText} → ${restartTimerText}`,
  )
  step(
    'simulation timer spans the whole screen',
    timerSeconds(firstTimerText) >= 2 && timerSeconds(secondTimerText) > timerSeconds(firstTimerText),
    `${firstTimerText} → ${secondTimerText}`,
  )
  step(
    'simulation next question keeps the attempt and starts blank',
    nextEditor === '' && nextAttemptState.attemptExists && nextAttemptState.nextDraft === null,
    JSON.stringify(nextAttemptState),
  )
  await setEditor(page, 'SELECT 1')
  await runQuery(page)
  await page.locator('.verdict-wrong, .verdict-shape').waitFor({ timeout: 30000 })
  step('simulation retake resets grading', !await page.locator('.delivered-bar').count())

  // Each practice row owns its Retake now; the user picks the set. Retaking
  // the older completion must open ITS intro blank, claiming nothing delivered.
  await page.evaluate(({ firstSimIds, secondSimIds }) => {
    const key = 'pivot.progress.v1'
    const p = JSON.parse(localStorage.getItem(key))
    for (const id of firstSimIds) p.simDone[id] = { missionId: id, completedAt: '2026-01-01T00:00:00.000Z', sql: 'done', title: id }
    for (const id of secondSimIds) p.simDone[id] = { missionId: id, completedAt: '2026-02-01T00:00:00.000Z', sql: 'done', title: id }
    localStorage.setItem(key, JSON.stringify(p))
  }, { firstSimIds: firstSim.questions.map((q) => q.id), secondSimIds: secondSim.questions.map((q) => q.id) })
  await page.reload()
  await page.getByRole('button', { name: 'Back to my desk' }).click()
  await page.locator('.ask-card').waitFor({ timeout: 120000 })
  await page.getByRole('button', { name: 'Your desk' }).click()
  await page.getByRole('button', { name: /Start practice: SQL practice/ }).click()
  await page.getByRole('button', { name: 'Retake practice set 1' }).click()
  const olderFirstTitle = await page.locator('.sim-intro-title').textContent()
  step(
    'fresh practice retake does not claim the blank answer is delivered',
    await page.locator('.delivered-chip').count() === 0,
  )

  // Starting that retake and solving only q1 must not make the abandoned set
  // look newly completed. Its terminal q4 completion still determines recency.
  await setEditor(page, firstSim.questions[0].canonical)
  await runQuery(page)
  await page.locator('.verdict-correct').waitFor({ timeout: 30000 })
  await page.reload()
  await page.getByRole('button', { name: 'Back to my desk' }).click()
  await page.locator('.ask-card').waitFor({ timeout: 120000 })
  await page.getByRole('button', { name: 'Your desk' }).click()
  await page.getByRole('button', { name: /Start practice: SQL practice/ }).click()
  await page.getByRole('button', { name: 'Retake practice set 1' }).click()
  const partialRetakeTitle = await page.locator('.sim-intro-title').textContent()
  step(
    'abandoned partial attempt leaves its practice set retakeable in place',
    olderFirstTitle === practiceLabels[0] && partialRetakeTitle === practiceLabels[0],
    `${olderFirstTitle} → ${partialRetakeTitle}`,
  )

  await page.evaluate(({ firstSimIds }) => {
    const key = 'pivot.progress.v1'
    const p = JSON.parse(localStorage.getItem(key))
    for (const id of firstSimIds) p.simDone[id] = { missionId: id, completedAt: '2026-03-01T00:00:00.000Z', sql: 'done', title: id }
    localStorage.setItem(key, JSON.stringify(p))
  }, { firstSimIds: firstSim.questions.map((q) => q.id) })
  await page.reload()
  await page.getByRole('button', { name: 'Back to my desk' }).click()
  await page.locator('.ask-card').waitFor({ timeout: 120000 })
  await page.getByRole('button', { name: 'Your desk' }).click()
  await page.getByRole('button', { name: /Start practice: SQL practice/ }).click()
  await page.getByRole('button', { name: 'Retake practice set 2' }).click()
  const olderSecondTitle = await page.locator('.sim-intro-title').textContent()
  step(
    'each completed practice set retakes from its own row',
    olderFirstTitle === practiceLabels[0] && olderSecondTitle === practiceLabels[1],
    `${olderFirstTitle} → ${olderSecondTitle}`,
  )

  // Local isolation is a whole-journey invariant: solve, draft, badge, and
  // legacy-import interactions above must all remain browser-local.
  step(
    'local workspace never calls hosted sync through the full journey',
    privateApiRequests.length === 0,
    `privateApiRequests=${JSON.stringify(privateApiRequests)}`,
  )

  // page errors accumulated?
  const realErrors = pageErrors.filter((e) => !/ResizeObserver/.test(e))
  step('no uncaught page errors', realErrors.length === 0, realErrors.slice(0, 2).join(' | '))

  await page.screenshot({ path: '/tmp/pivot-smoke.png', fullPage: false })
} catch (e) {
  step('SMOKE ABORTED', false, String(e).slice(0, 300))
  try { await (await browser?.contexts())?.[0]?.pages()?.[0]?.screenshot({ path: '/tmp/pivot-smoke-fail.png' }) } catch { /* best effort */ }
} finally {
  await browser?.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} steps green`)
if (failed.length) {
  console.error(`Failed steps:\n${failed.map((result) => `- ${result.name}${result.note ? ` — ${result.note}` : ''}`).join('\n')}`)
  process.exit(1)
}
