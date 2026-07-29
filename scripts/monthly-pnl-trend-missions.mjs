// Monthly P&L trend + operating-leverage review — a Star67 operating-review arc (part 29).
// A cohesive monthly-trend workday distinct from m180-187 (H1 AGGREGATE plan variance),
// m185 (Opex run rate only), and m04/m13/m39 (individual intro pulls). Eight decisions
// forming the trend review leadership reads for operating leverage and the March spike.
//
// Audited H1 2026 monthly truth (fct_gl_transactions + dim_account):
//   Jan  rev 6,512,839.34 / cogs 2,552,647.27 / opex 20,490,839.51
//   Feb  rev 6,578,191.39 / cogs 2,363,491.70 / opex 22,297,030.98
//   Mar  rev 6,958,308.31 / cogs 3,496,007.18 / opex 29,977,200.87  <- Opex spike
//   Apr  rev 7,093,965.14 / cogs 2,454,215.23 / opex 22,384,305.55
//   May  rev 7,347,923.99 / cogs 2,481,462.48 / opex 23,022,735.83
//   Jun  rev 7,497,442.24 / cogs 2,545,011.03 / opex 22,793,647.31
// H1 YoY: rev 29,747,477.88 (2025) -> 41,988,670.41 (2026) = +41.1%;
//         opex 103,422,622.51 -> 140,965,760.05 = +36.3%; leverage spread +4.8pp.
// March 2026 Opex by division: S&M 13,527,088.78 / R&D 10,178,273.73 / G&A 6,009,103.99 / COGS 262,734.37.

const MONTHLY_PNL_TREND_SQL = `SELECT date_trunc('month', g.txn_date)::DATE AS month_start,
  round(sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), 2) AS revenue_usd,
  round(sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END), 2) AS cogs_usd,
  round(sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END), 2) AS opex_usd,
  round(sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END)
      - sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END), 2) AS gross_profit_usd,
  round(sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END)
      - sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END)
      - sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END), 2) AS operating_result_usd,
  round(100.0 * (sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END)
              - sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END))
      / nullif(sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), 0), 2) AS gross_margin_pct
FROM fct_gl_transactions g
JOIN dim_account a ON g.account_id = a.account_id
WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
GROUP BY 1
ORDER BY month_start`

const MONTHLY_PNL_QUARTERLY_TRAP_SQL = `SELECT
  CASE WHEN date_trunc('month', g.txn_date)::DATE < DATE '2026-04-01' THEN DATE '2026-01-01' ELSE DATE '2026-04-01' END AS month_start,
  round(sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), 2) AS revenue_usd,
  round(sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END), 2) AS cogs_usd,
  round(sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END), 2) AS opex_usd,
  round(sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END) - sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END), 2) AS gross_profit_usd,
  round(sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END) - sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END) - sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END), 2) AS operating_result_usd,
  round(100.0 * (sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END) - sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END)) / nullif(sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), 0), 2) AS gross_margin_pct
FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
GROUP BY 1 ORDER BY month_start`

const MARGIN_TREND_SQL = `WITH monthly AS (
  SELECT date_trunc('month', g.txn_date)::DATE AS month_start,
    sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END) AS revenue,
    sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END) AS cogs
  FROM fct_gl_transactions g
  JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
  GROUP BY 1
)
SELECT month_start,
  round(revenue, 2) AS revenue_usd,
  round(cogs, 2) AS cogs_usd,
  round(revenue - cogs, 2) AS gross_profit_usd,
  round(100.0 * (revenue - cogs) / nullif(revenue, 0), 2) AS gross_margin_pct,
  round(100.0 * (revenue - cogs) / nullif(revenue, 0)
      - lag(100.0 * (revenue - cogs) / nullif(revenue, 0)) OVER (ORDER BY month_start), 2) AS margin_delta_pp
FROM monthly
ORDER BY month_start`

const MARGIN_TREND_INVERTED_TRAP_SQL = `WITH monthly AS (
  SELECT date_trunc('month', g.txn_date)::DATE AS month_start,
    sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END) AS revenue,
    sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END) AS cogs
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1
)
SELECT month_start, round(revenue, 2) AS revenue_usd, round(cogs, 2) AS cogs_usd,
  round(revenue - cogs, 2) AS gross_profit_usd,
  round(100.0 * revenue / nullif(revenue - cogs, 0), 2) AS gross_margin_pct,
  round(100.0 * revenue / nullif(revenue - cogs, 0) - lag(100.0 * revenue / nullif(revenue - cogs, 0)) OVER (ORDER BY month_start), 2) AS margin_delta_pp
FROM monthly ORDER BY month_start`

const MARCH_OPEX_SPIKE_SIGNED_TRAP_SQL = `WITH monthly_opex AS (
  SELECT date_trunc('month', g.txn_date)::DATE AS month_start,
    round(sum(g.amount), 2) AS opex_usd
  FROM fct_gl_transactions g
  JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
    AND a.account_type = 'Opex'
  GROUP BY 1
), ranked AS (
  SELECT month_start, opex_usd,
    round(opex_usd - lag(opex_usd, 2) OVER (ORDER BY month_start), 2) AS mom_delta_usd,
    round(100.0 * (opex_usd - lag(opex_usd, 2) OVER (ORDER BY month_start)) / nullif(lag(opex_usd, 2) OVER (ORDER BY month_start), 0), 2) AS mom_delta_pct
  FROM monthly_opex
)
SELECT month_start, opex_usd, mom_delta_usd, mom_delta_pct
FROM ranked
ORDER BY abs(mom_delta_usd) DESC NULLS LAST, month_start`

const MARCH_OPEX_SPIKE_FIXED_SQL = `WITH monthly_opex AS (
  SELECT date_trunc('month', g.txn_date)::DATE AS month_start,
    round(sum(g.amount), 2) AS opex_usd
  FROM fct_gl_transactions g
  JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
    AND a.account_type = 'Opex'
  GROUP BY 1
), ranked AS (
  SELECT month_start, opex_usd,
    round(opex_usd - lag(opex_usd) OVER (ORDER BY month_start), 2) AS mom_delta_usd,
    round(100.0 * (opex_usd - lag(opex_usd) OVER (ORDER BY month_start)) / nullif(lag(opex_usd) OVER (ORDER BY month_start), 0), 2) AS mom_delta_pct
  FROM monthly_opex
)
SELECT month_start, opex_usd, mom_delta_usd, mom_delta_pct
FROM ranked
ORDER BY abs(mom_delta_usd) DESC NULLS LAST, month_start`

const MARCH_SPIKE_DIVISION_SQL = `SELECT d.division,
  round(sum(CASE WHEN g.txn_date >= DATE '2026-03-01' AND g.txn_date < DATE '2026-04-01' THEN g.amount ELSE 0 END), 2) AS march_opex_usd,
  round(sum(CASE WHEN g.txn_date >= DATE '2026-02-01' AND g.txn_date < DATE '2026-03-01' THEN g.amount ELSE 0 END), 2) AS february_opex_usd,
  round(sum(CASE WHEN g.txn_date >= DATE '2026-03-01' AND g.txn_date < DATE '2026-04-01' THEN g.amount ELSE 0 END)
      - sum(CASE WHEN g.txn_date >= DATE '2026-02-01' AND g.txn_date < DATE '2026-03-01' THEN g.amount ELSE 0 END), 2) AS mom_delta_usd,
  round(100.0 * (sum(CASE WHEN g.txn_date >= DATE '2026-03-01' AND g.txn_date < DATE '2026-04-01' THEN g.amount ELSE 0 END)
              - sum(CASE WHEN g.txn_date >= DATE '2026-02-01' AND g.txn_date < DATE '2026-03-01' THEN g.amount ELSE 0 END))
      / nullif(sum(CASE WHEN g.txn_date >= DATE '2026-02-01' AND g.txn_date < DATE '2026-03-01' THEN g.amount ELSE 0 END), 0), 2) AS mom_delta_pct
FROM fct_gl_transactions g
JOIN dim_account a ON g.account_id = a.account_id
JOIN dim_department d ON g.dept_id = d.dept_id
WHERE (g.txn_date >= DATE '2026-02-01' AND g.txn_date < DATE '2026-04-01')
  AND a.account_type = 'Opex'
GROUP BY d.division
ORDER BY mom_delta_usd DESC`

const MARCH_SPIKE_DIVISION_Q1_TRAP_SQL = `SELECT d.division,
  round(sum(g.amount), 2) AS march_opex_usd,
  round(sum(g.amount), 2) AS february_opex_usd,
  round(0, 2) AS mom_delta_usd,
  round(0, 2) AS mom_delta_pct
FROM fct_gl_transactions g
JOIN dim_account a ON g.account_id = a.account_id
JOIN dim_department d ON g.dept_id = d.dept_id
WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-04-01' AND a.account_type = 'Opex'
GROUP BY d.division ORDER BY march_opex_usd DESC`

const H1_YOY_LEVERAGE_SQL = `WITH periods AS (
  SELECT
    CASE WHEN g.txn_date >= DATE '2025-01-01' AND g.txn_date < DATE '2025-07-01' THEN 'H1 2025'
         ELSE 'H1 2026' END AS period,
    round(sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), 2) AS revenue,
    round(sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END), 2) AS cogs,
    round(sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END), 2) AS opex
  FROM fct_gl_transactions g
  JOIN dim_account a ON g.account_id = a.account_id
  WHERE (g.txn_date >= DATE '2025-01-01' AND g.txn_date < DATE '2025-07-01')
     OR (g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01')
  GROUP BY 1
), pivoted AS (
  SELECT
    max(CASE WHEN period = 'H1 2025' THEN revenue END) AS prior_revenue,
    max(CASE WHEN period = 'H1 2026' THEN revenue END) AS current_revenue,
    max(CASE WHEN period = 'H1 2025' THEN opex END) AS prior_opex,
    max(CASE WHEN period = 'H1 2026' THEN opex END) AS current_opex
  FROM periods
)
SELECT
  round(prior_revenue, 2) AS h1_2025_revenue_usd,
  round(current_revenue, 2) AS h1_2026_revenue_usd,
  round(100.0 * (current_revenue - prior_revenue) / nullif(prior_revenue, 0), 2) AS yoy_revenue_growth_pct,
  round(prior_opex, 2) AS h1_2025_opex_usd,
  round(current_opex, 2) AS h1_2026_opex_usd,
  round(100.0 * (current_opex - prior_opex) / nullif(prior_opex, 0), 2) AS yoy_opex_growth_pct,
  round(100.0 * (current_revenue - prior_revenue) / nullif(prior_revenue, 0)
      - 100.0 * (current_opex - prior_opex) / nullif(prior_opex, 0), 2) AS operating_leverage_spread_pp
FROM pivoted`

const H1_YOY_LEVERAGE_Q2_TRAP_SQL = `WITH periods AS (
  SELECT CASE WHEN g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-04-01' THEN 'Prior' ELSE 'Current' END AS period,
    round(sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), 2) AS revenue,
    round(sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END), 2) AS cogs,
    round(sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END), 2) AS opex
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1
), pivoted AS (
  SELECT max(CASE WHEN period = 'Prior' THEN revenue END) AS prior_revenue, max(CASE WHEN period = 'Current' THEN revenue END) AS current_revenue,
    max(CASE WHEN period = 'Prior' THEN opex END) AS prior_opex, max(CASE WHEN period = 'Current' THEN opex END) AS current_opex
  FROM periods
)
SELECT round(prior_revenue, 2) AS h1_2025_revenue_usd, round(current_revenue, 2) AS h1_2026_revenue_usd,
  round(100.0 * (current_revenue - prior_revenue) / nullif(prior_revenue, 0), 2) AS yoy_revenue_growth_pct,
  round(prior_opex, 2) AS h1_2025_opex_usd, round(current_opex, 2) AS h1_2026_opex_usd,
  round(100.0 * (current_opex - prior_opex) / nullif(prior_opex, 0), 2) AS yoy_opex_growth_pct,
  round(100.0 * (current_revenue - prior_revenue) / nullif(prior_revenue, 0) - 100.0 * (current_opex - prior_opex) / nullif(prior_opex, 0), 2) AS operating_leverage_spread_pp
FROM pivoted`

const REVENUE_OPEX_GROWTH_SPREAD_SQL = `WITH monthly AS (
  SELECT date_trunc('month', g.txn_date)::DATE AS month_start,
    sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END) AS revenue,
    sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END) AS opex
  FROM fct_gl_transactions g
  JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
  GROUP BY 1
)
SELECT month_start,
  round(100.0 * (revenue - lag(revenue) OVER (ORDER BY month_start)) / nullif(lag(revenue) OVER (ORDER BY month_start), 0), 2) AS revenue_mom_growth_pct,
  round(100.0 * (opex - lag(opex) OVER (ORDER BY month_start)) / nullif(lag(opex) OVER (ORDER BY month_start), 0), 2) AS opex_mom_growth_pct,
  round(100.0 * (revenue - lag(revenue) OVER (ORDER BY month_start)) / nullif(lag(revenue) OVER (ORDER BY month_start), 0)
      - 100.0 * (opex - lag(opex) OVER (ORDER BY month_start)) / nullif(lag(opex) OVER (ORDER BY month_start), 0), 2) AS monthly_leverage_spread_pp
FROM monthly
ORDER BY month_start`

const REVENUE_OPEX_GROWTH_ABS_TRAP_SQL = `WITH monthly AS (
  SELECT date_trunc('month', g.txn_date)::DATE AS month_start,
    sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END) AS revenue,
    sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END) AS opex
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1
)
SELECT month_start,
  round(revenue - lag(revenue) OVER (ORDER BY month_start), 2) AS revenue_mom_growth_pct,
  round(opex - lag(opex) OVER (ORDER BY month_start), 2) AS opex_mom_growth_pct,
  round((revenue - lag(revenue) OVER (ORDER BY month_start)) - (opex - lag(opex) OVER (ORDER BY month_start)), 2) AS monthly_leverage_spread_pp
FROM monthly ORDER BY month_start`

const TREND_HANDOFF_SQL = `WITH h1_2026 AS (
  SELECT
    round(sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), 2) AS h1_revenue,
    round(sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END), 2) AS h1_cogs,
    round(sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END), 2) AS h1_opex
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
), h1_2025 AS (
  SELECT
    round(sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), 2) AS h1_revenue,
    round(sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END), 2) AS h1_opex
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2025-01-01' AND g.txn_date < DATE '2025-07-01'
), march AS (
  SELECT round(sum(g.amount), 2) AS march_opex
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-03-01' AND g.txn_date < DATE '2026-04-01' AND a.account_type = 'Opex'
), february AS (
  SELECT round(sum(g.amount), 2) AS february_opex
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-02-01' AND g.txn_date < DATE '2026-03-01' AND a.account_type = 'Opex'
), sm_march AS (
  SELECT round(sum(g.amount), 2) AS sm_march_opex
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id JOIN dim_department d ON g.dept_id = d.dept_id
  WHERE g.txn_date >= DATE '2026-03-01' AND g.txn_date < DATE '2026-04-01' AND a.account_type = 'Opex' AND d.division = 'S&M'
)
SELECT
  round(h1_2026.h1_revenue, 2) AS h1_2026_revenue_usd,
  round(h1_2026.h1_cogs, 2) AS h1_2026_cogs_usd,
  round(h1_2026.h1_opex, 2) AS h1_2026_opex_usd,
  round(100.0 * (h1_2026.h1_revenue - h1_2026.h1_cogs) / nullif(h1_2026.h1_revenue, 0), 2) AS h1_2026_gross_margin_pct,
  round(h1_2025.h1_revenue, 2) AS h1_2025_revenue_usd,
  round(h1_2025.h1_opex, 2) AS h1_2025_opex_usd,
  round(100.0 * (h1_2026.h1_revenue - h1_2025.h1_revenue) / nullif(h1_2025.h1_revenue, 0), 2) AS yoy_revenue_growth_pct,
  round(100.0 * (h1_2026.h1_opex - h1_2025.h1_opex) / nullif(h1_2025.h1_opex, 0), 2) AS yoy_opex_growth_pct,
  round(100.0 * (h1_2026.h1_revenue - h1_2025.h1_revenue) / nullif(h1_2025.h1_revenue, 0)
      - 100.0 * (h1_2026.h1_opex - h1_2025.h1_opex) / nullif(h1_2025.h1_opex, 0), 2) AS operating_leverage_spread_pp,
  round(march.march_opex, 2) AS march_opex_usd,
  round(february.february_opex, 2) AS february_opex_usd,
  round(sm_march.sm_march_opex, 2) AS sm_march_opex_usd
FROM h1_2026 CROSS JOIN h1_2025 CROSS JOIN march CROSS JOIN february CROSS JOIN sm_march`

const TREND_HANDOFF_DROP_COGS_TRAP_SQL = `WITH h1_2026 AS (
  SELECT
    round(sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), 2) AS h1_revenue,
    round(sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END), 2) AS h1_cogs,
    round(sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END), 2) AS h1_opex
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
), h1_2025 AS (
  SELECT
    round(sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), 2) AS h1_revenue,
    round(sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END), 2) AS h1_opex
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2025-01-01' AND g.txn_date < DATE '2025-07-01'
), march AS (
  SELECT round(sum(g.amount), 2) AS march_opex FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-03-01' AND g.txn_date < DATE '2026-04-01' AND a.account_type = 'Opex'
), february AS (
  SELECT round(sum(g.amount), 2) AS february_opex FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-02-01' AND g.txn_date < DATE '2026-03-01' AND a.account_type = 'Opex'
), sm_march AS (
  SELECT round(sum(g.amount), 2) AS sm_march_opex FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id JOIN dim_department d ON g.dept_id = d.dept_id
  WHERE g.txn_date >= DATE '2026-03-01' AND g.txn_date < DATE '2026-04-01' AND a.account_type = 'Opex' AND d.division = 'S&M'
)
SELECT
  round(h1_2026.h1_revenue, 2) AS h1_2026_revenue_usd,
  round(0, 2) AS h1_2026_cogs_usd,
  round(h1_2026.h1_opex, 2) AS h1_2026_opex_usd,
  round(100.0 * (h1_2026.h1_revenue - 0) / nullif(h1_2026.h1_revenue, 0), 2) AS h1_2026_gross_margin_pct,
  round(h1_2025.h1_revenue, 2) AS h1_2025_revenue_usd,
  round(h1_2025.h1_opex, 2) AS h1_2025_opex_usd,
  round(100.0 * (h1_2026.h1_revenue - h1_2025.h1_revenue) / nullif(h1_2025.h1_revenue, 0), 2) AS yoy_revenue_growth_pct,
  round(100.0 * (h1_2026.h1_opex - h1_2025.h1_opex) / nullif(h1_2025.h1_opex, 0), 2) AS yoy_opex_growth_pct,
  round(100.0 * (h1_2026.h1_revenue - h1_2025.h1_revenue) / nullif(h1_2025.h1_revenue, 0) - 100.0 * (h1_2026.h1_opex - h1_2025.h1_opex) / nullif(h1_2025.h1_opex, 0), 2) AS operating_leverage_spread_pp,
  round(march.march_opex, 2) AS march_opex_usd,
  round(february.february_opex, 2) AS february_opex_usd,
  round(sm_march.sm_march_opex, 2) AS sm_march_opex_usd
FROM h1_2026 CROSS JOIN h1_2025 CROSS JOIN march CROSS JOIN february CROSS JOIN sm_march`

export const MONTHLY_PNL_TREND_MISSIONS = [
  {
    id: 'm196',
    part: 29,
    title: 'Build the six-month P&L trend table',
    from: 'maria',
    ask: `Open the trend review with the table leadership scans first: Revenue, COGS, Opex, gross profit, operating result, and gross margin for each of the six H1 2026 months, in calendar order. One row per month keeps the trend readable — do not collapse to quarters.`,
    deliverable: `Six rows ordered by month_start ascending: month_start, revenue_usd, cogs_usd, opex_usd, gross_profit_usd, operating_result_usd, gross_margin_pct. Round dollars and percent to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_account'],
    canonical: MONTHLY_PNL_TREND_SQL,
    solutionSql: MONTHLY_PNL_TREND_SQL,
    solutionNote: `H1 2026 revenue trends steadily upward from $6.51M in January to $7.50M in June, while Opex spikes to $30.0M in March before normalizing. Gross margin holds in a narrow band; the operating result stays deeply negative throughout. This is a recognized-P&L trend, not cash or a forecast.`,
    ordered: true,
    orderedNote: 'month_start ascending',
    fingerprintSQL: MONTHLY_PNL_QUARTERLY_TRAP_SQL,
    fingerprintMessage: `You collapsed the six months into two quarterly rows, hiding the month-level trend leadership reviews. Keep one row per calendar month — truncate txn_date to month and group by it, never by quarter.`,
    hints: [
      `Truncate txn_date to month, filter to H1 2026, and conditional-sum Revenue, COGS, and Opex by account_type in one GROUP BY.`,
      `Derive gross profit (Revenue - COGS), operating result (Revenue - COGS - Opex), and gross margin (100 * gross profit / Revenue) in the SELECT. One row per month, ordered ascending.`,
      MONTHLY_PNL_TREND_SQL,
    ],
    sayIt: `"H1 revenue trends up from $6.51 million in January to $7.50 million in June, while Opex spikes to $30 million in March before normalizing. Gross margin holds steady; the operating result stays deeply negative. This is a recognized-P&L trend, not cash or a forecast."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm197',
    part: 29,
    title: 'Read the gross-margin trend month over month',
    from: 'maria',
    ask: `Is gross margin improving, stable, or eroding across the half? Read monthly revenue, COGS, gross profit, gross margin percent, and the month-over-month margin change in points. The points delta shows whether each month gained or lost margin against the prior — the trend leadership cares about.`,
    deliverable: `Six rows ordered by month_start ascending: month_start, revenue_usd, cogs_usd, gross_profit_usd, gross_margin_pct, margin_delta_pp. Round dollars and percent to 2 decimals; the first month's delta is null.`,
    tables: ['fct_gl_transactions', 'dim_account'],
    canonical: MARGIN_TREND_SQL,
    solutionSql: MARGIN_TREND_SQL,
    solutionNote: `Monthly gross margin moves in a narrow band; the points delta surfaces which months gained or lost against the prior. March COGS is elevated, compressing that month's margin. The first month's delta is null because there is no prior month in the window. This is a recognized-revenue margin trend, not contribution margin or cash.`,
    ordered: true,
    orderedNote: 'month_start ascending',
    fingerprintSQL: MARGIN_TREND_INVERTED_TRAP_SQL,
    fingerprintMessage: `You computed gross margin as revenue divided by gross profit (the inverse ratio), which returns a number above 100% and loses the margin meaning. Gross margin is gross profit over revenue — 100 * (revenue - cogs) / revenue — so it reads as the percent of revenue kept after direct cost.`,
    hints: [
      `Reduce each month to one revenue and one COGS number. Compute gross margin as 100 * (revenue - cogs) / revenue per month.`,
      `Use lag(gross_margin) over (order by month_start) to get the prior month's margin; the delta is current minus prior, in points. Null-guard the denominator.`,
      MARGIN_TREND_SQL,
    ],
    sayIt: `"Monthly gross margin moves in a narrow band; the points delta shows which months gained or lost. March COGS is elevated, compressing that month's margin. This is a recognized-revenue margin trend, not contribution or cash margin."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm198',
    part: 29,
    title: 'Isolate the March Opex spike',
    from: 'danny',
    ask: `March Opex jumps well above its neighbors. Rank every H1 month by the absolute month-over-month Opex delta so the largest swing leads, with the signed delta and percent. This surfaces whether March is the standout or whether another month moved more — and in which direction.`,
    deliverable: `Six rows ordered by absolute mom delta descending (nulls last), then month_start: month_start, opex_usd, mom_delta_usd, mom_delta_pct. Round dollars and percent to 2 decimals; January's delta is null.`,
    tables: ['fct_gl_transactions', 'dim_account'],
    canonical: MARCH_OPEX_SPIKE_FIXED_SQL,
    solutionSql: MARCH_OPEX_SPIKE_FIXED_SQL,
    solutionNote: `March carries the largest absolute month-over-month Opex increase of H1 — a roughly $7.7M jump from February — making it the standout spike. April then shows the largest decline as Opex normalizes. Ranking by absolute delta puts both swings at the top regardless of sign. This is recognized Opex, not cash spend or accruals.`,
    ordered: true,
    orderedNote: 'absolute mom_delta_usd descending, nulls last',
    fingerprintSQL: MARCH_OPEX_SPIKE_SIGNED_TRAP_SQL,
    fingerprintMessage: `You used a two-month lag (lag(...,2)) for the month-over-month delta, so March compares to January instead of February and the spike reads against the wrong baseline. Month-over-month is a one-month lag — lag(opex) over (order by month_start) — so each month compares to its immediate predecessor.`,
    hints: [
      `Sum Opex per month, then use lag(opex) over (order by month_start) for the prior month. Delta is current minus prior.`,
      `Rank by abs(delta) descending with NULLS LAST so January's null delta doesn't sort to the top. Percent is 100 * delta / prior, null-guarded.`,
      MARCH_OPEX_SPIKE_FIXED_SQL,
    ],
    sayIt: `"March carries the largest absolute Opex increase of the half — about $7.7 million over February — and April shows the largest decline as it normalizes. Ranking by absolute delta surfaces both swings. This is recognized Opex, not cash or accruals."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm199',
    part: 29,
    title: 'Attribute the March Opex spike by division',
    from: 'danny',
    ask: `March Opex spiked — which division drove it? Compare March Opex to February Opex by division, with the signed dollar and percent delta. This shows whether S&M, R&D, or G&A carried the spike and keeps the comparison to the immediate prior month so the swing is visible.`,
    deliverable: `One row per division ordered by mom_delta_usd descending (largest increase first): division, march_opex_usd, february_opex_usd, mom_delta_usd, mom_delta_pct. Round dollars and percent to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_account', 'dim_department'],
    canonical: MARCH_SPIKE_DIVISION_SQL,
    solutionSql: MARCH_SPIKE_DIVISION_SQL,
    solutionNote: `S&M carries the largest March-over-February Opex increase in dollars, followed by R&D and G&A; all three divisions participate in the spike rather than one isolated cost. The comparison is to the immediate prior month so the swing reads cleanly. This is recognized Opex by division, not cash or a headcount count.`,
    ordered: true,
    orderedNote: 'mom_delta_usd descending',
    fingerprintSQL: MARCH_SPIKE_DIVISION_Q1_TRAP_SQL,
    fingerprintMessage: `You summed all of Q1 Opex per division and reported it as both March and February, so every delta reads zero and the spike vanishes. Compare March to February specifically with conditional sums over each month's date window.`,
    hints: [
      `Join GL to dim_account (Opex) and dim_department (division). Use conditional sums: March amount when txn_date is in March, February amount when in February.`,
      `Delta is March minus February per division; percent is 100 * delta / February, null-guarded. Order by the signed delta descending so the largest increase leads.`,
      MARCH_SPIKE_DIVISION_SQL,
    ],
    sayIt: `"S&M carries the largest March-over-February Opex increase, followed by R&D and G&A — all three participate in the spike. The comparison is to the immediate prior month so the swing reads cleanly. This is recognized Opex by division, not cash or headcount."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm200',
    part: 29,
    title: 'Measure H1 year-over-year operating leverage',
    from: 'maria',
    ask: `The trend question leadership asks: did H1 2026 show operating leverage versus H1 2025? Compare the same half in both years so seasonality does not masquerade as leverage. Compute revenue growth percent, Opex growth percent, and the spread between them — positive spread means revenue grew faster than Opex.`,
    deliverable: `Exactly one row: h1_2025_revenue_usd, h1_2026_revenue_usd, yoy_revenue_growth_pct, h1_2025_opex_usd, h1_2026_opex_usd, yoy_opex_growth_pct, operating_leverage_spread_pp. Round dollars and percent to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_account'],
    canonical: H1_YOY_LEVERAGE_SQL,
    solutionSql: H1_YOY_LEVERAGE_SQL,
    solutionNote: `H1 2026 revenue grew 41.1% over H1 2025 while Opex grew 36.3%, a positive 4.8-point operating leverage spread — revenue outpaced cost even though the business remains deeply loss-making. The spread is a rate difference in percentage points, not a dollar variance. Same-half comparison controls for seasonality.`,
    ordered: false,
    fingerprintSQL: H1_YOY_LEVERAGE_Q2_TRAP_SQL,
    fingerprintMessage: `You compared Q1 2026 to Q2 2026 and labeled it year-over-year leverage, which mixes seasonality into the spread. Use H1 2025 as the prior period so the leverage read compares the same seasonal half year over year.`,
    hints: [
      `Build one-row H1 2025 and H1 2026 revenue + Opex summaries, each filtered to its own Jan-Jun window. Pivot them into prior/current columns with conditional max.`,
      `Growth is 100 * (current - prior) / prior for each line. The leverage spread is revenue growth minus Opex growth, in percentage points.`,
      H1_YOY_LEVERAGE_SQL,
    ],
    sayIt: `"H1 2026 revenue grew 41.1% over H1 2025 while Opex grew 36.3% — a positive 4.8-point operating leverage spread. Revenue outpaced cost even though the business stays deeply loss-making. Same-half comparison controls for seasonality."`,
    jdCompanies: ['Stripe'],
  },
  {
    id: 'm201',
    part: 29,
    title: 'Read the monthly revenue-versus-Opex growth spread',
    from: 'maria',
    ask: `Year-over-year leverage is one view; the monthly cadence is another. For each H1 2026 month, compute revenue month-over-month growth percent, Opex month-over-month growth percent, and the spread between them. This shows which months carried positive leverage and which did not — the cadence behind the half-year number.`,
    deliverable: `Six rows ordered by month_start ascending: month_start, revenue_mom_growth_pct, opex_mom_growth_pct, monthly_leverage_spread_pp. Round percent and points to 2 decimals; January's values are null.`,
    tables: ['fct_gl_transactions', 'dim_account'],
    canonical: REVENUE_OPEX_GROWTH_SPREAD_SQL,
    solutionSql: REVENUE_OPEX_GROWTH_SPREAD_SQL,
    solutionNote: `Monthly revenue growth stays modestly positive while Opex growth swings sharply — March's Opex spike makes that month's spread deeply negative. The monthly cadence explains why the half-year leverage spread is positive but thin: most months are near zero or negative, with the March spike dragging the average. This is a rate cadence, not a dollar variance.`,
    ordered: true,
    orderedNote: 'month_start ascending',
    fingerprintSQL: REVENUE_OPEX_GROWTH_ABS_TRAP_SQL,
    fingerprintMessage: `You reported dollar deltas instead of percent growth, so the "spread" mixes dollars and loses the rate comparison. Convert each month-over-month movement to a percent of the prior month before taking the spread.`,
    hints: [
      `Reduce each month to one revenue and one Opex number. Use lag() over (order by month_start) for each prior value.`,
      `Each growth rate is 100 * (current - prior) / prior, null-guarded. The monthly spread is revenue growth minus Opex growth, in points. Null for January.`,
      REVENUE_OPEX_GROWTH_SPREAD_SQL,
    ],
    sayIt: `"Monthly revenue growth stays modestly positive while Opex growth swings — March's spike makes that month's spread deeply negative. The cadence explains why the half-year leverage is positive but thin. This is a rate cadence, not a dollar variance."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm202',
    part: 29,
    title: 'Compare March 2026 to the March 2025 pattern',
    from: 'danny',
    ask: `March spikes in both years — is 2026's spike worse, better, or in line with 2025? Compare March 2026 Opex to March 2025 Opex directly, with the year-over-year dollar and percent change. A recurring March spike points at a structural quarterly accrual; a growing one changes the conversation.`,
    deliverable: `Exactly one row: march_2025_opex_usd, march_2026_opex_usd, yoy_delta_usd, yoy_delta_pct. Round dollars and percent to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_account'],
    canonical: `WITH m25 AS (
  SELECT round(sum(g.amount), 2) AS opex
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2025-03-01' AND g.txn_date < DATE '2025-04-01' AND a.account_type = 'Opex'
), m26 AS (
  SELECT round(sum(g.amount), 2) AS opex
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-03-01' AND g.txn_date < DATE '2026-04-01' AND a.account_type = 'Opex'
)
SELECT round(m25.opex, 2) AS march_2025_opex_usd,
  round(m26.opex, 2) AS march_2026_opex_usd,
  round(m26.opex - m25.opex, 2) AS yoy_delta_usd,
  round(100.0 * (m26.opex - m25.opex) / nullif(m25.opex, 0), 2) AS yoy_delta_pct
FROM m25 CROSS JOIN m26`,
    solutionSql: `WITH m25 AS (
  SELECT round(sum(g.amount), 2) AS opex
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2025-03-01' AND g.txn_date < DATE '2025-04-01' AND a.account_type = 'Opex'
), m26 AS (
  SELECT round(sum(g.amount), 2) AS opex
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-03-01' AND g.txn_date < DATE '2026-04-01' AND a.account_type = 'Opex'
)
SELECT round(m25.opex, 2) AS march_2025_opex_usd,
  round(m26.opex, 2) AS march_2026_opex_usd,
  round(m26.opex - m25.opex, 2) AS yoy_delta_usd,
  round(100.0 * (m26.opex - m25.opex) / nullif(m25.opex, 0), 2) AS yoy_delta_pct
FROM m25 CROSS JOIN m26`,
    solutionNote: `March Opex is elevated in both years — 2025 at $21.86M and 2026 at $29.98M — confirming a recurring quarterly pattern rather than a one-off. The year-over-year delta shows how much the spike grew. A recurring March spike points at a structural quarterly accrual; this read does not establish its cause.`,
    ordered: false,
    fingerprintSQL: `WITH m25 AS (
  SELECT round(sum(g.amount), 2) AS opex
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2025-03-01' AND g.txn_date < DATE '2025-04-01' AND a.account_type IN ('Opex','COGS')
), m26 AS (
  SELECT round(sum(g.amount), 2) AS opex
  FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id
  WHERE g.txn_date >= DATE '2026-03-01' AND g.txn_date < DATE '2026-04-01' AND a.account_type IN ('Opex','COGS')
)
SELECT round(m25.opex, 2) AS march_2025_opex_usd, round(m26.opex, 2) AS march_2026_opex_usd,
  round(m26.opex - m25.opex, 2) AS yoy_delta_usd, round(100.0 * (m26.opex - m25.opex) / nullif(m25.opex, 0), 2) AS yoy_delta_pct
FROM m25 CROSS JOIN m26`,
    fingerprintMessage: `You folded COGS into both March totals, mixing a cost-of-revenue line into an Opex spike read and inflating both periods the same way. Keep the read to account_type = 'Opex' so the spike attribution stays clean.`,
    hints: [
      `Build one-row March 2025 and March 2026 Opex summaries, each filtered to its own March window and account_type = 'Opex'. CROSS JOIN them.`,
      `Delta is 2026 minus 2025; percent is 100 * delta / 2025, null-guarded. One row out.`,
      `The recurring elevation in both years points at a structural quarterly pattern; this read does not establish its cause.`,
    ],
    sayIt: `"March Opex is elevated in both years — $21.86 million in 2025 and $29.98 million in 2026 — so it's a recurring quarterly pattern, not a one-off. The year-over-year delta shows how much the spike grew. This read does not establish its cause."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm203',
    part: 29,
    title: 'Package the H1 trend and leverage handoff',
    from: 'maria',
    ask: `Close the trend review in one Finance leadership handoff. Carry the H1 2026 P&L (revenue, COGS, Opex, gross margin), the H1 2025 revenue and Opex, the year-over-year revenue and Opex growth with the operating leverage spread, and the March Opex spike with its February baseline and the S&M March anchor. Reduce each control to one row or value before combining.`,
    deliverable: `Exactly one row: h1_2026_revenue_usd, h1_2026_cogs_usd, h1_2026_opex_usd, h1_2026_gross_margin_pct, h1_2025_revenue_usd, h1_2025_opex_usd, yoy_revenue_growth_pct, yoy_opex_growth_pct, operating_leverage_spread_pp, march_opex_usd, february_opex_usd, sm_march_opex_usd. Round dollars and percent to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_account', 'dim_department'],
    canonical: TREND_HANDOFF_SQL,
    solutionSql: TREND_HANDOFF_SQL,
    solutionNote: `The H1 trend handoff: 2026 revenue $41.99M, COGS $15.89M, Opex $140.97M, gross margin 62.15%; 2025 revenue $29.75M and Opex $103.42M; year-over-year revenue growth 41.1% against Opex growth 36.3% for a +4.8pp operating leverage spread; March Opex $29.98M against February $22.30M with S&M anchoring March at $13.53M. This is a recognized-P&L trend and leverage handoff — not cash, net income, a forecast, or a cause attribution.`,
    ordered: false,
    fingerprintSQL: TREND_HANDOFF_DROP_COGS_TRAP_SQL,
    fingerprintMessage: `Your handoff zeroes out COGS and computes gross margin as 100%, dropping the gross-profit line leadership reviews. Carry the actual H1 COGS so the gross margin reflects the real cost of revenue.`,
    hints: [
      `Build one-row H1 2026 (revenue, COGS, Opex), H1 2025 (revenue, Opex), March Opex, February Opex, and S&M March Opex controls. CROSS JOIN only those reduced single-row outputs.`,
      `Growth rates are 100 * (2026 - 2025) / 2025 for revenue and Opex; the leverage spread is revenue growth minus Opex growth. Gross margin is 100 * (revenue - COGS) / revenue.`,
      TREND_HANDOFF_SQL,
    ],
    sayIt: `"H1 2026: $41.99 million revenue, $140.97 million Opex, 62.15% gross margin. Revenue grew 41.1% year over year against 36.3% Opex growth — a 4.8-point leverage spread. March Opex spiked to $30 million with S&M anchoring at $13.5 million. This is a recognized-P&L trend handoff — not cash, net income, a forecast, or a cause attribution."`,
    jdCompanies: ['Stripe'],
  },
]
