// The reference-solution harness — the only thing that makes green checks trustworthy.
// Executes every mission's canonical SQL (and every authored trap fingerprint, and
// every screen-sim question) against the freshly generated parquet, through the SAME
// canonicalization path the app grades with (src/canon.js), and freezes the expected
// results into src/missions.compiled.json. ANY failure fails the build.
import { DuckDBInstance } from '@duckdb/node-api'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MISSIONS, PARTS, SCREEN_SIMS } from './missions-source.mjs'
import { BADGES, COMPANY_CARDS, COMPETENCIES, STAGES } from './progression-source.mjs'
import { canonRowSelect } from '../src/canon.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = join(ROOT, 'public', 'data')
const MAX_EXPECTED_ROWS = 500
const MIN_COMPANY_CARDS = 9

const manifest = JSON.parse(readFileSync(join(DATA, 'manifest.json'), 'utf8'))
const instance = await DuckDBInstance.create(':memory:')
const conn = await instance.connect()
for (const t of Object.keys(manifest.tables)) {
  await conn.run(`CREATE VIEW ${t} AS SELECT * FROM parquet_scan('${DATA}/${t}.parquet')`)
}

const errors = []
const declaredPartIds = new Set(PARTS.map((part) => part.id))
if (declaredPartIds.size !== PARTS.length) errors.push('PARTS contains a duplicate id')
for (const mission of MISSIONS) {
  if (!declaredPartIds.has(mission.part)) errors.push(`${mission.id}: part ${mission.part} is missing from PARTS and would be hidden from the desk queue`)
}

async function freeze(id, sql, ordered) {
  try {
    await conn.run(`CREATE OR REPLACE TEMP TABLE _ref AS SELECT * FROM (\n${sql}\n) __r`)
    const metaR = await conn.runAndReadAll(`SELECT column_name, data_type FROM duckdb_columns() WHERE table_name = '_ref' ORDER BY column_index`)
    const cols = metaR.getRows().map((r) => ({ name: String(r[0]), type: String(r[1]) }))
    const orderClause = ordered ? '' : 'ORDER BY __row' // stable storage order for unordered
    const rowsR = await conn.runAndReadAll(`${canonRowSelect('_ref', cols)} ${orderClause}`)
    const rows = rowsR.getRows().map((r) => String(r[0]))
    if (rows.length === 0) errors.push(`${id}: canonical query returned ZERO rows — mission is unanswerable`)
    if (rows.length > MAX_EXPECTED_ROWS) errors.push(`${id}: canonical returns ${rows.length} rows (> ${MAX_EXPECTED_ROWS}) — deliverable too wide to grade`)
    return { columnCount: cols.length, columns: cols.map((c) => c.name), rowCount: rows.length, rows }
  } catch (e) {
    errors.push(`${id}: canonical FAILED: ${String(e.message).slice(0, 300)}`)
    return null
  }
}

const negativeZeroProbe = await freeze(
  'canonicalization:negative-zero',
  'SELECT -0.004::DOUBLE AS signed_zero',
  true,
)
if (negativeZeroProbe?.rows[0] !== '1:0') {
  errors.push(`canonicalization: negative zero must grade as 1:0, found ${negativeZeroProbe?.rows[0] ?? 'no row'}`)
}

// Missions and audition questions share the same deterministic trap contract:
// matching column shape, at least one row, and a non-canonical result.
async function compileFingerprints(ownerId, expected, fpSources) {
  const fingerprints = []
  for (let fi = 0; fi < fpSources.length; fi++) {
    const src = fpSources[fi]
    if (!src.message?.trim()) errors.push(`${ownerId}: trap fingerprint ${fi} has no guidance message`)
    const fp = await freeze(`${ownerId}:fingerprint${fi}`, src.sql, false)
    if (!fp) continue
    if (fp.columnCount !== expected.columnCount) errors.push(`${ownerId}: trap fingerprint ${fi} returns ${fp.columnCount} columns; runtime shape grading expects ${expected.columnCount}, so the trap could never fire`)
    if (fp.rowCount === 0) errors.push(`${ownerId}: trap fingerprint ${fi} returns zero rows; runtime zero-row grading would fire first`)
    // a fingerprint identical to the right answer would misfire
    const same = fp.columnCount === expected.columnCount && fp.rowCount === expected.rowCount && JSON.stringify([...fp.rows].sort()) === JSON.stringify([...expected.rows].sort())
    if (same) errors.push(`${ownerId}: trap fingerprint ${fi} equals the correct answer — trap is broken`)
    else fingerprints.push({ rowCount: fp.rowCount, rows: fp.rows, message: src.message })
  }
  return fingerprints
}

// Learner-visible solution SQL is never parsed out of display prose. Authors
// may provide a dedicated solutionSql; otherwise the compiler uses canonical.
// The old third hint remains useful only as an explanatory note.
function deriveSolutionNote(mission) {
  if (mission.solutionNote !== undefined) return String(mission.solutionNote ?? '').trim() || null
  const trimmed = String(mission.hints?.[2] ?? '').trim()
  if (!trimmed) return null
  if (/^(SELECT|WITH)\b/i.test(trimmed)) {
    const boundaries = [...trimmed.matchAll(/\n\s*\n/g)]
    if (boundaries.length === 0) return null
    if (boundaries.length > 1) {
      errors.push(`${mission.id}: third hint has ambiguous blank-line boundaries; author solutionNote explicitly`)
      return null
    }
    const boundary = boundaries[0]
    return trimmed.slice(boundary.index + boundary[0].length).trim() || null
  }
  return trimmed
}

const compiledMissions = []
let verifiedSolutionCount = 0
for (const m of MISSIONS) {
  const expected = await freeze(m.id, m.canonical, m.ordered)
  if (!expected) continue
  if (m.id === 'm145') {
    const handoff = Object.fromEntries(expected.columns.map((column, index) => [
      column,
      expected.rows[0]?.split('\u001f')[index]?.replace(/^1:/, ''),
    ]))
    const allocationTruth = {
      direct_receiver_cost_usd: '124900537.67',
      head_post_allocation_cost_usd: '156858594.94',
      payroll_post_allocation_cost_usd: '156858594.94',
    }
    for (const [column, value] of Object.entries(allocationTruth)) {
      if (handoff[column] !== value) {
        errors.push(`m145: ${column} must preserve the independently audited allocation truth ${value}, found ${handoff[column] ?? 'missing'}`)
      }
    }
  }
  if (m.id === 'm155') {
    if (expected.rowCount !== 1) {
      errors.push(`m155: cost-to-serve handoff must return exactly one row, found ${expected.rowCount}`)
    }
    const handoff = Object.fromEntries(expected.columns.map((column, index) => [
      column,
      expected.rows[0]?.split('\u001f')[index]?.replace(/^1:/, ''),
    ]))
    const costToServeTruth = {
      h1_revenue_usd: '41988670.41',
      h1_modeled_cost_usd: '15892834.89',
      h1_modeled_gp_usd: '26095835.52',
      h1_modeled_margin_pct: '62.1',
      modeled_customers: '5649',
      negative_margin_customers: '3954',
      unassigned_top10_customers: '7',
      lowest_modeled_gp_customer_id: 'C-01183',
      lowest_modeled_gp_customer_name: 'Birchwood Health Collective',
      lowest_modeled_gp_usd: '-8905.44',
      largest_support_sensitivity_plan: 'Starter',
      largest_seat_minus_logo_support_usd: '-2295932.07',
      seat_sensitivity_net_change_usd: '0',
    }
    for (const [column, value] of Object.entries(costToServeTruth)) {
      if (handoff[column] !== value) {
        errors.push(`m155: ${column} must preserve the independently audited cost-to-serve truth ${value}, found ${handoff[column] ?? 'missing'}`)
      }
    }
  }
  if (m.id === 'm162') {
    if (expected.rowCount !== 1) {
      errors.push(`m162: external-labor handoff must return exactly one row, found ${expected.rowCount}`)
    }
    const handoff = Object.fromEntries(expected.columns.map((column, index) => [
      column,
      expected.rows[0]?.split('\u001f')[index]?.replace(/^1:/, ''),
    ]))
    const externalLaborTruth = {
      paid_contractors: '45',
      contractor_employee_months: '258',
      h1_contractor_payroll_usd: '4756841.46',
      raw_consulting_lines: '288',
      deduped_consulting_lines: '288',
      exact_copy_duplicate_lines: '0',
      consulting_vendors: '11',
      h1_consulting_actual_usd: '6603799.66',
      h1_consulting_plan_usd: '6596760.21',
      consulting_variance_usd: '7039.45',
      h1_combined_external_labor_usd: '11360641.12',
      largest_external_labor_division: 'R&D',
      largest_division_external_labor_usd: '6546332.38',
      largest_division_external_labor_share_pct: '57.6',
      top_vendor_name: 'Beacon Collective',
      top_vendor_spend_usd: '782236.6',
      top_3_vendor_concentration_pct: '32.5',
    }
    for (const [column, value] of Object.entries(externalLaborTruth)) {
      if (handoff[column] !== value) {
        errors.push(`m162: ${column} must preserve the independently audited external-labor truth ${value}, found ${handoff[column] ?? 'missing'}`)
      }
    }
  }
  if (m.id === 'm170') {
    if (expected.rowCount !== 1) {
      errors.push(`m170: travel-and-expense handoff must return exactly one row, found ${expected.rowCount}`)
    }
    const handoff = Object.fromEntries(expected.columns.map((column, index) => [
      column,
      expected.rows[0]?.split('\u001f')[index]?.replace(/^1:/, ''),
    ]))
    const travelExpenseTruth = {
      raw_te_lines: '6582',
      deduped_te_lines: '6582',
      exact_copy_duplicate_lines: '0',
      te_vendors: '38',
      te_departments: '8',
      unexpected_source_lines: '0',
      missing_vendor_lines: '0',
      missing_department_lines: '0',
      h1_te_actual_usd: '10760335.61',
      travel_actual_usd: '6669864.99',
      travel_actual_mix_pct: '62',
      meals_actual_usd: '4090470.62',
      meals_actual_mix_pct: '38',
      h1_te_plan_usd: '10361275.02',
      te_variance_usd: '399060.59',
      te_variance_pct: '3.9',
      q1_te_actual_usd: '5179464.41',
      q2_te_actual_usd: '5580871.2',
      q2_vs_q1_change_usd: '401406.79',
      q2_vs_q1_change_pct: '7.7',
      largest_plan_miss_division: 'S&M',
      largest_plan_miss_division_usd: '363559.34',
      largest_plan_miss_division_share_pct: '91.1',
      largest_spend_department: 'Customer Success',
      largest_spend_department_usd: '1419140.13',
      largest_spend_department_share_pct: '13.2',
      largest_plan_miss_department: 'Marketing',
      largest_plan_miss_leader: 'Claire Dubois',
      largest_plan_miss_usd: '93898.18',
      missing_employee_month_departments: '1',
      unsupported_exposure_usd: '1362666.3',
      bounded_review_rows: '5',
    }
    for (const [column, value] of Object.entries(travelExpenseTruth)) {
      if (handoff[column] !== value) {
        errors.push(`m170: ${column} must preserve the independently audited travel-and-expense truth ${value}, found ${handoff[column] ?? 'missing'}`)
      }
    }
  }
  if (m.id === 'm179') {
    if (expected.rowCount !== 1) {
      errors.push(`m179: revenue-close handoff must return exactly one row, found ${expected.rowCount}`)
    }
    const handoff = Object.fromEntries(expected.columns.map((column, index) => [
      column,
      expected.rows[0]?.split('\u001f')[index]?.replace(/^1:/, ''),
    ]))
    const revenueCloseTruth = {
      revenue_accounts_in_chart: '3',
      loaded_revenue_accounts: '2',
      zero_loaded_revenue_accounts: '1',
      h1_revenue_actual_usd: '41988670.41',
      h1_revenue_plan_usd: '40676473.06',
      h1_revenue_variance_usd: '1312197.35',
      subscription_actual_usd: '34830812.09',
      subscription_plan_usd: '33089177.44',
      subscription_variance_usd: '1741634.65',
      usage_actual_usd: '7157858.32',
      usage_plan_usd: '7587295.62',
      usage_variance_usd: '-429437.3',
      subscription_months_checked: '6',
      subscription_exception_months: '0',
      subscription_difference_cents: '0',
      subscription_source_exceptions: '0',
      expected_usage_customer_months: '9168',
      observed_usage_customer_months: '9168',
      missing_usage_customer_months: '0',
      unexpected_usage_customer_months: '0',
      usage_revenue_stream_labels: '2',
      usage_customers: '1737',
      top_ten_usage_revenue_usd: '402994.05',
      top_ten_usage_revenue_share_pct: '5.6',
      largest_customer_usage_revenue_usd: '54447.32',
      bounded_review_rows: '10',
      bounded_review_rows_missing_csm: '0',
      bounded_review_assignment_window_exceptions: '6',
      bounded_review_csm_inactive_at_cutoff: '0',
    }
    for (const [column, value] of Object.entries(revenueCloseTruth)) {
      if (handoff[column] !== value) {
        errors.push(`m179: ${column} must preserve the independently audited revenue-close truth ${value}, found ${handoff[column] ?? 'missing'}`)
      }
    }
  }

  const solutionSql = String(m.solutionSql ?? m.canonical).trim()
  if (!/^\s*(SELECT|WITH)\b/i.test(solutionSql)) {
    errors.push(`${m.id}: learner-visible solution must begin with SELECT or WITH`)
  } else {
    const solutionResult = await freeze(`${m.id}:solution`, solutionSql, m.ordered)
    if (solutionResult) {
      const sameRows = m.ordered
        ? JSON.stringify(solutionResult.rows) === JSON.stringify(expected.rows)
        : JSON.stringify([...solutionResult.rows].sort()) === JSON.stringify([...expected.rows].sort())
      if (solutionResult.columnCount !== expected.columnCount) {
        errors.push(`${m.id}: learner-visible solution returns ${solutionResult.columnCount} columns; canonical returns ${expected.columnCount}`)
      }
      if (solutionResult.rowCount !== expected.rowCount) {
        errors.push(`${m.id}: learner-visible solution returns ${solutionResult.rowCount} rows; canonical returns ${expected.rowCount}`)
      }
      if (!sameRows) errors.push(`${m.id}: learner-visible solution is not result-equivalent to canonical`)
      if (solutionResult.columnCount === expected.columnCount && solutionResult.rowCount === expected.rowCount && sameRows) {
        verifiedSolutionCount += 1
      }
    }
  }
  const fpSources = [
    ...(m.fingerprintSQL ? [{ sql: m.fingerprintSQL, message: m.fingerprintMessage }] : []),
    ...(m.extraFingerprints ?? []),
  ]
  const fingerprints = await compileFingerprints(m.id, expected, fpSources)
  if (m.requireRegex) {
    if (!new RegExp(m.requireRegex, 'i').test(m.canonical)) errors.push(`${m.id}: canonical fails its own requireRegex`)
    if (!m.requireMessage) errors.push(`${m.id}: requireRegex without requireMessage`)
  }
  compiledMissions.push({
    id: m.id, part: m.part, title: m.title, from: m.from,
    ask: m.ask, deliverable: m.deliverable, tables: m.tables,
    prefill: m.prefill ?? null, hints: m.hints, sayIt: m.sayIt,
    successNote: m.successNote ?? null,
    ordered: m.ordered, orderedNote: m.orderedNote ?? null,
    jdCompanies: m.jdCompanies ?? [],
    solution: solutionSql,
    solutionNote: deriveSolutionNote(m),
    requireRegex: m.requireRegex ?? null,
    requireMessage: m.requireMessage ?? null,
    expected, fingerprints,
  })
}

// Audition integrity: no fixed count. Each set must be internally sound — at
// least one question, unique ids, unique canonicals — and owned by exactly one
// company card. Set and question counts come from authored content.
if (new Set(SCREEN_SIMS.map((sim) => sim.id)).size !== SCREEN_SIMS.length) errors.push('screen sims: duplicate variant id')
const sourceSimQuestions = SCREEN_SIMS.flatMap((sim) => Array.isArray(sim.questions) ? sim.questions : [])
if (new Set(sourceSimQuestions.map((q) => q.id)).size !== sourceSimQuestions.length) errors.push('screen sims: duplicate question id')
if (new Set(sourceSimQuestions.map((q) => q.canonical.trim())).size !== sourceSimQuestions.length) errors.push('screen sims: duplicate canonical query — a new set must require new reasoning')
for (const sim of SCREEN_SIMS) {
  if (!Array.isArray(sim.questions) || sim.questions.length < 1) errors.push(`${sim.id}: audition must have at least one question`)
}
for (const question of sourceSimQuestions) {
  if (!Array.isArray(question.tables) || question.tables.length === 0) {
    errors.push(`${question.id}: audition question must name at least one table`)
    continue
  }
  if (new Set(question.tables).size !== question.tables.length) errors.push(`${question.id}: duplicate table relevance`)
  for (const table of question.tables) {
    if (!manifest.tables[table]) errors.push(`${question.id}: unknown table relevance ${table}`)
  }
}

const compiledSims = []
for (const sim of SCREEN_SIMS) {
  const owners = COMPANY_CARDS.filter((card) => card.auditionId === sim.id)
  if (owners.length === 0) errors.push(`${sim.id}: no company card owns this audition`)
  if (owners.length > 1) errors.push(`${sim.id}: ${owners.length} company cards own this audition — expected exactly one`)
  const companyCard = owners[0]
  const compiledSim = { id: sim.id, company: companyCard?.company ?? '', title: sim.title, intro: sim.intro, questions: [] }
  for (const q of sim.questions) {
    const expected = await freeze(q.id, q.canonical, q.ordered)
    if (!expected) continue
    if (q.id === 'sim05-q1') {
      const gapIndex = expected.columns.indexOf('bridge_gap_usd')
      if (gapIndex < 0) {
        errors.push('sim05-q1: bridge_gap_usd is missing from the frozen result')
      } else {
        const gaps = expected.rows.map((row) => row.split('\u001f')[gapIndex])
        if (gaps.some((value) => value !== '1:0')) {
          errors.push(`sim05-q1: bridge gaps must freeze as canonical zero, found ${gaps.join(', ')}`)
        }
      }
    }
    const fpSources = [
      ...(q.fingerprintSQL ? [{ sql: q.fingerprintSQL, message: q.fingerprintMessage }] : []),
      ...(q.extraFingerprints ?? []),
    ]
    const fingerprints = await compileFingerprints(q.id, expected, fpSources)
    if (q.requireRegex && !new RegExp(q.requireRegex, 'i').test(q.canonical)) errors.push(`${q.id}: canonical fails its own requireRegex`)
    if (q.requireRegex && !q.requireMessage) errors.push(`${q.id}: requireRegex without requireMessage`)
    compiledSim.questions.push({
      id: q.id, ask: q.ask, deliverable: q.deliverable,
      tables: q.tables,
      ordered: q.ordered, orderedNote: q.orderedNote ?? null,
      narration: q.narration, canonical: q.canonical,
      requireRegex: q.requireRegex ?? null,
      requireMessage: q.requireMessage ?? null,
      expected, fingerprints,
    })
  }
  compiledSims.push(compiledSim)
}

// Interview Ready panel: brief attributed excerpts must be verbatim substrings
// of the dated source record. Fabrication fails the build.
const corpus = JSON.parse(readFileSync(join(ROOT, 'scripts', 'jd-sql-requirements.json'), 'utf8'))
// `quote`, when given, is a hand-picked CLEAN span — still verified verbatim below.
const QUOTES = [
  { company: '1Password', missionIds: ['m08', 'm11', 'm16', 'm19'], quote: 'You should be just as comfortable debugging SQL as you are discussing pipeline risk with sales leadership' },
  { company: 'Affirm', missionIds: ['m04', 'm12'], quote: 'comfort with SQL, Sigma, Cursor and/or other data visualization tools' },
  { company: 'Figma', missionIds: ['m01', 'm17', 'm21', 'm24'], quote: 'SQL/AI tooling experience and deep experience working with large data-sets' },
  { company: 'Harvey', missionIds: ['m02', 'm05'], quote: 'Comfortable in SQL or BI tools — you can pull your own data' },
  { company: 'Hightouch', missionIds: ['m07', 'm08', 'm14', 'm18', 'm20', 'm21', 'm22'], quote: 'comfort writing SQL and navigating a modern warehouse and BI stack' },
  { company: 'Instacart', missionIds: ['m03', 'm06'], quote: 'Proficiency in SQL for self-serve analysis' },
  { company: 'Cockroach Labs', missionIds: ['m09'], quote: 'Experience with SQL or other querying languages' },
  { company: 'Datadog', missionIds: ['m15', 'm23', 'm24'], quote: 'Interest in data analytics and experience using SQL, Python, R, or other data science tools' },
  { company: 'Navan', missionIds: ['m13', 'm17', 'm18'], quote: '2-3+ years of experience developing complex SQL, including multi-table joins and analytical functions' },
]
const interviewReady = []
for (const q of QUOTES) {
  const jd = corpus.find((j) => (j.company || '').toLowerCase().includes(q.company.toLowerCase()))
  if (!jd || !jd.sql_lines?.length) { errors.push(`interview-ready: no corpus entry for ${q.company}`); continue }
  const line = q.quote ?? (jd.sql_lines.find((l) => /sql/i.test(l)) ?? jd.sql_lines[0])
  if (!jd.source_url || !jd.captured_on) {
    errors.push(`interview-ready: missing provenance for ${q.company}`)
  }
  interviewReady.push({
    company: jd.company,
    title: jd.title,
    quote: line.trim(),
    sourceUrl: jd.source_url,
    capturedOn: jd.captured_on,
    missionIds: q.missionIds,
  })
}
// verbatim check: every stored quote must be an exact substring of a parsed corpus line
const allLines = corpus.flatMap((j) => j.sql_lines ?? [])
for (const item of interviewReady) {
  if (!allLines.some((l) => l.includes(item.quote))) {
    errors.push(`interview-ready: quote for ${item.company} is not verbatim from the corpus`)
  }
}

// Career Casebook manifest: fail closed on every missing, duplicate, or
// dangling identifier. The runtime derives awards from this validated policy;
// it never trusts a persisted "earned" boolean.
const missionIds = new Set(MISSIONS.map((mission) => mission.id))
const simIds = new Set(SCREEN_SIMS.map((sim) => sim.id))
const quoteCompanies = new Set(interviewReady.map((item) => item.company))
const validateUniqueIds = (label, items) => {
  const ids = items.map((item) => item.id)
  if (ids.some((id) => typeof id !== 'string' || !id.trim())) errors.push(`${label}: missing id`)
  if (new Set(ids).size !== ids.length) errors.push(`${label}: duplicate id`)
}
const validateEvidenceRule = (label, rule) => {
  for (const id of rule.missionIds ?? rule.evidenceMissionIds ?? []) {
    if (!missionIds.has(id)) errors.push(`${label} ${rule.id ?? rule.company}: dangling mission ${id}`)
  }
  for (const id of rule.auditionIds ?? (rule.auditionId ? [rule.auditionId] : [])) {
    if (!simIds.has(id)) errors.push(`${label} ${rule.id ?? rule.company}: dangling audition ${id}`)
  }
}
validateUniqueIds('competencies', COMPETENCIES)
validateUniqueIds('badges', BADGES)
validateUniqueIds('stages', STAGES)
if (STAGES.length !== 6) errors.push(`stages: expected exactly 6, found ${STAGES.length}`)
if (COMPANY_CARDS.length < MIN_COMPANY_CARDS) errors.push(`company cards: expected at least ${MIN_COMPANY_CARDS}, found ${COMPANY_CARDS.length}`)
if (new Set(COMPANY_CARDS.map((card) => card.company)).size !== COMPANY_CARDS.length) errors.push('company cards: duplicate company')
for (const competency of COMPETENCIES) validateEvidenceRule('competency', competency)
const crewGuideIds = new Set(['riff', 'rex', 'coco', 'zi', 'fin', 'frosty'])
for (const badge of BADGES) {
  validateEvidenceRule('badge', badge)
  const competency = COMPETENCIES.find((candidate) => candidate.id === badge.competencyId)
  if (!competency) errors.push(`badge ${badge.id}: dangling competency ${badge.competencyId}`)
  if (!crewGuideIds.has(badge.guideId)) errors.push(`badge ${badge.id}: unknown desk-crew guide ${badge.guideId}`)
  if (!badge.description?.trim()) errors.push(`badge ${badge.id}: missing capability story`)
  if (competency) {
    const sameMissions = JSON.stringify(badge.missionIds) === JSON.stringify(competency.missionIds)
    const sameAuditions = JSON.stringify(badge.auditionIds) === JSON.stringify(competency.auditionIds ?? [])
    if (!sameMissions || !sameAuditions) errors.push(`badge ${badge.id}: evidence must match competency ${competency.id}`)
  }
}
for (const competency of COMPETENCIES) {
  const owners = BADGES.filter((badge) => badge.competencyId === competency.id)
  if (owners.length !== 1) errors.push(`competency ${competency.id}: expected one evidence seal, found ${owners.length}`)
}
for (const card of COMPANY_CARDS) {
  validateEvidenceRule('company', card)
  if (!quoteCompanies.has(card.company)) errors.push(`company ${card.company}: missing verified JD quote`)
}
const ownedAuditionIds = COMPANY_CARDS.map((card) => card.auditionId).filter((id) => id)
if (new Set(ownedAuditionIds).size !== ownedAuditionIds.length) errors.push('company cards: two cards own the same audition')
for (let i = 0; i < STAGES.length; i++) {
  const stage = STAGES[i]
  for (const badgeId of stage.requiredBadgeIds ?? []) {
    if (!BADGES.some((badge) => badge.id === badgeId)) errors.push(`stage ${stage.id}: dangling badge ${badgeId}`)
  }
  for (const auditionId of stage.requiredAuditionIds ?? []) {
    if (!simIds.has(auditionId)) errors.push(`stage ${stage.id}: dangling audition ${auditionId}`)
  }
  if (i > 0 && !(STAGES[i - 1].requiredBadgeIds ?? []).every((id) => stage.requiredBadgeIds.includes(id))) errors.push(`stage ${stage.id}: badge requirements go backwards`)
  if (i > 0 && !(STAGES[i - 1].requiredAuditionIds ?? []).every((id) => stage.requiredAuditionIds.includes(id))) errors.push(`stage ${stage.id}: audition requirements go backwards`)
}
const compiledCompanyCards = COMPANY_CARDS.map((card) => {
  const jd = interviewReady.find((item) => item.company === card.company)
  return { ...card, title: jd?.title ?? '', quote: jd?.quote ?? '' }
})
const progression = {
  competencies: COMPETENCIES,
  badges: BADGES,
  stages: STAGES,
  companyCards: compiledCompanyCards,
  auditions: compiledSims.map((sim) => ({
    id: sim.id,
    company: sim.company,
    title: sim.title,
    questionIds: sim.questions.map((question) => question.id),
  })),
}

// A signed IEEE zero is not a distinct business value. Guard the whole frozen
// corpus so build-time answers and equivalent learner SQL cannot diverge on it.
for (const frozen of [
  ...compiledMissions.flatMap((mission) => [
    { id: mission.id, rows: mission.expected.rows },
    ...mission.fingerprints.map((fingerprint) => ({ id: `${mission.id}:fingerprint`, rows: fingerprint.rows })),
  ]),
  ...compiledSims.flatMap((sim) => sim.questions.flatMap((question) => [
    { id: question.id, rows: question.expected.rows },
    ...question.fingerprints.map((fingerprint) => ({ id: `${question.id}:fingerprint`, rows: fingerprint.rows })),
  ])),
]) {
  if (frozen.rows.some((row) => row.split('\u001f').includes('1:-0'))) {
    errors.push(`${frozen.id}: negative zero leaked into frozen canonical output`)
  }
}

if (errors.length) {
  console.error('HARNESS FAILED — the build must not ship:\n - ' + errors.join('\n - '))
  process.exit(1)
}

const out = {
  builtAt: manifest.generated_at,
  company: manifest.company,
  totalRows: manifest.total_rows,
  tableRows: Object.fromEntries(Object.entries(manifest.tables).map(([t, v]) => [t, v.rows])),
  parts: PARTS,
  missions: compiledMissions,
  sims: compiledSims,
  interviewReady,
  progression,
}
writeFileSync(join(ROOT, 'src', 'missions.compiled.json'), JSON.stringify(out))
const compiledSimQuestions = compiledSims.reduce((count, sim) => count + sim.questions.length, 0)
console.log(`HARNESS GREEN: ${compiledMissions.length}/${MISSIONS.length} missions + ${verifiedSolutionCount}/${MISSIONS.length} learner-visible solutions verified, ${compiledSims.length}/${SCREEN_SIMS.length} company auditions + ${compiledSimQuestions}/${sourceSimQuestions.length} questions, ${interviewReady.length} JD quotes (all verbatim), ${BADGES.length} derived badges.`)
for (const m of compiledMissions) console.log(`  ✓ ${m.id} — ${m.expected.rowCount} row(s), ${m.expected.columnCount} col(s)${m.fingerprints.length ? ' + trap' : ''}`)
