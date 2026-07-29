// Result-set grading — runs entirely inside DuckDB via the shared canonicalization
// (src/canon.js), the same path the build-time harness froze expected answers with.
// Verdicts are never a bare red X: generic diagnostics name what's off in her terms.
import { engine, guardUserSQL, stripTrailingSemicolon } from './db'
// @ts-expect-error shared plain-JS module used by both harness and app
import { canonRowSelect } from './canon.js'
import type { CompiledMission } from './missions'

export type Verdict =
  | { kind: 'correct'; coaching?: string }
  | { kind: 'wrong'; message: string }
  | { kind: 'shape'; message: string }
  | { kind: 'unavailable'; message: string }

let gradingRunId = 0

export async function gradeMission(userSQL: string, mission: CompiledMission): Promise<Verdict> {
  const expected = mission.expected
  const sql = stripTrailingSemicolon(userSQL)
  guardUserSQL(sql) // defense in depth — display path guards too
  // pre-JOIN missions (parts 1-2) must never get join-vocabulary diagnostics
  const joinsTaught = (mission.part ?? 3) >= 3

  // A previous mission can still be grading when the learner moves to the next ask.
  // Per-run table names keep those result sets isolated on the shared connection.
  const runSuffix = `${Date.now().toString(36)}_${(++gradingRunId).toString(36)}`
  const mineTable = `_pivot_mine_${runSuffix}`
  const expectedTable = `_pivot_expected_${runSuffix}`

  try {
    // Materialize her full result once (temp table; no display cap). Keep the
    // create inside the cleanup boundary in case the worker reports late.
    await engine.runRaw(`CREATE TEMP TABLE ${mineTable} AS SELECT * FROM (\n${sql}\n) __m`)
    const meta = await engine.runRaw(`SELECT column_name, data_type FROM duckdb_columns() WHERE table_name = '${mineTable}' ORDER BY column_index`)
    const mineCols = meta.rows.map((r) => ({ name: String(r[0]), type: String(r[1]) }))
    const mineCountRes = await engine.runRaw(`SELECT count(*)::BIGINT FROM ${mineTable}`)
    const mineCount = Number(mineCountRes.rows[0][0])

    if (mineCols.length !== expected.columnCount) {
      return {
        kind: 'shape',
        message:
          mineCols.length > expected.columnCount
            ? `You returned ${mineCols.length} columns — the deliverable asks for exactly ${expected.columnCount}. Extra columns aren't wrong-wrong, but the spec is the contract: trim your SELECT down to the ${expected.columnCount} it names.`
            : `You returned ${mineCols.length} column${mineCols.length === 1 ? '' : 's'} — the deliverable asks for ${expected.columnCount}. Check the spec again: something it names is missing from your SELECT.`,
      }
    }

    // Build the expected temp table from the frozen canonical rows.
    await engine.runRaw(`CREATE TEMP TABLE ${expectedTable} (__row VARCHAR)`)
    if (expected.rows.length > 0) {
      const values = expected.rows.map((row) => `(${sqlLit(row)})`).join(',')
      await engine.runRaw(`INSERT INTO ${expectedTable} VALUES ${values}`)
    }

    const mineCanon = canonRowSelect(mineTable, mineCols)
    const diff = await engine.runRaw(`
      SELECT
        (SELECT count(*) FROM ((${mineCanon}) EXCEPT ALL (SELECT __row FROM ${expectedTable}))) AS extra,
        (SELECT count(*) FROM ((SELECT __row FROM ${expectedTable}) EXCEPT ALL (${mineCanon}))) AS missing
    `)
    const extra = Number(diff.rows[0][0])
    const missing = Number(diff.rows[0][1])

    if (extra === 0 && missing === 0) {
      if (mission.requireRegex && mission.requireMessage && !matchesSQLRequirement(sql, mission.requireRegex)) {
        // The warehouse proved the answer itself is correct. Source-pattern
        // checks can teach a production guard, but SQL has too many equivalent
        // spellings for a regex miss to block learner progress.
        return { kind: 'correct', coaching: mission.requireMessage }
      }
      if (mission.ordered && expected.rows.length > 1) {
        // full positional check — her materialized order is her output order
        const mineRows = await engine.runRaw(mineCanon)
        const seq = mineRows.rows.map((r) => String(r[0]))
        const inOrder = seq.every((v, i) => v === expected.rows[i])
        if (!inOrder) {
          return { kind: 'wrong', message: `All the right rows — but the ask wants them sorted (${mission.orderedNote ?? 'check the deliverable for the sort'}). Add or fix your ORDER BY.` }
        }
      }
      return { kind: 'correct' }
    }

    // Authored trap fingerprints (precomputed at build time)
    for (const fp of mission.fingerprints ?? []) {
      if (fp.rowCount === mineCount) {
        const fpDiff = await engine.runRaw(`
          SELECT
            (SELECT count(*) FROM ((${mineCanon}) EXCEPT ALL (SELECT unnest(${arrayLit(fp.rows)}) AS __row)))
            + (SELECT count(*) FROM ((SELECT unnest(${arrayLit(fp.rows)}) AS __row) EXCEPT ALL (${mineCanon})))
        `)
        if (Number(fpDiff.rows[0][0]) === 0) return { kind: 'wrong', message: fp.message }
      }
    }

    // Generic diagnostics, most-specific first.
    if (mineCount === 0) {
      return { kind: 'wrong', message: `Zero rows isn't an error — it means nothing matched your filters. Check the date range for the table you queried, and remember that text matches are exact, including capitalization.` }
    }
    if (mineCount === expected.rowCount) {
      const dup = await engine.runRaw(`SELECT count(*) FROM (SELECT __row FROM (${mineCanon}) GROUP BY __row HAVING count(*) > 1)`)
      if (Number(dup.rows[0][0]) > 0) {
        return {
          kind: 'wrong',
          message: joinsTaught
            ? `Your result has repeating rows — usually a JOIN bringing back several matches per key. Check the lookup table's grain: does it really have one row per key?`
            : `Your result has repeating rows. On tables where one row = one customer per MONTH, that usually means the month filter is missing — pin one month and the repeats collapse.`,
        }
      }
      return {
        kind: 'wrong',
        message: `Right number of rows (${fmtInt(mineCount)}), but some values are off. Common causes: a date window one month too wide or narrow, or rows the spec says to exclude still slipping in.`,
      }
    }
    if (mineCount > expected.rowCount) {
      const ratio = mineCount / expected.rowCount
      if (joinsTaught && Math.abs(ratio - Math.round(ratio)) < 0.001 && ratio >= 2) {
        return {
          kind: 'wrong',
          message: `You got exactly ${Math.round(ratio)}× the expected rows (${fmtInt(mineCount)} vs ${fmtInt(expected.rowCount)}) — the classic sign a JOIN multiplied your rows. Unlike XLOOKUP (which returns just the first match), a JOIN returns EVERY match. One of your joined tables probably has several rows per key.`,
        }
      }
      return {
        kind: 'wrong',
        message: joinsTaught
          ? `You got ${fmtInt(mineCount)} rows — expected ${fmtInt(expected.rowCount)}. Extra rows usually mean a filter from the spec is missing (a date window, a status, an account condition), or a JOIN is matching more than it should.`
          : `You got ${fmtInt(mineCount)} rows — expected ${fmtInt(expected.rowCount)}. Extra rows usually mean a filter from the spec is missing — re-read the deliverable and check each condition made it into your WHERE.`,
      }
    }
    return {
      kind: 'wrong',
      message: joinsTaught
        ? `You got ${fmtInt(mineCount)} rows — expected ${fmtInt(expected.rowCount)}. Missing rows usually mean an INNER JOIN dropped them (rows with no match vanish — LEFT JOIN keeps them) or a filter is too strict.`
        : `You got ${fmtInt(mineCount)} rows — expected ${fmtInt(expected.rowCount)}. Missing rows usually mean a filter is too strict — check the date window and any spelling the spec quotes exactly.`,
    }
  } finally {
    await engine.runRaw(`DROP TABLE IF EXISTS ${mineTable}`).catch(() => {})
    await engine.runRaw(`DROP TABLE IF EXISTS ${expectedTable}`).catch(() => {})
  }
}

/** Requirement checks are pedagogy guards layered on top of exact result equality.
 * Comments cannot change whether a correct SQL construct is present, so mask them
 * before matching. This also keeps harmless analyst annotations from creating a
 * false negative after the database has already proved the answer is right. */
function matchesSQLRequirement(sql: string, pattern: string): boolean {
  return new RegExp(pattern, 'i').test(withoutSQLComments(sql))
}

function withoutSQLComments(sql: string): string {
  let out = ''
  let inS = false, inD = false, inDollar = false, inLine = false, inBlock = false
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i], n = sql[i + 1]
    if (inLine) {
      if (c === '\n') { inLine = false; out += '\n' } else out += ' '
      continue
    }
    if (inBlock) {
      if (c === '*' && n === '/') { inBlock = false; out += '  '; i++ }
      else out += c === '\n' ? '\n' : ' '
      continue
    }
    if (inDollar) {
      out += c
      if (c === '$' && n === '$') { out += n; inDollar = false; i++ }
      continue
    }
    if (inS) {
      out += c
      if (c === "'") {
        if (n === "'") { out += n; i++ } else inS = false
      }
      continue
    }
    if (inD) {
      out += c
      if (c === '"') {
        if (n === '"') { out += n; i++ } else inD = false
      }
      continue
    }
    if (c === "'") { inS = true; out += c; continue }
    if (c === '"') { inD = true; out += c; continue }
    if (c === '$' && n === '$') { inDollar = true; out += c + n; i++; continue }
    if (c === '-' && n === '-') { inLine = true; out += '  '; i++; continue }
    if (c === '/' && n === '*') { inBlock = true; out += '  '; i++; continue }
    out += c
  }
  return out
}

function sqlLit(canonRow: string): string {
  return `'${canonRow.replaceAll("'", "''")}'`
}
function arrayLit(rows: string[]): string {
  return `[${rows.map((r) => `'${r.replaceAll("'", "''")}'`).join(',')}]`
}
function fmtInt(n: number): string {
  return n.toLocaleString('en-US')
}
