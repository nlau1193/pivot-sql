// Fail-closed corpus for the mistakes the learner is likely to make while learning.
// Parser/binder fixtures execute against real DuckDB; their friendly copy comes
// directly from src/errors.ts after TypeScript-only syntax is stripped in memory.
import { DuckDBInstance } from '@duckdb/node-api'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const errorSource = readFileSync(join(ROOT, 'src', 'errors.ts'), 'utf8')
const transpiled = ts.transpileModule(errorSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  fileName: 'errors.ts',
}).outputText
const { translateError } = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`)

const instance = await DuckDBInstance.create(':memory:')
const conn = await instance.connect()
await conn.run(`CREATE TABLE fct_gl_transactions (
  amount DECIMAL(18, 2),
  account_id VARCHAR,
  txn_date DATE
)`)
await conn.run(`INSERT INTO fct_gl_transactions VALUES
  (125.00, '4000', DATE '2026-03-01'),
  (250.00, '4010', DATE '2026-03-02')`)

const engineFixtures = [
  {
    id: 'm92-explanation-pasted-as-sql',
    sql: `The correct handoff shows 672 active employees, 12 without manager ids, 302 missing active manager links, 11 actual managers, 7 IC-coded managers, Lena Johnson as both widest span owner and highest managed-pod cost owner, and $653,574.05 of managed June pod cost.`,
    raw: /syntax error at or near/i,
    headline: /explanation, not a SQL query/i,
    detail: /Copy SQL.*Use verified SQL/i,
    reject: /missing comma/i,
  },
  {
    id: 'sql-plus-explanation-pasted-together',
    sql: `SELECT sum(amount) AS total_amount FROM fct_gl_transactions

This returns the total after the warehouse has filtered the rows you wanted.`,
    raw: /syntax error at or near/i,
    headline: /explanation, not a SQL query/i,
    detail: /Copy SQL.*Use verified SQL/i,
    reject: /missing comma/i,
  },
  {
    id: 'explanation-that-names-sql-clauses',
    sql: `The SELECT should include amount, and the WHERE should keep only March rows before you total them.`,
    raw: /syntax error at or near/i,
    headline: /explanation, not a SQL query/i,
    detail: /Copy SQL.*Use verified SQL/i,
    reject: /missing comma/i,
  },
  {
    id: 'real-select-typo-stays-parser-error',
    sql: `SELEC amount, account_id FROM fct_gl_transactions WHERE amount > 0`,
    raw: /syntax error at or near/i,
    headline: /parser stopped/i,
    detail: /actual typo may be immediately before/i,
    reject: /explanation, not a SQL query/i,
  },
  {
    id: 'function-typo-sume',
    sql: `SELECT sume(amount) FROM fct_gl_transactions`,
    raw: /function with name sume does not exist/i,
    headline: /can't find a function called sume/i,
    detail: /did you mean.*sum/i,
  },
  {
    id: 'qualify-without-window',
    sql: `SELECT account_id FROM fct_gl_transactions QUALIFY amount > 0`,
    raw: /at least one window function must appear/i,
    headline: /QUALIFY needs a window function/i,
    detail: /ROW_NUMBER|OVER/i,
  },
  {
    id: 'window-in-where',
    sql: `SELECT account_id FROM fct_gl_transactions WHERE row_number() OVER (ORDER BY txn_date) = 1`,
    raw: /WHERE clause cannot contain window functions/i,
    headline: /window functions.*can't go inside WHERE/i,
    detail: /QUALIFY|CTE|subquery/i,
  },
]

const failures = []
for (const fixture of engineFixtures) {
  let raw = ''
  try {
    await conn.run(fixture.sql)
    failures.push(`${fixture.id}: query unexpectedly succeeded`)
    continue
  } catch (error) {
    raw = String(error?.message ?? error)
  }

  if (!fixture.raw.test(raw)) {
    failures.push(`${fixture.id}: DuckDB failure drifted: ${raw.split('\n')[0]}`)
    continue
  }

  const friendly = translateError(raw, fixture.sql)
  if (!fixture.headline.test(friendly.headline)) {
    failures.push(`${fixture.id}: headline stayed generic: ${friendly.headline}`)
  }
  if (!fixture.detail.test(friendly.detail)) {
    failures.push(`${fixture.id}: detail missed the concrete recovery move: ${friendly.detail}`)
  }
  if (fixture.reject?.test(`${friendly.headline} ${friendly.detail}`)) {
    failures.push(`${fixture.id}: friendly copy entered the rejected recovery path`)
  }
  const expectedDisclosure = raw
    .replace(/^Error:\s*/i, '')
    .replace(/\)\s*__display LIMIT \d+/g, '')
    .replace(/LINE (\d+)/g, (_, line) => `LINE ${Math.max(1, Number(line) - 1)}`)
  if (friendly.raw !== expectedDisclosure) {
    failures.push(`${fixture.id}: technical disclosure no longer preserves the scrubbed real engine error`)
  }
}

// These are executable-but-wrong results, not engine errors. The mission build
// executes and freezes each SQL fingerprint; this corpus prevents those warm,
// business-specific explanations from silently falling back to generic grading.
const compiled = JSON.parse(readFileSync(join(ROOT, 'src', 'missions.compiled.json'), 'utf8'))
const missionFixtures = [
  { id: 'm05', count: 1, message: /AND before OR|parentheses/i },
  { id: 'm08', count: 1, message: /assignment history|LATEST assignment/i },
  { id: 'm09', count: 1, message: /Data & Analytics|LEFT JOIN/i },
  { id: 'm10', count: 1, message: /raw upload names|upper\(trim/i },
  { id: 'm11', count: 1, message: /ONE vendor spelling|three/i },
  { id: 'm16', count: 1, message: /both copies|twice the overstatement/i },
  { id: 'm17', count: 2, message: /FULL OUTER JOIN|LEFT isn't enough/i },
  { id: 'm18', count: 1, message: /churned customer|retention flatters/i },
  { id: 'm19', count: 1, message: /locked.*current|posted_at|warehouse learned/i },
  { id: 'm20', count: 1, message: /100%|INNER JOIN|churned logos|LEFT JOIN/i },
]

for (const fixture of missionFixtures) {
  const mission = compiled.missions.find((candidate) => candidate.id === fixture.id)
  const fingerprints = mission?.fingerprints ?? []
  if (fingerprints.length !== fixture.count) {
    failures.push(`${fixture.id}: expected ${fixture.count} compiled wrong-result fixture(s), found ${fingerprints.length}`)
    continue
  }
  if (!fingerprints.every((fingerprint) => fixture.message.test(fingerprint.message))) {
    failures.push(`${fixture.id}: wrong-result fixture lost its mission-specific recovery guidance`)
  }
}

await conn.closeSync?.()

if (failures.length) {
  console.error(`ERROR CORPUS FAILED — ${failures.length}/${engineFixtures.length + missionFixtures.length} fixture groups red:`)
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}

console.log(`ERROR CORPUS GREEN — ${engineFixtures.length} real engine failures translated; ${missionFixtures.length} mission-specific wrong-result groups preserved.`)
