// Net/gross ARR retention review — a Star67 operating-review arc (part 28).
// Walk the H1 2026 ARR bridge by movement type, compute gross and net dollar
// retention, isolate cohort churn and plan concentration, read monthly cadence,
// and package a Customer Success + Finance handoff. Distinct from the m43-m49
// Q2 gross-retention council (single-quarter gross view) and the m100-m108
// event-ledger data controls (loaded-data integrity, not retention rates).
//
// Audited H1 2026 truth (fct_arr_movements Jan 1 – Jun 30, snapshots Dec 2025 / Jun 2026):
//   new          1,420 events  +15,079,009.84
//   expansion      338 events  + 2,251,926.66
//   reactivation    23 events  +    37,966.56
//   contraction     89 events  -   282,635.24
//   churn          909 events  - 5,739,636.86
//   starting ARR (Dec 2025) 63,323,218.35  / 4,335 customers
//   ending ARR   (Jun 2026) 74,669,849.31  / 4,869 customers
//   churned customers' Dec-2025 ARR 5,426,050.68
//   gross dollar retention 91.43% ; net dollar retention 94.46%
//   churn by plan: Enterprise -3,309,332.86 (16) / Growth -1,510,123.75 (132) / Starter -920,180.25 (761)

const ARR_BRIDGE_BY_TYPE_SQL = `SELECT movement_type,
  count(*) AS events,
  round(sum(arr_delta_usd), 2) AS arr_delta_usd
FROM fct_arr_movements
WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01'
GROUP BY movement_type
ORDER BY arr_delta_usd DESC`

const ARR_BRIDGE_GROUPED_TRAP_SQL = `SELECT
  CASE WHEN movement_type IN ('new','reactivation') THEN 'inflow' ELSE 'change' END AS flow_class,
  count(*) AS events,
  round(sum(arr_delta_usd), 2) AS arr_delta_usd
FROM fct_arr_movements
WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01'
GROUP BY flow_class
ORDER BY arr_delta_usd DESC`

const GROSS_NET_RETENTION_SQL = `WITH starting AS (
  SELECT round(sum(arr_usd), 2) AS starting_arr
  FROM fct_subscription_snapshot_monthly
  WHERE month_start = DATE '2025-12-01'
), expansion AS (
  SELECT round(sum(arr_delta_usd), 2) AS expansion_arr
  FROM fct_arr_movements
  WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01'
    AND movement_type = 'expansion'
), contraction AS (
  SELECT round(sum(arr_delta_usd), 2) AS contraction_arr
  FROM fct_arr_movements
  WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01'
    AND movement_type = 'contraction'
), churn AS (
  SELECT round(sum(arr_delta_usd), 2) AS churned_arr
  FROM fct_arr_movements
  WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01'
    AND movement_type = 'churn'
)
SELECT round(starting_arr, 2) AS starting_arr_usd,
  round(expansion_arr, 2) AS expansion_arr_usd,
  round(contraction_arr, 2) AS contraction_arr_usd,
  round(churned_arr, 2) AS churned_arr_usd,
  round(100.0 * (starting_arr + contraction_arr + churned_arr) / nullif(starting_arr, 0), 2) AS gross_dollar_retention_pct,
  round(100.0 * (starting_arr + expansion_arr + contraction_arr + churned_arr) / nullif(starting_arr, 0), 2) AS net_dollar_retention_pct
FROM starting CROSS JOIN expansion CROSS JOIN contraction CROSS JOIN churn`

const RETENTION_DELTA_NOT_ARR_TRAP_SQL = `WITH starting AS (
  SELECT round(sum(arr_usd), 2) AS starting_arr
  FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2025-12-01'
), ending AS (
  SELECT round(sum(arr_usd), 2) AS ending_arr
  FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'
), expansion AS (
  SELECT round(sum(arr_delta_usd), 2) AS expansion_arr
  FROM fct_arr_movements WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01' AND movement_type = 'expansion'
), contraction AS (
  SELECT round(sum(arr_delta_usd), 2) AS contraction_arr
  FROM fct_arr_movements WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01' AND movement_type = 'contraction'
), churn AS (
  SELECT round(sum(arr_delta_usd), 2) AS churned_arr
  FROM fct_arr_movements WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01' AND movement_type = 'churn'
)
SELECT round(starting_arr, 2) AS starting_arr_usd,
  round(expansion_arr, 2) AS expansion_arr_usd,
  round(contraction_arr, 2) AS contraction_arr_usd,
  round(churned_arr, 2) AS churned_arr_usd,
  round(100.0 * ending_arr / nullif(starting_arr, 0), 2) AS gross_dollar_retention_pct,
  round(100.0 * ending_arr / nullif(starting_arr, 0), 2) AS net_dollar_retention_pct
FROM starting CROSS JOIN ending CROSS JOIN expansion CROSS JOIN contraction CROSS JOIN churn`

const CHURN_PLAN_CONCENTRATION_SQL = `SELECT plan_name,
  count(*) AS churn_events,
  round(sum(arr_delta_usd), 2) AS lost_arr_usd,
  round(100.0 * sum(arr_delta_usd) / sum(sum(arr_delta_usd)) OVER (), 2) AS lost_arr_share_pct
FROM fct_arr_movements
WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01'
  AND movement_type = 'churn'
GROUP BY plan_name
ORDER BY lost_arr_usd`

const CHURN_EVENTS_NOT_ARR_TRAP_SQL = `SELECT plan_name,
  count(*) AS churn_events,
  round(sum(arr_delta_usd), 2) AS lost_arr_usd,
  round(100.0 * count(*) / sum(count(*)) OVER (), 2) AS lost_arr_share_pct
FROM fct_arr_movements
WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01'
  AND movement_type = 'churn'
GROUP BY plan_name
ORDER BY lost_arr_usd`

const MONTHLY_CHURN_CADENCE_SQL = `SELECT date_trunc('month', event_date)::DATE AS month_start,
  count(*) AS churn_events,
  round(sum(arr_delta_usd), 2) AS lost_arr_usd
FROM fct_arr_movements
WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01'
  AND movement_type = 'churn'
GROUP BY 1
ORDER BY 1`

const MONTHLY_CHURN_CUMULATIVE_TRAP_SQL = `WITH monthly AS (
  SELECT date_trunc('month', event_date)::DATE AS month_start,
    count(*) AS churn_events,
    round(sum(arr_delta_usd), 2) AS lost_arr_usd
  FROM fct_arr_movements
  WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01'
    AND movement_type = 'churn'
  GROUP BY 1
)
SELECT month_start,
  sum(churn_events) OVER (ORDER BY month_start) AS churn_events,
  sum(lost_arr_usd) OVER (ORDER BY month_start) AS lost_arr_usd
FROM monthly
ORDER BY month_start`

const NEW_VS_REACTIVATION_SQL = `SELECT movement_type,
  count(*) AS events,
  count(DISTINCT customer_id) AS customers,
  round(sum(arr_delta_usd), 2) AS arr_added_usd
FROM fct_arr_movements
WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01'
  AND movement_type IN ('new', 'reactivation')
GROUP BY movement_type
ORDER BY arr_added_usd DESC`

const NEW_REACTIVATION_MERGED_TRAP_SQL = `SELECT 'added' AS movement_type,
  count(*) AS events,
  count(DISTINCT customer_id) AS customers,
  round(sum(arr_delta_usd), 2) AS arr_added_usd
FROM fct_arr_movements
WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01'
  AND movement_type IN ('new', 'reactivation')`

const EXPANSION_CONTRACTION_NET_SQL = `SELECT movement_type,
  count(*) AS events,
  count(DISTINCT customer_id) AS customers,
  round(sum(arr_delta_usd), 2) AS arr_delta_usd
FROM fct_arr_movements
WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01'
  AND movement_type IN ('expansion', 'contraction')
GROUP BY movement_type
ORDER BY arr_delta_usd DESC`

const EXPANSION_CONTRACTION_ABS_TRAP_SQL = `SELECT movement_type,
  count(*) AS events,
  count(DISTINCT customer_id) AS customers,
  round(sum(abs(arr_delta_usd)), 2) AS arr_delta_usd
FROM fct_arr_movements
WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01'
  AND movement_type IN ('expansion', 'contraction')
GROUP BY movement_type
ORDER BY arr_delta_usd DESC`

const TOP_CHURNED_CUSTOMERS_SQL = `WITH churned AS (
  SELECT customer_id, plan_name,
    round(arr_before_usd, 2) AS arr_before_usd,
    event_date
  FROM fct_arr_movements
  WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01'
    AND movement_type = 'churn'
), ranked AS (
  SELECT customer_id, plan_name, arr_before_usd, event_date,
    row_number() OVER (ORDER BY arr_before_usd DESC, customer_id) AS loss_rank
  FROM churned
)
SELECT customer_id, plan_name, arr_before_usd, event_date
FROM ranked
WHERE loss_rank <= 10
ORDER BY loss_rank`

const TOP_CHURNED_ABS_DELTA_TRAP_SQL = `WITH churned AS (
  SELECT customer_id, plan_name,
    round(arr_delta_usd, 2) AS arr_delta_usd,
    event_date
  FROM fct_arr_movements
  WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01'
    AND movement_type = 'churn'
), ranked AS (
  SELECT customer_id, plan_name, arr_delta_usd, event_date,
    row_number() OVER (ORDER BY arr_delta_usd DESC, customer_id) AS loss_rank
  FROM churned
)
SELECT customer_id, plan_name, arr_delta_usd, event_date
FROM ranked
WHERE loss_rank <= 10
ORDER BY loss_rank`

const RETENTION_HANDOFF_SQL = `WITH bridge AS (
  SELECT
    round(sum(CASE WHEN movement_type = 'new' THEN arr_delta_usd ELSE 0 END), 2) AS new_arr,
    round(sum(CASE WHEN movement_type = 'expansion' THEN arr_delta_usd ELSE 0 END), 2) AS expansion_arr,
    round(sum(CASE WHEN movement_type = 'reactivation' THEN arr_delta_usd ELSE 0 END), 2) AS reactivation_arr,
    round(sum(CASE WHEN movement_type = 'contraction' THEN arr_delta_usd ELSE 0 END), 2) AS contraction_arr,
    round(sum(CASE WHEN movement_type = 'churn' THEN arr_delta_usd ELSE 0 END), 2) AS churn_arr
  FROM fct_arr_movements
  WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01'
), starting AS (
  SELECT round(sum(arr_usd), 2) AS starting_arr, count(*) AS starting_customers
  FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2025-12-01'
), ending AS (
  SELECT round(sum(arr_usd), 2) AS ending_arr, count(*) AS ending_customers
  FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'
), enterprise_churn AS (
  SELECT round(sum(arr_delta_usd), 2) AS enterprise_lost_arr
  FROM fct_arr_movements
  WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01'
    AND movement_type = 'churn' AND plan_name = 'Enterprise'
)
SELECT
  round(starting.starting_arr, 2) AS starting_arr_usd,
  round(ending.ending_arr, 2) AS ending_arr_usd,
  starting.starting_customers AS starting_customers,
  ending.ending_customers AS ending_customers,
  round(bridge.new_arr, 2) AS new_arr_usd,
  round(bridge.expansion_arr, 2) AS expansion_arr_usd,
  round(bridge.contraction_arr, 2) AS contraction_arr_usd,
  round(bridge.churn_arr, 2) AS churn_arr_usd,
  round(100.0 * (starting.starting_arr + bridge.contraction_arr + bridge.churn_arr) / nullif(starting.starting_arr, 0), 2) AS gross_dollar_retention_pct,
  round(100.0 * (starting.starting_arr + bridge.expansion_arr + bridge.contraction_arr + bridge.churn_arr) / nullif(starting.starting_arr, 0), 2) AS net_dollar_retention_pct,
  round(enterprise_churn.enterprise_lost_arr, 2) AS enterprise_churn_lost_usd
FROM bridge CROSS JOIN starting CROSS JOIN ending CROSS JOIN enterprise_churn`

const HANDOFF_EVENT_COUNT_RETENTION_TRAP_SQL = `WITH bridge AS (
  SELECT
    round(sum(CASE WHEN movement_type = 'new' THEN arr_delta_usd ELSE 0 END), 2) AS new_arr,
    round(sum(CASE WHEN movement_type = 'expansion' THEN arr_delta_usd ELSE 0 END), 2) AS expansion_arr,
    round(sum(CASE WHEN movement_type = 'contraction' THEN arr_delta_usd ELSE 0 END), 2) AS contraction_arr,
    round(sum(CASE WHEN movement_type = 'churn' THEN arr_delta_usd ELSE 0 END), 2) AS churn_arr,
    count(CASE WHEN movement_type = 'churn' THEN 1 END) AS churn_events,
    count(CASE WHEN movement_type = 'expansion' THEN 1 END) AS expansion_events
  FROM fct_arr_movements
  WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01'
), starting AS (
  SELECT round(sum(arr_usd), 2) AS starting_arr, count(*) AS starting_customers
  FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2025-12-01'
), ending AS (
  SELECT round(sum(arr_usd), 2) AS ending_arr, count(*) AS ending_customers
  FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'
), enterprise_churn AS (
  SELECT round(sum(arr_delta_usd), 2) AS enterprise_lost_arr
  FROM fct_arr_movements
  WHERE event_date >= DATE '2026-01-01' AND event_date < DATE '2026-07-01'
    AND movement_type = 'churn' AND plan_name = 'Enterprise'
)
SELECT
  round(starting.starting_arr, 2) AS starting_arr_usd,
  round(ending.ending_arr, 2) AS ending_arr_usd,
  starting.starting_customers AS starting_customers,
  ending.ending_customers AS ending_customers,
  round(bridge.new_arr, 2) AS new_arr_usd,
  round(bridge.expansion_arr, 2) AS expansion_arr_usd,
  round(bridge.contraction_arr, 2) AS contraction_arr_usd,
  round(bridge.churn_arr, 2) AS churn_arr_usd,
  round(100.0 * (starting.starting_customers - bridge.churn_events) / nullif(starting.starting_customers, 0), 2) AS gross_dollar_retention_pct,
  round(100.0 * (starting.starting_customers + bridge.expansion_events - bridge.churn_events) / nullif(starting.starting_customers, 0), 2) AS net_dollar_retention_pct,
  round(enterprise_churn.enterprise_lost_arr, 2) AS enterprise_churn_lost_usd
FROM bridge CROSS JOIN starting CROSS JOIN ending CROSS JOIN enterprise_churn`

export const ARR_RETENTION_REVIEW_MISSIONS = [
  {
    id: 'm188',
    part: 28,
    title: 'Walk the H1 ARR bridge by movement type',
    from: 'fin',
    ask: `Open the H1 2026 ARR review by walking the bridge: for each movement_type in fct_arr_movements (Jan 1 – Jun 30), count the events and sum the signed ARR delta. Order by delta descending so the largest dollar movers lead. This is the directional map leadership reads first — where ARR came from and where it went.`,
    deliverable: `Five rows ordered by arr_delta_usd descending: movement_type, events, arr_delta_usd. Round dollars to 2 decimals.`,
    tables: ['fct_arr_movements'],
    canonical: ARR_BRIDGE_BY_TYPE_SQL,
    solutionSql: ARR_BRIDGE_BY_TYPE_SQL,
    solutionNote: `H1 2026 ARR moved $11.35M net positive. New logos added $15.08M, expansion added $2.25M, and reactivation added $38K; contraction removed $283K and churn removed $5.74M. The signed delta is the directional truth; it is not cash collected, bookings, or recognized revenue.`,
    ordered: true,
    orderedNote: 'arr_delta_usd descending',
    fingerprintSQL: ARR_BRIDGE_GROUPED_TRAP_SQL,
    fingerprintMessage: `You collapsed new+reactivation into one "inflow" class and expansion/contraction/churn into "change", hiding the five distinct movement types leadership reviews. Keep each movement_type as its own row so the bridge reads new, expansion, reactivation, contraction, churn separately.`,
    hints: [
      `Filter fct_arr_movements to the H1 2026 event_date window, group by movement_type, and sum the signed arr_delta_usd.`,
      `Order by arr_delta_usd descending so the largest dollar movers (new, expansion) lead and the negatives (churn, contraction) trail. Count(*) gives the event volume per type.`,
      ARR_BRIDGE_BY_TYPE_SQL,
    ],
    sayIt: `"H1 ARR moved $11.35 million net positive: $15.08 million of new logos, $2.25 million of expansion, and $38 thousand of reactivation, minus $283 thousand of contraction and $5.74 million of churn. The signed delta is directional ARR, not cash or recognized revenue."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm189',
    part: 28,
    title: 'Compute gross and net dollar retention',
    from: 'fin',
    ask: `Convert the bridge into the two rates leadership tracks. Gross dollar retention measures how much of the starting book survived (excluding new logos and expansion); net dollar retention adds expansion back in. Both use the December 2025 snapshot as the starting denominator and the H1 contraction + churn deltas (negative) as the loss. The starting-customer expansion is the only positive inside net retention beyond the base.`,
    deliverable: `Exactly one row: starting_arr_usd, expansion_arr_usd, contraction_arr_usd, churned_arr_usd, gross_dollar_retention_pct, net_dollar_retention_pct. Round dollars and percent to 2 decimals.`,
    tables: ['fct_arr_movements', 'fct_subscription_snapshot_monthly'],
    canonical: GROSS_NET_RETENTION_SQL,
    solutionSql: GROSS_NET_RETENTION_SQL,
    solutionNote: `Starting ARR (Dec 2025) is $63.32M. Gross dollar retention is 91.43% — the starting book less contraction and churn over starting. Net dollar retention is 94.46% — gross plus expansion over starting. New logos and reactivation are excluded from both because they are not the existing book. These are ARR-based retention rates, not logo counts or cash.`,
    ordered: false,
    fingerprintSQL: RETENTION_DELTA_NOT_ARR_TRAP_SQL,
    fingerprintMessage: `You computed both retention rates as ending_arr / starting_arr, which folds new logos and reactivation into gross retention and makes gross equal net. Gross retention excludes new and reactivation; only contraction and churn reduce the starting book, and only expansion is added back for net.`,
    hints: [
      `Pull starting_arr from the December 2025 snapshot (sum of arr_usd). Pull expansion, contraction, and churn deltas from the H1 movement window by movement_type.`,
      `Gross retention = 100 * (starting + contraction + churn) / starting, where contraction and churn deltas are negative. Net retention adds the positive expansion delta: 100 * (starting + expansion + contraction + churn) / starting. New and reactivation are excluded from both.`,
      GROSS_NET_RETENTION_SQL,
    ],
    sayIt: `"Gross dollar retention is 91.43% and net dollar retention is 94.46% on the December starting book of $63.32 million. New logos and reactivation are excluded from both; only expansion is added back for net. These are ARR rates, not logo or cash retention."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm190',
    part: 28,
    title: 'Isolate churn concentration by plan',
    from: 'fin',
    ask: `Churn removed $5.74M of H1 ARR. Where did it concentrate? Isolate H1 churn events by plan_name with the lost ARR and each plan's share of total churned ARR. This surfaces whether the dollar loss tracks the event count or whether a low-event plan carries disproportionate dollars — different renewal conversations.`,
    deliverable: `Three rows ordered by lost_arr_usd (most negative first, i.e. largest loss): plan_name, churn_events, lost_arr_usd, lost_arr_share_pct. Round dollars and percent to 2 decimals.`,
    tables: ['fct_arr_movements'],
    canonical: CHURN_PLAN_CONCENTRATION_SQL,
    solutionSql: CHURN_PLAN_CONCENTRATION_SQL,
    solutionNote: `Enterprise churn is $3.31M from only 16 events — 57.7% of churned ARR dollars — while Starter churned 761 events for just $920K (16.0%). The dollar loss concentrates in Enterprise despite the event volume sitting in Starter. Share is measured against churned ARR dollars, not event counts.`,
    ordered: true,
    orderedNote: 'lost_arr_usd ascending (largest negative = largest loss first)',
    fingerprintSQL: CHURN_EVENTS_NOT_ARR_TRAP_SQL,
    fingerprintMessage: `You computed each plan's churn share as its share of churn events, not churned ARR dollars. Starter has 761 of 909 events (84%) but only 16% of the dollars; event share hides where the money actually left. Weight by sum(arr_delta_usd), not count(*).`,
    hints: [
      `Filter to movement_type = 'churn' and the H1 window; group by plan_name; sum the negative arr_delta_usd as lost_arr.`,
      `Share is 100 * plan lost_arr / sum of all plans' lost_arr — a window over the grouped result. Order by lost_arr_usd so the largest dollar loss leads.`,
      CHURN_PLAN_CONCENTRATION_SQL,
    ],
    sayIt: `"Enterprise churned $3.31 million from just 16 events — 58% of the lost dollars — while Starter churned 761 events for only $920 thousand. The money concentrates in Enterprise even though the volume is in Starter. Share is by ARR dollars, not events."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm191',
    part: 28,
    title: 'Read the monthly churn cadence',
    from: 'fin',
    ask: `Was H1 churn steady or spiky? Read churn events and lost ARR by month across H1 2026. A flat cadence suggests systematic attrition; a spike points at a specific month to investigate. Show each calendar month separately — do not accumulate.`,
    deliverable: `Six rows ordered by month_start ascending: month_start, churn_events, lost_arr_usd. Round dollars to 2 decimals.`,
    tables: ['fct_arr_movements'],
    canonical: MONTHLY_CHURN_CADENCE_SQL,
    solutionSql: MONTHLY_CHURN_CADENCE_SQL,
    solutionNote: `H1 churn ran 129 to 173 events per month with no single spike — a steady attrition cadence rather than a one-month event. The monthly lost ARR tracks the event count. This is a cadence read, not a cohort survival curve or a seasonality claim.`,
    ordered: true,
    orderedNote: 'month_start ascending',
    fingerprintSQL: MONTHLY_CHURN_CUMULATIVE_TRAP_SQL,
    fingerprintMessage: `You accumulated churn with a running window sum, so each month shows all prior months stacked on top. The cadence read needs each month standing alone — no OVER() running aggregate — so leadership sees the per-month rate.`,
    hints: [
      `Truncate event_date to month, filter to churn in the H1 window, group by month, and count events plus sum the lost ARR.`,
      `Do not accumulate: no running window. Each month is its own row. Order by month_start ascending.`,
      MONTHLY_CHURN_CADENCE_SQL,
    ],
    sayIt: `"H1 churn ran 129 to 173 events a month with no single spike — a steady attrition cadence, not a one-month event. The monthly lost ARR tracks the event count. This is a cadence read, not a survival curve."`,
    jdCompanies: ['Stripe'],
  },
  {
    id: 'm192',
    part: 28,
    title: 'Separate new logos from reactivations',
    from: 'fin',
    ask: `Both new and reactivation add ARR, but they are different motions: a new logo is a first-time customer, a reactivation is a customer who churned and came back. Separate them for H1 2026: events, distinct customers, and added ARR per movement_type. Mixing them hides the true new-logo contribution.`,
    deliverable: `Two rows ordered by arr_added_usd descending: movement_type, events, customers, arr_added_usd. Round dollars to 2 decimals.`,
    tables: ['fct_arr_movements'],
    canonical: NEW_VS_REACTIVATION_SQL,
    solutionSql: NEW_VS_REACTIVATION_SQL,
    solutionNote: `H1 added $15.08M from 1,420 new-logo events across 1,420 customers, versus $38K from 23 reactivations. New logos carry virtually all the inflow; reactivations are immaterial this half. A new-logo ARR figure that includes reactivation would overstate net-new acquisition by the reactivation amount.`,
    ordered: true,
    orderedNote: 'arr_added_usd descending',
    fingerprintSQL: NEW_REACTIVATION_MERGED_TRAP_SQL,
    fingerprintMessage: `You merged new and reactivation into one "added" row, which folds returning customers into net-new acquisition and overstates new-logo ARR. Keep movement_type separate so the new-logo contribution reads on its own.`,
    hints: [
      `Filter to movement_type IN ('new','reactivation') and the H1 window; group by movement_type.`,
      `Count events and distinct customers, sum the positive arr_delta_usd as arr_added. Order by arr_added descending so new logos lead.`,
      NEW_VS_REACTIVATION_SQL,
    ],
    sayIt: `"H1 added $15.08 million from 1,420 new logos and only $38 thousand from 23 reactivations. New logos carry virtually all the inflow. A merged 'added' figure would overstate net-new acquisition."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm193',
    part: 28,
    title: 'Net expansion against contraction',
    from: 'fin',
    ask: `Within the existing book, expansion and contraction are the two sides of seat-and-plan movement. Read both for H1 2026: events, distinct customers, and signed ARR delta per movement_type. The signed delta matters — expansion is positive, contraction is negative — so netting them requires preserving the sign.`,
    deliverable: `Two rows ordered by arr_delta_usd descending: movement_type, events, customers, arr_delta_usd. Round dollars to 2 decimals.`,
    tables: ['fct_arr_movements'],
    canonical: EXPANSION_CONTRACTION_NET_SQL,
    solutionSql: EXPANSION_CONTRACTION_NET_SQL,
    solutionNote: `H1 expansion added $2.25M across 338 customers while contraction removed $283K across 89 customers — a net $1.97M positive from the existing book's seat movement. The signed delta preserves direction; taking absolute values would erase the loss and overstate net expansion.`,
    ordered: true,
    orderedNote: 'arr_delta_usd descending',
    fingerprintSQL: EXPANSION_CONTRACTION_ABS_TRAP_SQL,
    fingerprintMessage: `You summed abs(arr_delta_usd), which makes contraction read as a positive and erases the net expansion effect. Preserve the sign: expansion is positive and contraction is negative, so their sum is the net seat-movement delta.`,
    hints: [
      `Filter to movement_type IN ('expansion','contraction') and the H1 window; group by movement_type.`,
      `Sum the signed arr_delta_usd (do not take abs). Count events and distinct customers. Order by arr_delta_usd descending so expansion leads.`,
      EXPANSION_CONTRACTION_NET_SQL,
    ],
    sayIt: `"H1 expansion added $2.25 million across 338 customers and contraction removed $283 thousand across 89 — a net $1.97 million positive from seat movement. The signed delta preserves the direction; absolute values would erase the loss."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm194',
    part: 28,
    title: 'Route the top ten churned customers',
    from: 'danny',
    ask: `Customer Success needs a bounded review queue: the ten churned customers with the largest pre-churn ARR, with their plan and churn date. Rank by the ARR the customer carried just before churning (arr_before_usd), not by the delta — the delta and the before-ARR are the same for a full churn, but arr_before_usd is the explicit "what we lost" figure.`,
    deliverable: `Exactly ten rows ordered by loss_rank ascending: customer_id, plan_name, arr_before_usd, event_date. Round dollars to 2 decimals.`,
    tables: ['fct_arr_movements'],
    canonical: TOP_CHURNED_CUSTOMERS_SQL,
    solutionSql: TOP_CHURNED_CUSTOMERS_SQL,
    solutionNote: `The top-ten churned customers by pre-churn ARR anchor the renewal review; Enterprise customers dominate the top of the queue because their per-customer ARR dwarfs Starter. This is a review queue ranked by dollars at risk, not a survival analysis or a churn-cause attribution.`,
    ordered: true,
    orderedNote: 'loss_rank ascending (largest arr_before_usd first)',
    fingerprintSQL: TOP_CHURNED_ABS_DELTA_TRAP_SQL,
    fingerprintMessage: `You ranked by arr_delta_usd descending, but for churn the delta is negative — so descending puts the smallest losses first and buries the largest. Rank by arr_before_usd (the pre-churn ARR) descending, or equivalently by the delta ascending, so the largest dollars-at-risk lead.`,
    hints: [
      `Filter to movement_type = 'churn' and the H1 window. The pre-churn ARR is arr_before_usd.`,
      `Rank by arr_before_usd descending with a deterministic tiebreaker on customer_id; filter to rank <= 10. Order by the rank.`,
      TOP_CHURNED_CUSTOMERS_SQL,
    ],
    sayIt: `"Here are the ten churned customers with the largest pre-churn ARR — Enterprise dominates the top because per-customer ARR dwarfs Starter. It's a dollars-at-risk review queue, not a survival analysis or a cause attribution."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm195',
    part: 28,
    title: 'Package the ARR retention handoff',
    from: 'fin',
    ask: `Close the review in one Customer Success + Finance handoff. Carry the starting and ending ARR and customer counts, the four in-book movements (new, expansion, contraction, churn), gross and net dollar retention, and the Enterprise churn anchor that flags where the dollar loss concentrated. Reduce each control to one row before combining.`,
    deliverable: `Exactly one row: starting_arr_usd, ending_arr_usd, starting_customers, ending_customers, new_arr_usd, expansion_arr_usd, contraction_arr_usd, churn_arr_usd, gross_dollar_retention_pct, net_dollar_retention_pct, enterprise_churn_lost_usd. Round dollars and percent to 2 decimals.`,
    tables: ['fct_arr_movements', 'fct_subscription_snapshot_monthly'],
    canonical: RETENTION_HANDOFF_SQL,
    solutionSql: RETENTION_HANDOFF_SQL,
    solutionNote: `The H1 retention handoff: starting ARR $63.32M (4,335 customers) grew to $74.67M (4,869) on $15.08M new, $2.25M expansion, -$283K contraction, and -$5.74M churn. Gross dollar retention is 91.43%, net is 94.46%, and Enterprise churn anchored $3.31M of the loss. This is an ARR retention handoff — not cash, recognized revenue, logo-count retention, or a renewal forecast.`,
    ordered: false,
    fingerprintSQL: HANDOFF_EVENT_COUNT_RETENTION_TRAP_SQL,
    fingerprintMessage: `Your retention rates use customer counts (starting_customers minus churn_events) instead of ARR dollars, which is logo retention not dollar retention — a different metric. Dollar retention uses starting_arr with the contraction and churn ARR deltas; save the customer counts as color, not the denominator.`,
    hints: [
      `Build one-row bridge (conditional sums by movement_type), starting (Dec 2025 snapshot), ending (Jun 2026 snapshot), and Enterprise-churn controls. CROSS JOIN only those reduced single-row outputs.`,
      `Gross retention = 100 * (starting_arr + contraction + churn) / starting_arr; net adds expansion. New and reactivation stay out of both rates but appear as their own handoff columns.`,
      RETENTION_HANDOFF_SQL,
    ],
    sayIt: `"H1 retention handoff: $63.32 million grew to $74.67 million, gross retention 91.43%, net 94.46%, with $3.31 million of Enterprise churn anchoring the loss. This is an ARR retention handoff — not cash, recognized revenue, logo retention, or a renewal forecast."`,
    jdCompanies: ['Stripe'],
  },
]
