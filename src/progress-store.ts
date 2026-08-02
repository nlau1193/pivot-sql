export const PROGRESS_V2_KEY = 'pivot.progress.v2'
export const LEGACY_PROGRESS_KEY = 'pivot.progress.v1'
export const PROGRESS_ENVELOPE_KIND = 'pivot-progress-v2'

export type EvidenceMode = 'campaign' | 'audition'
export type HintEvidence = number | 'legacy-unknown'

export interface SolveReceipt {
  receiptId: string
  missionId: string
  completedAt: string
  sql: string
  title: string
  contentRevision: string
  mode: EvidenceMode
  hintLevel: HintEvidence
  attemptId: string | null
}

export interface AuditionAttempt {
  attemptId: string
  auditionId: string
  startedAt: string
  completedAt: string | null
  solves: Record<string, string>
}

export interface ProgressDraft {
  entityId: string
  questionId: string
  attemptId: string | null
  sql: string
  updatedAt: string
  entityRevision: number
}

export interface ProgressDraftTombstone {
  entityId: string
  questionId: string
  attemptId: string | null
  deletedAt: string
  entityRevision: number
}

export interface AuditionPolicy {
  auditionId: string
  questionIds: readonly string[]
}

export interface AuditionCompletion {
  attemptId: string
  auditionId: string
  completedAt: string
  receiptIds: string[]
}

export interface ProgressV2 {
  version: 2
  pulls: Record<string, SolveReceipt>
  simDone: Record<string, SolveReceipt>
  solveReceipts: Record<string, SolveReceipt>
  /** Grow-only identity tombstones. A conflicting immutable ID proves neither payload. */
  quarantinedReceiptIds: string[]
  auditionAttempts: Record<string, AuditionAttempt>
  /** Grow-only identity tombstones for conflicting attempt identities or bindings. */
  quarantinedAttemptIds: string[]
  drafts: Record<string, ProgressDraft>
  draftTombstones: Record<string, ProgressDraftTombstone>
  seenBadgeIds: string[]
  importedEnvelopeIds: string[]
  lastMissionId: string | null
  lastSeenAt: string | null
  /** Runtime truth only; omitted from the persisted envelope. */
  storageAvailable: boolean
}

export type PersistedProgressV2 = Omit<ProgressV2, 'storageAvailable'>

export interface ProgressImportResult {
  ok: boolean
  progress: ProgressV2
  envelopeId: string | null
  alreadyImported: boolean
  error?: 'invalid' | 'storage_unavailable'
}

type RecordValue = Record<string, unknown>

const isRecord = (value: unknown): value is RecordValue => typeof value === 'object' && value !== null && !Array.isArray(value)
const validDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const canonicalDate = (value: string): string => new Date(value).toISOString()
const uniqueStrings = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))]
  : []

export function emptyProgress(storageAvailable = true): ProgressV2 {
  return {
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
    storageAvailable,
  }
}

function normalizeReceipt(value: unknown, fallbackId: string, fallbackMode: EvidenceMode): SolveReceipt | null {
  if (!isRecord(value) || typeof value.sql !== 'string' || !validDate(value.completedAt)) return null
  const missionId = typeof value.missionId === 'string' && value.missionId ? value.missionId : fallbackId
  const mode = value.mode === 'audition' || value.mode === 'campaign' ? value.mode : fallbackMode
  const attemptId = typeof value.attemptId === 'string' && value.attemptId ? value.attemptId : null
  const completedAt = canonicalDate(value.completedAt)
  const title = typeof value.title === 'string' ? value.title : missionId
  const contentRevision = typeof value.contentRevision === 'string' ? value.contentRevision : 'legacy-v1'
  const hintLevel = value.hintLevel === 'legacy-unknown' || (Number.isInteger(value.hintLevel) && Number(value.hintLevel) >= 0)
    ? value.hintLevel as HintEvidence
    : 'legacy-unknown'
  const receiptId = typeof value.receiptId === 'string' && value.receiptId
    ? value.receiptId
    : `legacy:${mode}:${missionId}:${completedAt}:${legacyReceiptFingerprint(canonicalJSON({
        missionId,
        completedAt,
        sql: value.sql,
        title,
        contentRevision,
        mode,
        hintLevel,
        attemptId,
      }))}`
  return {
    receiptId,
    missionId,
    completedAt,
    sql: value.sql,
    title,
    contentRevision,
    mode,
    hintLevel,
    attemptId,
  }
}

interface ReceiptLedgerState {
  records: Record<string, SolveReceipt>
  quarantinedIds: string[]
}

interface AttemptLedgerState {
  records: Record<string, AuditionAttempt>
  quarantinedIds: string[]
}

function normalizeReceiptMap(
  value: unknown,
  mode: EvidenceMode,
  initialQuarantinedIds: readonly string[] = [],
): ReceiptLedgerState {
  const out: Record<string, SolveReceipt> = {}
  const quarantinedIds = new Set(initialQuarantinedIds)
  if (!isRecord(value)) return { records: out, quarantinedIds: [...quarantinedIds].sort() }
  for (const [id, candidate] of Object.entries(value)) {
    const receipt = normalizeReceipt(candidate, id, mode)
    if (!receipt) continue
    if (quarantinedIds.has(receipt.receiptId)) continue
    const prior = out[receipt.receiptId]
    if (!prior) {
      out[receipt.receiptId] = receipt
    } else if (canonicalJSON(receipt) !== canonicalJSON(prior)) {
      // A receipt identity is immutable. Corrupt storage with two payloads for
      // one ID proves neither payload, so discard both instead of selecting a
      // deterministic winner that could silently manufacture evidence.
      delete out[receipt.receiptId]
      quarantinedIds.add(receipt.receiptId)
    }
  }
  return { records: sortedRecord(out), quarantinedIds: [...quarantinedIds].sort() }
}

function mergeLastMission(a: ProgressV2, b: ProgressV2): string | null {
  if (!a.lastMissionId) return b.lastMissionId
  if (!b.lastMissionId) return a.lastMissionId
  const aSeen = a.lastSeenAt ?? ''
  const bSeen = b.lastSeenAt ?? ''
  if (aSeen !== bSeen) return aSeen > bSeen ? a.lastMissionId : b.lastMissionId
  return a.lastMissionId.localeCompare(b.lastMissionId) <= 0 ? a.lastMissionId : b.lastMissionId
}

function canonicalJSON(value: unknown): string {
  const visit = (candidate: unknown): unknown => {
    if (Array.isArray(candidate)) return candidate.map(visit)
    if (!isRecord(candidate)) return candidate
    return Object.fromEntries(Object.keys(candidate).sort().map((key) => [key, visit(candidate[key])]))
  }
  return JSON.stringify(visit(value))
}

function legacyReceiptFingerprint(value: string): string {
  // v1 rows never carried immutable IDs. Include their full normalized payload
  // in a compact deterministic identity so an edited legacy row becomes new
  // evidence instead of colliding with an older migrated snapshot.
  let first = 0x811c9dc5
  let second = 0x9e3779b9
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    first = Math.imul(first ^ code, 0x01000193)
    second = Math.imul(second ^ code, 0x85ebca6b)
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`
}

function sortedRecord<T>(value: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
}

function mergeReceiptLedgers(
  a: Record<string, SolveReceipt>,
  b: Record<string, SolveReceipt>,
  aQuarantinedIds: readonly string[] = [],
  bQuarantinedIds: readonly string[] = [],
): ReceiptLedgerState {
  const quarantinedIds = new Set([...aQuarantinedIds, ...bQuarantinedIds])
  const out = Object.fromEntries(Object.entries(a).filter(([receiptId]) => !quarantinedIds.has(receiptId)))
  for (const [receiptId, incoming] of Object.entries(b)) {
    if (quarantinedIds.has(receiptId)) continue
    const prior = out[receiptId]
    if (!prior) {
      out[receiptId] = incoming
      continue
    }
    const priorCanonical = canonicalJSON(prior)
    const incomingCanonical = canonicalJSON(incoming)
    if (priorCanonical === incomingCanonical) continue
    // Identity evidence is symmetric even when the surrounding operation is a
    // legacy import. Once an ID has two payloads, neither remains admissible.
    delete out[receiptId]
    quarantinedIds.add(receiptId)
  }
  return { records: sortedRecord(out), quarantinedIds: [...quarantinedIds].sort() }
}

function latestIndex(receipts: Record<string, SolveReceipt>, mode: EvidenceMode): Record<string, SolveReceipt> {
  const out: Record<string, SolveReceipt> = {}
  for (const receipt of Object.values(receipts).sort((a, b) => a.receiptId.localeCompare(b.receiptId))) {
    if (receipt.mode !== mode) continue
    const prior = out[receipt.missionId]
    if (!prior || prior.completedAt < receipt.completedAt || (prior.completedAt === receipt.completedAt && prior.receiptId < receipt.receiptId)) {
      out[receipt.missionId] = receipt
    }
  }
  return sortedRecord(out)
}

function isSyntheticLegacyAttempt(attempt: AuditionAttempt): boolean {
  return attempt.attemptId === `legacy:${attempt.auditionId}`
}

function chooseSolveReference(a: string, b: string): string {
  // Synthetic v1 IDs place canonical completion time before their payload
  // fingerprint, so max() retains the newest legacy snapshot while remaining
  // a replica-independent total order.
  return a.localeCompare(b) >= 0 ? a : b
}

function joinAttempt(prior: AuditionAttempt, incoming: AuditionAttempt): AuditionAttempt | null {
  const legacy = isSyntheticLegacyAttempt(prior) && isSyntheticLegacyAttempt(incoming)
  if (prior.auditionId !== incoming.auditionId || (!legacy && prior.startedAt !== incoming.startedAt)) return null

  const solves = { ...prior.solves }
  for (const [questionId, receiptId] of Object.entries(incoming.solves)) {
    if (!solves[questionId]) {
      solves[questionId] = receiptId
    } else if (solves[questionId] !== receiptId) {
      // Modern attempts bind each authored question to exactly one immutable
      // receipt. Legacy-v1 replicas may derive duplicate receipts, so retain a
      // deterministic total-order winner for only that compatibility shape.
      if (!legacy) return null
      solves[questionId] = chooseSolveReference(solves[questionId], receiptId)
    }
  }

  return {
    ...prior,
    startedAt: legacy ? [prior.startedAt, incoming.startedAt].sort()[0] : prior.startedAt,
    solves: sortedRecord(solves),
    completedAt: [prior.completedAt, incoming.completedAt].filter((date): date is string => !!date).sort().at(-1) ?? null,
  }
}

function normalizeAttempts(
  value: unknown,
  initialQuarantinedIds: readonly string[] = [],
): AttemptLedgerState {
  const out: Record<string, AuditionAttempt> = {}
  const quarantinedIds = new Set(initialQuarantinedIds)
  if (!isRecord(value)) return { records: out, quarantinedIds: [...quarantinedIds].sort() }
  for (const [id, candidate] of Object.entries(value)) {
    if (!isRecord(candidate)) continue
    const attemptId = typeof candidate.attemptId === 'string' && candidate.attemptId ? candidate.attemptId : id
    if (typeof candidate.auditionId !== 'string' || !candidate.auditionId || !validDate(candidate.startedAt)) continue
    const solves: Record<string, string> = {}
    if (isRecord(candidate.solves)) {
      for (const [questionId, receiptId] of Object.entries(candidate.solves)) if (typeof receiptId === 'string') solves[questionId] = receiptId
    }
    const attempt: AuditionAttempt = {
      attemptId,
      auditionId: candidate.auditionId,
      startedAt: canonicalDate(candidate.startedAt),
      completedAt: validDate(candidate.completedAt) ? canonicalDate(candidate.completedAt) : null,
      solves,
    }
    if (quarantinedIds.has(attemptId)) continue
    const prior = out[attemptId]
    const joined = prior ? joinAttempt(prior, attempt) : attempt
    if (!joined) {
      delete out[attemptId]
      quarantinedIds.add(attemptId)
      continue
    }
    out[attemptId] = joined
  }
  return { records: sortedRecord(out), quarantinedIds: [...quarantinedIds].sort() }
}

function normalizeDrafts(value: unknown): Record<string, ProgressDraft> {
  if (!isRecord(value)) return {}
  const out: Record<string, ProgressDraft> = {}
  for (const [id, candidate] of Object.entries(value)) {
    if (!isRecord(candidate) || typeof candidate.sql !== 'string') continue
    const entityId = typeof candidate.entityId === 'string' && candidate.entityId ? candidate.entityId : id
    const questionId = typeof candidate.questionId === 'string' && candidate.questionId ? candidate.questionId : entityId.replace(/^mission:/, '')
    out[entityId] = {
      entityId,
      questionId,
      attemptId: typeof candidate.attemptId === 'string' && candidate.attemptId ? candidate.attemptId : null,
      sql: candidate.sql,
      updatedAt: validDate(candidate.updatedAt) ? canonicalDate(candidate.updatedAt) : new Date(0).toISOString(),
      entityRevision: Number.isInteger(candidate.entityRevision) && Number(candidate.entityRevision) >= 0 ? Number(candidate.entityRevision) : 0,
    }
  }
  return out
}

function normalizeDraftTombstones(value: unknown): Record<string, ProgressDraftTombstone> {
  if (!isRecord(value)) return {}
  const out: Record<string, ProgressDraftTombstone> = {}
  for (const [id, candidate] of Object.entries(value)) {
    if (!isRecord(candidate)) continue
    const entityId = typeof candidate.entityId === 'string' && candidate.entityId ? candidate.entityId : id
    const questionId = typeof candidate.questionId === 'string' && candidate.questionId
      ? candidate.questionId
      : entityId.split(':').at(-1) ?? entityId
    if (!validDate(candidate.deletedAt)) continue
    out[entityId] = {
      entityId,
      questionId,
      attemptId: typeof candidate.attemptId === 'string' && candidate.attemptId ? candidate.attemptId : null,
      deletedAt: canonicalDate(candidate.deletedAt),
      entityRevision: Number.isInteger(candidate.entityRevision) && Number(candidate.entityRevision) >= 0 ? Number(candidate.entityRevision) : 0,
    }
  }
  return out
}

function legacyAttempts(simDone: Record<string, SolveReceipt>): Record<string, AuditionAttempt> {
  const grouped: Record<string, SolveReceipt[]> = {}
  for (const receipt of Object.values(simDone)) {
    const match = /^(sim\d+)-q\d+$/.exec(receipt.missionId)
    if (!match) continue
    ;(grouped[match[1]] ??= []).push(receipt)
  }
  const out: Record<string, AuditionAttempt> = {}
  for (const [auditionId, receipts] of Object.entries(grouped)) {
    const attemptId = `legacy:${auditionId}`
    const solves = Object.fromEntries(receipts.map((receipt) => [receipt.missionId, receipt.receiptId]))
    const sorted = receipts.map((receipt) => receipt.completedAt).sort()
    out[attemptId] = {
      attemptId,
      auditionId,
      startedAt: sorted[0],
      // Completion is derived later against the authored manifest. A count of
      // four similarly named receipts is not sufficient evidence.
      completedAt: null,
      solves,
    }
  }
  return out
}

type DraftState =
  | { kind: 'draft'; value: ProgressDraft }
  | { kind: 'tombstone'; value: ProgressDraftTombstone }

function draftStateRevision(state: DraftState): number { return state.value.entityRevision }
function draftStateTime(state: DraftState): string {
  return state.kind === 'draft' ? state.value.updatedAt : state.value.deletedAt
}

function chooseDraftState(prior: DraftState | undefined, incoming: DraftState, mode: 'replica' | 'import'): DraftState {
  if (!prior) return incoming
  if (mode === 'import' && prior.kind === 'tombstone' && incoming.kind === 'draft') return prior
  const priorRevision = draftStateRevision(prior)
  const incomingRevision = draftStateRevision(incoming)
  if (priorRevision !== incomingRevision) return incomingRevision > priorRevision ? incoming : prior
  if (prior.kind !== incoming.kind) return prior.kind === 'tombstone' ? prior : incoming
  const priorTime = draftStateTime(prior)
  const incomingTime = draftStateTime(incoming)
  if (priorTime !== incomingTime) return incomingTime > priorTime ? incoming : prior
  return canonicalJSON(prior.value) <= canonicalJSON(incoming.value) ? prior : incoming
}

function mergeDraftStates(
  aDrafts: Record<string, ProgressDraft>,
  aTombstones: Record<string, ProgressDraftTombstone>,
  bDrafts: Record<string, ProgressDraft>,
  bTombstones: Record<string, ProgressDraftTombstone>,
  mode: 'replica' | 'import',
): { drafts: Record<string, ProgressDraft>; draftTombstones: Record<string, ProgressDraftTombstone> } {
  const states = new Map<string, DraftState>()
  const apply = (entityId: string, state: DraftState, mergeMode: 'replica' | 'import') => {
    states.set(entityId, chooseDraftState(states.get(entityId), state, mergeMode))
  }
  for (const [entityId, draft] of Object.entries(aDrafts)) apply(entityId, { kind: 'draft', value: draft }, 'replica')
  for (const [entityId, tombstone] of Object.entries(aTombstones)) apply(entityId, { kind: 'tombstone', value: tombstone }, 'replica')
  for (const [entityId, draft] of Object.entries(bDrafts)) apply(entityId, { kind: 'draft', value: draft }, mode)
  for (const [entityId, tombstone] of Object.entries(bTombstones)) apply(entityId, { kind: 'tombstone', value: tombstone }, mode)

  const drafts: Record<string, ProgressDraft> = {}
  const draftTombstones: Record<string, ProgressDraftTombstone> = {}
  for (const [entityId, state] of [...states.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (state.kind === 'draft') drafts[entityId] = state.value
    else draftTombstones[entityId] = state.value
  }
  return { drafts, draftTombstones }
}

/** Coerce corrupt, v1, or v2 data into a safe v2 shape. */
export function normalizeProgress(raw: unknown, storageAvailable = true): ProgressV2 {
  if (!isRecord(raw)) return emptyProgress(storageAvailable)
  const carriedReceiptQuarantine = uniqueStrings(raw.quarantinedReceiptIds)
  const indexedPulls = normalizeReceiptMap(raw.pulls, 'campaign', carriedReceiptQuarantine)
  const indexedSims = normalizeReceiptMap(raw.simDone, 'audition', carriedReceiptQuarantine)
  let ledgerState = normalizeReceiptMap(raw.solveReceipts, 'campaign', carriedReceiptQuarantine)
  ledgerState = mergeReceiptLedgers(
    ledgerState.records,
    indexedPulls.records,
    ledgerState.quarantinedIds,
    indexedPulls.quarantinedIds,
  )
  ledgerState = mergeReceiptLedgers(
    ledgerState.records,
    indexedSims.records,
    ledgerState.quarantinedIds,
    indexedSims.quarantinedIds,
  )
  const ledger = ledgerState.records
  const attemptsState = normalizeAttempts(raw.auditionAttempts, uniqueStrings(raw.quarantinedAttemptIds))
  const isLegacySource = raw.version !== 2 && !isRecord(raw.auditionAttempts)
  const attempts = isLegacySource && !attemptsState.quarantinedIds.length
    ? legacyAttempts(latestIndex(ledger, 'audition'))
    : attemptsState.records
  const draftStates = mergeDraftStates(
    {},
    {},
    normalizeDrafts(raw.drafts),
    normalizeDraftTombstones(raw.draftTombstones),
    'replica',
  )
  const normalized: ProgressV2 = {
    version: 2,
    pulls: latestIndex(ledger, 'campaign'),
    simDone: latestIndex(ledger, 'audition'),
    solveReceipts: ledger,
    quarantinedReceiptIds: ledgerState.quarantinedIds,
    auditionAttempts: attempts,
    quarantinedAttemptIds: attemptsState.quarantinedIds,
    drafts: draftStates.drafts,
    draftTombstones: draftStates.draftTombstones,
    seenBadgeIds: uniqueStrings(raw.seenBadgeIds).sort(),
    importedEnvelopeIds: uniqueStrings(raw.importedEnvelopeIds).sort(),
    lastMissionId: typeof raw.lastMissionId === 'string' ? raw.lastMissionId : null,
    lastSeenAt: validDate(raw.lastSeenAt) ? canonicalDate(raw.lastSeenAt) : null,
    storageAvailable,
  }
  return normalized
}

/**
 * Derive completion from the exact authored audition policy and immutable solve
 * receipts. `attempt.completedAt` is display/cache data and is never evidence.
 */
export function exactAuditionCompletion(
  attempt: AuditionAttempt,
  solveReceipts: Record<string, SolveReceipt>,
  policy: AuditionPolicy,
): AuditionCompletion | null {
  if (!policy.auditionId || attempt.auditionId !== policy.auditionId) return null
  const questionIds = [...policy.questionIds]
  if (!questionIds.length || new Set(questionIds).size !== questionIds.length || questionIds.some((id) => !id)) return null
  const solveQuestionIds = Object.keys(attempt.solves)
  if (solveQuestionIds.length !== questionIds.length || questionIds.some((id) => !Object.hasOwn(attempt.solves, id))) return null

  const receiptIds: string[] = []
  const completedTimes: number[] = []
  for (const questionId of questionIds) {
    const receiptId = attempt.solves[questionId]
    const receipt = solveReceipts[receiptId]
    if (!receipt || receipt.mode !== 'audition' || receipt.missionId !== questionId || !validDate(receipt.completedAt)) return null
    const exactAttempt = receipt.attemptId === attempt.attemptId
    const boundLegacyAttempt = attempt.attemptId === `legacy:${policy.auditionId}`
      && receipt.attemptId === null
      && receipt.contentRevision === 'legacy-v1'
    if (!exactAttempt && !boundLegacyAttempt) return null
    receiptIds.push(receiptId)
    completedTimes.push(Date.parse(receipt.completedAt))
  }

  return {
    attemptId: attempt.attemptId,
    auditionId: attempt.auditionId,
    completedAt: new Date(Math.max(...completedTimes)).toISOString(),
    receiptIds,
  }
}

function mergeAttempts(
  a: Record<string, AuditionAttempt>,
  b: Record<string, AuditionAttempt>,
  aQuarantinedIds: readonly string[] = [],
  bQuarantinedIds: readonly string[] = [],
): AttemptLedgerState {
  const quarantinedIds = new Set([...aQuarantinedIds, ...bQuarantinedIds])
  const out = Object.fromEntries(Object.entries(a).filter(([attemptId]) => !quarantinedIds.has(attemptId)))
  for (const [id, incoming] of Object.entries(b)) {
    if (quarantinedIds.has(id)) continue
    const prior = out[id]
    if (!prior) { out[id] = incoming; continue }
    const joined = joinAttempt(prior, incoming)
    if (!joined) {
      delete out[id]
      quarantinedIds.add(id)
      continue
    }
    out[id] = joined
  }
  return { records: sortedRecord(out), quarantinedIds: [...quarantinedIds].sort() }
}

/** Monotone union used by storage events, imports, and LAN reconciliation. */
export function mergeProgress(
  a: ProgressV2,
  b: ProgressV2,
  options: { mode?: 'replica' | 'import' } = {},
): ProgressV2 {
  const mode = options.mode ?? 'replica'
  const receiptState = mergeReceiptLedgers(
    a.solveReceipts,
    b.solveReceipts,
    a.quarantinedReceiptIds ?? [],
    b.quarantinedReceiptIds ?? [],
  )
  const solveReceipts = receiptState.records
  const attemptState = mergeAttempts(
    a.auditionAttempts,
    b.auditionAttempts,
    a.quarantinedAttemptIds ?? [],
    b.quarantinedAttemptIds ?? [],
  )
  const draftStates = mergeDraftStates(
    a.drafts,
    a.draftTombstones ?? {},
    b.drafts,
    b.draftTombstones ?? {},
    mode,
  )
  return {
    version: 2,
    pulls: latestIndex(solveReceipts, 'campaign'),
    simDone: latestIndex(solveReceipts, 'audition'),
    solveReceipts,
    quarantinedReceiptIds: receiptState.quarantinedIds,
    auditionAttempts: attemptState.records,
    quarantinedAttemptIds: attemptState.quarantinedIds,
    drafts: draftStates.drafts,
    draftTombstones: draftStates.draftTombstones,
    seenBadgeIds: [...new Set([...a.seenBadgeIds, ...b.seenBadgeIds])].sort(),
    importedEnvelopeIds: [...new Set([...a.importedEnvelopeIds, ...b.importedEnvelopeIds])].sort(),
    lastMissionId: mergeLastMission(a, b),
    lastSeenAt: [a.lastSeenAt, b.lastSeenAt].filter((value): value is string => !!value).sort().at(-1) ?? null,
    storageAvailable: a.storageAvailable && b.storageAvailable,
  }
}

function readJSON(key: string): { value: unknown; available: boolean } {
  try {
    const text = localStorage.getItem(key)
    return { value: text ? JSON.parse(text) : null, available: true }
  } catch {
    return { value: null, available: false }
  }
}

function readLegacyDrafts(): Record<string, ProgressDraft> {
  const drafts: Record<string, ProgressDraft> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('pivot.draft.')) continue
      const questionId = key.slice('pivot.draft.'.length)
      const sql = localStorage.getItem(key)
      if (sql === null) continue
      const entityId = `mission:${questionId}`
      drafts[entityId] = { entityId, questionId, attemptId: null, sql, updatedAt: new Date(0).toISOString(), entityRevision: 0 }
    }
  } catch { /* storageAvailable is handled by the main reads */ }
  return drafts
}

export function loadProgress(): ProgressV2 {
  const v2 = readJSON(PROGRESS_V2_KEY)
  const v1 = readJSON(LEGACY_PROGRESS_KEY)
  const storageAvailable = v2.available && v1.available
  const current = normalizeProgress(v2.value, storageAvailable)
  const legacy = normalizeProgress(v1.value, storageAvailable)
  legacy.drafts = readLegacyDrafts()
  const merged = mergeProgress(current, legacy, { mode: 'import' })
  if (storageAvailable && (v1.value !== null || Object.keys(legacy.drafts).length > 0)) {
    merged.storageAvailable = saveProgress(merged)
  }
  return merged
}

export function persistedProgress(progress: ProgressV2): PersistedProgressV2 {
  const { storageAvailable: _runtimeOnly, ...persisted } = progress
  return persisted
}

export function saveProgress(progress: ProgressV2): boolean {
  try {
    localStorage.setItem(PROGRESS_V2_KEY, JSON.stringify(persistedProgress(progress)))
    return true
  } catch {
    return false
  }
}

export function mergeSaveProgress(progress: ProgressV2): ProgressV2 {
  const merged = mergeProgress(loadProgress(), progress)
  return { ...merged, storageAvailable: saveProgress(merged) }
}

function makeId(prefix: string): string {
  try { return `${prefix}:${crypto.randomUUID()}` } catch { return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}` }
}

export function startAuditionAttempt(progress: ProgressV2, auditionId: string, now = new Date().toISOString()): { progress: ProgressV2; attemptId: string } {
  if (!auditionId) throw new Error('Audition ID is required')
  const startedAt = canonicalDate(now)
  const attemptId = makeId(`attempt:${auditionId}`)
  return {
    attemptId,
    progress: {
      ...progress,
      auditionAttempts: {
        ...progress.auditionAttempts,
        [attemptId]: { attemptId, auditionId, startedAt, completedAt: null, solves: {} },
      },
      lastSeenAt: startedAt,
    },
  }
}

interface SolveInput {
  missionId: string
  sql: string
  title: string
  contentRevision: string
  hintLevel: HintEvidence
  completedAt?: string
}

export function recordCampaignSolve(progress: ProgressV2, input: SolveInput): { progress: ProgressV2; receipt: SolveReceipt } {
  const completedAt = canonicalDate(input.completedAt ?? new Date().toISOString())
  const receipt: SolveReceipt = {
    ...input,
    completedAt,
    receiptId: makeId(`receipt:campaign:${input.missionId}`),
    mode: 'campaign',
    attemptId: null,
  }
  const solveReceipts = { ...progress.solveReceipts, [receipt.receiptId]: receipt }
  return {
    receipt,
    progress: { ...progress, solveReceipts, pulls: latestIndex(solveReceipts, 'campaign'), lastMissionId: input.missionId, lastSeenAt: completedAt },
  }
}

export function recordAuditionSolve(
  progress: ProgressV2,
  input: SolveInput,
  attemptId: string,
  policyOrQuestionIds: AuditionPolicy | readonly string[],
): { progress: ProgressV2; receipt: SolveReceipt; attempt: AuditionAttempt } {
  const completedAt = canonicalDate(input.completedAt ?? new Date().toISOString())
  const prior = progress.auditionAttempts[attemptId]
  if (!prior) throw new Error(`Unknown audition attempt ${attemptId}`)
  if (prior.attemptId !== attemptId) throw new Error(`Audition attempt identity mismatch for ${attemptId}`)
  const policy: AuditionPolicy = Array.isArray(policyOrQuestionIds)
    ? { auditionId: prior.auditionId, questionIds: policyOrQuestionIds }
    : policyOrQuestionIds as AuditionPolicy
  if (policy.auditionId !== prior.auditionId) throw new Error(`Attempt ${attemptId} belongs to ${prior.auditionId}, not ${policy.auditionId}`)
  if (!policy.questionIds.includes(input.missionId)) throw new Error(`${input.missionId} is not part of audition ${policy.auditionId}`)
  if (!policy.questionIds.length || policy.questionIds.some((id) => !id) || new Set(policy.questionIds).size !== policy.questionIds.length) {
    throw new Error(`Audition ${policy.auditionId} has an invalid question policy`)
  }
  if (prior.solves[input.missionId]) {
    throw new Error(`${input.missionId} already has immutable evidence in ${attemptId}; start a retake to solve it again`)
  }
  const receipt: SolveReceipt = {
    ...input,
    completedAt,
    receiptId: makeId(`receipt:audition:${input.missionId}`),
    mode: 'audition',
    attemptId,
  }
  const solves = Object.fromEntries(policy.questionIds
    .filter((questionId) => questionId === input.missionId || !!prior.solves[questionId])
    .map((questionId) => [questionId, questionId === input.missionId ? receipt.receiptId : prior.solves[questionId]]))
  const solveReceipts = { ...progress.solveReceipts, [receipt.receiptId]: receipt }
  const candidate: AuditionAttempt = {
    ...prior,
    solves,
    completedAt: null,
  }
  const completion = exactAuditionCompletion(candidate, solveReceipts, policy)
  const attempt: AuditionAttempt = { ...candidate, completedAt: completion?.completedAt ?? null }
  return {
    receipt,
    attempt,
    progress: {
      ...progress,
      solveReceipts,
      simDone: latestIndex(solveReceipts, 'audition'),
      auditionAttempts: { ...progress.auditionAttempts, [attemptId]: attempt },
      lastSeenAt: completedAt,
    },
  }
}

export function draftEntityId(questionId: string, attemptId: string | null): string {
  return attemptId ? `attempt:${attemptId}:${questionId}` : `mission:${questionId}`
}

export function putDraft(progress: ProgressV2, questionId: string, attemptId: string | null, sql: string, now = new Date().toISOString()): { progress: ProgressV2; draft: ProgressDraft; baseEntityRevision: number } {
  const entityId = draftEntityId(questionId, attemptId)
  const prior = progress.drafts[entityId]
  const existingTombstones = progress.draftTombstones ?? {}
  const priorTombstone = existingTombstones[entityId]
  const baseEntityRevision = Math.max(prior?.entityRevision ?? 0, priorTombstone?.entityRevision ?? 0)
  const updatedAt = canonicalDate(now)
  const draft: ProgressDraft = { entityId, questionId, attemptId, sql, updatedAt, entityRevision: baseEntityRevision + 1 }
  const draftTombstones = { ...existingTombstones }
  delete draftTombstones[entityId]
  return {
    progress: {
      ...progress,
      drafts: { ...progress.drafts, [entityId]: draft },
      draftTombstones,
      lastSeenAt: updatedAt,
    },
    draft,
    baseEntityRevision,
  }
}

export function removeDraft(
  progress: ProgressV2,
  questionId: string,
  attemptId: string | null,
  now = new Date().toISOString(),
): { progress: ProgressV2; entityId: string; baseEntityRevision: number; tombstone: ProgressDraftTombstone } {
  const entityId = draftEntityId(questionId, attemptId)
  const existingTombstones = progress.draftTombstones ?? {}
  const baseEntityRevision = Math.max(
    progress.drafts[entityId]?.entityRevision ?? 0,
    existingTombstones[entityId]?.entityRevision ?? 0,
  )
  const drafts = { ...progress.drafts }
  delete drafts[entityId]
  const deletedAt = canonicalDate(now)
  const tombstone: ProgressDraftTombstone = {
    entityId,
    questionId,
    attemptId,
    deletedAt,
    entityRevision: baseEntityRevision + 1,
  }
  return {
    progress: {
      ...progress,
      drafts,
      draftTombstones: { ...existingTombstones, [entityId]: tombstone },
      lastSeenAt: deletedAt,
    },
    entityId,
    baseEntityRevision,
    tombstone,
  }
}

export function acknowledgeBadge(progress: ProgressV2, badgeId: string): ProgressV2 {
  return progress.seenBadgeIds.includes(badgeId)
    ? progress
    : { ...progress, seenBadgeIds: [...progress.seenBadgeIds, badgeId] }
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function decodeBase64(text: string): string {
  const binary = atob(text.trim())
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function exportProgress(progress = loadProgress()): string {
  const envelope = {
    kind: PROGRESS_ENVELOPE_KIND,
    version: 2,
    envelopeId: makeId('envelope'),
    exportedAt: new Date().toISOString(),
    progress: persistedProgress(progress),
  }
  return encodeBase64(JSON.stringify(envelope))
}

export function importProgress(code: string): ProgressImportResult {
  const current = loadProgress()
  try {
    const decoded = JSON.parse(decodeBase64(code)) as unknown
    if (!isRecord(decoded)) return { ok: false, progress: current, envelopeId: null, alreadyImported: false, error: 'invalid' }
    const isEnvelope = decoded.kind === PROGRESS_ENVELOPE_KIND && decoded.version === 2 && isRecord(decoded.progress)
    const envelopeId = isEnvelope && typeof decoded.envelopeId === 'string' ? decoded.envelopeId : makeId('legacy-envelope')
    if (current.importedEnvelopeIds.includes(envelopeId)) return { ok: true, progress: current, envelopeId, alreadyImported: true }
    const incoming = normalizeProgress(isEnvelope ? decoded.progress : decoded)
    incoming.importedEnvelopeIds.push(envelopeId)
    const progress = mergeProgress(current, incoming, { mode: 'import' })
    if (!saveProgress(progress)) {
      return {
        ok: false,
        progress: { ...current, storageAvailable: false },
        envelopeId,
        alreadyImported: false,
        error: 'storage_unavailable',
      }
    }
    progress.storageAvailable = true
    return { ok: true, progress, envelopeId, alreadyImported: false }
  } catch {
    return { ok: false, progress: current, envelopeId: null, alreadyImported: false, error: 'invalid' }
  }
}

export function subscribeToProgress(onProgress: (progress: ProgressV2) => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== PROGRESS_V2_KEY && event.key !== LEGACY_PROGRESS_KEY) return
    onProgress(loadProgress())
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}
