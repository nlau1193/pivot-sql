// GL-to-payroll loaded-headcount-cost bridge — a Star67 operating-review arc (part 30).
// A cohesive reconciliation workday distinct from m137-145 (shared-services allocation)
// and m50-57 (roster reconciliation). Eight decisions bridging recognized GL people-cost
// lines to loaded payroll total comp with headcount.
//
// Audited H1 2026 truth:
//   fct_payroll_monthly: base 50,845,293.87 / bonus 7,554,544.53 / commission 4,567,327.34
//     / benefits 5,592,982.24 / employer_taxes 5,352,209.00 / total_comp 73,912,355.99
//     / 4,079 employee-months / 717 distinct heads
//   GL comp accounts (6000 Salaries & Wages 56,588,882.34 + 5300 Support Comp 4,376,627.90
//     + 5310 Cloud Ops Comp 2,001,655.50) = 62,967,165.74
//   Bridge gap: payroll total_comp - GL comp = 10,945,190.25 (loaded exceeds recognized)
//   Payroll by division: S&M 31,923,487.31 (285) / R&D 30,503,366.70 (317) / COGS 7,510,181.97 (77) / G&A 3,975,320.01 (38)

const GL_COMP_BOUNDARY_SQL = `SELECT a.account_id, a.account_name,
  count(*) AS gl_lines,
  round(sum(g.amount), 2) AS h1_gl_comp_usd
FROM fct_gl_transactions g
JOIN dim_account a ON g.account_id = a.account_id
WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
  AND a.account_id IN ('6000', '5300', '5310')
GROUP BY a.account_id, a.account_name
ORDER BY h1_gl_comp_usd DESC`

const GL_COMP_BOUNDARY_ALL_EXPENSE_TRAP_SQL = `SELECT a.account_id, a.account_name,
  count(*) AS gl_lines,
  round(sum(g.amount), 2) AS h1_gl_comp_usd
FROM fct_gl_transactions g
JOIN dim_account a ON g.account_id = a.account_id
WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
  AND a.account_type = 'Opex'
GROUP BY a.account_id, a.account_name
ORDER BY h1_gl_comp_usd DESC`

const GL_VS_PAYROLL_TOTAL_SQL = `WITH gl AS (
  SELECT round(sum(g.amount), 2) AS gl_comp_usd
  FROM fct_gl_transactions g
  JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
    AND a.account_id IN ('6000', '5300', '5310')
), payroll AS (
  SELECT round(sum(total_comp_usd), 2) AS payroll_comp_usd,
    count(*) AS employee_months,
    count(DISTINCT employee_id) AS distinct_heads
  FROM fct_payroll_monthly
  WHERE payroll_month >= DATE '2026-01-01' AND payroll_month < DATE '2026-07-01'
)
SELECT
  round(gl.gl_comp_usd, 2) AS h1_gl_comp_usd,
  round(payroll.payroll_comp_usd, 2) AS h1_payroll_comp_usd,
  round(payroll.employee_months, 0) AS employee_months,
  payroll.distinct_heads AS distinct_heads,
  round(payroll.payroll_comp_usd - gl.gl_comp_usd, 2) AS bridge_gap_usd,
  round(100.0 * (payroll.payroll_comp_usd - gl.gl_comp_usd) / nullif(gl.gl_comp_usd, 0), 2) AS bridge_gap_pct
FROM gl CROSS JOIN payroll`

const GL_VS_PAYROLL_TOTAL_BASE_ONLY_TRAP_SQL = `WITH gl AS (
  SELECT round(sum(g.amount), 2) AS gl_comp_usd
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' AND a.account_id IN ('6000', '5300', '5310')
), payroll AS (
  SELECT round(sum(base_pay_usd), 2) AS payroll_comp_usd,
    count(*) AS employee_months,
    count(DISTINCT employee_id) AS distinct_heads
  FROM fct_payroll_monthly WHERE payroll_month >= DATE '2026-01-01' AND payroll_month < DATE '2026-07-01'
)
SELECT round(gl.gl_comp_usd, 2) AS h1_gl_comp_usd, round(payroll.payroll_comp_usd, 2) AS h1_payroll_comp_usd,
  round(payroll.employee_months, 0) AS employee_months, payroll.distinct_heads AS distinct_heads,
  round(payroll.payroll_comp_usd - gl.gl_comp_usd, 2) AS bridge_gap_usd,
  round(100.0 * (payroll.payroll_comp_usd - gl.gl_comp_usd) / nullif(gl.gl_comp_usd, 0), 2) AS bridge_gap_pct
FROM gl CROSS JOIN payroll`

const PAYROLL_COMPONENT_BRIDGE_SQL = `SELECT
  round(sum(base_pay_usd), 2) AS base_pay_usd,
  round(sum(bonus_usd), 2) AS bonus_usd,
  round(sum(commission_usd), 2) AS commission_usd,
  round(sum(benefits_usd), 2) AS benefits_usd,
  round(sum(employer_taxes_usd), 2) AS employer_taxes_usd,
  round(sum(total_comp_usd), 2) AS total_comp_usd,
  round(100.0 * sum(base_pay_usd) / nullif(sum(total_comp_usd), 0), 2) AS base_share_pct,
  round(100.0 * sum(bonus_usd) / nullif(sum(total_comp_usd), 0), 2) AS bonus_share_pct,
  round(100.0 * sum(commission_usd) / nullif(sum(total_comp_usd), 0), 2) AS commission_share_pct,
  round(100.0 * sum(benefits_usd) / nullif(sum(total_comp_usd), 0), 2) AS benefits_share_pct,
  round(100.0 * sum(employer_taxes_usd) / nullif(sum(total_comp_usd), 0), 2) AS employer_taxes_share_pct
FROM fct_payroll_monthly
WHERE payroll_month >= DATE '2026-01-01' AND payroll_month < DATE '2026-07-01'`

const PAYROLL_COMPONENT_BRIDGE_ABS_TRAP_SQL = `SELECT
  round(sum(base_pay_usd), 2) AS base_pay_usd,
  round(sum(abs(bonus_usd - commission_usd)), 2) AS bonus_usd,
  round(sum(commission_usd), 2) AS commission_usd,
  round(sum(benefits_usd), 2) AS benefits_usd,
  round(sum(employer_taxes_usd), 2) AS employer_taxes_usd,
  round(sum(total_comp_usd), 2) AS total_comp_usd,
  round(100.0 * sum(base_pay_usd) / nullif(sum(total_comp_usd), 0), 2) AS base_share_pct,
  round(100.0 * sum(bonus_usd) / nullif(sum(total_comp_usd), 0), 2) AS bonus_share_pct,
  round(100.0 * sum(commission_usd) / nullif(sum(total_comp_usd), 0), 2) AS commission_share_pct,
  round(100.0 * sum(benefits_usd) / nullif(sum(total_comp_usd), 0), 2) AS benefits_share_pct,
  round(100.0 * sum(employer_taxes_usd) / nullif(sum(total_comp_usd), 0), 2) AS employer_taxes_share_pct
FROM fct_payroll_monthly WHERE payroll_month >= DATE '2026-01-01' AND payroll_month < DATE '2026-07-01'`

const LOADED_COST_PER_HEAD_SQL = `SELECT
  count(DISTINCT employee_id) AS distinct_heads,
  count(*) AS employee_months,
  round(count(*) / nullif(count(DISTINCT employee_id), 0), 2) AS months_per_head,
  round(sum(total_comp_usd), 2) AS total_comp_usd,
  round(sum(total_comp_usd) / nullif(count(DISTINCT employee_id), 0), 2) AS loaded_cost_per_head_usd,
  round(sum(total_comp_usd) / nullif(count(*), 0), 2) AS cost_per_employee_month_usd
FROM fct_payroll_monthly
WHERE payroll_month >= DATE '2026-01-01' AND payroll_month < DATE '2026-07-01'`

const LOADED_COST_PER_HEAD_ROWS_TRAP_SQL = `SELECT
  count(*) AS distinct_heads,
  count(*) AS employee_months,
  round(1.00, 2) AS months_per_head,
  round(sum(total_comp_usd), 2) AS total_comp_usd,
  round(sum(total_comp_usd) / nullif(count(*), 0), 2) AS loaded_cost_per_head_usd,
  round(sum(total_comp_usd) / nullif(count(*), 0), 2) AS cost_per_employee_month_usd
FROM fct_payroll_monthly WHERE payroll_month >= DATE '2026-01-01' AND payroll_month < DATE '2026-07-01'`

const PAYROLL_BY_DIVISION_SQL = `SELECT d.division,
  count(DISTINCT p.employee_id) AS distinct_heads,
  count(*) AS employee_months,
  round(sum(p.total_comp_usd), 2) AS total_comp_usd,
  round(sum(p.total_comp_usd) / nullif(count(DISTINCT p.employee_id), 0), 2) AS loaded_cost_per_head_usd,
  round(100.0 * sum(p.total_comp_usd) / sum(sum(p.total_comp_usd)) OVER (), 2) AS comp_share_pct
FROM fct_payroll_monthly p
JOIN dim_department d ON p.dept_id = d.dept_id
WHERE p.payroll_month >= DATE '2026-01-01' AND p.payroll_month < DATE '2026-07-01'
GROUP BY d.division
ORDER BY total_comp_usd DESC`

const PAYROLL_BY_DIVISION_ROWS_TRAP_SQL = `SELECT d.division,
  count(*) AS distinct_heads,
  count(*) AS employee_months,
  round(sum(p.total_comp_usd), 2) AS total_comp_usd,
  round(sum(p.total_comp_usd) / nullif(count(*), 0), 2) AS loaded_cost_per_head_usd,
  round(100.0 * sum(p.total_comp_usd) / sum(sum(p.total_comp_usd)) OVER (), 2) AS comp_share_pct
FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id
WHERE p.payroll_month >= DATE '2026-01-01' AND p.payroll_month < DATE '2026-07-01'
GROUP BY d.division ORDER BY total_comp_usd DESC`

const MONTHLY_PAYROLL_CADENCE_SQL = `SELECT payroll_month,
  count(DISTINCT employee_id) AS heads,
  round(sum(total_comp_usd), 2) AS total_comp_usd,
  round(sum(total_comp_usd) - lag(sum(total_comp_usd)) OVER (ORDER BY payroll_month), 2) AS mom_delta_usd,
  round(100.0 * (sum(total_comp_usd) - lag(sum(total_comp_usd)) OVER (ORDER BY payroll_month)) / nullif(lag(sum(total_comp_usd)) OVER (ORDER BY payroll_month), 0), 2) AS mom_delta_pct
FROM fct_payroll_monthly
WHERE payroll_month >= DATE '2026-01-01' AND payroll_month < DATE '2026-07-01'
GROUP BY payroll_month
ORDER BY payroll_month`

const MONTHLY_PAYROLL_CADENCE_HEADCOUNT_TRAP_SQL = `SELECT payroll_month,
  count(DISTINCT employee_id) AS heads,
  round(sum(total_comp_usd), 2) AS total_comp_usd,
  round(count(DISTINCT employee_id) - lag(count(DISTINCT employee_id)) OVER (ORDER BY payroll_month), 2) AS mom_delta_usd,
  round(100.0 * (count(DISTINCT employee_id) - lag(count(DISTINCT employee_id)) OVER (ORDER BY payroll_month)) / nullif(lag(count(DISTINCT employee_id)) OVER (ORDER BY payroll_month), 0), 2) AS mom_delta_pct
FROM fct_payroll_monthly WHERE payroll_month >= DATE '2026-01-01' AND payroll_month < DATE '2026-07-01'
GROUP BY payroll_month ORDER BY payroll_month`

const BRIDGE_TIE_SQL = `WITH gl AS (
  SELECT round(sum(g.amount), 2) AS gl_comp_usd
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' AND a.account_id IN ('6000', '5300', '5310')
), payroll AS (
  SELECT round(sum(total_comp_usd), 2) AS payroll_comp_usd,
    count(DISTINCT employee_id) AS distinct_heads
  FROM fct_payroll_monthly WHERE payroll_month >= DATE '2026-01-01' AND payroll_month < DATE '2026-07-01'
), sm_payroll AS (
  SELECT round(sum(p.total_comp_usd), 2) AS sm_comp_usd
  FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id
  WHERE p.payroll_month >= DATE '2026-01-01' AND p.payroll_month < DATE '2026-07-01' AND d.division = 'S&M'
)
SELECT
  round(gl.gl_comp_usd, 2) AS h1_gl_comp_usd,
  round(payroll.payroll_comp_usd, 2) AS h1_payroll_comp_usd,
  round(payroll.payroll_comp_usd - gl.gl_comp_usd, 2) AS bridge_gap_usd,
  round(100.0 * (payroll.payroll_comp_usd - gl.gl_comp_usd) / nullif(gl.gl_comp_usd, 0), 2) AS bridge_gap_pct,
  payroll.distinct_heads AS distinct_heads,
  round(payroll.payroll_comp_usd / nullif(payroll.distinct_heads, 0), 2) AS loaded_cost_per_head_usd,
  round(sm_payroll.sm_comp_usd, 2) AS sm_payroll_comp_usd
FROM gl CROSS JOIN payroll CROSS JOIN sm_payroll`

const BRIDGE_TIE_DROP_GAP_TRAP_SQL = `WITH gl AS (
  SELECT round(sum(g.amount), 2) AS gl_comp_usd
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' AND a.account_id IN ('6000', '5300', '5310')
), payroll AS (
  SELECT round(sum(total_comp_usd), 2) AS payroll_comp_usd,
    count(DISTINCT employee_id) AS distinct_heads
  FROM fct_payroll_monthly WHERE payroll_month >= DATE '2026-01-01' AND payroll_month < DATE '2026-07-01'
), sm_payroll AS (
  SELECT round(sum(p.total_comp_usd), 2) AS sm_comp_usd
  FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id
  WHERE p.payroll_month >= DATE '2026-01-01' AND p.payroll_month < DATE '2026-07-01' AND d.division = 'S&M'
)
SELECT
  round(gl.gl_comp_usd, 2) AS h1_gl_comp_usd,
  round(payroll.payroll_comp_usd, 2) AS h1_payroll_comp_usd,
  round(0, 2) AS bridge_gap_usd,
  round(0, 2) AS bridge_gap_pct,
  payroll.distinct_heads AS distinct_heads,
  round(payroll.payroll_comp_usd / nullif(payroll.distinct_heads, 0), 2) AS loaded_cost_per_head_usd,
  round(sm_payroll.sm_comp_usd, 2) AS sm_payroll_comp_usd
FROM gl CROSS JOIN payroll CROSS JOIN sm_payroll`

export const PAYROLL_BRIDGE_MISSIONS = [
  {
    id: 'm204',
    part: 30,
    title: 'Set the GL compensation-account boundary',
    from: 'maria',
    ask: `Open the people-cost bridge by setting the boundary on the GL side: which accounts carry recognized compensation cost in H1 2026. Three accounts — 6000 Salaries & Wages, 5300 Support Compensation, 5310 Cloud Ops Compensation — are the comp lines. List each with its line count and H1 actual. Restricting to these three keeps non-comp Opex out of the bridge.`,
    deliverable: `Three rows ordered by h1_gl_comp_usd descending: account_id, account_name, gl_lines, h1_gl_comp_usd. Round dollars to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_account'],
    canonical: GL_COMP_BOUNDARY_SQL,
    solutionSql: GL_COMP_BOUNDARY_SQL,
    solutionNote: `H1 2026 recognized GL compensation is $62.97M across three accounts: 6000 Salaries & Wages ($56.59M), 5300 Support Compensation ($4.38M), and 5310 Cloud Ops Compensation ($2.00M). This is the recognized-GL comp boundary — the denominator for the bridge to loaded payroll. It is not cash paid or a headcount.`,
    ordered: true,
    orderedNote: 'h1_gl_comp_usd descending',
    fingerprintSQL: GL_COMP_BOUNDARY_ALL_EXPENSE_TRAP_SQL,
    fingerprintMessage: `You returned every Opex account, mixing non-comp cost (rent, tools, travel) into the people-cost boundary. Restrict to the three compensation accounts (6000, 5300, 5310) so the bridge starts from recognized comp only.`,
    hints: [
      `Join GL to dim_account, filter to H1 2026 and account_id IN ('6000','5300','5310'). Group by account.`,
      `Count lines and sum amount per account. Order by the H1 comp descending so the largest account leads.`,
      GL_COMP_BOUNDARY_SQL,
    ],
    sayIt: `"H1 recognized GL compensation is $62.97 million across three accounts — Salaries & Wages, Support Comp, and Cloud Ops Comp. That's the boundary for the bridge to loaded payroll, not cash paid or a headcount."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm205',
    part: 30,
    title: 'Bridge recognized GL comp to loaded payroll total',
    from: 'maria',
    ask: `The bridge itself: set recognized GL comp (the three accounts) against loaded payroll total comp (base + bonus + commission + benefits + employer taxes) for H1 2026, with the dollar and percent gap. Loaded payroll exceeds recognized GL — the gap is the reconciliation leadership asks about. Count distinct heads and employee-months on the payroll side.`,
    deliverable: `Exactly one row: h1_gl_comp_usd, h1_payroll_comp_usd, employee_months, distinct_heads, bridge_gap_usd (payroll minus GL), bridge_gap_pct. Round dollars and percent to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_account', 'fct_payroll_monthly'],
    canonical: GL_VS_PAYROLL_TOTAL_SQL,
    solutionSql: GL_VS_PAYROLL_TOTAL_SQL,
    solutionNote: `Loaded payroll total comp is $73.91M against recognized GL comp of $62.97M, a $10.95M bridge gap (+17.4%) — loaded exceeds recognized. The gap reflects that the loaded payroll carries benefits and employer taxes not fully captured in the recognized comp GL lines, plus accrual timing. This is a reconciliation read, not a cash or accrual assertion.`,
    ordered: false,
    fingerprintSQL: GL_VS_PAYROLL_TOTAL_BASE_ONLY_TRAP_SQL,
    fingerprintMessage: `You summed only base_pay_usd on the payroll side, dropping bonus, commission, benefits, and employer taxes — so the payroll figure understates loaded comp and the gap reads the wrong direction. Use total_comp_usd so the bridge reflects fully loaded people cost.`,
    hints: [
      `Build one-row GL comp (the three accounts) and one-row payroll (sum total_comp_usd, count rows as employee-months, count distinct employee_id as heads). CROSS JOIN.`,
      `The gap is payroll minus GL (loaded minus recognized). Percent is 100 * gap / GL, null-guarded.`,
      GL_VS_PAYROLL_TOTAL_SQL,
    ],
    sayIt: `"Loaded payroll total comp is $73.91 million against recognized GL comp of $62.97 million — a $10.95 million gap, about 17%. Loaded exceeds recognized because the payroll carries benefits and employer taxes not fully in the comp GL lines. This is a reconciliation, not a cash assertion."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm206',
    part: 30,
    title: 'Decompose loaded payroll into its components',
    from: 'danny',
    ask: `What drives the loaded payroll figure? Decompose H1 2026 total comp into its five components — base pay, bonus, commission, benefits, and employer taxes — with each one's share of the total. The component mix tells leadership how variable versus fixed the people cost is.`,
    deliverable: `Exactly one row: base_pay_usd, bonus_usd, commission_usd, benefits_usd, employer_taxes_usd, total_comp_usd, base_share_pct, bonus_share_pct, commission_share_pct, benefits_share_pct, employer_taxes_share_pct. Round dollars and percent to 2 decimals.`,
    tables: ['fct_payroll_monthly'],
    canonical: PAYROLL_COMPONENT_BRIDGE_SQL,
    solutionSql: PAYROLL_COMPONENT_BRIDGE_SQL,
    solutionNote: `Base pay is the dominant component at roughly 68.8% of total comp; bonus and commission are the variable slices; benefits and employer taxes are the loaded loadings. The five shares sum to 100%. This is a loaded-comp decomposition, not cash paid or a salary run-rate.`,
    ordered: false,
    fingerprintSQL: PAYROLL_COMPONENT_BRIDGE_ABS_TRAP_SQL,
    fingerprintMessage: `You computed bonus as the absolute difference between bonus and commission per row, which corrupts the bonus total and its share. Sum each component directly from its own column; do not derive one component from another.`,
    hints: [
      `Filter payroll to H1 2026 and sum each of the five component columns plus total_comp_usd in one row.`,
      `Each share is 100 * component / total_comp_usd, null-guarded. The five shares should sum to 100.`,
      PAYROLL_COMPONENT_BRIDGE_SQL,
    ],
    sayIt: `"Base pay is about 69% of total comp, with bonus and commission as the variable slices and benefits and employer taxes as the loadings. The five shares sum to 100%. This is a loaded-comp decomposition, not cash or a salary run-rate."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm207',
    part: 30,
    title: 'Compute loaded cost per head and per employee-month',
    from: 'danny',
    ask: `Convert the loaded payroll into unit economics: distinct heads, employee-months (the volume of pay records), months per head, total comp, and the two unit rates — loaded cost per head and cost per employee-month. The per-head rate is the annualized-on-H1 figure; the per-month rate is the raw cost of one pay record.`,
    deliverable: `Exactly one row: distinct_heads, employee_months, months_per_head, total_comp_usd, loaded_cost_per_head_usd, cost_per_employee_month_usd. Round dollars and the ratio to 2 decimals.`,
    tables: ['fct_payroll_monthly'],
    canonical: LOADED_COST_PER_HEAD_SQL,
    solutionSql: LOADED_COST_PER_HEAD_SQL,
    solutionNote: `H1 2026 has 717 distinct heads across 4,079 employee-months (about 5.69 months per head on average, since not every head is employed the full half). Loaded cost per head is total comp over heads; cost per employee-month is total comp over pay records. The per-head figure is the H1 load per person; the per-month figure is the cost of one monthly pay record.`,
    ordered: false,
    fingerprintSQL: LOADED_COST_PER_HEAD_ROWS_TRAP_SQL,
    fingerprintMessage: `You counted payroll rows as distinct heads, conflating employee-months (4,079) with people (717). Heads is count(distinct employee_id); employee-months is count(*). The per-head rate divides by people, not pay records.`,
    hints: [
      `count(distinct employee_id) is heads; count(*) is employee-months. months_per_head is employee-months / heads.`,
      `Loaded cost per head is total_comp / heads; cost per employee-month is total_comp / employee-months. Null-guard both denominators.`,
      LOADED_COST_PER_HEAD_SQL,
    ],
    sayIt: `"H1 has 717 distinct heads across 4,079 employee-months — about 5.7 months per head. Loaded cost per head is total comp over people; cost per employee-month is over pay records. The two unit rates answer different questions."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm208',
    part: 30,
    title: 'Read loaded payroll by division',
    from: 'danny',
    ask: `Where does the loaded people cost sit? Read H1 2026 payroll by division: distinct heads, employee-months, total comp, loaded cost per head, and each division's share of total comp. This shows which division carries the most people cost and whether its per-head rate differs.`,
    deliverable: `One row per division ordered by total_comp_usd descending: division, distinct_heads, employee_months, total_comp_usd, loaded_cost_per_head_usd, comp_share_pct. Round dollars and percent to 2 decimals.`,
    tables: ['fct_payroll_monthly', 'dim_department'],
    canonical: PAYROLL_BY_DIVISION_SQL,
    solutionSql: PAYROLL_BY_DIVISION_SQL,
    solutionNote: `S&M and R&D carry the largest H1 payroll totals — S&M about $31.92M and R&D about $30.50M — while COGS and G&A are smaller. The per-head rate differs by division, reflecting role and seniority mix. Share is measured against total comp dollars. This is a loaded-payroll cut, not a recognized-GL cut.`,
    ordered: true,
    orderedNote: 'total_comp_usd descending',
    fingerprintSQL: PAYROLL_BY_DIVISION_ROWS_TRAP_SQL,
    fingerprintMessage: `You counted payroll rows as distinct heads per division, so every division's headcount equals its employee-months and the per-head rate is really a per-month rate. Use count(distinct employee_id) for heads so the per-head rate divides by people.`,
    hints: [
      `Join payroll to dim_department on dept_id; filter to H1 2026; group by division.`,
      `count(distinct employee_id) for heads, count(*) for months, sum(total_comp_usd) for comp. Per-head is comp / heads; share is 100 * comp / total via a window. Order by comp descending.`,
      PAYROLL_BY_DIVISION_SQL,
    ],
    sayIt: `"S&M and R&D carry the largest H1 payroll — about $31.92 million and $30.50 million — and the per-head rate differs by division, reflecting role mix. Share is by comp dollars. This is a loaded-payroll cut, not a recognized-GL cut."`,
    jdCompanies: ['Stripe'],
  },
  {
    id: 'm209',
    part: 30,
    title: 'Read the monthly payroll cadence',
    from: 'danny',
    ask: `Is people cost steady or changing across the half? Read H1 2026 payroll by month: distinct heads, total comp, and the month-over-month dollar and percent change in comp. A steady cadence means stable headcount and pay; a rising one means hiring or comp inflation.`,
    deliverable: `Six rows ordered by payroll_month ascending: payroll_month, heads, total_comp_usd, mom_delta_usd, mom_delta_pct. Round dollars and percent to 2 decimals; January's delta is null.`,
    tables: ['fct_payroll_monthly'],
    canonical: MONTHLY_PAYROLL_CADENCE_SQL,
    solutionSql: MONTHLY_PAYROLL_CADENCE_SQL,
    solutionNote: `H1 2026 payroll comp runs steady month to month with modest movement; the headcount and comp deltas move together. The first month's delta is null because there is no prior month in the window. This is a loaded-comp cadence, not cash paid or a hiring forecast.`,
    ordered: true,
    orderedNote: 'payroll_month ascending',
    fingerprintSQL: MONTHLY_PAYROLL_CADENCE_HEADCOUNT_TRAP_SQL,
    fingerprintMessage: `You put the headcount delta in the mom_delta_usd column, mixing a count change into a dollar-delta field. Keep the comp delta in dollars (sum(total_comp) month over month) and the headcount in its own column; do not swap them.`,
    hints: [
      `Group by payroll_month, filter to H1 2026. Count distinct heads and sum total_comp_usd per month.`,
      `Use lag(sum(total_comp)) over (order by payroll_month) for the prior month's comp. Delta is current minus prior; percent is 100 * delta / prior, null-guarded.`,
      MONTHLY_PAYROLL_CADENCE_SQL,
    ],
    sayIt: `"H1 payroll comp runs steady month to month with modest movement; headcount and comp deltas move together. The first month's delta is null. This is a loaded-comp cadence, not cash paid or a hiring forecast."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm210',
    part: 30,
    title: 'Tie the bridge: GL comp, payroll, gap, and the S&M anchor',
    from: 'maria',
    ask: `Close the bridge in one Finance + People handoff. Carry the recognized GL comp, the loaded payroll total comp, the dollar and percent gap, the distinct heads, the loaded cost per head, and the S&M payroll anchor that flags where the largest divisional people cost sits. Reduce each control to one row before combining.`,
    deliverable: `Exactly one row: h1_gl_comp_usd, h1_payroll_comp_usd, bridge_gap_usd, bridge_gap_pct, distinct_heads, loaded_cost_per_head_usd, sm_payroll_comp_usd. Round dollars and percent to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_account', 'fct_payroll_monthly', 'dim_department'],
    canonical: BRIDGE_TIE_SQL,
    solutionSql: BRIDGE_TIE_SQL,
    solutionNote: `The H1 people-cost bridge handoff: recognized GL comp $62.97M against loaded payroll $73.91M, a $10.95M gap (+17.4%); 717 distinct heads at a loaded cost per head computed off total comp; S&M anchors the divisional payroll at $31.92M. This is a reconciliation handoff — not cash paid, an accrual assertion, a headcount forecast, or a cause attribution for the gap.`,
    ordered: false,
    fingerprintSQL: BRIDGE_TIE_DROP_GAP_TRAP_SQL,
    fingerprintMessage: `Your handoff zeroes out the bridge gap and percent, dropping the reconciliation that is the whole point of the bridge. Compute the gap as payroll minus GL and the percent as 100 * gap / GL so leadership sees how far loaded exceeds recognized.`,
    hints: [
      `Build one-row GL comp, payroll (total + distinct heads), and S&M payroll controls. CROSS JOIN only those reduced single-row outputs.`,
      `Gap is payroll minus GL; percent is 100 * gap / GL, null-guarded. Loaded cost per head is payroll total / distinct heads.`,
      BRIDGE_TIE_SQL,
    ],
    sayIt: `"H1 people-cost bridge: recognized GL comp $62.97 million against loaded payroll $73.91 million, a $10.95 million gap. 717 distinct heads; S&M anchors the divisional payroll at $31.92 million. This is a reconciliation handoff — not cash, an accrual assertion, or a cause attribution."`,
    jdCompanies: ['Datadog'],
  },
]
