import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SCREEN_SIMS } from './missions-source.mjs'

const [workspace, tableSheet, tableCss, css, dataWorkbook, relationshipCanvas, relationshipCss, schemaNotes, buildMissions, missionTypes, compiledText] = await Promise.all([
  readFile(new URL('../src/Workspace.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/TableSheet.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/table-sheet.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/workbook/DataWorkbook.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/workbook/RelationshipCanvas.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/workbook/relationship-canvas.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/schema-notes.ts', import.meta.url), 'utf8'),
  readFile(new URL('./build-missions.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../src/missions.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/missions.compiled.json', import.meta.url), 'utf8'),
])
const compiled = JSON.parse(compiledText)

let passed = 0
let failed = 0
const check = (name, proof) => {
  try {
    proof()
    passed += 1
    console.log(`  ✓ ${name}`)
  } catch (error) {
    failed += 1
    console.error(`  ✗ ${name} — ${error.message}`)
  }
}

check('direct Database objects copy is source-bound', () => {
  for (const copy of [
    'Database objects',
    'Warehouse status',
    'Ready on this device',
    'Star67',
    'Practice warehouse',
    'One warehouse, 12 tables. Open a table to inspect its columns and sample rows.',
    'The warehouse runs here and stays on this device.',
    'Table details',
    'Grain',
    'Columns (',
    'Sample rows',
    'Used in this ask',
  ]) assert.ok(workspace.includes(copy), `missing copy: ${copy}`)
  assert.doesNotMatch(workspace, />Finance warehouse</)
})

check('catalog identity, relations, and columns come from live DuckDB', () => {
  assert.match(workspace, /current_database\s*\(\s*\)/i)
  assert.match(workspace, /current_schema\s*\(\s*\)/i)
  assert.match(workspace, /information_schema\.tables/i)
  assert.match(workspace, /information_schema\.columns/i)
  assert.match(workspace, /Local catalog ·/)
  assert.match(workspace, /\bVIEW\b/)
})

check('relation disclosure and narrow drawer are semantic', () => {
  assert.match(workspace, /aria-expanded=/)
  assert.match(workspace, /aria-controls=/)
  assert.match(workspace, /role=\{[^\n]*'dialog'/)
  assert.match(workspace, /aria-modal=/)
  assert.match(workspace, /Open database objects/)
  assert.match(workspace, /event\.key === 'Tab'/)
  assert.match(workspace, /event\.key === 'Escape'/)
})

check('sample preview exposes loading, error, retry, and insertion actions', () => {
  assert.match(workspace, /Loading sample rows/)
  assert.match(workspace, /Sample rows unavailable/)
  assert.match(workspace, />Retry</)
  assert.match(workspace, /Use table/)
  assert.match(workspace, /Use column/)
  assert.doesNotMatch(workspace, /runRaw\([^\n]*LIMIT 3[^\n]*\.catch\(\(\) => \{\}\)/)
})

check('responsive CSS keeps a real navigator instead of the bigger-desk warning', () => {
  assert.match(css, /\.database-navigator__mobile-open/)
  assert.match(css, /\.database-navigator__backdrop/)
  assert.match(css, /\.database-navigator\[data-drawer-open='true'\]/)
  assert.doesNotMatch(css, /Pivot needs a bigger desk/i)
})

check('navigator resize and spreadsheet surface are durable interaction contracts', () => {
  assert.match(workspace, /role="separator"/)
  assert.match(workspace, /aria-valuemin=\{NAVIGATOR_MIN_WIDTH\}/)
  assert.match(workspace, /localStorage\.setItem\(NAVIGATOR_WIDTH_KEY/)
  assert.match(workspace, /tables · read only/)
  assert.match(tableSheet, /role="grid"/)
  assert.match(tableSheet, /Filter loaded rows/)
  assert.match(tableSheet, /Copy cell/)
  assert.match(tableSheet, /Arrow keys move/)
  assert.match(tableSheet, /Sorting and filtering do not change the graded query result/)
  assert.match(workspace, /LIMIT \$\{SHEET_ROW_LIMIT\}/)
  assert.match(css, /\.database-navigator__resizer/)
  assert.match(tableCss, /\.table-sheet__grid/)
  assert.match(tableCss, /position:\s*sticky/)
})

check('warehouse sheets use the shared persistent workbench', () => {
  const resultsPanel = workspace.match(/function ResultsPanel[\s\S]*$/)?.[0] ?? ''
  assert.match(workspace, /<DataWorkbook/)
  assert.match(workspace, /relations=\{workbookRelations\}/)
  assert.match(workspace, /joins=\{COMMON_JOINS\}/)
  assert.match(workspace, /loadRelation=\{loadWorkbookRelation\}/)
  assert.match(workspace, /persistenceKey="pivot\.parkline-fpa\.workbook\.v1"/)
  assert.match(workspace, /focusMode=\{workbookFocusMode\}/)
  assert.match(dataWorkbook, /<RelationshipCanvas/)
  assert.match(dataWorkbook, /<TableSheet/)
  assert.match(dataWorkbook, /workbook\.state\.openRelationIds\.map/)
  assert.match(dataWorkbook, /hidden=\{!active\}/)
  assert.match(dataWorkbook, /Focus on workbook/)
  assert.match(dataWorkbook, /Show task/)
  assert.match(dataWorkbook, /Hide workbook/)
  assert.match(resultsPanel, /<TableSheet/)
  assert.doesNotMatch(workspace, /function\s+DataSheet\s*\(/)
  assert.doesNotMatch(workspace, /data-sheet__/)
  assert.doesNotMatch(css, /\.data-sheet__grid/)

  assert.match(workspace, /data-task-workspace="true"/)
  assert.match(workspace, /data-warehouse-workbench-sheet="true"/)
  assert.match(workspace, /const WAREHOUSE_SHEET_HEIGHT_KEY = 'pivot\.warehouseWorkbenchSheetHeight\.v1'/)
  assert.match(workspace, /localStorage\.getItem\(WAREHOUSE_SHEET_HEIGHT_KEY\)/)
  assert.match(workspace, /localStorage\.setItem\(WAREHOUSE_SHEET_HEIGHT_KEY/)
  assert.match(workspace, /role="separator"[\s\S]*aria-label="Resize warehouse workbook"[\s\S]*aria-orientation="horizontal"/)
  assert.match(workspace, /aria-valuemin=\{WAREHOUSE_SHEET_MIN_HEIGHT\}/)
  assert.match(workspace, /aria-valuemax=\{warehouseSheetMaxHeight\}/)
  assert.match(workspace, /aria-valuenow=\{warehouseSheetHeight\}/)
  assert.match(workspace, /onPointerDown=\{startWarehouseSheetResize\}/)
  assert.match(workspace, /onPointerMove=\{moveWarehouseSheetResize\}/)
  assert.match(workspace, /event\.key === 'ArrowUp'/)
  assert.match(workspace, /event\.key === 'ArrowDown'/)
  assert.match(workspace, /event\.key === 'Home'/)
  assert.match(workspace, /event\.key === 'End'/)
  assert.match(workspace, /onDoubleClick=\{\(\) => resizeWarehouseSheet\(WAREHOUSE_SHEET_DEFAULT_HEIGHT\)\}/)

  assert.match(tableSheet, /onClose\?: \(\) => void/)
  assert.match(tableSheet, /closeLabel\?: string/)
  assert.match(tableSheet, /initialFocus\?: 'grid' \| 'close'/)
  assert.match(tableSheet, /event\.key !== 'Escape'/)
  assert.match(css, /\.warehouse-workbench__task/)
  assert.match(css, /\.warehouse-workbench__sheet/)
  assert.match(css, /\.warehouse-workbench__resizer/)
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.warehouse-workbench__resizer\s*\{[^}]*display:\s*none/)
})

check('Relationship canvas derives every table and field from the live catalog', () => {
  for (const copy of [
    'See all fields',
  ]) assert.ok(workspace.includes(copy), `missing workbook copy: ${copy}`)
  assert.match(dataWorkbook, /relations\.map\(\(relation\)/)
  assert.match(dataWorkbook, /relation\.columns/)
  assert.match(dataWorkbook, /tableNotes\[relation\.id\]/)
  assert.match(dataWorkbook, /columnTypes\[column\.name\] = column\.type/)
  assert.match(relationshipCanvas, /tables\.map\(\(table\)/)
  assert.match(relationshipCanvas, /table\.fields\.map/)
  assert.match(relationshipCanvas, /data-testid="relationship-canvas-viewport"/)
  assert.match(relationshipCss, /\.relationship-canvas__viewport/)
  assert.match(relationshipCss, /overflow:\s*auto/)
  assert.match(relationshipCss, /@media \(max-width: 720px\)/)
})

check('Relationship canvas exposes only the 11 mapped, live-key relationships', () => {
  const expected = [
    ['fct_gl_transactions', 'account_id', 'dim_account', 'account_id'],
    ['fct_gl_transactions', 'dept_id', 'dim_department', 'dept_id'],
    ['fct_gl_transactions', 'vendor_id', 'dim_vendor', 'vendor_id'],
    ['fct_gl_transactions', 'customer_id', 'dim_customer', 'customer_id'],
    ['fct_subscription_snapshot_monthly', 'customer_id', 'dim_customer', 'customer_id'],
    ['fct_arr_movements', 'customer_id', 'dim_customer', 'customer_id'],
    ['fct_budget', 'account_id', 'dim_account', 'account_id'],
    ['fct_payroll_monthly', 'employee_id', 'dim_employee', 'employee_id'],
    ['fct_payroll_monthly', 'dept_id', 'dim_department', 'dept_id'],
    ['stg_customer_csm_assignments', 'customer_id', 'dim_customer', 'customer_id'],
    ['dim_employee', 'dept_id', 'dim_department', 'dept_id'],
  ]
  const joinBlock = schemaNotes.match(/export const COMMON_JOINS[^=]*=\s*\[([\s\S]*?)\n\]/)?.[1] ?? ''
  const actual = [...joinBlock.matchAll(/from:\s*\{\s*relation:\s*'([^']+)',\s*column:\s*'([^']+)'\s*\},\s*to:\s*\{\s*relation:\s*'([^']+)',\s*column:\s*'([^']+)'\s*\}/g)]
    .map(([, fromRelation, fromColumn, toRelation, toColumn]) => [fromRelation, fromColumn, toRelation, toColumn])
  assert.deepEqual(actual, expected)
  assert.match(relationshipCanvas, /const resolvedEdges = useMemo/)
  assert.match(relationshipCanvas, /fromFieldIndex < 0 \|\| toFieldIndex < 0/)
  assert.match(relationshipCanvas, /resolvedEdges\.map/)
  assert.match(relationshipCanvas, /Lines are analysis guidance, not database-enforced keys or cardinality\./)
  assert.doesNotMatch(relationshipCanvas, /\b(?:one-to-many|many-to-one)\b/i)
})

const expectedTables = {
  'sim01-q1': ['fct_subscription_snapshot_monthly', 'dim_customer'],
  'sim01-q2': ['fct_subscription_snapshot_monthly', 'dim_customer'],
  'sim01-q3': ['fct_subscription_snapshot_monthly'],
  'sim01-q4': ['fct_subscription_snapshot_monthly'],
  'sim02-q1': ['dim_employee'],
  'sim02-q2': ['fct_payroll_monthly', 'dim_department'],
  'sim02-q3': ['dim_employee', 'dim_department'],
  'sim02-q4': ['fct_gl_transactions', 'dim_department', 'fct_budget'],
  'sim03-q1': ['fct_gl_transactions'],
  'sim03-q2': ['fct_gl_transactions'],
  'sim03-q3': ['fct_gl_transactions', 'dim_account'],
  'sim03-q4': ['fct_gl_transactions'],
  'sim04-q1': ['fct_budget'],
  'sim04-q2': ['fct_budget', 'dim_account'],
  'sim04-q3': ['fct_gl_transactions', 'dim_account', 'fct_budget'],
  'sim05-q1': ['fct_subscription_snapshot_monthly', 'fct_arr_movements', 'dim_customer'],
  'sim05-q2': ['fct_subscription_snapshot_monthly', 'fct_arr_movements', 'dim_customer'],
  'sim05-q3': ['fct_subscription_snapshot_monthly', 'fct_arr_movements', 'dim_customer'],
  'sim05-q4': ['fct_subscription_snapshot_monthly', 'fct_arr_movements', 'dim_customer'],
}

check('all audition questions author exact table relevance', () => {
  const questions = SCREEN_SIMS.flatMap((sim) => sim.questions)
  assert.equal(questions.length, Object.keys(expectedTables).length)
  for (const question of questions) {
    assert.deepEqual(question.tables, expectedTables[question.id], `${question.id} table relevance drift`)
  }
})

check('audition table relevance survives types and compilation', () => {
  assert.match(missionTypes, /interface SimQuestion[\s\S]*?tables: string\[\]/)
  assert.match(buildMissions, /tables:\s*q\.tables/)
  const questions = compiled.sims.flatMap((sim) => sim.questions)
  for (const question of questions) {
    assert.deepEqual(question.tables, expectedTables[question.id], `${question.id} compiled table relevance drift`)
  }
})

console.log(`Navigator source contract: ${passed}/${passed + failed}`)
if (failed) process.exit(1)
