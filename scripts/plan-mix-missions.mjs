// Customer-segment / plan-mix ARR review — a Star67 operating-review arc (part 34).
// An arc over fct_subscription_snapshot_monthly by plan_name measuring plan-segment ARR
// mix, per-plan net movement, segment economics, and value-vs-volume concentration,
// distinct from m188-195 (ARR movement-type flows) and m215 (top-N concentration).
//
// Audited June 2026 truth:
//   Enterprise: 325 customers, $55,833,003.59 ARR (74.77% share, $171,793.86 avg)
//   Growth: 1,289 customers, $14,934,086.47 ARR (20.00% share, $11,585.79 avg)
//   Starter: 3,255 customers, $3,902,759.25 ARR (5.23% share, $1,199.00 avg)
// H1 2026 net movement by plan: Enterprise +$8.91M / Growth +$2.05M / Starter +$384K

const PLAN_SEGMENT_BOUNDARY_SQL = `SELECT plan_name,
  count(*) AS customers,
  round(sum(arr_usd), 2) AS total_arr_usd,
  round(avg(arr_usd), 2) AS avg_arr_per_customer_usd,
  round(100.0 * sum(arr_usd) / sum(sum(arr_usd)) OVER (), 2) AS arr_share_pct
FROM fct_subscription_snapshot_monthly
WHERE month_start = DATE '2026-06-01'
GROUP BY plan_name
ORDER BY total_arr_usd DESC`

const PLAN_SEGMENT_CUSTOMER_SHARE_TRAP_SQL = `SELECT plan_name,
  count(*) AS customers,
  round(sum(arr_usd), 2) AS total_arr_usd,
  round(avg(arr_usd), 2) AS avg_arr_per_customer_usd,
  round(100.0 * count(*) / sum(count(*)) OVER (), 2) AS arr_share_pct
FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'
GROUP BY plan_name ORDER BY total_arr_usd DESC`

const PLAN_NET_MOVEMENT_SQL = `SELECT plan_name,
  round(sum(CASE WHEN movement_type = 'new' THEN arr_delta_usd ELSE 0 END), 2) AS new_arr_usd,
  round(sum(CASE WHEN movement_type = 'expansion' THEN arr_delta_usd ELSE 0 END), 2) AS expansion_arr_usd,
  round(sum(CASE WHEN movement_type = 'contraction' THEN arr_delta_usd ELSE 0 END), 2) AS contraction_arr_usd,
  round(sum(CASE WHEN movement_type = 'churn' THEN arr_delta_usd ELSE 0 END), 2) AS churn_arr_usd,
  round(sum(arr_delta_usd), 2) AS net_arr_delta_usd
FROM fct_arr_movements
WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01'
GROUP BY plan_name
ORDER BY net_arr_delta_usd DESC`

const PLAN_NET_MOVEMENT_ABS_TRAP_SQL = `SELECT plan_name,
  round(sum(CASE WHEN movement_type = 'new' THEN arr_delta_usd ELSE 0 END), 2) AS new_arr_usd,
  round(sum(CASE WHEN movement_type = 'expansion' THEN arr_delta_usd ELSE 0 END), 2) AS expansion_arr_usd,
  round(sum(abs(CASE WHEN movement_type = 'contraction' THEN arr_delta_usd ELSE 0 END)), 2) AS contraction_arr_usd,
  round(sum(abs(CASE WHEN movement_type = 'churn' THEN arr_delta_usd ELSE 0 END)), 2) AS churn_arr_usd,
  round(sum(arr_delta_usd), 2) AS net_arr_delta_usd
FROM fct_arr_movements WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01'
GROUP BY plan_name ORDER BY net_arr_delta_usd DESC`

const VALUE_VS_VOLUME_SQL = `WITH segment AS (
  SELECT plan_name,
    count(*) AS customers,
    sum(arr_usd) AS arr
  FROM fct_subscription_snapshot_monthly
  WHERE month_start = DATE '2026-06-01'
  GROUP BY plan_name
)
SELECT plan_name,
  customers,
  round(100.0 * customers / sum(customers) OVER (), 2) AS customer_share_pct,
  round(arr, 2) AS total_arr_usd,
  round(100.0 * arr / sum(arr) OVER (), 2) AS arr_share_pct,
  round(100.0 * arr / sum(arr) OVER () - 100.0 * customers / sum(customers) OVER (), 2) AS value_minus_volume_pp
FROM segment
ORDER BY total_arr_usd DESC`

const VALUE_VS_VOLUME_DROP_GAP_TRAP_SQL = `WITH segment AS (
  SELECT plan_name, count(*) AS customers, sum(arr_usd) AS arr
  FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01' GROUP BY plan_name
)
SELECT plan_name, customers,
  round(100.0 * customers / sum(customers) OVER (), 2) AS customer_share_pct,
  round(arr, 2) AS total_arr_usd,
  round(100.0 * arr / sum(arr) OVER (), 2) AS arr_share_pct,
  round(0, 2) AS value_minus_volume_pp
FROM segment ORDER BY total_arr_usd DESC`

const PLAN_CHURN_RATE_SQL = `WITH june AS (
  SELECT plan_name, count(*) AS june_customers, sum(arr_usd) AS june_arr
  FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01' GROUP BY 1
), h1_churn AS (
  SELECT plan_name,
    count(*) AS churn_events,
    round(sum(arr_delta_usd), 2) AS churned_arr
  FROM fct_arr_movements
  WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01' AND movement_type = 'churn'
  GROUP BY 1
)
SELECT j.plan_name,
  j.june_customers,
  c.churn_events,
  round(100.0 * c.churn_events / nullif(j.june_customers, 0), 2) AS logo_churn_rate_pct,
  c.churned_arr
FROM june j JOIN h1_churn c ON j.plan_name = c.plan_name
ORDER BY logo_churn_rate_pct DESC`

const PLAN_CHURN_RATE_ARR_CHURN_TRAP_SQL = `WITH june AS (
  SELECT plan_name, count(*) AS june_customers, sum(arr_usd) AS june_arr
  FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01' GROUP BY 1
), h1_churn AS (
  SELECT plan_name, count(*) AS churn_events, round(sum(arr_delta_usd), 2) AS churned_arr
  FROM fct_arr_movements WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01' AND movement_type = 'churn' GROUP BY 1
)
SELECT j.plan_name, j.june_customers, c.churn_events,
  round(100.0 * c.churned_arr / nullif(j.june_arr, 0), 2) AS logo_churn_rate_pct,
  c.churned_arr
FROM june j JOIN h1_churn c ON j.plan_name = c.plan_name ORDER BY logo_churn_rate_pct DESC`

const PLAN_SEGMENT_TREND_SQL = `SELECT date_trunc('month', month_start)::DATE AS month_start,
  plan_name,
  round(sum(arr_usd), 2) AS monthly_arr_usd
FROM fct_subscription_snapshot_monthly
WHERE month_start >= DATE '2026-01-01' AND month_start < DATE '2026-07-01'
GROUP BY 1, 2
ORDER BY month_start, plan_name`

const PLAN_SEGMENT_TREND_SINGLE_MONTH_TRAP_SQL = `SELECT date_trunc('month', month_start)::DATE AS month_start,
  plan_name,
  round(sum(arr_usd), 2) AS monthly_arr_usd
FROM fct_subscription_snapshot_monthly
WHERE month_start = DATE '2026-06-01'
GROUP BY 1, 2
ORDER BY month_start, plan_name`

const PLAN_MIX_HANDOFF_SQL = `WITH segment AS (
  SELECT plan_name,
    count(*) AS customers,
    round(sum(arr_usd), 2) AS arr
  FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01' GROUP BY 1
), ent AS (
  SELECT customers AS ent_customers, arr AS ent_arr FROM segment WHERE plan_name = 'Enterprise'
), net AS (
  SELECT plan_name, round(sum(arr_delta_usd), 2) AS net_delta FROM fct_arr_movements
  WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01' AND plan_name = 'Enterprise' GROUP BY 1
), total AS (
  SELECT round(sum(arr_usd), 2) AS total_arr, count(*) AS total_customers FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'
)
SELECT
  total.total_arr AS june_total_arr_usd,
  total.total_customers AS june_total_customers,
  ent.ent_arr AS enterprise_arr_usd,
  round(100.0 * ent.ent_arr / nullif(total.total_arr, 0), 2) AS enterprise_arr_share_pct,
  ent.ent_customers AS enterprise_customers,
  round(100.0 * ent.ent_customers / nullif(total.total_customers, 0), 2) AS enterprise_customer_share_pct,
  net.net_delta AS enterprise_h1_net_delta_usd
FROM ent CROSS JOIN net CROSS JOIN total`

const PLAN_MIX_HANDOFF_DROP_ENTERPRISE_TRAP_SQL = `WITH total AS (
  SELECT round(sum(arr_usd), 2) AS total_arr, count(*) AS total_customers FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'
), net AS (
  SELECT round(0, 2) AS net_delta
)
SELECT total.total_arr AS june_total_arr_usd, total.total_customers AS june_total_customers,
  round(0, 2) AS enterprise_arr_usd, round(0, 2) AS enterprise_arr_share_pct,
  0 AS enterprise_customers, round(0, 2) AS enterprise_customer_share_pct,
  net.net_delta AS enterprise_h1_net_delta_usd
FROM net CROSS JOIN total`

export const PLAN_MIX_MISSIONS = [
  {
    id: 'm231',
    part: 34,
    title: 'Set the plan-segment ARR boundary',
    from: 'maria',
    ask: `Open the plan-segment review with the boundary: for each plan_name in the June 2026 snapshot, count customers, sum ARR, compute average ARR per customer, and each plan's share of total ARR. This shows how the book breaks down by segment — the foundation for every later plan read.`,
    deliverable: `Three rows ordered by total_arr_usd descending: plan_name, customers, total_arr_usd, avg_arr_per_customer_usd, arr_share_pct. Round dollars and percent to 2 decimals.`,
    tables: ['fct_subscription_snapshot_monthly'],
    canonical: PLAN_SEGMENT_BOUNDARY_SQL,
    solutionSql: PLAN_SEGMENT_BOUNDARY_SQL,
    solutionNote: `The June 2026 book splits into three segments: Enterprise carries $55.83M (74.8% of ARR) from only 325 customers at $171,794 average; Growth carries $14.93M (20.0%) from 1,289 at $11,586; Starter carries $3.90M (5.2%) from 3,255 at $1,199. Enterprise dominates ARR despite being the smallest customer cohort — the value-versus-volume gap is extreme. This is an ARR segment boundary, not revenue or cash.`,
    ordered: true,
    orderedNote: 'total_arr_usd descending',
    fingerprintSQL: PLAN_SEGMENT_CUSTOMER_SHARE_TRAP_SQL,
    fingerprintMessage: `You computed arr_share_pct as the customer-count share, so Enterprise reads as ~7% instead of ~75% — the opposite of where the ARR sits. Weight the share by sum(arr_usd), not count(*), so it reflects where the dollars actually are.`,
    hints: [
      `Filter the snapshot to June 2026; group by plan_name. Count customers and sum arr_usd.`,
      `Average ARR is sum(arr_usd) / count(*). Share is 100 * plan ARR / total ARR via a window. Order by ARR descending.`,
      PLAN_SEGMENT_BOUNDARY_SQL,
    ],
    sayIt: `"Enterprise carries $55.83 million — 75% of ARR — from only 325 customers at $172 thousand average. Growth and Starter carry the rest. Enterprise dominates ARR despite being the smallest customer cohort. This is an ARR segment boundary, not revenue or cash."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm232',
    part: 34,
    title: 'Read the H1 net ARR movement by plan',
    from: 'fin',
    ask: `Which segment drove H1 ARR growth? For each plan, sum the signed deltas by movement type (new, expansion, contraction, churn) and compute the net. The net per plan shows where the half's ARR growth concentrated — and whether each segment's churn offset its acquisition.`,
    deliverable: `Three rows ordered by net_arr_delta_usd descending: plan_name, new_arr_usd, expansion_arr_usd, contraction_arr_usd, churn_arr_usd, net_arr_delta_usd. Round dollars to 2 decimals.`,
    tables: ['fct_arr_movements'],
    canonical: PLAN_NET_MOVEMENT_SQL,
    solutionSql: PLAN_NET_MOVEMENT_SQL,
    solutionNote: `Enterprise drove the largest H1 net ARR gain (~$8.91M): $10.66M new plus $1.68M expansion minus $132K contraction and $3.31M churn. Growth netted ~$2.05M and Starter ~$384K. Enterprise's churn is large in dollars but its acquisition dwarfs it. This is signed-ARR movement by segment, not cash or recognized revenue.`,
    ordered: true,
    orderedNote: 'net_arr_delta_usd descending',
    fingerprintSQL: PLAN_NET_MOVEMENT_ABS_TRAP_SQL,
    fingerprintMessage: `You took abs() of the contraction and churn deltas, turning negatives positive and corrupting both the per-type columns and the net. Preserve the sign — contraction and churn are negative — so the net is the true signed sum.`,
    hints: [
      `Filter movements to H1 2026; group by plan_name. Use conditional sums for each movement_type.`,
      `Net is sum(arr_delta_usd) across all types (signed). Order by net descending so the largest-growth segment leads.`,
      PLAN_NET_MOVEMENT_SQL,
    ],
    sayIt: `"Enterprise drove the largest H1 net ARR gain — about $8.91 million — with $10.66 million of new logos offsetting $3.31 million of churn. Growth netted $2.05 million and Starter $384 thousand. This is signed ARR movement by segment, not cash or recognized revenue."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm233',
    part: 34,
    title: 'Measure the value-versus-volume gap by plan',
    from: 'fin',
    ask: `The defining segment insight: how does each plan's customer-count share compare to its ARR share? For each plan, show customers, customer share, ARR, ARR share, and the difference (arr_share_pct minus customer_share_pct) in points. A large positive gap means a plan carries disproportionate ARR per customer; a negative gap means many small accounts.`,
    deliverable: `Three rows ordered by total_arr_usd descending: plan_name, customers, customer_share_pct, total_arr_usd, arr_share_pct, value_minus_volume_pp. Round dollars and percent/points to 2 decimals.`,
    tables: ['fct_subscription_snapshot_monthly'],
    canonical: VALUE_VS_VOLUME_SQL,
    solutionSql: VALUE_VS_VOLUME_SQL,
    solutionNote: `Enterprise's value-minus-volume gap is the largest positive — it carries about 75% of ARR from about 7% of customers, a ~68-point gap. Starter's gap is deeply negative — about 70% of customers but only 5% of ARR. Growth sits between. The gap quantifies the concentration of value versus headcount that defines the segment strategy. This is an ARR-vs-logo concentration read, not revenue or cash.`,
    ordered: true,
    orderedNote: 'total_arr_usd descending',
    fingerprintSQL: VALUE_VS_VOLUME_DROP_GAP_TRAP_SQL,
    fingerprintMessage: `You zeroed out the value_minus_volume_pp column, dropping the concentration signal that is the point of the comparison. Compute arr_share_pct minus customer_share_pct so the gap quantifies how disproportionate each segment's value is relative to its volume.`,
    hints: [
      `Aggregate per plan: count customers and sum ARR. Compute both shares via windows over the grouped result.`,
      `The value-minus-volume gap is arr_share_pct minus customer_share_pct, in points. Order by ARR descending.`,
      VALUE_VS_VOLUME_SQL,
    ],
    sayIt: `"Enterprise carries about 75% of ARR from 7% of customers — a 68-point value-versus-volume gap. Starter is the inverse: 70% of customers, 5% of ARR. The gap quantifies the concentration that defines the segment strategy. This is an ARR-vs-logo read, not revenue or cash."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm234',
    part: 34,
    title: 'Read the logo churn rate by plan',
    from: 'fin',
    ask: `Which segment churns the most logos? Compute the H1 churn events per plan against the June 2026 customer count, giving the logo churn rate (churn events / June customers). The plan with the highest rate loses the largest share of its logo base, even if the dollar churn is smaller.`,
    deliverable: `Three rows ordered by logo_churn_rate_pct descending: plan_name, june_customers, churn_events, logo_churn_rate_pct, churned_arr. Round percent to 2 decimals and dollars to 2.`,
    tables: ['fct_subscription_snapshot_monthly', 'fct_arr_movements'],
    canonical: PLAN_CHURN_RATE_SQL,
    solutionSql: PLAN_CHURN_RATE_SQL,
    solutionNote: `Growth has the highest H1 logo churn rate (132 churn events against 1,289 June customers), followed by Starter (761 against 3,255); Enterprise's rate is lowest (16 against 325). Dollar churn is largest for Enterprise despite the lowest logo rate, because each Enterprise logo carries far more ARR. This is a logo-rate read, not dollar retention or a survival curve.`,
    ordered: true,
    orderedNote: 'logo_churn_rate_pct descending',
    fingerprintSQL: PLAN_CHURN_RATE_ARR_CHURN_TRAP_SQL,
    fingerprintMessage: `You computed the churn rate as churned_arr / june_arr (a dollar churn rate) and labeled it logo_churn_rate_pct, mixing dollars into a logo-count metric. Logo churn is churn events / customer count; keep the dollar churn in its own column.`,
    hints: [
      `Count June customers per plan from the snapshot; count H1 churn events per plan from movements (movement_type = 'churn'). Join on plan_name.`,
      `Logo churn rate is 100 * churn_events / june_customers, null-guarded. Carry churned_arr as a separate column. Order by the rate descending.`,
      PLAN_CHURN_RATE_SQL,
    ],
    sayIt: `"Growth has the highest logo churn rate — 132 events against 1,289 customers — followed by Starter. Enterprise's rate is lowest, but its dollar churn is largest because each logo carries far more ARR. This is a logo-rate read, not dollar retention."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm235',
    part: 34,
    title: 'Read the monthly ARR trend by plan',
    from: 'fin',
    ask: `Is each segment growing month over month? For each H1 2026 month and plan, show the monthly ARR total. The trend shows whether each segment expands steadily, plateaus, or declines across the half — the cadence behind the segment net.`,
    deliverable: `Rows ordered by month_start then plan_name: month_start, plan_name, monthly_arr_usd. Round dollars to 2 decimals. (Expect 18 rows: 6 months × 3 plans.)`,
    tables: ['fct_subscription_snapshot_monthly'],
    canonical: PLAN_SEGMENT_TREND_SQL,
    solutionSql: PLAN_SEGMENT_TREND_SQL,
    solutionNote: `Each segment's monthly ARR trends upward across H1 2026, with Enterprise carrying the steepest absolute growth (its per-month ARR is largest and rising). Growth and Starter also trend positive but at smaller scale. This is a monthly-ARR cadence by segment, not cash or a forecast.`,
    ordered: true,
    orderedNote: 'month_start then plan_name',
    fingerprintSQL: PLAN_SEGMENT_TREND_SINGLE_MONTH_TRAP_SQL,
    fingerprintMessage: `You filtered to a single month (June only), so the trend reads as one snapshot per plan rather than a six-month cadence. Remove the single-month filter so every H1 month appears and the trend is visible.`,
    hints: [
      `Filter the snapshot to H1 2026 month_start; group by month_start and plan_name.`,
      `Sum arr_usd per month per plan. Order by month_start then plan_name so the trend reads chronologically within each segment.`,
      PLAN_SEGMENT_TREND_SQL,
    ],
    sayIt: `"Each segment's monthly ARR trends upward across H1, with Enterprise carrying the steepest absolute growth. Growth and Starter also trend positive but at smaller scale. This is a monthly-ARR cadence by segment, not cash or a forecast."`,
    jdCompanies: ['Stripe'],
  },
  {
    id: 'm236',
    part: 34,
    title: 'Package the plan-mix segment handoff',
    from: 'maria',
    ask: `Close the segment review in one Finance + Customer Success handoff. Carry the June total ARR and total customers; the Enterprise ARR, ARR share, customers, and customer share (the value-vs-volume anchor); and the Enterprise H1 net ARR delta (the growth driver). Reduce each control to one row before combining.`,
    deliverable: `Exactly one row: june_total_arr_usd, june_total_customers, enterprise_arr_usd, enterprise_arr_share_pct, enterprise_customers, enterprise_customer_share_pct, enterprise_h1_net_delta_usd. Round dollars and percent to 2 decimals.`,
    tables: ['fct_subscription_snapshot_monthly', 'fct_arr_movements'],
    canonical: PLAN_MIX_HANDOFF_SQL,
    solutionSql: PLAN_MIX_HANDOFF_SQL,
    solutionNote: `The segment handoff: June total ARR $74.67M across 4,869 customers; Enterprise carries $55.83M (74.8% share) from 325 customers (6.7% share) and drove ~$8.91M of H1 net ARR delta. The Enterprise value-versus-volume concentration (75% of ARR from 7% of customers) is the segment story leadership reviews. This is an ARR segment handoff — not cash, recognized revenue, a forecast, or a retention claim.`,
    ordered: false,
    fingerprintSQL: PLAN_MIX_HANDOFF_DROP_ENTERPRISE_TRAP_SQL,
    fingerprintMessage: `Your handoff zeroes out the Enterprise ARR, customers, and net delta, dropping the segment anchor that is the point of the handoff. Carry the real Enterprise figures so leadership sees the value-versus-volume concentration and the growth driver.`,
    hints: [
      `Build one-row controls: total ARR + customers (June snapshot), Enterprise ARR + customers (filtered to plan_name = 'Enterprise'), and Enterprise H1 net delta (filtered movements). CROSS JOIN.`,
      `Shares are 100 * Enterprise / total for both ARR and customers. Net delta is the signed sum of Enterprise movement deltas in H1.`,
      PLAN_MIX_HANDOFF_SQL,
    ],
    sayIt: `"June total ARR is $74.67 million across 4,869 customers. Enterprise carries $55.83 million — 75% of ARR — from 325 customers, 7% of the base, and drove $8.91 million of H1 net growth. The value-versus-volume concentration is the segment story. This is an ARR segment handoff, not cash, revenue, a forecast, or a retention claim."`,
    jdCompanies: ['Figma'],
  },
]
