const TE_RAW_DEDUP_CTES = `
raw_te AS (
  SELECT *
  FROM fct_gl_transactions
  WHERE txn_date >= DATE '2026-01-01'
    AND txn_date < DATE '2026-07-01'
    AND account_id IN ('7040', '7050')
),
ranked_te AS (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY je_id, txn_date, posted_at, account_id, dept_id,
        vendor_id, customer_id, memo, amount, source_system
      ORDER BY txn_id
    ) AS exact_copy_rank
  FROM raw_te
),
te AS (
  SELECT * EXCLUDE (exact_copy_rank)
  FROM ranked_te
  WHERE exact_copy_rank = 1
)`

const TE_DEPARTMENT_CONTROL_CTES = `
${TE_RAW_DEDUP_CTES},
actual_by_department AS (
  SELECT
    d.dept_name,
    d.division,
    d.leader_name,
    SUM(te.amount) AS actual_usd
  FROM te
  JOIN dim_department d ON d.dept_id = te.dept_id
  GROUP BY d.dept_name, d.division, d.leader_name
),
plan_by_department AS (
  SELECT
    d.dept_name,
    d.division,
    d.leader_name,
    SUM(b.amount_usd) AS plan_usd
  FROM fct_budget b
  JOIN dim_department d
    ON UPPER(TRIM(d.dept_name)) = UPPER(TRIM(b.dept_name_raw))
  WHERE b.version_name = 'FY2026 Plan'
    AND b.fiscal_month >= DATE '2026-01-01'
    AND b.fiscal_month < DATE '2026-07-01'
    AND b.account_id IN ('7040', '7050')
  GROUP BY d.dept_name, d.division, d.leader_name
),
department_control AS (
  SELECT
    COALESCE(a.dept_name, p.dept_name) AS dept_name,
    COALESCE(a.division, p.division) AS division,
    COALESCE(a.leader_name, p.leader_name) AS leader_name,
    COALESCE(a.actual_usd, 0) AS actual_usd,
    COALESCE(p.plan_usd, 0) AS plan_usd,
    COALESCE(a.actual_usd, 0) - COALESCE(p.plan_usd, 0) AS variance_usd
  FROM actual_by_department a
  FULL OUTER JOIN plan_by_department p ON p.dept_name = a.dept_name
)`

const TE_EXPOSURE_CTES = `
${TE_DEPARTMENT_CONTROL_CTES},
payroll AS (
  SELECT dept_id, COUNT(*) AS paid_employee_months
  FROM fct_payroll_monthly
  WHERE payroll_month >= DATE '2026-01-01'
    AND payroll_month < DATE '2026-07-01'
  GROUP BY dept_id
),
exposure AS (
  SELECT
    d.dept_name,
    d.division,
    d.leader_name,
    d.actual_usd,
    d.plan_usd,
    d.variance_usd,
    p.paid_employee_months,
    CASE
      WHEN p.paid_employee_months IS NULL OR p.paid_employee_months = 0 THEN NULL
      ELSE d.actual_usd / p.paid_employee_months
    END AS spend_per_paid_employee_month_usd
  FROM department_control d
  JOIN dim_department dd ON dd.dept_name = d.dept_name
  LEFT JOIN payroll p ON p.dept_id = dd.dept_id
)`

const SOURCE_AUDIT_SQL = `WITH ${TE_RAW_DEDUP_CTES},
raw_control AS (
  SELECT COUNT(*) AS raw_te_lines
  FROM raw_te
),
deduped_control AS (
  SELECT
    COUNT(*) AS deduped_te_lines,
    COUNT(DISTINCT vendor_id) AS te_vendors,
    COUNT(DISTINCT dept_id) AS te_departments,
    SUM(CASE WHEN source_system IS NULL OR source_system <> 'Expensify' THEN 1 ELSE 0 END) AS unexpected_source_lines,
    SUM(CASE WHEN vendor_id IS NULL THEN 1 ELSE 0 END) AS missing_vendor_lines,
    SUM(CASE WHEN dept_id IS NULL THEN 1 ELSE 0 END) AS missing_department_lines,
    SUM(amount) AS h1_te_actual_usd
  FROM te
)
SELECT
  r.raw_te_lines,
  d.deduped_te_lines,
  r.raw_te_lines - d.deduped_te_lines AS exact_copy_duplicate_lines,
  d.te_vendors,
  d.te_departments,
  d.unexpected_source_lines,
  d.missing_vendor_lines,
  d.missing_department_lines,
  ROUND(d.h1_te_actual_usd, 2) AS h1_te_actual_usd
FROM raw_control r
CROSS JOIN deduped_control d`

const TRAVEL_ONLY_SOURCE_AUDIT_SQL = SOURCE_AUDIT_SQL.replaceAll(
  "account_id IN ('7040', '7050')",
  "account_id = '7040'",
)

const ACCOUNT_MIX_SQL = `WITH ${TE_RAW_DEDUP_CTES},
actual_by_account AS (
  SELECT account_id, SUM(amount) AS actual_usd
  FROM te
  GROUP BY account_id
),
plan_by_account AS (
  SELECT account_id, SUM(amount_usd) AS plan_usd
  FROM fct_budget
  WHERE version_name = 'FY2026 Plan'
    AND fiscal_month >= DATE '2026-01-01'
    AND fiscal_month < DATE '2026-07-01'
    AND account_id IN ('7040', '7050')
  GROUP BY account_id
),
compared AS (
  SELECT
    COALESCE(a.account_id, p.account_id) AS account_id,
    COALESCE(a.actual_usd, 0) AS actual_usd,
    COALESCE(p.plan_usd, 0) AS plan_usd
  FROM actual_by_account a
  FULL OUTER JOIN plan_by_account p ON p.account_id = a.account_id
)
SELECT
  CASE account_id WHEN '7040' THEN 'Travel' WHEN '7050' THEN 'Meals' END AS spend_type,
  ROUND(actual_usd, 2) AS h1_actual_usd,
  ROUND(100.0 * actual_usd / SUM(actual_usd) OVER (), 1) AS actual_mix_pct,
  ROUND(plan_usd, 2) AS h1_plan_usd,
  ROUND(actual_usd - plan_usd, 2) AS variance_usd,
  ROUND(100.0 * (actual_usd - plan_usd) / NULLIF(plan_usd, 0), 1) AS variance_pct
FROM compared
ORDER BY h1_actual_usd DESC, spend_type`

const COLLAPSED_ACCOUNT_MIX_SQL = `WITH ${TE_RAW_DEDUP_CTES},
actual AS (
  SELECT SUM(amount) AS actual_usd FROM te
),
plan AS (
  SELECT SUM(amount_usd) AS plan_usd
  FROM fct_budget
  WHERE version_name = 'FY2026 Plan'
    AND fiscal_month >= DATE '2026-01-01'
    AND fiscal_month < DATE '2026-07-01'
    AND account_id IN ('7040', '7050')
)
SELECT
  'Travel & meals' AS spend_type,
  ROUND(a.actual_usd, 2) AS h1_actual_usd,
  100.0 AS actual_mix_pct,
  ROUND(p.plan_usd, 2) AS h1_plan_usd,
  ROUND(a.actual_usd - p.plan_usd, 2) AS variance_usd,
  ROUND(100.0 * (a.actual_usd - p.plan_usd) / NULLIF(p.plan_usd, 0), 1) AS variance_pct
FROM actual a
CROSS JOIN plan p`

const MONTHLY_CADENCE_SQL = `WITH ${TE_RAW_DEDUP_CTES},
actual_month AS (
  SELECT DATE_TRUNC('month', txn_date)::DATE AS month_start, SUM(amount) AS actual_usd
  FROM te
  GROUP BY 1
),
plan_month AS (
  SELECT fiscal_month AS month_start, SUM(amount_usd) AS plan_usd
  FROM fct_budget
  WHERE version_name = 'FY2026 Plan'
    AND fiscal_month >= DATE '2026-01-01'
    AND fiscal_month < DATE '2026-07-01'
    AND account_id IN ('7040', '7050')
  GROUP BY fiscal_month
),
months AS (
  SELECT
    COALESCE(a.month_start, p.month_start) AS month_start,
    COALESCE(a.actual_usd, 0) AS monthly_actual_usd,
    COALESCE(p.plan_usd, 0) AS monthly_plan_usd
  FROM actual_month a
  FULL OUTER JOIN plan_month p ON p.month_start = a.month_start
),
quarter_rollup AS (
  SELECT
    CASE WHEN month_start < DATE '2026-04-01' THEN 'Q1' ELSE 'Q2' END AS quarter_label,
    SUM(monthly_actual_usd) AS quarter_actual_usd,
    SUM(monthly_plan_usd) AS quarter_plan_usd
  FROM months
  GROUP BY 1
),
quarter_comparison AS (
  SELECT *, LAG(quarter_actual_usd) OVER (ORDER BY quarter_label) AS prior_quarter_actual_usd
  FROM quarter_rollup
)
SELECT
  m.month_start,
  q.quarter_label,
  ROUND(m.monthly_actual_usd, 2) AS monthly_actual_usd,
  ROUND(m.monthly_plan_usd, 2) AS monthly_plan_usd,
  ROUND(m.monthly_actual_usd - m.monthly_plan_usd, 2) AS monthly_variance_usd,
  ROUND(q.quarter_actual_usd, 2) AS quarter_actual_usd,
  ROUND(q.prior_quarter_actual_usd, 2) AS prior_quarter_actual_usd,
  ROUND(q.quarter_actual_usd - q.prior_quarter_actual_usd, 2) AS quarter_change_usd,
  ROUND(100.0 * (q.quarter_actual_usd - q.prior_quarter_actual_usd)
    / NULLIF(q.prior_quarter_actual_usd, 0), 1) AS quarter_change_pct
FROM months m
JOIN quarter_comparison q
  ON q.quarter_label = CASE WHEN m.month_start < DATE '2026-04-01' THEN 'Q1' ELSE 'Q2' END
ORDER BY m.month_start`

const MONTHLY_AS_QUARTER_SQL = MONTHLY_CADENCE_SQL
  .replace('SUM(monthly_actual_usd) AS quarter_actual_usd', 'MAX(monthly_actual_usd) AS quarter_actual_usd')
  .replace('SUM(monthly_plan_usd) AS quarter_plan_usd', 'MAX(monthly_plan_usd) AS quarter_plan_usd')

const DIVISION_VARIANCE_SQL = `WITH ${TE_DEPARTMENT_CONTROL_CTES},
division_control AS (
  SELECT
    division,
    SUM(actual_usd) AS actual_usd,
    SUM(plan_usd) AS plan_usd,
    SUM(variance_usd) AS variance_usd
  FROM department_control
  GROUP BY division
)
SELECT
  division,
  ROUND(actual_usd, 2) AS h1_te_actual_usd,
  ROUND(plan_usd, 2) AS h1_te_plan_usd,
  ROUND(variance_usd, 2) AS division_variance_usd,
  ROUND(100.0 * variance_usd / NULLIF(SUM(variance_usd) OVER (), 0), 1) AS total_variance_share_pct
FROM division_control
ORDER BY division_variance_usd DESC, division`

const POSITIVE_ONLY_DIVISION_VARIANCE_SQL = DIVISION_VARIANCE_SQL.replace(
  'FROM division_control\nORDER BY',
  'FROM division_control\nWHERE variance_usd > 0\nORDER BY',
)

const DEPARTMENT_VARIANCE_SQL = `WITH ${TE_DEPARTMENT_CONTROL_CTES}
SELECT
  dept_name,
  leader_name,
  ROUND(actual_usd, 2) AS h1_te_actual_usd,
  ROUND(plan_usd, 2) AS h1_te_plan_usd,
  ROUND(variance_usd, 2) AS department_variance_usd,
  ROUND(100.0 * variance_usd / NULLIF(plan_usd, 0), 1) AS department_variance_pct,
  ROW_NUMBER() OVER (ORDER BY ABS(variance_usd) DESC, dept_name) AS absolute_variance_rank
FROM department_control
ORDER BY department_variance_usd DESC, dept_name`

const OVERRUN_ONLY_DEPARTMENT_VARIANCE_SQL = DEPARTMENT_VARIANCE_SQL.replace(
  'FROM department_control\nORDER BY',
  'FROM department_control\nWHERE variance_usd > 0\nORDER BY',
)

const DEPARTMENT_EXPOSURE_SQL = `WITH ${TE_EXPOSURE_CTES}
SELECT
  dept_name,
  ROUND(actual_usd, 2) AS h1_te_actual_usd,
  paid_employee_months,
  ROUND(spend_per_paid_employee_month_usd, 2) AS spend_per_paid_employee_month_usd,
  CASE
    WHEN paid_employee_months IS NULL THEN 'No loaded payroll denominator'
    ELSE 'Loaded employee-month exposure'
  END AS exposure_support
FROM exposure
ORDER BY paid_employee_months IS NULL DESC,
  spend_per_paid_employee_month_usd DESC NULLS LAST,
  dept_name`

const INNER_JOIN_DEPARTMENT_EXPOSURE_SQL = DEPARTMENT_EXPOSURE_SQL.replace(
  'LEFT JOIN payroll p',
  'JOIN payroll p',
)

const REVIEW_QUEUE_SQL = `WITH ${TE_EXPOSURE_CTES},
ranked_review AS (
  SELECT *,
    ROW_NUMBER() OVER (
      ORDER BY
        CASE WHEN paid_employee_months IS NULL THEN 0 ELSE 1 END,
        ABS(variance_usd) DESC,
        dept_name
    ) AS review_rank
  FROM exposure
)
SELECT
  review_rank,
  dept_name,
  leader_name,
  ROUND(actual_usd, 2) AS h1_te_actual_usd,
  ROUND(plan_usd, 2) AS h1_te_plan_usd,
  ROUND(variance_usd, 2) AS department_variance_usd,
  paid_employee_months,
  ROUND(spend_per_paid_employee_month_usd, 2) AS spend_per_paid_employee_month_usd,
  CASE
    WHEN paid_employee_months IS NULL THEN 'Missing payroll denominator'
    ELSE 'Largest absolute plan variance'
  END AS review_reason
FROM ranked_review
WHERE review_rank <= 5
ORDER BY review_rank`

const SUPPORTED_ONLY_REVIEW_QUEUE_SQL = REVIEW_QUEUE_SQL.replace(
  'LEFT JOIN payroll p',
  'JOIN payroll p',
)

const HANDOFF_SQL = `WITH ${TE_EXPOSURE_CTES},
source_control AS (
  SELECT
    (SELECT COUNT(*) FROM raw_te) AS raw_te_lines,
    (SELECT COUNT(*) FROM te) AS deduped_te_lines,
    (SELECT COUNT(*) FROM raw_te) - (SELECT COUNT(*) FROM te) AS exact_copy_duplicate_lines,
    COUNT(DISTINCT vendor_id) AS te_vendors,
    COUNT(DISTINCT dept_id) AS te_departments,
    SUM(CASE WHEN source_system IS NULL OR source_system <> 'Expensify' THEN 1 ELSE 0 END) AS unexpected_source_lines,
    SUM(CASE WHEN vendor_id IS NULL THEN 1 ELSE 0 END) AS missing_vendor_lines,
    SUM(CASE WHEN dept_id IS NULL THEN 1 ELSE 0 END) AS missing_department_lines,
    SUM(amount) AS h1_te_actual_usd
  FROM te
),
plan_by_account AS (
  SELECT account_id, SUM(amount_usd) AS plan_usd
  FROM fct_budget
  WHERE version_name = 'FY2026 Plan'
    AND fiscal_month >= DATE '2026-01-01'
    AND fiscal_month < DATE '2026-07-01'
    AND account_id IN ('7040', '7050')
  GROUP BY account_id
),
account_control AS (
  SELECT account_id, SUM(amount) AS actual_usd
  FROM te
  GROUP BY account_id
),
account_summary AS (
  SELECT
    SUM(a.actual_usd) FILTER (WHERE a.account_id = '7040') AS travel_actual_usd,
    SUM(a.actual_usd) FILTER (WHERE a.account_id = '7050') AS meals_actual_usd,
    SUM(a.actual_usd) AS total_actual_usd,
    SUM(p.plan_usd) AS total_plan_usd
  FROM account_control a
  JOIN plan_by_account p ON p.account_id = a.account_id
),
quarter_summary AS (
  SELECT
    SUM(amount) FILTER (WHERE txn_date < DATE '2026-04-01') AS q1_actual_usd,
    SUM(amount) FILTER (WHERE txn_date >= DATE '2026-04-01') AS q2_actual_usd
  FROM te
),
largest_spend AS (
  SELECT *, ROW_NUMBER() OVER (ORDER BY actual_usd DESC, dept_name) AS spend_rank
  FROM department_control
),
largest_miss AS (
  SELECT *, ROW_NUMBER() OVER (ORDER BY variance_usd DESC, dept_name) AS miss_rank
  FROM department_control
),
division_control AS (
  SELECT division, SUM(variance_usd) AS variance_usd
  FROM department_control
  GROUP BY division
),
largest_division_miss AS (
  SELECT *, ROW_NUMBER() OVER (ORDER BY variance_usd DESC, division) AS division_miss_rank
  FROM division_control
),
ranked_review AS (
  SELECT *,
    ROW_NUMBER() OVER (
      ORDER BY
        CASE WHEN paid_employee_months IS NULL THEN 0 ELSE 1 END,
        ABS(variance_usd) DESC,
        dept_name
    ) AS review_rank
  FROM exposure
),
exposure_summary AS (
  SELECT
    SUM(CASE WHEN paid_employee_months IS NULL THEN 1 ELSE 0 END) AS missing_employee_month_departments,
    SUM(CASE WHEN paid_employee_months IS NULL THEN actual_usd ELSE 0 END) AS unsupported_exposure_usd
  FROM exposure
),
review_summary AS (
  SELECT COUNT(*) AS bounded_review_rows
  FROM ranked_review
  WHERE review_rank <= 5
)
SELECT
  s.raw_te_lines,
  s.deduped_te_lines,
  s.exact_copy_duplicate_lines,
  s.te_vendors,
  s.te_departments,
  s.unexpected_source_lines,
  s.missing_vendor_lines,
  s.missing_department_lines,
  ROUND(s.h1_te_actual_usd, 2) AS h1_te_actual_usd,
  ROUND(a.travel_actual_usd, 2) AS travel_actual_usd,
  ROUND(100.0 * a.travel_actual_usd / NULLIF(a.total_actual_usd, 0), 1) AS travel_actual_mix_pct,
  ROUND(a.meals_actual_usd, 2) AS meals_actual_usd,
  ROUND(100.0 * a.meals_actual_usd / NULLIF(a.total_actual_usd, 0), 1) AS meals_actual_mix_pct,
  ROUND(a.total_plan_usd, 2) AS h1_te_plan_usd,
  ROUND(a.total_actual_usd - a.total_plan_usd, 2) AS te_variance_usd,
  ROUND(100.0 * (a.total_actual_usd - a.total_plan_usd) / NULLIF(a.total_plan_usd, 0), 1) AS te_variance_pct,
  ROUND(q.q1_actual_usd, 2) AS q1_te_actual_usd,
  ROUND(q.q2_actual_usd, 2) AS q2_te_actual_usd,
  ROUND(q.q2_actual_usd - q.q1_actual_usd, 2) AS q2_vs_q1_change_usd,
  ROUND(100.0 * (q.q2_actual_usd - q.q1_actual_usd) / NULLIF(q.q1_actual_usd, 0), 1) AS q2_vs_q1_change_pct,
  ld.division AS largest_plan_miss_division,
  ROUND(ld.variance_usd, 2) AS largest_plan_miss_division_usd,
  ROUND(100.0 * ld.variance_usd / NULLIF(a.total_actual_usd - a.total_plan_usd, 0), 1) AS largest_plan_miss_division_share_pct,
  ls.dept_name AS largest_spend_department,
  ROUND(ls.actual_usd, 2) AS largest_spend_department_usd,
  ROUND(100.0 * ls.actual_usd / NULLIF(a.total_actual_usd, 0), 1) AS largest_spend_department_share_pct,
  lm.dept_name AS largest_plan_miss_department,
  lm.leader_name AS largest_plan_miss_leader,
  ROUND(lm.variance_usd, 2) AS largest_plan_miss_usd,
  e.missing_employee_month_departments,
  ROUND(e.unsupported_exposure_usd, 2) AS unsupported_exposure_usd,
  r.bounded_review_rows
FROM source_control s
CROSS JOIN account_summary a
CROSS JOIN quarter_summary q
CROSS JOIN largest_division_miss ld
CROSS JOIN largest_spend ls
CROSS JOIN largest_miss lm
CROSS JOIN exposure_summary e
CROSS JOIN review_summary r
WHERE ld.division_miss_rank = 1
  AND ls.spend_rank = 1
  AND lm.miss_rank = 1`

const INNER_JOIN_HANDOFF_SQL = HANDOFF_SQL.replace(
  'LEFT JOIN payroll p',
  'JOIN payroll p',
)

export const TRAVEL_EXPENSE_REVIEW_MISSIONS = [
  {
    id: 'm163',
    part: 25,
    title: 'Control the H1 T&E source population',
    from: 'maria',
    ask: `Open the Travel & Expense review with a source control. Scope H1 accounts 7040 and 7050, compare raw lines with an exact-copy population whose identity is every GL field except synthetic txn_id, and prove Expensify provenance plus vendor and department tagging before analyzing the dollars.`,
    deliverable: `Exactly one row: raw_te_lines, deduped_te_lines, exact_copy_duplicate_lines, te_vendors, te_departments, unexpected_source_lines, missing_vendor_lines, missing_department_lines, and h1_te_actual_usd. Round dollars to 2.`,
    tables: ['fct_gl_transactions'],
    canonical: SOURCE_AUDIT_SQL,
    solutionSql: SOURCE_AUDIT_SQL,
    solutionNote: `The H1 T&E control contains 6,582 raw and 6,582 exact-copy-deduplicated lines, zero unexpected non-Expensify sources, zero exact-copy duplicates, 38 vendor records, eight departments, complete vendor and department tags, and $10,760,335.61. Zero exceptions are control results, not permission to omit the controls.`,
    ordered: false,
    fingerprintSQL: TRAVEL_ONLY_SOURCE_AUDIT_SQL,
    fingerprintMessage: `You controlled travel account 7040 but left meals account 7050 outside the T&E population. Scope both accounts before testing tags, duplicate identity, or dollars.`,
    requireRegex: String.raw`row_number\s*\(\s*\)\s*over\s*\([\s\S]*partition\s+by`,
    requireMessage: `Your values match because this H1 slice has no exact-copy T&E duplicates. Keep the full-row-except-txn_id control so a future duplicate batch cannot silently inflate the book.`,
    hints: [
      `Start with H1 GL rows from accounts 7040 and 7050. Keep the raw population beside a separately ranked exact-copy population.`,
      `ROW_NUMBER should partition by every GL field except txn_id, then retain rank 1. Count missing tags on the deduplicated population.`,
      SOURCE_AUDIT_SQL,
    ],
    sayIt: `"H1 T&E contains 6,582 controlled lines and $10.76 million. Vendor and department tags are complete, and exact-copy control removes zero rows; that says the loaded batch is clean, not that duplicate control is optional."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm164',
    part: 25,
    title: 'Separate travel and meals economics',
    from: 'priya',
    ask: `Split the controlled book into travel and meals, then compare each account with the same loaded FY2026 H1 plan. Keep actual mix separate from plan variance so a larger category is not automatically called the worse miss.`,
    deliverable: `One row per spend type: spend_type, h1_actual_usd, actual_mix_pct, h1_plan_usd, variance_usd, and variance_pct where variance is actual minus plan. Round dollars to 2 and percentages to 1; order largest actual first.`,
    tables: ['fct_gl_transactions', 'fct_budget'],
    canonical: ACCOUNT_MIX_SQL,
    solutionSql: ACCOUNT_MIX_SQL,
    solutionNote: `Travel is $6,669,864.99, or 62.0% of H1 T&E, and is $210,194.84 / 3.3% over plan. Meals is $4,090,470.62, or 38.0%, and is $188,865.75 / 4.8% over plan. Mix and miss rate answer different questions.`,
    ordered: true,
    orderedNote: 'largest H1 actual first, then spend type',
    fingerprintSQL: COLLAPSED_ACCOUNT_MIX_SQL,
    fingerprintMessage: `You collapsed travel and meals into one T&E row. Keep accounts 7040 and 7050 separate so actual mix and account-specific plan variance remain visible.`,
    hints: [
      `Aggregate deduplicated actuals and loaded plan independently by account_id before joining them.`,
      `Map 7040 to Travel and 7050 to Meals. Actual mix uses the full actual denominator; variance percent uses that account's plan.`,
      ACCOUNT_MIX_SQL,
    ],
    sayIt: `"Travel is 62% of T&E and 3.3% over plan; meals is 38% and 4.8% over. I keep size and miss rate separate rather than treating the largest category as the weakest control."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm165',
    part: 25,
    title: 'Read the monthly and quarter cadence',
    from: 'elena',
    ask: `Build the H1 monthly cadence and retain the quarter rollup on every month. Compare Q2 with all of Q1—not June with March—and keep monthly actual, plan, and variance visible beside that quarter movement.`,
    deliverable: `Six ordered month rows: month_start, quarter_label, monthly_actual_usd, monthly_plan_usd, monthly_variance_usd, quarter_actual_usd, prior_quarter_actual_usd, quarter_change_usd, and quarter_change_pct. Round dollars to 2 and percentage to 1.`,
    tables: ['fct_gl_transactions', 'fct_budget'],
    canonical: MONTHLY_CADENCE_SQL,
    solutionSql: MONTHLY_CADENCE_SQL,
    solutionNote: `Q1 T&E is $5,179,464.41 and Q2 is $5,580,871.20, a $401,406.79 / 7.7% increase. The six monthly rows remain visible; quarter movement is an aggregation of those months, not a substitute for them or evidence of seasonality.`,
    ordered: true,
    orderedNote: 'calendar month ascending',
    fingerprintSQL: MONTHLY_AS_QUARTER_SQL,
    fingerprintMessage: `Your quarter figures use the largest single month instead of all three months. Aggregate the monthly book into Q1 and Q2 before calculating the quarter-over-quarter change.`,
    hints: [
      `Build one actual row and one plan row per month, full-outer them, then label January–March Q1 and April–June Q2.`,
      `Aggregate the six month rows to quarter totals and LAG the quarter total. Join that controlled rollup back to its three months.`,
      MONTHLY_CADENCE_SQL,
    ],
    sayIt: `"Q2 T&E is $5.58 million, 7.7% above Q1. That is loaded period movement; without trips, approvals, policy, or business-purpose data, I do not call it seasonality, waste, or causality."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm166',
    part: 25,
    title: 'Locate the division plan variance',
    from: 'danny',
    ask: `Reduce actual and plan to division before comparing them. Preserve favorable as well as unfavorable rows, and show which division carries the company miss without joining raw GL lines to monthly plan rows.`,
    deliverable: `One row per represented division: division, h1_te_actual_usd, h1_te_plan_usd, division_variance_usd, and total_variance_share_pct. Round dollars to 2 and share to 1; order largest miss first.`,
    tables: ['fct_gl_transactions', 'fct_budget', 'dim_department'],
    canonical: DIVISION_VARIANCE_SQL,
    solutionSql: DIVISION_VARIANCE_SQL,
    solutionNote: `S&M drives $363,559.34, or 91.1% of the $399,060.59 total miss; R&D is $44,040.72 over and G&A is $8,539.47 favorable. The share describes loaded variance concentration, not causality or a savings target.`,
    ordered: true,
    orderedNote: 'largest actual-minus-plan variance first, then division',
    fingerprintSQL: POSITIVE_ONLY_DIVISION_VARIANCE_SQL,
    fingerprintMessage: `You dropped the favorable G&A row and made the division bridge incomplete. Preserve every represented division, including negative actual-minus-plan variance.`,
    hints: [
      `Actual starts from the controlled T&E rows; plan starts from FY2026 Plan accounts 7040 and 7050. Map each side to division and aggregate before joining.`,
      `Use a full outer comparison, keep favorable rows, and calculate each division's share against the complete company variance.`,
      DIVISION_VARIANCE_SQL,
    ],
    sayIt: `"S&M carries $364 thousand, or 91.1%, of the loaded T&E miss. G&A is favorable, so I retain it in the bridge rather than filtering the review to overruns."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm167',
    part: 25,
    title: 'Build the department owner queue',
    from: 'maria',
    ask: `Move from division to department owners. Keep every represented department, rank materiality by absolute variance, and order the table by signed actual-minus-plan miss so Finance can see both follow-up and favorable context.`,
    deliverable: `One row per represented department: dept_name, leader_name, h1_te_actual_usd, h1_te_plan_usd, department_variance_usd, department_variance_pct, and absolute_variance_rank. Round dollars to 2 and percentage to 1; order largest signed miss first.`,
    tables: ['fct_gl_transactions', 'fct_budget', 'dim_department'],
    canonical: DEPARTMENT_VARIANCE_SQL,
    solutionSql: DEPARTMENT_VARIANCE_SQL,
    solutionNote: `Marketing, led by Claire Dubois, has the largest loaded miss at $93,898.18 / 7.5%. The queue retains all eight T&E departments and uses absolute variance only for materiality rank, not to erase the sign.`,
    ordered: true,
    orderedNote: 'largest signed department variance first, then department',
    fingerprintSQL: OVERRUN_ONLY_DEPARTMENT_VARIANCE_SQL,
    fingerprintMessage: `You filtered the owner table to overruns. Keep all represented departments so favorable context and the complete review population remain visible.`,
    hints: [
      `Build actual and plan at department grain independently, normalize plan department names, then full-outer the two controlled sets.`,
      `Signed variance orders the review; ABS(variance) supplies a separate materiality rank. Join leader_name from the department dimension.`,
      DEPARTMENT_VARIANCE_SQL,
    ],
    sayIt: `"Marketing is the largest loaded plan miss at $94 thousand, led by Claire Dubois. This is an owner-routing fact, not evidence of policy violations, traveler behavior, or a recommendation to cut spend."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm168',
    part: 25,
    title: 'Preserve unsupported employee exposure',
    from: 'priya',
    ask: `Normalize department T&E by loaded H1 paid employee-months without deleting a department that lacks payroll rows. Keep the denominator missing when it is unsupported; do not turn employee-month exposure into travelers, trips, or per-person behavior.`,
    deliverable: `One row per T&E department: dept_name, h1_te_actual_usd, paid_employee_months, spend_per_paid_employee_month_usd, and exposure_support. Keep unsupported denominators NULL; order missing support first, then highest supported exposure.`,
    tables: ['fct_gl_transactions', 'fct_payroll_monthly', 'fct_budget', 'dim_department'],
    canonical: DEPARTMENT_EXPOSURE_SQL,
    solutionSql: DEPARTMENT_EXPOSURE_SQL,
    solutionNote: `Executive has $1,362,666.30, or 12.7% of H1 T&E, but no loaded payroll rows; its denominator stays NULL. Among seven measurable departments, Solutions Engineering is highest at $8,463.95 per loaded employee-month. That denominator is exposure, never traveler count.`,
    ordered: true,
    orderedNote: 'missing denominator first, then highest supported spend per paid employee-month',
    fingerprintSQL: INNER_JOIN_DEPARTMENT_EXPOSURE_SQL,
    fingerprintMessage: `The payroll INNER JOIN erased Executive and $1.36 million of T&E because that department has no loaded employee-month rows. Preserve every T&E department with a left join and keep unsupported ratios NULL.`,
    hints: [
      `Count H1 payroll rows by department; each row is one paid employee-month. Do not count distinct employees or infer travelers.`,
      `Start from the complete department T&E control and LEFT JOIN payroll exposure. Divide only when the denominator exists and is nonzero.`,
      DEPARTMENT_EXPOSURE_SQL,
    ],
    sayIt: `"Executive has $1.36 million of T&E and no loaded payroll denominator, so I preserve the row and leave the ratio blank. The supported values are spend per employee-month, not spend per traveler."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm169',
    part: 25,
    title: 'Route a bounded T&E review',
    from: 'elena',
    ask: `Create a five-row review queue that puts unsupported payroll exposure first, then the largest absolute plan variances. Keep the missing denominator visible in the queue instead of silently replacing it with zero or dropping the department.`,
    deliverable: `Exactly five rows: review_rank, dept_name, leader_name, h1_te_actual_usd, h1_te_plan_usd, department_variance_usd, paid_employee_months, spend_per_paid_employee_month_usd, and review_reason. Round dollars to 2; order review_rank ascending.`,
    tables: ['fct_gl_transactions', 'fct_budget', 'fct_payroll_monthly', 'dim_department'],
    canonical: REVIEW_QUEUE_SQL,
    solutionSql: REVIEW_QUEUE_SQL,
    solutionNote: `The deterministic queue carries Executive first because its $1.36 million exposure lacks a loaded payroll denominator, then routes the largest absolute plan variances. Five rows bound the review; they do not claim misuse, compliance failure, savings, or ROI.`,
    ordered: true,
    orderedNote: 'review rank ascending',
    fingerprintSQL: SUPPORTED_ONLY_REVIEW_QUEUE_SQL,
    fingerprintMessage: `You ranked only departments with payroll support, so Executive's material unsupported exposure vanished. Rank from the complete T&E population and put missing support first.`,
    hints: [
      `Reuse the complete department control and left-joined payroll exposure. Missing support is a routing reason, not a zero denominator.`,
      `ROW_NUMBER orders missing payroll support first, then absolute variance and department. Filter only after assigning the review rank.`,
      REVIEW_QUEUE_SQL,
    ],
    sayIt: `"The five-row review begins with Executive's unsupported payroll denominator, then the largest absolute plan variances. This is a bounded evidence queue, not a claim about waste, fraud, compliance, or trip value."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm170',
    part: 25,
    title: 'Package the T&E operating handoff',
    from: 'danny',
    ask: `Close the workday in one FP&A, People, and Finance handoff. Carry source integrity, travel and meals mix, plan and quarter movement, the largest division miss, the largest spend and plan-miss departments, unsupported employee-month exposure, and the bounded review count. Reduce each control to one row before combining it.`,
    deliverable: `Exactly one row with raw_te_lines, deduped_te_lines, exact_copy_duplicate_lines, te_vendors, te_departments, unexpected_source_lines, missing_vendor_lines, missing_department_lines, h1_te_actual_usd, travel_actual_usd, travel_actual_mix_pct, meals_actual_usd, meals_actual_mix_pct, h1_te_plan_usd, te_variance_usd, te_variance_pct, q1_te_actual_usd, q2_te_actual_usd, q2_vs_q1_change_usd, q2_vs_q1_change_pct, largest_plan_miss_division, largest_plan_miss_division_usd, largest_plan_miss_division_share_pct, largest_spend_department, largest_spend_department_usd, largest_spend_department_share_pct, largest_plan_miss_department, largest_plan_miss_leader, largest_plan_miss_usd, missing_employee_month_departments, unsupported_exposure_usd, and bounded_review_rows. Round dollars to 2 and percentages to 1.`,
    tables: ['fct_gl_transactions', 'fct_budget', 'fct_payroll_monthly', 'dim_department'],
    canonical: HANDOFF_SQL,
    solutionSql: HANDOFF_SQL,
    solutionNote: `The handoff preserves 6,582 controlled Expensify lines and $10,760,335.61 of H1 T&E against $10,361,275.02 of loaded plan, a $399,060.59 / 3.9% miss. Travel is 62.0%, meals 38.0%, Q2 is 7.7% above Q1, S&M carries 91.1% of the company miss, Customer Success carries the largest spend, Marketing the largest department miss, and one $1,362,666.30 department lacks a payroll denominator.`,
    ordered: false,
    fingerprintSQL: INNER_JOIN_HANDOFF_SQL,
    fingerprintMessage: `The handoff used a payroll INNER JOIN and erased the unsupported Executive population. Preserve the complete T&E department set, keep the missing denominator explicit, and carry its dollars into the one-row handoff.`,
    requireRegex: String.raw`row_number\s*\(\s*\)\s*over\s*\([\s\S]*partition\s+by`,
    requireMessage: `Your handoff values match this zero-duplicate fixture, but the source control still needs explicit full-row-except-txn_id deduplication before downstream aggregation.`,
    hints: [
      `Build one-row source, account, quarter, largest-division-miss, largest-spend, largest-department-miss, exposure, and review controls. CROSS JOIN only those one-row outputs.`,
      `Keep exact-copy control in the GL source and a LEFT JOIN in the payroll exposure. Missing support remains one department and its dollars stay visible.`,
      HANDOFF_SQL,
    ],
    sayIt: `"H1 T&E is $10.76 million, $399 thousand or 3.9% over the loaded plan. Travel is 62%, Q2 is 7.7% above Q1, and one $1.36 million department lacks a payroll denominator. I route those facts without claiming traveler behavior, policy failure, savings, cash impact, or ROI."`,
    jdCompanies: ['Affirm'],
  },
]
