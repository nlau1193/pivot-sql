import type { QueryResult } from '../db'
import {
  COACH_LIMITS,
  type AttemptDeterministicVerdictV1,
  type JsonScalar,
  type ReviewAttemptInputV1,
} from './coaching-contract'

const REVIEW_COLUMN_LIMIT = COACH_LIMITS.resultColumns
const REVIEW_ROW_LIMIT = COACH_LIMITS.resultRows
const REVIEW_CELL_LIMIT = COACH_LIMITS.resultCell

function clip(value: string, max: number = REVIEW_CELL_LIMIT): string {
  return value.length <= max
    ? value
    : `${value.slice(0, max - 1)}…`
}

function scalar(value: unknown): JsonScalar {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return clip(value)
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return clip(String(value))
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) return value.toString()
    return value
  }
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  return clip(String(value))
}

function deterministicVerdict(verdict: AttemptDeterministicVerdictV1 | null): ReviewAttemptInputV1['attempt']['deterministicVerdict'] {
  if (!verdict) {
    return {
      status: 'ungraded',
      headline: 'No deterministic mission verdict is available',
      detail: 'This result came from open exploration. Frosty can review the approach, but there is no authored answer check.',
    }
  }
  return verdict
}

/**
 * Build a fresh, bounded snapshot from the displayed run. This deliberately
 * omits app state, expected rows, compiled mission material, and progress.
 */
export function createAttemptReviewEvidence(
  result: QueryResult,
  verdict: AttemptDeterministicVerdictV1 | null,
): ReviewAttemptInputV1['attempt'] {
  const columnCount = Math.min(result.columns.length, REVIEW_COLUMN_LIMIT)
  const columns = result.columns.slice(0, columnCount).map((name, index) => ({
    name: clip(name, COACH_LIMITS.identifier),
    type: clip(result.types[index] ?? 'unknown', COACH_LIMITS.label),
  }))
  const rows = result.rows.slice(0, REVIEW_ROW_LIMIT).map((row) => (
    columns.map((_, index) => scalar(row[index]))
  ))

  return {
    result: {
      columns,
      columnsTruncated: result.columns.length > columns.length,
      rows,
      displayedRowCount: result.rowCount,
      totalRowCount: result.totalRowCount,
      displayTruncated: result.truncated,
      sampleTruncated: result.rowCount > rows.length,
    },
    deterministicVerdict: deterministicVerdict(verdict),
  }
}
