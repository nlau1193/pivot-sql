// Shared canonicalization for result-set grading.
// Used by BOTH the build-time harness (Node/DuckDB) and the in-browser grader
// (DuckDB-WASM) so a mission can never pass the harness and fail the app.
// Strategy: given a table name and its column types, build a SELECT that maps
// every column (by position) to a tagged canonical VARCHAR: numerics rounded to
// 2dp, dates/timestamps to ISO, NULL distinct from every possible text value.

/** Returns a SQL expression canonicalizing column `col` of DuckDB type `type`. */
export function canonExpr(col, type) {
  const t = String(type).toUpperCase()
  const q = `"${col.replaceAll('"', '""')}"`
  if (/(DOUBLE|FLOAT|DECIMAL|REAL|HUGEINT|BIGINT|INTEGER|SMALLINT|TINYINT|UBIGINT|UINTEGER|USMALLINT|UTINYINT)/.test(t)) {
    // 2dp rounding, then strip trailing zeros so 12.50 == 12.5 == 12.500000
    // Adding positive zero folds IEEE negative zero onto positive zero. This is
    // sign canonicalization, not tolerance: every non-zero value stays exact.
    return tagged(q, `rtrim(rtrim(printf('%.2f', round(${q}::DOUBLE, 2) + 0.0), '0'), '.')`)
  }
  if (/TIMESTAMP/.test(t)) return tagged(q, `strftime(${q}, '%Y-%m-%d %H:%M:%S')`)
  if (/DATE/.test(t)) return tagged(q, `strftime(${q}, '%Y-%m-%d')`)
  if (/BOOLEAN/.test(t)) return tagged(q, `${q}::VARCHAR`)
  return tagged(q, `trim(${q}::VARCHAR)`)
}

function tagged(nullCheckExpr, valueExpr) {
  // A prefix is collision-free for NULL vs text. The previous visible sentinel
  // let a literal '␀' masquerade as SQL NULL in an otherwise identical result.
  return `CASE WHEN ${nullCheckExpr} IS NULL THEN '0:' ELSE '1:' || ${valueExpr} END`
}

/**
 * Builds a SELECT over `table` producing one VARCHAR column `__row` per row:
 * all columns canonicalized and joined with a unit separator. Order-insensitive
 * comparison then works with EXCEPT ALL on this single column.
 * `columns` = [{name, type}] in table order.
 */
export function canonRowSelect(table, columns) {
  const exprs = columns.map((c) => canonExpr(c.name, c.type))
  return `SELECT ${exprs.join(` || chr(31) || `)} AS __row FROM ${table}`
}

/** SQL counting rows that differ between two same-shape tables (both directions). */
export function diffCountSQL(tableA, tableB, columnsA, columnsB) {
  const a = canonRowSelect(tableA, columnsA)
  const b = canonRowSelect(tableB, columnsB)
  return `
    SELECT
      (SELECT count(*) FROM ((${a}) EXCEPT ALL (${b})))
      + (SELECT count(*) FROM ((${b}) EXCEPT ALL (${a}))) AS diff_count
  `
}
