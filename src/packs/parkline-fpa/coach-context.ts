/**
 * Allowlisted Star67 coaching context.
 *
 * This adapter intentionally accepts only the learner-visible mission fields
 * it needs. It never reads or returns canonical SQL, solutions, expected
 * results, fingerprints, grading state, or progress.
 */

import type { CompiledMission } from '../../missions'
import type { CoachContextV1 } from '../../kit/coaching-contract'
import { COMMON_JOINS, TABLE_NOTES } from '../../schema-notes'

export type Star67CoachMission = Pick<
  CompiledMission,
  'id' | 'title' | 'ask' | 'deliverable' | 'tables'
>

function schemaForTable(tableName: string): CoachContextV1['schema'][number] {
  const note = TABLE_NOTES[tableName]
  if (!note) {
    // Fail closed rather than sending unreviewed runtime metadata to a coach.
    throw new Error(`No authored Star67 coaching schema for ${tableName}`)
  }
  return {
    name: tableName,
    grain: note.grain,
    description: note.blurb,
    columns: Object.entries(note.columns).map(([name, description]) => ({ name, description })),
  }
}

/** Build a fresh, JSON-safe coaching payload from an explicit allowlist. */
export function createStar67CoachContext(mission: Star67CoachMission): CoachContextV1 {
  const tableNames = [...new Set(mission.tables)]
  const allowedTables = new Set(tableNames)
  const relationships = COMMON_JOINS
    .filter((join) => allowedTables.has(join.from.relation) && allowedTables.has(join.to.relation))
    .map((join) => ({
      left: { table: join.from.relation, column: join.from.column },
      right: { table: join.to.relation, column: join.to.column },
      description: `Authored Star67 warehouse path from ${join.from.relation}.${join.from.column} to ${join.to.relation}.${join.to.column}.`,
    }))

  return {
    pack: {
      id: 'parkline-fpa',
      place: 'Star67',
      role: 'FP&A',
    },
    mission: {
      id: mission.id,
      title: mission.title,
      ask: mission.ask,
      deliverable: mission.deliverable,
      tables: tableNames,
    },
    schema: tableNames.map(schemaForTable),
    relationships,
  }
}
