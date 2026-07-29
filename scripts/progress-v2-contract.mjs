import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const root = path.resolve(import.meta.dirname, '..')

class MemoryStorage {
  #items = new Map()
  get length() { return this.#items.size }
  key(index) { return [...this.#items.keys()][index] ?? null }
  getItem(key) { return this.#items.has(String(key)) ? this.#items.get(String(key)) : null }
  setItem(key, value) { this.#items.set(String(key), String(value)) }
  removeItem(key) { this.#items.delete(String(key)) }
  clear() { this.#items.clear() }
}

class FailingStorage extends MemoryStorage {
  failAfterV3Writes = Number.POSITIVE_INFINITY
  v3Writes = 0
  setItem(key, value) {
    if (String(key).startsWith('pivot.outbox.v3.event.')) {
      if (this.v3Writes >= this.failAfterV3Writes) throw new Error('simulated storage interruption')
      this.v3Writes += 1
    }
    super.setItem(key, value)
  }
}

const storage = new MemoryStorage()
const context = vm.createContext({
  console,
  crypto: globalThis.crypto,
  TextEncoder,
  TextDecoder,
  btoa,
  atob,
  fetch,
  Response,
  Request,
  Headers,
  URL,
  Date,
  setTimeout,
  clearTimeout,
  localStorage: storage,
  window: { addEventListener() {}, removeEventListener() {} },
})
context.globalThis = context

const modules = new Map()

function resolveModule(specifier, parentFile) {
  if (!specifier.startsWith('.')) throw new Error(`Unexpected contract import: ${specifier}`)
  const base = path.resolve(path.dirname(parentFile), specifier)
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, `${base}.json`]
  const resolved = candidates.find((candidate) => existsSync(candidate))
  if (!resolved) throw new Error(`Could not resolve ${specifier} from ${parentFile}`)
  return resolved
}

async function loadModule(file) {
  const resolved = path.resolve(file)
  if (modules.has(resolved)) return modules.get(resolved)

  if (resolved.endsWith('.json')) {
    const value = JSON.parse(readFileSync(resolved, 'utf8'))
    const module = new vm.SyntheticModule(['default'], function setJSON() {
      this.setExport('default', value)
    }, { context, identifier: resolved })
    modules.set(resolved, module)
    return module
  }

  const source = readFileSync(resolved, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      resolveJsonModule: true,
      verbatimModuleSyntax: true,
    },
    fileName: resolved,
  })
  const module = new vm.SourceTextModule(outputText, {
    context,
    identifier: resolved,
    initializeImportMeta(meta) {
      meta.url = `file://${resolved}`
      meta.env = { BASE_URL: '/pivot/' }
    },
  })
  modules.set(resolved, module)
  await module.link((specifier) => loadModule(resolveModule(specifier, resolved)))
  return module
}

async function namespace(relativePath) {
  const module = await loadModule(path.join(root, relativePath))
  if (module.status !== 'evaluated') await module.evaluate()
  return module.namespace
}

const progress = await namespace('src/progress-store.ts')
const progression = await namespace('src/progression.ts')

const tests = []
function test(name, run) { tests.push({ name, run }) }

function receipt(overrides = {}) {
  return {
    receiptId: 'receipt:r1',
    missionId: 'sim01-q1',
    completedAt: '2026-07-13T00:00:01.000Z',
    sql: 'select 1',
    title: 'Q1',
    contentRevision: 'contract',
    mode: 'audition',
    hintLevel: 0,
    attemptId: 'attempt:sim01:a1',
    ...overrides,
  }
}

function exactAttemptFixture() {
  const questionIds = ['sim01-q1', 'sim01-q2', 'sim01-q3', 'sim01-q4']
  const receipts = Object.fromEntries(questionIds.map((missionId, index) => {
    const value = receipt({
      receiptId: `receipt:r${index + 1}`,
      missionId,
      completedAt: `2026-07-13T00:00:0${index + 1}.000Z`,
      title: missionId,
    })
    return [value.receiptId, value]
  }))
  const attempt = {
    attemptId: 'attempt:sim01:a1',
    auditionId: 'sim01',
    startedAt: '2026-07-13T00:00:00.000Z',
    completedAt: '1999-01-01T00:00:00.000Z',
    solves: Object.fromEntries(questionIds.map((id, index) => [id, `receipt:r${index + 1}`])),
  }
  return { policy: { auditionId: 'sim01', questionIds }, receipts, attempt }
}

function permutations(values) {
  if (values.length < 2) return [values]
  return values.flatMap((value, index) => permutations(values.filter((_, candidateIndex) => candidateIndex !== index))
    .map((suffix) => [value, ...suffix]))
}

function progressWithReceipt(value) {
  const state = progress.emptyProgress()
  state.solveReceipts[value.receiptId] = value
  return state
}

function progressWithAttempt(value) {
  const state = progress.emptyProgress()
  state.auditionAttempts[value.attemptId] = value
  return state
}

test('draft deletions are monotone but explicit local recreation advances them', () => {
  let state = progress.emptyProgress()
  const saved = progress.putDraft(state, 'm01', null, 'select 1', '2026-07-13T00:00:01Z')
  const removed = progress.removeDraft(saved.progress, 'm01', null, '2026-07-13T00:00:02Z')
  assert.equal(removed.baseEntityRevision, 1)
  assert.equal(removed.progress.drafts['mission:m01'], undefined)
  assert.equal(removed.progress.draftTombstones['mission:m01'].entityRevision, 2)

  const stale = progress.emptyProgress()
  stale.drafts['mission:m01'] = saved.draft
  const replica = progress.mergeProgress(removed.progress, stale)
  assert.equal(replica.drafts['mission:m01'], undefined)
  assert.equal(replica.draftTombstones['mission:m01'].entityRevision, 2)

  const forged = progress.emptyProgress()
  forged.drafts['mission:m01'] = { ...saved.draft, entityRevision: 999 }
  const imported = progress.mergeProgress(removed.progress, forged, { mode: 'import' })
  assert.equal(imported.drafts['mission:m01'], undefined)

  storage.clear()
  storage.setItem(progress.PROGRESS_V2_KEY, JSON.stringify(progress.persistedProgress(removed.progress)))
  storage.setItem('pivot.draft.m01', 'select resurrected')
  const reloaded = progress.loadProgress()
  assert.equal(reloaded.drafts['mission:m01'], undefined)
  assert.equal(reloaded.draftTombstones['mission:m01'].entityRevision, 2)

  const recreated = progress.putDraft(removed.progress, 'm01', null, 'select 2', '2026-07-13T00:00:03Z')
  assert.equal(recreated.draft.entityRevision, 3)
  assert.equal(recreated.progress.draftTombstones['mission:m01'], undefined)
})

test('draft replica merge is commutative, associative, and idempotent', () => {
  const first = progress.putDraft(progress.emptyProgress(), 'm02', null, 'select 1', '2026-07-13T00:00:01Z').progress
  const deleted = progress.removeDraft(first, 'm02', null, '2026-07-13T00:00:02Z').progress
  const recreated = progress.putDraft(deleted, 'm02', null, 'select 2', '2026-07-13T00:00:03Z').progress
  const ab = progress.mergeProgress(first, deleted)
  const ba = progress.mergeProgress(deleted, first)
  assert.equal(JSON.stringify(ab), JSON.stringify(ba))
  assert.equal(JSON.stringify(progress.mergeProgress(first, first)), JSON.stringify(first))
  const left = progress.mergeProgress(progress.mergeProgress(first, deleted), recreated)
  const right = progress.mergeProgress(first, progress.mergeProgress(deleted, recreated))
  assert.equal(JSON.stringify(left), JSON.stringify(right))
  assert.equal(left.drafts['mission:m02'].sql, 'select 2')
})

test('replica merge is commutative and receipt IDs are immutable', () => {
  const a = progress.emptyProgress()
  const b = progress.emptyProgress()
  a.solveReceipts['receipt:collision'] = receipt({ receiptId: 'receipt:collision', sql: 'select a' })
  b.solveReceipts['receipt:collision'] = receipt({ receiptId: 'receipt:collision', sql: 'select b' })
  const ab = progress.mergeProgress(a, b)
  const ba = progress.mergeProgress(b, a)
  assert.equal(JSON.stringify(ab), JSON.stringify(ba))
  assert.equal(Object.keys(ab.solveReceipts).length, 0)

  const normalizedAB = progress.normalizeProgress({ solveReceipts: { a: a.solveReceipts['receipt:collision'], b: b.solveReceipts['receipt:collision'] } })
  const normalizedBA = progress.normalizeProgress({ solveReceipts: { b: b.solveReceipts['receipt:collision'], a: a.solveReceipts['receipt:collision'] } })
  assert.equal(JSON.stringify(normalizedAB.solveReceipts), JSON.stringify(normalizedBA.solveReceipts))
  assert.equal(Object.keys(normalizedAB.solveReceipts).length, 0)
})

test('receipt identity quarantine is a durable commutative semilattice', () => {
  const pReceipt = receipt({ receiptId: 'receipt:collision', sql: 'select p' })
  const qReceipt = receipt({ receiptId: 'receipt:collision', sql: 'select q' })
  const p = progressWithReceipt(pReceipt)
  const q = progressWithReceipt(qReceipt)
  const pAgain = progressWithReceipt({ ...pReceipt })
  const results = []

  for (const [first, second, third] of permutations([p, q, pAgain])) {
    const left = progress.mergeProgress(progress.mergeProgress(first, second), third)
    const right = progress.mergeProgress(first, progress.mergeProgress(second, third))
    assert.equal(JSON.stringify(left), JSON.stringify(right))
    assert.deepEqual([...left.quarantinedReceiptIds], ['receipt:collision'])
    assert.equal(left.solveReceipts['receipt:collision'], undefined)
    results.push(left)
  }
  assert.equal(new Set(results.map((result) => JSON.stringify(result))).size, 1)

  const quarantined = results[0]
  assert.equal(JSON.stringify(progress.mergeProgress(quarantined, quarantined)), JSON.stringify(quarantined))
  const resurrection = progress.mergeProgress(quarantined, p)
  assert.deepEqual([...resurrection.quarantinedReceiptIds], ['receipt:collision'])
  assert.equal(resurrection.solveReceipts['receipt:collision'], undefined)

  for (const [local, incoming] of [[p, q], [q, p]]) {
    const imported = progress.mergeProgress(local, incoming, { mode: 'import' })
    assert.deepEqual([...imported.quarantinedReceiptIds], ['receipt:collision'])
    assert.equal(imported.solveReceipts['receipt:collision'], undefined)
  }

  const r = progressWithReceipt(receipt({ receiptId: 'receipt:collision', sql: 'select r' }))
  for (const [first, second, third] of permutations([p, q, r])) {
    const left = progress.mergeProgress(progress.mergeProgress(first, second), third)
    const right = progress.mergeProgress(first, progress.mergeProgress(second, third))
    assert.equal(JSON.stringify(left), JSON.stringify(right))
    assert.deepEqual([...left.quarantinedReceiptIds], ['receipt:collision'])
  }
})

test('normalization persists receipt alias poison before a third replica arrives', () => {
  const pReceipt = receipt({ receiptId: 'receipt:alias', sql: 'select p' })
  const qReceipt = receipt({ receiptId: 'receipt:alias', sql: 'select q' })
  const normalized = progress.normalizeProgress({
    version: 2,
    solveReceipts: { firstAlias: pReceipt, secondAlias: qReceipt },
    auditionAttempts: {},
  })
  assert.deepEqual([...normalized.quarantinedReceiptIds], ['receipt:alias'])
  assert.equal(normalized.solveReceipts['receipt:alias'], undefined)

  const roundTrip = progress.normalizeProgress(progress.persistedProgress(normalized))
  assert.deepEqual([...roundTrip.quarantinedReceiptIds], ['receipt:alias'])
  const thirdReplica = progressWithReceipt(pReceipt)
  const afterThirdReplica = progress.mergeProgress(roundTrip, thirdReplica)
  assert.deepEqual([...afterThirdReplica.quarantinedReceiptIds], ['receipt:alias'])
  assert.equal(afterThirdReplica.solveReceipts['receipt:alias'], undefined)
})

test('carried quarantine dominates stale records in every derived index', () => {
  const staleReceipt = receipt({ receiptId: 'receipt:stale' })
  const staleAttempt = {
    attemptId: 'attempt:stale', auditionId: 'sim01', startedAt: '2026-07-13T00:00:00Z', completedAt: null,
    solves: { 'sim01-q1': staleReceipt.receiptId },
  }
  const normalized = progress.normalizeProgress({
    version: 2,
    solveReceipts: { staleReceipt },
    pulls: { 'sim01-q1': staleReceipt },
    simDone: { 'sim01-q1': staleReceipt },
    quarantinedReceiptIds: [staleReceipt.receiptId],
    auditionAttempts: { staleAttempt },
    quarantinedAttemptIds: [staleAttempt.attemptId],
  })
  assert.deepEqual(Object.keys(normalized.solveReceipts), [])
  assert.deepEqual(Object.keys(normalized.pulls), [])
  assert.deepEqual(Object.keys(normalized.simDone), [])
  assert.deepEqual(Object.keys(normalized.auditionAttempts), [])
  assert.deepEqual([...normalized.quarantinedReceiptIds], ['receipt:stale'])
  assert.deepEqual([...normalized.quarantinedAttemptIds], ['attempt:stale'])
})

test('the storage-event union is persisted before either tab can reload', () => {
  const appSource = readFileSync(path.join(root, 'src/App.tsx'), 'utf8')
  assert.match(
    appSource,
    /subscribeToProgress\(\(incoming\)[\s\S]*mergeSaveProgress\(mergeProgress\(progressRef\.current, incoming\)\)/,
    'App must persist the merged storage-event union, not only paint it in memory',
  )

  const first = progress.recordCampaignSolve(progress.emptyProgress(), {
    missionId: 'm01', sql: 'select 1', title: 'first', contentRevision: 'contract', hintLevel: 0,
    completedAt: '2026-07-13T00:00:01Z',
  }).progress
  const second = progress.recordCampaignSolve(progress.emptyProgress(), {
    missionId: 'm02', sql: 'select 2', title: 'second', contentRevision: 'contract', hintLevel: 0,
    completedAt: '2026-07-13T00:00:02Z',
  }).progress
  storage.clear()
  storage.setItem(progress.PROGRESS_V2_KEY, JSON.stringify(progress.persistedProgress(second)))
  const union = progress.mergeSaveProgress(progress.mergeProgress(first, second))
  assert.deepEqual(Object.keys(union.pulls), ['m01', 'm02'])
  assert.deepEqual(Object.keys(progress.loadProgress().pulls), ['m01', 'm02'])
})

test('audition completion is derived only from the exact linked manifest evidence', () => {
  const { policy, receipts, attempt } = exactAttemptFixture()
  const complete = progress.exactAuditionCompletion(attempt, receipts, policy)
  assert.equal(complete.completedAt, '2026-07-13T00:00:04.000Z')
  assert.deepEqual([...complete.receiptIds], ['receipt:r1', 'receipt:r2', 'receipt:r3', 'receipt:r4'])

  assert.equal(progress.exactAuditionCompletion({ ...attempt, solves: {} }, receipts, policy), null)
  assert.equal(progress.exactAuditionCompletion({ ...attempt, solves: { ...attempt.solves, surprise: 'receipt:r1' } }, receipts, policy), null)
  assert.equal(progress.exactAuditionCompletion(attempt, { ...receipts, 'receipt:r4': { ...receipts['receipt:r4'], attemptId: 'attempt:other' } }, policy), null)
  assert.equal(progress.exactAuditionCompletion(attempt, { ...receipts, 'receipt:r4': { ...receipts['receipt:r4'], missionId: 'sim01-q3' } }, policy), null)

  const started = progress.startAuditionAttempt(progress.emptyProgress(), 'sim01', '2026-07-13T00:00:00Z')
  assert.throws(() => progress.recordAuditionSolve(started.progress, {
    missionId: 'sim02-q1', sql: 'select 1', title: 'wrong', contentRevision: 'contract', hintLevel: 0,
  }, started.attemptId, policy), /not part of audition/)

  const alreadyBound = progress.emptyProgress()
  alreadyBound.auditionAttempts[attempt.attemptId] = attempt
  assert.throws(() => progress.recordAuditionSolve(alreadyBound, {
    missionId: 'sim01-q1', sql: 'select again', title: 'again', contentRevision: 'contract', hintLevel: 0,
  }, attempt.attemptId, policy), /immutable evidence/)
})

test('conflicting attempt identities are quarantined instead of reassigned', () => {
  const first = progress.emptyProgress()
  const second = progress.emptyProgress()
  first.auditionAttempts.shared = {
    attemptId: 'shared', auditionId: 'sim01', startedAt: '2026-07-13T00:00:00.000Z', completedAt: null, solves: {},
  }
  second.auditionAttempts.shared = {
    attemptId: 'shared', auditionId: 'sim02', startedAt: '2026-07-13T00:00:00.000Z', completedAt: null, solves: {},
  }
  assert.equal(progress.mergeProgress(first, second).auditionAttempts.shared, undefined)
  assert.equal(progress.mergeProgress(second, first).auditionAttempts.shared, undefined)

  const normalized = progress.normalizeProgress({
    auditionAttempts: {
      a: first.auditionAttempts.shared,
      b: second.auditionAttempts.shared,
    },
  })
  assert.equal(normalized.auditionAttempts.shared, undefined)
})

test('attempt quarantine survives every merge tree, import, and matching payload', () => {
  const pAttempt = {
    attemptId: 'shared', auditionId: 'sim01', startedAt: '2026-07-13T00:00:00.000Z', completedAt: null, solves: {},
  }
  const qAttempt = {
    attemptId: 'shared', auditionId: 'sim02', startedAt: '2026-07-13T00:00:00.000Z', completedAt: null, solves: {},
  }
  const p = progressWithAttempt(pAttempt)
  const q = progressWithAttempt(qAttempt)
  const pAgain = progressWithAttempt({ ...pAttempt })
  const results = []

  for (const [first, second, third] of permutations([p, q, pAgain])) {
    const left = progress.mergeProgress(progress.mergeProgress(first, second), third)
    const right = progress.mergeProgress(first, progress.mergeProgress(second, third))
    assert.equal(JSON.stringify(left), JSON.stringify(right))
    assert.deepEqual([...left.quarantinedAttemptIds], ['shared'])
    assert.equal(left.auditionAttempts.shared, undefined)
    results.push(left)
  }
  assert.equal(new Set(results.map((result) => JSON.stringify(result))).size, 1)

  const quarantined = results[0]
  assert.equal(JSON.stringify(progress.mergeProgress(quarantined, quarantined)), JSON.stringify(quarantined))
  assert.equal(progress.mergeProgress(quarantined, p).auditionAttempts.shared, undefined)
  assert.deepEqual([...progress.mergeProgress(quarantined, p).quarantinedAttemptIds], ['shared'])
  for (const [local, incoming] of [[p, q], [q, p]]) {
    const imported = progress.mergeProgress(local, incoming, { mode: 'import' })
    assert.equal(imported.auditionAttempts.shared, undefined)
    assert.deepEqual([...imported.quarantinedAttemptIds], ['shared'])
  }
})

test('modern attempt bindings fail closed while partial legacy attempts still join', () => {
  const first = progressWithAttempt({
    attemptId: 'attempt:modern', auditionId: 'sim01', startedAt: '2026-07-13T00:00:00.000Z', completedAt: null,
    solves: { 'sim01-q1': 'receipt:a' },
  })
  const rebound = progressWithAttempt({
    attemptId: 'attempt:modern', auditionId: 'sim01', startedAt: '2026-07-13T00:00:00.000Z', completedAt: null,
    solves: { 'sim01-q1': 'receipt:b' },
  })
  const conflict = progress.mergeProgress(first, rebound)
  assert.equal(conflict.auditionAttempts['attempt:modern'], undefined)
  assert.deepEqual([...conflict.quarantinedAttemptIds], ['attempt:modern'])
  const thirdBinding = progressWithAttempt({
    attemptId: 'attempt:modern', auditionId: 'sim01', startedAt: '2026-07-13T00:00:00.000Z', completedAt: null,
    solves: { 'sim01-q1': 'receipt:c' },
  })
  for (const [one, two, three] of permutations([first, rebound, thirdBinding])) {
    const left = progress.mergeProgress(progress.mergeProgress(one, two), three)
    const right = progress.mergeProgress(one, progress.mergeProgress(two, three))
    assert.equal(JSON.stringify(left), JSON.stringify(right))
    assert.deepEqual([...left.quarantinedAttemptIds], ['attempt:modern'])
  }

  const legacyLater = progressWithAttempt({
    attemptId: 'legacy:sim01', auditionId: 'sim01', startedAt: '2026-07-13T00:00:02.000Z', completedAt: null,
    solves: { 'sim01-q1': 'receipt:z', 'sim01-q2': 'receipt:b' },
  })
  const legacyEarlier = progressWithAttempt({
    attemptId: 'legacy:sim01', auditionId: 'sim01', startedAt: '2026-07-13T00:00:01.000Z', completedAt: null,
    solves: { 'sim01-q1': 'receipt:a', 'sim01-q3': 'receipt:c' },
  })
  const legacyAB = progress.mergeProgress(legacyLater, legacyEarlier)
  const legacyBA = progress.mergeProgress(legacyEarlier, legacyLater)
  assert.equal(JSON.stringify(legacyAB), JSON.stringify(legacyBA))
  assert.deepEqual([...legacyAB.quarantinedAttemptIds], [])
  assert.deepEqual(JSON.parse(JSON.stringify(legacyAB.auditionAttempts['legacy:sim01'])), {
    attemptId: 'legacy:sim01',
    auditionId: 'sim01',
    startedAt: '2026-07-13T00:00:01.000Z',
    completedAt: null,
    solves: { 'sim01-q1': 'receipt:z', 'sim01-q2': 'receipt:b', 'sim01-q3': 'receipt:c' },
  })
})

test('attempt alias poison is persisted without synthesizing a replacement', () => {
  const normalized = progress.normalizeProgress({
    version: 2,
    auditionAttempts: {
      firstAlias: { attemptId: 'alias', auditionId: 'sim01', startedAt: '2026-07-13T00:00:00Z', completedAt: null, solves: {} },
      secondAlias: { attemptId: 'alias', auditionId: 'sim02', startedAt: '2026-07-13T00:00:00Z', completedAt: null, solves: {} },
    },
    simDone: {
      'sim01-q1': receipt({ receiptId: 'legacy-candidate', attemptId: null, contentRevision: 'legacy-v1' }),
    },
  })
  assert.deepEqual([...normalized.quarantinedAttemptIds], ['alias'])
  assert.deepEqual(Object.keys(normalized.auditionAttempts), [])

  const roundTrip = progress.normalizeProgress(progress.persistedProgress(normalized))
  const matchingReplica = progressWithAttempt({
    attemptId: 'alias', auditionId: 'sim01', startedAt: '2026-07-13T00:00:00.000Z', completedAt: null, solves: {},
  })
  const merged = progress.mergeProgress(roundTrip, matchingReplica)
  assert.equal(merged.auditionAttempts.alias, undefined)
  assert.deepEqual([...merged.quarantinedAttemptIds], ['alias'])
})

test('raw v1 audition evidence survives normalize, persistence, reload, and merge', () => {
  const questionIds = ['sim01-q1', 'sim01-q2', 'sim01-q3', 'sim01-q4']
  const simDone = Object.fromEntries(questionIds.map((missionId, index) => [missionId, {
    missionId,
    completedAt: `2026-07-13T00:00:0${index + 1}.000Z`,
    sql: `select ${index + 1}`,
    title: missionId,
  }]))
  const normalized = progress.normalizeProgress({ version: 1, simDone })
  const policy = { auditionId: 'sim01', questionIds }
  assert.ok(progress.exactAuditionCompletion(normalized.auditionAttempts['legacy:sim01'], normalized.solveReceipts, policy))

  storage.clear()
  storage.setItem(progress.PROGRESS_V2_KEY, JSON.stringify(progress.persistedProgress(normalized)))
  const reloaded = progress.loadProgress()
  const merged = progress.mergeProgress(normalized, reloaded)
  const completion = progress.exactAuditionCompletion(merged.auditionAttempts['legacy:sim01'], merged.solveReceipts, policy)
  assert.equal(completion?.completedAt, '2026-07-13T00:00:04.000Z')
  assert.deepEqual([...merged.quarantinedReceiptIds], [])
  assert.deepEqual([...merged.quarantinedAttemptIds], [])

  const editedAtSameTime = Object.fromEntries(Object.entries(simDone).map(([missionId, value]) => [missionId, {
    ...value,
    sql: 'edited legacy SQL',
  }]))
  storage.setItem(progress.LEGACY_PROGRESS_KEY, JSON.stringify({ version: 1, simDone: editedAtSameTime }))
  const edited = progress.loadProgress()
  const editedCompletion = progress.exactAuditionCompletion(edited.auditionAttempts['legacy:sim01'], edited.solveReceipts, policy)
  assert.equal(editedCompletion?.completedAt, '2026-07-13T00:00:04.000Z')
  assert.deepEqual([...edited.quarantinedReceiptIds], [])

  const newer = Object.fromEntries(Object.entries(editedAtSameTime).map(([missionId, value], index) => [missionId, {
    ...value,
    completedAt: `2026-07-14T00:00:0${index + 1}.000Z`,
  }]))
  storage.setItem(progress.LEGACY_PROGRESS_KEY, JSON.stringify({ version: 1, simDone: newer }))
  const refreshed = progress.loadProgress()
  const refreshedCompletion = progress.exactAuditionCompletion(refreshed.auditionAttempts['legacy:sim01'], refreshed.solveReceipts, policy)
  assert.equal(refreshedCompletion?.completedAt, '2026-07-14T00:00:04.000Z')
  assert.deepEqual([...refreshed.quarantinedReceiptIds], [])
})

test('progression selectors ignore forged completedAt and accept exact evidence', () => {
  const { receipts, attempt } = exactAttemptFixture()
  const forged = progress.emptyProgress()
  forged.auditionAttempts[attempt.attemptId] = { ...attempt, solves: {} }
  assert.deepEqual([...progression.completedAuditionIds(forged)], [])

  const exact = progress.emptyProgress()
  exact.solveReceipts = receipts
  exact.auditionAttempts[attempt.attemptId] = attempt
  assert.deepEqual([...progression.completedAuditionIds(exact)], ['sim01'])
})

let failures = 0
for (const { name, run } of tests) {
  try {
    await run()
    console.log(`PASS ${name}`)
  } catch (error) {
    failures += 1
    console.error(`FAIL ${name}`)
    console.error(error instanceof Error ? error.stack : error)
  }
}

if (failures) {
  console.error(`\n${failures} of ${tests.length} ProgressV2 contracts failed.`)
  process.exitCode = 1
} else {
  console.log(`\nPASS ${tests.length} ProgressV2 contracts.`)
}
