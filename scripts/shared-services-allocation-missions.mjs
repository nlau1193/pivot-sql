// One complete Star67 workday: scope a shared-services pool, compare two
// allocation drivers, conserve every cent, and package the decision handoff.
// The nine missions follow the nine distinct controls in this review; the
// runtime does not assume this or any other fixed scenario length.

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

const POOL_PROFILE_SQL = `WITH ${GL_DEDUPE_CTE}, components AS (
  SELECT
    d.dept_name,
    a.account_name,
    sum(cast(g.amount AS DECIMAL(18, 2))) AS component_usd
  FROM deduped_gl g
  JOIN dim_account a USING (account_id)
  JOIN dim_department d USING (dept_id)
  WHERE g.txn_date >= DATE '2026-01-01'
    AND g.txn_date < DATE '2026-07-01'
    AND a.account_type = 'Opex'
    AND d.division = 'G&A'
  GROUP BY d.dept_name, a.account_name
)
SELECT
  dept_name,
  account_name,
  round(component_usd, 2) AS component_usd,
  round(100.0 * component_usd / sum(component_usd) OVER (), 1) AS pool_share_pct,
  round(sum(component_usd) OVER (), 2) AS h1_ga_opex_pool_usd
FROM components
ORDER BY component_usd DESC, dept_name, account_name`

const Q2_POOL_PROFILE_SQL = POOL_PROFILE_SQL.replace(
  `g.txn_date >= DATE '2026-01-01'`,
  `g.txn_date >= DATE '2026-04-01'`,
)

const RECEIVER_COVERAGE_SQL = `WITH monthly AS (
  SELECT
    p.payroll_month,
    d.division,
    count(*)::BIGINT AS paid_heads,
    sum(cast(p.total_comp_usd AS DECIMAL(18, 2))) AS payroll_cost
  FROM fct_payroll_monthly p
  JOIN dim_department d USING (dept_id)
  WHERE p.payroll_month >= DATE '2026-01-01'
    AND p.payroll_month < DATE '2026-07-01'
    AND d.division IN ('R&D', 'S&M', 'COGS')
  GROUP BY p.payroll_month, d.division
)
SELECT
  division,
  count(*)::BIGINT AS months_loaded,
  sum(paid_heads)::BIGINT AS employee_month_rows,
  round(avg(paid_heads), 2) AS avg_monthly_paid_heads,
  round(sum(payroll_cost), 2) AS h1_payroll_cost_usd
FROM monthly
GROUP BY division
ORDER BY division`

const UNIQUE_EMPLOYEE_COVERAGE_SQL = `SELECT
  d.division,
  count(DISTINCT p.payroll_month)::BIGINT AS months_loaded,
  count(DISTINCT p.employee_id)::BIGINT AS employee_month_rows,
  round(count(DISTINCT p.employee_id) / 6.0, 2) AS avg_monthly_paid_heads,
  round(sum(cast(p.total_comp_usd AS DECIMAL(18, 2))), 2) AS h1_payroll_cost_usd
FROM fct_payroll_monthly p
JOIN dim_department d USING (dept_id)
WHERE p.payroll_month >= DATE '2026-01-01'
  AND p.payroll_month < DATE '2026-07-01'
  AND d.division IN ('R&D', 'S&M', 'COGS')
GROUP BY d.division
ORDER BY d.division`

const HEAD_WEIGHT_SQL = `WITH monthly AS (
  SELECT
    p.payroll_month,
    d.division,
    count(*)::BIGINT AS paid_heads
  FROM fct_payroll_monthly p
  JOIN dim_department d USING (dept_id)
  WHERE p.payroll_month >= DATE '2026-01-01'
    AND p.payroll_month < DATE '2026-07-01'
    AND d.division IN ('R&D', 'S&M', 'COGS')
  GROUP BY p.payroll_month, d.division
), driver AS (
  SELECT division, avg(paid_heads) AS avg_monthly_paid_heads
  FROM monthly
  GROUP BY division
)
SELECT
  division,
  round(avg_monthly_paid_heads, 2) AS avg_monthly_paid_heads,
  round(
    100.0 * avg_monthly_paid_heads / sum(avg_monthly_paid_heads) OVER (),
    1
  ) AS paid_head_weight_pct
FROM driver
ORDER BY division`

const EMPLOYEE_MONTH_WEIGHT_SQL = `WITH driver AS (
  SELECT d.division, count(*)::DOUBLE AS avg_monthly_paid_heads
  FROM fct_payroll_monthly p
  JOIN dim_department d USING (dept_id)
  WHERE p.payroll_month >= DATE '2026-01-01'
    AND p.payroll_month < DATE '2026-07-01'
    AND d.division IN ('R&D', 'S&M', 'COGS')
  GROUP BY d.division
)
SELECT
  division,
  round(avg_monthly_paid_heads, 2) AS avg_monthly_paid_heads,
  round(
    100.0 * avg_monthly_paid_heads / sum(avg_monthly_paid_heads) OVER (),
    1
  ) AS paid_head_weight_pct
FROM driver
ORDER BY division`

const PAYROLL_WEIGHT_SQL = `WITH driver AS (
  SELECT
    d.division,
    sum(cast(p.total_comp_usd AS DECIMAL(18, 2))) AS h1_payroll_cost
  FROM fct_payroll_monthly p
  JOIN dim_department d USING (dept_id)
  WHERE p.payroll_month >= DATE '2026-01-01'
    AND p.payroll_month < DATE '2026-07-01'
    AND d.division IN ('R&D', 'S&M', 'COGS')
  GROUP BY d.division
)
SELECT
  division,
  round(h1_payroll_cost, 2) AS h1_payroll_cost_usd,
  round(100.0 * h1_payroll_cost / sum(h1_payroll_cost) OVER (), 1) AS payroll_weight_pct
FROM driver
ORDER BY division`

const BASE_PAY_WEIGHT_SQL = PAYROLL_WEIGHT_SQL.replace(
  `cast(p.total_comp_usd AS DECIMAL(18, 2))`,
  `cast(p.base_pay_usd AS DECIMAL(18, 2))`,
)

const ALLOCATION_CTES = `WITH ${GL_DEDUPE_CTE}, scoped AS (
  SELECT
    d.division,
    a.account_type,
    sum(cast(g.amount AS DECIMAL(18, 2))) AS amount_usd
  FROM deduped_gl g
  JOIN dim_account a USING (account_id)
  JOIN dim_department d USING (dept_id)
  WHERE g.txn_date >= DATE '2026-01-01'
    AND g.txn_date < DATE '2026-07-01'
    AND a.account_type IN ('COGS', 'Opex')
  GROUP BY d.division, a.account_type
), pool AS (
  SELECT sum(amount_usd) AS pool_usd
  FROM scoped
  WHERE division = 'G&A' AND account_type = 'Opex'
), direct AS (
  SELECT division, sum(amount_usd) AS direct_cost
  FROM scoped
  WHERE division IN ('R&D', 'S&M', 'COGS')
  GROUP BY division
), monthly AS (
  SELECT
    p.payroll_month,
    d.division,
    count(*)::BIGINT AS paid_heads,
    sum(cast(p.total_comp_usd AS DECIMAL(18, 2))) AS payroll_cost
  FROM fct_payroll_monthly p
  JOIN dim_department d USING (dept_id)
  WHERE p.payroll_month >= DATE '2026-01-01'
    AND p.payroll_month < DATE '2026-07-01'
    AND d.division IN ('R&D', 'S&M', 'COGS')
  GROUP BY p.payroll_month, d.division
), drivers AS (
  SELECT
    division,
    avg(paid_heads) AS avg_monthly_paid_heads,
    sum(payroll_cost) AS h1_payroll_cost
  FROM monthly
  GROUP BY division
), raw_allocations AS (
  SELECT
    d.division,
    p.pool_usd,
    d.avg_monthly_paid_heads / sum(d.avg_monthly_paid_heads) OVER () AS head_weight,
    d.h1_payroll_cost / sum(d.h1_payroll_cost) OVER () AS payroll_weight,
    p.pool_usd * d.avg_monthly_paid_heads
      / sum(d.avg_monthly_paid_heads) OVER () AS head_raw,
    p.pool_usd * d.h1_payroll_cost
      / sum(d.h1_payroll_cost) OVER () AS payroll_raw
  FROM drivers d
  CROSS JOIN pool p
), cent_controls AS (
  SELECT
    *,
    floor(head_raw * 100)::BIGINT AS head_base_cents,
    floor(payroll_raw * 100)::BIGINT AS payroll_base_cents,
    row_number() OVER (
      ORDER BY head_raw * 100 - floor(head_raw * 100) DESC, division
    ) AS head_remainder_rank,
    row_number() OVER (
      ORDER BY payroll_raw * 100 - floor(payroll_raw * 100) DESC, division
    ) AS payroll_remainder_rank,
    round(pool_usd * 100)::BIGINT
      - sum(floor(head_raw * 100)::BIGINT) OVER () AS head_pennies,
    round(pool_usd * 100)::BIGINT
      - sum(floor(payroll_raw * 100)::BIGINT) OVER () AS payroll_pennies
  FROM raw_allocations
), allocated AS (
  SELECT
    division,
    pool_usd,
    head_weight,
    payroll_weight,
    (
      head_base_cents
      + CASE WHEN head_remainder_rank <= head_pennies THEN 1 ELSE 0 END
    ) / 100.0 AS head_alloc,
    (
      payroll_base_cents
      + CASE WHEN payroll_remainder_rank <= payroll_pennies THEN 1 ELSE 0 END
    ) / 100.0 AS payroll_alloc
  FROM cent_controls
)`

const HEAD_ALLOCATION_SQL = `${ALLOCATION_CTES}
SELECT
  division,
  round(100.0 * head_weight, 1) AS paid_head_weight_pct,
  round(head_alloc, 2) AS allocated_pool_usd,
  round(pool_usd - sum(head_alloc) OVER (), 2) AS reconciliation_difference_usd
FROM allocated
ORDER BY division`

const JUNE_HEAD_ALLOCATION_SQL = HEAD_ALLOCATION_SQL.replace(
  `p.payroll_month >= DATE '2026-01-01'
    AND p.payroll_month < DATE '2026-07-01'`,
  `p.payroll_month = DATE '2026-06-01'`,
)

const PAYROLL_ALLOCATION_SQL = `${ALLOCATION_CTES}
SELECT
  division,
  round(100.0 * payroll_weight, 1) AS payroll_weight_pct,
  round(payroll_alloc, 2) AS allocated_pool_usd,
  round(pool_usd - sum(payroll_alloc) OVER (), 2) AS reconciliation_difference_usd
FROM allocated
ORDER BY division`

const JUNE_PAYROLL_ALLOCATION_SQL = PAYROLL_ALLOCATION_SQL.replace(
  `p.payroll_month >= DATE '2026-01-01'
    AND p.payroll_month < DATE '2026-07-01'`,
  `p.payroll_month = DATE '2026-06-01'`,
)

const SENSITIVITY_SQL = `${ALLOCATION_CTES}, swings AS (
  SELECT
    division,
    head_alloc,
    payroll_alloc,
    payroll_alloc - head_alloc AS sensitivity_usd
  FROM allocated
), ranked AS (
  SELECT
    *,
    row_number() OVER (
      ORDER BY abs(sensitivity_usd) DESC, division
    ) AS swing_rank
  FROM swings
)
SELECT
  division,
  round(head_alloc, 2) AS paid_head_allocation_usd,
  round(payroll_alloc, 2) AS payroll_allocation_usd,
  round(sensitivity_usd, 2) AS payroll_minus_head_usd,
  round(abs(sensitivity_usd), 2) AS absolute_swing_usd,
  swing_rank
FROM ranked
ORDER BY swing_rank, division`

const REVERSED_SENSITIVITY_SQL = SENSITIVITY_SQL.replace(
  `payroll_alloc - head_alloc AS sensitivity_usd`,
  `head_alloc - payroll_alloc AS sensitivity_usd`,
)

const POST_ALLOCATION_SQL = `${ALLOCATION_CTES}
SELECT
  d.division,
  round(d.direct_cost, 2) AS direct_cost_usd,
  round(a.head_alloc, 2) AS paid_head_allocation_usd,
  round(d.direct_cost + a.head_alloc, 2) AS paid_head_post_allocation_cost_usd,
  round(a.payroll_alloc, 2) AS payroll_allocation_usd,
  round(d.direct_cost + a.payroll_alloc, 2) AS payroll_post_allocation_cost_usd,
  round(a.payroll_alloc - a.head_alloc, 2) AS method_sensitivity_usd
FROM direct d
JOIN allocated a USING (division)
ORDER BY payroll_post_allocation_cost_usd DESC, d.division`

const DOUBLE_COUNTED_POST_ALLOCATION_SQL = POST_ALLOCATION_SQL
  .replace(
    `round(d.direct_cost, 2) AS direct_cost_usd`,
    `round(d.direct_cost + a.pool_usd, 2) AS direct_cost_usd`,
  )
  .replace(
    `round(d.direct_cost + a.head_alloc, 2) AS paid_head_post_allocation_cost_usd`,
    `round(d.direct_cost + a.pool_usd + a.head_alloc, 2) AS paid_head_post_allocation_cost_usd`,
  )
  .replace(
    `round(d.direct_cost + a.payroll_alloc, 2) AS payroll_post_allocation_cost_usd`,
    `round(d.direct_cost + a.pool_usd + a.payroll_alloc, 2) AS payroll_post_allocation_cost_usd`,
  )

const HANDOFF_SQL = `${ALLOCATION_CTES}, summary AS (
  SELECT
    max(pool_usd) AS pool_usd,
    max(CASE WHEN division = 'COGS' THEN 100.0 * head_weight END) AS cogs_head_weight,
    max(CASE WHEN division = 'R&D' THEN 100.0 * head_weight END) AS rd_head_weight,
    max(CASE WHEN division = 'S&M' THEN 100.0 * head_weight END) AS sm_head_weight,
    max(CASE WHEN division = 'COGS' THEN 100.0 * payroll_weight END) AS cogs_payroll_weight,
    max(CASE WHEN division = 'R&D' THEN 100.0 * payroll_weight END) AS rd_payroll_weight,
    max(CASE WHEN division = 'S&M' THEN 100.0 * payroll_weight END) AS sm_payroll_weight,
    max(pool_usd) - sum(head_alloc) AS head_difference,
    max(pool_usd) - sum(payroll_alloc) AS payroll_difference
  FROM allocated
), largest_swing AS (
  SELECT division, payroll_alloc - head_alloc AS sensitivity_usd
  FROM allocated
  ORDER BY abs(payroll_alloc - head_alloc) DESC, division
  LIMIT 1
), direct_total AS (
  SELECT sum(direct_cost) AS direct_receiver_cost
  FROM direct
), allocation_totals AS (
  SELECT
    sum(head_alloc) AS head_allocation_total,
    sum(payroll_alloc) AS payroll_allocation_total
  FROM allocated
)
SELECT
  round(s.pool_usd, 2) AS allocation_pool_usd,
  round(s.cogs_head_weight, 1) AS cogs_paid_head_weight_pct,
  round(s.rd_head_weight, 1) AS rd_paid_head_weight_pct,
  round(s.sm_head_weight, 1) AS sm_paid_head_weight_pct,
  round(s.cogs_payroll_weight, 1) AS cogs_payroll_weight_pct,
  round(s.rd_payroll_weight, 1) AS rd_payroll_weight_pct,
  round(s.sm_payroll_weight, 1) AS sm_payroll_weight_pct,
  round(s.head_difference, 2) AS head_reconciliation_difference_usd,
  round(s.payroll_difference, 2) AS payroll_reconciliation_difference_usd,
  l.division AS largest_method_swing_division,
  round(l.sensitivity_usd, 2) AS largest_method_swing_usd,
  round(d.direct_receiver_cost, 2) AS direct_receiver_cost_usd,
  round(d.direct_receiver_cost + a.head_allocation_total, 2) AS head_post_allocation_cost_usd,
  round(d.direct_receiver_cost + a.payroll_allocation_total, 2) AS payroll_post_allocation_cost_usd
FROM summary s
CROSS JOIN largest_swing l
CROSS JOIN direct_total d
CROSS JOIN allocation_totals a`

const ALLOCATION_SIZE_HANDOFF_SQL = HANDOFF_SQL.replace(
  `ORDER BY abs(payroll_alloc - head_alloc) DESC, division`,
  `ORDER BY head_alloc DESC, division`,
)

export const SHARED_SERVICES_ALLOCATION_MISSIONS = [
  {
    id: 'm137',
    part: 22,
    title: 'Profile the shared-services pool',
    from: 'elena',
    ask: `We need an H1 shared-services view before tomorrow's operating review. Start by scoping the pool to January through June 2026 GL rows whose joined account is Opex and whose joined department rolls to G&A. Profile it by department and account, and keep the full pool beside every component so the detail proves the total.`,
    deliverable: `One row per G&A department and Opex account combination: dept_name, account_name, component_usd, pool_share_pct, and h1_ga_opex_pool_usd. Round dollars to 2 and percent to 1; sort largest component first, then department and account.`,
    tables: ['fct_gl_transactions', 'dim_account', 'dim_department'],
    canonical: POOL_PROFILE_SQL,
    solutionSql: POOL_PROFILE_SQL,
    solutionNote: `The controlled H1 pool is $31,958,057.27. Workplace Office & Facilities is the largest component at $10,651,064.73, or 33.3%. This is a defined analytical pool, not an approved accounting policy.`,
    ordered: true,
    orderedNote: 'largest component first, then department and account',
    fingerprintSQL: Q2_POOL_PROFILE_SQL,
    fingerprintMessage: `The row shape is right, but the pool starts in April and totals only Q2. Restore the January 1 half-open H1 boundary before calling this the H1 shared-services pool.`,
    hints: [
      `Treat the GL like an Excel detail tab: remove duplicate loaded lines first, then filter the joined P&L and org labels before grouping.`,
      `Use ROW_NUMBER over every GL field except the synthetic txn_id, ordered by txn_id, so only exact-copy lines collapse. Then join account and department, filter H1 G&A Opex, and use a window total over grouped components.`,
      POOL_PROFILE_SQL,
    ],
    sayIt: `"I scoped $31.96 million of H1 G&A Opex and kept the full pool beside every department-account component. That is the pool definition for this comparison, not a booked allocation rule."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm138',
    part: 22,
    title: 'Prove the receiver population',
    from: 'priya',
    ask: `Before we choose a driver, prove that the receiving population is complete across R&D, S&M, and COGS. Show the six loaded payroll months, total employee-month rows, average monthly paid heads, and loaded H1 payroll cost for each division. A payroll row is one person paid in one month, not one unique person for the half.`,
    deliverable: `Three rows: division, months_loaded, employee_month_rows, avg_monthly_paid_heads, and h1_payroll_cost_usd. Round average heads and dollars to 2; order by division.`,
    tables: ['fct_payroll_monthly', 'dim_department'],
    canonical: RECEIVER_COVERAGE_SQL,
    solutionSql: RECEIVER_COVERAGE_SQL,
    solutionNote: `All three receiver divisions have six months. Their employee-month populations are 429 for COGS, 1,793 for R&D, and 1,638 for S&M; average monthly heads are 71.50, 298.83, and 273.00.`,
    ordered: true,
    orderedNote: 'division alphabetically',
    fingerprintSQL: UNIQUE_EMPLOYEE_COVERAGE_SQL,
    fingerprintMessage: `You counted unique people across the half and divided them by six, so the employee-month population and monthly average are both understated. Count paid rows within each month, then average those monthly counts.`,
    hints: [
      `First make a six-row-per-division monthly bridge: one payroll row is one paid employee-month.`,
      `Group by payroll_month and division for paid heads and cost. The outer query counts months, sums employee-month rows, and averages the six monthly counts.`,
      RECEIVER_COVERAGE_SQL,
    ],
    sayIt: `"Each receiver has all six payroll months. I kept employee-month rows separate from average monthly paid heads, so the allocation base has an honest grain."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm139',
    part: 22,
    title: 'Build the paid-head driver',
    from: 'priya',
    ask: `Build the first allocation alternative from average monthly paid heads across H1. Keep the average base beside its percentage so no one can relabel six months of employee-months as headcount. These percentages are one analytical driver, not a claim about value delivered.`,
    deliverable: `Three rows: division, avg_monthly_paid_heads, and paid_head_weight_pct. Round average heads to 2 and percent to 1; order by division.`,
    tables: ['fct_payroll_monthly', 'dim_department'],
    canonical: HEAD_WEIGHT_SQL,
    solutionSql: HEAD_WEIGHT_SQL,
    solutionNote: `The average-paid-head weights are COGS 11.1%, R&D 46.5%, and S&M 42.4%. The driver uses six monthly populations, not a unique-person or period-end roster count.`,
    ordered: true,
    orderedNote: 'division alphabetically',
    fingerprintSQL: EMPLOYEE_MONTH_WEIGHT_SQL,
    fingerprintMessage: `The percentages happen to match because every division has six months, but the displayed bases are six-month employee-month totals mislabeled as average heads. Average the monthly counts before presenting the driver.`,
    hints: [
      `In a workbook, this is a monthly headcount pivot followed by an average column—not one distinct-count formula over the whole half.`,
      `Group payroll rows by month and division, average paid_heads by division, then divide each average by the window sum of averages.`,
      HEAD_WEIGHT_SQL,
    ],
    sayIt: `"R&D carries 46.5% of the average-paid-head driver, S&M 42.4%, and COGS 11.1%. The bases are monthly averages, not six-month employee totals."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm140',
    part: 22,
    title: 'Build the loaded-payroll driver',
    from: 'elena',
    ask: `Now build the second alternative from H1 loaded payroll cost. Use total_comp_usd so the base includes salary, variable pay, benefits, and employer taxes. Keep the dollars beside the weights; this is a cost driver, not productivity, capacity, or an approved policy.`,
    deliverable: `Three rows: division, h1_payroll_cost_usd, and payroll_weight_pct. Round dollars to 2 and percent to 1; order by division.`,
    tables: ['fct_payroll_monthly', 'dim_department'],
    canonical: PAYROLL_WEIGHT_SQL,
    solutionSql: PAYROLL_WEIGHT_SQL,
    solutionNote: `Loaded H1 payroll is $7.51 million for COGS, $30.50 million for R&D, and $31.92 million for S&M. The displayed weights are 10.7%, 43.6%, and 45.6%; those one-decimal presentation values total 99.9%, so keep the full-precision driver shares for allocation.`,
    ordered: true,
    orderedNote: 'division alphabetically',
    fingerprintSQL: BASE_PAY_WEIGHT_SQL,
    fingerprintMessage: `You used base pay while labeling the result loaded payroll. Restore total_comp_usd so variable pay, benefits, and employer taxes remain in both the dollar base and the weights.`,
    hints: [
      `This is a SUMIFS-style cost base by receiver division over the same six payroll months.`,
      `Join department for division, sum total_comp_usd across H1, then divide each division by the window sum of all three receiver totals.`,
      PAYROLL_WEIGHT_SQL,
    ],
    sayIt: `"The loaded-payroll method shifts the largest weight to S&M at 45.6%, with R&D at 43.6% and COGS at 10.7%. That is a modeled cost driver, not a productivity conclusion."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm141',
    part: 22,
    title: 'Allocate by average paid heads',
    from: 'elena',
    ask: `Apply the average-paid-head weights to the full H1 G&A Opex pool. Make the displayed cents conserve exactly: floor each raw allocation to cents, rank fractional remainders with a deterministic division tie-breaker, and distribute the remaining pennies. Show the reconciliation beside every receiver.`,
    deliverable: `Three rows: division, paid_head_weight_pct, allocated_pool_usd, and reconciliation_difference_usd. Round percentages to 1 and dollars to 2; order by division. The reconciliation difference must be zero.`,
    tables: ['fct_gl_transactions', 'dim_account', 'dim_department', 'fct_payroll_monthly'],
    canonical: HEAD_ALLOCATION_SQL,
    solutionSql: HEAD_ALLOCATION_SQL,
    solutionNote: `The cent-balanced paid-head allocations are COGS $3,551,815.17, R&D $14,844,765.98, and S&M $13,561,476.12. They sum exactly to the $31,958,057.27 pool.`,
    ordered: true,
    orderedNote: 'division alphabetically',
    fingerprintSQL: JUNE_HEAD_ALLOCATION_SQL,
    fingerprintMessage: `The pool conserves, but the driver uses June paid heads instead of the stated H1 average monthly population. Conservation proves arithmetic, not that the selected driver definition is right.`,
    hints: [
      `Think of the last cent like an Excel allocation true-up: calculate raw shares, floor to cents, then award remaining pennies by the largest fractional cents.`,
      `Keep pool and monthly driver CTEs separate. Convert raw allocations to integer cents, ROW_NUMBER the remainders, add one cent to the first N ranks, then reconcile the final cents.`,
      HEAD_ALLOCATION_SQL,
    ],
    sayIt: `"The paid-head method assigns $14.84 million to R&D, $13.56 million to S&M, and $3.55 million to COGS. The displayed allocations conserve the pool to the cent."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm142',
    part: 22,
    title: 'Allocate by loaded payroll',
    from: 'priya',
    ask: `Run the same cent-conserving allocation using the H1 loaded-payroll weights. Do not independently round three raw values and accept a one-cent over-allocation; apply the same deterministic largest-remainder control and prove the final displayed total.`,
    deliverable: `Three rows: division, payroll_weight_pct, allocated_pool_usd, and reconciliation_difference_usd. Round percentages to 1 and dollars to 2; order by division. The reconciliation difference must be zero.`,
    tables: ['fct_gl_transactions', 'dim_account', 'dim_department', 'fct_payroll_monthly'],
    canonical: PAYROLL_ALLOCATION_SQL,
    solutionSql: PAYROLL_ALLOCATION_SQL,
    solutionNote: `The cent-balanced payroll allocations are COGS $3,431,812.95, R&D $13,938,656.77, and S&M $14,587,587.55. The unbalanced independently rounded S&M amount would be one cent higher.`,
    ordered: true,
    orderedNote: 'division alphabetically',
    fingerprintSQL: JUNE_PAYROLL_ALLOCATION_SQL,
    fingerprintMessage: `The allocation conserves, but the driver is June-only payroll rather than loaded payroll across all six H1 months. Restore the full H1 driver before comparing methods.`,
    hints: [
      `Use the same penny-control sheet as the paid-head method; only the driver numerator changes. The visible one-decimal weights total 99.9%, so allocate from the unrounded payroll shares.`,
      `Sum H1 total_comp_usd by receiver, calculate raw pool shares, floor to integer cents, distribute remaining pennies by fractional remainder, and reconcile final allocations.`,
      PAYROLL_ALLOCATION_SQL,
    ],
    sayIt: `"The payroll method assigns $14.59 million to S&M, $13.94 million to R&D, and $3.43 million to COGS. A deterministic penny true-up keeps the displayed total equal to the pool."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm143',
    part: 22,
    title: 'Rank the method sensitivity',
    from: 'priya',
    ask: `Compare the two final cent-balanced methods by receiver. Define sensitivity as payroll allocation minus paid-head allocation, preserve the sign, and rank by absolute swing so the review starts with the division whose modeled result changes most.`,
    deliverable: `Three rows: division, paid_head_allocation_usd, payroll_allocation_usd, payroll_minus_head_usd, absolute_swing_usd, and swing_rank. Round dollars to 2; order rank 1 through 3.`,
    tables: ['fct_gl_transactions', 'dim_account', 'dim_department', 'fct_payroll_monthly'],
    canonical: SENSITIVITY_SQL,
    solutionSql: SENSITIVITY_SQL,
    solutionNote: `S&M has the largest swing at +$1,026,111.43, followed by R&D at -$906,109.21 and COGS at -$120,002.22. Positive means the payroll method assigns more than the paid-head method.`,
    ordered: true,
    orderedNote: 'largest absolute swing first',
    fingerprintSQL: REVERSED_SENSITIVITY_SQL,
    fingerprintMessage: `The absolute ranking is right, but every signed delta is reversed. The requested definition is payroll allocation minus paid-head allocation; keep that direction explicit.`,
    hints: [
      `Lay the two allocation columns side by side like two workbook scenarios. The comparison column is payroll minus heads; the sort key is its absolute value.`,
      `Compute sensitivity only from the final cent-balanced amounts, then ROW_NUMBER by ABS(sensitivity) descending with division as the tie-breaker.`,
      SENSITIVITY_SQL,
    ],
    sayIt: `"S&M moves up $1.03 million under payroll while R&D moves down $906 thousand and COGS down $120 thousand. These are method sensitivities, not favorable or unfavorable performance."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm144',
    part: 22,
    title: 'Attach the direct-cost baseline',
    from: 'elena',
    ask: `Put both modeled allocations beside the receivers' direct H1 P&L costs. Define direct cost as deduplicated H1 GL in the receiver divisions with account type COGS or Opex. Exclude G&A from that baseline before adding the pool once under each method; do not turn the pool into incremental company-wide cost.`,
    deliverable: `Three rows: division, direct_cost_usd, paid_head_allocation_usd, paid_head_post_allocation_cost_usd, payroll_allocation_usd, payroll_post_allocation_cost_usd, and method_sensitivity_usd. Round dollars to 2; sort highest payroll post-allocation cost first, then division.`,
    tables: ['fct_gl_transactions', 'dim_account', 'dim_department', 'fct_payroll_monthly'],
    canonical: POST_ALLOCATION_SQL,
    solutionSql: POST_ALLOCATION_SQL,
    solutionNote: `Direct receiver cost is $124,900,537.67. Payroll-method post-allocation cost is $83,425,137.42 for S&M, $52,976,910.78 for R&D, and $20,456,546.74 for COGS; paid-head and payroll totals both reconcile to $156,858,594.94.`,
    ordered: true,
    orderedNote: 'highest payroll post-allocation cost first',
    fingerprintSQL: DOUBLE_COUNTED_POST_ALLOCATION_SQL,
    fingerprintMessage: `The G&A pool was added into each direct baseline and then added again as the receiver allocation. Keep direct cost to the three receiver divisions; add each allocation exactly once.`,
    hints: [
      `Build the direct-cost tab independently from the allocation tabs. Its rows are only receiver-division COGS and Opex actuals.`,
      `Aggregate direct GL by receiver division, join one allocation row per division, and calculate direct plus each method. G&A belongs in the pool CTE, not the direct baseline.`,
      POST_ALLOCATION_SQL,
    ],
    sayIt: `"The three receivers carry $124.90 million of direct H1 COGS and Opex. Either method adds the same $31.96 million pool once; only its division mix changes."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm145',
    part: 22,
    title: 'Package the allocation handoff',
    from: 'priya',
    ask: `Close the review in one controlled CFO handoff. Keep the pool, all three weights under both methods, both reconciliation differences, the largest absolute method swing, direct receiver cost, and both post-allocation totals. Aggregate every source to one row before combining it.`,
    deliverable: `Exactly one row: allocation_pool_usd, cogs_paid_head_weight_pct, rd_paid_head_weight_pct, sm_paid_head_weight_pct, cogs_payroll_weight_pct, rd_payroll_weight_pct, sm_payroll_weight_pct, head_reconciliation_difference_usd, payroll_reconciliation_difference_usd, largest_method_swing_division, largest_method_swing_usd, direct_receiver_cost_usd, head_post_allocation_cost_usd, and payroll_post_allocation_cost_usd. Round dollars to 2 and percentages to 1.`,
    tables: ['fct_gl_transactions', 'dim_account', 'dim_department', 'fct_payroll_monthly'],
    canonical: HANDOFF_SQL,
    solutionSql: HANDOFF_SQL,
    solutionNote: `Both methods allocate the same $31,958,057.27 pool and end at $156,858,594.94 across the receivers. The displayed payroll weights total 99.9% only because they are presentation-rounded; the cent-controlled allocation carries full precision and reconciles exactly. S&M is the largest method swing at +$1,026,111.43.`,
    ordered: false,
    fingerprintSQL: ALLOCATION_SIZE_HANDOFF_SQL,
    fingerprintMessage: `The handoff names R&D because it ranked by allocation size. Rank the comparison by absolute payroll-minus-head sensitivity; S&M is the largest policy swing.`,
    hints: [
      `Build one-row controls for the weights, reconciliation, largest swing, direct baseline, and method totals. Combine only those reduced outputs.`,
      `Use conditional aggregation for the six weights, ABS(payroll - head) for the largest swing, and direct receiver total plus each conserved pool total for the two post-allocation totals.`,
      HANDOFF_SQL,
    ],
    sayIt: `"Both methods distribute the same $31.96 million and preserve a $156.86 million receiver total. S&M has the largest sensitivity at plus $1.03 million under payroll; this packet compares allocation policy, not booked entries or value delivered."`,
    jdCompanies: ['Figma'],
  },
]
