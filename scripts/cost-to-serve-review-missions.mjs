// One complete Star67 workday: define a deliberately modeled cost-to-serve
// view, conserve shared COGS to the cent at customer-month grain, and route a
// review queue without turning seats, logo exposure, or allocations into
// observed utilization or actual customer profitability.

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

const COST_SCOPE_SQL = `WITH ${GL_DEDUPE_CTE}, scoped AS (
  SELECT
    g.account_id,
    a.account_name,
    CASE
      WHEN g.account_id = '5010' THEN 'direct recorded by customer'
      WHEN g.account_id IN ('5000', '5310') THEN 'modeled by licensed seats'
      WHEN g.account_id = '5300' THEN 'modeled by active customer-months'
    END AS cost_treatment,
    g.customer_id,
    g.amount
  FROM deduped_gl g
  JOIN dim_account a USING (account_id)
  WHERE g.account_id IN ('5000', '5010', '5300', '5310')
)
SELECT
  account_id,
  account_name,
  cost_treatment,
  count(*)::BIGINT AS gl_rows,
  count(customer_id)::BIGINT AS customer_tagged_rows,
  round(100.0 * count(customer_id) / count(*), 1) AS customer_tag_coverage_pct,
  round(sum(cast(amount AS DECIMAL(18, 2))), 2) AS h1_cogs_usd
FROM scoped
GROUP BY account_id, account_name, cost_treatment
ORDER BY account_id`

const CUSTOMER_TAGGED_ONLY_SCOPE_SQL = COST_SCOPE_SQL.replace(
  `WHERE g.account_id IN ('5000', '5010', '5300', '5310')`,
  `WHERE g.account_id IN ('5000', '5010', '5300', '5310')
    AND g.customer_id IS NOT NULL`,
)

const DRIVER_PROFILE_SQL = `WITH drivers AS (
  SELECT
    plan_name,
    count(DISTINCT month_start)::BIGINT AS months_loaded,
    count(*)::BIGINT AS active_customer_months,
    sum(seats)::BIGINT AS licensed_seat_months
  FROM fct_subscription_snapshot_monthly
  WHERE month_start >= DATE '2026-01-01'
    AND month_start < DATE '2026-07-01'
  GROUP BY plan_name
)
SELECT
  plan_name,
  months_loaded,
  active_customer_months,
  licensed_seat_months,
  round(100.0 * active_customer_months / sum(active_customer_months) OVER (), 1)
    AS active_customer_month_share_pct,
  round(100.0 * licensed_seat_months / sum(licensed_seat_months) OVER (), 1)
    AS licensed_seat_month_share_pct
FROM drivers
ORDER BY plan_name`

const JUNE_TIMES_SIX_DRIVER_SQL = `WITH june AS (
  SELECT
    plan_name,
    count(*)::BIGINT AS active_customers,
    sum(seats)::BIGINT AS licensed_seats
  FROM fct_subscription_snapshot_monthly
  WHERE month_start = DATE '2026-06-01'
  GROUP BY plan_name
), drivers AS (
  SELECT
    plan_name,
    6::BIGINT AS months_loaded,
    6 * active_customers AS active_customer_months,
    6 * licensed_seats AS licensed_seat_months
  FROM june
)
SELECT
  plan_name,
  months_loaded,
  active_customer_months,
  licensed_seat_months,
  round(100.0 * active_customer_months / sum(active_customer_months) OVER (), 1)
    AS active_customer_month_share_pct,
  round(100.0 * licensed_seat_months / sum(licensed_seat_months) OVER (), 1)
    AS licensed_seat_month_share_pct
FROM drivers
ORDER BY plan_name`

const makeDirectFeeJoinSql = (joinPredicate) => `WITH ${GL_DEDUPE_CTE}, plans AS (
  SELECT DISTINCT plan_name
  FROM fct_subscription_snapshot_monthly
  WHERE month_start >= DATE '2026-01-01'
    AND month_start < DATE '2026-07-01'
), direct_lines AS (
  SELECT
    date_trunc('month', txn_date)::DATE AS service_month,
    customer_id,
    cast(amount AS DECIMAL(18, 2)) AS direct_fee_usd
  FROM deduped_gl
  WHERE account_id = '5010'
    AND customer_id IS NOT NULL
), matched AS (
  SELECT
    s.plan_name,
    d.service_month,
    d.customer_id,
    d.direct_fee_usd
  FROM direct_lines d
  JOIN fct_subscription_snapshot_monthly s
    ON ${joinPredicate}
), plan_fees AS (
  SELECT
    plan_name,
    count(*)::BIGINT AS direct_fee_lines,
    count(DISTINCT (service_month, customer_id))::BIGINT
      AS direct_fee_customer_months,
    count(DISTINCT customer_id)::BIGINT AS customers_with_direct_fees,
    sum(direct_fee_usd) AS direct_payment_fee_usd
  FROM matched
  GROUP BY plan_name
)
SELECT
  p.plan_name,
  coalesce(f.direct_fee_lines, 0)::BIGINT AS direct_fee_lines,
  coalesce(f.direct_fee_customer_months, 0)::BIGINT AS direct_fee_customer_months,
  coalesce(f.customers_with_direct_fees, 0)::BIGINT AS customers_with_direct_fees,
  round(coalesce(f.direct_payment_fee_usd, 0), 2) AS direct_payment_fee_usd
FROM plans p
LEFT JOIN plan_fees f USING (plan_name)
ORDER BY p.plan_name`

const DIRECT_FEE_JOIN_SQL = makeDirectFeeJoinSql(
  `s.month_start = d.service_month AND s.customer_id = d.customer_id`,
)
const CUSTOMER_ONLY_DIRECT_FEE_JOIN_SQL = makeDirectFeeJoinSql(
  `s.customer_id = d.customer_id`,
)

const COST_MODEL_CTES = `WITH ${GL_DEDUPE_CTE}, active_customer_months AS (
  SELECT month_start, customer_id, plan_name, seats
  FROM fct_subscription_snapshot_monthly
  WHERE month_start >= DATE '2026-01-01'
    AND month_start < DATE '2026-07-01'
), recognized_revenue AS (
  SELECT
    date_trunc('month', txn_date)::DATE AS month_start,
    customer_id,
    sum(cast(amount AS DECIMAL(18, 2))) AS recognized_revenue_usd
  FROM deduped_gl
  WHERE account_id IN ('4000', '4010')
    AND customer_id IS NOT NULL
  GROUP BY month_start, customer_id
), direct_fees AS (
  SELECT
    date_trunc('month', txn_date)::DATE AS month_start,
    customer_id,
    sum(cast(amount AS DECIMAL(18, 2))) AS direct_fee_usd
  FROM deduped_gl
  WHERE account_id = '5010'
    AND customer_id IS NOT NULL
  GROUP BY month_start, customer_id
), monthly_pools AS (
  SELECT
    date_trunc('month', txn_date)::DATE AS month_start,
    sum(cast(amount AS DECIMAL(18, 2))) FILTER (
      WHERE account_id IN ('5000', '5310')
    ) AS hosting_cloud_pool_usd,
    sum(cast(amount AS DECIMAL(18, 2))) FILTER (
      WHERE account_id = '5300'
    ) AS support_pool_usd
  FROM deduped_gl
  WHERE account_id IN ('5000', '5300', '5310')
  GROUP BY month_start
), raw_allocations AS (
  SELECT
    a.month_start,
    a.customer_id,
    a.plan_name,
    a.seats,
    coalesce(r.recognized_revenue_usd, 0) AS recognized_revenue_usd,
    coalesce(f.direct_fee_usd, 0) AS direct_fee_usd,
    p.hosting_cloud_pool_usd,
    p.support_pool_usd,
    p.hosting_cloud_pool_usd * a.seats
      / sum(a.seats) OVER (PARTITION BY a.month_start) AS hosting_cloud_raw_usd,
    p.support_pool_usd
      / count(*) OVER (PARTITION BY a.month_start) AS support_logo_raw_usd,
    p.support_pool_usd * a.seats
      / sum(a.seats) OVER (PARTITION BY a.month_start) AS support_seat_raw_usd
  FROM active_customer_months a
  JOIN monthly_pools p USING (month_start)
  LEFT JOIN recognized_revenue r
    ON r.month_start = a.month_start
   AND r.customer_id = a.customer_id
  LEFT JOIN direct_fees f
    ON f.month_start = a.month_start
   AND f.customer_id = a.customer_id
), allocation_methods AS (
  SELECT
    month_start,
    customer_id,
    'hosting_cloud_seat' AS allocation_method,
    round(hosting_cloud_pool_usd * 100)::BIGINT AS pool_cents,
    seats::BIGINT AS driver_units,
    (sum(seats) OVER (PARTITION BY month_start))::BIGINT AS total_driver_units
  FROM raw_allocations
  UNION ALL
  SELECT
    month_start,
    customer_id,
    'support_logo' AS allocation_method,
    round(support_pool_usd * 100)::BIGINT AS pool_cents,
    1::BIGINT AS driver_units,
    (count(*) OVER (PARTITION BY month_start))::BIGINT AS total_driver_units
  FROM raw_allocations
  UNION ALL
  SELECT
    month_start,
    customer_id,
    'support_seat' AS allocation_method,
    round(support_pool_usd * 100)::BIGINT AS pool_cents,
    seats::BIGINT AS driver_units,
    (sum(seats) OVER (PARTITION BY month_start))::BIGINT AS total_driver_units
  FROM raw_allocations
), allocation_bases AS (
  SELECT
    month_start,
    customer_id,
    allocation_method,
    pool_cents,
    (pool_cents * driver_units) // total_driver_units AS base_cents,
    (pool_cents * driver_units) % total_driver_units AS remainder_numerator
  FROM allocation_methods
), method_remainders AS (
  SELECT
    month_start,
    allocation_method,
    max(pool_cents) AS pool_cents,
    sum(base_cents)::BIGINT AS allocated_base_cents,
    max(pool_cents) - sum(base_cents)::BIGINT
      AS pennies_to_distribute
  FROM allocation_bases
  GROUP BY month_start, allocation_method
), ranked_allocations AS (
  SELECT
    b.month_start,
    b.customer_id,
    b.allocation_method,
    b.base_cents,
    r.pennies_to_distribute,
    row_number() OVER (
      PARTITION BY b.month_start, b.allocation_method
      ORDER BY b.remainder_numerator DESC, b.customer_id
    ) AS remainder_rank
  FROM allocation_bases b
  JOIN method_remainders r USING (month_start, allocation_method)
), final_allocations AS (
  SELECT
    month_start,
    customer_id,
    allocation_method,
    (
      base_cents
      + CASE WHEN remainder_rank <= pennies_to_distribute THEN 1 ELSE 0 END
    ) / 100.0 AS modeled_allocation_usd
  FROM ranked_allocations
), customer_allocation_pivot AS (
  SELECT
    month_start,
    customer_id,
    max(modeled_allocation_usd) FILTER (
      WHERE allocation_method = 'hosting_cloud_seat'
    ) AS modeled_hosting_cloud_usd,
    max(modeled_allocation_usd) FILTER (
      WHERE allocation_method = 'support_logo'
    ) AS modeled_support_logo_usd,
    max(modeled_allocation_usd) FILTER (
      WHERE allocation_method = 'support_seat'
    ) AS modeled_support_seat_usd
  FROM final_allocations
  GROUP BY month_start, customer_id
), customer_month_model AS (
  SELECT
    r.month_start,
    r.customer_id,
    r.plan_name,
    r.seats,
    r.recognized_revenue_usd,
    r.direct_fee_usd,
    r.hosting_cloud_pool_usd,
    r.support_pool_usd,
    a.modeled_hosting_cloud_usd,
    a.modeled_support_logo_usd,
    a.modeled_support_seat_usd
  FROM raw_allocations r
  JOIN customer_allocation_pivot a USING (month_start, customer_id)
)`

const MONTHLY_ALLOCATION_SQL = `${COST_MODEL_CTES}, plan_month AS (
  SELECT
    month_start,
    plan_name,
    count(*)::BIGINT AS active_customer_months,
    sum(seats)::BIGINT AS licensed_seats,
    max(hosting_cloud_pool_usd) AS hosting_cloud_pool_usd,
    max(support_pool_usd) AS support_pool_usd,
    sum(modeled_hosting_cloud_usd) AS modeled_hosting_cloud_usd,
    sum(modeled_support_logo_usd) AS modeled_support_usd
  FROM customer_month_model
  GROUP BY month_start, plan_name
)
SELECT
  month_start,
  plan_name,
  active_customer_months,
  licensed_seats,
  round(modeled_hosting_cloud_usd, 2) AS modeled_hosting_cloud_usd,
  round(modeled_support_usd, 2) AS modeled_support_usd,
  round(
    max(hosting_cloud_pool_usd) OVER (PARTITION BY month_start)
      - sum(modeled_hosting_cloud_usd) OVER (PARTITION BY month_start),
    2
  ) AS hosting_cloud_reconciliation_difference_usd,
  round(
    max(support_pool_usd) OVER (PARTITION BY month_start)
      - sum(modeled_support_usd) OVER (PARTITION BY month_start),
    2
  ) AS support_reconciliation_difference_usd
FROM plan_month
ORDER BY month_start, plan_name`

const NAIVE_ROUNDED_ALLOCATION_SQL = `${COST_MODEL_CTES}, plan_month AS (
  SELECT
    month_start,
    plan_name,
    count(*)::BIGINT AS active_customer_months,
    sum(seats)::BIGINT AS licensed_seats,
    max(hosting_cloud_pool_usd) AS hosting_cloud_pool_usd,
    max(support_pool_usd) AS support_pool_usd,
    sum(round(hosting_cloud_raw_usd, 2)) AS modeled_hosting_cloud_usd,
    sum(round(support_logo_raw_usd, 2)) AS modeled_support_usd
  FROM raw_allocations
  GROUP BY month_start, plan_name
)
SELECT
  month_start,
  plan_name,
  active_customer_months,
  licensed_seats,
  round(modeled_hosting_cloud_usd, 2) AS modeled_hosting_cloud_usd,
  round(modeled_support_usd, 2) AS modeled_support_usd,
  round(
    max(hosting_cloud_pool_usd) OVER (PARTITION BY month_start)
      - sum(modeled_hosting_cloud_usd) OVER (PARTITION BY month_start),
    2
  ) AS hosting_cloud_reconciliation_difference_usd,
  round(
    max(support_pool_usd) OVER (PARTITION BY month_start)
      - sum(modeled_support_usd) OVER (PARTITION BY month_start),
    2
  ) AS support_reconciliation_difference_usd
FROM plan_month
ORDER BY month_start, plan_name`

const PLAN_MARGIN_SQL = `${COST_MODEL_CTES}, plan_model AS (
  SELECT
    plan_name,
    sum(recognized_revenue_usd) AS recognized_revenue_usd,
    sum(direct_fee_usd) AS direct_fee_usd,
    sum(modeled_hosting_cloud_usd) AS hosting_cloud_usd,
    sum(modeled_support_logo_usd) AS support_usd
  FROM customer_month_model
  GROUP BY plan_name
)
SELECT
  plan_name,
  round(recognized_revenue_usd, 2) AS modeled_recognized_revenue_usd,
  round(direct_fee_usd, 2) AS modeled_direct_fee_usd,
  round(hosting_cloud_usd, 2) AS modeled_hosting_cloud_usd,
  round(support_usd, 2) AS modeled_support_usd,
  round(direct_fee_usd + hosting_cloud_usd + support_usd, 2)
    AS modeled_total_cogs_usd,
  round(recognized_revenue_usd - direct_fee_usd - hosting_cloud_usd - support_usd, 2)
    AS modeled_gross_profit_usd,
  round(
    100.0 * (recognized_revenue_usd - direct_fee_usd - hosting_cloud_usd - support_usd)
      / nullif(recognized_revenue_usd, 0),
    1
  ) AS modeled_gross_margin_pct
FROM plan_model
ORDER BY plan_name`

const ARR_PROXY_MARGIN_SQL = `${COST_MODEL_CTES}, plan_model AS (
  SELECT
    plan_name,
    sum(direct_fee_usd) AS direct_fee_usd,
    sum(modeled_hosting_cloud_usd) AS hosting_cloud_usd,
    sum(modeled_support_logo_usd) AS support_usd
  FROM customer_month_model
  GROUP BY plan_name
), arr_proxy AS (
  SELECT plan_name, sum(arr_usd / 12.0) AS recognized_revenue_usd
  FROM fct_subscription_snapshot_monthly
  WHERE month_start >= DATE '2026-01-01'
    AND month_start < DATE '2026-07-01'
  GROUP BY plan_name
)
SELECT
  p.plan_name,
  round(a.recognized_revenue_usd, 2) AS modeled_recognized_revenue_usd,
  round(p.direct_fee_usd, 2) AS modeled_direct_fee_usd,
  round(p.hosting_cloud_usd, 2) AS modeled_hosting_cloud_usd,
  round(p.support_usd, 2) AS modeled_support_usd,
  round(p.direct_fee_usd + p.hosting_cloud_usd + p.support_usd, 2)
    AS modeled_total_cogs_usd,
  round(a.recognized_revenue_usd - p.direct_fee_usd - p.hosting_cloud_usd - p.support_usd, 2)
    AS modeled_gross_profit_usd,
  round(
    100.0 * (a.recognized_revenue_usd - p.direct_fee_usd - p.hosting_cloud_usd - p.support_usd)
      / nullif(a.recognized_revenue_usd, 0),
    1
  ) AS modeled_gross_margin_pct
FROM plan_model p
JOIN arr_proxy a USING (plan_name)
ORDER BY p.plan_name`

const makeTieSql = (glRevenueAccounts) => `${COST_MODEL_CTES}, gl_control AS (
  SELECT
    sum(cast(amount AS DECIMAL(18, 2))) FILTER (
      WHERE account_id IN (${glRevenueAccounts})
        AND customer_id IS NOT NULL
    ) AS recognized_revenue_usd,
    sum(cast(amount AS DECIMAL(18, 2))) FILTER (
      WHERE account_id = '5010'
        AND customer_id IS NOT NULL
    ) AS direct_fee_usd,
    sum(cast(amount AS DECIMAL(18, 2))) FILTER (
      WHERE account_id IN ('5000', '5310')
    ) AS hosting_cloud_usd,
    sum(cast(amount AS DECIMAL(18, 2))) FILTER (
      WHERE account_id = '5300'
    ) AS support_usd
  FROM deduped_gl
), model_control AS (
  SELECT
    sum(recognized_revenue_usd) AS recognized_revenue_usd,
    sum(direct_fee_usd) AS direct_fee_usd,
    sum(modeled_hosting_cloud_usd) AS hosting_cloud_usd,
    sum(modeled_support_logo_usd) AS support_usd
  FROM customer_month_model
)
SELECT
  round(g.recognized_revenue_usd, 2) AS gl_recognized_revenue_usd,
  round(m.recognized_revenue_usd, 2) AS modeled_recognized_revenue_usd,
  round(g.recognized_revenue_usd - m.recognized_revenue_usd, 2)
    AS revenue_reconciliation_difference_usd,
  round(g.direct_fee_usd, 2) AS gl_direct_fee_usd,
  round(m.direct_fee_usd, 2) AS modeled_direct_fee_usd,
  round(g.direct_fee_usd - m.direct_fee_usd, 2)
    AS direct_fee_reconciliation_difference_usd,
  round(g.hosting_cloud_usd, 2) AS gl_hosting_cloud_usd,
  round(m.hosting_cloud_usd, 2) AS modeled_hosting_cloud_usd,
  round(g.hosting_cloud_usd - m.hosting_cloud_usd, 2)
    AS hosting_cloud_reconciliation_difference_usd,
  round(g.support_usd, 2) AS gl_support_usd,
  round(m.support_usd, 2) AS modeled_support_usd,
  round(g.support_usd - m.support_usd, 2)
    AS support_reconciliation_difference_usd,
  round(g.direct_fee_usd + g.hosting_cloud_usd + g.support_usd, 2)
    AS gl_total_cogs_usd,
  round(m.direct_fee_usd + m.hosting_cloud_usd + m.support_usd, 2)
    AS modeled_total_cogs_usd,
  round(
    g.direct_fee_usd + g.hosting_cloud_usd + g.support_usd
      - m.direct_fee_usd - m.hosting_cloud_usd - m.support_usd,
    2
  ) AS total_cogs_reconciliation_difference_usd
FROM gl_control g
CROSS JOIN model_control m`

const GL_TIE_SQL = makeTieSql(`'4000', '4010'`)
const SUBSCRIPTION_ONLY_GL_TIE_SQL = makeTieSql(`'4000'`)

const CUSTOMER_DISPERSION_SQL = `${COST_MODEL_CTES}, customer_plan AS (
  SELECT
    plan_name,
    customer_id,
    sum(recognized_revenue_usd) AS modeled_revenue_usd,
    sum(direct_fee_usd + modeled_hosting_cloud_usd + modeled_support_logo_usd)
      AS modeled_cogs_usd
  FROM customer_month_model
  GROUP BY plan_name, customer_id
), margins AS (
  SELECT
    *,
    100.0 * (modeled_revenue_usd - modeled_cogs_usd)
      / nullif(modeled_revenue_usd, 0) AS modeled_margin_pct
  FROM customer_plan
)
SELECT
  plan_name,
  count(*)::BIGINT AS modeled_customer_plan_rows,
  count(*) FILTER (
    WHERE modeled_revenue_usd - modeled_cogs_usd < 0
  )::BIGINT AS negative_modeled_margin_customers,
  round(quantile_cont(modeled_margin_pct, 0.10), 1) AS modeled_margin_p10_pct,
  round(quantile_cont(modeled_margin_pct, 0.50), 1) AS modeled_margin_median_pct,
  round(quantile_cont(modeled_margin_pct, 0.90), 1) AS modeled_margin_p90_pct
FROM margins
GROUP BY plan_name
ORDER BY plan_name`

const AVERAGE_OF_MONTHLY_MARGIN_SQL = `${COST_MODEL_CTES}, customer_month_margin AS (
  SELECT
    plan_name,
    customer_id,
    100.0 * (
      recognized_revenue_usd
        - direct_fee_usd - modeled_hosting_cloud_usd - modeled_support_logo_usd
    ) / nullif(recognized_revenue_usd, 0) AS modeled_margin_pct,
    recognized_revenue_usd
      - direct_fee_usd - modeled_hosting_cloud_usd - modeled_support_logo_usd
      AS modeled_gp_usd
  FROM customer_month_model
)
SELECT
  plan_name,
  count(*)::BIGINT AS modeled_customer_plan_rows,
  count(*) FILTER (WHERE modeled_gp_usd < 0)::BIGINT
    AS negative_modeled_margin_customers,
  round(quantile_cont(modeled_margin_pct, 0.10), 1) AS modeled_margin_p10_pct,
  round(quantile_cont(modeled_margin_pct, 0.50), 1) AS modeled_margin_median_pct,
  round(quantile_cont(modeled_margin_pct, 0.90), 1) AS modeled_margin_p90_pct
FROM customer_month_margin
GROUP BY plan_name
ORDER BY plan_name`

const LOSS_QUEUE_SQL = `${COST_MODEL_CTES}, customer_model AS (
  SELECT
    customer_id,
    arg_max(plan_name, month_start) AS modeled_plan_name,
    sum(recognized_revenue_usd) AS modeled_revenue_usd,
    sum(direct_fee_usd + modeled_hosting_cloud_usd + modeled_support_logo_usd)
      AS modeled_cogs_usd
  FROM customer_month_model
  GROUP BY customer_id
), latest_csm AS (
  SELECT customer_id, csm_name
  FROM stg_customer_csm_assignments
  WHERE assigned_on <= DATE '2026-06-30'
  QUALIFY row_number() OVER (
    PARTITION BY customer_id
    ORDER BY assigned_on DESC, csm_name
  ) = 1
), ranked_losses AS (
  SELECT
    *,
    row_number() OVER (
      ORDER BY modeled_revenue_usd - modeled_cogs_usd, customer_id
    ) AS modeled_loss_rank
  FROM customer_model
)
SELECT
  c.customer_id,
  d.customer_name,
  c.modeled_plan_name,
  l.csm_name,
  round(c.modeled_revenue_usd, 2) AS modeled_revenue_usd,
  round(c.modeled_cogs_usd, 2) AS modeled_cogs_usd,
  round(c.modeled_revenue_usd - c.modeled_cogs_usd, 2)
    AS modeled_gross_profit_usd,
  round(
    100.0 * (c.modeled_revenue_usd - c.modeled_cogs_usd)
      / nullif(c.modeled_revenue_usd, 0),
    1
  ) AS modeled_gross_margin_pct
FROM ranked_losses c
LEFT JOIN dim_customer d USING (customer_id)
LEFT JOIN latest_csm l USING (customer_id)
WHERE c.modeled_loss_rank <= 10
ORDER BY c.modeled_loss_rank`

const INNER_JOINED_LOSS_QUEUE_SQL = LOSS_QUEUE_SQL.replace(
  `LEFT JOIN latest_csm l USING (customer_id)`,
  `JOIN latest_csm l USING (customer_id)`,
)

const SUPPORT_SENSITIVITY_SQL = `${COST_MODEL_CTES}, plan_model AS (
  SELECT
    plan_name,
    sum(recognized_revenue_usd) AS modeled_revenue_usd,
    sum(direct_fee_usd + modeled_hosting_cloud_usd) AS fixed_modeled_cogs_usd,
    sum(modeled_support_logo_usd) AS logo_support_usd,
    sum(modeled_support_seat_usd) AS seat_support_usd
  FROM customer_month_model
  GROUP BY plan_name
)
SELECT
  plan_name,
  round(logo_support_usd, 2) AS logo_base_modeled_support_usd,
  round(seat_support_usd, 2) AS seat_alternative_modeled_support_usd,
  round(seat_support_usd - logo_support_usd, 2)
    AS seat_minus_logo_support_usd,
  round(
    100.0 * (modeled_revenue_usd - fixed_modeled_cogs_usd - logo_support_usd)
      / nullif(modeled_revenue_usd, 0),
    1
  ) AS logo_base_modeled_margin_pct,
  round(
    100.0 * (modeled_revenue_usd - fixed_modeled_cogs_usd - seat_support_usd)
      / nullif(modeled_revenue_usd, 0),
    1
  ) AS seat_alternative_modeled_margin_pct
FROM plan_model
ORDER BY plan_name`

const REVERSED_SUPPORT_SENSITIVITY_SQL = SUPPORT_SENSITIVITY_SQL.replace(
  `round(seat_support_usd - logo_support_usd, 2)
    AS seat_minus_logo_support_usd`,
  `round(logo_support_usd - seat_support_usd, 2)
    AS seat_minus_logo_support_usd`,
)

const makeHandoffSql = (csmJoin) => `${COST_MODEL_CTES}, model_summary AS (
  SELECT
    sum(recognized_revenue_usd) AS modeled_revenue_usd,
    sum(direct_fee_usd + modeled_hosting_cloud_usd + modeled_support_logo_usd)
      AS modeled_cost_usd,
    sum(modeled_support_seat_usd - modeled_support_logo_usd)
      AS seat_sensitivity_net_change_usd
  FROM customer_month_model
), customer_model AS (
  SELECT
    customer_id,
    sum(recognized_revenue_usd) AS modeled_revenue_usd,
    sum(direct_fee_usd + modeled_hosting_cloud_usd + modeled_support_logo_usd)
      AS modeled_cogs_usd
  FROM customer_month_model
  GROUP BY customer_id
), plan_sensitivity AS (
  SELECT
    plan_name,
    sum(modeled_support_seat_usd - modeled_support_logo_usd)
      AS seat_minus_logo_support_usd
  FROM customer_month_model
  GROUP BY plan_name
), largest_support_sensitivity AS (
  SELECT plan_name, seat_minus_logo_support_usd
  FROM plan_sensitivity
  QUALIFY row_number() OVER (
    ORDER BY abs(seat_minus_logo_support_usd) DESC, plan_name
  ) = 1
), customer_summary AS (
  SELECT
    count(*)::BIGINT AS modeled_customers,
    count(*) FILTER (
      WHERE modeled_revenue_usd - modeled_cogs_usd < 0
    )::BIGINT AS negative_margin_customers
  FROM customer_model
), latest_csm AS (
  SELECT customer_id, csm_name
  FROM stg_customer_csm_assignments
  WHERE assigned_on <= DATE '2026-06-30'
  QUALIFY row_number() OVER (
    PARTITION BY customer_id
    ORDER BY assigned_on DESC, csm_name
  ) = 1
), loss_rows AS (
  SELECT
    c.customer_id,
    c.modeled_revenue_usd - c.modeled_cogs_usd AS modeled_gp_usd
  FROM customer_model c
), ranked_losses AS (
  SELECT
    *,
    row_number() OVER (
      ORDER BY modeled_gp_usd, customer_id
    ) AS modeled_loss_rank
  FROM loss_rows
), top_ten_summary AS (
  SELECT
    count(*) FILTER (
      WHERE l.csm_name IS NULL
    )::BIGINT AS unassigned_top10_customers
  FROM ranked_losses r
  ${csmJoin} latest_csm l USING (customer_id)
  WHERE r.modeled_loss_rank <= 10
), lowest_modeled_gp AS (
  SELECT r.customer_id, d.customer_name, r.modeled_gp_usd
  FROM ranked_losses r
  LEFT JOIN dim_customer d USING (customer_id)
  WHERE r.modeled_loss_rank = 1
)
SELECT
  round(s.modeled_revenue_usd, 2) AS h1_revenue_usd,
  round(s.modeled_cost_usd, 2) AS h1_modeled_cost_usd,
  round(s.modeled_revenue_usd - s.modeled_cost_usd, 2) AS h1_modeled_gp_usd,
  round(
    100.0 * (s.modeled_revenue_usd - s.modeled_cost_usd)
      / nullif(s.modeled_revenue_usd, 0),
    1
  ) AS h1_modeled_margin_pct,
  c.modeled_customers,
  c.negative_margin_customers,
  t.unassigned_top10_customers,
  l.customer_id AS lowest_modeled_gp_customer_id,
  l.customer_name AS lowest_modeled_gp_customer_name,
  round(l.modeled_gp_usd, 2) AS lowest_modeled_gp_usd,
  p.plan_name AS largest_support_sensitivity_plan,
  round(p.seat_minus_logo_support_usd, 2)
    AS largest_seat_minus_logo_support_usd,
  round(s.seat_sensitivity_net_change_usd, 2)
    AS seat_sensitivity_net_change_usd
FROM model_summary s
CROSS JOIN customer_summary c
CROSS JOIN top_ten_summary t
CROSS JOIN lowest_modeled_gp l
CROSS JOIN largest_support_sensitivity p`

const HANDOFF_SQL = makeHandoffSql(`LEFT JOIN`)
const INNER_CSM_HANDOFF_SQL = makeHandoffSql(`JOIN`)

export const COST_TO_SERVE_REVIEW_MISSIONS = [
  {
    id: 'm146',
    part: 23,
    title: 'Define the cost-to-serve scope',
    from: 'elena',
    ask: `Product and Finance want an H1 cost-to-serve review. Start with the controlled COGS scope before allocating anything: Payment Processing Fees are direct because their GL rows carry customer_id; Hosting Costs and Cloud Ops Compensation are shared and will be modeled by licensed seats; Support Compensation is shared and will be modeled by active customer-months. Keep every shared row even though customer_id is blank.`,
    deliverable: `Four rows: account_id, account_name, cost_treatment, gl_rows, customer_tagged_rows, customer_tag_coverage_pct, and h1_cogs_usd. Use the exact-copy GL identity control, round percent to 1 and dollars to 2, and order by account_id.`,
    tables: ['fct_gl_transactions', 'dim_account'],
    canonical: COST_SCOPE_SQL,
    solutionSql: COST_SCOPE_SQL,
    solutionNote: `The controlled H1 scope is $9,358,614.94 of Hosting Costs, $155,936.55 of customer-tagged Payment Processing Fees, $4,376,627.90 of Support Compensation, and $2,001,655.50 of Cloud Ops Compensation. Only the direct fee rows are customer-tagged; blank customer_id on a shared pool is a reason to allocate deliberately, not a reason to drop it.`,
    ordered: true,
    orderedNote: 'account_id ascending',
    fingerprintSQL: CUSTOMER_TAGGED_ONLY_SCOPE_SQL,
    fingerprintMessage: `You filtered the cost scope to customer-tagged rows and discarded every shared pool. Keep the untagged Hosting, Support, and Cloud Ops GL lines in scope; their missing customer key is exactly why the model needs disclosed drivers.`,
    hints: [
      `Build this like a workbook control tab: deduplicate exact-copy GL lines first, then classify the four account IDs without filtering away blank customer tags.`,
      `The GL identity is every field except synthetic txn_id. Count customer_id for coverage, but never use customer_id IS NOT NULL as the scope definition for shared costs.`,
      COST_SCOPE_SQL,
    ],
    sayIt: `"The H1 cost scope is $15.89 million. Only $156 thousand is directly tagged to customers; the other $15.74 million remains GL truth but becomes modeled customer cost only after disclosed allocation rules."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm147',
    part: 23,
    title: 'Profile the two driver books',
    from: 'priya',
    ask: `Before applying those rules, profile the actual January-through-June customer-month book by plan. Show both candidate exposure bases: one active snapshot row is one customer-month, and seats on that row are licensed seat-months. Do not take June and multiply by six; the book changed during H1.`,
    deliverable: `Three rows: plan_name, months_loaded, active_customer_months, licensed_seat_months, active_customer_month_share_pct, and licensed_seat_month_share_pct. Round shares to 1 and order by plan_name.`,
    tables: ['fct_subscription_snapshot_monthly'],
    canonical: DRIVER_PROFILE_SQL,
    solutionSql: DRIVER_PROFILE_SQL,
    solutionNote: `All plans have six loaded months. Enterprise carries 1,810 active customer-months and 198,781 licensed seat-months; Growth 7,358 and 128,369; Starter 18,886 and 57,005. These are contracted-capacity and logo-exposure bases, not utilization, tickets, or support demand.`,
    ordered: true,
    orderedNote: 'plan_name alphabetically',
    fingerprintSQL: JUNE_TIMES_SIX_DRIVER_SQL,
    fingerprintMessage: `You multiplied June's ending book by six, so both H1 driver populations are overstated and the plan mix is wrong. Aggregate the six loaded snapshot months at their native customer-month grain.`,
    hints: [
      `Treat each snapshot month as a separate workbook column before you total the half. A June ending balance is not six months of exposure.`,
      `Filter month_start with a half-open H1 range, group by plan_name, count rows for customer-months, and sum seats for licensed seat-months.`,
      DRIVER_PROFILE_SQL,
    ],
    sayIt: `"The two driver books tell different stories: Starter is 67.3% of active customer-months but only 14.8% of licensed seat-months. That is a method sensitivity, not evidence of usage or service demand."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm148',
    part: 23,
    title: 'Attach the direct fee lines',
    from: 'elena',
    ask: `Attach direct Payment Processing Fees to the plan that customer held in the fee's service month. Derive service_month from txn_date and join the monthly subscription snapshot on both service_month and customer_id. The same customer can appear in several months, so a customer-only join will fan every fee line across its entire H1 history.`,
    deliverable: `Three rows: plan_name, direct_fee_lines, direct_fee_customer_months, customers_with_direct_fees, and direct_payment_fee_usd. Round dollars to 2 and order by plan_name.`,
    tables: ['fct_gl_transactions', 'fct_subscription_snapshot_monthly'],
    canonical: DIRECT_FEE_JOIN_SQL,
    solutionSql: DIRECT_FEE_JOIN_SQL,
    solutionNote: `The correctly month-matched direct fees sum to $155,936.55 and preserve 15,842 fee lines at 15,842 distinct customer-months. The separate counts keep source-line grain honest even though this fixture happens to have one direct fee line per affected customer-month.`,
    ordered: true,
    orderedNote: 'plan_name alphabetically',
    fingerprintSQL: CUSTOMER_ONLY_DIRECT_FEE_JOIN_SQL,
    fingerprintMessage: `The direct fee total exploded because each fee line joined every H1 snapshot row for the same customer. Add service_month = month_start to the customer key so each line lands in exactly one plan-month.`,
    hints: [
      `Write the join grain in words first: one GL fee line belongs to one customer in one service month. Both keys must appear in ON.`,
      `Deduplicate the GL, derive date_trunc('month', txn_date), filter account 5010, then join the snapshot on month and customer before grouping by plan.`,
      DIRECT_FEE_JOIN_SQL,
    ],
    sayIt: `"I matched $155,936.55 of direct fees at month-and-customer grain. That prevents a returning customer from multiplying one fee across six plan snapshots."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm149',
    part: 23,
    title: 'Allocate the monthly shared pools',
    from: 'priya',
    ask: `Allocate Hosting plus Cloud Ops within each month by licensed seats, and Support within each month by active customer count. Conserve each monthly pool to the cent at customer-month grain: convert the pool to integer cents, use integer quotient and modulo for every driver share, rank the remainders with customer_id as the deterministic tie-breaker, and distribute the remaining pennies before rolling up by plan.`,
    deliverable: `Eighteen plan-month rows: month_start, plan_name, active_customer_months, licensed_seats, modeled_hosting_cloud_usd, modeled_support_usd, hosting_cloud_reconciliation_difference_usd, and support_reconciliation_difference_usd. Round dollars to 2; order by month and plan. Both differences must be zero in every month.`,
    tables: ['fct_gl_transactions', 'fct_subscription_snapshot_monthly'],
    canonical: MONTHLY_ALLOCATION_SQL,
    solutionSql: MONTHLY_ALLOCATION_SQL,
    solutionNote: `All twelve monthly pool controls reconcile to zero: six for the $11,360,270.44 Hosting plus Cloud Ops pool and six for the $4,376,627.90 Support pool. The model distributes cents at customer-month grain before any plan rollup.`,
    ordered: true,
    orderedNote: 'month_start, then plan_name',
    fingerprintSQL: NAIVE_ROUNDED_ALLOCATION_SQL,
    fingerprintMessage: `You independently rounded thousands of raw customer allocations. The plan rows look plausible, but at least one monthly pool no longer ties to the GL. Floor to cents, rank fractional remainders within each month, and award only the exact remaining pennies.`,
    hints: [
      `This is a monthly allocation workbook with two separate penny true-ups. Never true up the half after mixing six changing driver populations.`,
      `For each month and method, base cents are pool_cents * driver_units // total_driver_units; rank the matching modulo remainders, then add one cent to the first N ranks.`,
      MONTHLY_ALLOCATION_SQL,
    ],
    sayIt: `"Every monthly Hosting/Cloud and Support pool ties to the cent. Seats and active logos are transparent allocation bases; neither one is observed utilization or ticket volume."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm150',
    part: 23,
    title: 'Build the plan margin view',
    from: 'elena',
    ask: `Roll the customer-month model to plan. Recognized revenue is only customer-tagged H1 GL in accounts 4000 and 4010; it is not ARR divided by twelve. Keep the direct fee and both shared modeled components visible before calculating total modeled COGS, gross profit, and gross margin.`,
    deliverable: `Three rows: plan_name, modeled_recognized_revenue_usd, modeled_direct_fee_usd, modeled_hosting_cloud_usd, modeled_support_usd, modeled_total_cogs_usd, modeled_gross_profit_usd, and modeled_gross_margin_pct. Round dollars to 2 and margin to 1; order by plan_name.`,
    tables: ['fct_gl_transactions', 'fct_subscription_snapshot_monthly'],
    canonical: PLAN_MARGIN_SQL,
    solutionSql: PLAN_MARGIN_SQL,
    solutionNote: `The logo-support base model assigns $6,157,576.38 of cost to Enterprise at 80.5% modeled margin, $5,067,413.40 to Growth at 41.0%, and $4,667,845.11 to Starter at -147.5%. These are decision-model outputs, not booked customer profitability.`,
    ordered: true,
    orderedNote: 'plan_name alphabetically',
    fingerprintSQL: ARR_PROXY_MARGIN_SQL,
    fingerprintMessage: `You substituted ARR divided by twelve for recognized revenue. ARR is a forward-looking run-rate measure; use the customer-tagged 4000 and 4010 GL lines in each service month for this H1 margin model.`,
    hints: [
      `Build a customer-month fact with recognized GL revenue, direct GL fees, and the two final allocated costs; only then roll it to plan.`,
      `Revenue and direct fees join on month plus customer. Shared allocations already live at customer-month grain. Gross margin is (recognized revenue - modeled COGS) / recognized revenue.`,
      PLAN_MARGIN_SQL,
    ],
    sayIt: `"The base model shows Enterprise at 80.5%, Growth at 41.0%, and Starter at negative 147.5% modeled margin. The result is allocation-sensitive and does not claim actual customer profitability."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm151',
    part: 23,
    title: 'Tie the model back to the GL',
    from: 'priya',
    ask: `Prove that the model neither creates nor loses dollars. Reconcile modeled recognized revenue to customer-tagged accounts 4000 and 4010, and reconcile direct fees, Hosting plus Cloud Ops, Support, and total modeled COGS to their exact H1 GL scopes. Professional Services Revenue is outside this model.`,
    deliverable: `Exactly one row with GL, modeled, and reconciliation-difference columns for recognized revenue, direct fees, Hosting plus Cloud Ops, Support, and total COGS. Round all dollars to 2; every difference must be zero.`,
    tables: ['fct_gl_transactions', 'fct_subscription_snapshot_monthly'],
    canonical: GL_TIE_SQL,
    solutionSql: GL_TIE_SQL,
    solutionNote: `The model ties to $41,988,670.41 of recognized subscription and usage revenue and $15,892,834.89 of scoped COGS. Direct fees are $155,936.55, Hosting plus Cloud Ops $11,360,270.44, and Support $4,376,627.90; every reconciliation difference is $0.00.`,
    ordered: false,
    fingerprintSQL: SUBSCRIPTION_ONLY_GL_TIE_SQL,
    fingerprintMessage: `The GL control omitted Usage Revenue, so its revenue side no longer matches the customer-month model. Restore both scoped recognized-revenue accounts, 4000 and 4010, on the source side.`,
    hints: [
      `Think of this as the workbook's control sheet: one row, source amount, modeled amount, and difference for each component.`,
      `Aggregate the deduplicated GL and the final customer-month model separately, then CROSS JOIN only those one-row controls. Keep account 4020 outside the defined revenue scope.`,
      GL_TIE_SQL,
    ],
    sayIt: `"The model ties exactly to $41.99 million of scoped recognized revenue and $15.89 million of scoped COGS. Allocation changes who carries shared cost; it does not change the controlled total."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm152',
    part: 23,
    title: 'Measure customer margin dispersion',
    from: 'elena',
    ask: `The plan average hides the customer distribution. Aggregate each customer's H1 revenue and modeled cost within plan before calculating its margin, then show the negative-margin count and the 10th, median, and 90th percentile. This is a customer-plan population; the final handoff separately collapses each customer across H1. Do not calculate monthly percentages first and average those ratios.`,
    deliverable: `Three rows: plan_name, modeled_customer_plan_rows, negative_modeled_margin_customers, modeled_margin_p10_pct, modeled_margin_median_pct, and modeled_margin_p90_pct. Round percentiles to 1; order by plan_name.`,
    tables: ['fct_gl_transactions', 'fct_subscription_snapshot_monthly'],
    canonical: CUSTOMER_DISPERSION_SQL,
    solutionSql: CUSTOMER_DISPERSION_SQL,
    solutionNote: `The customer-plan distribution contains 2 negative modeled-margin Enterprise rows, 40 Growth rows, and 3,912 Starter rows. Aggregate dollars before taking the customer ratio so a small month cannot receive the same weight as a large one. A customer that changes plan would appear once in each plan here, while the final handoff counts each H1 customer once.`,
    ordered: true,
    orderedNote: 'plan_name alphabetically',
    fingerprintSQL: AVERAGE_OF_MONTHLY_MARGIN_SQL,
    fingerprintMessage: `You measured customer-month rows and monthly ratios instead of one H1 customer-plan result. Sum each customer's revenue and modeled costs first, calculate one ratio per customer-plan, and only then take counts and percentiles.`,
    hints: [
      `This is a two-step pivot: first one row per plan and customer with summed dollars, then one row per plan with distribution statistics.`,
      `Calculate modeled_margin_pct after the customer-plan GROUP BY. QUANTILE_CONT on those customer ratios gives the plan distribution without weighting every month equally.`,
      CUSTOMER_DISPERSION_SQL,
    ],
    sayIt: `"The average conceals a wide distribution: 2 Enterprise, 40 Growth, and 3,912 Starter customer-plan results are negative in this model. This view is plan-specific; the handoff separately collapses to one H1 row per customer. That routes review, not behavioral or causal diagnosis."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm153',
    part: 23,
    title: 'Route the modeled loss queue',
    from: 'priya',
    ask: `Build the ten most negative H1 modeled gross-profit customer rows for review. Aggregate the full customer history first, label it with the latest plan observed in H1, join the customer name, and left join the latest CSM assignment known by June 30. An unassigned customer must remain in the queue rather than disappear.`,
    deliverable: `Ten rows: customer_id, customer_name, modeled_plan_name, csm_name, modeled_revenue_usd, modeled_cogs_usd, modeled_gross_profit_usd, and modeled_gross_margin_pct. Round dollars to 2 and margin to 1; sort most negative modeled gross profit first, then customer_id.`,
    tables: ['fct_gl_transactions', 'fct_subscription_snapshot_monthly', 'dim_customer', 'stg_customer_csm_assignments'],
    canonical: LOSS_QUEUE_SQL,
    solutionSql: LOSS_QUEUE_SQL,
    solutionNote: `Birchwood Health Collective (C-01183) is the largest modeled loss at -$8,905.44. The queue preserves null CSM assignments so missing ownership remains visible instead of quietly changing the population.`,
    ordered: true,
    orderedNote: 'most negative modeled gross profit, then customer_id',
    fingerprintSQL: INNER_JOINED_LOSS_QUEUE_SQL,
    fingerprintMessage: `The inner CSM join removed unassigned customers before the top-ten ranking. Rank the complete customer model, and use a LEFT JOIN so missing ownership stays visible as data quality rather than becoming a population filter.`,
    hints: [
      `Build the customer economic row before any ownership join. The queue's population must not depend on whether the staging log has a CSM.`,
      `Aggregate model dollars by customer, use ARG_MAX(plan_name, month_start) for the latest observed H1 label, select one as-of CSM row, and LEFT JOIN it before the final sort.`,
      LOSS_QUEUE_SQL,
    ],
    sayIt: `"Birchwood Health Collective is the largest modeled loss at $8.9 thousand. I preserved unassigned rows and treat the queue as a model-review route, not an account-health or CSM-performance scorecard."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm154',
    part: 23,
    title: 'Test the support driver sensitivity',
    from: 'elena',
    ask: `Test one explicit alternative: keep direct fees and Hosting plus Cloud Ops unchanged, but allocate each month's Support pool by licensed seats instead of active customer count. Define the sensitivity as seat-alternative Support minus logo-base Support, preserve the sign, and show both modeled plan margins.`,
    deliverable: `Three rows: plan_name, logo_base_modeled_support_usd, seat_alternative_modeled_support_usd, seat_minus_logo_support_usd, logo_base_modeled_margin_pct, and seat_alternative_modeled_margin_pct. Round dollars to 2 and margins to 1; order by plan_name.`,
    tables: ['fct_gl_transactions', 'fct_subscription_snapshot_monthly'],
    canonical: SUPPORT_SENSITIVITY_SQL,
    solutionSql: SUPPORT_SENSITIVITY_SQL,
    solutionNote: `The seat alternative shifts $2,295,932.07 out of Starter, $1,978,513.92 into Enterprise, and $317,418.15 into Growth. Modeled margins move from -147.5% to -25.8% for Starter, 80.5% to 74.2% for Enterprise, and 41.0% to 37.3% for Growth.`,
    ordered: true,
    orderedNote: 'plan_name alphabetically',
    fingerprintSQL: REVERSED_SUPPORT_SENSITIVITY_SQL,
    fingerprintMessage: `The margin columns are right, but the signed sensitivity is reversed. The requested definition is seat-alternative Support minus logo-base Support; keep that direction explicit.`,
    hints: [
      `Treat this as a workbook scenario toggle. Only the Support driver changes; every other modeled dollar stays fixed.`,
      `Reuse the monthly seat weights with a separate Support penny true-up, aggregate both Support versions by plan, and subtract logo base from seat alternative.`,
      SUPPORT_SENSITIVITY_SQL,
    ],
    sayIt: `"Changing only the Support driver moves $2.30 million out of Starter and $1.98 million into Enterprise. That spread proves the model is policy-sensitive; it does not reveal actual support consumption."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm155',
    part: 23,
    title: 'Package the cost-to-serve handoff',
    from: 'priya',
    ask: `Close the review in one CFO and Product handoff. Keep the controlled H1 revenue, modeled cost, gross profit, and margin; the complete modeled and negative-margin customer populations; unassigned ownership inside the actual top-ten loss queue; the lowest modeled-GP customer; the plan with the largest Support-driver swing; and the net Support cost change under that sensitivity. Reduce every source to one row before combining it.`,
    deliverable: `Exactly one row: h1_revenue_usd, h1_modeled_cost_usd, h1_modeled_gp_usd, h1_modeled_margin_pct, modeled_customers, negative_margin_customers, unassigned_top10_customers, lowest_modeled_gp_customer_id, lowest_modeled_gp_customer_name, lowest_modeled_gp_usd, largest_support_sensitivity_plan, largest_seat_minus_logo_support_usd, and seat_sensitivity_net_change_usd. Round dollars to 2 and margin to 1.`,
    tables: ['fct_gl_transactions', 'fct_subscription_snapshot_monthly', 'dim_customer', 'stg_customer_csm_assignments'],
    canonical: HANDOFF_SQL,
    solutionSql: HANDOFF_SQL,
    solutionNote: `The handoff contains $41,988,670.41 of H1 revenue, $15,892,834.89 of modeled cost, $26,095,835.52 of modeled GP, and 62.1% modeled margin across 5,649 customers. It keeps all 3,954 negative-margin customers, shows 7 unassigned rows in the top-ten loss queue, identifies C-01183 Birchwood Health Collective at -$8,905.44, and carries Starter's -$2,295,932.07 Support-driver swing while proving the company total remains $0.00.`,
    ordered: false,
    fingerprintSQL: INNER_CSM_HANDOFF_SQL,
    fingerprintMessage: `The handoff built its top-ten queue after an inner CSM join, hiding seven unassigned customers and changing the review population. Rank the complete customer model and left join ownership so unassigned rows remain visible.`,
    hints: [
      `Make one-row controls for model totals, the complete customer population, the top-ten queue, the lowest modeled-GP row, and the largest absolute plan sensitivity. Only CROSS JOIN after each source is reduced.`,
      `Rank modeled GP before inspecting ownership, LEFT JOIN the as-of CSM and customer name, and preserve both the largest signed plan swing and the company-wide net change.`,
      HANDOFF_SQL,
    ],
    sayIt: `"The base model ties to $41.99 million of H1 revenue and $15.89 million of modeled cost, for 62.1% margin. The loss queue preserves seven unassigned customers. Starter carries a $2.30 million Support-driver swing, while the company total stays zero because the sensitivity only redistributes cost."`,
    jdCompanies: ['Datadog'],
  },
]
