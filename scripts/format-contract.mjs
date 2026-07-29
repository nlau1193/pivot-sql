import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const formatSource = readFileSync(join(ROOT, 'src', 'format.ts'), 'utf8')
const transpiled = ts.transpileModule(formatSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  fileName: 'format.ts',
}).outputText
const { formatCell } = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`)

const plainQuantities = [
  ['budget_rows', 1091, 'Decimal(18,2)', '1,091'],
  ['reforecast_rows', 864, 'BigInt', '864'],
  ['actual_managers', 11, 'Int64', '11'],
  ['total_customers', 9500, 'Integer', '9,500'],
  ['licensed_seat_delta', -9058, 'HugeInt', '-9,058'],
]

const moneyValues = [
  ['budget_usd', 1091, 'Decimal(18,2)', '$1,091.00'],
  ['amount', -42, 'Decimal(18,2)', '($42.00)'],
  ['cost', 9.25, 'Float64', '$9.25'],
  ['revenue', 77, 'Double', '$77.00'],
  ['revenue_per_account', 125, 'Decimal(18,2)', '$125.00'],
  ['cost_per_month', 9.25, 'Double', '$9.25'],
]

for (const [name, value, type, expected] of [...plainQuantities, ...moneyValues]) {
  assert.equal(formatCell(value, name, type).text, expected, `${name} (${type})`)
}

console.log(`FORMAT CONTRACT GREEN — ${plainQuantities.length} quantity aliases stay plain and ${moneyValues.length} monetary aliases keep finance formatting.`)
