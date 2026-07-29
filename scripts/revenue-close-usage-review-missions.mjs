const REVENUE_ACCOUNT_BOUNDARY_SQL = `WITH actual AS (
  SELECT account_id,
    count(*) AS actual_lines,
    count(*) FILTER (WHERE customer_id IS NULL) AS missing_customer_lines,
    sum(CAST(amount AS DECIMAL(18, 2))) AS actual_usd
  FROM fct_gl_transactions
  WHERE txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01'
  GROUP BY account_id
), plan AS (
  SELECT account_id, count(*) AS plan_rows, sum(amount_usd) AS plan_usd
  FROM fct_budget
  WHERE version_name = 'FY2026 Plan'
    AND fiscal_month >= DATE '2026-01-01' AND fiscal_month < DATE '2026-07-01'
  GROUP BY account_id
)
SELECT a.account_id, a.account_name,
  coalesce(x.actual_lines, 0) AS actual_lines,
  coalesce(x.missing_customer_lines, 0) AS missing_customer_lines,
  coalesce(p.plan_rows, 0) AS plan_rows,
  round(coalesce(x.actual_usd, 0), 2) AS h1_actual_usd,
  round(coalesce(p.plan_usd, 0), 2) AS h1_plan_usd,
  round(coalesce(x.actual_usd, 0) - coalesce(p.plan_usd, 0), 2) AS variance_usd
FROM dim_account a
LEFT JOIN actual x USING (account_id)
LEFT JOIN plan p USING (account_id)
WHERE a.account_type = 'Revenue'
ORDER BY a.account_id`

const LOADED_ONLY_REVENUE_BOUNDARY_SQL = REVENUE_ACCOUNT_BOUNDARY_SQL.replace(
  "WHERE a.account_type = 'Revenue'\nORDER BY",
  `WHERE a.account_type = 'Revenue'
  AND (coalesce(x.actual_lines, 0) <> 0 OR coalesce(p.plan_rows, 0) <> 0)
ORDER BY`,
)

const SUBSCRIPTION_CENTS_RECONCILIATION_SQL = `WITH actual AS (
  SELECT date_trunc('month', txn_date)::DATE AS month_start,
    count(*) AS subscription_lines,
    count(DISTINCT customer_id) AS actual_customers,
    sum(round(amount * 100)::BIGINT) AS actual_revenue_cents
  FROM fct_gl_transactions
  WHERE txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01'
    AND account_id = '4000'
  GROUP BY 1
), expected AS (
  SELECT month_start,
    count(*) AS snapshot_customer_months,
    sum(round(round(arr_usd / 12, 2) * 100)::BIGINT) AS expected_revenue_cents
  FROM fct_subscription_snapshot_monthly
  WHERE month_start >= DATE '2026-01-01' AND month_start < DATE '2026-07-01'
  GROUP BY 1
)
SELECT e.month_start, e.snapshot_customer_months, a.subscription_lines,
  a.actual_customers,
  round(a.actual_revenue_cents / 100.0, 2) AS actual_subscription_revenue_usd,
  round(e.expected_revenue_cents / 100.0, 2) AS snapshot_implied_revenue_usd,
  a.actual_revenue_cents - e.expected_revenue_cents AS difference_cents
FROM expected e FULL OUTER JOIN actual a USING (month_start)
ORDER BY month_start`

const BULK_ROUNDED_SUBSCRIPTION_RECONCILIATION_SQL = SUBSCRIPTION_CENTS_RECONCILIATION_SQL.replace(
  'sum(round(round(arr_usd / 12, 2) * 100)::BIGINT) AS expected_revenue_cents',
  'round(sum(arr_usd) / 12 * 100)::BIGINT AS expected_revenue_cents',
)

const SUBSCRIPTION_SOURCE_ROUTING_SQL = `SELECT s.plan_name, g.source_system,
  count(*) AS subscription_lines,
  count(DISTINCT s.customer_id) AS customers,
  count(DISTINCT struct_pack(month_start := s.month_start, customer_id := s.customer_id)) AS customer_months,
  round(sum(g.amount), 2) AS subscription_revenue_usd
FROM fct_subscription_snapshot_monthly s
JOIN fct_gl_transactions g
  ON g.customer_id = s.customer_id
 AND date_trunc('month', g.txn_date)::DATE = s.month_start
 AND g.account_id = '4000'
WHERE s.month_start >= DATE '2026-01-01' AND s.month_start < DATE '2026-07-01'
GROUP BY s.plan_name, g.source_system
ORDER BY subscription_revenue_usd DESC, s.plan_name, g.source_system`

const CUSTOMER_ONLY_SUBSCRIPTION_ROUTING_SQL = SUBSCRIPTION_SOURCE_ROUTING_SQL.replace(
  "\n AND date_trunc('month', g.txn_date)::DATE = s.month_start",
  '',
)

const USAGE_CUSTOMER_MONTH_COVERAGE_SQL = `WITH expected AS (
  SELECT month_start, customer_id, plan_name, seats
  FROM fct_subscription_snapshot_monthly
  WHERE month_start >= DATE '2026-01-01' AND month_start < DATE '2026-07-01'
    AND plan_name IN ('Growth', 'Enterprise')
), observed AS (
  SELECT date_trunc('month', txn_date)::DATE AS month_start, customer_id,
    count(*) AS usage_lines, sum(amount) AS usage_revenue_usd
  FROM fct_gl_transactions
  WHERE txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01'
    AND account_id = '4010'
  GROUP BY 1, 2
), coverage AS (
  SELECT coalesce(e.plan_name, 'Outside expected population') AS plan_name,
    e.customer_id AS expected_customer_id,
    o.customer_id AS observed_customer_id,
    e.seats, o.usage_lines, o.usage_revenue_usd
  FROM expected e FULL OUTER JOIN observed o USING (month_start, customer_id)
)
SELECT plan_name,
  count(expected_customer_id) AS expected_customer_months,
  count(observed_customer_id) AS observed_customer_months,
  count(*) FILTER (WHERE expected_customer_id IS NOT NULL AND observed_customer_id IS NULL) AS missing_observed_customer_months,
  count(*) FILTER (WHERE expected_customer_id IS NULL AND observed_customer_id IS NOT NULL) AS unexpected_observed_customer_months,
  coalesce(sum(seats), 0) AS licensed_seat_months,
  coalesce(sum(usage_lines), 0) AS usage_lines,
  round(coalesce(sum(usage_revenue_usd), 0), 2) AS usage_revenue_usd
FROM coverage
GROUP BY plan_name
ORDER BY usage_revenue_usd DESC, plan_name`

const ALL_PLAN_USAGE_COVERAGE_SQL = USAGE_CUSTOMER_MONTH_COVERAGE_SQL.replace(
  "\n    AND plan_name IN ('Growth', 'Enterprise')",
  '',
)

const REVENUE_ACTUAL_VERSUS_PLAN_SQL = `WITH actual AS (
  SELECT account_id, sum(CAST(amount AS DECIMAL(18, 2))) AS actual_usd
  FROM fct_gl_transactions
  WHERE txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01'
    AND account_id IN ('4000', '4010')
  GROUP BY account_id
), plan AS (
  SELECT account_id, sum(amount_usd) AS plan_usd
  FROM fct_budget
  WHERE version_name = 'FY2026 Plan'
    AND fiscal_month >= DATE '2026-01-01' AND fiscal_month < DATE '2026-07-01'
    AND account_id IN ('4000', '4010')
  GROUP BY account_id
)
SELECT d.account_name,
  round(a.actual_usd, 2) AS h1_actual_usd,
  round(p.plan_usd, 2) AS h1_plan_usd,
  round(a.actual_usd - p.plan_usd, 2) AS variance_usd,
  round(100.0 * (a.actual_usd - p.plan_usd) / nullif(p.plan_usd, 0), 1) AS variance_pct,
  round(100.0 * a.actual_usd / sum(a.actual_usd) OVER (), 1) AS actual_revenue_mix_pct
FROM actual a JOIN plan p USING (account_id) JOIN dim_account d USING (account_id)
ORDER BY variance_usd DESC, d.account_name`

const REVERSED_REVENUE_VARIANCE_SQL = REVENUE_ACTUAL_VERSUS_PLAN_SQL.replaceAll(
  'a.actual_usd - p.plan_usd',
  'p.plan_usd - a.actual_usd',
)

const USAGE_STREAMS_BY_PLAN_SQL = `WITH stream AS (
  SELECT s.plan_name, g.memo, g.customer_id, g.amount
  FROM fct_gl_transactions g
  JOIN fct_subscription_snapshot_monthly s
    ON s.customer_id = g.customer_id
   AND s.month_start = date_trunc('month', g.txn_date)::DATE
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
    AND g.account_id = '4010'
)
SELECT plan_name, memo AS revenue_stream_label,
  count(*) AS usage_lines,
  count(DISTINCT customer_id) AS customers,
  round(sum(amount), 2) AS usage_revenue_usd,
  round(100.0 * sum(amount) / sum(sum(amount)) OVER (PARTITION BY plan_name), 1) AS within_plan_revenue_share_pct
FROM stream
GROUP BY plan_name, memo
ORDER BY plan_name, usage_revenue_usd DESC, memo`

const COLLAPSED_PLAN_USAGE_STREAMS_SQL = `WITH stream AS (
  SELECT s.plan_name, g.memo, g.customer_id, g.amount
  FROM fct_gl_transactions g
  JOIN fct_subscription_snapshot_monthly s
    ON s.customer_id = g.customer_id
   AND s.month_start = date_trunc('month', g.txn_date)::DATE
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
    AND g.account_id = '4010'
)
SELECT 'All loaded plans' AS plan_name, memo AS revenue_stream_label,
  count(*) AS usage_lines,
  count(DISTINCT customer_id) AS customers,
  round(sum(amount), 2) AS usage_revenue_usd,
  round(100.0 * sum(amount) / sum(sum(amount)) OVER (), 1) AS within_plan_revenue_share_pct
FROM stream
GROUP BY memo
ORDER BY usage_revenue_usd DESC, memo`

const USAGE_CONCENTRATION_SQL = `WITH customer_usage AS (
  SELECT s.plan_name, g.customer_id, sum(g.amount) AS usage_revenue_usd
  FROM fct_gl_transactions g
  JOIN fct_subscription_snapshot_monthly s
    ON s.customer_id = g.customer_id
   AND s.month_start = date_trunc('month', g.txn_date)::DATE
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
    AND g.account_id = '4010'
  GROUP BY s.plan_name, g.customer_id
), plan_rank AS (
  SELECT *, row_number() OVER (PARTITION BY plan_name ORDER BY usage_revenue_usd DESC, customer_id) AS usage_rank
  FROM customer_usage
), company_usage AS (
  SELECT customer_id, sum(usage_revenue_usd) AS usage_revenue_usd FROM customer_usage GROUP BY customer_id
), company_rank AS (
  SELECT *, row_number() OVER (ORDER BY usage_revenue_usd DESC, customer_id) AS usage_rank FROM company_usage
), rollup AS (
  SELECT plan_name AS population,
    count(*) AS customers,
    sum(usage_revenue_usd) AS usage_revenue_usd,
    sum(usage_revenue_usd) FILTER (WHERE usage_rank <= 10) AS top_ten_usage_revenue_usd,
    max(usage_revenue_usd) AS largest_customer_usage_revenue_usd
  FROM plan_rank GROUP BY plan_name
  UNION ALL
  SELECT 'All eligible', count(*), sum(usage_revenue_usd),
    sum(usage_revenue_usd) FILTER (WHERE usage_rank <= 10), max(usage_revenue_usd)
  FROM company_rank
)
SELECT population, customers,
  round(usage_revenue_usd, 2) AS usage_revenue_usd,
  round(top_ten_usage_revenue_usd, 2) AS top_ten_usage_revenue_usd,
  round(100.0 * top_ten_usage_revenue_usd / nullif(usage_revenue_usd, 0), 1) AS top_ten_share_pct,
  round(largest_customer_usage_revenue_usd, 2) AS largest_customer_usage_revenue_usd
FROM rollup
ORDER BY CASE population WHEN 'All eligible' THEN 1 WHEN 'Enterprise' THEN 2 ELSE 3 END`

const TOP_TEN_DENOMINATOR_USAGE_CONCENTRATION_SQL = USAGE_CONCENTRATION_SQL
  .replace(
    'FROM plan_rank GROUP BY plan_name',
    'FROM plan_rank WHERE usage_rank <= 10 GROUP BY plan_name',
  )
  .replace(
    'FROM company_rank\n)',
    'FROM company_rank WHERE usage_rank <= 10\n)',
  )

const USAGE_CSM_LOG_REVIEW_SQL = `WITH usage AS (
  SELECT customer_id, sum(amount) AS usage_revenue_usd
  FROM fct_gl_transactions
  WHERE txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01'
    AND account_id = '4010'
  GROUP BY customer_id
), subscription AS (
  SELECT customer_id, sum(amount) AS subscription_revenue_usd
  FROM fct_gl_transactions
  WHERE txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01'
    AND account_id = '4000'
  GROUP BY customer_id
), latest_plan AS (
  SELECT customer_id, plan_name
  FROM fct_subscription_snapshot_monthly
  WHERE month_start < DATE '2026-07-01'
  QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY month_start DESC) = 1
), latest_csm AS (
  SELECT customer_id, csm_name, assigned_on
  FROM stg_customer_csm_assignments
  WHERE assigned_on <= DATE '2026-06-30'
  QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name) = 1
), ranked AS (
  SELECT row_number() OVER (ORDER BY u.usage_revenue_usd DESC, u.customer_id) AS review_rank,
    u.customer_id, c.customer_name, c.segment AS current_segment,
    c.region AS current_region, c.industry AS current_industry,
    p.plan_name AS latest_h1_plan, l.csm_name AS latest_csm_name,
    l.assigned_on AS csm_assigned_on,
    CASE WHEN l.assigned_on >= e.hire_date
      AND (e.termination_date IS NULL OR l.assigned_on <= e.termination_date)
      THEN true ELSE false END AS assignment_start_in_employment_window,
    CASE WHEN e.hire_date <= DATE '2026-06-30'
      AND (e.termination_date IS NULL OR e.termination_date > DATE '2026-06-30')
      THEN true ELSE false END AS csm_employed_at_cutoff,
    s.subscription_revenue_usd, u.usage_revenue_usd,
    sum(u.usage_revenue_usd) OVER () AS company_usage_revenue_usd
  FROM usage u
  JOIN dim_customer c USING (customer_id)
  LEFT JOIN subscription s USING (customer_id)
  LEFT JOIN latest_plan p USING (customer_id)
  LEFT JOIN latest_csm l USING (customer_id)
  LEFT JOIN dim_employee e ON e.full_name = l.csm_name
)
SELECT review_rank, customer_id, customer_name, current_segment, current_region,
  current_industry, latest_h1_plan, latest_csm_name, csm_assigned_on,
  assignment_start_in_employment_window, csm_employed_at_cutoff,
  round(usage_revenue_usd, 2) AS h1_usage_revenue_usd,
  round(100.0 * usage_revenue_usd / company_usage_revenue_usd, 2) AS company_usage_revenue_share_pct,
  round(100.0 * usage_revenue_usd / nullif(subscription_revenue_usd + usage_revenue_usd, 0), 1) AS usage_share_of_customer_recognized_revenue_pct
FROM ranked
WHERE review_rank <= 10
ORDER BY review_rank`

const HISTORICAL_ASSIGNMENT_USAGE_REVIEW_SQL = `WITH usage AS (
  SELECT customer_id, sum(amount) AS usage_revenue_usd
  FROM fct_gl_transactions
  WHERE txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01'
    AND account_id = '4010'
  GROUP BY customer_id
), subscription AS (
  SELECT customer_id, sum(amount) AS subscription_revenue_usd
  FROM fct_gl_transactions
  WHERE txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01'
    AND account_id = '4000'
  GROUP BY customer_id
), latest_plan AS (
  SELECT customer_id, plan_name
  FROM fct_subscription_snapshot_monthly
  WHERE month_start < DATE '2026-07-01'
  QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY month_start DESC) = 1
), ranked AS (
  SELECT row_number() OVER (ORDER BY u.usage_revenue_usd DESC, u.customer_id, l.assigned_on DESC, l.csm_name) AS review_rank,
    u.customer_id, c.customer_name, c.segment AS current_segment,
    c.region AS current_region, c.industry AS current_industry,
    p.plan_name AS latest_h1_plan, l.csm_name AS latest_csm_name,
    l.assigned_on AS csm_assigned_on,
    CASE WHEN l.assigned_on >= e.hire_date
      AND (e.termination_date IS NULL OR l.assigned_on <= e.termination_date)
      THEN true ELSE false END AS assignment_start_in_employment_window,
    CASE WHEN e.hire_date <= DATE '2026-06-30'
      AND (e.termination_date IS NULL OR e.termination_date > DATE '2026-06-30')
      THEN true ELSE false END AS csm_employed_at_cutoff,
    s.subscription_revenue_usd, u.usage_revenue_usd,
    sum(u.usage_revenue_usd) OVER () AS company_usage_revenue_usd
  FROM usage u
  JOIN dim_customer c USING (customer_id)
  LEFT JOIN subscription s USING (customer_id)
  LEFT JOIN latest_plan p USING (customer_id)
  LEFT JOIN stg_customer_csm_assignments l
    ON l.customer_id = u.customer_id AND l.assigned_on <= DATE '2026-06-30'
  LEFT JOIN dim_employee e ON e.full_name = l.csm_name
)
SELECT review_rank, customer_id, customer_name, current_segment, current_region,
  current_industry, latest_h1_plan, latest_csm_name, csm_assigned_on,
  assignment_start_in_employment_window, csm_employed_at_cutoff,
  round(usage_revenue_usd, 2) AS h1_usage_revenue_usd,
  round(100.0 * usage_revenue_usd / company_usage_revenue_usd, 2) AS company_usage_revenue_share_pct,
  round(100.0 * usage_revenue_usd / nullif(subscription_revenue_usd + usage_revenue_usd, 0), 1) AS usage_share_of_customer_recognized_revenue_pct
FROM ranked
WHERE review_rank <= 10
ORDER BY review_rank`

const REVENUE_CLOSE_HANDOFF_SQL = `WITH revenue_accounts AS (
  SELECT account_id FROM dim_account WHERE account_type = 'Revenue'
), actual_by_account AS (
  SELECT account_id, sum(CAST(amount AS DECIMAL(18, 2))) AS actual_usd
  FROM fct_gl_transactions
  WHERE txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01'
    AND account_id IN (SELECT account_id FROM revenue_accounts)
  GROUP BY account_id
), plan_by_account AS (
  SELECT account_id, sum(amount_usd) AS plan_usd
  FROM fct_budget
  WHERE version_name = 'FY2026 Plan'
    AND fiscal_month >= DATE '2026-01-01' AND fiscal_month < DATE '2026-07-01'
    AND account_id IN (SELECT account_id FROM revenue_accounts)
  GROUP BY account_id
), account_control AS (
  SELECT a.account_id, coalesce(x.actual_usd, 0) AS actual_usd, coalesce(p.plan_usd, 0) AS plan_usd
  FROM revenue_accounts a
  LEFT JOIN actual_by_account x USING (account_id)
  LEFT JOIN plan_by_account p USING (account_id)
), actual_subscription AS (
  SELECT date_trunc('month', txn_date)::DATE AS month_start,
    sum(round(amount * 100)::BIGINT) AS actual_revenue_cents
  FROM fct_gl_transactions
  WHERE txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01'
    AND account_id = '4000'
  GROUP BY 1
), expected_subscription AS (
  SELECT month_start,
    sum(round(round(arr_usd / 12, 2) * 100)::BIGINT) AS expected_revenue_cents
  FROM fct_subscription_snapshot_monthly
  WHERE month_start >= DATE '2026-01-01' AND month_start < DATE '2026-07-01'
  GROUP BY 1
), subscription_control AS (
  SELECT count(*) AS subscription_months_checked,
    count(*) FILTER (WHERE a.actual_revenue_cents IS DISTINCT FROM e.expected_revenue_cents) AS subscription_exception_months,
    sum(coalesce(a.actual_revenue_cents, 0) - coalesce(e.expected_revenue_cents, 0)) AS subscription_difference_cents
  FROM expected_subscription e FULL OUTER JOIN actual_subscription a USING (month_start)
), expected_subscription_routes AS (
  SELECT month_start, customer_id,
    CASE WHEN plan_name = 'Enterprise' THEN 'NetSuite' ELSE 'Stripe' END AS expected_source_system
  FROM fct_subscription_snapshot_monthly
  WHERE month_start >= DATE '2026-01-01' AND month_start < DATE '2026-07-01'
), observed_subscription_routes AS (
  SELECT date_trunc('month', txn_date)::DATE AS month_start, customer_id, source_system
  FROM fct_gl_transactions
  WHERE txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01'
    AND account_id = '4000'
), subscription_routing_control AS (
  SELECT count(*) FILTER (
    WHERE e.customer_id IS NULL OR o.customer_id IS NULL
      OR o.source_system IS DISTINCT FROM e.expected_source_system
  ) AS subscription_source_exceptions
  FROM expected_subscription_routes e
  FULL OUTER JOIN observed_subscription_routes o USING (month_start, customer_id)
), expected_usage AS (
  SELECT month_start, customer_id
  FROM fct_subscription_snapshot_monthly
  WHERE month_start >= DATE '2026-01-01' AND month_start < DATE '2026-07-01'
    AND plan_name IN ('Growth', 'Enterprise')
), observed_usage AS (
  SELECT date_trunc('month', txn_date)::DATE AS month_start, customer_id
  FROM fct_gl_transactions
  WHERE txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01'
    AND account_id = '4010'
  GROUP BY 1, 2
), usage_coverage AS (
  SELECT count(e.customer_id) AS expected_usage_customer_months,
    count(o.customer_id) AS observed_usage_customer_months,
    count(*) FILTER (WHERE e.customer_id IS NOT NULL AND o.customer_id IS NULL) AS missing_usage_customer_months,
    count(*) FILTER (WHERE e.customer_id IS NULL AND o.customer_id IS NOT NULL) AS unexpected_usage_customer_months
  FROM expected_usage e FULL OUTER JOIN observed_usage o USING (month_start, customer_id)
), usage_customer AS (
  SELECT customer_id, sum(amount) AS usage_revenue_usd
  FROM fct_gl_transactions
  WHERE txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01'
    AND account_id = '4010'
  GROUP BY customer_id
), usage_rank AS (
  SELECT *, row_number() OVER (ORDER BY usage_revenue_usd DESC, customer_id) AS usage_rank
  FROM usage_customer
), usage_control AS (
  SELECT count(*) AS usage_customers,
    sum(usage_revenue_usd) AS usage_revenue_usd,
    sum(usage_revenue_usd) FILTER (WHERE usage_rank <= 10) AS top_ten_usage_revenue_usd,
    max(usage_revenue_usd) AS largest_customer_usage_revenue_usd
  FROM usage_rank
), stream_control AS (
  SELECT count(DISTINCT memo) AS usage_revenue_stream_labels
  FROM fct_gl_transactions
  WHERE txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01'
    AND account_id = '4010'
), latest_csm AS (
  SELECT customer_id, csm_name, assigned_on
  FROM stg_customer_csm_assignments
  WHERE assigned_on <= DATE '2026-06-30'
  QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name) = 1
), queue_control AS (
  SELECT count(*) FILTER (WHERE usage_rank <= 10) AS bounded_review_rows,
    count(*) FILTER (WHERE usage_rank <= 10 AND l.csm_name IS NULL) AS bounded_review_rows_missing_csm,
    count(*) FILTER (WHERE usage_rank <= 10 AND NOT (
      l.assigned_on >= e.hire_date
      AND (e.termination_date IS NULL OR l.assigned_on <= e.termination_date)
    )) AS bounded_review_assignment_window_exceptions,
    count(*) FILTER (WHERE usage_rank <= 10 AND NOT (
      e.hire_date <= DATE '2026-06-30'
      AND (e.termination_date IS NULL OR e.termination_date > DATE '2026-06-30')
    )) AS bounded_review_csm_inactive_at_cutoff
  FROM usage_rank u
  LEFT JOIN latest_csm l USING (customer_id)
  LEFT JOIN dim_employee e ON e.full_name = l.csm_name
)
SELECT
  (SELECT count(*) FROM revenue_accounts) AS revenue_accounts_in_chart,
  (SELECT count(*) FROM account_control WHERE actual_usd <> 0 OR plan_usd <> 0) AS loaded_revenue_accounts,
  (SELECT count(*) FROM account_control WHERE actual_usd = 0 AND plan_usd = 0) AS zero_loaded_revenue_accounts,
  round(sum(a.actual_usd), 2) AS h1_revenue_actual_usd,
  round(sum(a.plan_usd), 2) AS h1_revenue_plan_usd,
  round(sum(a.actual_usd) - sum(a.plan_usd), 2) AS h1_revenue_variance_usd,
  round(max(a.actual_usd) FILTER (WHERE a.account_id = '4000'), 2) AS subscription_actual_usd,
  round(max(a.plan_usd) FILTER (WHERE a.account_id = '4000'), 2) AS subscription_plan_usd,
  round(max(a.actual_usd - a.plan_usd) FILTER (WHERE a.account_id = '4000'), 2) AS subscription_variance_usd,
  round(max(a.actual_usd) FILTER (WHERE a.account_id = '4010'), 2) AS usage_actual_usd,
  round(max(a.plan_usd) FILTER (WHERE a.account_id = '4010'), 2) AS usage_plan_usd,
  round(max(a.actual_usd - a.plan_usd) FILTER (WHERE a.account_id = '4010'), 2) AS usage_variance_usd,
  s.subscription_months_checked, s.subscription_exception_months, s.subscription_difference_cents,
  r.subscription_source_exceptions,
  c.expected_usage_customer_months, c.observed_usage_customer_months,
  c.missing_usage_customer_months, c.unexpected_usage_customer_months,
  m.usage_revenue_stream_labels, u.usage_customers,
  round(u.top_ten_usage_revenue_usd, 2) AS top_ten_usage_revenue_usd,
  round(100.0 * u.top_ten_usage_revenue_usd / nullif(u.usage_revenue_usd, 0), 1) AS top_ten_usage_revenue_share_pct,
  round(u.largest_customer_usage_revenue_usd, 2) AS largest_customer_usage_revenue_usd,
  q.bounded_review_rows, q.bounded_review_rows_missing_csm,
  q.bounded_review_assignment_window_exceptions,
  q.bounded_review_csm_inactive_at_cutoff
FROM account_control a
CROSS JOIN subscription_control s
CROSS JOIN subscription_routing_control r
CROSS JOIN usage_coverage c
CROSS JOIN stream_control m
CROSS JOIN usage_control u
CROSS JOIN queue_control q
GROUP BY ALL`

const ACTIVE_ONLY_REVENUE_HANDOFF_SQL = REVENUE_CLOSE_HANDOFF_SQL.replace(
  "SELECT account_id FROM dim_account WHERE account_type = 'Revenue'",
  "SELECT account_id FROM dim_account WHERE account_type = 'Revenue' AND account_id IN ('4000', '4010')",
)

const SUBSCRIPTION_RECONCILIATION_REQUIREMENT = String.raw`(?=[\s\S]*full\s+(?:outer\s+)?join)(?=[\s\S]*sum\s*\(\s*round\s*\(\s*amount\s*\*\s*100\s*\)::bigint\s*\))(?=[\s\S]*sum\s*\(\s*round\s*\(\s*round\s*\(\s*arr_usd\s*\/\s*12\s*,\s*2\s*\)\s*\*\s*100\s*\)::bigint\s*\))`
const USAGE_COVERAGE_REQUIREMENT = String.raw`full\s+(?:outer\s+)?join`
const LATEST_USAGE_CSM_LOG_REQUIREMENT = String.raw`(?=[\s\S]*month_start\s*<\s*date\s*'2026-07-01'[\s\S]*row_number\s*\(\s*\)\s*over\s*\(\s*partition\s+by\s+customer_id\s+order\s+by\s+month_start\s+desc\s*\)\s*=\s*1)(?=[\s\S]*assigned_on\s*<=\s*date\s*'2026-06-30'[\s\S]*row_number\s*\(\s*\)\s*over\s*\(\s*partition\s+by\s+customer_id\s+order\s+by\s+assigned_on\s+desc\s*,\s*csm_name\s*\)\s*=\s*1)(?=[\s\S]*left\s+join\s+latest_csm)(?=[\s\S]*left\s+join\s+dim_employee)(?=[\s\S]*assignment_start_in_employment_window)(?=[\s\S]*csm_employed_at_cutoff)`
const REVENUE_HANDOFF_REQUIREMENT = String.raw`(?=[\s\S]*full\s+(?:outer\s+)?join)(?=[\s\S]*sum\s*\(\s*round\s*\(\s*amount\s*\*\s*100\s*\)::bigint\s*\))(?=[\s\S]*sum\s*\(\s*round\s*\(\s*round\s*\(\s*arr_usd\s*\/\s*12\s*,\s*2\s*\)\s*\*\s*100\s*\)::bigint\s*\))(?=[\s\S]*subscription_source_exceptions)(?=[\s\S]*assigned_on\s*<=\s*date\s*'2026-06-30'[\s\S]*row_number\s*\(\s*\)\s*over\s*\(\s*partition\s+by\s+customer_id\s+order\s+by\s+assigned_on\s+desc\s*,\s*csm_name\s*\)\s*=\s*1)(?=[\s\S]*left\s+join\s+dim_employee)(?=[\s\S]*bounded_review_assignment_window_exceptions)(?=[\s\S]*bounded_review_csm_inactive_at_cutoff)`

export const REVENUE_CLOSE_USAGE_REVIEW_MISSIONS = [
  {
    id: 'm171',
    part: 26,
    title: 'Set the revenue close boundary',
    from: 'maria',
    ask: `Begin the H1 revenue close from Star67's chart of accounts, not from whichever accounts happen to have rows. Preserve every Revenue account, then attach H1 actual and FY2026 Plan controls so an intentionally empty account remains visible beside the loaded book.`,
    deliverable: `Three rows: account_id, account_name, actual_lines, missing_customer_lines, plan_rows, h1_actual_usd, h1_plan_usd, and variance_usd where variance is actual minus plan. Round dollars to 2; order by account_id.`,
    tables: ['dim_account', 'fct_gl_transactions', 'fct_budget'],
    canonical: REVENUE_ACCOUNT_BOUNDARY_SQL,
    solutionSql: REVENUE_ACCOUNT_BOUNDARY_SQL,
    solutionNote: `The chart contains three revenue accounts. Subscription Revenue has $34,830,812.09 of H1 actual against $33,089,177.44 of plan; Usage Revenue has $7,157,858.32 against $7,587,295.62; Professional Services Revenue is intentionally visible with zero loaded actual and plan. All loaded revenue lines have customer tags.`,
    ordered: true,
    orderedNote: 'revenue account id ascending',
    fingerprintSQL: LOADED_ONLY_REVENUE_BOUNDARY_SQL,
    fingerprintMessage: `You started from loaded actual or plan rows, so the empty Professional Services Revenue account vanished. Let the chart of accounts own the population and left-join both books onto it.`,
    hints: [
      `Aggregate H1 GL actual and H1 FY2026 Plan independently by account_id. Do not join raw lines to monthly plan rows.`,
      `Start the final SELECT from dim_account filtered to account_type = 'Revenue', then LEFT JOIN both aggregates and COALESCE absent measures to zero.`,
      REVENUE_ACCOUNT_BOUNDARY_SQL,
    ],
    sayIt: `"The chart defines three revenue accounts, two with H1 activity and one intentionally empty. I keep that zero row visible so close completeness is a controlled fact rather than an assumption from loaded transactions."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm172',
    part: 26,
    title: 'Reconcile subscription revenue to cents',
    from: 'priya',
    ask: `Reconcile each H1 month of Subscription Revenue with the customer snapshot. The expected monthly amount is each customer's ARR divided by twelve and rounded to cents before aggregation; preserve an actual-only or snapshot-only month, and compare the two books in integer cents.`,
    deliverable: `Six month rows: month_start, snapshot_customer_months, subscription_lines, actual_customers, actual_subscription_revenue_usd, snapshot_implied_revenue_usd, and difference_cents. Order month ascending.`,
    tables: ['fct_gl_transactions', 'fct_subscription_snapshot_monthly'],
    canonical: SUBSCRIPTION_CENTS_RECONCILIATION_SQL,
    solutionSql: SUBSCRIPTION_CENTS_RECONCILIATION_SQL,
    solutionNote: `January through June each reconcile exactly: monthly line counts equal snapshot customer-month counts, actual and snapshot-implied dollars match, and difference_cents is zero in all six rows. Integer cents and a full outer month comparison keep that result durable when the fixture changes.`,
    ordered: true,
    orderedNote: 'January through June ascending',
    fingerprintSQL: BULK_ROUNDED_SUBSCRIPTION_RECONCILIATION_SQL,
    fingerprintMessage: `You rounded after adding annual ARR, which changes the expected cents. Convert each customer-month to its rounded monthly cents before summing the book.`,
    requireRegex: SUBSCRIPTION_RECONCILIATION_REQUIREMENT,
    requireMessage: `A zero-exception fixture can hide fragile reconciliation methods. Keep integer-cent aggregation on both books and a FULL OUTER month comparison so later rounding or missing-month exceptions cannot disappear.`,
    hints: [
      `Actual cents are SUM(ROUND(amount * 100)::BIGINT) by transaction month. Expected cents are SUM(ROUND(ROUND(arr_usd / 12, 2) * 100)::BIGINT) by snapshot month.`,
      `FULL OUTER JOIN the six monthly controls and subtract expected cents from actual cents. Dollar columns are presentation; difference_cents is the control.`,
      SUBSCRIPTION_CENTS_RECONCILIATION_SQL,
    ],
    sayIt: `"All six H1 subscription months reconcile to the snapshot with zero cent difference. I still preserve cent arithmetic and both sides of the month population; today's clean tie is not permission to weaken the control."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm173',
    part: 26,
    title: 'Verify subscription source routing',
    from: 'elena',
    ask: `Trace subscription revenue by the plan loaded for the same customer-month and its GL source system. Join at customer-month grain so six months of snapshots do not fan six months of GL lines into one another.`,
    deliverable: `One row per loaded plan and source route: plan_name, source_system, subscription_lines, customers, customer_months, and subscription_revenue_usd. Round dollars to 2; order largest revenue first, then plan and source.`,
    tables: ['fct_subscription_snapshot_monthly', 'fct_gl_transactions'],
    canonical: SUBSCRIPTION_SOURCE_ROUTING_SQL,
    solutionSql: SUBSCRIPTION_SOURCE_ROUTING_SQL,
    solutionNote: `Enterprise routes 1,810 customer-month lines and $25,885,183.05 through NetSuite. Growth routes 7,358 and $7,059,443.37 through Stripe; Starter routes 18,886 and $1,886,185.67 through Stripe. These are loaded source routes, not proof of contract ownership, invoicing workflow, or cash collection.`,
    ordered: true,
    orderedNote: 'largest subscription revenue first, then plan and source',
    fingerprintSQL: CUSTOMER_ONLY_SUBSCRIPTION_ROUTING_SQL,
    fingerprintMessage: `You joined six months of snapshots to six months of GL revenue by customer only, multiplying customer-months across periods. Match both customer_id and transaction month before grouping the route.`,
    hints: [
      `The shared grain is customer_id plus month_start. Restrict GL to account 4000 and derive its month from txn_date inside the join.`,
      `Count lines, distinct customers, and distinct customer-month structs after the grain-safe join; then sum subscription dollars by loaded plan and source_system.`,
      SUBSCRIPTION_SOURCE_ROUTING_SQL,
    ],
    sayIt: `"Enterprise subscription revenue is routed through NetSuite in this warehouse; Growth and Starter route through Stripe. That is source-system provenance at customer-month grain, not a claim about invoices, cash, or contract process."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm174',
    part: 26,
    title: 'Prove usage customer-month coverage',
    from: 'danny',
    ask: `Test whether every loaded Growth and Enterprise customer-month expected to carry usage revenue has an observed account 4010 row, and whether any observed usage customer-month sits outside that eligible population. Preserve both exception directions even when both counts are zero.`,
    deliverable: `One row per expected plan or outside-population exception: plan_name, expected_customer_months, observed_customer_months, missing_observed_customer_months, unexpected_observed_customer_months, licensed_seat_months, usage_lines, and usage_revenue_usd. Round dollars to 2; order largest usage revenue first.`,
    tables: ['fct_subscription_snapshot_monthly', 'fct_gl_transactions'],
    canonical: USAGE_CUSTOMER_MONTH_COVERAGE_SQL,
    solutionSql: USAGE_CUSTOMER_MONTH_COVERAGE_SQL,
    solutionNote: `All 9,168 eligible H1 customer-months are observed: 1,810 Enterprise and 7,358 Growth, with zero missing and zero unexpected customer-months. The matched book contains 307,150 licensed seat-months, 553,216 GL lines, and $7,157,858.32 of recognized usage revenue. Seats are exposure, not measured consumption.`,
    ordered: true,
    orderedNote: 'largest usage revenue first, then plan',
    fingerprintSQL: ALL_PLAN_USAGE_COVERAGE_SQL,
    fingerprintMessage: `You treated Starter as usage-eligible, creating 18,886 false missing customer-months. The loaded product rule limits this account 4010 coverage control to Growth and Enterprise.`,
    requireRegex: USAGE_COVERAGE_REQUIREMENT,
    requireMessage: `The current eligible fixture has perfect coverage, so an INNER JOIN can accidentally return the same happy-path totals. Keep the FULL OUTER comparison so future missing and unexpected customer-months remain measurable.`,
    hints: [
      `Expected is one H1 snapshot row per Growth or Enterprise customer-month. Observed is account 4010 reduced to one row per transaction month and customer.`,
      `FULL OUTER JOIN on month_start and customer_id. Count expected and observed ids separately, then count each null-sided exception before aggregating by the expected plan label.`,
      USAGE_CUSTOMER_MONTH_COVERAGE_SQL,
    ],
    sayIt: `"All 9,168 eligible Growth and Enterprise customer-months have usage revenue rows, with no outside-population rows. Licensed seats are a coverage denominator here—not events, compute units, engagement, or quota consumption."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm175',
    part: 26,
    title: 'Build the revenue plan bridge',
    from: 'maria',
    ask: `Compare H1 actual with the loaded FY2026 Plan for Subscription and Usage Revenue. Keep actual-minus-plan sign and each account's actual revenue mix visible so the stronger subscription line does not hide the usage shortfall.`,
    deliverable: `Two rows: account_name, h1_actual_usd, h1_plan_usd, variance_usd, variance_pct, and actual_revenue_mix_pct. Round dollars to 2 and percentages to 1; order largest favorable variance first.`,
    tables: ['fct_gl_transactions', 'fct_budget', 'dim_account'],
    canonical: REVENUE_ACTUAL_VERSUS_PLAN_SQL,
    solutionSql: REVENUE_ACTUAL_VERSUS_PLAN_SQL,
    solutionNote: `Subscription Revenue is $34,830,812.09, 83.0% of actual revenue, and $1,741,634.65 / 5.3% above plan. Usage Revenue is $7,157,858.32, 17.0% of actual, and $429,437.30 / 5.7% below plan. Together the two loaded accounts are $1,312,197.35 above plan, but the account-level miss stays visible.`,
    ordered: true,
    orderedNote: 'largest actual-minus-plan variance first, then account',
    fingerprintSQL: REVERSED_REVENUE_VARIANCE_SQL,
    fingerprintMessage: `You calculated plan minus actual, reversing both operating signals. The close convention here is actual minus plan: subscription is favorable and usage is unfavorable.`,
    hints: [
      `Aggregate H1 GL actual and the H1 FY2026 Plan independently by account_id for 4000 and 4010, then join the two account-level controls.`,
      `Variance is actual minus plan. Account mix divides each account's actual by total actual revenue, while variance percent divides by that account's plan.`,
      REVENUE_ACTUAL_VERSUS_PLAN_SQL,
    ],
    sayIt: `"H1 recognized revenue is $41.99 million, $1.31 million above loaded plan. Subscription is 5.3% favorable, while usage is 5.7% unfavorable; I do not net away that operating split or call recognized revenue bookings or cash."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm176',
    part: 26,
    title: 'Read usage stream mix by plan',
    from: 'priya',
    ask: `Separate the two account 4010 memo labels inside each loaded Growth and Enterprise plan. Calculate stream share within plan—not against company usage—so Product can compare mix without confusing recognized-revenue labels with actual event or compute consumption.`,
    deliverable: `Four rows: plan_name, revenue_stream_label, usage_lines, customers, usage_revenue_usd, and within_plan_revenue_share_pct. Round dollars to 2 and share to 1; order plan, then largest stream revenue.`,
    tables: ['fct_gl_transactions', 'fct_subscription_snapshot_monthly'],
    canonical: USAGE_STREAMS_BY_PLAN_SQL,
    solutionSql: USAGE_STREAMS_BY_PLAN_SQL,
    solutionNote: `Enterprise recognized usage revenue is 62.0% events-processed label and 38.0% compute-credits label; Growth is 70.0% and 30.0%. Each plan has both labels for every represented customer. Memo labels identify revenue streams, not event counts, compute units, price, quota, or product engagement.`,
    ordered: true,
    orderedNote: 'plan name, then largest usage stream revenue',
    fingerprintSQL: COLLAPSED_PLAN_USAGE_STREAMS_SQL,
    fingerprintMessage: `You collapsed Growth and Enterprise into one company mix. Partition the revenue denominator by plan_name and retain one row per plan and memo label.`,
    hints: [
      `Join account 4010 GL rows to the snapshot on customer_id and transaction month, then keep plan_name, memo, customer_id, and amount.`,
      `Group by plan and memo. The share denominator is SUM(SUM(amount)) OVER (PARTITION BY plan_name), not the company total.`,
      USAGE_STREAMS_BY_PLAN_SQL,
    ],
    sayIt: `"Events-processed labels are 62% of Enterprise usage revenue and 70% of Growth. These are recognized-revenue memo shares; the warehouse does not contain events, compute units, quota attainment, pricing, or product telemetry."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm177',
    part: 26,
    title: 'Measure usage revenue concentration',
    from: 'elena',
    ask: `Measure account 4010 concentration for Enterprise, Growth, and the complete eligible company population. Rank customers inside each denominator before summing the top ten, and keep the full population in the denominator rather than filtering first.`,
    deliverable: `Three rows: population, customers, usage_revenue_usd, top_ten_usage_revenue_usd, top_ten_share_pct, and largest_customer_usage_revenue_usd. Round dollars to 2 and share to 1; order All eligible, Enterprise, Growth.`,
    tables: ['fct_gl_transactions', 'fct_subscription_snapshot_monthly'],
    canonical: USAGE_CONCENTRATION_SQL,
    solutionSql: USAGE_CONCENTRATION_SQL,
    solutionNote: `The 1,737 eligible customers carry $7,157,858.32 of usage revenue; the company top ten contribute $402,994.05 / 5.6%, and the largest customer contributes $54,447.32. Enterprise top-ten share is 7.2%; Growth is 2.4%. Concentration is recognized-revenue exposure, not risk, health, or causal dependency.`,
    ordered: true,
    orderedNote: 'All eligible, Enterprise, then Growth',
    fingerprintSQL: TOP_TEN_DENOMINATOR_USAGE_CONCENTRATION_SQL,
    fingerprintMessage: `You filtered each population to ten customers before building its denominator, making every top-ten share 100%. Rank against the full customer book and conditionally sum only ranks one through ten.`,
    hints: [
      `Aggregate usage to one row per plan and customer. Rank inside plan; separately roll customers to company and rank the company book.`,
      `Carry the complete population sum into each rollup and conditionally sum rank <= 10. Do not LIMIT or filter before calculating the denominator.`,
      USAGE_CONCENTRATION_SQL,
    ],
    sayIt: `"The top ten customers represent $403 thousand, or 5.6%, of eligible H1 usage revenue; the largest is $54 thousand. That measures recognized-revenue concentration, not customer health, renewal risk, or usage causality."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm178',
    part: 26,
    title: 'Audit the material CSM log',
    from: 'danny',
    ask: `Build a ten-customer data-review queue from highest H1 Usage Revenue. Attach current dimension labels, the latest plan loaded before July, and the latest CSM label known by June 30 without multiplying historical assignments. Test whether the assignment start falls inside the labeled employee's employment window and whether that employee is active at cutoff; never promote the label into ownership, health, or capacity truth.`,
    deliverable: `Exactly ten rows: review_rank, customer_id, customer_name, current_segment, current_region, current_industry, latest_h1_plan, latest_csm_name, csm_assigned_on, assignment_start_in_employment_window, csm_employed_at_cutoff, h1_usage_revenue_usd, company_usage_revenue_share_pct, and usage_share_of_customer_recognized_revenue_pct. Round dollars to 2, company share to 2, and customer revenue share to 1; order review_rank.`,
    tables: ['fct_gl_transactions', 'fct_subscription_snapshot_monthly', 'dim_customer', 'stg_customer_csm_assignments', 'dim_employee'],
    canonical: USAGE_CSM_LOG_REVIEW_SQL,
    solutionSql: USAGE_CSM_LOG_REVIEW_SQL,
    solutionNote: `Ridgeway Clinics Co leads the bounded queue with $54,447.32 of H1 usage revenue, 0.76% of company usage revenue, and 17.5% of its loaded recognized subscription-plus-usage revenue. Sofia Iyer is its latest CSM label by June 30, but that assignment start fails the employee-window control. Six of ten rows require that review; none has a labeled CSM inactive at cutoff, and none lacks a label. The log is not ownership, health, or capacity truth.`,
    ordered: true,
    orderedNote: 'review rank ascending',
    fingerprintSQL: HISTORICAL_ASSIGNMENT_USAGE_REVIEW_SQL,
    fingerprintMessage: `Historical CSM assignments fanned the highest-usage customers into repeated queue rows and corrupted the company-share denominator. Reduce assignment history to one latest row per customer before joining and ranking.`,
    requireRegex: LATEST_USAGE_CSM_LOG_REQUIREMENT,
    requireMessage: `The data-review queue must preserve latest plan before July, latest CSM label by June 30, and both employment controls from dim_employee. A present label is not enough to claim valid ownership.`,
    hints: [
      `First reduce usage, subscription revenue, latest plan, and latest CSM label to one row per customer. Latest rows use QUALIFY ROW_NUMBER with deterministic descending dates.`,
      `LEFT JOIN the label to dim_employee by full name. Test assigned_on inside hire/termination dates separately from active employment on June 30, then rank and filter the ten material rows.`,
      USAGE_CSM_LOG_REVIEW_SQL,
    ],
    sayIt: `"Ridgeway Clinics leads the material review at $54 thousand, but its latest CSM label fails the assignment-start employment-window check. Six of ten labels need that review; none is inactive at cutoff. I do not call this log ownership, health, capacity, renewal risk, or event-time attribution."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm179',
    part: 26,
    title: 'Package the revenue close handoff',
    from: 'maria',
    ask: `Close the workday in one Finance, Product, and Customer Success handoff. Carry the chart boundary, H1 actual and plan, subscription cent and source-routing controls, two-sided usage customer-month coverage, stream-label count, full-book concentration, and the latest-CSM-label data controls. Reduce every control to one row before combining it.`,
    deliverable: `Exactly one row with revenue_accounts_in_chart, loaded_revenue_accounts, zero_loaded_revenue_accounts, h1_revenue_actual_usd, h1_revenue_plan_usd, h1_revenue_variance_usd, subscription_actual_usd, subscription_plan_usd, subscription_variance_usd, usage_actual_usd, usage_plan_usd, usage_variance_usd, subscription_months_checked, subscription_exception_months, subscription_difference_cents, subscription_source_exceptions, expected_usage_customer_months, observed_usage_customer_months, missing_usage_customer_months, unexpected_usage_customer_months, usage_revenue_stream_labels, usage_customers, top_ten_usage_revenue_usd, top_ten_usage_revenue_share_pct, largest_customer_usage_revenue_usd, bounded_review_rows, bounded_review_rows_missing_csm, bounded_review_assignment_window_exceptions, and bounded_review_csm_inactive_at_cutoff. Round dollars to 2 and share to 1.`,
    tables: ['dim_account', 'fct_gl_transactions', 'fct_budget', 'fct_subscription_snapshot_monthly', 'stg_customer_csm_assignments', 'dim_employee'],
    canonical: REVENUE_CLOSE_HANDOFF_SQL,
    solutionSql: REVENUE_CLOSE_HANDOFF_SQL,
    solutionNote: `The handoff preserves three chart revenue accounts, two loaded accounts, and one zero-loaded account. H1 recognized revenue is $41,988,670.41 against $40,676,473.06 of plan, a $1,312,197.35 favorable variance: subscription is $1,741,634.65 favorable and usage is $429,437.30 unfavorable. Six subscription months reconcile with zero cent exceptions and zero source-routing exceptions; all 9,168 expected usage customer-months are observed with zero exceptions; two stream labels and 1,737 usage customers are represented; the top ten carry $402,994.05 / 5.6%. All ten material rows have CSM labels, six assignment starts fail the employment-window control, and zero labeled CSMs are inactive at cutoff.`,
    ordered: false,
    fingerprintSQL: ACTIVE_ONLY_REVENUE_HANDOFF_SQL,
    fingerprintMessage: `The handoff hard-coded only the two active accounts, so the zero-loaded Professional Services Revenue control vanished. Let the Revenue chart define the account population before summarizing loaded and empty accounts.`,
    requireRegex: REVENUE_HANDOFF_REQUIREMENT,
    requireMessage: `This clean accounting fixture can conceal fragile methods. Preserve FULL OUTER exception controls, integer-cent subscription arithmetic, the latest CSM label by June 30, and both dim_employee controls before reducing the handoff to one row.`,
    hints: [
      `Build one-row chart/account, subscription-cents, subscription-routing, usage-coverage, usage-concentration, stream-label, and CSM-log controls. CROSS JOIN only those reduced outputs.`,
      `Keep chart-first LEFT JOINs, FULL OUTER exception comparisons, per-customer monthly cents, source routes at customer-month grain, the full concentration denominator, latest-label reduction, and both employment checks.`,
      REVENUE_CLOSE_HANDOFF_SQL,
    ],
    sayIt: `"H1 recognized revenue is $41.99 million, $1.31 million above loaded plan: subscription is $1.74 million favorable and usage is $429 thousand unfavorable. Subscription cents and source routing are clean, but six of ten CSM labels fail the assignment-start employment-window check. These are close and data-review controls—not bookings, billings, cash, consumption, ownership, health, forecast, or causality."`,
    jdCompanies: ['Datadog'],
  },
]
