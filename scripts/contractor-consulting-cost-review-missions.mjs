// One controlled Star67 external-labor review: keep paid contractors and
// vendor consulting as separate channels, reconcile each at its native grain,
// and combine them without claiming hours, rates, capacity, or productivity.

const GL_DEDUPE_CTE = `deduped_gl AS (
  SELECT *
  FROM fct_gl_transactions
  WHERE txn_date >= DATE '2026-01-01'
    AND txn_date < DATE '2026-07-01'
  QUALIFY row_number() OVER (
    PARTITION BY
      je_id, txn_date, posted_at, account_id, dept_id, vendor_id,
      customer_id, memo, amount, source_system
    ORDER BY txn_id
  ) = 1
)`

const CONTRACTOR_POPULATION_SQL = `WITH contractor_payroll AS (
  SELECT
    p.payroll_month,
    p.employee_id,
    p.total_comp_usd
  FROM fct_payroll_monthly p
  JOIN dim_employee e USING (employee_id)
  WHERE e.employment_type = 'Contractor'
    AND p.payroll_month >= DATE '2026-01-01'
    AND p.payroll_month < DATE '2026-07-01'
)
SELECT
  count(DISTINCT employee_id)::BIGINT AS paid_contractors,
  count(*)::BIGINT AS contractor_employee_months,
  round(sum(cast(total_comp_usd AS DECIMAL(18, 2))), 2)
    AS h1_contractor_payroll_usd
FROM contractor_payroll`

const ACTIVE_ROSTER_CONTRACTOR_SQL = `WITH active_contractors AS (
  SELECT employee_id
  FROM dim_employee
  WHERE employment_type = 'Contractor'
    AND hire_date <= DATE '2026-06-30'
    AND (termination_date IS NULL OR termination_date > DATE '2026-06-30')
), contractor_payroll AS (
  SELECT p.*
  FROM fct_payroll_monthly p
  JOIN active_contractors e USING (employee_id)
  WHERE p.payroll_month >= DATE '2026-01-01'
    AND p.payroll_month < DATE '2026-07-01'
)
SELECT
  count(DISTINCT employee_id)::BIGINT AS paid_contractors,
  count(*)::BIGINT AS contractor_employee_months,
  round(sum(cast(total_comp_usd AS DECIMAL(18, 2))), 2)
    AS h1_contractor_payroll_usd
FROM contractor_payroll`

const CONTRACTOR_DIVISION_SQL = `WITH contractor_payroll AS (
  SELECT
    d.division,
    p.employee_id,
    cast(p.total_comp_usd AS DECIMAL(18, 2)) AS total_comp_usd
  FROM fct_payroll_monthly p
  JOIN dim_employee e USING (employee_id)
  JOIN dim_department d ON p.dept_id = d.dept_id
  WHERE e.employment_type = 'Contractor'
    AND p.payroll_month >= DATE '2026-01-01'
    AND p.payroll_month < DATE '2026-07-01'
)
SELECT
  division,
  count(DISTINCT employee_id)::BIGINT AS paid_contractors,
  count(*)::BIGINT AS contractor_employee_months,
  round(sum(total_comp_usd), 2) AS h1_contractor_payroll_usd
FROM contractor_payroll
GROUP BY division
ORDER BY h1_contractor_payroll_usd DESC, division`

const JUNE_ONLY_CONTRACTOR_DIVISION_SQL = CONTRACTOR_DIVISION_SQL.replace(
  `p.payroll_month >= DATE '2026-01-01'\n    AND p.payroll_month < DATE '2026-07-01'`,
  `p.payroll_month = DATE '2026-06-01'`,
)

const CONSULTING_DEDUPE_AUDIT_SQL = `WITH raw_6040 AS (
  SELECT *
  FROM fct_gl_transactions
  WHERE account_id = '6040'
    AND txn_date >= DATE '2026-01-01'
    AND txn_date < DATE '2026-07-01'
), ${GL_DEDUPE_CTE}, consulting AS (
  SELECT *
  FROM deduped_gl
  WHERE account_id = '6040'
)
SELECT
  (SELECT count(*) FROM raw_6040)::BIGINT AS raw_consulting_lines,
  count(*)::BIGINT AS deduped_consulting_lines,
  ((SELECT count(*) FROM raw_6040) - count(*))::BIGINT
    AS exact_copy_duplicate_lines,
  count(DISTINCT vendor_id)::BIGINT AS consulting_vendors,
  round(sum(cast(amount AS DECIMAL(18, 2))), 2) AS h1_consulting_usd
FROM consulting`

const MEMO_OVER_DEDUPE_AUDIT_SQL = `WITH raw_6040 AS (
  SELECT *
  FROM fct_gl_transactions
  WHERE account_id = '6040'
    AND txn_date >= DATE '2026-01-01'
    AND txn_date < DATE '2026-07-01'
), consulting AS (
  SELECT *
  FROM raw_6040
  QUALIFY row_number() OVER (
    PARTITION BY memo
    ORDER BY txn_id
  ) = 1
)
SELECT
  (SELECT count(*) FROM raw_6040)::BIGINT AS raw_consulting_lines,
  count(*)::BIGINT AS deduped_consulting_lines,
  ((SELECT count(*) FROM raw_6040) - count(*))::BIGINT
    AS exact_copy_duplicate_lines,
  count(DISTINCT vendor_id)::BIGINT AS consulting_vendors,
  round(sum(cast(amount AS DECIMAL(18, 2))), 2) AS h1_consulting_usd
FROM consulting`

const CONSULTING_ACTUAL_V_PLAN_SQL = `WITH ${GL_DEDUPE_CTE}, actual AS (
  SELECT
    d.division,
    sum(cast(g.amount AS DECIMAL(18, 2))) AS actual_usd
  FROM deduped_gl g
  JOIN dim_department d USING (dept_id)
  WHERE g.account_id = '6040'
  GROUP BY d.division
), plan AS (
  SELECT
    d.division,
    sum(cast(b.amount_usd AS DECIMAL(18, 2))) AS plan_usd
  FROM fct_budget b
  JOIN dim_department d
    ON upper(trim(b.dept_name_raw)) = upper(trim(d.dept_name))
  WHERE b.version_name = 'FY2026 Plan'
    AND b.account_id = '6040'
    AND b.fiscal_month >= DATE '2026-01-01'
    AND b.fiscal_month < DATE '2026-07-01'
  GROUP BY d.division
), compared AS (
  SELECT
    coalesce(a.division, p.division) AS division,
    coalesce(a.actual_usd, 0) AS actual_usd,
    coalesce(p.plan_usd, 0) AS plan_usd
  FROM actual a
  FULL OUTER JOIN plan p USING (division)
)
SELECT
  division,
  round(actual_usd, 2) AS h1_consulting_actual_usd,
  round(plan_usd, 2) AS h1_consulting_plan_usd,
  round(actual_usd - plan_usd, 2) AS consulting_variance_usd
FROM compared
ORDER BY consulting_variance_usd DESC, division`

const FANOUT_CONSULTING_ACTUAL_V_PLAN_SQL = `WITH ${GL_DEDUPE_CTE}, joined AS (
  SELECT
    d.division,
    cast(g.amount AS DECIMAL(18, 2)) AS actual_usd,
    cast(b.amount_usd AS DECIMAL(18, 2)) AS plan_usd
  FROM deduped_gl g
  JOIN dim_department d USING (dept_id)
  JOIN fct_budget b
    ON b.account_id = g.account_id
   AND upper(trim(b.dept_name_raw)) = upper(trim(d.dept_name))
  WHERE g.account_id = '6040'
    AND b.version_name = 'FY2026 Plan'
    AND b.fiscal_month >= DATE '2026-01-01'
    AND b.fiscal_month < DATE '2026-07-01'
)
SELECT
  division,
  round(sum(actual_usd), 2) AS h1_consulting_actual_usd,
  round(sum(plan_usd), 2) AS h1_consulting_plan_usd,
  round(sum(actual_usd) - sum(plan_usd), 2) AS consulting_variance_usd
FROM joined
GROUP BY division
ORDER BY consulting_variance_usd DESC, division`

const makeTwoChannelDivisionSql = (joinKind) => `WITH ${GL_DEDUPE_CTE}, payroll AS (
  SELECT
    d.division,
    sum(cast(p.total_comp_usd AS DECIMAL(18, 2))) AS contractor_payroll_usd
  FROM fct_payroll_monthly p
  JOIN dim_employee e USING (employee_id)
  JOIN dim_department d ON p.dept_id = d.dept_id
  WHERE e.employment_type = 'Contractor'
    AND p.payroll_month >= DATE '2026-01-01'
    AND p.payroll_month < DATE '2026-07-01'
  GROUP BY d.division
), consulting AS (
  SELECT
    d.division,
    sum(cast(g.amount AS DECIMAL(18, 2))) AS vendor_consulting_usd
  FROM deduped_gl g
  JOIN dim_department d USING (dept_id)
  WHERE g.account_id = '6040'
  GROUP BY d.division
), combined AS (
  SELECT
    coalesce(p.division, c.division) AS division,
    coalesce(p.contractor_payroll_usd, 0) AS contractor_payroll_usd,
    coalesce(c.vendor_consulting_usd, 0) AS vendor_consulting_usd
  FROM payroll p
  ${joinKind} JOIN consulting c USING (division)
)
SELECT
  division,
  round(contractor_payroll_usd, 2) AS h1_contractor_payroll_usd,
  round(vendor_consulting_usd, 2) AS h1_vendor_consulting_usd,
  round(contractor_payroll_usd + vendor_consulting_usd, 2)
    AS h1_combined_external_labor_usd,
  round(
    100.0 * (contractor_payroll_usd + vendor_consulting_usd)
      / sum(contractor_payroll_usd + vendor_consulting_usd) OVER (),
    1
  ) AS combined_external_labor_share_pct
FROM combined
ORDER BY h1_combined_external_labor_usd DESC, division`

const TWO_CHANNEL_DIVISION_SQL = makeTwoChannelDivisionSql('FULL OUTER')
const INNER_JOINED_TWO_CHANNEL_DIVISION_SQL = makeTwoChannelDivisionSql('INNER')

const VENDOR_CONCENTRATION_SQL = `WITH ${GL_DEDUPE_CTE}, vendor_spend AS (
  SELECT
    g.vendor_id,
    v.vendor_name,
    sum(cast(g.amount AS DECIMAL(18, 2))) AS spend_usd
  FROM deduped_gl g
  JOIN dim_vendor v USING (vendor_id)
  WHERE g.account_id = '6040'
  GROUP BY g.vendor_id, v.vendor_name
), ranked AS (
  SELECT
    *,
    row_number() OVER (ORDER BY spend_usd DESC, vendor_id) AS spend_rank,
    sum(spend_usd) OVER () AS total_consulting_usd
  FROM vendor_spend
)
SELECT
  arg_min(vendor_name, spend_rank) AS top_vendor_name,
  round(max(spend_usd) FILTER (WHERE spend_rank = 1), 2) AS top_vendor_spend_usd,
  count(*)::BIGINT AS consulting_vendors,
  round(sum(spend_usd) FILTER (WHERE spend_rank <= 3), 2) AS top_3_spend_usd,
  round(max(total_consulting_usd), 2) AS total_consulting_usd,
  round(
    100.0 * sum(spend_usd) FILTER (WHERE spend_rank <= 3)
      / max(total_consulting_usd),
    1
  ) AS top_3_vendor_concentration_pct
FROM ranked`

const TOP_THREE_DENOMINATOR_SQL = `WITH ${GL_DEDUPE_CTE}, vendor_spend AS (
  SELECT
    g.vendor_id,
    v.vendor_name,
    sum(cast(g.amount AS DECIMAL(18, 2))) AS spend_usd
  FROM deduped_gl g
  JOIN dim_vendor v USING (vendor_id)
  WHERE g.account_id = '6040'
  GROUP BY g.vendor_id, v.vendor_name
), ranked AS (
  SELECT
    *,
    row_number() OVER (ORDER BY spend_usd DESC, vendor_id) AS spend_rank
  FROM vendor_spend
), top_three AS (
  SELECT *
  FROM ranked
  WHERE spend_rank <= 3
)
SELECT
  arg_min(vendor_name, spend_rank) AS top_vendor_name,
  round(max(spend_usd) FILTER (WHERE spend_rank = 1), 2) AS top_vendor_spend_usd,
  count(*)::BIGINT AS consulting_vendors,
  round(sum(spend_usd), 2) AS top_3_spend_usd,
  round(sum(spend_usd), 2) AS total_consulting_usd,
  round(100.0 * sum(spend_usd) / sum(spend_usd), 1)
    AS top_3_vendor_concentration_pct
FROM top_three`

const makeHandoffSql = (contractorFilter) => `WITH ${GL_DEDUPE_CTE}, contractor_population AS (
  SELECT
    count(DISTINCT p.employee_id)::BIGINT AS paid_contractors,
    count(*)::BIGINT AS contractor_employee_months,
    sum(cast(p.total_comp_usd AS DECIMAL(18, 2))) AS contractor_payroll_usd
  FROM fct_payroll_monthly p
  JOIN dim_employee e USING (employee_id)
  WHERE ${contractorFilter}
    AND p.payroll_month >= DATE '2026-01-01'
    AND p.payroll_month < DATE '2026-07-01'
), consulting_actual AS (
  SELECT
    count(*)::BIGINT AS deduped_consulting_lines,
    count(DISTINCT vendor_id)::BIGINT AS consulting_vendors,
    sum(cast(amount AS DECIMAL(18, 2))) AS consulting_actual_usd
  FROM deduped_gl
  WHERE account_id = '6040'
), consulting_raw AS (
  SELECT count(*)::BIGINT AS raw_consulting_lines
  FROM fct_gl_transactions
  WHERE account_id = '6040'
    AND txn_date >= DATE '2026-01-01'
    AND txn_date < DATE '2026-07-01'
), consulting_plan AS (
  SELECT sum(cast(amount_usd AS DECIMAL(18, 2))) AS consulting_plan_usd
  FROM fct_budget
  WHERE version_name = 'FY2026 Plan'
    AND account_id = '6040'
    AND fiscal_month >= DATE '2026-01-01'
    AND fiscal_month < DATE '2026-07-01'
), payroll_division AS (
  SELECT
    d.division,
    sum(cast(p.total_comp_usd AS DECIMAL(18, 2))) AS contractor_payroll_usd
  FROM fct_payroll_monthly p
  JOIN dim_employee e USING (employee_id)
  JOIN dim_department d ON p.dept_id = d.dept_id
  WHERE ${contractorFilter}
    AND p.payroll_month >= DATE '2026-01-01'
    AND p.payroll_month < DATE '2026-07-01'
  GROUP BY d.division
), consulting_division AS (
  SELECT
    d.division,
    sum(cast(g.amount AS DECIMAL(18, 2))) AS vendor_consulting_usd
  FROM deduped_gl g
  JOIN dim_department d USING (dept_id)
  WHERE g.account_id = '6040'
  GROUP BY d.division
), division_combined AS (
  SELECT
    coalesce(p.division, c.division) AS division,
    coalesce(p.contractor_payroll_usd, 0)
      + coalesce(c.vendor_consulting_usd, 0) AS combined_external_labor_usd
  FROM payroll_division p
  FULL OUTER JOIN consulting_division c USING (division)
), top_division AS (
  SELECT division, combined_external_labor_usd
  FROM division_combined
  ORDER BY combined_external_labor_usd DESC, division
  LIMIT 1
), vendor_spend AS (
  SELECT
    g.vendor_id,
    v.vendor_name,
    sum(cast(g.amount AS DECIMAL(18, 2))) AS spend_usd
  FROM deduped_gl g
  JOIN dim_vendor v USING (vendor_id)
  WHERE g.account_id = '6040'
  GROUP BY g.vendor_id, v.vendor_name
), ranked_vendors AS (
  SELECT
    *,
    row_number() OVER (ORDER BY spend_usd DESC, vendor_id) AS spend_rank,
    sum(spend_usd) OVER () AS total_consulting_usd
  FROM vendor_spend
), vendor_control AS (
  SELECT
    arg_min(vendor_name, spend_rank) AS top_vendor_name,
    max(spend_usd) FILTER (WHERE spend_rank = 1) AS top_vendor_spend_usd,
    100.0 * sum(spend_usd) FILTER (WHERE spend_rank <= 3)
      / max(total_consulting_usd) AS top_3_vendor_concentration_pct
  FROM ranked_vendors
)
SELECT
  p.paid_contractors,
  p.contractor_employee_months,
  round(p.contractor_payroll_usd, 2) AS h1_contractor_payroll_usd,
  r.raw_consulting_lines,
  a.deduped_consulting_lines,
  (r.raw_consulting_lines - a.deduped_consulting_lines)::BIGINT
    AS exact_copy_duplicate_lines,
  a.consulting_vendors,
  round(a.consulting_actual_usd, 2) AS h1_consulting_actual_usd,
  round(pl.consulting_plan_usd, 2) AS h1_consulting_plan_usd,
  round(a.consulting_actual_usd - pl.consulting_plan_usd, 2)
    AS consulting_variance_usd,
  round(p.contractor_payroll_usd + a.consulting_actual_usd, 2)
    AS h1_combined_external_labor_usd,
  d.division AS largest_external_labor_division,
  round(d.combined_external_labor_usd, 2)
    AS largest_division_external_labor_usd,
  round(
    100.0 * d.combined_external_labor_usd
      / (p.contractor_payroll_usd + a.consulting_actual_usd),
    1
  ) AS largest_division_external_labor_share_pct,
  v.top_vendor_name,
  round(v.top_vendor_spend_usd, 2) AS top_vendor_spend_usd,
  round(v.top_3_vendor_concentration_pct, 1)
    AS top_3_vendor_concentration_pct
FROM contractor_population p
CROSS JOIN consulting_raw r
CROSS JOIN consulting_actual a
CROSS JOIN consulting_plan pl
CROSS JOIN top_division d
CROSS JOIN vendor_control v`

const HANDOFF_SQL = makeHandoffSql(`e.employment_type = 'Contractor'`)
const ALL_EMPLOYEE_HANDOFF_SQL = makeHandoffSql(`e.employment_type IS NOT NULL`)

export const CONTRACTOR_CONSULTING_COST_REVIEW_MISSIONS = [
  {
    id: 'm156',
    part: 24,
    title: 'Define the paid-contractor population',
    from: 'priya',
    ask: `Start the external-labor review with the payroll channel. Count every person coded Contractor who has an H1 payroll row, the native employee-month population, and loaded payroll dollars. A person paid in several months remains one person and several employee-months; do not turn this into June 30 headcount.`,
    deliverable: `Exactly one row: paid_contractors, contractor_employee_months, and h1_contractor_payroll_usd. Use January 1 through June 30, round dollars to 2, and keep the two population counts separate.`,
    tables: ['fct_payroll_monthly', 'dim_employee'],
    canonical: CONTRACTOR_POPULATION_SQL,
    solutionSql: CONTRACTOR_POPULATION_SQL,
    solutionNote: `H1 payroll contains 45 paid contractors across 258 contractor employee-months and $4,756,841.46 of loaded payroll. These are payroll populations and dollars, not hours, rates, contracted capacity, productivity, or June 30 active headcount.`,
    ordered: false,
    fingerprintSQL: ACTIVE_ROSTER_CONTRACTOR_SQL,
    fingerprintMessage: `You filtered H1 payroll through the June 30 active roster, which drops people who were paid earlier in the half but were no longer active at period end. Define the population from H1 paid contractor rows, then count distinct people and employee-months separately.`,
    hints: [
      `Begin with payroll, not the employee dimension: each H1 payroll row is one paid employee-month. Join the employment type only to identify Contractor rows.`,
      `Filter payroll_month with a half-open H1 range, count distinct employee_id for people, count rows for employee-months, and sum loaded total_comp_usd.`,
      CONTRACTOR_POPULATION_SQL,
    ],
    sayIt: `"The payroll channel contains 45 paid contractors, 258 employee-months, and $4.76 million of H1 loaded cost. I keep people and employee-months separate and make no claim about hours, utilization, or period-end headcount."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm157',
    part: 24,
    title: 'Place contractor payroll by division',
    from: 'elena',
    ask: `Put the paid-contractor channel into the operating review by payroll division. Use the department carried on each payroll row, preserve both distinct paid people and employee-months, and sum loaded payroll across the full half. Do not multiply June by six or call these rows headcount.`,
    deliverable: `One row per division: division, paid_contractors, contractor_employee_months, and h1_contractor_payroll_usd. Round dollars to 2; order largest payroll dollars first, then division.`,
    tables: ['fct_payroll_monthly', 'dim_employee', 'dim_department'],
    canonical: CONTRACTOR_DIVISION_SQL,
    solutionSql: CONTRACTOR_DIVISION_SQL,
    solutionNote: `The division view preserves all 45 paid contractors, 258 employee-months, and $4,756,841.46 of H1 payroll. Division follows the payroll row's department, so the cost placement remains historical rather than a current-org rewrite.`,
    ordered: true,
    orderedNote: 'largest H1 contractor payroll first, then division',
    fingerprintSQL: JUNE_ONLY_CONTRACTOR_DIVISION_SQL,
    fingerprintMessage: `This is June's paid-contractor book, not H1. Aggregate all six payroll months at employee-month grain; June multiplied or shown alone cannot recover starts, exits, or historical division placement.`,
    hints: [
      `Keep the H1 payroll rows at their native grain and map p.dept_id to dim_department.division. The employee table supplies only the Contractor classification.`,
      `Group the six-month population by division, count distinct employee_id and all rows separately, then sum total_comp_usd.`,
      CONTRACTOR_DIVISION_SQL,
    ],
    sayIt: `"I placed $4.76 million of H1 contractor payroll using each paid month's department. The row counts are employee-months, not staffing capacity or a June headcount snapshot."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm158',
    part: 24,
    title: 'Audit the consulting GL channel',
    from: 'maria',
    ask: `Now control account 6040, Contractors & Consulting. Compare raw H1 lines with an exact-copy deduplicated population, where identity is every GL field except synthetic txn_id. Also show vendor coverage and dollars. Similar memos are recurring services, not duplicate authority.`,
    deliverable: `Exactly one row: raw_consulting_lines, deduped_consulting_lines, exact_copy_duplicate_lines, consulting_vendors, and h1_consulting_usd. Round dollars to 2.`,
    tables: ['fct_gl_transactions'],
    canonical: CONSULTING_DEDUPE_AUDIT_SQL,
    solutionSql: CONSULTING_DEDUPE_AUDIT_SQL,
    solutionNote: `The H1 6040 control has 288 raw lines, 288 exact-copy-deduplicated lines, zero exact-copy duplicates, 11 vendors, and $6,603,799.66. Repeated vendor memos are legitimate recurring lines, so memo-only deduplication destroys the book.`,
    ordered: false,
    fingerprintSQL: MEMO_OVER_DEDUPE_AUDIT_SQL,
    fingerprintMessage: `You treated a repeated memo as a duplicate and collapsed recurring consulting lines. Exact-copy identity is every GL field except txn_id; the controlled H1 fixture has 288 raw and 288 deduplicated 6040 lines.`,
    requireRegex: String.raw`row_number\s*\(\s*\)\s*over\s*\([\s\S]*partition\s+by`,
    requireMessage: `Your values match because this H1 slice contains no exact-copy 6040 duplicates. Keep an explicit full-row-except-txn_id dedupe in the control so a future duplicate batch cannot silently inflate the book.`,
    hints: [
      `Build a raw 6040 H1 CTE and a separately deduplicated H1 GL CTE. The control compares those two populations rather than assuming a duplicate exists.`,
      `ROW_NUMBER should partition by je_id, both dates, account, department, vendor, customer, memo, amount, and source system—everything except txn_id.`,
      CONSULTING_DEDUPE_AUDIT_SQL,
    ],
    sayIt: `"Account 6040 contains 288 controlled lines, 11 vendors, and $6.60 million. Exact-copy deduplication removes zero lines; memo-only deduplication would erase valid recurring services."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm159',
    part: 24,
    title: 'Reconcile consulting actual to plan',
    from: 'danny',
    ask: `Compare exact-copy-deduplicated H1 account 6040 actuals with the FY2026 Plan by division. Aggregate each channel to division before joining; raw GL lines and monthly budget rows cannot be joined directly without multiplying both sides. Preserve one-sided divisions.`,
    deliverable: `One row per division: division, h1_consulting_actual_usd, h1_consulting_plan_usd, and consulting_variance_usd defined as actual minus plan. Round dollars to 2; order largest overspend first, then division.`,
    tables: ['fct_gl_transactions', 'fct_budget', 'dim_department'],
    canonical: CONSULTING_ACTUAL_V_PLAN_SQL,
    solutionSql: CONSULTING_ACTUAL_V_PLAN_SQL,
    solutionNote: `Across divisions, H1 consulting actual is $6,603,799.66 against $6,596,760.21 of FY2026 Plan, a $7,039.45 overspend. The control aggregates each side before its full outer comparison, preventing a line-by-month fanout.`,
    ordered: true,
    orderedNote: 'largest consulting overspend first, then division',
    fingerprintSQL: FANOUT_CONSULTING_ACTUAL_V_PLAN_SQL,
    fingerprintMessage: `The actual and plan dollars multiplied because raw 6040 lines joined multiple monthly budget rows inside each department. Aggregate actual and plan independently to division, then compare the two small result sets.`,
    hints: [
      `Treat actual and plan as separate workbook tabs. Actual starts from deduplicated 6040 lines; plan starts from FY2026 Plan 6040 rows in the same half.`,
      `Map both channels to division, aggregate each one first, then FULL OUTER JOIN and coalesce missing dollars to zero. Variance is actual minus plan.`,
      CONSULTING_ACTUAL_V_PLAN_SQL,
    ],
    sayIt: `"H1 account 6040 is $6.604 million actual against $6.597 million planned, a $7 thousand overspend. I reduced actual and plan to division before joining, so the comparison has no line-by-month fanout."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm160',
    part: 24,
    title: 'Combine the two external-labor channels',
    from: 'priya',
    ask: `Build the division view for total external-labor cost. One channel is loaded payroll for people coded Contractor; the other is vendor-backed account 6040 consulting. Aggregate each independently, then full-outer the division sets so a division present on only one channel remains visible. Do not add their people, lines, or vendors into a fake headcount.`,
    deliverable: `One row per represented division: division, h1_contractor_payroll_usd, h1_vendor_consulting_usd, h1_combined_external_labor_usd, and combined_external_labor_share_pct. Round dollars to 2 and share to 1; order largest combined cost first, then division.`,
    tables: ['fct_payroll_monthly', 'dim_employee', 'fct_gl_transactions', 'dim_department'],
    canonical: TWO_CHANNEL_DIVISION_SQL,
    solutionSql: TWO_CHANNEL_DIVISION_SQL,
    solutionNote: `The two controlled channels combine to $11,360,641.12. R&D carries $6,546,332.38, or 57.6%, while the full outer join retains divisions represented by payroll even when account 6040 has no corresponding vendor spend.`,
    ordered: true,
    orderedNote: 'largest combined external-labor cost first, then division',
    fingerprintSQL: INNER_JOINED_TWO_CHANNEL_DIVISION_SQL,
    fingerprintMessage: `The INNER JOIN discarded divisions represented on only one external-labor channel. Keep payroll and vendor consulting as separate division aggregates and FULL OUTER JOIN them before calculating combined cost and share.`,
    hints: [
      `Build one division CTE from H1 paid contractors and another from deduplicated H1 account 6040. These are dollars with different source grains.`,
      `FULL OUTER JOIN the division aggregates, coalesce missing dollars to zero, then calculate combined dollars and its share of the retained company total.`,
      TWO_CHANNEL_DIVISION_SQL,
    ],
    sayIt: `"The two external-labor channels total $11.36 million. R&D carries $6.55 million, or 57.6%; that is cost exposure, not evidence about hours, capacity, productivity, quality, or hiring conversion."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm161',
    part: 24,
    title: 'Measure consulting vendor concentration',
    from: 'elena',
    ask: `Size concentration inside the controlled 6040 vendor book. Rank vendors by exact-copy-deduplicated H1 dollars, identify the largest, and calculate the top-three share against all consulting vendors—not against the top three themselves. Vendor spend does not reveal hours, rates, contracts, deliverables, or quality.`,
    deliverable: `Exactly one row: top_vendor_name, top_vendor_spend_usd, consulting_vendors, top_3_spend_usd, total_consulting_usd, and top_3_vendor_concentration_pct. Round dollars to 2 and percentage to 1.`,
    tables: ['fct_gl_transactions', 'dim_vendor'],
    canonical: VENDOR_CONCENTRATION_SQL,
    solutionSql: VENDOR_CONCENTRATION_SQL,
    solutionNote: `Beacon Collective is the largest 6040 vendor at $782,236.60. The top three vendors represent 32.5% of the complete $6,603,799.66 book across 11 vendors; their numerator must remain separate from the full-book denominator.`,
    ordered: false,
    fingerprintSQL: TOP_THREE_DENOMINATOR_SQL,
    fingerprintMessage: `You filtered to the top three before preserving the full consulting denominator, making the concentration read 100%. Carry the all-vendor total through the ranking and use it beneath the top-three numerator.`,
    hints: [
      `Aggregate deduplicated 6040 dollars by vendor first. The ranking and total denominator both belong on the complete vendor set.`,
      `Use ROW_NUMBER for the top-three numerator and SUM(spend_usd) OVER () for the full denominator before any rank filter.`,
      VENDOR_CONCENTRATION_SQL,
    ],
    sayIt: `"Beacon Collective is the largest consulting vendor at $782 thousand, and the top three are 32.5% of the full 11-vendor book. Spend concentration is a review signal, not a claim about rates, delivery, or quality."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm162',
    part: 24,
    title: 'Package the external-labor handoff',
    from: 'maria',
    ask: `Close the review in one Finance and People handoff row. Carry the contractor population and payroll, 6040 line control, vendor coverage, actual-to-plan consulting variance, combined external-labor total, largest-cost division and share, and vendor concentration. Reduce every source to one row before combining it, and keep the Contractor filter on both payroll controls.`,
    deliverable: `Exactly one row with paid_contractors, contractor_employee_months, h1_contractor_payroll_usd, raw_consulting_lines, deduped_consulting_lines, exact_copy_duplicate_lines, consulting_vendors, h1_consulting_actual_usd, h1_consulting_plan_usd, consulting_variance_usd, h1_combined_external_labor_usd, largest_external_labor_division, largest_division_external_labor_usd, largest_division_external_labor_share_pct, top_vendor_name, top_vendor_spend_usd, and top_3_vendor_concentration_pct. Round dollars to 2 and percentages to 1.`,
    tables: ['fct_payroll_monthly', 'dim_employee', 'fct_gl_transactions', 'fct_budget', 'dim_department', 'dim_vendor'],
    canonical: HANDOFF_SQL,
    solutionSql: HANDOFF_SQL,
    solutionNote: `The handoff preserves 45 paid contractors, 258 employee-months, and $4,756,841.46 of payroll beside 288 controlled 6040 lines, 11 vendors, and $6,603,799.66 actual versus $6,596,760.21 plan. Combined external labor is $11,360,641.12; R&D carries $6,546,332.38 or 57.6%; Beacon Collective is $782,236.60; and the top three vendors are 32.5% of the full book.`,
    ordered: false,
    fingerprintSQL: ALL_EMPLOYEE_HANDOFF_SQL,
    fingerprintMessage: `The handoff omitted the Contractor filter and turned all employee payroll into external-labor cost. Keep employment_type = 'Contractor' in both the population and division payroll controls before combining their one-row outputs.`,
    hints: [
      `Build one-row controls for paid contractors, raw versus deduplicated 6040, consulting plan, the largest combined division, and vendor concentration.`,
      `The division control must FULL OUTER JOIN the two dollar channels. The vendor control must preserve the full-book denominator. CROSS JOIN only after every handoff source is one row.`,
      HANDOFF_SQL,
    ],
    sayIt: `"H1 external labor totals $11.36 million: $4.76 million of paid-contractor payroll and $6.60 million of vendor consulting, which is $7 thousand over plan. R&D carries 57.6%, and the top three consulting vendors are 32.5%. These are controlled cost exposures, not productivity or workforce-capacity conclusions."`,
    jdCompanies: ['Affirm'],
  },
]
