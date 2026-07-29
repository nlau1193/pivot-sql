// Real-dependency regression: run the actual DuckDB generator + mission compiler
// three times in fresh Node processes and demand byte-identical shipping artifacts.
// Fixed invariants make exact-money regressions fail even if two nondeterministic
// builds happen to collide by chance.
import { DuckDBInstance } from '@duckdb/node-api'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = join(ROOT, 'public', 'data')
const COMPILED = join(ROOT, 'src', 'missions.compiled.json')

function run(script) {
  const result = spawnSync(process.execPath, [join(ROOT, 'scripts', script)], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    process.stdout.write(result.stdout)
    process.stderr.write(result.stderr)
    process.exit(result.status ?? 1)
  }
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function snapshot() {
  const files = readdirSync(DATA)
    .filter((name) => name === 'manifest.json' || name.endsWith('.parquet'))
    .sort()
  return Object.fromEntries([
    ...files.map((name) => [`public/data/${name}`, sha256(join(DATA, name))]),
    ['src/missions.compiled.json', sha256(COMPILED)],
  ])
}

async function assertBudgetInvariants() {
  const budget = join(DATA, 'fct_budget.parquet').replaceAll("'", "''")
  const instance = await DuckDBInstance.create(':memory:')
  const conn = await instance.connect()
  await conn.run('SET threads = 1')
  await conn.run(`CREATE VIEW fct_budget AS SELECT * FROM parquet_scan('${budget}')`)
  const schema = await conn.runAndReadAll(`
    SELECT data_type
    FROM duckdb_columns()
    WHERE table_name = 'fct_budget' AND column_name = 'amount_usd'
  `)
  const amountType = String(schema.getRows()[0]?.[0] ?? '')
  const checks = await conn.runAndReadAll(`
    SELECT
      count(*) AS rows,
      count(DISTINCT budget_id) AS unique_ids,
      count(DISTINCT struct_pack(
        version_name := version_name,
        fiscal_month := fiscal_month,
        account_id := account_id,
        dept_name_raw := dept_name_raw
      )) AS unique_natural_keys,
      min(budget_id) AS min_id,
      max(budget_id) AS max_id,
      count(*) FILTER (WHERE amount_usd * 100 <> round(amount_usd * 100)) AS subcent_rows
    FROM fct_budget
  `)
  const order = await conn.runAndReadAll(`
    WITH physical AS (
      SELECT budget_id, lag(budget_id) OVER () AS previous_id
      FROM fct_budget
    )
    SELECT count(*)
    FROM physical
    WHERE previous_id IS NOT NULL AND budget_id <> previous_id + 1
  `)
  const [rows, uniqueIds, uniqueNaturalKeys, minId, maxId, subcentRows] = checks.getRows()[0].map(Number)
  const orderBreaks = Number(order.getRows()[0][0])
  const failures = []
  if (amountType !== 'DECIMAL(38,2)') failures.push(`amount_usd type ${amountType || '(missing)'}; expected DECIMAL(38,2)`)
  if (rows !== 3678) failures.push(`row count ${rows}; expected 3678`)
  if (uniqueIds !== rows) failures.push(`budget_id uniqueness ${uniqueIds}/${rows}`)
  if (uniqueNaturalKeys !== rows) failures.push(`natural-key uniqueness ${uniqueNaturalKeys}/${rows}`)
  if (minId !== 1 || maxId !== rows) failures.push(`budget_id range ${minId}..${maxId}; expected 1..${rows}`)
  if (subcentRows !== 0) failures.push(`${subcentRows} amount_usd rows exceed cent precision`)
  if (orderBreaks !== 0) failures.push(`${orderBreaks} physical budget_id sequence breaks`)
  if (failures.length) throw new Error(`BUDGET INVARIANT FAILED — ${failures.join('; ')}`)
}

async function buildSnapshot() {
  run('generate-data.mjs')
  run('build-missions.mjs')
  await assertBudgetInvariants()
  return snapshot()
}

const snapshots = []
try {
  for (let build = 0; build < 3; build += 1) {
    snapshots.push(await buildSnapshot())
    // Keep remote builders visibly alive while the real DuckDB compiler runs.
    // spawnSync intentionally buffers each child so one pass can otherwise be
    // silent long enough for a provider watchdog to terminate a healthy build.
    console.log(`DETERMINISM PASS ${build + 1}/3 — shipping artifacts compiled and invariants verified.`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
const first = snapshots[0]
const paths = new Set(snapshots.flatMap((candidate) => Object.keys(candidate)))
const changed = [...paths].filter((path) => snapshots.slice(1).some((candidate) => candidate[path] !== first[path]))

if (changed.length) {
  console.error('DETERMINISM FAILED — unchanged source produced different artifacts:')
  for (const path of changed) {
    console.error(`  ${path}`)
    snapshots.forEach((candidate, index) => console.error(`    build ${index + 1} ${candidate[path]}`))
  }
  process.exit(1)
}

console.log(`DETERMINISM GREEN — ${Object.keys(first).length}/${Object.keys(first).length} shipping artifacts match across 3 independent builds; budget exact-money, key, and order invariants hold.`)
