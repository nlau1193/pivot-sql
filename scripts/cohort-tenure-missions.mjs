// Customer-tenure / cohort-LTV review — a Star67 operating-review arc (part 32).
// An arc from fct_arr_movements + dim_customer + snapshot measuring acquisition cohorts,
// survival, and net cohort retention, distinct from m109-117 lifecycle council
// (age-normalized maturity). Seven decisions: define acquisition cohorts, opening ARR,
// survival curve, veteran-cohort net retention, expansion-vs-churn decomposition, cohort
// size trend, and a handoff.
//
// Audited truth (first 'new' event per customer = acquisition):
//   cohorts by year: 2021 (572, $5.47M) / 2022 (1187, $9.46M) / 2023 (1726, $14.87M)
//     / 2024 (2150, $18.49M) / 2025 (2445, $22.77M) / 2026 (1420, $15.08M)
//   survival to June 2026: 2021 20.63% / 2022 23.50% / 2023 32.97% / 2024 46.28%
//     / 2025 66.05% / 2026 91.06% (declining curve with cohort age)
//   2021 cohort: opened $5,472,661.73 -> June-2026 survivors $5,194,433.20 (~95.0% net)

const ACQUISITION_COHORTS_SQL = `WITH first_new AS (
  SELECT customer_id,
    min(event_date) AS first_event,
    date_trunc('year', min(event_date))::DATE AS cohort_year
  FROM fct_arr_movements
  WHERE movement_type = 'new'
  GROUP BY customer_id
), opening AS (
  SELECT m.customer_id, m.arr_after_usd AS opening_arr
  FROM fct_arr_movements m
  JOIN first_new f ON m.customer_id = f.customer_id AND m.event_date = f.first_event
)
SELECT f.cohort_year,
  count(*) AS customers_acquired,
  round(sum(o.opening_arr), 2) AS opening_arr_usd,
  round(sum(o.opening_arr) / nullif(count(*), 0), 2) AS avg_opening_arr_usd
FROM first_new f
JOIN opening o ON f.customer_id = o.customer_id
GROUP BY f.cohort_year
ORDER BY f.cohort_year`

const ACQUISITION_COHORTS_ALL_MOVEMENTS_TRAP_SQL = `WITH firsts AS (
  SELECT customer_id, date_trunc('year', min(event_date))::DATE AS cohort_year
  FROM fct_arr_movements GROUP BY 1
), opening AS (
  SELECT customer_id, round(sum(arr_after_usd), 2) AS opening_arr
  FROM fct_arr_movements GROUP BY 1
)
SELECT f.cohort_year, count(*) AS customers_acquired,
  round(sum(o.opening_arr), 2) AS opening_arr_usd,
  round(sum(o.opening_arr) / nullif(count(*), 0), 2) AS avg_opening_arr_usd
FROM firsts f JOIN opening o USING(customer_id) GROUP BY 1 ORDER BY 1`

const COHORT_SURVIVAL_SQL = `WITH first_new AS (
  SELECT customer_id,
    date_trunc('year', min(event_date))::DATE AS cohort_year
  FROM fct_arr_movements
  WHERE movement_type = 'new'
  GROUP BY customer_id
), june AS (
  SELECT DISTINCT customer_id
  FROM fct_subscription_snapshot_monthly
  WHERE month_start = DATE '2026-06-01'
)
SELECT f.cohort_year,
  count(*) AS customers_acquired,
  count(j.customer_id) AS survived_to_june,
  round(100.0 * count(j.customer_id) / nullif(count(*), 0), 2) AS survival_pct
FROM first_new f
LEFT JOIN june j ON f.customer_id = j.customer_id
GROUP BY f.cohort_year
ORDER BY f.cohort_year`

const COHORT_SURVIVAL_EXPANSION_TRAP_SQL = `WITH first_new AS (
  SELECT customer_id, date_trunc('year', min(event_date))::DATE AS cohort_year
  FROM fct_arr_movements WHERE movement_type = 'new' GROUP BY 1
), june AS (
  SELECT DISTINCT customer_id FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-03-01'
)
SELECT f.cohort_year, count(*) AS customers_acquired, count(j.customer_id) AS survived_to_june,
  round(100.0 * count(j.customer_id) / nullif(count(*), 0), 2) AS survival_pct
FROM first_new f LEFT JOIN june j ON f.customer_id = j.customer_id GROUP BY 1 ORDER BY 1`

const VETERAN_COHORT_NET_RETENTION_SQL = `WITH cohort_customers AS (
  SELECT DISTINCT customer_id
  FROM fct_arr_movements
  WHERE movement_type = 'new' AND event_date < DATE '2022-01-01'
), opening AS (
  SELECT round(sum(arr_after_usd), 2) AS opening_arr
  FROM fct_arr_movements
  WHERE movement_type = 'new' AND event_date < DATE '2022-01-01'
), current_arr AS (
  SELECT round(sum(s.arr_usd), 2) AS current_arr
  FROM fct_subscription_snapshot_monthly s
  JOIN cohort_customers c ON s.customer_id = c.customer_id
  WHERE s.month_start = DATE '2026-06-01'
)
SELECT
  round(opening.opening_arr, 2) AS opening_arr_usd,
  round(current_arr.current_arr, 2) AS current_arr_usd,
  round(100.0 * current_arr.current_arr / nullif(opening.opening_arr, 0), 2) AS net_cohort_retention_pct,
  round(current_arr.current_arr - opening.opening_arr, 2) AS net_arr_change_usd
FROM opening CROSS JOIN current_arr`

const VETERAN_COHORT_ALL_CUSTOMERS_TRAP_SQL = `WITH opening AS (
  SELECT round(sum(arr_after_usd), 2) AS opening_arr
  FROM fct_arr_movements WHERE movement_type = 'new' AND event_date < DATE '2022-01-01'
), current_arr AS (
  SELECT round(sum(arr_usd), 2) AS current_arr
  FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'
)
SELECT round(opening.opening_arr, 2) AS opening_arr_usd, round(current_arr.current_arr, 2) AS current_arr_usd,
  round(100.0 * current_arr.current_arr / nullif(opening.opening_arr, 0), 2) AS net_cohort_retention_pct,
  round(current_arr.current_arr - opening.opening_arr, 2) AS net_arr_change_usd
FROM opening CROSS JOIN current_arr`

const COHORT_EXPANSION_CHURN_SQL = `WITH cohort_customers AS (
  SELECT DISTINCT customer_id
  FROM fct_arr_movements
  WHERE movement_type = 'new' AND event_date < DATE '2022-01-01'
), movements AS (
  SELECT movement_type,
    round(sum(arr_delta_usd), 2) AS arr_delta_usd,
    count(*) AS events
  FROM fct_arr_movements m
  JOIN cohort_customers c ON m.customer_id = c.customer_id
  WHERE m.event_date >= DATE '2022-01-01'
  GROUP BY movement_type
)
SELECT movement_type,
  events,
  arr_delta_usd
FROM movements
ORDER BY arr_delta_usd DESC`

const COHORT_EXPANSION_CHURN_ABS_TRAP_SQL = `WITH cohort_customers AS (
  SELECT DISTINCT customer_id FROM fct_arr_movements WHERE movement_type = 'new' AND event_date < DATE '2022-01-01'
), movements AS (
  SELECT movement_type, round(sum(abs(arr_delta_usd)), 2) AS arr_delta_usd, count(*) AS events
  FROM fct_arr_movements m JOIN cohort_customers c ON m.customer_id = c.customer_id
  WHERE m.event_date >= DATE '2022-01-01' GROUP BY 1
)
SELECT movement_type, events, arr_delta_usd FROM movements ORDER BY arr_delta_usd DESC`

const COHORT_SIZE_TREND_SQL = `WITH first_new AS (
  SELECT customer_id,
    date_trunc('year', min(event_date))::DATE AS cohort_year
  FROM fct_arr_movements
  WHERE movement_type = 'new'
  GROUP BY customer_id
)
SELECT cohort_year,
  count(*) AS customers_acquired,
  round(100.0 * (count(*) - lag(count(*)) OVER (ORDER BY cohort_year)) / nullif(lag(count(*)) OVER (ORDER BY cohort_year), 0), 2) AS yoy_growth_pct
FROM first_new
GROUP BY cohort_year
ORDER BY cohort_year`

const COHORT_SIZE_TREND_CUMULATIVE_TRAP_SQL = `WITH first_new AS (
  SELECT customer_id, date_trunc('year', min(event_date))::DATE AS cohort_year
  FROM fct_arr_movements WHERE movement_type = 'new' GROUP BY 1
), per_year AS (
  SELECT cohort_year, count(*) AS yearly_acquired FROM first_new GROUP BY 1
), cumulative AS (
  SELECT cohort_year, sum(yearly_acquired) OVER (ORDER BY cohort_year) AS customers_acquired
  FROM per_year
), with_prior AS (
  SELECT cohort_year, customers_acquired,
    lag(customers_acquired) OVER (ORDER BY cohort_year) AS prior_cumulative
  FROM cumulative
)
SELECT cohort_year,
  customers_acquired,
  round(100.0 * (customers_acquired - prior_cumulative) / nullif(prior_cumulative, 0), 2) AS yoy_growth_pct
FROM with_prior ORDER BY cohort_year`

const COHORT_HANDOFF_SQL = `WITH first_new AS (
  SELECT customer_id, date_trunc('year', min(event_date))::DATE AS cohort_year
  FROM fct_arr_movements WHERE movement_type = 'new' GROUP BY customer_id
), june AS (
  SELECT DISTINCT customer_id FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'
), opening AS (
  SELECT round(sum(arr_after_usd), 2) AS opening_arr
  FROM fct_arr_movements WHERE movement_type = 'new' AND event_date < DATE '2022-01-01'
), current_arr AS (
  SELECT round(sum(s.arr_usd), 2) AS current_arr
  FROM fct_subscription_snapshot_monthly s
  JOIN (SELECT DISTINCT customer_id FROM fct_arr_movements WHERE movement_type = 'new' AND event_date < DATE '2022-01-01') c ON s.customer_id = c.customer_id
  WHERE s.month_start = DATE '2026-06-01'
), v2021 AS (
  SELECT count(*) AS opened FROM first_new WHERE cohort_year = DATE '2021-01-01'
), v2021_surv AS (
  SELECT count(j.customer_id) AS survived
  FROM first_new f LEFT JOIN june j ON f.customer_id = j.customer_id
  WHERE f.cohort_year = DATE '2021-01-01'
), latest AS (
  SELECT count(*) AS opened FROM first_new WHERE cohort_year = DATE '2026-01-01'
), latest_surv AS (
  SELECT count(j.customer_id) AS survived
  FROM first_new f LEFT JOIN june j ON f.customer_id = j.customer_id
  WHERE f.cohort_year = DATE '2026-01-01'
)
SELECT
  v2021.opened AS v2021_opened,
  v2021_surv.survived AS v2021_survived,
  round(100.0 * v2021_surv.survived / nullif(v2021.opened, 0), 2) AS v2021_survival_pct,
  round(opening.opening_arr, 2) AS v2021_opening_arr_usd,
  round(current_arr.current_arr, 2) AS v2021_current_arr_usd,
  round(100.0 * current_arr.current_arr / nullif(opening.opening_arr, 0), 2) AS v2021_net_retention_pct,
  latest.opened AS v2026_opened,
  latest_surv.survived AS v2026_survived,
  round(100.0 * latest_surv.survived / nullif(latest.opened, 0), 2) AS v2026_survival_pct
FROM v2021 CROSS JOIN v2021_surv CROSS JOIN opening CROSS JOIN current_arr CROSS JOIN latest CROSS JOIN latest_surv`

const COHORT_HANDOFF_DROP_CURRENT_TRAP_SQL = `WITH first_new AS (
  SELECT customer_id, date_trunc('year', min(event_date))::DATE AS cohort_year
  FROM fct_arr_movements WHERE movement_type = 'new' GROUP BY customer_id
), june AS (
  SELECT DISTINCT customer_id FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'
), opening AS (
  SELECT round(sum(arr_after_usd), 2) AS opening_arr
  FROM fct_arr_movements WHERE movement_type = 'new' AND event_date < DATE '2022-01-01'
), current_arr AS (
  SELECT round(0, 2) AS current_arr
), v2021 AS (
  SELECT count(*) AS opened FROM first_new WHERE cohort_year = DATE '2021-01-01'
), v2021_surv AS (
  SELECT count(j.customer_id) AS survived FROM first_new f LEFT JOIN june j ON f.customer_id = j.customer_id WHERE f.cohort_year = DATE '2021-01-01'
), latest AS (
  SELECT count(*) AS opened FROM first_new WHERE cohort_year = DATE '2026-01-01'
), latest_surv AS (
  SELECT count(j.customer_id) AS survived FROM first_new f LEFT JOIN june j ON f.customer_id = j.customer_id WHERE f.cohort_year = DATE '2026-01-01'
)
SELECT v2021.opened AS v2021_opened, v2021_surv.survived AS v2021_survived,
  round(100.0 * v2021_surv.survived / nullif(v2021.opened, 0), 2) AS v2021_survival_pct,
  round(opening.opening_arr, 2) AS v2021_opening_arr_usd, round(current_arr.current_arr, 2) AS v2021_current_arr_usd,
  round(100.0 * current_arr.current_arr / nullif(opening.opening_arr, 0), 2) AS v2021_net_retention_pct,
  latest.opened AS v2026_opened, latest_surv.survived AS v2026_survived,
  round(100.0 * latest_surv.survived / nullif(latest.opened, 0), 2) AS v2026_survival_pct
FROM v2021 CROSS JOIN v2021_surv CROSS JOIN opening CROSS JOIN current_arr CROSS JOIN latest CROSS JOIN latest_surv`

export const COHORT_TENURE_MISSIONS = [
  {
    id: 'm218',
    part: 32,
    title: 'Define the acquisition cohorts',
    from: 'fin',
    ask: `Open the cohort review by defining acquisition cohorts: each customer's cohort year is the year of their first 'new' movement. For each cohort year, count customers acquired and sum their opening ARR (arr_after_usd on that first event), with the average opening ARR per customer. This is the foundation every later cohort read builds on.`,
    deliverable: `Six rows ordered by cohort_year ascending: cohort_year, customers_acquired, opening_arr_usd, avg_opening_arr_usd. Round dollars to 2 decimals.`,
    tables: ['fct_arr_movements'],
    canonical: ACQUISITION_COHORTS_SQL,
    solutionSql: ACQUISITION_COHORTS_SQL,
    solutionNote: `Acquisition grows cohort over cohort: 572 customers in 2021 rising to 2,445 in 2025, with 1,420 already in 2026 (partial year). Average opening ARR per customer varies by cohort. A cohort is defined by the first 'new' movement only — expansion, contraction, and churn events on existing customers do not redefine their cohort.`,
    ordered: true,
    orderedNote: 'cohort_year ascending',
    fingerprintSQL: ACQUISITION_COHORTS_ALL_MOVEMENTS_TRAP_SQL,
    fingerprintMessage: `You assigned each customer's cohort from their earliest event of any movement type, so a customer whose first recorded event is an expansion (not a new-logo) gets miscategorized. Define cohort from the first movement_type = 'new' event only, so each cohort captures genuine acquisition.`,
    hints: [
      `Find each customer's first 'new' event (min event_date where movement_type='new'); cohort_year is the year of that date.`,
      `Opening ARR is arr_after_usd on that first event. Group by cohort_year; count customers and sum opening ARR.`,
      ACQUISITION_COHORTS_SQL,
    ],
    sayIt: `"Acquisition grows cohort over cohort — 572 customers in 2021 rising to 2,445 in 2025. A cohort is defined by the first new-logo event only; later movements don't redefine it. This is the foundation for the survival and retention reads."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm219',
    part: 32,
    title: 'Read the cohort survival curve to June 2026',
    from: 'fin',
    ask: `How many customers from each acquisition cohort are still active in June 2026? For each cohort year, count customers acquired, count how many appear in the June 2026 snapshot, and compute the survival percent. The curve should decline with cohort age — older cohorts have had more time to churn.`,
    deliverable: `Six rows ordered by cohort_year ascending: cohort_year, customers_acquired, survived_to_june, survival_pct. Round percent to 2 decimals.`,
    tables: ['fct_arr_movements', 'fct_subscription_snapshot_monthly'],
    canonical: COHORT_SURVIVAL_SQL,
    solutionSql: COHORT_SURVIVAL_SQL,
    solutionNote: `The survival curve declines cleanly with cohort age: the 2021 cohort retains about 20.6% to June 2026, rising to 91.1% for the 2026 cohort (most of which is only months old). This is logo survival (a customer is present or absent), not ARR retention — churned customers count as lost regardless of their prior ARR.`,
    ordered: true,
    orderedNote: 'cohort_year ascending',
    fingerprintSQL: COHORT_SURVIVAL_EXPANSION_TRAP_SQL,
    fingerprintMessage: `You measured survival against the March 2026 snapshot instead of June, so each cohort's survival reads against an earlier cutoff and overstates retention for a June-targeted review. Use the June 2026 snapshot so survival is measured to the end of the half.`,
    hints: [
      `Build cohorts from the first 'new' event per customer (same as m218). LEFT JOIN to the distinct June 2026 snapshot customers.`,
      `Survived is count of non-null June matches; survival_pct is 100 * survived / acquired, null-guarded. Order by cohort year.`,
      COHORT_SURVIVAL_SQL,
    ],
    sayIt: `"Survival declines with cohort age — the 2021 cohort retains about 21% to June 2026, rising to 91% for the 2026 cohort. This is logo survival: a customer is present or absent, regardless of prior ARR."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm220',
    part: 32,
    title: 'Measure veteran-cohort net ARR retention',
    from: 'fin',
    ask: `The 2021 cohort has had five-plus years to churn — but did the survivors expand enough to hold the cohort's ARR? Compare the 2021 cohort's opening ARR (sum of arr_after_usd on first new events before 2022) to the June 2026 current ARR of those same customers (sum of arr_usd in the June snapshot). The ratio is net cohort retention — the LTV proxy.`,
    deliverable: `Exactly one row: opening_arr_usd, current_arr_usd, net_cohort_retention_pct, net_arr_change_usd. Round dollars and percent to 2 decimals.`,
    tables: ['fct_arr_movements', 'fct_subscription_snapshot_monthly'],
    canonical: VETERAN_COHORT_NET_RETENTION_SQL,
    solutionSql: VETERAN_COHORT_NET_RETENTION_SQL,
    solutionNote: `The 2021 cohort opened at $5.47M and its surviving customers carry $5.19M of June 2026 ARR — net cohort retention of roughly 95% despite only ~20.6% logo survival. The survivors expanded enough to nearly replace the ARR lost to churn. This is a net-dollar cohort retention read, not logo retention or LTV including revenue.`,
    ordered: false,
    fingerprintSQL: VETERAN_COHORT_ALL_CUSTOMERS_TRAP_SQL,
    fingerprintMessage: `Your current_arr summed all June 2026 customers, not just the 2021 cohort — so the cohort retention reads the whole book against the 2021 opening, which is meaningless. Restrict the current-ARR sum to the 2021 cohort's customer_ids.`,
    hints: [
      `Define the 2021 cohort as distinct customers with a 'new' event before 2022-01-01. Opening ARR sums arr_after_usd on those first events.`,
      `Current ARR sums arr_usd in the June 2026 snapshot, joined to the cohort customers only. Net retention is 100 * current / opening.`,
      VETERAN_COHORT_NET_RETENTION_SQL,
    ],
    sayIt: `"The 2021 cohort opened at $5.47 million and its survivors carry $5.19 million of June ARR — about 95% net retention despite only 21% logo survival. The survivors expanded enough to nearly replace churned ARR. This is net-dollar cohort retention, not logo retention or LTV."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm221',
    part: 32,
    title: 'Decompose the veteran cohort expansion and churn',
    from: 'fin',
    ask: `What drove the 2021 cohort's net retention — expansion or churn? Sum the signed ARR deltas by movement_type for all post-2021 events on 2021-cohort customers: expansion (positive), contraction (negative), churn (negative), reactivation (positive). The net of these explains how opening ARR became current ARR.`,
    deliverable: `Rows ordered by arr_delta_usd descending: movement_type, events, arr_delta_usd. Round dollars to 2 decimals. (new may be absent — these customers' first 'new' was pre-2022.)`,
    tables: ['fct_arr_movements'],
    canonical: COHORT_EXPANSION_CHURN_SQL,
    solutionSql: COHORT_EXPANSION_CHURN_SQL,
    solutionNote: `For the 2021 cohort, expansion and reactivation added ARR while contraction and churn removed it; the net of these explains the roughly 5% gap between opening and current cohort ARR. Churn removed far more than expansion added in raw terms, but the surviving customers' expansion offset most of it on a net basis. This is a directional decomposition, not a cause attribution.`,
    ordered: true,
    orderedNote: 'arr_delta_usd descending',
    fingerprintSQL: COHORT_EXPANSION_CHURN_ABS_TRAP_SQL,
    fingerprintMessage: `You summed abs(arr_delta_usd), which makes churn read as a positive and erases the directional decomposition. Preserve the sign so expansion is positive and churn/contraction are negative — the net explains the cohort trajectory.`,
    hints: [
      `Restrict to 2021-cohort customers (first 'new' before 2022) and post-2021 events. Group by movement_type.`,
      `Sum the signed arr_delta_usd per type. Order by the signed delta descending so expansion leads and churn trails.`,
      COHORT_EXPANSION_CHURN_SQL,
    ],
    sayIt: `"For the 2021 cohort, expansion added and churn removed ARR; the net explains the ~5% gap between opening and current. Churn removed more in raw terms, but survivors' expansion offset most of it. This is a directional decomposition, not a cause attribution."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm222',
    part: 32,
    title: 'Read the year-over-year cohort size trend',
    from: 'danny',
    ask: `Is acquisition accelerating or decelerating? For each cohort year, count customers acquired and compute the year-over-year growth percent against the prior cohort. A decelerating growth rate late in the series changes the new-logo conversation even if absolute counts stay high.`,
    deliverable: `Six rows ordered by cohort_year ascending: cohort_year, customers_acquired, yoy_growth_pct. Round percent to 2 decimals; 2021's growth is null.`,
    tables: ['fct_arr_movements'],
    canonical: COHORT_SIZE_TREND_SQL,
    solutionSql: COHORT_SIZE_TREND_SQL,
    solutionNote: `Cohort acquisition grew year over year through 2025, then the 2026 figure (a partial year) reads as a decline against 2025 — the partial-year effect, not necessarily a real slowdown. The first cohort's growth is null. This is an acquisition-count trend, not revenue or a forecast.`,
    ordered: true,
    orderedNote: 'cohort_year ascending',
    fingerprintSQL: COHORT_SIZE_TREND_CUMULATIVE_TRAP_SQL,
    fingerprintMessage: `You reported cumulative acquired customers (a running total) instead of per-year acquisition, so each year's count stacks all prior cohorts on top and the growth reads cumulative installs, not annual acquisition. Count each cohort year standing alone — no running window.`,
    hints: [
      `Build cohorts from the first 'new' event per customer; count per cohort year.`,
      `Use lag(count) over (order by cohort_year) for the prior cohort. Growth is 100 * (current - prior) / prior, null-guarded. Null for 2021.`,
      COHORT_SIZE_TREND_SQL,
    ],
    sayIt: `"Cohort acquisition grew year over year through 2025; the 2026 figure is a partial year, so it reads as a decline against 2025 — that's the partial-year effect, not necessarily a real slowdown. The first cohort's growth is null. This is an acquisition-count trend."`,
    jdCompanies: ['Stripe'],
  },
  {
    id: 'm223',
    part: 32,
    title: 'Package the cohort tenure handoff',
    from: 'fin',
    ask: `Close the cohort review in one Finance + Customer Success handoff. Carry the 2021 veteran cohort: opened, survived, survival pct, opening ARR, current ARR, net retention pct; and the 2026 latest cohort: opened, survived, survival pct. Reduce each control to one row before combining.`,
    deliverable: `Exactly one row: v2021_opened, v2021_survived, v2021_survival_pct, v2021_opening_arr_usd, v2021_current_arr_usd, v2021_net_retention_pct, v2026_opened, v2026_survived, v2026_survival_pct. Round dollars and percent to 2 decimals.`,
    tables: ['fct_arr_movements', 'fct_subscription_snapshot_monthly'],
    canonical: COHORT_HANDOFF_SQL,
    solutionSql: COHORT_HANDOFF_SQL,
    solutionNote: `The cohort handoff: the 2021 veteran cohort retains about 21% of logos but ~95% of net ARR (survivors expanded), while the 2026 cohort retains about 91% of logos (still early). The contrast — low logo survival offset by expansion — is the cohort story leadership reviews. This is a cohort-tenure handoff, not cash, revenue, a forecast, or a churn-cause attribution.`,
    ordered: false,
    fingerprintSQL: COHORT_HANDOFF_DROP_CURRENT_TRAP_SQL,
    fingerprintMessage: `Your handoff zeroes out the 2021 current ARR, so net retention reads zero and the cohort story vanishes. Carry the real June 2026 current ARR for the 2021 cohort so the net retention reflects survivor expansion.`,
    hints: [
      `Build one-row controls: 2021 opened/survived, 2021 opening ARR (pre-2022 new events), 2021 current ARR (June snapshot of cohort customers), 2026 opened/survived. CROSS JOIN only those reduced single-row outputs.`,
      `Survival pct is 100 * survived / opened per cohort. Net retention is 100 * current / opening for the 2021 cohort.`,
      COHORT_HANDOFF_SQL,
    ],
    sayIt: `"The 2021 veteran cohort retains about 21% of logos but 95% of net ARR — survivors expanded — while the 2026 cohort retains 91% of logos. The low-logo-high-ARR contrast is the cohort story. This is a cohort-tenure handoff, not cash, revenue, a forecast, or a cause attribution."`,
    jdCompanies: ['Figma'],
  },
]
