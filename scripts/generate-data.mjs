// Star67 warehouse generator — deterministic synthetic FP&A warehouse for Star67.
// Public dataset contract: 12 tables, ~2.5M rows, 42 months (Jan 2023 → Jun 2026),
// USD only, ≤40MB parquet target (60MB hard abort).
// Internally consistent by construction:
//   customer sim → fct_arr_movements (exact event history)
//                → fct_subscription_snapshot_monthly (post-event ARR, active months only)
//                → GL revenue lines (subscription + metered usage, ties to snapshots)
//   employee sim → fct_payroll_monthly → GL comp lines (ties per dept-month)
//   GL actuals   → fct_budget (actuals × plan factor + noise; FY2025 Plan clean names,
//                  FY2025 Q2 Reforecast dirty names — never stacked)
// Warts (each consumed by a mission): dup Stripe load Mar-2024, dirty reforecast dept
// text, vendor name dupes (AWS/Google/LinkedIn), NULL termination_date = current,
// CSM-assignment fan-out (stg_customer_csm_assignments).
import { DuckDBInstance } from '@duckdb/node-api'
import { mkdirSync, writeFileSync, statSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { acquireGenerationLock } from './generation-lock.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'data')
mkdirSync(OUT, { recursive: true })

// ---------- deterministic PRNG ----------
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260710)
const ri = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1))
const rf = (lo, hi) => lo + rand() * (hi - lo)
const pick = (arr) => arr[Math.floor(rand() * arr.length)]

// ---------- calendar ----------
// Customer/employee lifecycles simulate from 2021 (the company predates the mart),
// but the mart's fact history (GL, snapshots, payroll, budget) is Jan 2023 → Jun 2026.
const SIM_START = new Date(Date.UTC(2021, 0, 1))
const MART_START = new Date(Date.UTC(2023, 0, 1))
const END = new Date(Date.UTC(2026, 5, 30))
const MONTHS = []
for (let d = new Date(SIM_START); d <= END; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
  MONTHS.push(new Date(d))
}
const MART_M0 = MONTHS.findIndex((m) => m >= MART_START) // index of Jan 2023
const iso = (d) => d.toISOString().slice(0, 10)
const daysInMonth = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
const midMonthDay = (m, day) => new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), Math.min(day, daysInMonth(m))))

// ---------- SQL helpers ----------
const esc = (s) => String(s).replaceAll("'", "''")
let conn
async function run(sql) { return conn.run(sql) }
// Bulk load via CSV + COPY: giant VALUES strings melt V8 (string internalization),
// DuckDB's CSV reader does hundreds of thousands of rows in milliseconds.
// Cell values here are RAW JS values (string | number | null | Date).
function csvCell(v) {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return iso(v)
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}
async function insertRows(table, columns, rows) {
  const file = join(tmpdir(), `pivot-gen-${process.pid}-${table}.csv`)
  const parts = [columns.join(',')]
  for (const r of rows) parts.push(r.map(csvCell).join(','))
  writeFileSync(file, parts.join('\n'))
  await run(`COPY ${table} (${columns.join(',')}) FROM '${file}' (FORMAT CSV, HEADER, NULLSTR '')`)
  rmSync(file, { force: true })
}
// raw-value passthroughs (kept for call-site readability; CSV writer handles typing)
const S = (v) => (v === null || v === undefined ? null : v)
const N = (v) => (v === null || v === undefined ? null : v)
const D = (v) => (v === null || v === undefined ? null : v)
const money = (v) => Math.round(v * 100) / 100

// =====================================================================
// Reference data
// =====================================================================
const DEPARTMENTS = [
  ['D-ENG-01', 'Engineering', '6100', 'R&D', 'Wei Zhang'],
  ['D-ENG-02', 'Platform Infrastructure', '6110', 'R&D', 'Sofia Marino'],
  ['D-PRD-01', 'Product', '6200', 'R&D', 'James Otieno'],
  ['D-DSN-01', 'Design', '6210', 'R&D', 'Hana Suzuki'],
  ['D-DAT-01', 'Data & Analytics', '6220', 'R&D', 'Fin'],
  ['D-SAL-01', 'Sales - Enterprise', '7100', 'S&M', 'Tom Callahan'],
  ['D-SAL-02', 'Sales - Mid-Market', '7110', 'S&M', 'Grace Adeyemi'],
  ['D-SAL-03', 'Sales Development', '7120', 'S&M', 'Kyle Brennan'],
  ['D-SOL-01', 'Solutions Engineering', '7130', 'S&M', 'Mateo Silva'],
  ['D-MKT-01', 'Marketing', '7200', 'S&M', 'Claire Dubois'],
  ['D-CSM-01', 'Customer Success', '7300', 'S&M', 'Alina Petrova'],
  ['D-SUP-01', 'Customer Support', '5300', 'COGS', 'Jordan Lee'],
  ['D-OPS-01', 'Cloud Operations', '5100', 'COGS', 'Noah Kim'],
  ['D-GA-01', 'Finance', '8100', 'G&A', 'Riff'],
  ['D-GA-02', 'People', '8200', 'G&A', 'Coco'],
  ['D-GA-03', 'Legal', '8300', 'G&A', 'David Chen'],
  ['D-GA-04', 'IT & Security', '8400', 'G&A', 'Omar Farouk'],
  ['D-GA-05', 'Workplace', '8500', 'G&A', 'Emma Walsh'],
  ['D-EXEC-01', 'Executive', '8000', 'G&A', 'Zi'],
]

const ACCOUNTS = [
  ['4000', 'Subscription Revenue', 'Revenue', 'Revenue'],
  ['4010', 'Usage Revenue', 'Revenue', 'Revenue'],
  ['4020', 'Professional Services Revenue', 'Revenue', 'Revenue'],
  ['5000', 'Hosting Costs', 'COGS', 'COGS'],
  ['5010', 'Payment Processing Fees', 'COGS', 'COGS'],
  ['5300', 'Support Compensation', 'COGS', 'COGS'],
  ['5310', 'Cloud Ops Compensation', 'COGS', 'COGS'],
  ['6000', 'Salaries & Wages', 'Opex', null],
  ['6020', 'Benefits', 'Opex', null],
  ['6030', 'Employer Taxes', 'Opex', null],
  ['6040', 'Contractors & Consulting', 'Opex', null],
  ['7000', 'Software & SaaS', 'Opex', null],
  ['7020', 'Marketing Programs', 'Opex', null],
  ['7030', 'Events & Conferences', 'Opex', null],
  ['7040', 'T&E - Travel', 'Opex', null],
  ['7050', 'T&E - Meals', 'Opex', null],
  ['7060', 'Recruiting', 'Opex', null],
  ['7070', 'Office & Facilities', 'Opex', null],
  ['7080', 'Professional Fees', 'Opex', null],
  ['7090', 'Insurance', 'Opex', null],
  ['7100', 'Training & Development', 'Opex', null],
  ['1100', 'Accounts Receivable', 'Asset', null],
  ['1200', 'Prepaid Expenses', 'Asset', null],
  ['2000', 'Accounts Payable', 'Liability', null],
  ['2100', 'Accrued Liabilities', 'Liability', null],
  ['2200', 'Deferred Revenue', 'Liability', null],
]

// wart: vendor name dupes intact, as loaded from AP
const VENDOR_SEED = [
  ['Amazon Web Services', 'Cloud Infrastructure'], ['AWS', 'Cloud Infrastructure'], ['Amazon Web Services, Inc.', 'Cloud Infrastructure'],
  ['Google Cloud', 'Cloud Infrastructure'], ['Google LLC', 'Cloud Infrastructure'],
  ['Snowflake Computing', 'Software & SaaS'], ['Datadog Inc', 'Software & SaaS'], ['Salesforce.com', 'Software & SaaS'],
  ['LinkedIn', 'Marketing Programs'], ['LinkedIn Corp', 'Marketing Programs'],
  ['Stripe Inc', 'Payment Processing'], ['Gusto', 'Software & SaaS'], ['Rippling', 'Software & SaaS'],
  ['Notion Labs', 'Software & SaaS'], ['Figma Inc', 'Software & SaaS'], ['Atlassian', 'Software & SaaS'],
  ['Slack Technologies', 'Software & SaaS'], ['Zoom Video', 'Software & SaaS'], ['DocuSign', 'Software & SaaS'],
  ['Industrious NYC', 'Facilities'], ['ConEd', 'Facilities'], ['Cushman & Wakefield', 'Facilities'],
  ['Delta Air Lines', 'T&E'], ['United Airlines', 'T&E'], ['Marriott', 'T&E'], ['Hilton Hotels', 'T&E'],
  ['Uber', 'T&E'], ['Lyft', 'T&E'], ['Sweetgreen', 'T&E'], ['Seamless', 'T&E'],
  ['Greenhouse Software', 'Recruiting'], ['Robert Half', 'Contractors'], ['Toptal', 'Contractors'],
  ['Ernst & Young', 'Professional Fees'], ['Gunderson Dettmer', 'Professional Fees'], ['Justworks', 'Software & SaaS'],
]

async function main() {
  const t0 = Date.now()
  const instance = await DuckDBInstance.create(':memory:')
  conn = await instance.connect()
  await run(`SELECT setseed(0.42)`)

  // ---------------- dims ----------------
  await run(`
    CREATE TABLE dim_date AS
    SELECT d::DATE AS date_day, year(d) AS year,
           year(d) || '-Q' || quarter(d) AS quarter,
           date_trunc('month', d)::DATE AS month_start,
           strftime(d, '%B') AS month_name, strftime(d, '%A') AS day_of_week,
           dayofweek(d) IN (0, 6) AS is_weekend, d = last_day(d) AS is_month_end
    FROM generate_series(DATE '2022-12-01', DATE '2026-12-31', INTERVAL 1 DAY) t(d)
  `)

  await run(`CREATE TABLE dim_department (dept_id VARCHAR, dept_name VARCHAR, cost_center_code VARCHAR, division VARCHAR, leader_name VARCHAR)`)
  await insertRows('dim_department', ['dept_id', 'dept_name', 'cost_center_code', 'division', 'leader_name'],
    DEPARTMENTS.map((d) => [S(d[0]), S(d[1]), S(d[2]), S(d[3]), S(d[4])]))

  await run(`CREATE TABLE dim_account (account_id VARCHAR, account_name VARCHAR, account_type VARCHAR, pl_line VARCHAR, is_pl BOOLEAN)`)
  await insertRows('dim_account', ['account_id', 'account_name', 'account_type', 'pl_line', 'is_pl'],
    ACCOUNTS.map((a) => [a[0], a[1], a[2], a[3] ?? null, a[2] === 'Revenue' || a[2] === 'COGS' || a[2] === 'Opex']))

  const CATEGORIES_EXTRA = ['Software & SaaS', 'Contractors', 'Marketing Programs', 'Facilities', 'T&E', 'Professional Fees', 'Recruiting', 'Insurance', 'Training']
  const VW1 = ['Hudson', 'Beacon', 'Cedar', 'Summit', 'Harbor', 'Vertex', 'Cobalt', 'Meridian', 'Juniper', 'Sterling', 'Atlas', 'Ridgeline', 'Fulton', 'Mercer', 'Bowery', 'Canal', 'Lafayette', 'Spring', 'Prince', 'Broome']
  const VW2 = ['Consulting', 'Partners', 'Group', 'Media', 'Labs', 'Services', 'Solutions', 'Agency', 'Collective', 'Associates', 'Systems', 'Ventures', 'Digital', 'Creative', 'Advisory']
  const vendors = VENDOR_SEED.map((v, i) => ({ id: `V-${String(i + 1).padStart(4, '0')}`, name: v[0], category: v[1] }))
  // walk the full name cross-product in shuffled order — finite by construction
  const vendorNames = []
  for (const w1 of VW1) for (const w2 of VW2) vendorNames.push(`${w1} ${w2}`)
  vendorNames.sort(() => rand() - 0.5)
  const seenV = new Set(vendors.map((v) => v.name))
  let vi = vendors.length
  for (const name of vendorNames) {
    if (vendors.length >= 320) break
    if (seenV.has(name)) continue
    seenV.add(name)
    vendors.push({ id: `V-${String(++vi).padStart(4, '0')}`, name, category: pick(CATEGORIES_EXTRA) })
  }
  await run(`CREATE TABLE dim_vendor (vendor_id VARCHAR, vendor_name VARCHAR, category VARCHAR, payment_terms VARCHAR)`)
  await insertRows('dim_vendor', ['vendor_id', 'vendor_name', 'category', 'payment_terms'],
    vendors.map((v) => [S(v.id), S(v.name), S(v.category), S(pick(['Net 30', 'Net 30', 'Net 45', 'Net 15', 'Due on receipt']))]))

  // =====================================================================
  // Customers + subscription lifecycle (the ARR spine)
  // =====================================================================
  const CW1 = ['Brightwell', 'Nomad', 'Lakeshore', 'Fernhill', 'Copperleaf', 'Bluestone', 'Harborview', 'Quillstone', 'Maplewood', 'Ironclad', 'Suncrest', 'Willowbrook', 'Stonebridge', 'Clearwater', 'Redwood', 'Silverline', 'Oakfield', 'Pinnacle', 'Fairmont', 'Greenline', 'Northgate', 'Eastwood', 'Westbrook', 'Southport', 'Ridgeway', 'Amberly', 'Crestline', 'Dovetail', 'Elmwood', 'Foxglove', 'Gladstone', 'Hollybrook', 'Ivyline', 'Kingsley', 'Larkspur', 'Monarch', 'Nightingale', 'Orchard', 'Pemberton', 'Quarry', 'Rosewood', 'Saltbox', 'Thornton', 'Underhill', 'Vantage', 'Wexford', 'Yellowbird', 'Zephyr', 'Alderman', 'Birchwood', 'Caldwell', 'Danforth', 'Eastman', 'Fairbanks', 'Galloway', 'Hartwell', 'Ingram', 'Jettison', 'Kestrel', 'Lockhart']
  const CW2 = ['Logistics', 'Health Collective', 'Analytics', 'Retail Group', 'Financial', 'Robotics', 'Media', 'Systems', 'Biosciences', 'Manufacturing', 'Insurance', 'Software', 'Foods', 'Energy', 'Mobility', 'Commerce', 'Studios', 'Networks', 'Labs', 'Therapeutics', 'Payments', 'Security', 'Freight', 'Marketplaces', 'Clinics', 'Hospitality', 'Education', 'Publishing', 'Apparel', 'Fitness', 'Diagnostics', 'Supply Co', 'Technologies', 'Partners', 'Brands']
  const INDUSTRIES = ['Software', 'Financial Services', 'Healthcare', 'Retail & E-commerce', 'Logistics', 'Media', 'Manufacturing', 'Insurance', 'Energy', 'Education', 'Hospitality', 'Biotech']
  const REGION_DEFS = [
    { region: 'AMER', p: 0.66, countries: ['United States', 'United States', 'United States', 'Canada'] },
    { region: 'EMEA', p: 0.24, countries: ['United Kingdom', 'Germany', 'France', 'Netherlands', 'Ireland'] },
    { region: 'APAC', p: 0.10, countries: ['Australia', 'Japan', 'Singapore'] },
  ]

  const N_CUSTOMERS = 9500
  const customers = []
  const movements = []
  const custARR = [] // Float64Array per customer over MONTHS
  const custPlan = []
  const seenC = new Set()

  for (let c = 0; c < N_CUSTOMERS; c++) {
    const id = `C-${String(c + 1).padStart(5, '0')}`
    // name pool is smaller than N_CUSTOMERS — fall through suffix tiers, then a
    // guaranteed-unique counter so this can never loop forever.
    let name = `${pick(CW1)} ${pick(CW2)}`
    if (seenC.has(name)) {
      const QUALS = ['Co', 'Inc', 'Corp', 'USA', 'International', 'Global', 'North', 'Digital', 'NYC', 'West', 'Online', 'Group', 'Holdings', 'East', 'Labs Inc']
      const base = name
      for (let q = 0; q < QUALS.length && seenC.has(name); q++) name = `${base} ${QUALS[(c + q) % QUALS.length]}`
      if (seenC.has(name)) name = `${base} ${QUALS[c % QUALS.length]} ${QUALS[(c * 7 + 3) % QUALS.length]}`
      if (seenC.has(name)) name = `${base} No. ${1 + (c % 97)}`
    }
    seenC.add(name)
    const rr = rand()
    const regionDef = rr < 0.66 ? REGION_DEFS[0] : rr < 0.90 ? REGION_DEFS[1] : REGION_DEFS[2]
    const pr = rand()
    const planKind = pr < 0.76 ? 'starter' : pr < 0.96 ? 'growth' : 'ent'
    const planName = planKind === 'starter' ? 'Starter' : planKind === 'growth' ? 'Growth' : 'Enterprise'
    const startIdx = Math.min(MONTHS.length - 1, Math.floor(Math.pow(rand(), 0.60) * MONTHS.length))
    const firstDate = midMonthDay(MONTHS[startIdx], ri(1, 26))

    let arr
    if (planKind === 'starter') arr = 99 * 12
    else if (planKind === 'growth') arr = 55 * 12 * ri(4, 28)
    else arr = rf(45000, 260000)
    arr = money(arr)

    const arrByMonth = new Float64Array(MONTHS.length)
    let cur = arr
    movements.push({ date: firstDate, cust: id, plan: planName, type: 'new', delta: cur, before: 0, after: cur })
    let churned = false
    let churnIdx = -1
    for (let m = startIdx; m < MONTHS.length; m++) {
      if (churned) break
      arrByMonth[m] = cur
      if (m === startIdx) continue
      const pChurn = planKind === 'starter' ? 0.045 : planKind === 'growth' ? 0.018 : 0.007
      const pExpand = planKind === 'starter' ? 0.005 : planKind === 'growth' ? 0.030 : 0.026
      const pContract = planKind === 'starter' ? 0 : planKind === 'growth' ? 0.012 : 0.009
      const ev = rand()
      const evDate = midMonthDay(MONTHS[m], ri(2, 27))
      if (ev < pChurn) {
        movements.push({ date: evDate, cust: id, plan: planName, type: 'churn', delta: -cur, before: cur, after: 0 })
        cur = 0; churned = true; churnIdx = m; arrByMonth[m] = 0
      } else if (ev < pChurn + pExpand) {
        const inc = money(planKind === 'starter' ? cur * 0.25 : cur * rf(0.08, 0.35))
        if (inc > 0.01) {
          movements.push({ date: evDate, cust: id, plan: planName, type: 'expansion', delta: inc, before: cur, after: money(cur + inc) })
          cur = money(cur + inc); arrByMonth[m] = cur
        }
      } else if (ev < pChurn + pExpand + pContract) {
        const dec = money(cur * rf(0.08, 0.25))
        movements.push({ date: evDate, cust: id, plan: planName, type: 'contraction', delta: -dec, before: cur, after: money(cur - dec) })
        cur = money(cur - dec); arrByMonth[m] = cur
      }
    }
    if (churned && churnIdx < MONTHS.length - 8 && rand() < 0.06) {
      const backIdx = churnIdx + ri(3, 6)
      const backARR = money(arr * rf(0.6, 1.1))
      movements.push({ date: midMonthDay(MONTHS[backIdx], ri(2, 27)), cust: id, plan: planName, type: 'reactivation', delta: backARR, before: 0, after: backARR })
      for (let m = backIdx; m < MONTHS.length; m++) arrByMonth[m] = backARR
    }

    const peak = Math.max(...arrByMonth, arr)
    const segment = peak >= 50000 ? 'Enterprise' : peak >= 12000 ? 'Mid-Market' : 'SMB'
    customers.push({ id, name, segment, industry: pick(INDUSTRIES), region: regionDef.region, country: pick(regionDef.countries), firstDate, plan: planName })
    custARR.push(arrByMonth)
    custPlan.push(planName)
  }

  await run(`CREATE TABLE dim_customer (customer_id VARCHAR, customer_name VARCHAR, segment VARCHAR, industry VARCHAR, region VARCHAR, billing_country VARCHAR, first_contract_date DATE, crm_account_id VARCHAR)`)
  await insertRows('dim_customer', ['customer_id', 'customer_name', 'segment', 'industry', 'region', 'billing_country', 'first_contract_date', 'crm_account_id'],
    customers.map((c, i) => [S(c.id), S(c.name), S(c.segment), S(c.industry), S(c.region), S(c.country), D(c.firstDate), S(`006${String(900000 + i)}`)]))

  await run(`CREATE TABLE fct_arr_movements (movement_id BIGINT, event_date DATE, customer_id VARCHAR, plan_name VARCHAR, movement_type VARCHAR, arr_delta_usd DOUBLE, arr_before_usd DOUBLE, arr_after_usd DOUBLE)`)
  movements.sort((a, b) => a.date - b.date || (a.cust < b.cust ? -1 : 1))
  await insertRows('fct_arr_movements', ['movement_id', 'event_date', 'customer_id', 'plan_name', 'movement_type', 'arr_delta_usd', 'arr_before_usd', 'arr_after_usd'],
    movements.map((m, i) => [N(i + 1), D(m.date), S(m.cust), S(m.plan), S(m.type), N(money(m.delta)), N(money(m.before)), N(money(m.after))]))

  // snapshots: active customer-months only, mart window only; ARR is post-event state.
  const snapRows = []
  for (let ci = 0; ci < customers.length; ci++) {
    const a = custARR[ci]
    const plan = custPlan[ci]
    for (let m = MART_M0; m < MONTHS.length; m++) {
      if (a[m] <= 0) continue
      const seats = plan === 'Growth' ? Math.max(1, Math.round(a[m] / (55 * 12))) : plan === 'Enterprise' ? 20 + ((ci * 37) % 180) : 1 + (ci % 5)
      snapRows.push([D(MONTHS[m]), S(customers[ci].id), S(plan), N(seats), N(money(a[m]))])
    }
  }
  await run(`CREATE TABLE fct_subscription_snapshot_monthly (month_start DATE, customer_id VARCHAR, plan_name VARCHAR, seats INT, arr_usd DOUBLE)`)
  await insertRows('fct_subscription_snapshot_monthly', ['month_start', 'customer_id', 'plan_name', 'seats', 'arr_usd'], snapRows)
  console.log(`customers=${customers.length} movements=${movements.length} snapshots=${snapRows.length} (${((Date.now() - t0) / 1000).toFixed(1)}s)`)

  // =====================================================================
  // Employees + payroll (mart window only)
  // =====================================================================
  const FIRST = ['Ava', 'Liam', 'Maya', 'Noah', 'Zoe', 'Ethan', 'Isla', 'Lucas', 'Nina', 'Owen', 'Priya', 'Marcus', 'Sofia', 'Diego', 'Hana', 'Omar', 'Lena', 'Kai', 'Ruth', 'Sam', 'Tara', 'Victor', 'Wren', 'Yusuf', 'Elena', 'Jonah', 'Keira', 'Malik', 'Nora', 'Theo', 'Imani', 'Felix', 'Grace', 'Hugo', 'Ivy', 'Jasper', 'Layla', 'Miles', 'Naomi', 'Oscar']
  const LAST = ['Alvarez', 'Brooks', 'Chen', 'Dawson', 'Ellis', 'Fischer', 'Garcia', 'Huang', 'Ibrahim', 'Johnson', 'Kowalski', 'Lindqvist', 'Moreau', 'Nakamura', 'Obi', 'Park', 'Quinn', 'Rossi', 'Singh', 'Thompson', 'Ueda', 'Volkov', 'Walsh', 'Xu', 'Yilmaz', 'Zhang', 'Adeyemi', 'Bianchi', 'Costa', 'Duarte', 'Eriksen', 'Fontaine', 'Gallo', 'Haddad', 'Iyer', 'Jensen', 'Khan', 'Larsen', "O'Brien", 'Petrov']
  const LEVELS = [
    { lv: 'IC1', base: [72000, 95000], w: 0.10 }, { lv: 'IC2', base: [90000, 125000], w: 0.22 },
    { lv: 'IC3', base: [115000, 160000], w: 0.26 }, { lv: 'IC4', base: [145000, 200000], w: 0.16 },
    { lv: 'IC5', base: [180000, 250000], w: 0.08 }, { lv: 'M1', base: [150000, 210000], w: 0.10 },
    { lv: 'M2', base: [185000, 250000], w: 0.05 }, { lv: 'D1', base: [220000, 300000], w: 0.02 }, { lv: 'VP', base: [260000, 380000], w: 0.01 },
  ]
  const DEPT_MIX = [
    ['D-ENG-01', 0.23], ['D-ENG-02', 0.07], ['D-PRD-01', 0.05], ['D-DSN-01', 0.03], ['D-DAT-01', 0.04],
    ['D-SAL-01', 0.10], ['D-SAL-02', 0.07], ['D-SAL-03', 0.06], ['D-SOL-01', 0.04], ['D-MKT-01', 0.07],
    ['D-CSM-01', 0.08], ['D-SUP-01', 0.06], ['D-OPS-01', 0.03],
    ['D-GA-01', 0.025], ['D-GA-02', 0.02], ['D-GA-03', 0.01], ['D-GA-04', 0.02], ['D-GA-05', 0.01], ['D-EXEC-01', 0.005],
  ]
  const pickDept = () => {
    const r = rand(); let acc = 0
    for (const [d, w] of DEPT_MIX) { acc += w; if (r < acc) return d }
    return 'D-ENG-01'
  }
  const TITLES = {
    'D-ENG-01': ['Software Engineer', 'Senior Software Engineer', 'Staff Engineer', 'Engineering Manager'],
    'D-ENG-02': ['Infrastructure Engineer', 'Site Reliability Engineer', 'Senior SRE'], 'D-PRD-01': ['Product Manager', 'Senior Product Manager', 'Group PM'],
    'D-DSN-01': ['Product Designer', 'Senior Designer'], 'D-DAT-01': ['Data Analyst', 'Analytics Engineer', 'Data Scientist'],
    'D-SAL-01': ['Enterprise Account Executive', 'Strategic Account Executive'], 'D-SAL-02': ['Account Executive', 'Senior Account Executive'],
    'D-SAL-03': ['Sales Development Rep', 'SDR Team Lead'], 'D-SOL-01': ['Solutions Engineer', 'Senior Solutions Engineer'],
    'D-MKT-01': ['Marketing Manager', 'Content Lead', 'Growth Marketer', 'Brand Designer'],
    'D-CSM-01': ['Customer Success Manager', 'Senior CSM'], 'D-SUP-01': ['Support Engineer', 'Senior Support Engineer'],
    'D-OPS-01': ['Cloud Operations Engineer'], 'D-GA-01': ['Financial Analyst', 'Senior Accountant', 'Controller'],
    'D-GA-02': ['People Partner', 'Recruiter'], 'D-GA-03': ['Counsel', 'Paralegal'], 'D-GA-04': ['IT Engineer', 'Security Engineer'],
    'D-GA-05': ['Workplace Manager'], 'D-EXEC-01': ['Chief of Staff', 'Executive Assistant'],
  }
  const N_EMP = 1000
  const employees = []
  const seenE = new Set()
  for (let e = 0; e < N_EMP; e++) {
    const id = `E-${String(e + 1).padStart(4, '0')}`
    let nm = `${pick(FIRST)} ${pick(LAST)}`
    if (seenE.has(nm)) nm = `${pick(FIRST)} ${pick(LAST)}`
    if (seenE.has(nm)) nm = `${nm} ${['Jr', 'II', 'III'][e % 3]}`
    if (seenE.has(nm)) nm = `${nm} ${e + 1}`
    seenE.add(nm)
    const dept = pickDept()
    const hire = midMonthDay(new Date(Date.UTC(2020, 6 + Math.floor(Math.pow(rand(), 0.72) * 70), 1)), ri(1, 26))
    const lr = rand(); let acc = 0; let level = LEVELS[2]
    for (const L of LEVELS) { acc += L.w; if (lr < acc) { level = L; break } }
    const base = money(rf(level.base[0], level.base[1]))
    const isSales = dept.startsWith('D-SAL') || dept === 'D-SOL-01'
    const commissionRate = isSales ? rf(0.25, 0.45) : 0
    const bonusRate = isSales ? 0.02 : /^(M|D|V)/.test(level.lv) ? rf(0.10, 0.2) : rf(0.05, 0.1)
    const div = DEPARTMENTS.find((d) => d[0] === dept)[3]
    let term = null
    let cursor = new Date(hire)
    while (cursor < END) {
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 15))
      if (cursor > END) break
      const ms = iso(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1)))
      let p = 0.014
      if (ms === '2023-11-01' && div === 'S&M') p = 0.16 // the 2023 efficiency push
      if (rand() < p) { term = midMonthDay(cursor, ri(3, 26)); break }
    }
    const location = pick(['New York', 'New York', 'New York', 'Remote - US', 'Remote - US', 'Dublin', 'London', 'Sydney'])
    employees.push({ id, nm, title: pick(TITLES[dept]), level: level.lv, dept, location, type: rand() < 0.06 ? 'Contractor' : 'FTE', hire, term, base, bonusRate, commissionRate })
  }
  await run(`CREATE TABLE dim_employee (employee_id VARCHAR, full_name VARCHAR, title VARCHAR, level VARCHAR, dept_id VARCHAR, location VARCHAR, employment_type VARCHAR, hire_date DATE, termination_date DATE, manager_employee_id VARCHAR)`)
  await insertRows('dim_employee', ['employee_id', 'full_name', 'title', 'level', 'dept_id', 'location', 'employment_type', 'hire_date', 'termination_date', 'manager_employee_id'],
    employees.map((e, i) => [e.id, e.nm, e.title, e.level, e.dept, e.location, e.type, e.hire, e.term ?? null, i > 20 ? employees[i % 20].id : null]))

  const payRows = []
  for (const e of employees) {
    for (let m = MART_M0; m < MONTHS.length; m++) {
      const ms = MONTHS[m]
      const mEnd = new Date(Date.UTC(ms.getUTCFullYear(), ms.getUTCMonth() + 1, 0))
      if (e.hire > mEnd) continue
      if (e.term && e.term < ms) continue
      const monthlyBase = e.base / 12
      const bonus = ms.getUTCMonth() === 2 ? e.base * e.bonusRate : 0
      const commission = e.commissionRate > 0 ? monthlyBase * e.commissionRate * (0.5 + rand()) : 0
      const benefits = monthlyBase * 0.11
      const taxes = (monthlyBase + bonus + commission) * 0.085
      payRows.push([D(ms), S(e.id), S(e.dept), N(money(monthlyBase)), N(money(bonus)), N(money(commission)), N(money(benefits)), N(money(taxes)), N(money(monthlyBase + bonus + commission + benefits + taxes))])
    }
  }
  await run(`CREATE TABLE fct_payroll_monthly (payroll_month DATE, employee_id VARCHAR, dept_id VARCHAR, base_pay_usd DOUBLE, bonus_usd DOUBLE, commission_usd DOUBLE, benefits_usd DOUBLE, employer_taxes_usd DOUBLE, total_comp_usd DOUBLE)`)
  await insertRows('fct_payroll_monthly', ['payroll_month', 'employee_id', 'dept_id', 'base_pay_usd', 'bonus_usd', 'commission_usd', 'benefits_usd', 'employer_taxes_usd', 'total_comp_usd'], payRows)

  // stg_customer_csm_assignments — the fan-out trap + QUALIFY latest-record table.
  // Customers get 1-4 CSM assignments over time; only the latest is current.
  // Latest assignments must point at CSMs who still work here — a "current book of
  // business" owned 37% by terminated people failed the FP&A-skeptic audit.
  const activeCsmNames = employees.filter((e) => e.dept === 'D-CSM-01' && !e.term).map((e) => e.nm)
  const anyCsmNames = employees.filter((e) => e.dept === 'D-CSM-01').map((e) => e.nm)
  const csmRows = []
  for (let ci = 0; ci < customers.length; ci++) {
    if (custPlan[ci] === 'Starter' && ci % 3 !== 0) continue // most Starters unmanaged
    const n = custPlan[ci] === 'Enterprise' ? ri(2, 4) : ri(1, 3)
    // precompute assignment dates so we know which one is truly last (in-window)
    const dates = []
    let base = new Date(Math.max(customers[ci].firstDate.getTime(), MART_START.getTime()))
    for (let k = 0; k < n && base <= END; k++) {
      dates.push(base)
      base = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + ri(3, 11), ri(1, 26)))
    }
    dates.forEach((d, k) => {
      const pool = k === dates.length - 1 ? activeCsmNames : anyCsmNames
      csmRows.push([S(customers[ci].id), S(pool[(ci * 7 + k * 13) % pool.length]), D(d), S(k === 0 ? 'initial assignment' : pick(['book rebalance', 'territory change', 'CSM departure', 'segment upgrade']))])
    })
  }
  await run(`CREATE TABLE stg_customer_csm_assignments (customer_id VARCHAR, csm_name VARCHAR, assigned_on DATE, assignment_reason VARCHAR)`)
  await insertRows('stg_customer_csm_assignments', ['customer_id', 'csm_name', 'assigned_on', 'assignment_reason'], csmRows)
  console.log(`employees=${employees.length} payroll=${payRows.length} csm_assignments=${csmRows.length} (${((Date.now() - t0) / 1000).toFixed(1)}s)`)

  // =====================================================================
  // GL — the 2.4M-row hero
  // =====================================================================
  await run(`
    CREATE TABLE fct_gl_transactions (
      txn_id BIGINT, je_id VARCHAR, txn_date DATE, posted_at DATE,
      account_id VARCHAR, dept_id VARCHAR, vendor_id VARCHAR, customer_id VARCHAR,
      memo VARCHAR, amount DOUBLE, source_system VARCHAR
    )`)

  // 4a. Subscription revenue: one line per active customer-month (Stripe for
  // Starter/Growth, NetSuite invoice rev-rec for Enterprise), on the customer's billing day.
  await run(`
    INSERT INTO fct_gl_transactions
    SELECT
      row_number() OVER () AS txn_id,
      'JE-' || strftime(s.month_start, '%Y') || '-' || lpad(((hash(s.customer_id || s.month_start::VARCHAR) % 90000000) + 10000000)::VARCHAR, 8, '0'),
      s.month_start + INTERVAL ((hash(s.customer_id) % 26)::INT) DAY,
      s.month_start + INTERVAL ((hash(s.customer_id) % 26)::INT) DAY,
      '4000', NULL, NULL, s.customer_id,
      CASE WHEN s.plan_name = 'Enterprise' THEN 'Enterprise subscription revenue - ' || strftime(s.month_start, '%b %Y')
           ELSE 'Stripe subscription - ' || s.plan_name || ' - ' || strftime(s.month_start, '%b %Y') END,
      round(s.arr_usd / 12.0, 2),
      CASE WHEN s.plan_name = 'Enterprise' THEN 'NetSuite' ELSE 'Stripe' END
    FROM fct_subscription_snapshot_monthly s
  `)

  // 4b. Metered usage revenue: daily calendar-date lines for Growth + Enterprise —
  // Star67 meters pipeline-observability events and books recognized usage revenue daily.
  // This is the volume engine that makes the GL bigger than Excel's ceiling.
  await run(`
    INSERT INTO fct_gl_transactions
    WITH days AS (
      SELECT date_day, month_start FROM dim_date
      WHERE date_day BETWEEN DATE '2023-01-01' AND DATE '2026-06-30'
    ), kinds AS (
      -- Both plans carry separate event-volume and compute-credit labels each day.
      SELECT * FROM (VALUES
        ('Growth', 'Metered usage revenue - events processed', 0.70),
        ('Growth', 'Metered usage revenue - compute credits', 0.30),
        ('Enterprise', 'Metered usage revenue - events processed', 0.62),
        ('Enterprise', 'Metered usage revenue - compute credits', 0.38)
      ) k(plan_name, memo, share)
    )
    SELECT
      (SELECT max(txn_id) FROM fct_gl_transactions) + row_number() OVER (),
      'JE-' || strftime(d.date_day, '%Y') || '-U' || lpad(((hash(s.customer_id || k.memo || d.date_day::VARCHAR) % 90000000) + 10000000)::VARCHAR, 8, '0'),
      d.date_day,
      d.date_day,
      '4010', NULL, NULL, s.customer_id,
      k.memo,
      round(s.arr_usd / 12.0 * 0.22 * k.share / 30.4 * (0.55 + (hash(s.customer_id || k.memo || d.date_day::VARCHAR) % 90) / 100.0), 2),
      'NetSuite'
    FROM fct_subscription_snapshot_monthly s
    JOIN days d ON d.month_start = s.month_start
    JOIN kinds k ON k.plan_name = s.plan_name
    WHERE s.plan_name IN ('Growth', 'Enterprise')
  `)

  // 4c. Stripe processing fees (COGS) on self-serve subscription charges (~60%)
  await run(`
    INSERT INTO fct_gl_transactions
    SELECT
      (SELECT max(txn_id) FROM fct_gl_transactions) + row_number() OVER (),
      je_id, txn_date, txn_date, '5010', 'D-OPS-01', 'V-0011', customer_id,
      'Stripe processing fees', round(amount * 0.029, 2), 'Stripe'
    FROM fct_gl_transactions
    WHERE source_system = 'Stripe' AND account_id = '4000' AND (hash(je_id) % 10) < 6
  `)

  // 4d. Payroll GL (from payroll fact, per dept-month; support/cloud-ops wages land in COGS)
  await run(`
    INSERT INTO fct_gl_transactions
    WITH agg AS (
      SELECT payroll_month, dept_id,
             round(sum(base_pay_usd + bonus_usd + commission_usd), 2) AS wages,
             round(sum(benefits_usd), 2) AS benefits,
             round(sum(employer_taxes_usd), 2) AS taxes
      FROM fct_payroll_monthly GROUP BY 1, 2
    ), unp AS (
      SELECT payroll_month, dept_id, kind, amt FROM agg UNPIVOT (amt FOR kind IN (wages, benefits, taxes))
    )
    SELECT
      (SELECT max(txn_id) FROM fct_gl_transactions) + row_number() OVER (),
      'JE-' || strftime(payroll_month, '%Y') || '-PR' || lpad((row_number() OVER ())::VARCHAR, 6, '0'),
      last_day(payroll_month),
      last_day(payroll_month),
      CASE kind WHEN 'wages' THEN CASE WHEN dept_id = 'D-SUP-01' THEN '5300' WHEN dept_id = 'D-OPS-01' THEN '5310' ELSE '6000' END
                WHEN 'benefits' THEN '6020' ELSE '6030' END,
      dept_id, NULL, NULL,
      'Payroll allocation - ' || kind || ' - ' || strftime(payroll_month, '%b %Y'),
      amt, 'Payroll'
    FROM unp WHERE amt > 0
  `)

  // 4e. Vendor opex (AP) + T&E, scaled by company growth
  const apDrivers = []
  for (const v of vendors) {
    const cat = v.category
    const active = cat === 'Cloud Infrastructure' || cat === 'T&E' ? true : rand() < (cat === 'Software & SaaS' ? 0.7 : 0.45)
    if (!active) continue
    let linesPM, amtLo, amtHi, account, depts
    if (cat === 'Cloud Infrastructure') {
      linesPM = v.id === 'V-0001' ? 26 : v.id === 'V-0002' ? 9 : v.id === 'V-0003' ? 5 : ri(6, 14)
      amtLo = 1800; amtHi = 42000; account = '5000'; depts = ['D-OPS-01']
    } else if (cat === 'Software & SaaS') { linesPM = ri(1, 3); amtLo = 300; amtHi = 22000; account = '7000'; depts = ['D-ENG-01', 'D-GA-04', 'D-DAT-01', 'D-MKT-01', 'D-CSM-01', 'D-GA-01', 'D-PRD-01'] }
    else if (cat === 'T&E') { linesPM = ri(14, 45); amtLo = 22; amtHi = 2600; account = rand() < 0.6 ? '7040' : '7050'; depts = ['D-SAL-01', 'D-SAL-02', 'D-SAL-03', 'D-MKT-01', 'D-ENG-01', 'D-CSM-01', 'D-EXEC-01', 'D-SOL-01'] }
    else if (cat === 'Marketing Programs') { linesPM = ri(2, 8); amtLo = 900; amtHi = 60000; account = '7020'; depts = ['D-MKT-01'] }
    else if (cat === 'Facilities') { linesPM = ri(1, 4); amtLo = 1200; amtHi = 48000; account = '7070'; depts = ['D-GA-05'] }
    else if (cat === 'Contractors') { linesPM = ri(1, 5); amtLo = 4000; amtHi = 32000; account = '6040'; depts = ['D-ENG-01', 'D-DSN-01', 'D-MKT-01', 'D-DAT-01'] }
    else if (cat === 'Professional Fees') { linesPM = ri(1, 3); amtLo = 2500; amtHi = 68000; account = '7080'; depts = ['D-GA-01', 'D-GA-03'] }
    else if (cat === 'Recruiting') { linesPM = ri(1, 6); amtLo = 800; amtHi = 28000; account = '7060'; depts = ['D-GA-02'] }
    else if (cat === 'Payment Processing') { continue } // Stripe fees generated in 4c
    else { linesPM = ri(1, 3); amtLo = 200; amtHi = 9000; account = pick(['7030', '7090', '7100']); depts = ['D-GA-02', 'D-MKT-01', 'D-GA-05'] }
    apDrivers.push({ id: v.id, name: v.name, cat, startM: ri(0, 20), linesPM, amtLo, amtHi, account, depts })
  }
  await run(`CREATE TABLE _ap (vendor_id VARCHAR, vendor_name VARCHAR, category VARCHAR, start_m INT, lines_pm INT, amt_lo DOUBLE, amt_hi DOUBLE, account_id VARCHAR, depts VARCHAR[])`)
  // small table with a list column — plain VALUES is fine at this size
  for (let i = 0; i < apDrivers.length; i += 200) {
    const chunk = apDrivers.slice(i, i + 200)
    const values = chunk.map((d) =>
      `('${d.id}','${esc(d.name)}','${esc(d.cat)}',${d.startM},${d.linesPM},${d.amtLo},${d.amtHi},'${d.account}',[${d.depts.map((x) => `'${x}'`).join(',')}])`
    ).join(',')
    await run(`INSERT INTO _ap VALUES ${values}`)
  }

  await run(`
    INSERT INTO fct_gl_transactions
    WITH months AS (
      SELECT month_start, row_number() OVER (ORDER BY month_start) - 1 AS mi
      FROM (SELECT DISTINCT month_start FROM dim_date WHERE month_start BETWEEN DATE '2023-01-01' AND DATE '2026-06-01')
    ), expanded AS (
      SELECT a.*, m.month_start, m.mi,
             greatest(1, round(a.lines_pm * (0.45 + 0.55 * power(m.mi / 41.0, 1.15)))::INT) AS n_lines
      FROM _ap a JOIN months m ON m.mi >= a.start_m
    ), lines AS (
      SELECT e.*, hash(e.vendor_id || e.month_start::VARCHAR || u.r::VARCHAR) AS h
      FROM expanded e, LATERAL (SELECT unnest(range(e.n_lines)) AS r) u
    )
    SELECT
      (SELECT max(txn_id) FROM fct_gl_transactions) + row_number() OVER (),
      'JE-' || strftime(month_start, '%Y') || '-AP' || lpad(((h % 90000000) + 10000000)::VARCHAR, 8, '0'),
      month_start + INTERVAL ((h % 27)::INT) DAY,
      month_start + INTERVAL ((h % 27)::INT) DAY,
      account_id,
      depts[1 + (h % len(depts))::INT],
      vendor_id, NULL,
      category || ' - ' || vendor_name,
      round((amt_lo + (h % 1000) / 999.0 * (amt_hi - amt_lo)) * (0.55 + 0.75 * power(mi / 41.0, 1.1)), 2),
      CASE WHEN category = 'T&E' THEN 'Expensify' ELSE 'NetSuite' END
    FROM lines
  `)
  await run(`DROP TABLE _ap`)

  // 4f. Month-end accruals + balance-sheet noise (teaches the is_pl filter)
  await run(`
    INSERT INTO fct_gl_transactions
    WITH months AS (SELECT DISTINCT month_start FROM dim_date WHERE month_start BETWEEN DATE '2023-01-01' AND DATE '2026-06-01'),
    lines AS (SELECT month_start, unnest(range(12)) AS r, hash(month_start::VARCHAR || unnest(range(12))::VARCHAR) AS h FROM months)
    SELECT
      (SELECT max(txn_id) FROM fct_gl_transactions) + row_number() OVER (),
      'JE-' || strftime(month_start, '%Y') || '-MJ' || lpad(((h % 90000) + 10000)::VARCHAR, 5, '0'),
      last_day(month_start),
      last_day(month_start),
      ['1100', '1200', '2000', '2100', '2200', '2100', '2200'][1 + (h % 7)::INT],
      NULL, NULL, NULL,
      ['Month-end accrual', 'Deferred revenue adjustment', 'AR reclass', 'Prepaid amortization', 'Accrued bonus true-up'][1 + (h % 5)::INT],
      round((h % 240000) / 10.0 - 12000, 2),
      'ManualJE'
    FROM lines
  `)

  // 4g. WART: duplicate Stripe load, March 2024 (finance-systems migration re-posted
  // a batch of self-serve revenue: same je_id/memo/amount, new txn_id).
  await run(`
    INSERT INTO fct_gl_transactions
    SELECT
      (SELECT max(txn_id) FROM fct_gl_transactions) + row_number() OVER (),
      je_id, txn_date, txn_date, account_id, dept_id, vendor_id, customer_id, memo, amount, source_system
    FROM fct_gl_transactions
    WHERE source_system = 'Stripe' AND account_id = '4000'
      AND txn_date BETWEEN DATE '2024-03-01' AND DATE '2024-03-31'
      AND (hash(je_id || 'dup') % 100) < 78
  `)

  // =====================================================================
  // Budget (from actuals × plan factor; FY2025 Plan CLEAN names, Reforecast DIRTY)
  // =====================================================================
  await run(`
    CREATE TABLE fct_budget AS
    WITH actuals AS (
      SELECT date_trunc('month', g.txn_date)::DATE AS fiscal_month, g.account_id,
             COALESCE(g.dept_id, 'D-OPS-01') AS dept_id,
             -- GL amounts are cents, but the source column is DOUBLE for browser
             -- ergonomics. Cast before aggregating so parallel scan order cannot
             -- move a budget or its grading oracle by a penny between builds.
             sum(CAST(g.amount AS DECIMAL(18, 2))) AS actual_usd
      -- dedupe first: the FY plans must be derived from TRUE actuals, or the
      -- budget would quietly "plan for" the Mar-2024 duplicate Stripe load
      FROM (SELECT * FROM fct_gl_transactions
            QUALIFY row_number() OVER (PARTITION BY je_id, memo, amount, account_id ORDER BY txn_id) = 1) g
      JOIN dim_account a USING (account_id)
      WHERE a.account_type IN ('Revenue', 'COGS', 'Opex')
      GROUP BY 1, 2, 3
    ), versions AS (
      SELECT * FROM (VALUES
        ('FY2024 Plan', DATE '2024-01-01', DATE '2024-12-01', false),
        ('FY2025 Plan', DATE '2025-01-01', DATE '2025-12-01', false),
        ('FY2025 Q2 Reforecast', DATE '2025-04-01', DATE '2025-12-01', true),
        ('FY2026 Plan', DATE '2026-01-01', DATE '2026-12-01', false)
      ) v(version_name, from_m, to_m, dirty)
    )
    SELECT
      row_number() OVER (
        ORDER BY v.version_name, a.fiscal_month, a.account_id, a.dept_id
      ) AS budget_id,
      v.version_name,
      a.fiscal_month,
      a.account_id,
      CASE WHEN v.dirty THEN
        CASE ((hash(a.dept_id || a.account_id || v.version_name)) % 6)
          WHEN 0 THEN upper(dd.dept_name)
          WHEN 1 THEN lower(dd.dept_name)
          WHEN 2 THEN dd.dept_name || ' '
          WHEN 3 THEN ' ' || dd.dept_name
          WHEN 4 THEN upper(left(dd.dept_name, 1)) || lower(substr(dd.dept_name, 2))
          ELSE dd.dept_name
        END
      ELSE dd.dept_name END AS dept_name_raw,
      round(a.actual_usd * CAST((
        CASE
          WHEN v.version_name = 'FY2025 Plan' AND a.dept_id = 'D-SAL-01' AND a.fiscal_month BETWEEN DATE '2025-04-01' AND DATE '2025-06-01' THEN 0.84
          WHEN v.version_name = 'FY2025 Plan' AND a.account_id = '7020' AND a.fiscal_month BETWEEN DATE '2025-04-01' AND DATE '2025-06-01' THEN 0.80
          ELSE 0.90 + ((hash(a.account_id || a.dept_id || v.version_name) % 19) / 100.0)
        END) AS DECIMAL(6, 4)), 2) AS amount_usd
    FROM actuals a
    JOIN versions v ON a.fiscal_month BETWEEN v.from_m AND v.to_m
    JOIN dim_department dd ON dd.dept_id = a.dept_id
    WHERE a.fiscal_month <= DATE '2026-06-01'
      -- Data & Analytics was spun out of Engineering AFTER the FY2025 plan was
      -- locked: it has real spend but no FY2025 Plan budget line. This is the
      -- LEFT JOIN + COALESCE lesson (mission m09) — an INNER JOIN silently drops
      -- the very department a variance review exists to catch.
      AND NOT (v.version_name = 'FY2025 Plan' AND a.dept_id = 'D-DAT-01')
    ORDER BY v.version_name, a.fiscal_month, a.account_id, a.dept_id
  `)

  // 4h. WART: January was closed and the board deck locked on February 5.
  // Finance posted this net-zero cloud-cost reclass on February 12. Keeping the
  // accounting date distinct from the warehouse posting date makes the old deck
  // reproducible without changing the budget that was built from pre-close data.
  await run(`
    INSERT INTO fct_gl_transactions
    SELECT
      (SELECT max(txn_id) FROM fct_gl_transactions) + row_number() OVER (),
      je_id, txn_date, posted_at, account_id, dept_id, vendor_id, customer_id,
      memo, amount, source_system
    FROM (VALUES
      ('JE-2026-ADJ-000001', DATE '2026-01-31', DATE '2026-02-12', '5000', 'D-OPS-01', 'V-0002', NULL, 'Late cloud-cost reclass posted after board deck', 185000.00, 'ManualJE'),
      ('JE-2026-ADJ-000001', DATE '2026-01-31', DATE '2026-02-12', '7000', 'D-ENG-01', 'V-0002', NULL, 'Late cloud-cost reclass posted after board deck', -185000.00, 'ManualJE')
    ) v(je_id, txn_date, posted_at, account_id, dept_id, vendor_id, customer_id, memo, amount, source_system)
  `)

  const glCount = await countOf('fct_gl_transactions')
  console.log(`GL lines=${glCount} (${((Date.now() - t0) / 1000).toFixed(1)}s)`)

  // =====================================================================
  // Export + manifest + sanity
  // =====================================================================
  const TABLES = ['dim_date', 'dim_department', 'dim_account', 'dim_customer', 'dim_vendor', 'dim_employee', 'fct_gl_transactions', 'fct_budget', 'fct_arr_movements', 'fct_subscription_snapshot_monthly', 'fct_payroll_monthly', 'stg_customer_csm_assignments']
  const manifest = { generated_at: '2026-07-11T00:00:00Z', company: 'Star67', tables: {} }
  let totalBytes = 0
  for (const t of TABLES) {
    const stableOrder = t === 'fct_budget' ? ' ORDER BY budget_id' : ''
    await run(`COPY (SELECT * FROM ${t}${stableOrder}) TO '${OUT}/${t}.parquet' (FORMAT PARQUET, COMPRESSION ZSTD)`)
    const bytes = statSync(`${OUT}/${t}.parquet`).size
    totalBytes += bytes
    manifest.tables[t] = { rows: await countOf(t), bytes }
  }
  manifest.total_rows = Object.values(manifest.tables).reduce((a, b) => a + b.rows, 0)
  manifest.total_bytes = totalBytes

  // sanity + tie-out assertions (fail closed — the data must tie before it ships)
  const sanity = {}
  sanity.arr_end = await scalar(`SELECT round(sum(arr_usd), 0) FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'`)
  sanity.active_customers_end = await scalar(`SELECT count(*) FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'`)
  sanity.headcount_end = await scalar(`SELECT count(*) FROM fct_payroll_monthly WHERE payroll_month = DATE '2026-06-01'`)
  sanity.revenue_2025 = await scalar(`SELECT round(sum(amount), 0) FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND year(txn_date) = 2025`)
  sanity.dup_stripe_mar24_overstatement = await scalar(`
    SELECT round(sum(amount), 0) FROM (
      SELECT je_id, memo, amount, count(*) AS c FROM fct_gl_transactions
      WHERE txn_date BETWEEN DATE '2024-03-01' AND DATE '2024-03-31' AND source_system = 'Stripe' AND account_id = '4000'
      GROUP BY 1, 2, 3 HAVING count(*) > 1)`)
  sanity.posted_at_nulls = await scalar(`
    SELECT count(*) FROM fct_gl_transactions WHERE posted_at IS NULL
  `)
  sanity.posted_before_accounting_date = await scalar(`
    SELECT count(*) FROM fct_gl_transactions WHERE posted_at < txn_date
  `)
  sanity.late_close_rows = await scalar(`
    SELECT count(*) FROM fct_gl_transactions WHERE posted_at > txn_date
  `)
  sanity.late_close_distinct_jes = await scalar(`
    SELECT count(DISTINCT je_id) FROM fct_gl_transactions WHERE posted_at > txn_date
  `)
  sanity.late_close_net = await scalar(`
    SELECT round(sum(amount), 2) FROM fct_gl_transactions WHERE je_id = 'JE-2026-ADJ-000001'
  `)
  sanity.late_close_abs = await scalar(`
    SELECT round(sum(abs(amount)), 2) FROM fct_gl_transactions WHERE je_id = 'JE-2026-ADJ-000001'
  `)
  sanity.late_close_shape_breaks = await scalar(`
    SELECT count(*) FROM fct_gl_transactions
    WHERE posted_at > txn_date
      AND NOT (
        je_id IS NOT DISTINCT FROM 'JE-2026-ADJ-000001'
        AND (
          (account_id IS NOT DISTINCT FROM '5000' AND dept_id IS NOT DISTINCT FROM 'D-OPS-01' AND amount IS NOT DISTINCT FROM 185000.00)
          OR (account_id IS NOT DISTINCT FROM '7000' AND dept_id IS NOT DISTINCT FROM 'D-ENG-01' AND amount IS NOT DISTINCT FROM -185000.00)
        )
      )
  `)
  sanity.late_close_metadata_breaks = await scalar(`
    SELECT count(*) FROM fct_gl_transactions
    WHERE posted_at > txn_date
      AND (
        txn_date IS DISTINCT FROM DATE '2026-01-31'
        OR posted_at IS DISTINCT FROM DATE '2026-02-12'
        OR source_system IS DISTINCT FROM 'ManualJE'
        OR vendor_id IS DISTINCT FROM 'V-0002'
        OR memo IS DISTINCT FROM 'Late cloud-cost reclass posted after board deck'
        OR customer_id IS NOT NULL
      )
  `)
  // Customer ownership-history control populations. These are assertion-only:
  // they protect the deterministic exceptions taught by m118-m127 without
  // changing fixture rows, schema, or the generator's random draw order.
  sanity.csm_assignment_rows = await scalar(`
    SELECT count(*) FROM stg_customer_csm_assignments
  `)
  sanity.csm_assigned_customers = await scalar(`
    SELECT count(DISTINCT customer_id) FROM stg_customer_csm_assignments
  `)
  sanity.csm_exact_matched_names = await scalar(`
    WITH employee_name_profile AS (
      SELECT
        full_name,
        count(*) AS matching_employees,
        count(*) FILTER (WHERE dept_id = 'D-CSM-01') AS matching_csm_employees
      FROM dim_employee
      GROUP BY 1
    )
    SELECT count(DISTINCT a.csm_name)
    FROM stg_customer_csm_assignments a
    JOIN employee_name_profile e ON e.full_name = a.csm_name
    WHERE e.matching_employees = 1
      AND e.matching_csm_employees = 1
  `)
  sanity.csm_name_map_breaks = await scalar(`
    WITH employee_name_profile AS (
      SELECT
        full_name,
        count(*) AS matching_employees,
        count(*) FILTER (WHERE dept_id = 'D-CSM-01') AS matching_csm_employees
      FROM dim_employee
      GROUP BY 1
    ), used_names AS (
      SELECT DISTINCT csm_name FROM stg_customer_csm_assignments
    )
    SELECT count(*)
    FROM used_names u
    LEFT JOIN employee_name_profile e ON e.full_name = u.csm_name
    WHERE coalesce(e.matching_employees, 0) <> 1
       OR coalesce(e.matching_csm_employees, 0) <> 1
  `)
  sanity.csm_employment_window_exceptions = await scalar(`
    SELECT count(*)
    FROM stg_customer_csm_assignments a
    JOIN dim_employee e
      ON e.full_name = a.csm_name
     AND e.dept_id = 'D-CSM-01'
    WHERE a.assigned_on < e.hire_date
       OR (e.termination_date IS NOT NULL AND a.assigned_on > e.termination_date)
  `)
  sanity.csm_before_hire_exceptions = await scalar(`
    SELECT count(*)
    FROM stg_customer_csm_assignments a
    JOIN dim_employee e
      ON e.full_name = a.csm_name
     AND e.dept_id = 'D-CSM-01'
    WHERE a.assigned_on < e.hire_date
  `)
  sanity.csm_after_termination_exceptions = await scalar(`
    SELECT count(*)
    FROM stg_customer_csm_assignments a
    JOIN dim_employee e
      ON e.full_name = a.csm_name
     AND e.dept_id = 'D-CSM-01'
    WHERE e.termination_date IS NOT NULL
      AND a.assigned_on > e.termination_date
  `)
  sanity.csm_zero_arr_assignments = await scalar(`
    WITH assignment_arr AS (
      SELECT a.*,
        (SELECT m.arr_after_usd
         FROM fct_arr_movements m
         WHERE m.customer_id = a.customer_id
           AND m.event_date <= a.assigned_on
         ORDER BY m.event_date DESC, m.movement_id DESC
         LIMIT 1) AS arr_at_assignment
      FROM stg_customer_csm_assignments a
    )
    SELECT count(*)
    FROM assignment_arr
    WHERE arr_at_assignment IS NOT NULL
      AND round(arr_at_assignment * 100)::BIGINT = 0
  `)
  sanity.csm_missing_arr_assignments = await scalar(`
    WITH assignment_arr AS (
      SELECT a.*,
        (SELECT m.arr_after_usd
         FROM fct_arr_movements m
         WHERE m.customer_id = a.customer_id
           AND m.event_date <= a.assigned_on
         ORDER BY m.event_date DESC, m.movement_id DESC
         LIMIT 1) AS arr_at_assignment
      FROM stg_customer_csm_assignments a
    )
    SELECT count(*)
    FROM assignment_arr
    WHERE arr_at_assignment IS NULL
  `)
  sanity.csm_transition_rows = await scalar(`
    WITH sequenced AS (
      SELECT row_number() OVER (
        PARTITION BY customer_id ORDER BY assigned_on, csm_name
      ) AS assignment_sequence
      FROM stg_customer_csm_assignments
    )
    SELECT count(*) FROM sequenced WHERE assignment_sequence > 1
  `)
  sanity.csm_adjacent_noops = await scalar(`
    WITH sequenced AS (
      SELECT csm_name,
        lag(csm_name) OVER (
          PARTITION BY customer_id ORDER BY assigned_on, csm_name
        ) AS prior_csm_name
      FROM stg_customer_csm_assignments
    )
    SELECT count(*) FROM sequenced WHERE csm_name = prior_csm_name
  `)
  sanity.csm_repeated_owner_rows = await scalar(`
    WITH sequenced AS (
      SELECT row_number() OVER (
        PARTITION BY customer_id, csm_name ORDER BY assigned_on
      ) AS owner_visit
      FROM stg_customer_csm_assignments
    )
    SELECT count(*) FROM sequenced WHERE owner_visit > 1
  `)
  sanity.csm_returned_owner_rows = await scalar(`
    WITH sequenced AS (
      SELECT csm_name,
        lag(csm_name) OVER (
          PARTITION BY customer_id ORDER BY assigned_on, csm_name
        ) AS prior_csm_name,
        row_number() OVER (
          PARTITION BY customer_id, csm_name ORDER BY assigned_on
        ) AS owner_visit
      FROM stg_customer_csm_assignments
    )
    SELECT count(*)
    FROM sequenced
    WHERE owner_visit > 1
      AND csm_name IS DISTINCT FROM prior_csm_name
  `)
  sanity.csm_june_active_customers = await scalar(`
    SELECT count(*)
    FROM fct_subscription_snapshot_monthly
    WHERE month_start = DATE '2026-06-01'
  `)
  sanity.csm_june_assigned_customers = await scalar(`
    WITH june AS (
      SELECT customer_id
      FROM fct_subscription_snapshot_monthly
      WHERE month_start = DATE '2026-06-01'
    ), latest AS (
      SELECT customer_id
      FROM stg_customer_csm_assignments
      WHERE assigned_on <= DATE '2026-06-30'
      QUALIFY row_number() OVER (
        PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name
      ) = 1
    )
    SELECT count(l.customer_id) FROM june j LEFT JOIN latest l USING (customer_id)
  `)
  sanity.csm_june_unassigned_customers = await scalar(`
    WITH june AS (
      SELECT customer_id
      FROM fct_subscription_snapshot_monthly
      WHERE month_start = DATE '2026-06-01'
    ), latest AS (
      SELECT customer_id
      FROM stg_customer_csm_assignments
      WHERE assigned_on <= DATE '2026-06-30'
      QUALIFY row_number() OVER (
        PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name
      ) = 1
    )
    SELECT count(*)
    FROM june j
    LEFT JOIN latest l USING (customer_id)
    WHERE l.customer_id IS NULL
  `)
  sanity.csm_june_unassigned_arr = await scalar(`
    WITH june AS (
      SELECT customer_id, arr_usd
      FROM fct_subscription_snapshot_monthly
      WHERE month_start = DATE '2026-06-01'
    ), latest AS (
      SELECT customer_id
      FROM stg_customer_csm_assignments
      WHERE assigned_on <= DATE '2026-06-30'
      QUALIFY row_number() OVER (
        PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name
      ) = 1
    )
    SELECT round(sum(j.arr_usd), 2)
    FROM june j
    LEFT JOIN latest l USING (customer_id)
    WHERE l.customer_id IS NULL
  `)
  sanity.csm_june_bad_latest_starts = await scalar(`
    WITH june AS (
      SELECT customer_id
      FROM fct_subscription_snapshot_monthly
      WHERE month_start = DATE '2026-06-01'
    ), latest AS (
      SELECT customer_id, csm_name, assigned_on
      FROM stg_customer_csm_assignments
      WHERE assigned_on <= DATE '2026-06-30'
      QUALIFY row_number() OVER (
        PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name
      ) = 1
    )
    SELECT count(*)
    FROM june j
    JOIN latest l USING (customer_id)
    JOIN dim_employee e
      ON e.full_name = l.csm_name
     AND e.dept_id = 'D-CSM-01'
    WHERE l.assigned_on < e.hire_date
  `)
  sanity.csm_june_current_unemployed = await scalar(`
    WITH june AS (
      SELECT customer_id
      FROM fct_subscription_snapshot_monthly
      WHERE month_start = DATE '2026-06-01'
    ), latest AS (
      SELECT customer_id, csm_name
      FROM stg_customer_csm_assignments
      WHERE assigned_on <= DATE '2026-06-30'
      QUALIFY row_number() OVER (
        PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name
      ) = 1
    )
    SELECT count(*)
    FROM june j
    JOIN latest l USING (customer_id)
    JOIN dim_employee e
      ON e.full_name = l.csm_name
     AND e.dept_id = 'D-CSM-01'
    WHERE e.termination_date IS NOT NULL
      AND e.termination_date < DATE '2026-06-30'
  `)
  // TIE 1: snapshot first-difference == movements, per month (mart window, post-Jan-2023)
  sanity.movements_snapshot_tie_breaks = await scalar(`
    WITH months AS (SELECT DISTINCT month_start FROM fct_subscription_snapshot_monthly WHERE month_start > DATE '2023-01-01'),
    snap_delta AS (
      SELECT m.month_start,
        (SELECT COALESCE(sum(arr_usd), 0) FROM fct_subscription_snapshot_monthly s WHERE s.month_start = m.month_start)
        - (SELECT COALESCE(sum(arr_usd), 0) FROM fct_subscription_snapshot_monthly s WHERE s.month_start = (m.month_start - INTERVAL 1 MONTH)::DATE) AS d
      FROM months m
    ), mov AS (
      SELECT date_trunc('month', event_date)::DATE AS month_start, sum(arr_delta_usd) AS d
      FROM fct_arr_movements GROUP BY 1
    )
    SELECT count(*) FROM snap_delta sd JOIN mov ON mov.month_start = sd.month_start
    WHERE abs(sd.d - mov.d) > 1.0
  `)
  // TIE 2: GL subscription revenue == snapshot ARR/12, per month
  sanity.gl_snapshot_tie_breaks = await scalar(`
    WITH gl AS (
      SELECT date_trunc('month', txn_date)::DATE AS m, sum(amount) AS rev
      FROM fct_gl_transactions
      WHERE account_id = '4000' AND NOT (txn_date BETWEEN DATE '2024-03-01' AND DATE '2024-03-31')
      GROUP BY 1
    ), sn AS (
      SELECT month_start AS m, sum(round(arr_usd / 12.0, 2)) AS rev
      FROM fct_subscription_snapshot_monthly GROUP BY 1
    )
    SELECT count(*) FROM gl JOIN sn USING (m) WHERE abs(gl.rev - sn.rev) > 1.0
  `)
  // TIE 3: GL comp == payroll fact, per month
  sanity.gl_payroll_tie_breaks = await scalar(`
    WITH gl AS (
      SELECT date_trunc('month', txn_date)::DATE AS m, sum(amount) AS comp
      FROM fct_gl_transactions WHERE account_id IN ('6000', '6020', '6030', '5300', '5310') GROUP BY 1
    ), pr AS (
      SELECT payroll_month AS m, sum(total_comp_usd) AS comp FROM fct_payroll_monthly GROUP BY 1
    )
    SELECT count(*) FROM gl JOIN pr USING (m) WHERE abs(gl.comp - pr.comp) > 5.0
  `)
  manifest.sanity = sanity
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(JSON.stringify(manifest.sanity, null, 2))
  console.log(`TOTAL: ${manifest.total_rows.toLocaleString()} rows, ${(totalBytes / 1024 / 1024).toFixed(1)}MB parquet, ${((Date.now() - t0) / 1000).toFixed(1)}s`)

  // fail-closed gates
  const errs = []
  if (sanity.movements_snapshot_tie_breaks > 0) errs.push(`movements↔snapshot tie broken in ${sanity.movements_snapshot_tie_breaks} months`)
  if (sanity.gl_snapshot_tie_breaks > 0) errs.push(`GL↔snapshot revenue tie broken in ${sanity.gl_snapshot_tie_breaks} months`)
  if (sanity.gl_payroll_tie_breaks > 0) errs.push(`GL↔payroll tie broken in ${sanity.gl_payroll_tie_breaks} months`)
  if (sanity.posted_at_nulls !== 0) errs.push(`${sanity.posted_at_nulls} GL rows have no posting date`)
  if (sanity.posted_before_accounting_date !== 0) errs.push(`${sanity.posted_before_accounting_date} GL rows posted before their accounting date`)
  if (sanity.late_close_rows !== 2) errs.push(`late-close fixture has ${sanity.late_close_rows} rows (expected 2)`)
  if (sanity.late_close_distinct_jes !== 1) errs.push(`late-close fixture spans ${sanity.late_close_distinct_jes} JEs (expected 1)`)
  if (sanity.late_close_net !== 0) errs.push(`late-close fixture nets to ${sanity.late_close_net} (expected 0)`)
  if (sanity.late_close_abs !== 370000) errs.push(`late-close fixture absolute value is ${sanity.late_close_abs} (expected 370000)`)
  if (sanity.late_close_shape_breaks !== 0) errs.push(`late-close fixture has ${sanity.late_close_shape_breaks} malformed account/dept/amount rows`)
  if (sanity.late_close_metadata_breaks !== 0) errs.push(`late-close fixture has ${sanity.late_close_metadata_breaks} metadata mismatches`)
  const expectedCsmControlPopulations = {
    csm_assignment_rows: 8546,
    csm_assigned_customers: 4674,
    csm_exact_matched_names: 93,
    csm_name_map_breaks: 0,
    csm_employment_window_exceptions: 3728,
    csm_before_hire_exceptions: 2948,
    csm_after_termination_exceptions: 780,
    csm_zero_arr_assignments: 1085,
    csm_missing_arr_assignments: 0,
    csm_transition_rows: 3872,
    csm_adjacent_noops: 27,
    csm_repeated_owner_rows: 44,
    csm_returned_owner_rows: 17,
    csm_june_active_customers: 4869,
    csm_june_assigned_customers: 2663,
    csm_june_unassigned_customers: 2206,
    csm_june_bad_latest_starts: 656,
    csm_june_current_unemployed: 0,
  }
  for (const [population, expected] of Object.entries(expectedCsmControlPopulations)) {
    if (sanity[population] !== expected) errs.push(`${population} is ${sanity[population]} (expected ${expected})`)
  }
  if (Math.abs(sanity.csm_june_unassigned_arr - 2644126.68) > 0.005) {
    errs.push(`csm_june_unassigned_arr is ${sanity.csm_june_unassigned_arr} (expected 2644126.68)`)
  }
  if (manifest.tables.fct_gl_transactions.rows < 2000000) errs.push(`GL only ${manifest.tables.fct_gl_transactions.rows} rows (<2M — the Excel-ceiling line stops being honest)`)
  if (totalBytes > 60 * 1024 * 1024) errs.push(`parquet total ${(totalBytes / 1e6).toFixed(0)}MB exceeds 60MB hard abort`)
  if (errs.length) {
    // Throw so runWithGenerationLock() can release the lock in its finally.
    // process.exit() would bypass that cleanup and strand a fresh clone for 15m.
    throw new Error('GENERATION GATE FAILED:\n - ' + errs.join('\n - '))
  }
  console.log('ALL GENERATION GATES GREEN')
}

async function countOf(t) {
  const r = await conn.runAndReadAll(`SELECT count(*)::BIGINT FROM ${t}`)
  return Number(r.getRows()[0][0])
}
async function scalar(sql) {
  const r = await conn.runAndReadAll(sql)
  const v = r.getRows()[0][0]
  return typeof v === 'bigint' ? Number(v) : v
}

async function runWithGenerationLock() {
  const release = await acquireGenerationLock(join(OUT, '.generate-data.lock'))
  try {
    await main()
  } finally {
    release()
  }
}

runWithGenerationLock().catch((e) => { console.error(e); process.exitCode = 1 })
