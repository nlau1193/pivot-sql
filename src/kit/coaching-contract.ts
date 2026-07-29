/**
 * Versioned boundary for deterministic browser-local coaching.
 *
 * Coaching is an advisory surface. It cannot grade a query, decide whether a
 * mission is complete, mutate progress, or receive answer-key material. The
 * deterministic DuckDB/grading path remains the only authority for all four.
 * Keep this module browser-safe: it intentionally has no provider, storage, or
 * network dependency.
 */

export const COACHING_CONTRACT_VERSION = 1 as const

export const COACH_MODES = [
  'nudge',
  'explain_error',
  'explain_verdict',
  'schema',
  'relationship',
  'rehearse',
  'review_attempt',
] as const

export type CoachMode = (typeof COACH_MODES)[number]

export const COACH_LIMITS = Object.freeze({
  requestId: 128,
  identifier: 128,
  label: 180,
  ask: 2_400,
  deliverable: 1_600,
  description: 1_200,
  question: 1_200,
  query: 20_000,
  engineError: 4_000,
  verdict: 2_000,
  rehearsalAnswer: 8_000,
  tables: 16,
  columnsPerTable: 64,
  relationships: 32,
  resultColumns: 24,
  resultRows: 8,
  resultCell: 160,
  reviewEvidence: 3,
  nextMoves: 4,
  references: 10,
  responseBody: 1_800,
  responseMove: 360,
} as const)

/** Keys that must never cross the coaching boundary, even inside nested data. */
export const COACHING_FORBIDDEN_KEYS = Object.freeze([
  'canonical',
  'canonicalSql',
  'expected',
  'expectedResult',
  'expectedRows',
  'fingerprint',
  'fingerprints',
  'solution',
  'solutionSql',
  'progress',
  'pulls',
  'solveReceipts',
  'auditionAttempts',
  'badges',
] as const)

export interface CoachColumnContextV1 {
  name: string
  description: string
}

export interface CoachTableContextV1 {
  name: string
  grain: string
  description: string
  columns: CoachColumnContextV1[]
}

export interface CoachRelationshipEndpointV1 {
  table: string
  column: string
}

export interface CoachRelationshipContextV1 {
  left: CoachRelationshipEndpointV1
  right: CoachRelationshipEndpointV1
  description: string
}

export interface CoachContextV1 {
  pack: {
    id: string
    place: string
    role: string
  }
  mission: {
    id: string
    title: string
    ask: string
    deliverable: string
    tables: string[]
  }
  schema: CoachTableContextV1[]
  relationships: CoachRelationshipContextV1[]
}

export interface NudgeInputV1 {
  query?: string
  question?: string
}

export interface ExplainErrorInputV1 {
  query: string
  engineError: string
  question?: string
}

/** A public deterministic verdict summary, never expected rows or fingerprints. */
export interface CoachVerdictV1 {
  status: 'incorrect' | 'close' | 'correct'
  headline: string
  detail?: string
}

export interface ExplainVerdictInputV1 {
  query: string
  verdict: CoachVerdictV1
  question?: string
}

export interface SchemaInputV1 {
  table?: string
  column?: string
  question?: string
}

export interface RelationshipInputV1 {
  leftTable?: string
  rightTable?: string
  question?: string
}

export interface RehearseInputV1 {
  answer?: string
  question?: string
}

export type JsonScalar = string | number | boolean | null
export type AttemptReviewAssessment = 'on_track' | 'needs_revision' | 'uncertain'
export type AttemptReviewEvidenceKind = 'current_attempt' | 'authored_schema' | 'authored_relationships'
export type AttemptDeterministicVerdictStatus = 'incorrect' | 'close' | 'correct' | 'unavailable' | 'ungraded'

export interface AttemptResultColumnV1 {
  name: string
  type: string
}

export interface AttemptResultV1 {
  columns: AttemptResultColumnV1[]
  columnsTruncated: boolean
  rows: JsonScalar[][]
  displayedRowCount: number
  totalRowCount: number | null
  displayTruncated: boolean
  sampleTruncated: boolean
}

export interface AttemptDeterministicVerdictV1 {
  status: AttemptDeterministicVerdictStatus
  headline: string
  detail?: string
}

export interface ReviewAttemptInputV1 {
  query: string
  question?: string
  attempt: {
    result: AttemptResultV1
    deterministicVerdict: AttemptDeterministicVerdictV1
  }
}

interface CoachRequestBaseV1<M extends CoachMode, I> {
  version: typeof COACHING_CONTRACT_VERSION
  requestId: string
  mode: M
  context: CoachContextV1
  input: I
}

export type CoachRequestV1 =
  | CoachRequestBaseV1<'nudge', NudgeInputV1>
  | CoachRequestBaseV1<'explain_error', ExplainErrorInputV1>
  | CoachRequestBaseV1<'explain_verdict', ExplainVerdictInputV1>
  | CoachRequestBaseV1<'schema', SchemaInputV1>
  | CoachRequestBaseV1<'relationship', RelationshipInputV1>
  | CoachRequestBaseV1<'rehearse', RehearseInputV1>
  | CoachRequestBaseV1<'review_attempt', ReviewAttemptInputV1>

export type CoachResponseSource = 'local' | 'remote'
export type CoachReferenceKind = 'table' | 'column' | 'relationship' | 'deliverable' | 'clause'

export interface CoachReferenceV1 {
  kind: CoachReferenceKind
  label: string
}

export interface CoachMessageV1 {
  headline: string
  body: string
  nextMoves: string[]
  reflectionQuestion: string | null
  references: CoachReferenceV1[]
}

/** Exact values make authority drift mechanically detectable at runtime. */
export interface CoachBoundaryV1 {
  authority: 'advisory-only'
  grading: 'deterministic-engine-only'
  progressMutation: 'forbidden'
  answerKeyMaterial: 'withheld'
}

export const COACHING_BOUNDARY_V1: Readonly<CoachBoundaryV1> = Object.freeze({
  authority: 'advisory-only',
  grading: 'deterministic-engine-only',
  progressMutation: 'forbidden',
  answerKeyMaterial: 'withheld',
})

interface CoachResponseBaseV1<M extends CoachMode> {
  version: typeof COACHING_CONTRACT_VERSION
  requestId: string
  mode: M
  source: CoachResponseSource
  message: CoachMessageV1
  boundary: CoachBoundaryV1
}

export type CoachResponseV1 =
  | CoachResponseBaseV1<Exclude<CoachMode, 'review_attempt'>>
  | (CoachResponseBaseV1<'review_attempt'> & {
      assessment: AttemptReviewAssessment
      evidenceUsed: AttemptReviewEvidenceKind[]
    })

export class CoachContractError extends Error {
  readonly path: string

  constructor(path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'CoachContractError'
    this.path = path
  }
}

export type CoachValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: CoachContractError }

type JsonRecord = Record<string, unknown>

const MODES = new Set<string>(COACH_MODES)
const RESPONSE_SOURCES = new Set<string>(['local', 'remote'])
const REFERENCE_KINDS = new Set<string>(['table', 'column', 'relationship', 'deliverable', 'clause'])
const ATTEMPT_VERDICTS = new Set<string>(['incorrect', 'close', 'correct', 'unavailable', 'ungraded'])
const REVIEW_ASSESSMENTS = new Set<string>(['on_track', 'needs_revision', 'uncertain'])
const REVIEW_EVIDENCE_KINDS = new Set<string>([
  'current_attempt',
  'authored_schema',
  'authored_relationships',
])
const FORBIDDEN_KEYS = new Set<string>(COACHING_FORBIDDEN_KEYS)

function record(value: unknown, path: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CoachContractError(path, 'must be an object')
  }
  return value as JsonRecord
}

function exactKeys(value: JsonRecord, path: string, allowed: readonly string[], required: readonly string[]): void {
  const allowedSet = new Set(allowed)
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) throw new CoachContractError(`${path}.${key}`, 'is not allowed by this contract version')
  }
  for (const key of required) {
    if (!(key in value)) throw new CoachContractError(`${path}.${key}`, 'is required')
  }
}

function stringValue(
  value: unknown,
  path: string,
  max: number,
  options: { allowEmpty?: boolean } = {},
): string {
  if (typeof value !== 'string') throw new CoachContractError(path, 'must be a string')
  if (!options.allowEmpty && value.trim().length === 0) throw new CoachContractError(path, 'must not be empty')
  if (value.length > max) throw new CoachContractError(path, `must be at most ${max} characters`)
  return value
}

function optionalString(value: unknown, path: string, max: number): string | undefined {
  return value === undefined ? undefined : stringValue(value, path, max)
}

function nonNegativeInteger(value: unknown, path: string, nullable = false): number | null {
  if (nullable && value === null) return null
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new CoachContractError(path, 'must be a non-negative safe integer')
  }
  return value
}

function booleanValue(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new CoachContractError(path, 'must be a boolean')
  return value
}

function jsonScalar(value: unknown, path: string): JsonScalar {
  if (value === null || typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value.length > COACH_LIMITS.resultCell) {
      throw new CoachContractError(path, `must be at most ${COACH_LIMITS.resultCell} characters`)
    }
    return value
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      throw new CoachContractError(path, 'unsafe integers must be encoded as strings')
    }
    return value
  }
  throw new CoachContractError(path, 'must be a JSON scalar')
}

function stringList(value: unknown, path: string, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) throw new CoachContractError(path, 'must be an array')
  if (value.length > maxItems) throw new CoachContractError(path, `must contain at most ${maxItems} items`)
  return value.map((item, index) => stringValue(item, `${path}[${index}]`, maxLength))
}

function assertNoAuthorityData(value: unknown, path = '$'): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoAuthorityData(item, `${path}[${index}]`))
    return
  }
  for (const [key, item] of Object.entries(value as JsonRecord)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new CoachContractError(`${path}.${key}`, 'answer-key, grading, and progress data cannot enter coaching')
    }
    assertNoAuthorityData(item, `${path}.${key}`)
  }
}

function parseEndpoint(value: unknown, path: string): CoachRelationshipEndpointV1 {
  const item = record(value, path)
  exactKeys(item, path, ['table', 'column'], ['table', 'column'])
  return {
    table: stringValue(item.table, `${path}.table`, COACH_LIMITS.identifier),
    column: stringValue(item.column, `${path}.column`, COACH_LIMITS.identifier),
  }
}

function parseContext(value: unknown, path: string): CoachContextV1 {
  const context = record(value, path)
  exactKeys(context, path, ['pack', 'mission', 'schema', 'relationships'], ['pack', 'mission', 'schema', 'relationships'])

  const pack = record(context.pack, `${path}.pack`)
  exactKeys(pack, `${path}.pack`, ['id', 'place', 'role'], ['id', 'place', 'role'])

  const mission = record(context.mission, `${path}.mission`)
  exactKeys(
    mission,
    `${path}.mission`,
    ['id', 'title', 'ask', 'deliverable', 'tables'],
    ['id', 'title', 'ask', 'deliverable', 'tables'],
  )

  if (!Array.isArray(context.schema)) throw new CoachContractError(`${path}.schema`, 'must be an array')
  if (context.schema.length > COACH_LIMITS.tables) {
    throw new CoachContractError(`${path}.schema`, `must contain at most ${COACH_LIMITS.tables} tables`)
  }
  const schema = context.schema.map((candidate, tableIndex): CoachTableContextV1 => {
    const tablePath = `${path}.schema[${tableIndex}]`
    const table = record(candidate, tablePath)
    exactKeys(table, tablePath, ['name', 'grain', 'description', 'columns'], ['name', 'grain', 'description', 'columns'])
    if (!Array.isArray(table.columns)) throw new CoachContractError(`${tablePath}.columns`, 'must be an array')
    if (table.columns.length > COACH_LIMITS.columnsPerTable) {
      throw new CoachContractError(
        `${tablePath}.columns`,
        `must contain at most ${COACH_LIMITS.columnsPerTable} columns`,
      )
    }
    const columns = table.columns.map((candidateColumn, columnIndex): CoachColumnContextV1 => {
      const columnPath = `${tablePath}.columns[${columnIndex}]`
      const column = record(candidateColumn, columnPath)
      exactKeys(column, columnPath, ['name', 'description'], ['name', 'description'])
      return {
        name: stringValue(column.name, `${columnPath}.name`, COACH_LIMITS.identifier),
        description: stringValue(column.description, `${columnPath}.description`, COACH_LIMITS.description),
      }
    })
    return {
      name: stringValue(table.name, `${tablePath}.name`, COACH_LIMITS.identifier),
      grain: stringValue(table.grain, `${tablePath}.grain`, COACH_LIMITS.description),
      description: stringValue(table.description, `${tablePath}.description`, COACH_LIMITS.description),
      columns,
    }
  })

  if (!Array.isArray(context.relationships)) {
    throw new CoachContractError(`${path}.relationships`, 'must be an array')
  }
  if (context.relationships.length > COACH_LIMITS.relationships) {
    throw new CoachContractError(
      `${path}.relationships`,
      `must contain at most ${COACH_LIMITS.relationships} relationships`,
    )
  }
  const relationships = context.relationships.map((candidate, index): CoachRelationshipContextV1 => {
    const relationshipPath = `${path}.relationships[${index}]`
    const relationship = record(candidate, relationshipPath)
    exactKeys(
      relationship,
      relationshipPath,
      ['left', 'right', 'description'],
      ['left', 'right', 'description'],
    )
    return {
      left: parseEndpoint(relationship.left, `${relationshipPath}.left`),
      right: parseEndpoint(relationship.right, `${relationshipPath}.right`),
      description: stringValue(
        relationship.description,
        `${relationshipPath}.description`,
        COACH_LIMITS.description,
      ),
    }
  })

  return {
    pack: {
      id: stringValue(pack.id, `${path}.pack.id`, COACH_LIMITS.identifier),
      place: stringValue(pack.place, `${path}.pack.place`, COACH_LIMITS.label),
      role: stringValue(pack.role, `${path}.pack.role`, COACH_LIMITS.label),
    },
    mission: {
      id: stringValue(mission.id, `${path}.mission.id`, COACH_LIMITS.identifier),
      title: stringValue(mission.title, `${path}.mission.title`, COACH_LIMITS.label),
      ask: stringValue(mission.ask, `${path}.mission.ask`, COACH_LIMITS.ask),
      deliverable: stringValue(mission.deliverable, `${path}.mission.deliverable`, COACH_LIMITS.deliverable),
      tables: stringList(mission.tables, `${path}.mission.tables`, COACH_LIMITS.tables, COACH_LIMITS.identifier),
    },
    schema,
    relationships,
  }
}

function parseNudgeInput(value: unknown, path: string): NudgeInputV1 {
  const input = record(value, path)
  exactKeys(input, path, ['query', 'question'], [])
  return {
    query: input.query === undefined
      ? undefined
      : stringValue(input.query, `${path}.query`, COACH_LIMITS.query, { allowEmpty: true }),
    question: optionalString(input.question, `${path}.question`, COACH_LIMITS.question),
  }
}

function parseExplainErrorInput(value: unknown, path: string): ExplainErrorInputV1 {
  const input = record(value, path)
  exactKeys(input, path, ['query', 'engineError', 'question'], ['query', 'engineError'])
  return {
    query: stringValue(input.query, `${path}.query`, COACH_LIMITS.query, { allowEmpty: true }),
    engineError: stringValue(input.engineError, `${path}.engineError`, COACH_LIMITS.engineError),
    question: optionalString(input.question, `${path}.question`, COACH_LIMITS.question),
  }
}

function parseExplainVerdictInput(value: unknown, path: string): ExplainVerdictInputV1 {
  const input = record(value, path)
  exactKeys(input, path, ['query', 'verdict', 'question'], ['query', 'verdict'])
  const verdict = record(input.verdict, `${path}.verdict`)
  exactKeys(verdict, `${path}.verdict`, ['status', 'headline', 'detail'], ['status', 'headline'])
  if (verdict.status !== 'incorrect' && verdict.status !== 'close' && verdict.status !== 'correct') {
    throw new CoachContractError(`${path}.verdict.status`, 'must be incorrect, close, or correct')
  }
  return {
    query: stringValue(input.query, `${path}.query`, COACH_LIMITS.query, { allowEmpty: true }),
    verdict: {
      status: verdict.status,
      headline: stringValue(verdict.headline, `${path}.verdict.headline`, COACH_LIMITS.verdict),
      detail: optionalString(verdict.detail, `${path}.verdict.detail`, COACH_LIMITS.verdict),
    },
    question: optionalString(input.question, `${path}.question`, COACH_LIMITS.question),
  }
}

function parseSchemaInput(value: unknown, path: string): SchemaInputV1 {
  const input = record(value, path)
  exactKeys(input, path, ['table', 'column', 'question'], [])
  return {
    table: optionalString(input.table, `${path}.table`, COACH_LIMITS.identifier),
    column: optionalString(input.column, `${path}.column`, COACH_LIMITS.identifier),
    question: optionalString(input.question, `${path}.question`, COACH_LIMITS.question),
  }
}

function parseRelationshipInput(value: unknown, path: string): RelationshipInputV1 {
  const input = record(value, path)
  exactKeys(input, path, ['leftTable', 'rightTable', 'question'], [])
  return {
    leftTable: optionalString(input.leftTable, `${path}.leftTable`, COACH_LIMITS.identifier),
    rightTable: optionalString(input.rightTable, `${path}.rightTable`, COACH_LIMITS.identifier),
    question: optionalString(input.question, `${path}.question`, COACH_LIMITS.question),
  }
}

function parseAttemptResult(value: unknown, path: string): AttemptResultV1 {
  const result = record(value, path)
  exactKeys(
    result,
    path,
    ['columns', 'columnsTruncated', 'rows', 'displayedRowCount', 'totalRowCount', 'displayTruncated', 'sampleTruncated'],
    ['columns', 'columnsTruncated', 'rows', 'displayedRowCount', 'totalRowCount', 'displayTruncated', 'sampleTruncated'],
  )
  if (!Array.isArray(result.columns) || result.columns.length === 0) {
    throw new CoachContractError(`${path}.columns`, 'must contain at least one column')
  }
  if (result.columns.length > COACH_LIMITS.resultColumns) {
    throw new CoachContractError(`${path}.columns`, `must contain at most ${COACH_LIMITS.resultColumns} columns`)
  }
  const columns = result.columns.map((candidate, index): AttemptResultColumnV1 => {
    const columnPath = `${path}.columns[${index}]`
    const column = record(candidate, columnPath)
    exactKeys(column, columnPath, ['name', 'type'], ['name', 'type'])
    return {
      name: stringValue(column.name, `${columnPath}.name`, COACH_LIMITS.identifier),
      type: stringValue(column.type, `${columnPath}.type`, COACH_LIMITS.label),
    }
  })
  if (!Array.isArray(result.rows)) throw new CoachContractError(`${path}.rows`, 'must be an array')
  if (result.rows.length > COACH_LIMITS.resultRows) {
    throw new CoachContractError(`${path}.rows`, `must contain at most ${COACH_LIMITS.resultRows} rows`)
  }
  const rows = result.rows.map((candidate, rowIndex): JsonScalar[] => {
    const rowPath = `${path}.rows[${rowIndex}]`
    if (!Array.isArray(candidate) || candidate.length !== columns.length) {
      throw new CoachContractError(rowPath, `must contain exactly ${columns.length} cells`)
    }
    return candidate.map((cell, columnIndex) => jsonScalar(cell, `${rowPath}[${columnIndex}]`))
  })
  const displayedRowCount = nonNegativeInteger(result.displayedRowCount, `${path}.displayedRowCount`) as number
  const totalRowCount = nonNegativeInteger(result.totalRowCount, `${path}.totalRowCount`, true)
  const columnsTruncated = booleanValue(result.columnsTruncated, `${path}.columnsTruncated`)
  const displayTruncated = booleanValue(result.displayTruncated, `${path}.displayTruncated`)
  const sampleTruncated = booleanValue(result.sampleTruncated, `${path}.sampleTruncated`)
  if (displayedRowCount < rows.length) {
    throw new CoachContractError(`${path}.displayedRowCount`, 'must be at least the sampled row count')
  }
  if (totalRowCount !== null && totalRowCount < displayedRowCount) {
    throw new CoachContractError(`${path}.totalRowCount`, 'must be at least the displayed row count')
  }
  if (sampleTruncated !== (displayedRowCount > rows.length)) {
    throw new CoachContractError(`${path}.sampleTruncated`, 'must match whether the displayed result exceeds the sample')
  }
  return { columns, columnsTruncated, rows, displayedRowCount, totalRowCount, displayTruncated, sampleTruncated }
}

function parseAttemptVerdict(value: unknown, path: string): AttemptDeterministicVerdictV1 {
  const verdict = record(value, path)
  exactKeys(verdict, path, ['status', 'headline', 'detail'], ['status', 'headline'])
  if (typeof verdict.status !== 'string' || !ATTEMPT_VERDICTS.has(verdict.status)) {
    throw new CoachContractError(`${path}.status`, 'is not a supported deterministic verdict')
  }
  return {
    status: verdict.status as AttemptDeterministicVerdictStatus,
    headline: stringValue(verdict.headline, `${path}.headline`, COACH_LIMITS.verdict),
    detail: optionalString(verdict.detail, `${path}.detail`, COACH_LIMITS.verdict),
  }
}

function parseReviewAttemptInput(value: unknown, path: string): ReviewAttemptInputV1 {
  const input = record(value, path)
  exactKeys(input, path, ['query', 'question', 'attempt'], ['query', 'attempt'])
  const attempt = record(input.attempt, `${path}.attempt`)
  exactKeys(
    attempt,
    `${path}.attempt`,
    ['result', 'deterministicVerdict'],
    ['result', 'deterministicVerdict'],
  )
  return {
    query: stringValue(input.query, `${path}.query`, COACH_LIMITS.query, { allowEmpty: true }),
    question: optionalString(input.question, `${path}.question`, COACH_LIMITS.question),
    attempt: {
      result: parseAttemptResult(attempt.result, `${path}.attempt.result`),
      deterministicVerdict: parseAttemptVerdict(
        attempt.deterministicVerdict,
        `${path}.attempt.deterministicVerdict`,
      ),
    },
  }
}

function parseRehearseInput(value: unknown, path: string): RehearseInputV1 {
  const input = record(value, path)
  exactKeys(input, path, ['answer', 'question'], [])
  return {
    answer: input.answer === undefined
      ? undefined
      : stringValue(input.answer, `${path}.answer`, COACH_LIMITS.rehearsalAnswer, { allowEmpty: true }),
    question: optionalString(input.question, `${path}.question`, COACH_LIMITS.question),
  }
}

export function parseCoachRequestV1(value: unknown): CoachRequestV1 {
  assertNoAuthorityData(value)
  const request = record(value, '$')
  exactKeys(request, '$', ['version', 'requestId', 'mode', 'context', 'input'], [
    'version',
    'requestId',
    'mode',
    'context',
    'input',
  ])
  if (request.version !== COACHING_CONTRACT_VERSION) {
    throw new CoachContractError('$.version', `must equal ${COACHING_CONTRACT_VERSION}`)
  }
  if (typeof request.mode !== 'string' || !MODES.has(request.mode)) {
    throw new CoachContractError('$.mode', `must be one of ${COACH_MODES.join(', ')}`)
  }

  const envelope = {
    version: COACHING_CONTRACT_VERSION,
    requestId: stringValue(request.requestId, '$.requestId', COACH_LIMITS.requestId),
    context: parseContext(request.context, '$.context'),
  }

  switch (request.mode as CoachMode) {
    case 'nudge':
      return { ...envelope, mode: 'nudge', input: parseNudgeInput(request.input, '$.input') }
    case 'explain_error':
      return { ...envelope, mode: 'explain_error', input: parseExplainErrorInput(request.input, '$.input') }
    case 'explain_verdict':
      return { ...envelope, mode: 'explain_verdict', input: parseExplainVerdictInput(request.input, '$.input') }
    case 'schema':
      return { ...envelope, mode: 'schema', input: parseSchemaInput(request.input, '$.input') }
    case 'relationship':
      return { ...envelope, mode: 'relationship', input: parseRelationshipInput(request.input, '$.input') }
    case 'rehearse':
      return { ...envelope, mode: 'rehearse', input: parseRehearseInput(request.input, '$.input') }
    case 'review_attempt':
      return { ...envelope, mode: 'review_attempt', input: parseReviewAttemptInput(request.input, '$.input') }
  }
}

function assertNoRunnableSql(message: CoachMessageV1): void {
  const text = [
    message.headline,
    message.body,
    ...message.nextMoves,
    message.reflectionQuestion ?? '',
    ...message.references.map((reference) => reference.label),
  ].join('\n')
  const containsRunnableSql = /```(?:sql)?/i.test(text)
    || /\bSELECT\b[\s\S]{0,800}\bFROM\b/i.test(text)
    || /\bSELECT\s+(?!clause\b|list\b|statement\b|expression\b|output\b|columns?\b|fields?\b)(?:DISTINCT\s+)?(?:\*|\d+(?:\.\d+)?|["'`(]|[a-z_][\w$]*(?=\s*(?:[,;.(]|$|\bAS\b|\bFROM\b)))/i.test(text)
    || /\bWITH\s+[a-z_][\w$]*\s+AS\s*\(/i.test(text)
    || /\b(?:INSERT\s+INTO|UPDATE\s+[\w".]+\s+SET|DELETE\s+FROM|CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)|DROP\s+(?:TABLE|VIEW)|ALTER\s+TABLE|MERGE\s+INTO|COPY\s+[^\n]+\s+(?:FROM|TO)|CALL\s+[\w".]+\s*\(|PRAGMA\s+[\w.]+)/i.test(text)
  if (containsRunnableSql) {
    throw new CoachContractError('$.message', 'must coach the next move, not return runnable SQL or a full solution')
  }
}

export function parseCoachResponseV1(value: unknown): CoachResponseV1 {
  assertNoAuthorityData(value)
  const response = record(value, '$')
  exactKeys(response, '$', [
    'version',
    'requestId',
    'mode',
    'source',
    'message',
    'boundary',
    'assessment',
    'evidenceUsed',
  ], [
    'version',
    'requestId',
    'mode',
    'source',
    'message',
    'boundary',
  ])
  if (response.version !== COACHING_CONTRACT_VERSION) {
    throw new CoachContractError('$.version', `must equal ${COACHING_CONTRACT_VERSION}`)
  }
  if (typeof response.mode !== 'string' || !MODES.has(response.mode)) {
    throw new CoachContractError('$.mode', `must be one of ${COACH_MODES.join(', ')}`)
  }
  if (typeof response.source !== 'string' || !RESPONSE_SOURCES.has(response.source)) {
    throw new CoachContractError('$.source', 'must be local or remote')
  }
  const isAttemptReview = response.mode === 'review_attempt'
  if (isAttemptReview && (!('assessment' in response) || !('evidenceUsed' in response))) {
    throw new CoachContractError('$', 'attempt review responses require assessment and evidenceUsed')
  }
  if (!isAttemptReview && ('assessment' in response || 'evidenceUsed' in response)) {
    throw new CoachContractError('$', 'assessment and evidenceUsed are only valid for attempt review')
  }

  const messageValue = record(response.message, '$.message')
  exactKeys(
    messageValue,
    '$.message',
    ['headline', 'body', 'nextMoves', 'reflectionQuestion', 'references'],
    ['headline', 'body', 'nextMoves', 'reflectionQuestion', 'references'],
  )
  const nextMoves = stringList(
    messageValue.nextMoves,
    '$.message.nextMoves',
    COACH_LIMITS.nextMoves,
    COACH_LIMITS.responseMove,
  )
  if (nextMoves.length === 0) throw new CoachContractError('$.message.nextMoves', 'must contain at least one move')
  if (messageValue.reflectionQuestion !== null && typeof messageValue.reflectionQuestion !== 'string') {
    throw new CoachContractError('$.message.reflectionQuestion', 'must be a string or null')
  }
  const reflectionQuestion = messageValue.reflectionQuestion === null
    ? null
    : stringValue(messageValue.reflectionQuestion, '$.message.reflectionQuestion', COACH_LIMITS.question)

  if (!Array.isArray(messageValue.references)) throw new CoachContractError('$.message.references', 'must be an array')
  if (messageValue.references.length > COACH_LIMITS.references) {
    throw new CoachContractError(
      '$.message.references',
      `must contain at most ${COACH_LIMITS.references} references`,
    )
  }
  const references = messageValue.references.map((candidate, index): CoachReferenceV1 => {
    const referencePath = `$.message.references[${index}]`
    const reference = record(candidate, referencePath)
    exactKeys(reference, referencePath, ['kind', 'label'], ['kind', 'label'])
    if (typeof reference.kind !== 'string' || !REFERENCE_KINDS.has(reference.kind)) {
      throw new CoachContractError(`${referencePath}.kind`, 'is not a supported reference kind')
    }
    return {
      kind: reference.kind as CoachReferenceKind,
      label: stringValue(reference.label, `${referencePath}.label`, COACH_LIMITS.label),
    }
  })

  const boundaryValue = record(response.boundary, '$.boundary')
  exactKeys(
    boundaryValue,
    '$.boundary',
    ['authority', 'grading', 'progressMutation', 'answerKeyMaterial'],
    ['authority', 'grading', 'progressMutation', 'answerKeyMaterial'],
  )
  for (const [key, expected] of Object.entries(COACHING_BOUNDARY_V1)) {
    if (boundaryValue[key] !== expected) {
      throw new CoachContractError(`$.boundary.${key}`, `must equal ${JSON.stringify(expected)}`)
    }
  }

  const common = {
    version: COACHING_CONTRACT_VERSION,
    requestId: stringValue(response.requestId, '$.requestId', COACH_LIMITS.requestId),
    source: response.source as CoachResponseSource,
    message: {
      headline: stringValue(messageValue.headline, '$.message.headline', COACH_LIMITS.label),
      body: stringValue(messageValue.body, '$.message.body', COACH_LIMITS.responseBody),
      nextMoves,
      reflectionQuestion,
      references,
    },
    boundary: {
      authority: 'advisory-only',
      grading: 'deterministic-engine-only',
      progressMutation: 'forbidden',
      answerKeyMaterial: 'withheld',
    } as CoachBoundaryV1,
  }
  assertNoRunnableSql(common.message)

  if (isAttemptReview) {
    if (typeof response.assessment !== 'string' || !REVIEW_ASSESSMENTS.has(response.assessment)) {
      throw new CoachContractError('$.assessment', 'must be on_track, needs_revision, or uncertain')
    }
    if (!Array.isArray(response.evidenceUsed) || response.evidenceUsed.length > COACH_LIMITS.reviewEvidence) {
      throw new CoachContractError(
        '$.evidenceUsed',
        `must contain at most ${COACH_LIMITS.reviewEvidence} evidence kinds`,
      )
    }
    const evidenceUsed = response.evidenceUsed.map((candidate, index): AttemptReviewEvidenceKind => {
      if (typeof candidate !== 'string' || !REVIEW_EVIDENCE_KINDS.has(candidate)) {
        throw new CoachContractError(`$.evidenceUsed[${index}]`, 'is not a supported evidence kind')
      }
      return candidate as AttemptReviewEvidenceKind
    })
    if (!evidenceUsed.includes('current_attempt')) {
      throw new CoachContractError('$.evidenceUsed', 'must include current_attempt')
    }
    if (new Set(evidenceUsed).size !== evidenceUsed.length) {
      throw new CoachContractError('$.evidenceUsed', 'must not contain duplicates')
    }
    return {
      ...common,
      mode: 'review_attempt',
      assessment: response.assessment as AttemptReviewAssessment,
      evidenceUsed,
    }
  }

  return {
    ...common,
    mode: response.mode as Exclude<CoachMode, 'review_attempt'>,
  }
}

/** Validate a provider reply and bind it to the request that produced it. */
export function parseCoachResponseForRequestV1(
  requestValue: CoachRequestV1 | unknown,
  responseValue: CoachResponseV1 | unknown,
): CoachResponseV1 {
  const request = parseCoachRequestV1(requestValue)
  const response = parseCoachResponseV1(responseValue)
  if (response.requestId !== request.requestId) {
    throw new CoachContractError('$.requestId', 'does not match the coaching request')
  }
  if (response.mode !== request.mode) {
    throw new CoachContractError('$.mode', 'does not match the coaching request')
  }
  if (
    request.mode === 'review_attempt'
    && response.mode === 'review_attempt'
    && request.input.attempt.deterministicVerdict.status === 'correct'
    && response.assessment === 'needs_revision'
  ) {
    throw new CoachContractError(
      '$.assessment',
      'cannot contradict a correct deterministic verdict with needs_revision',
    )
  }
  if (
    request.mode === 'review_attempt'
    && response.mode === 'review_attempt'
    && request.input.attempt.deterministicVerdict.status === 'incorrect'
    && response.assessment === 'on_track'
  ) {
    throw new CoachContractError(
      '$.assessment',
      'cannot contradict an incorrect deterministic verdict with on_track',
    )
  }
  if (
    request.mode === 'review_attempt'
    && response.mode === 'review_attempt'
    && (request.input.attempt.deterministicVerdict.status === 'unavailable'
      || request.input.attempt.deterministicVerdict.status === 'ungraded')
    && response.assessment !== 'uncertain'
  ) {
    throw new CoachContractError(
      '$.assessment',
      'must remain uncertain without a deterministic verdict',
    )
  }
  return response
}

export function validateCoachRequestV1(value: unknown): CoachValidationResult<CoachRequestV1> {
  try {
    return { ok: true, value: parseCoachRequestV1(value) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof CoachContractError
        ? error
        : new CoachContractError('$', error instanceof Error ? error.message : String(error)),
    }
  }
}

export function validateCoachResponseV1(value: unknown): CoachValidationResult<CoachResponseV1> {
  try {
    return { ok: true, value: parseCoachResponseV1(value) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof CoachContractError
        ? error
        : new CoachContractError('$', error instanceof Error ? error.message : String(error)),
    }
  }
}
