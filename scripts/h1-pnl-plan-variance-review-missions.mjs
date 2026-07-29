// H1 P&L plan-variance review — a flagship FP&A operating-review arc (part 27).
// The whole-P&L actual-vs-plan close: account-type boundary, revenue/COGS/Opex
// variance, gross-margin bridge, operating-result variance, divisional Opex
// plan variance, a bounded exception queue, and one Finance leadership handoff.
//
// Audited H1 2026 truth (FY2026 Plan vs GL actual, Jan 1 – Jun 30):
//   Revenue  41,988,670.41 actual / 40,676,473.06 plan  -> +1,312,197.35 fav
//   COGS     15,892,834.89 actual / 15,814,429.58 plan  ->    +78,405.31 unfav
//   Opex    140,965,760.05 actual / 138,819,503.59 plan -> +2,146,256.46 unfav
//   Gross    26,095,835.52 actual / 24,862,043.48 plan  -> +1,233,792.04 fav
//   Op result -114,871,924.53 actual / -113,957,460.11 plan -> -914,464.42 unfav
// Divisional H1 Opex actuals: S&M 68,837,549.87 / R&D 39,038,254.01 / G&A 31,958,057.27 / COGS 1,131,898.90.
// Revenue is account/customer-tagged, not division-tagged — teach that boundary honestly.

const PNL_ACCOUNT_BOUNDARY_SQL = `WITH actual AS (
  SELECT account_type,
    count(*) AS actual_lines,
    round(sum(amount), 2) AS actual_usd
  FROM fct_gl_transactions g
  JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
  GROUP BY account_type
), plan AS (
  SELECT account_type,
    count(*) AS plan_rows,
    round(sum(amount_usd), 2) AS plan_usd
  FROM fct_budget b
  JOIN dim_account a ON b.account_id = a.account_id
  WHERE b.version_name = 'FY2026 Plan'
    AND b.fiscal_month >= DATE '2026-01-01' AND b.fiscal_month < DATE '2026-07-01'
  GROUP BY account_type
)
SELECT coalesce(a.account_type, p.account_type) AS account_type,
  coalesce(a.actual_lines, 0) AS actual_lines,
  coalesce(p.plan_rows, 0) AS plan_rows,
  round(coalesce(a.actual_usd, 0), 2) AS h1_actual_usd,
  round(coalesce(p.plan_usd, 0), 2) AS h1_plan_usd,
  round(coalesce(a.actual_usd, 0) - coalesce(p.plan_usd, 0), 2) AS variance_usd
FROM actual a
FULL OUTER JOIN plan p USING (account_type)
WHERE coalesce(a.account_type, p.account_type) IN ('Revenue', 'COGS', 'Opex')
ORDER BY account_type`

const ACCOUNT_BOUNDARY_BALANCE_SHEET_TRAP_SQL = `WITH actual AS (
  SELECT account_type,
    count(*) AS actual_lines,
    round(sum(amount), 2) AS actual_usd
  FROM fct_gl_transactions g
  JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
  GROUP BY account_type
), plan AS (
  SELECT account_type,
    count(*) AS plan_rows,
    round(sum(amount_usd), 2) AS plan_usd
  FROM fct_budget b
  JOIN dim_account a ON b.account_id = a.account_id
  WHERE b.version_name = 'FY2026 Plan'
    AND b.fiscal_month >= DATE '2026-01-01' AND b.fiscal_month < DATE '2026-07-01'
  GROUP BY account_type
)
SELECT coalesce(a.account_type, p.account_type) AS account_type,
  coalesce(a.actual_lines, 0) AS actual_lines,
  coalesce(p.plan_rows, 0) AS plan_rows,
  round(coalesce(a.actual_usd, 0), 2) AS h1_actual_usd,
  round(coalesce(p.plan_usd, 0), 2) AS h1_plan_usd,
  round(coalesce(a.actual_usd, 0) - coalesce(p.plan_usd, 0), 2) AS variance_usd
FROM actual a
FULL OUTER JOIN plan p USING (account_type)
ORDER BY account_type`

const REVENUE_COGS_OPEX_VARIANCE_SQL = `WITH actual AS (
  SELECT a.account_type,
    round(sum(g.amount), 2) AS h1_actual_usd
  FROM fct_gl_transactions g
  JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
    AND a.account_type IN ('Revenue', 'COGS', 'Opex')
  GROUP BY a.account_type
), plan AS (
  SELECT a.account_type,
    round(sum(b.amount_usd), 2) AS h1_plan_usd
  FROM fct_budget b
  JOIN dim_account a ON b.account_id = a.account_id
  WHERE b.version_name = 'FY2026 Plan'
    AND b.fiscal_month >= DATE '2026-01-01' AND b.fiscal_month < DATE '2026-07-01'
    AND a.account_type IN ('Revenue', 'COGS', 'Opex')
  GROUP BY a.account_type
)
SELECT p.account_type,
  round(a.h1_actual_usd, 2) AS h1_actual_usd,
  round(p.h1_plan_usd, 2) AS h1_plan_usd,
  round(a.h1_actual_usd - p.h1_plan_usd, 2) AS variance_usd,
  round(100.0 * (a.h1_actual_usd - p.h1_plan_usd) / nullif(p.h1_plan_usd, 0), 2) AS variance_pct
FROM plan p
LEFT JOIN actual a USING (account_type)
ORDER BY CASE p.account_type WHEN 'Revenue' THEN 1 WHEN 'COGS' THEN 2 WHEN 'Opex' THEN 3 END`

const VARIANCE_SIGN_FLIP_TRAP_SQL = `WITH actual AS (
  SELECT a.account_type, round(sum(g.amount), 2) AS h1_actual_usd
  FROM fct_gl_transactions g
  JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' AND a.account_type IN ('Revenue','COGS','Opex')
  GROUP BY a.account_type
), plan AS (
  SELECT a.account_type, round(sum(b.amount_usd), 2) AS h1_plan_usd
  FROM fct_budget b
  JOIN dim_account a ON b.account_id = a.account_id
  WHERE b.version_name='FY2026 Plan' AND b.fiscal_month >= DATE '2026-01-01' AND b.fiscal_month < DATE '2026-07-01' AND a.account_type IN ('Revenue','COGS','Opex')
  GROUP BY a.account_type
)
SELECT p.account_type, round(a.h1_actual_usd,2) AS h1_actual_usd, round(p.h1_plan_usd,2) AS h1_plan_usd,
  round(p.h1_plan_usd - a.h1_actual_usd, 2) AS variance_usd,
  round(100.0 * (p.h1_plan_usd - a.h1_actual_usd) / nullif(p.h1_plan_usd, 0), 2) AS variance_pct
FROM plan p LEFT JOIN actual a USING (account_type)
ORDER BY CASE p.account_type WHEN 'Revenue' THEN 1 WHEN 'COGS' THEN 2 WHEN 'Opex' THEN 3 END`

const GROSS_MARGIN_BRIDGE_SQL = `WITH actual AS (
  SELECT
    round(sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), 2) AS revenue_actual,
    round(sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END), 2) AS cogs_actual
  FROM fct_gl_transactions g
  JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
), plan AS (
  SELECT
    round(sum(CASE WHEN a.account_type = 'Revenue' THEN b.amount_usd ELSE 0 END), 2) AS revenue_plan,
    round(sum(CASE WHEN a.account_type = 'COGS' THEN b.amount_usd ELSE 0 END), 2) AS cogs_plan
  FROM fct_budget b
  JOIN dim_account a ON b.account_id = a.account_id
  WHERE b.version_name = 'FY2026 Plan'
    AND b.fiscal_month >= DATE '2026-01-01' AND b.fiscal_month < DATE '2026-07-01'
)
SELECT
  round(revenue_actual, 2) AS revenue_actual_usd,
  round(revenue_plan, 2) AS revenue_plan_usd,
  round(revenue_actual - revenue_plan, 2) AS revenue_variance_usd,
  round(cogs_actual, 2) AS cogs_actual_usd,
  round(cogs_plan, 2) AS cogs_plan_usd,
  round(cogs_actual - cogs_plan, 2) AS cogs_variance_usd,
  round(revenue_actual - cogs_actual, 2) AS gross_profit_actual_usd,
  round(revenue_plan - cogs_plan, 2) AS gross_profit_plan_usd,
  round((revenue_actual - cogs_actual) - (revenue_plan - cogs_plan), 2) AS gross_profit_variance_usd,
  round(100.0 * (revenue_actual - cogs_actual) / nullif(revenue_actual, 0), 2) AS gross_margin_actual_pct,
  round(100.0 * (revenue_plan - cogs_plan) / nullif(revenue_plan, 0), 2) AS gross_margin_plan_pct,
  round(100.0 * (revenue_actual - cogs_actual) / nullif(revenue_actual, 0)
      - 100.0 * (revenue_plan - cogs_plan) / nullif(revenue_plan, 0), 2) AS gross_margin_variance_pp
FROM actual CROSS JOIN plan`

const GROSS_MARGIN_BRIDGE_FLIPPED_TRAP_SQL = `WITH actual AS (
  SELECT
    round(sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), 2) AS revenue_actual,
    round(sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END), 2) AS cogs_actual
  FROM fct_gl_transactions g
  JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
), plan AS (
  SELECT
    round(sum(CASE WHEN a.account_type = 'Revenue' THEN b.amount_usd ELSE 0 END), 2) AS revenue_plan,
    round(sum(CASE WHEN a.account_type = 'COGS' THEN b.amount_usd ELSE 0 END), 2) AS cogs_plan
  FROM fct_budget b
  JOIN dim_account a ON b.account_id = a.account_id
  WHERE b.version_name = 'FY2026 Plan'
    AND b.fiscal_month >= DATE '2026-01-01' AND b.fiscal_month < DATE '2026-07-01'
)
SELECT
  round(revenue_actual, 2) AS revenue_actual_usd,
  round(revenue_plan, 2) AS revenue_plan_usd,
  round(revenue_plan - revenue_actual, 2) AS revenue_variance_usd,
  round(cogs_actual, 2) AS cogs_actual_usd,
  round(cogs_plan, 2) AS cogs_plan_usd,
  round(cogs_plan - cogs_actual, 2) AS cogs_variance_usd,
  round(revenue_actual - cogs_actual, 2) AS gross_profit_actual_usd,
  round(revenue_plan - cogs_plan, 2) AS gross_profit_plan_usd,
  round((revenue_plan - cogs_plan) - (revenue_actual - cogs_actual), 2) AS gross_profit_variance_usd,
  round(100.0 * (revenue_actual - cogs_actual) / nullif(revenue_actual, 0), 2) AS gross_margin_actual_pct,
  round(100.0 * (revenue_plan - cogs_plan) / nullif(revenue_plan, 0), 2) AS gross_margin_plan_pct,
  round(100.0 * (revenue_actual - cogs_actual) / nullif(revenue_actual, 0)
      - 100.0 * (revenue_plan - cogs_plan) / nullif(revenue_plan, 0), 2) AS gross_margin_variance_pp
FROM actual CROSS JOIN plan`

const OPERATING_RESULT_VARIANCE_SQL = `WITH actual AS (
  SELECT
    round(sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), 2) AS revenue_actual,
    round(sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END), 2) AS cogs_actual,
    round(sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END), 2) AS opex_actual
  FROM fct_gl_transactions g
  JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
), plan AS (
  SELECT
    round(sum(CASE WHEN a.account_type = 'Revenue' THEN b.amount_usd ELSE 0 END), 2) AS revenue_plan,
    round(sum(CASE WHEN a.account_type = 'COGS' THEN b.amount_usd ELSE 0 END), 2) AS cogs_plan,
    round(sum(CASE WHEN a.account_type = 'Opex' THEN b.amount_usd ELSE 0 END), 2) AS opex_plan
  FROM fct_budget b
  JOIN dim_account a ON b.account_id = a.account_id
  WHERE b.version_name = 'FY2026 Plan'
    AND b.fiscal_month >= DATE '2026-01-01' AND b.fiscal_month < DATE '2026-07-01'
)
SELECT
  round(revenue_actual - cogs_actual - opex_actual, 2) AS operating_result_actual_usd,
  round(revenue_plan - cogs_plan - opex_plan, 2) AS operating_result_plan_usd,
  round((revenue_actual - cogs_actual - opex_actual) - (revenue_plan - cogs_plan - opex_plan), 2) AS operating_result_variance_usd,
  round(100.0 * (revenue_actual - cogs_actual - opex_actual) / nullif(revenue_actual, 0), 2) AS operating_margin_actual_pct,
  round(100.0 * (revenue_plan - cogs_plan - opex_plan) / nullif(revenue_plan, 0), 2) AS operating_margin_plan_pct
FROM actual CROSS JOIN plan`

const OPERATING_RESULT_NET_REVENUE_TRAP_SQL = `WITH actual AS (
  SELECT
    round(sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), 2) AS revenue_actual,
    round(sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END), 2) AS cogs_actual,
    round(sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END), 2) AS opex_actual
  FROM fct_gl_transactions g
  JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
), plan AS (
  SELECT
    round(sum(CASE WHEN a.account_type = 'Revenue' THEN b.amount_usd ELSE 0 END), 2) AS revenue_plan,
    round(sum(CASE WHEN a.account_type = 'COGS' THEN b.amount_usd ELSE 0 END), 2) AS cogs_plan,
    round(sum(CASE WHEN a.account_type = 'Opex' THEN b.amount_usd ELSE 0 END), 2) AS opex_plan
  FROM fct_budget b
  JOIN dim_account a ON b.account_id = a.account_id
  WHERE b.version_name = 'FY2026 Plan'
    AND b.fiscal_month >= DATE '2026-01-01' AND b.fiscal_month < DATE '2026-07-01'
)
SELECT
  round(revenue_actual - cogs_actual - opex_actual, 2) AS operating_result_actual_usd,
  round(revenue_plan - cogs_plan - opex_plan, 2) AS operating_result_plan_usd,
  round((revenue_actual - cogs_actual - opex_actual) - (revenue_plan - cogs_plan - opex_plan), 2) AS operating_result_variance_usd,
  round(100.0 * (revenue_actual - cogs_actual - opex_actual) / nullif(revenue_actual - cogs_actual, 0), 2) AS operating_margin_actual_pct,
  round(100.0 * (revenue_plan - cogs_plan - opex_plan) / nullif(revenue_plan - cogs_plan, 0), 2) AS operating_margin_plan_pct
FROM actual CROSS JOIN plan`

const DIVISIONAL_OPEX_VARIANCE_SQL = `WITH actual AS (
  SELECT d.division,
    round(sum(g.amount), 2) AS h1_opex_actual_usd
  FROM fct_gl_transactions g
  JOIN dim_account a ON g.account_id = a.account_id
  JOIN dim_department d ON g.dept_id = d.dept_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
    AND a.account_type = 'Opex'
  GROUP BY d.division
), plan AS (
  SELECT d.division,
    round(sum(b.amount_usd), 2) AS h1_opex_plan_usd
  FROM fct_budget b
  JOIN dim_account a ON b.account_id = a.account_id
  JOIN dim_department d ON upper(trim(b.dept_name_raw)) = upper(d.dept_name)
  WHERE b.version_name = 'FY2026 Plan'
    AND b.fiscal_month >= DATE '2026-01-01' AND b.fiscal_month < DATE '2026-07-01'
    AND a.account_type = 'Opex'
  GROUP BY d.division
)
SELECT coalesce(a.division, p.division) AS division,
  round(coalesce(a.h1_opex_actual_usd, 0), 2) AS h1_opex_actual_usd,
  round(coalesce(p.h1_opex_plan_usd, 0), 2) AS h1_opex_plan_usd,
  round(coalesce(a.h1_opex_actual_usd, 0) - coalesce(p.h1_opex_plan_usd, 0), 2) AS variance_usd,
  round(100.0 * (coalesce(a.h1_opex_actual_usd, 0) - coalesce(p.h1_opex_plan_usd, 0)) / nullif(p.h1_opex_plan_usd, 0), 2) AS variance_pct
FROM actual a
FULL OUTER JOIN plan p USING (division)
ORDER BY coalesce(a.h1_opex_actual_usd, 0) DESC`

const DIVISIONAL_INCLUDES_COGS_TRAP_SQL = `WITH actual AS (
  SELECT d.division,
    round(sum(g.amount), 2) AS h1_opex_actual_usd
  FROM fct_gl_transactions g
  JOIN dim_account a ON g.account_id = a.account_id
  JOIN dim_department d ON g.dept_id = d.dept_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
    AND a.account_type IN ('Opex','COGS')
  GROUP BY d.division
), plan AS (
  SELECT d.division,
    round(sum(b.amount_usd), 2) AS h1_opex_plan_usd
  FROM fct_budget b
  JOIN dim_account a ON b.account_id = a.account_id
  JOIN dim_department d ON upper(trim(b.dept_name_raw)) = upper(d.dept_name)
  WHERE b.version_name = 'FY2026 Plan'
    AND b.fiscal_month >= DATE '2026-01-01' AND b.fiscal_month < DATE '2026-07-01'
    AND a.account_type = 'Opex'
  GROUP BY d.division
)
SELECT coalesce(a.division, p.division) AS division,
  round(coalesce(a.h1_opex_actual_usd, 0), 2) AS h1_opex_actual_usd,
  round(coalesce(p.h1_opex_plan_usd, 0), 2) AS h1_opex_plan_usd,
  round(coalesce(a.h1_opex_actual_usd, 0) - coalesce(p.h1_opex_plan_usd, 0), 2) AS variance_usd,
  round(100.0 * (coalesce(a.h1_opex_actual_usd, 0) - coalesce(p.h1_opex_plan_usd, 0)) / nullif(p.h1_opex_plan_usd, 0), 2) AS variance_pct
FROM actual a
FULL OUTER JOIN plan p USING (division)
ORDER BY coalesce(a.h1_opex_actual_usd, 0) DESC`

const MONTHLY_OPEX_RUN_RATE_SQL = `WITH monthly AS (
  SELECT date_trunc('month', g.txn_date)::DATE AS month_start,
    round(sum(g.amount), 2) AS opex_usd
  FROM fct_gl_transactions g
  JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
    AND a.account_type = 'Opex'
  GROUP BY 1
)
SELECT month_start, round(opex_usd, 2) AS opex_usd,
  round(opex_usd - lag(opex_usd) OVER (ORDER BY month_start), 2) AS mom_delta_usd,
  round(100.0 * (opex_usd - lag(opex_usd) OVER (ORDER BY month_start)) / nullif(lag(opex_usd) OVER (ORDER BY month_start), 0), 2) AS mom_delta_pct
FROM monthly
ORDER BY month_start`

const MONTHLY_FULL_YEAR_RUN_RATE_TRAP_SQL = `WITH monthly AS (
  SELECT date_trunc('month', g.txn_date)::DATE AS month_start,
    round(sum(g.amount), 2) AS opex_usd
  FROM fct_gl_transactions g
  JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
    AND a.account_type = 'Opex'
  GROUP BY 1
)
SELECT month_start, round(opex_usd * 2, 2) AS opex_usd,
  round(opex_usd * 2 - lag(opex_usd) OVER (ORDER BY month_start) * 2, 2) AS mom_delta_usd,
  round(100.0 * (opex_usd * 2 - lag(opex_usd) OVER (ORDER BY month_start) * 2) / nullif(lag(opex_usd) OVER (ORDER BY month_start) * 2, 0), 2) AS mom_delta_pct
FROM monthly
ORDER BY month_start`

const MATERIAL_VARIANCE_QUEUE_SQL = `WITH account_actual AS (
  SELECT a.account_id, a.account_name, a.account_type,
    round(sum(g.amount), 2) AS h1_actual_usd
  FROM fct_gl_transactions g
  JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
  GROUP BY a.account_id, a.account_name, a.account_type
), account_plan AS (
  SELECT a.account_id, a.account_name, a.account_type,
    round(sum(b.amount_usd), 2) AS h1_plan_usd
  FROM fct_budget b
  JOIN dim_account a ON b.account_id = a.account_id
  WHERE b.version_name = 'FY2026 Plan'
    AND b.fiscal_month >= DATE '2026-01-01' AND b.fiscal_month < DATE '2026-07-01'
  GROUP BY a.account_id, a.account_name, a.account_type
), combined AS (
  SELECT coalesce(act.account_id, pln.account_id) AS account_id,
    coalesce(act.account_name, pln.account_name) AS account_name,
    coalesce(act.account_type, pln.account_type) AS account_type,
    round(coalesce(act.h1_actual_usd, 0), 2) AS h1_actual_usd,
    round(coalesce(pln.h1_plan_usd, 0), 2) AS h1_plan_usd,
    round(coalesce(act.h1_actual_usd, 0) - coalesce(pln.h1_plan_usd, 0), 2) AS variance_usd
  FROM account_actual act
  FULL OUTER JOIN account_plan pln USING (account_id)
), ranked AS (
  SELECT account_id, account_name, account_type,
    h1_actual_usd, h1_plan_usd, variance_usd,
    row_number() OVER (ORDER BY abs(variance_usd) DESC, account_id) AS variance_rank
  FROM combined
  WHERE account_type IN ('Revenue', 'COGS', 'Opex')
)
SELECT account_id, account_name, account_type,
  h1_actual_usd, h1_plan_usd, variance_usd
FROM ranked
WHERE variance_rank <= 10
ORDER BY variance_rank`

const VARIANCE_QUEUE_ABSOLUTE_TRAP_SQL = `WITH account_actual AS (
  SELECT a.account_id, a.account_name, a.account_type,
    round(sum(g.amount), 2) AS h1_actual_usd
  FROM fct_gl_transactions g
  JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
  GROUP BY a.account_id, a.account_name, a.account_type
), account_plan AS (
  SELECT a.account_id, a.account_name, a.account_type,
    round(sum(b.amount_usd), 2) AS h1_plan_usd
  FROM fct_budget b
  JOIN dim_account a ON b.account_id = a.account_id
  WHERE b.version_name = 'FY2026 Plan'
    AND b.fiscal_month >= DATE '2026-01-01' AND b.fiscal_month < DATE '2026-07-01'
  GROUP BY a.account_id, a.account_name, a.account_type
), combined AS (
  SELECT coalesce(act.account_id, pln.account_id) AS account_id,
    coalesce(act.account_name, pln.account_name) AS account_name,
    coalesce(act.account_type, pln.account_type) AS account_type,
    round(coalesce(act.h1_actual_usd, 0), 2) AS h1_actual_usd,
    round(coalesce(pln.h1_plan_usd, 0), 2) AS h1_plan_usd,
    round(coalesce(act.h1_actual_usd, 0) - coalesce(pln.h1_plan_usd, 0), 2) AS variance_usd
  FROM account_actual act
  FULL OUTER JOIN account_plan pln USING (account_id)
), ranked AS (
  SELECT account_id, account_name, account_type,
    h1_actual_usd, h1_plan_usd, variance_usd,
    row_number() OVER (ORDER BY variance_usd DESC, account_id) AS variance_rank
  FROM combined
  WHERE account_type IN ('Revenue', 'COGS', 'Opex')
)
SELECT account_id, account_name, account_type,
  h1_actual_usd, h1_plan_usd, variance_usd
FROM ranked
WHERE variance_rank <= 10
ORDER BY variance_rank`

const PNL_HANDOFF_SQL = `WITH boundary AS (
  SELECT count(DISTINCT account_type) AS pnl_account_types
  FROM (
    SELECT a.account_type
    FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
    WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' AND a.account_type IN ('Revenue','COGS','Opex')
    GROUP BY a.account_type
  ) x
), pnl AS (
  SELECT
    round(sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), 2) AS revenue_actual,
    round(sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END), 2) AS cogs_actual,
    round(sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END), 2) AS opex_actual
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
), plan AS (
  SELECT
    round(sum(CASE WHEN a.account_type = 'Revenue' THEN b.amount_usd ELSE 0 END), 2) AS revenue_plan,
    round(sum(CASE WHEN a.account_type = 'COGS' THEN b.amount_usd ELSE 0 END), 2) AS cogs_plan,
    round(sum(CASE WHEN a.account_type = 'Opex' THEN b.amount_usd ELSE 0 END), 2) AS opex_plan
  FROM fct_budget b JOIN dim_account a ON b.account_id = a.account_id
  WHERE b.version_name = 'FY2026 Plan' AND b.fiscal_month >= DATE '2026-01-01' AND b.fiscal_month < DATE '2026-07-01'
), division AS (
  SELECT round(sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END), 2) AS sm_opex_actual
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id JOIN dim_department d ON g.dept_id = d.dept_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' AND d.division = 'S&M'
)
SELECT
  boundary.pnl_account_types,
  round(pnl.revenue_actual, 2) AS revenue_actual_usd,
  round(plan.revenue_plan, 2) AS revenue_plan_usd,
  round(pnl.revenue_actual - plan.revenue_plan, 2) AS revenue_variance_usd,
  round(pnl.cogs_actual, 2) AS cogs_actual_usd,
  round(plan.cogs_plan, 2) AS cogs_plan_usd,
  round(pnl.cogs_actual - plan.cogs_plan, 2) AS cogs_variance_usd,
  round(pnl.opex_actual, 2) AS opex_actual_usd,
  round(plan.opex_plan, 2) AS opex_plan_usd,
  round(pnl.opex_actual - plan.opex_plan, 2) AS opex_variance_usd,
  round(pnl.revenue_actual - pnl.cogs_actual, 2) AS gross_profit_actual_usd,
  round((pnl.revenue_actual - pnl.cogs_actual) - (plan.revenue_plan - plan.cogs_plan), 2) AS gross_profit_variance_usd,
  round(pnl.revenue_actual - pnl.cogs_actual - pnl.opex_actual, 2) AS operating_result_actual_usd,
  round((plan.revenue_plan - plan.cogs_plan - plan.opex_plan), 2) AS operating_result_plan_usd,
  round((pnl.revenue_actual - pnl.cogs_actual - pnl.opex_actual) - (plan.revenue_plan - plan.cogs_plan - plan.opex_plan), 2) AS operating_result_variance_usd,
  round(division.sm_opex_actual, 2) AS sm_opex_actual_usd
FROM boundary CROSS JOIN pnl CROSS JOIN plan CROSS JOIN division`

const HANDOFF_DROP_NULL_DIVISION_TRAP_SQL = `WITH boundary AS (
  SELECT count(DISTINCT account_type) AS pnl_account_types
  FROM (
    SELECT a.account_type
    FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
    WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' AND a.account_type IN ('Revenue','COGS','Opex')
    GROUP BY a.account_type
  ) x
), pnl AS (
  SELECT
    round(sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), 2) AS revenue_actual,
    round(sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END), 2) AS cogs_actual,
    round(sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END), 2) AS opex_actual
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
), plan AS (
  SELECT
    round(sum(CASE WHEN a.account_type = 'Revenue' THEN b.amount_usd ELSE 0 END), 2) AS revenue_plan,
    round(sum(CASE WHEN a.account_type = 'COGS' THEN b.amount_usd ELSE 0 END), 2) AS cogs_plan,
    round(sum(CASE WHEN a.account_type = 'Opex' THEN b.amount_usd ELSE 0 END), 2) AS opex_plan
  FROM fct_budget b JOIN dim_account a ON b.account_id = a.account_id
  WHERE b.version_name = 'FY2026 Plan' AND b.fiscal_month >= DATE '2026-01-01' AND b.fiscal_month < DATE '2026-07-01'
), division AS (
  SELECT round(sum(g.amount), 2) AS sm_opex_actual
  FROM fct_gl_transactions g
  JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
    AND a.account_type = 'Opex'
)
SELECT
  boundary.pnl_account_types,
  round(pnl.revenue_actual, 2) AS revenue_actual_usd,
  round(plan.revenue_plan, 2) AS revenue_plan_usd,
  round(pnl.revenue_actual - plan.revenue_plan, 2) AS revenue_variance_usd,
  round(pnl.cogs_actual, 2) AS cogs_actual_usd,
  round(plan.cogs_plan, 2) AS cogs_plan_usd,
  round(pnl.cogs_actual - plan.cogs_plan, 2) AS cogs_variance_usd,
  round(pnl.opex_actual, 2) AS opex_actual_usd,
  round(plan.opex_plan, 2) AS opex_plan_usd,
  round(pnl.opex_actual - plan.opex_plan, 2) AS opex_variance_usd,
  round(pnl.revenue_actual - pnl.cogs_actual, 2) AS gross_profit_actual_usd,
  round((pnl.revenue_actual - pnl.cogs_actual) - (plan.revenue_plan - plan.cogs_plan), 2) AS gross_profit_variance_usd,
  round(pnl.revenue_actual - pnl.cogs_actual - pnl.opex_actual, 2) AS operating_result_actual_usd,
  round((plan.revenue_plan - plan.cogs_plan - plan.opex_plan), 2) AS operating_result_plan_usd,
  round((pnl.revenue_actual - pnl.cogs_actual - pnl.opex_actual) - (plan.revenue_plan - plan.cogs_plan - plan.opex_plan), 2) AS operating_result_variance_usd,
  round(division.sm_opex_actual, 2) AS sm_opex_actual_usd
FROM boundary CROSS JOIN pnl CROSS JOIN plan CROSS JOIN division`

export const H1_PNL_PLAN_VARIANCE_REVIEW_MISSIONS = [
  {
    id: 'm180',
    part: 27,
    title: 'Set the H1 P&L account-type boundary',
    from: 'maria',
    ask: `Before any variance number, set the boundary: which account types appear on the H1 2026 P&L, and how many GL actual lines versus FY2026 Plan rows each carries. Restrict to the three P&L account types — Revenue, COGS, Opex — and leave balance-sheet noise (Asset, Liability) out of the close. A FULL OUTER JOIN keeps a P&L type that has a plan but no actual yet, or vice versa.`,
    deliverable: `Three rows (Revenue, COGS, Opex in that order): account_type, actual_lines, plan_rows, h1_actual_usd, h1_plan_usd, variance_usd. Round dollars to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_account', 'fct_budget'],
    canonical: PNL_ACCOUNT_BOUNDARY_SQL,
    solutionSql: PNL_ACCOUNT_BOUNDARY_SQL,
    solutionNote: `The H1 P&L boundary holds three account types. Revenue, COGS, and Opex each carry both GL actuals and FY2026 Plan rows; balance-sheet Asset and Liability activity stays off the P&L close. This is an account-type boundary, not a clean-books assertion — it does not prove every journal is posted or that the close is locked.`,
    ordered: true,
    orderedNote: 'Revenue, then COGS, then Opex',
    fingerprintSQL: ACCOUNT_BOUNDARY_BALANCE_SHEET_TRAP_SQL,
    fingerprintMessage: `You returned every account type with H1 actuals, including Asset and Liability balance-sheet noise. A P&L close carries only Revenue, COGS, and Opex — filter to those three account types before summarizing.`,
    hints: [
      `Join GL to dim_account to read account_type, then filter to Revenue, COGS, and Opex. Build the same shape from fct_budget joined to dim_account, filtered to version_name 'FY2026 Plan' and the H1 fiscal months.`,
      `FULL OUTER JOIN the actual and plan summaries on account_type so a type with plan but no actual (or the reverse) still appears with a zero on the missing side. Order Revenue, COGS, Opex with a CASE expression.`,
      PNL_ACCOUNT_BOUNDARY_SQL,
    ],
    sayIt: `"The P&L boundary is three account types — Revenue, COGS, and Opex — and each has both actual and plan rows for H1. Balance-sheet noise stays off the close. This is a boundary, not a locked-books proof."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm181',
    part: 27,
    title: 'Read the revenue, COGS, and Opex variance',
    from: 'maria',
    ask: `With the boundary set, read the H1 variance for each P&L account type: actual minus plan, in dollars and as a percent of plan. Keep the direction honest — for Revenue, actual above plan is favorable; for COGS and Opex, actual above plan is unfavorable. Report the signed variance; the reader interprets favorability.`,
    deliverable: `Three rows (Revenue, COGS, Opex): account_type, h1_actual_usd, h1_plan_usd, variance_usd (actual minus plan), variance_pct. Round dollars and percent to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_account', 'fct_budget'],
    canonical: REVENUE_COGS_OPEX_VARIANCE_SQL,
    solutionSql: REVENUE_COGS_OPEX_VARIANCE_SQL,
    solutionNote: `H1 revenue came in $1,312,197.35 above plan (favorable), while COGS ran $78,405.31 over plan and Opex ran $2,146,256.46 over plan (both unfavorable at the cost line). The signed variance is actual minus plan throughout; favorability is a reading the FP&A analyst applies, not a sign the query flips.`,
    ordered: true,
    orderedNote: 'Revenue, then COGS, then Opex',
    fingerprintSQL: VARIANCE_SIGN_FLIP_TRAP_SQL,
    fingerprintMessage: `You flipped the variance to plan minus actual, which reverses the sign on every row. Keep variance as actual minus plan so Revenue above plan reads positive and the reader applies favorability by account type.`,
    hints: [
      `Aggregate GL actuals and FY2026 Plan by account_type, each filtered to Revenue, COGS, Opex. Join on account_type.`,
      `Variance is actual minus plan, always. Percent is 100 * variance / plan, guarded against a null plan. Order the three types with a CASE expression.`,
      REVENUE_COGS_OPEX_VARIANCE_SQL,
    ],
    sayIt: `"Revenue beat plan by $1.3 million, but COGS ran $78 thousand over and Opex ran $2.1 million over. The signed variance is actual minus plan; whether that's good news depends on which line you're reading."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm182',
    part: 27,
    title: 'Build the gross-margin bridge',
    from: 'maria',
    ask: `Bridge gross profit and gross margin from plan to actual. Revenue and COGS each moved; their combined effect lands on gross profit, and the margin rate shows whether the business got more or less efficient at the gross line. Calculate actual and plan gross profit, the variance, and the margin points bridge.`,
    deliverable: `Exactly one row: revenue_actual_usd, revenue_plan_usd, revenue_variance_usd, cogs_actual_usd, cogs_plan_usd, cogs_variance_usd, gross_profit_actual_usd, gross_profit_plan_usd, gross_profit_variance_usd, gross_margin_actual_pct, gross_margin_plan_pct, gross_margin_variance_pp. Round dollars to 2 and percent/points to 2.`,
    tables: ['fct_gl_transactions', 'dim_account', 'fct_budget'],
    canonical: GROSS_MARGIN_BRIDGE_SQL,
    solutionSql: GROSS_MARGIN_BRIDGE_SQL,
    solutionNote: `Gross profit actual is $26,095,835.52 against plan $24,862,043.48, a $1,233,792.04 favorable variance. Revenue beat plan by more than COGS missed, so gross margin expanded from 61.16% plan to 62.15% actual — roughly 0.99 points of gross-margin expansion. This is a recognized-revenue gross line; it is not contribution margin, cash margin, or unit economics.`,
    ordered: false,
    fingerprintSQL: GROSS_MARGIN_BRIDGE_FLIPPED_TRAP_SQL,
    fingerprintMessage: `You computed plan minus actual for the revenue and COGS variances, which inverts the gross-profit bridge. Build each variance as actual minus plan so the bridge flows in the right direction.`,
    hints: [
      `Reduce actuals to one revenue and one COGS number, and plan to the same pair. CROSS JOIN the two one-row sets.`,
      `Gross profit is revenue minus COGS on each side; the margin is 100 * gross profit / revenue. The variance in points is actual margin minus plan margin.`,
      GROSS_MARGIN_BRIDGE_SQL,
    ],
    sayIt: `"Gross profit beat plan by $1.2 million, and gross margin expanded about one point to 62.15%. Revenue outpaced COGS at the recognized line — that's not contribution margin or cash margin, just the GAAP gross line."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm183',
    part: 27,
    title: 'Land the operating-result variance',
    from: 'maria',
    ask: `Carry the bridge all the way to operating result: revenue minus COGS minus Opex, actual and plan, with the variance and the operating margin on each side. This is the line leadership asks about — did H1 operating result beat or miss plan, and by how much.`,
    deliverable: `Exactly one row: operating_result_actual_usd, operating_result_plan_usd, operating_result_variance_usd, operating_margin_actual_pct, operating_margin_plan_pct. Round dollars and percent to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_account', 'fct_budget'],
    canonical: OPERATING_RESULT_VARIANCE_SQL,
    solutionSql: OPERATING_RESULT_VARIANCE_SQL,
    solutionNote: `Operating result actual is -$114,871,924.53 against plan -$113,957,460.11, a -$914,464.42 unfavorable variance: the favorable revenue and gross-profit bridge were more than offset by $2.15M of Opex overrun. Operating margin remains deeply negative. This is a GAAP operating result; it excludes below-the-line items, tax, and cash.`,
    ordered: false,
    fingerprintSQL: OPERATING_RESULT_NET_REVENUE_TRAP_SQL,
    fingerprintMessage: `You computed operating margin against gross profit (revenue minus COGS) instead of against revenue. Operating margin is operating result divided by revenue, the full top line — dividing by gross profit shrinks the denominator and overstates the margin.`,
    hints: [
      `Reduce actuals to one revenue, one COGS, one Opex number; do the same for plan. CROSS JOIN the two one-row sets.`,
      `Operating result is revenue minus COGS minus Opex on each side. Operating margin is 100 * operating result / revenue.`,
      OPERATING_RESULT_VARIANCE_SQL,
    ],
    sayIt: `"Operating result missed plan by about $914 thousand — the favorable revenue bridge was more than eaten by $2.15 million of Opex overrun. Operating margin stays deeply negative; this is the GAAP operating line, not cash or net income."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm184',
    part: 27,
    title: 'Read the divisional Opex plan variance',
    from: 'danny',
    ask: `Opex overran plan by $2.15M — but which division drove it? Read H1 Opex actual versus FY2026 Plan by division, with the signed variance and percent. Revenue is account-and-customer tagged, not division tagged, so an Opex-only divisional view is the honest cut here — do not force revenue into a division it does not carry.`,
    deliverable: `One row per division, ordered by H1 Opex actual descending: division, h1_opex_actual_usd, h1_opex_plan_usd, variance_usd (actual minus plan), variance_pct. Round dollars and percent to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_account', 'dim_department', 'fct_budget'],
    canonical: DIVISIONAL_OPEX_VARIANCE_SQL,
    solutionSql: DIVISIONAL_OPEX_VARIANCE_SQL,
    solutionNote: `S&M carries the largest H1 Opex actual at $68.8M, followed by R&D at $39.0M and G&A at $32.0M; a small COGS-division line carries $1.1M. The signed variance (actual minus plan) per division shows where the $2.15M total Opex overrun concentrated. Revenue is not division-tagged in this warehouse, so a divisional P&L is not available — only the Opex cut is honest here.`,
    ordered: true,
    orderedNote: 'H1 Opex actual descending',
    fingerprintSQL: DIVISIONAL_INCLUDES_COGS_TRAP_SQL,
    fingerprintMessage: `You folded COGS into the divisional cost total, which mixes a cost-of-revenue cut with an Opex cut and breaks the comparison to an Opex-only plan. Keep the divisional view to account_type = 'Opex' so it matches the plan grain.`,
    hints: [
      `Join GL to dim_account (for account_type = 'Opex') and dim_department (for division); build the same shape from fct_budget. FULL OUTER JOIN on division.`,
      `Variance is actual minus plan; percent is 100 * variance / plan, null-guarded. Order by H1 Opex actual descending.`,
      DIVISIONAL_OPEX_VARIANCE_SQL,
    ],
    sayIt: `"S&M is the largest Opex division at $68.8 million of H1 actual. The signed variance per division shows where the $2.15 million overrun concentrated. Revenue isn't division-tagged here, so I can only give you the Opex cut — a full divisional P&L isn't available in this warehouse."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm185',
    part: 27,
    title: 'Read the monthly Opex run rate',
    from: 'danny',
    ask: `Is the Opex overrun concentrated in one month, or spread evenly? Read H1 Opex by month with the month-over-month delta in dollars and percent. This shows whether June ran hot or whether cost crept up steadily across the half — different conversations with leadership.`,
    deliverable: `Six rows ordered by month_start: month_start, opex_usd, mom_delta_usd, mom_delta_pct. Round dollars and percent to 2 decimals; the first month's delta is null.`,
    tables: ['fct_gl_transactions', 'dim_account'],
    canonical: MONTHLY_OPEX_RUN_RATE_SQL,
    solutionSql: MONTHLY_OPEX_RUN_RATE_SQL,
    solutionNote: `H1 Opex by month shows the cadence of the $2.15M overrun — whether a single month spiked or cost rose steadily. The first month's month-over-month delta is null because there is no prior month in the window. This is recognized Opex; it is not cash spend, accruals, or commitments.`,
    ordered: true,
    orderedNote: 'month_start ascending',
    fingerprintSQL: MONTHLY_FULL_YEAR_RUN_RATE_TRAP_SQL,
    fingerprintMessage: `You doubled H1 Opex to imply a full-year run rate in the same query that asks for a monthly cadence. A run-rate projection is a separate analysis and assumes linear spend; the monthly cadence only reads what actually posted each month.`,
    hints: [
      `Truncate txn_date to month, filter to account_type = 'Opex', and sum amount per month.`,
      `Use lag(opex_usd) over (order by month_start) to get the prior month for the delta. Percent is 100 * delta / prior, null-guarded.`,
      MONTHLY_OPEX_RUN_RATE_SQL,
    ],
    sayIt: `"H1 Opex by month shows whether June spiked or cost crept up steadily — that's a different conversation with leadership either way. This is recognized Opex each month, not cash spend or commitments."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm186',
    part: 27,
    title: 'Route the material account-level variance queue',
    from: 'danny',
    ask: `Leadership wants the ten accounts that moved the most versus plan, regardless of sign. Rank every Revenue, COGS, and Opex account by the absolute variance and return the top ten with the signed variance preserved. This is a review queue — it surfaces where to dig, not a verdict on each account.`,
    deliverable: `Exactly ten rows ordered by variance_rank ascending (largest absolute variance first): account_id, account_name, account_type, h1_actual_usd, h1_plan_usd, variance_usd (signed: actual minus plan). Round dollars to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_account', 'fct_budget'],
    canonical: MATERIAL_VARIANCE_QUEUE_SQL,
    solutionSql: MATERIAL_VARIANCE_QUEUE_SQL,
    solutionNote: `The queue ranks P&L accounts by absolute variance so the largest movers surface first, whether favorable or unfavorable; the signed variance is preserved so the reader sees direction. Ranking by absolute value prevents a large unfavorable overrun from being buried below a long tail of small favorable variances. This is a review queue, not an attribution of cause.`,
    ordered: true,
    orderedNote: 'absolute variance descending (variance_rank ascending)',
    fingerprintSQL: VARIANCE_QUEUE_ABSOLUTE_TRAP_SQL,
    fingerprintMessage: `You ranked by the signed variance descending, so a large unfavorable (negative) overrun drops to the bottom of a top-ten cut and vanishes. Rank by abs(variance) so the largest movers surface regardless of sign, then preserve the signed variance for display.`,
    hints: [
      `Aggregate GL actuals and plan to one row per account, FULL OUTER JOIN on account_id, filter to P&L account types.`,
      `Rank by abs(variance_usd) descending with a deterministic tiebreaker on account_id; keep the signed variance for display. Filter to rank <= 10.`,
      MATERIAL_VARIANCE_QUEUE_SQL,
    ],
    sayIt: `"Here are the ten accounts that moved the most versus plan, largest absolute variance first, with the signed variance preserved. It's a review queue — it tells you where to dig, not why each account moved."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm187',
    part: 27,
    title: 'Package the H1 P&L close handoff',
    from: 'maria',
    ask: `Close the workday in one Finance leadership handoff. Carry the P&L account-type count; revenue, COGS, and Opex actual, plan, and variance; gross profit actual and variance; operating result actual, plan, and variance; and the S&M Opex actual that anchors the divisional cut. Reduce each control to one row or one value before combining.`,
    deliverable: `Exactly one row: pnl_account_types, revenue_actual_usd, revenue_plan_usd, revenue_variance_usd, cogs_actual_usd, cogs_plan_usd, cogs_variance_usd, opex_actual_usd, opex_plan_usd, opex_variance_usd, gross_profit_actual_usd, gross_profit_variance_usd, operating_result_actual_usd, operating_result_plan_usd, operating_result_variance_usd, sm_opex_actual_usd. Round all dollars to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_account', 'fct_budget', 'dim_department'],
    canonical: PNL_HANDOFF_SQL,
    solutionSql: PNL_HANDOFF_SQL,
    solutionNote: `The H1 P&L close handoff carries three P&L account types; revenue beat plan by $1.31M, COGS missed by $78K, and Opex missed by $2.15M; gross profit beat plan by $1.23M; operating result missed plan by $914K; S&M Opex actual anchors the divisional cut at $68.8M. This is a recognized-P&L close handoff — not cash, not net income, not a forecast, and not an attribution of cause to any single account.`,
    ordered: false,
    fingerprintSQL: HANDOFF_DROP_NULL_DIVISION_TRAP_SQL,
    fingerprintMessage: `Your S&M Opex figure summed all H1 Opex because the division = 'S&M' filter was dropped, returning the company-wide $140.97M Opex instead of the S&M cut. Join dim_department and filter division = 'S&M' so the figure reflects only the S&M slice.`,
    hints: [
      `Build one-row boundary, P&L actual, plan, and S&M-division controls. CROSS JOIN only those reduced single-row outputs.`,
      `Keep account_type filters to Revenue, COGS, Opex for the P&L lines; the S&M control adds division = 'S&M' and account_type = 'Opex'.`,
      PNL_HANDOFF_SQL,
    ],
    sayIt: `"H1 close: revenue beat plan by $1.31 million, Opex overran by $2.15 million, operating result missed by $914 thousand, and S&M anchors the Opex cut at $68.8 million. This is a recognized-P&L close — not cash, net income, a forecast, or a cause attribution."`,
    jdCompanies: ['Stripe'],
  },
]
