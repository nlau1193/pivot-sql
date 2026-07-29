// Cross-book revenue-to-ARR reconciliation — a Star67 operating-review arc (part 31).
// Bridges recognized GL revenue lines to snapshot-implied ARR (arr/12 per active month),
// distinct from m171-179 revenue close (subscription cents + usage coverage controls).
// Seven decisions: revenue boundary, ARR-implied subscription, monthly reconciliation
// with the gap, isolate the usage residual, ARR concentration vs the book, plan-vs-ARR
// bridge, and the reconciliation handoff.
//
// Audited H1 2026 truth:
//   GL revenue: 4000 Subscription 34,830,812.09 + 4010 Usage 7,157,858.32 = 41,988,670.41
//   ARR-implied H1 subscription (sum arr/12): 34,830,810.37 — reconciles to GL 4000 (~$1.72 gap)
//   Monthly GL(4000+4010) vs ARR/12: GL exceeds ARR-implied by $1.05-1.28M/month (the usage residual)
//   June ARR book: $74,669,849.31; top-10 concentration $3,783,895.36 = 5.07% (diversified)
//   FY2026 H1 revenue plan: $40,676,473.06

const REVENUE_ACCOUNT_BOUNDARY_SQL = `SELECT a.account_id, a.account_name,
  count(*) AS gl_lines,
  round(sum(g.amount), 2) AS h1_actual_usd
FROM fct_gl_transactions g
JOIN dim_account a ON g.account_id = a.account_id
WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
  AND a.account_type = 'Revenue'
GROUP BY a.account_id, a.account_name
ORDER BY h1_actual_usd DESC`

const REVENUE_BOUNDARY_INCLUDE_COGS_TRAP_SQL = `SELECT a.account_id, a.account_name,
  count(*) AS gl_lines,
  round(sum(g.amount), 2) AS h1_actual_usd
FROM fct_gl_transactions g
JOIN dim_account a ON g.account_id = a.account_id
WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
  AND a.account_type IN ('Revenue', 'COGS')
GROUP BY a.account_id, a.account_name
ORDER BY h1_actual_usd DESC`

const ARR_IMPLIED_SUBSCRIPTION_SQL = `SELECT
  round(sum(arr_usd / 12), 2) AS arr_implied_h1_subscription_usd,
  count(*) AS active_customer_months,
  count(DISTINCT customer_id) AS distinct_customers,
  round(sum(arr_usd), 2) AS ending_arr_sum_h1,
  round(sum(arr_usd) / nullif(count(*), 0), 2) AS avg_monthly_arr_usd
FROM fct_subscription_snapshot_monthly
WHERE month_start >= DATE '2026-01-01' AND month_start < DATE '2026-07-01'`

const ARR_IMPLIED_ANNUALIZE_TRAP_SQL = `SELECT
  round(sum(arr_usd), 2) AS arr_implied_h1_subscription_usd,
  count(*) AS active_customer_months,
  count(DISTINCT customer_id) AS distinct_customers,
  round(sum(arr_usd), 2) AS ending_arr_sum_h1,
  round(sum(arr_usd) / nullif(count(*), 0), 2) AS avg_monthly_arr_usd
FROM fct_subscription_snapshot_monthly
WHERE month_start >= DATE '2026-01-01' AND month_start < DATE '2026-07-01'`

const MONTHLY_RECONCILIATION_SQL = `WITH gl AS (
  SELECT date_trunc('month', g.txn_date)::DATE AS month_start,
    round(sum(CASE WHEN g.account_id = '4000' THEN g.amount ELSE 0 END), 2) AS gl_subscription_usd,
    round(sum(g.amount), 2) AS gl_total_revenue_usd
  FROM fct_gl_transactions g
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
    AND g.account_id IN ('4000', '4010')
  GROUP BY 1
), arr AS (
  SELECT month_start,
    round(sum(arr_usd / 12), 2) AS arr_implied_subscription_usd
  FROM fct_subscription_snapshot_monthly
  WHERE month_start >= DATE '2026-01-01' AND month_start < DATE '2026-07-01'
  GROUP BY 1
)
SELECT gl.month_start,
  gl.gl_subscription_usd,
  arr.arr_implied_subscription_usd,
  round(gl.gl_subscription_usd - arr.arr_implied_subscription_usd, 2) AS subscription_gap_usd,
  gl.gl_total_revenue_usd,
  round(gl.gl_total_revenue_usd - arr.arr_implied_subscription_usd, 2) AS total_revenue_gap_usd
FROM gl JOIN arr USING (month_start)
ORDER BY gl.month_start`

const MONTHLY_RECONCILIATION_JOIN_ALL_TRAP_SQL = `WITH gl AS (
  SELECT date_trunc('month', g.txn_date)::DATE AS month_start,
    round(sum(g.amount), 2) AS gl_total_revenue_usd
  FROM fct_gl_transactions g
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' AND g.account_id IN ('4000', '4010')
  GROUP BY 1
), arr AS (
  SELECT month_start, round(sum(arr_usd / 12), 2) AS arr_implied_subscription_usd
  FROM fct_subscription_snapshot_monthly WHERE month_start >= DATE '2026-01-01' AND month_start < DATE '2026-07-01' GROUP BY 1
)
SELECT gl.month_start, round(0, 2) AS gl_subscription_usd, arr.arr_implied_subscription_usd,
  round(0 - arr.arr_implied_subscription_usd, 2) AS subscription_gap_usd,
  gl.gl_total_revenue_usd, round(gl.gl_total_revenue_usd - arr.arr_implied_subscription_usd, 2) AS total_revenue_gap_usd
FROM gl JOIN arr USING (month_start) ORDER BY gl.month_start`

const USAGE_RESIDUAL_SQL = `WITH subscription_gl AS (
  SELECT round(sum(g.amount), 2) AS h1_subscription_gl_usd
  FROM fct_gl_transactions g
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' AND g.account_id = '4000'
), usage_gl AS (
  SELECT round(sum(g.amount), 2) AS h1_usage_gl_usd,
    count(DISTINCT g.customer_id) AS usage_customers
  FROM fct_gl_transactions g
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' AND g.account_id = '4010'
), total_gl AS (
  SELECT round(sum(g.amount), 2) AS h1_total_gl_usd
  FROM fct_gl_transactions g
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' AND g.account_id IN ('4000', '4010')
)
SELECT
  subscription_gl.h1_subscription_gl_usd,
  usage_gl.h1_usage_gl_usd,
  usage_gl.usage_customers,
  total_gl.h1_total_gl_usd,
  round(100.0 * usage_gl.h1_usage_gl_usd / nullif(total_gl.h1_total_gl_usd, 0), 2) AS usage_share_pct
FROM subscription_gl CROSS JOIN usage_gl CROSS JOIN total_gl`

const USAGE_RESIDUAL_FOLD_4010_TRAP_SQL = `WITH subscription_gl AS (
  SELECT round(sum(g.amount), 2) AS h1_subscription_gl_usd
  FROM fct_gl_transactions g WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' AND g.account_id IN ('4000','4010')
), usage_gl AS (
  SELECT round(sum(g.amount), 2) AS h1_usage_gl_usd, count(DISTINCT g.customer_id) AS usage_customers
  FROM fct_gl_transactions g WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' AND g.account_id = '4010'
), total_gl AS (
  SELECT round(sum(g.amount), 2) AS h1_total_gl_usd
  FROM fct_gl_transactions g WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' AND g.account_id IN ('4000', '4010')
)
SELECT subscription_gl.h1_subscription_gl_usd, usage_gl.h1_usage_gl_usd, usage_gl.usage_customers,
  total_gl.h1_total_gl_usd, round(100.0 * usage_gl.h1_usage_gl_usd / nullif(total_gl.h1_total_gl_usd, 0), 2) AS usage_share_pct
FROM subscription_gl CROSS JOIN usage_gl CROSS JOIN total_gl`

const ARR_CONCENTRATION_SQL = `WITH june AS (
  SELECT customer_id, arr_usd,
    row_number() OVER (ORDER BY arr_usd DESC, customer_id) AS arr_rank
  FROM fct_subscription_snapshot_monthly
  WHERE month_start = DATE '2026-06-01'
)
SELECT
  round(sum(CASE WHEN arr_rank <= 10 THEN arr_usd ELSE 0 END), 2) AS top10_arr_usd,
  round(sum(arr_usd), 2) AS total_arr_usd,
  count(*) AS distinct_customers,
  round(100.0 * sum(CASE WHEN arr_rank <= 10 THEN arr_usd ELSE 0 END) / nullif(sum(arr_usd), 0), 2) AS top10_concentration_pct,
  round(100.0 * sum(CASE WHEN arr_rank <= 50 THEN arr_usd ELSE 0 END) / nullif(sum(arr_usd), 0), 2) AS top50_concentration_pct
FROM june`

const ARR_CONCENTRATION_CUSTOMER_COUNT_TRAP_SQL = `WITH june AS (
  SELECT customer_id, arr_usd,
    row_number() OVER (ORDER BY arr_usd DESC, customer_id) AS arr_rank
  FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'
)
SELECT
  round(count(CASE WHEN arr_rank <= 10 THEN 1 END), 2) AS top10_arr_usd,
  round(count(*), 2) AS total_arr_usd,
  count(*) AS distinct_customers,
  round(100.0 * count(CASE WHEN arr_rank <= 10 THEN 1 END) / nullif(count(*), 0), 2) AS top10_concentration_pct,
  round(100.0 * count(CASE WHEN arr_rank <= 50 THEN 1 END) / nullif(count(*), 0), 2) AS top50_concentration_pct
FROM june`

const PLAN_VS_ARR_BRIDGE_SQL = `WITH plan_rev AS (
  SELECT round(sum(b.amount_usd), 2) AS h1_plan_revenue_usd
  FROM fct_budget b
  JOIN dim_account a ON b.account_id = a.account_id
  WHERE b.version_name = 'FY2026 Plan'
    AND b.fiscal_month >= DATE '2026-01-01' AND b.fiscal_month < DATE '2026-07-01'
    AND a.account_type = 'Revenue'
), arr_implied AS (
  SELECT round(sum(arr_usd / 12), 2) AS h1_arr_implied_subscription_usd
  FROM fct_subscription_snapshot_monthly
  WHERE month_start >= DATE '2026-01-01' AND month_start < DATE '2026-07-01'
), gl_actual AS (
  SELECT round(sum(g.amount), 2) AS h1_gl_revenue_usd
  FROM fct_gl_transactions g
  JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' AND a.account_type = 'Revenue'
)
SELECT
  plan_rev.h1_plan_revenue_usd,
  gl_actual.h1_gl_revenue_usd,
  round(gl_actual.h1_gl_revenue_usd - plan_rev.h1_plan_revenue_usd, 2) AS actual_vs_plan_variance_usd,
  arr_implied.h1_arr_implied_subscription_usd,
  round(gl_actual.h1_gl_revenue_usd - arr_implied.h1_arr_implied_subscription_usd, 2) AS gl_vs_arr_residual_usd,
  round(100.0 * (gl_actual.h1_gl_revenue_usd - arr_implied.h1_arr_implied_subscription_usd) / nullif(gl_actual.h1_gl_revenue_usd, 0), 2) AS residual_share_pct
FROM plan_rev CROSS JOIN arr_implied CROSS JOIN gl_actual`

const PLAN_VS_ARR_DROP_PLAN_TRAP_SQL = `WITH arr_implied AS (
  SELECT round(sum(arr_usd / 12), 2) AS h1_arr_implied_subscription_usd
  FROM fct_subscription_snapshot_monthly WHERE month_start >= DATE '2026-01-01' AND month_start < DATE '2026-07-01'
), gl_actual AS (
  SELECT round(sum(g.amount), 2) AS h1_gl_revenue_usd
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' AND a.account_type = 'Revenue'
)
SELECT round(0, 2) AS h1_plan_revenue_usd, gl_actual.h1_gl_revenue_usd,
  round(gl_actual.h1_gl_revenue_usd - 0, 2) AS actual_vs_plan_variance_usd,
  arr_implied.h1_arr_implied_subscription_usd,
  round(gl_actual.h1_gl_revenue_usd - arr_implied.h1_arr_implied_subscription_usd, 2) AS gl_vs_arr_residual_usd,
  round(100.0 * (gl_actual.h1_gl_revenue_usd - arr_implied.h1_arr_implied_subscription_usd) / nullif(gl_actual.h1_gl_revenue_usd, 0), 2) AS residual_share_pct
FROM arr_implied CROSS JOIN gl_actual`

const RECONCILIATION_HANDOFF_SQL = `WITH gl_subscription AS (
  SELECT round(sum(g.amount), 2) AS h1_subscription_gl_usd
  FROM fct_gl_transactions g
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' AND g.account_id = '4000'
), gl_usage AS (
  SELECT round(sum(g.amount), 2) AS h1_usage_gl_usd
  FROM fct_gl_transactions g
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' AND g.account_id = '4010'
), arr_implied AS (
  SELECT round(sum(arr_usd / 12), 2) AS h1_arr_implied_subscription_usd
  FROM fct_subscription_snapshot_monthly
  WHERE month_start >= DATE '2026-01-01' AND month_start < DATE '2026-07-01'
), june_arr AS (
  SELECT round(sum(arr_usd), 2) AS june_ending_arr_usd
  FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'
), plan_rev AS (
  SELECT round(sum(b.amount_usd), 2) AS h1_plan_revenue_usd
  FROM fct_budget b JOIN dim_account a ON b.account_id = a.account_id
  WHERE b.version_name = 'FY2026 Plan' AND b.fiscal_month >= DATE '2026-01-01' AND b.fiscal_month < DATE '2026-07-01' AND a.account_type = 'Revenue'
)
SELECT
  gl_subscription.h1_subscription_gl_usd,
  arr_implied.h1_arr_implied_subscription_usd,
  round(gl_subscription.h1_subscription_gl_usd - arr_implied.h1_arr_implied_subscription_usd, 2) AS subscription_reconciliation_gap_usd,
  gl_usage.h1_usage_gl_usd,
  round(gl_subscription.h1_subscription_gl_usd + gl_usage.h1_usage_gl_usd, 2) AS h1_total_revenue_usd,
  round(100.0 * gl_usage.h1_usage_gl_usd / nullif(gl_subscription.h1_subscription_gl_usd + gl_usage.h1_usage_gl_usd, 0), 2) AS usage_share_pct,
  june_arr.june_ending_arr_usd,
  plan_rev.h1_plan_revenue_usd
FROM gl_subscription CROSS JOIN gl_usage CROSS JOIN arr_implied CROSS JOIN june_arr CROSS JOIN plan_rev`

const HANDOFF_FOLD_USAGE_INTO_SUB_TRAP_SQL = `WITH gl_subscription AS (
  SELECT round(sum(g.amount), 2) AS h1_subscription_gl_usd
  FROM fct_gl_transactions g WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' AND g.account_id IN ('4000','4010')
), gl_usage AS (
  SELECT round(0, 2) AS h1_usage_gl_usd
), arr_implied AS (
  SELECT round(sum(arr_usd / 12), 2) AS h1_arr_implied_subscription_usd
  FROM fct_subscription_snapshot_monthly WHERE month_start >= DATE '2026-01-01' AND month_start < DATE '2026-07-01'
), june_arr AS (
  SELECT round(sum(arr_usd), 2) AS june_ending_arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'
), plan_rev AS (
  SELECT round(sum(b.amount_usd), 2) AS h1_plan_revenue_usd
  FROM fct_budget b JOIN dim_account a ON b.account_id = a.account_id
  WHERE b.version_name = 'FY2026 Plan' AND b.fiscal_month >= DATE '2026-01-01' AND b.fiscal_month < DATE '2026-07-01' AND a.account_type = 'Revenue'
)
SELECT gl_subscription.h1_subscription_gl_usd, arr_implied.h1_arr_implied_subscription_usd,
  round(gl_subscription.h1_subscription_gl_usd - arr_implied.h1_arr_implied_subscription_usd, 2) AS subscription_reconciliation_gap_usd,
  gl_usage.h1_usage_gl_usd, round(gl_subscription.h1_subscription_gl_usd + gl_usage.h1_usage_gl_usd, 2) AS h1_total_revenue_usd,
  round(100.0 * gl_usage.h1_usage_gl_usd / nullif(gl_subscription.h1_subscription_gl_usd + gl_usage.h1_usage_gl_usd, 0), 2) AS usage_share_pct,
  june_arr.june_ending_arr_usd, plan_rev.h1_plan_revenue_usd
FROM gl_subscription CROSS JOIN gl_usage CROSS JOIN arr_implied CROSS JOIN june_arr CROSS JOIN plan_rev`

export const REVENUE_ARR_RECONCILIATION_MISSIONS = [
  {
    id: 'm211',
    part: 31,
    title: 'Set the revenue-account boundary',
    from: 'maria',
    ask: `Open the revenue-to-ARR reconciliation by setting the GL revenue boundary: which accounts carry recognized revenue in H1 2026. Two accounts — 4000 Subscription Revenue and 4010 Usage Revenue — are the lines. List each with its line count and H1 actual so the reconciliation starts from the full recognized-revenue population.`,
    deliverable: `Two rows ordered by h1_actual_usd descending: account_id, account_name, gl_lines, h1_actual_usd. Round dollars to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_account'],
    canonical: REVENUE_ACCOUNT_BOUNDARY_SQL,
    solutionSql: REVENUE_ACCOUNT_BOUNDARY_SQL,
    solutionNote: `H1 2026 recognized revenue is $41.99M across two accounts: 4000 Subscription Revenue ($34.83M) and 4010 Usage Revenue ($7.16M). Subscription reconciles to ARR; usage is metered and has no ARR equivalent — that distinction drives the rest of the review. This is recognized revenue only, not cash or bookings.`,
    ordered: true,
    orderedNote: 'h1_actual_usd descending',
    fingerprintSQL: REVENUE_BOUNDARY_INCLUDE_COGS_TRAP_SQL,
    fingerprintMessage: `You included COGS accounts in the revenue boundary, mixing cost-of-revenue lines into the reconciliation. Restrict to account_type = 'Revenue' so the review starts from recognized revenue only.`,
    hints: [
      `Join GL to dim_account, filter to H1 2026 and account_type = 'Revenue'. Group by account.`,
      `Count lines and sum amount per account. Order by H1 actual descending so subscription leads.`,
      REVENUE_ACCOUNT_BOUNDARY_SQL,
    ],
    sayIt: `"H1 recognized revenue is $41.99 million across two accounts — $34.83 million subscription and $7.16 million usage. Subscription reconciles to ARR; usage is metered with no ARR equivalent. This is recognized revenue, not cash or bookings."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm212',
    part: 31,
    title: 'Compute the ARR-implied H1 subscription revenue',
    from: 'maria',
    ask: `The ARR snapshot implies a subscription revenue figure: each active customer-month contributes arr_usd / 12 (the monthly run-rate of annual contract value). Sum that across all active H1 2026 customer-months to get the ARR-implied subscription revenue, plus the active customer-months, distinct customers, total ARR sum, and the average monthly ARR.`,
    deliverable: `Exactly one row: arr_implied_h1_subscription_usd, active_customer_months, distinct_customers, ending_arr_sum_h1, avg_monthly_arr_usd. Round dollars to 2 decimals.`,
    tables: ['fct_subscription_snapshot_monthly'],
    canonical: ARR_IMPLIED_SUBSCRIPTION_SQL,
    solutionSql: ARR_IMPLIED_SUBSCRIPTION_SQL,
    solutionNote: `The ARR-implied H1 subscription revenue is roughly $34.83M — the sum of arr_usd/12 across every active customer-month. This is the figure that should reconcile to GL account 4000 if the snapshot and ledger agree. It is an ARR-derived subscription run-rate, not usage, cash, or bookings.`,
    ordered: false,
    fingerprintSQL: ARR_IMPLIED_ANNUALIZE_TRAP_SQL,
    fingerprintMessage: `You summed raw arr_usd without dividing by 12, annualizing the figure and overstating the implied subscription revenue by 12x. Each customer-month contributes arr_usd/12 — the monthly run-rate of the annual contract — so divide before summing.`,
    hints: [
      `Filter the snapshot to H1 2026 month_start. Each row is one active customer-month contributing arr_usd/12.`,
      `Sum arr_usd/12 for the implied subscription revenue. Count rows for customer-months and distinct customer_id for customers. Sum arr_usd for the total ARR passed through the half.`,
      ARR_IMPLIED_SUBSCRIPTION_SQL,
    ],
    sayIt: `"The ARR-implied H1 subscription revenue is about $34.83 million — the sum of each customer-month's annual contract divided by 12. That's the figure that should reconcile to GL subscription revenue. It's a run-rate, not usage, cash, or bookings."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm213',
    part: 31,
    title: 'Reconcile GL subscription to ARR month by month',
    from: 'maria',
    ask: `Does the GL subscription line tie to the ARR-implied figure each month? For each H1 2026 month, show GL subscription (4000), ARR-implied subscription, and the subscription gap; then the GL total revenue (4000+4010) and the total-revenue gap to ARR-implied. The subscription gap should be near zero; the total-revenue gap carries the usage residual.`,
    deliverable: `Six rows ordered by month_start ascending: month_start, gl_subscription_usd, arr_implied_subscription_usd, subscription_gap_usd, gl_total_revenue_usd, total_revenue_gap_usd. Round dollars to 2 decimals.`,
    tables: ['fct_gl_transactions', 'fct_subscription_snapshot_monthly'],
    canonical: MONTHLY_RECONCILIATION_SQL,
    solutionSql: MONTHLY_RECONCILIATION_SQL,
    solutionNote: `The GL subscription line reconciles to the ARR-implied subscription within a small gap each month, confirming the snapshot and ledger agree on subscription run-rate. The total-revenue gap (GL 4000+4010 minus ARR-implied) runs $1.05M-$1.28M per month — that residual is the usage revenue that has no ARR equivalent. This is a reconciliation read, not a cash or billing assertion.`,
    ordered: true,
    orderedNote: 'month_start ascending',
    fingerprintSQL: MONTHLY_RECONCILIATION_JOIN_ALL_TRAP_SQL,
    fingerprintMessage: `You zeroed out the gl_subscription_usd column, so the subscription gap reads as the full negative of ARR-implied and the reconciliation is meaningless. Carry the actual GL 4000 amount conditionally summed so the subscription gap is a real small residual.`,
    hints: [
      `Build one monthly GL CTE with conditional sums: account 4000 for subscription, 4000+4010 for total. Build one monthly ARR CTE with sum(arr_usd/12). Join on month.`,
      `The subscription gap is GL 4000 minus ARR-implied (should be small). The total-revenue gap is GL 4000+4010 minus ARR-implied (carries the usage residual). Order by month.`,
      MONTHLY_RECONCILIATION_SQL,
    ],
    sayIt: `"GL subscription reconciles to ARR-implied within a small gap each month — the snapshot and ledger agree on run-rate. The total-revenue gap of $1-1.3 million a month is the usage revenue that has no ARR equivalent. This is a reconciliation read, not a billing assertion."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm214',
    part: 31,
    title: 'Isolate the usage revenue residual',
    from: 'fin',
    ask: `The total-revenue gap to ARR is the usage line. Isolate H1 2026 usage revenue (account 4010) with its distinct customers, alongside subscription and total revenue, and compute usage's share of total recognized revenue. This shows how material metered usage is relative to subscription.`,
    deliverable: `Exactly one row: h1_subscription_gl_usd, h1_usage_gl_usd, usage_customers, h1_total_gl_usd, usage_share_pct. Round dollars and percent to 2 decimals.`,
    tables: ['fct_gl_transactions'],
    canonical: USAGE_RESIDUAL_SQL,
    solutionSql: USAGE_RESIDUAL_SQL,
    solutionNote: `H1 usage revenue is $7.16M from its distinct customers against $34.83M subscription — about 17.0% of total recognized revenue. Usage is the residual that the ARR snapshot does not cover, because metered consumption is not an annual contract. This is a recognized-revenue split, not cash or a usage forecast.`,
    ordered: false,
    fingerprintSQL: USAGE_RESIDUAL_FOLD_4010_TRAP_SQL,
    fingerprintMessage: `You folded account 4010 into the subscription total, so usage appears inside subscription and the residual vanishes. Keep subscription to account 4000 only so usage (4010) stands alone as the residual.`,
    hints: [
      `Build three one-row CTEs: subscription (sum 4000), usage (sum 4010 + distinct customers), total (sum 4000+4010). CROSS JOIN.`,
      `Usage share is 100 * usage / total, null-guarded. One row out.`,
      USAGE_RESIDUAL_SQL,
    ],
    sayIt: `"H1 usage revenue is $7.16 million against $34.83 million subscription — about 17% of total recognized revenue. Usage is the residual the ARR snapshot doesn't cover, because metered consumption isn't an annual contract. This is a recognized-revenue split, not cash or a forecast."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm215',
    part: 31,
    title: 'Read the ARR book concentration',
    from: 'fin',
    ask: `How concentrated is the ARR book? Using the June 2026 snapshot, compute the top-10 and top-50 customer ARR shares of the total ending book, plus the distinct customer count. A low top-10 share means a diversified book; a high one means a few customers carry the revenue and retention risk concentrates.`,
    deliverable: `Exactly one row: top10_arr_usd, total_arr_usd, distinct_customers, top10_concentration_pct, top50_concentration_pct. Round dollars and percent to 2 decimals.`,
    tables: ['fct_subscription_snapshot_monthly'],
    canonical: ARR_CONCENTRATION_SQL,
    solutionSql: ARR_CONCENTRATION_SQL,
    solutionNote: `The June book is highly diversified: the top-10 customers carry only about 5.1% of ending ARR, and the top-50 carry a larger but still modest share. Revenue is spread across thousands of customers rather than concentrated in a few — retention risk is dispersed, not concentrated. This is an ARR concentration read, not logo count or revenue.`,
    ordered: false,
    fingerprintSQL: ARR_CONCENTRATION_CUSTOMER_COUNT_TRAP_SQL,
    fingerprintMessage: `You counted customers instead of summing their ARR for the concentration shares, so top-10 reads as a customer-count share (10 of thousands) rather than a dollar share. Weight by arr_usd so the concentration reflects where the revenue sits.`,
    hints: [
      `Filter the snapshot to June 2026. Rank customers by arr_usd descending with a deterministic tiebreaker.`,
      `Top-10 share is 100 * sum(arr where rank<=10) / sum(all arr); same for top-50. Use conditional sums in one row. Count distinct customers.`,
      ARR_CONCENTRATION_SQL,
    ],
    sayIt: `"The June book is highly diversified — the top ten customers carry only about 5% of ending ARR. Revenue is spread across thousands of customers, so retention risk is dispersed, not concentrated. This is an ARR concentration read, not logo count or revenue."`,
    jdCompanies: ['Stripe'],
  },
  {
    id: 'm216',
    part: 31,
    title: 'Bridge plan revenue, actual, and ARR-implied',
    from: 'maria',
    ask: `The three-way bridge leadership wants: the FY2026 H1 revenue plan, the H1 GL actual, the actual-vs-plan variance, the ARR-implied subscription, the GL-vs-ARR residual (which is usage), and the residual's share of actual. This shows whether actual beat plan and how much of actual is metered usage outside the ARR book.`,
    deliverable: `Exactly one row: h1_plan_revenue_usd, h1_gl_revenue_usd, actual_vs_plan_variance_usd, h1_arr_implied_subscription_usd, gl_vs_arr_residual_usd, residual_share_pct. Round dollars and percent to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_account', 'fct_subscription_snapshot_monthly', 'fct_budget'],
    canonical: PLAN_VS_ARR_BRIDGE_SQL,
    solutionSql: PLAN_VS_ARR_BRIDGE_SQL,
    solutionNote: `H1 actual revenue ($41.99M) beat the FY2026 plan ($40.68M) by $1.31M. The ARR-implied subscription ($34.83M) reconciles to the GL subscription line, and the GL-vs-ARR residual ($7.16M) is the usage revenue — about 17% of actual. This three-way bridge ties plan, actual, and ARR together; it is not cash, bookings, or a forecast.`,
    ordered: false,
    fingerprintSQL: PLAN_VS_ARR_DROP_PLAN_TRAP_SQL,
    fingerprintMessage: `You dropped the plan column to zero, so the actual-vs-plan variance equals actual itself and the bridge loses the plan anchor. Carry the real FY2026 H1 revenue plan so the variance reads actual minus plan.`,
    hints: [
      `Build three one-row CTEs: plan (FY2026 H1 revenue from fct_budget), arr-implied (sum arr/12), and GL actual (sum 4000+4010). CROSS JOIN.`,
      `Variance is actual minus plan. The GL-vs-ARR residual is actual minus arr-implied (the usage portion). Residual share is 100 * residual / actual.`,
      PLAN_VS_ARR_BRIDGE_SQL,
    ],
    sayIt: `"H1 actual of $41.99 million beat the $40.68 million plan by $1.31 million. The ARR-implied subscription of $34.83 million reconciles to the GL line, and the $7.16 million residual is usage — about 17% of actual. This three-way bridge ties plan, actual, and ARR together; not cash or bookings."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm217',
    part: 31,
    title: 'Package the revenue-to-ARR reconciliation handoff',
    from: 'maria',
    ask: `Close the reconciliation in one Finance handoff. Carry the GL subscription, ARR-implied subscription, and subscription reconciliation gap; the GL usage; the H1 total revenue and usage share; the June ending ARR; and the FY2026 H1 revenue plan. Reduce each control to one row before combining.`,
    deliverable: `Exactly one row: h1_subscription_gl_usd, h1_arr_implied_subscription_usd, subscription_reconciliation_gap_usd, h1_usage_gl_usd, h1_total_revenue_usd, usage_share_pct, june_ending_arr_usd, h1_plan_revenue_usd. Round dollars and percent to 2 decimals.`,
    tables: ['fct_gl_transactions', 'fct_subscription_snapshot_monthly', 'fct_budget', 'dim_account'],
    canonical: RECONCILIATION_HANDOFF_SQL,
    solutionSql: RECONCILIATION_HANDOFF_SQL,
    solutionNote: `The reconciliation handoff: GL subscription $34.83M ties to ARR-implied $34.83M within a small gap; usage $7.16M is the residual at about 17% of the $41.99M total; June ending ARR is $74.67M; the H1 plan was $40.68M. This is a recognized-revenue-to-ARR reconciliation handoff — not cash, bookings, a forecast, or a billing-accuracy assertion.`,
    ordered: false,
    fingerprintSQL: HANDOFF_FOLD_USAGE_INTO_SUB_TRAP_SQL,
    fingerprintMessage: `You folded usage (4010) into the subscription total, so usage reads zero and the residual disappears from the handoff. Keep subscription to account 4000 so usage stands alone as the reconciling residual.`,
    hints: [
      `Build one-row GL subscription (4000), GL usage (4010), ARR-implied (sum arr/12), June ending ARR (sum arr at June), and plan revenue controls. CROSS JOIN only those reduced single-row outputs.`,
      `The subscription reconciliation gap is GL 4000 minus ARR-implied (small). Total revenue is 4000+4010. Usage share is 100 * usage / total.`,
      RECONCILIATION_HANDOFF_SQL,
    ],
    sayIt: `"GL subscription of $34.83 million ties to ARR-implied within a small gap; usage of $7.16 million is the residual at 17% of the $41.99 million total; June ending ARR is $74.67 million; the H1 plan was $40.68 million. This is a recognized-revenue-to-ARR reconciliation handoff — not cash, bookings, or a billing assertion."`,
    jdCompanies: ['Stripe'],
  },
]
