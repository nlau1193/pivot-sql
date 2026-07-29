// The Star67 mission spine. This file is the public, executable content contract.
// Each mission: warm ask copy, explicit deliverable spec, canonical SQL (the harness
// executes this against the shipped parquet and freezes the expected result — any
// failure fails the build), 3 free hints (Excel-bridge → skeleton → full solution),
// and a "say it like an analyst" line for interview practice.
// Voice: a competent, warm colleague. Excel frame first. No exclamation-point spam.

import { REFORECAST_OUTCOME_MISSIONS } from './reforecast-outcome-missions.mjs'
import { SHARED_SERVICES_ALLOCATION_MISSIONS } from './shared-services-allocation-missions.mjs'
import { COST_TO_SERVE_REVIEW_MISSIONS } from './cost-to-serve-review-missions.mjs'
import { CONTRACTOR_CONSULTING_COST_REVIEW_MISSIONS } from './contractor-consulting-cost-review-missions.mjs'
import { TRAVEL_EXPENSE_REVIEW_MISSIONS } from './travel-expense-review-missions.mjs'
import { REVENUE_CLOSE_USAGE_REVIEW_MISSIONS } from './revenue-close-usage-review-missions.mjs'
import { H1_PNL_PLAN_VARIANCE_REVIEW_MISSIONS } from './h1-pnl-plan-variance-review-missions.mjs'
import { ARR_RETENTION_REVIEW_MISSIONS } from './arr-retention-review-missions.mjs'
import { MONTHLY_PNL_TREND_MISSIONS } from './monthly-pnl-trend-missions.mjs'
import { PAYROLL_BRIDGE_MISSIONS } from './payroll-bridge-missions.mjs'
import { REVENUE_ARR_RECONCILIATION_MISSIONS } from './revenue-arr-reconciliation-missions.mjs'
import { COHORT_TENURE_MISSIONS } from './cohort-tenure-missions.mjs'
import { PAYMENT_TERMS_MISSIONS } from './payment-terms-missions.mjs'
import { PLAN_MIX_MISSIONS } from './plan-mix-missions.mjs'
import { COMP_BAND_MISSIONS } from './comp-band-missions.mjs'

export const PARTS = [
  { id: 1, name: 'First tasks' },
  { id: 2, name: 'Pivot tables, but bigger' },
  { id: 3, name: 'XLOOKUP land' },
  { id: 4, name: 'The variance desk' },
  { id: 5, name: 'Time machines' },
  { id: 6, name: 'The close' },
  { id: 7, name: 'The forecast handoff' },
  { id: 8, name: 'The restatement review' },
  { id: 9, name: 'The vendor operating review' },
  { id: 10, name: 'The quarterly operating review' },
  { id: 11, name: 'The customer retention council' },
  { id: 12, name: 'The workforce planning council' },
  { id: 13, name: 'The regional revenue council' },
  { id: 14, name: 'The midyear plan checkpoint' },
  { id: 15, name: 'The daily revenue cadence' },
  { id: 16, name: 'The org manager review' },
  { id: 17, name: 'The licensed-seat book review' },
  { id: 18, name: 'The ARR event-ledger control' },
  { id: 19, name: 'The customer lifecycle council' },
  { id: 20, name: 'The customer ownership-history control' },
  { id: 21, name: 'The reforecast outcome review' },
  { id: 22, name: 'The shared-services allocation review' },
  { id: 23, name: 'The cost-to-serve review' },
  { id: 24, name: 'The contractor and consulting cost review' },
  { id: 25, name: 'The travel and expense operating review' },
  { id: 26, name: 'The revenue close and usage review' },
  { id: 27, name: 'The H1 P&L plan-variance review' },
  { id: 28, name: 'The net/gross ARR retention review' },
  { id: 29, name: 'The monthly P&L trend and operating-leverage review' },
  { id: 30, name: 'The GL-to-payroll loaded-headcount-cost bridge' },
  { id: 31, name: 'The revenue-to-ARR reconciliation' },
  { id: 32, name: 'The customer-tenure and cohort-LTV review' },
  { id: 33, name: 'The vendor payment-terms working-capital exposure review' },
  { id: 34, name: 'The customer-segment plan-mix ARR review' },
  { id: 35, name: 'The GL-to-payroll divisional-mix comp-band review' },
]

// Accept either an inline ordered window or a correctly declared named window.
// The grader masks SQL comments before applying this pedagogical requirement.
const ORDERED_WINDOW_NAME = String.raw`(?:"[^"]+"|[a-z_][a-z0-9_]*)`
const ORDERED_WINDOW_REQUIREMENT = String.raw`(?:over\s*\(\s*order\s+by|over\s+(${ORDERED_WINDOW_NAME})[\s\S]*window\s+\1\s+as\s*\(\s*order\s+by)`

// Method guards should protect the lesson's data semantics without prescribing
// which side of an equivalent outer join the learner writes first.
const DIM_DATE_OUTER_JOIN_REQUIREMENT = String.raw`(?=[\s\S]*\b(?:from|join)\s+dim_date\b)(?=[\s\S]*\b(?:left|right|full)(?:\s+outer)?\s+join\b)`
const CALENDAR_ORDERED_WINDOW_REQUIREMENT = String.raw`${DIM_DATE_OUTER_JOIN_REQUIREMENT}(?=[\s\S]*${ORDERED_WINDOW_REQUIREMENT})`

// Accept both inline and named windows while still requiring ROW_NUMBER itself
// to own the deterministic ordering used by the top-ten lesson.
const ORDERED_ROW_NUMBER_REQUIREMENT = String.raw`row_number\s*\(\s*\)\s*(?:over\s*\(\s*order\s+by|over\s+(${ORDERED_WINDOW_NAME})[\s\S]*window\s+\1\s+as\s*\(\s*order\s+by)`

// Predicate order is presentation. The active-roster boundary needs both
// branches, but either branch may be written first.
const ACTIVE_JUNE_30_REQUIREMENT = String.raw`(?=[\s\S]*\btermination_date\s+is\s+null\b)(?=[\s\S]*(?:\btermination_date\s*>\s*date\s*'2026-06-30'|date\s*'2026-06-30'\s*<\s*termination_date\b))`

// Accept commuted comparisons while retaining source-population controls that
// the frozen fixture alone cannot distinguish from an incomplete answer.
const ASSIGNMENT_CUTOFF_REQUIREMENT = String.raw`(?:\bassigned_on\s*(?:<=\s*date\s*'2026-06-30'|<\s*date\s*'2026-07-01'|between\s+date\s*'\d{4}-\d{2}-\d{2}'\s+and\s+date\s*'2026-06-30')|date\s*'2026-06-30'\s*>=\s*assigned_on\b|date\s*'2026-07-01'\s*>\s*assigned_on\b)`
const PAYROLL_SOURCE_REQUIREMENT = String.raw`(?:\bsource_system\s*(?:=\s*'Payroll'|in\s*\(\s*'Payroll'\s*\))|'Payroll'\s*=\s*source_system\b)`

const ARR_LEDGER_HANDOFF_SQL = `WITH identity_control AS (SELECT count(*) AS movement_rows, count(DISTINCT movement_type) AS movement_types, count(*) - count(DISTINCT movement_id) AS identity_exception_rows FROM fct_arr_movements), equation_control AS (SELECT count(*) FILTER (WHERE round(arr_before_usd * 100)::BIGINT + round(arr_delta_usd * 100)::BIGINT <> round(arr_after_usd * 100)::BIGINT OR round(arr_before_usd * 100)::BIGINT < 0 OR round(arr_after_usd * 100)::BIGINT < 0) AS equation_exception_rows FROM fct_arr_movements), semantic_control AS (SELECT count(*) FILTER (WHERE CASE movement_type WHEN 'new' THEN NOT (round(arr_before_usd * 100)::BIGINT = 0 AND round(arr_delta_usd * 100)::BIGINT > 0 AND round(arr_after_usd * 100)::BIGINT = round(arr_delta_usd * 100)::BIGINT) WHEN 'reactivation' THEN NOT (round(arr_before_usd * 100)::BIGINT = 0 AND round(arr_delta_usd * 100)::BIGINT > 0 AND round(arr_after_usd * 100)::BIGINT = round(arr_delta_usd * 100)::BIGINT) WHEN 'expansion' THEN NOT (round(arr_before_usd * 100)::BIGINT > 0 AND round(arr_delta_usd * 100)::BIGINT > 0 AND round(arr_after_usd * 100)::BIGINT > round(arr_before_usd * 100)::BIGINT) WHEN 'contraction' THEN NOT (round(arr_before_usd * 100)::BIGINT > 0 AND round(arr_delta_usd * 100)::BIGINT < 0 AND round(arr_after_usd * 100)::BIGINT > 0 AND round(arr_after_usd * 100)::BIGINT < round(arr_before_usd * 100)::BIGINT) WHEN 'churn' THEN NOT (round(arr_before_usd * 100)::BIGINT > 0 AND round(arr_delta_usd * 100)::BIGINT < 0 AND round(arr_after_usd * 100)::BIGINT = 0) ELSE true END) AS semantic_exception_rows FROM fct_arr_movements), sequenced AS (SELECT customer_id, arr_before_usd, arr_after_usd, row_number() OVER (PARTITION BY customer_id ORDER BY event_date, movement_id) AS event_ordinal, lag(arr_after_usd) OVER (PARTITION BY customer_id ORDER BY event_date, movement_id) AS prior_arr_after_usd FROM fct_arr_movements), chain_control AS (SELECT count(*) FILTER (WHERE (event_ordinal = 1 AND round(arr_before_usd * 100)::BIGINT <> 0) OR (event_ordinal > 1 AND round(arr_before_usd * 100)::BIGINT <> round(prior_arr_after_usd * 100)::BIGINT)) AS chain_exception_rows FROM sequenced), months AS (SELECT DISTINCT month_start FROM dim_date WHERE month_start BETWEEN DATE '2023-01-01' AND DATE '2026-06-01'), opening AS (SELECT coalesce(sum(round(arr_delta_usd * 100)::BIGINT), 0) AS opening_arr_cents FROM fct_arr_movements WHERE event_date < DATE '2023-01-01'), monthly_movements AS (SELECT date_trunc('month', event_date)::DATE AS month_start, sum(round(arr_delta_usd * 100)::BIGINT) AS movement_arr_cents FROM fct_arr_movements WHERE event_date >= DATE '2023-01-01' AND event_date < DATE '2026-07-01' GROUP BY 1), ledger_months AS (SELECT m.month_start, o.opening_arr_cents + sum(coalesce(mm.movement_arr_cents, 0)) OVER (ORDER BY m.month_start ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS ledger_ending_arr_cents FROM months m CROSS JOIN opening o LEFT JOIN monthly_movements mm USING (month_start)), snapshot_months AS (SELECT month_start, sum(round(arr_usd * 100)::BIGINT) AS snapshot_ending_arr_cents FROM fct_subscription_snapshot_monthly WHERE month_start BETWEEN DATE '2023-01-01' AND DATE '2026-06-01' GROUP BY month_start), month_control AS (SELECT count(*) AS loaded_months_checked, count(*) FILTER (WHERE ledger_ending_arr_cents <> snapshot_ending_arr_cents) AS month_reconciliation_exception_rows FROM ledger_months JOIN snapshot_months USING (month_start)), ending AS (SELECT customer_id, plan_name AS event_time_ending_plan, round(arr_after_usd * 100)::BIGINT AS ledger_ending_arr_cents FROM fct_arr_movements QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY event_date DESC, movement_id DESC) = 1), june AS (SELECT customer_id, plan_name AS june_snapshot_plan, round(arr_usd * 100)::BIGINT AS june_snapshot_arr_cents FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'), customer_rows AS (SELECT d.customer_id, e.event_time_ending_plan, e.ledger_ending_arr_cents, j.june_snapshot_plan, j.june_snapshot_arr_cents FROM dim_customer d JOIN ending e USING (customer_id) LEFT JOIN june j USING (customer_id)), customer_control AS (SELECT count(*) AS customer_states_checked, count(*) FILTER (WHERE ledger_ending_arr_cents = 0) AS inactive_customer_states, count(*) FILTER (WHERE (ledger_ending_arr_cents > 0 AND (june_snapshot_arr_cents IS NULL OR ledger_ending_arr_cents <> june_snapshot_arr_cents OR event_time_ending_plan IS DISTINCT FROM june_snapshot_plan)) OR (ledger_ending_arr_cents = 0 AND june_snapshot_arr_cents IS NOT NULL)) AS customer_state_exception_rows FROM customer_rows), metrics AS (SELECT * FROM identity_control CROSS JOIN equation_control CROSS JOIN semantic_control CROSS JOIN chain_control CROSS JOIN month_control CROSS JOIN customer_control) SELECT CASE WHEN identity_exception_rows + equation_exception_rows + semantic_exception_rows + chain_exception_rows + month_reconciliation_exception_rows + customer_state_exception_rows = 0 THEN 'PASS' ELSE 'EXCEPTIONS' END AS control_status, movement_rows, movement_types, loaded_months_checked, customer_states_checked, inactive_customer_states, identity_exception_rows, equation_exception_rows, semantic_exception_rows, chain_exception_rows, month_reconciliation_exception_rows, customer_state_exception_rows FROM metrics`

const LIFECYCLE_ELIGIBILITY_SQL = `WITH acquisition AS (
  SELECT customer_id, plan_name AS acquisition_plan, event_date AS acquisition_date
  FROM fct_arr_movements
  WHERE movement_type = 'new'
  QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY event_date, movement_id) = 1
), horizons AS (
  SELECT * FROM (VALUES (6), (12), (24)) AS h(horizon_months)
), cohort_windows AS (
  SELECT
    a.*,
    h.horizon_months,
    last_day(a.acquisition_date + h.horizon_months * INTERVAL '1 month') AS horizon_month_end
  FROM acquisition a
  CROSS JOIN horizons h
)
SELECT
  acquisition_plan,
  horizon_months,
  min(acquisition_date) AS first_acquisition_date,
  max(acquisition_date) AS last_acquisition_date,
  count(*) AS acquired_customers,
  count(*) FILTER (WHERE horizon_month_end <= DATE '2026-06-30') AS eligible_customers,
  count(*) FILTER (WHERE horizon_month_end > DATE '2026-06-30') AS ineligible_customers,
  last_day(DATE '2026-06-30' - horizon_months * INTERVAL '1 month') AS acquisition_cutoff_month_end
FROM cohort_windows
GROUP BY acquisition_plan, horizon_months
ORDER BY horizon_months, acquisition_plan`

const LIFECYCLE_RETENTION_CURVE_SQL = `WITH acquisition AS (
  SELECT
    customer_id,
    plan_name AS acquisition_plan,
    event_date AS acquisition_date,
    arr_after_usd AS acquisition_arr_usd
  FROM fct_arr_movements
  WHERE movement_type = 'new'
  QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY event_date, movement_id) = 1
), horizons AS (
  SELECT * FROM (VALUES (6), (12), (24)) AS h(horizon_months)
), eligible AS (
  SELECT
    a.*,
    h.horizon_months,
    last_day(a.acquisition_date + h.horizon_months * INTERVAL '1 month') AS horizon_month_end
  FROM acquisition a
  CROSS JOIN horizons h
  WHERE last_day(a.acquisition_date + h.horizon_months * INTERVAL '1 month') <= DATE '2026-06-30'
), ranked_states AS (
  SELECT
    e.*,
    m.arr_after_usd AS endpoint_arr_usd,
    row_number() OVER (
      PARTITION BY e.customer_id, e.horizon_months
      ORDER BY m.event_date DESC, m.movement_id DESC
    ) AS state_rank
  FROM eligible e
  JOIN fct_arr_movements m
    ON m.customer_id = e.customer_id
   AND m.event_date <= e.horizon_month_end
), endpoint AS (
  SELECT * FROM ranked_states WHERE state_rank = 1
)
SELECT
  acquisition_plan,
  horizon_months,
  count(*) AS eligible_customers,
  count(*) FILTER (WHERE endpoint_arr_usd > 0) AS endpoint_active_customers,
  round(100.0 * count(*) FILTER (WHERE endpoint_arr_usd > 0) / count(*), 1) AS endpoint_logo_survival_pct,
  round(sum(acquisition_arr_usd), 2) AS opening_arr_usd,
  round(sum(endpoint_arr_usd), 2) AS endpoint_arr_usd,
  round(100.0 * sum(least(endpoint_arr_usd, acquisition_arr_usd)) / sum(acquisition_arr_usd), 1) AS capped_grr_pct,
  round(100.0 * sum(endpoint_arr_usd) / sum(acquisition_arr_usd), 1) AS nrr_pct
FROM endpoint
GROUP BY acquisition_plan, horizon_months
ORDER BY horizon_months, acquisition_plan`

const LIFECYCLE_TENURE_BOOK_SQL = `WITH june AS (
  SELECT customer_id, arr_usd
  FROM fct_subscription_snapshot_monthly
  WHERE month_start = DATE '2026-06-01'
), customer_book AS (
  SELECT
    d.customer_id,
    date_sub('month', d.first_contract_date, DATE '2026-06-30') AS tenure_months,
    j.arr_usd
  FROM dim_customer d
  LEFT JOIN june j USING (customer_id)
), banded AS (
  SELECT
    *,
    CASE
      WHEN tenure_months <= 5 THEN '0-5 months'
      WHEN tenure_months <= 11 THEN '6-11 months'
      WHEN tenure_months <= 23 THEN '12-23 months'
      WHEN tenure_months <= 35 THEN '24-35 months'
      ELSE '36+ months'
    END AS tenure_band,
    CASE
      WHEN tenure_months <= 5 THEN 1
      WHEN tenure_months <= 11 THEN 2
      WHEN tenure_months <= 23 THEN 3
      WHEN tenure_months <= 35 THEN 4
      ELSE 5
    END AS tenure_sort
  FROM customer_book
)
SELECT
  tenure_band,
  count(*) AS acquired_customers,
  count(arr_usd) AS june_active_customers,
  count(*) - count(arr_usd) AS june_inactive_customers,
  round(100.0 * count(arr_usd) / count(*), 1) AS june_active_share_pct,
  round(coalesce(sum(arr_usd), 0), 2) AS june_ending_arr_usd
FROM banded
GROUP BY tenure_band, tenure_sort
ORDER BY tenure_sort`

const LIFECYCLE_EVENT_INCIDENCE_SQL = `WITH acquisition AS (
  SELECT customer_id, plan_name AS acquisition_plan, event_date AS acquisition_date
  FROM fct_arr_movements
  WHERE movement_type = 'new'
  QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY event_date, movement_id) = 1
), horizons AS (
  SELECT * FROM (VALUES (6), (12), (24)) AS h(horizon_months)
), eligible AS (
  SELECT
    a.*,
    h.horizon_months,
    last_day(a.acquisition_date + h.horizon_months * INTERVAL '1 month') AS horizon_month_end
  FROM acquisition a
  CROSS JOIN horizons h
  WHERE last_day(a.acquisition_date + h.horizon_months * INTERVAL '1 month') <= DATE '2026-06-30'
), customer_flags AS (
  SELECT
    e.acquisition_plan,
    e.horizon_months,
    e.customer_id,
    max(CASE WHEN m.movement_type = 'expansion' THEN 1 ELSE 0 END) AS had_expansion,
    max(CASE WHEN m.movement_type = 'contraction' THEN 1 ELSE 0 END) AS had_contraction,
    max(CASE WHEN m.movement_type = 'churn' THEN 1 ELSE 0 END) AS had_churn,
    max(CASE WHEN m.movement_type = 'reactivation' THEN 1 ELSE 0 END) AS had_reactivation
  FROM eligible e
  LEFT JOIN fct_arr_movements m
    ON m.customer_id = e.customer_id
   AND m.event_date > e.acquisition_date
   AND m.event_date <= e.horizon_month_end
  GROUP BY e.acquisition_plan, e.horizon_months, e.customer_id
)
SELECT
  acquisition_plan,
  horizon_months,
  count(*) AS eligible_customers,
  sum(had_expansion) AS expansion_customers,
  round(100.0 * sum(had_expansion) / count(*), 1) AS expansion_incidence_pct,
  sum(had_contraction) AS contraction_customers,
  round(100.0 * sum(had_contraction) / count(*), 1) AS contraction_incidence_pct,
  sum(had_churn) AS churn_customers,
  round(100.0 * sum(had_churn) / count(*), 1) AS churn_incidence_pct,
  sum(had_reactivation) AS reactivation_customers,
  round(100.0 * sum(had_reactivation) / count(*), 1) AS reactivation_incidence_pct
FROM customer_flags
GROUP BY acquisition_plan, horizon_months
ORDER BY horizon_months, acquisition_plan`

const LIFECYCLE_FIRST_TRANSITION_SQL = `WITH acquisition AS (
  SELECT customer_id, event_date AS acquisition_date
  FROM fct_arr_movements
  WHERE movement_type = 'new'
  QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY event_date, movement_id) = 1
), eligible AS (
  SELECT
    customer_id,
    acquisition_date,
    last_day(acquisition_date + INTERVAL '24 months') AS horizon_month_end
  FROM acquisition
  WHERE last_day(acquisition_date + INTERVAL '24 months') <= DATE '2026-06-30'
), ranked AS (
  SELECT
    e.customer_id,
    e.acquisition_date,
    m.movement_type,
    m.event_date AS transition_date,
    row_number() OVER (
      PARTITION BY e.customer_id
      ORDER BY m.event_date, m.movement_id
    ) AS transition_rank
  FROM eligible e
  LEFT JOIN fct_arr_movements m
    ON m.customer_id = e.customer_id
   AND m.event_date > e.acquisition_date
   AND m.event_date <= e.horizon_month_end
), first_transition AS (
  SELECT
    customer_id,
    acquisition_date,
    coalesce(movement_type, 'none') AS transition_type,
    transition_date
  FROM ranked
  WHERE transition_rank = 1
)
SELECT
  transition_type,
  (SELECT count(*) FROM eligible) AS eligible_customers,
  count(*) AS customers,
  round(100.0 * count(*) / (SELECT count(*) FROM eligible), 1) AS cohort_share_pct,
  median(date_diff('day', acquisition_date, transition_date)) AS median_days_to_transition
FROM first_transition
GROUP BY transition_type
ORDER BY customers DESC, transition_type`

const LIFECYCLE_CHURN_EXPOSURE_SQL = `WITH months AS (
  SELECT DISTINCT month_start
  FROM dim_date
  WHERE month_start BETWEEN DATE '2023-01-01' AND DATE '2026-06-01'
), acquisition AS (
  SELECT customer_id, plan_name AS acquisition_plan, event_date AS acquisition_date
  FROM fct_arr_movements
  WHERE movement_type = 'new'
  QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY event_date, movement_id) = 1
), opening_ranked AS (
  SELECT
    mo.month_start,
    a.customer_id,
    a.acquisition_plan,
    a.acquisition_date,
    m.arr_after_usd AS opening_arr_usd,
    row_number() OVER (
      PARTITION BY mo.month_start, a.customer_id
      ORDER BY m.event_date DESC, m.movement_id DESC
    ) AS state_rank
  FROM months mo
  JOIN acquisition a ON a.acquisition_date < mo.month_start
  JOIN fct_arr_movements m
    ON m.customer_id = a.customer_id
   AND m.event_date < mo.month_start
), exposure AS (
  SELECT
    month_start,
    customer_id,
    acquisition_plan,
    CASE
      WHEN date_sub('month', acquisition_date, month_start) <= 5 THEN '0-5 months'
      WHEN date_sub('month', acquisition_date, month_start) <= 11 THEN '6-11 months'
      WHEN date_sub('month', acquisition_date, month_start) <= 23 THEN '12-23 months'
      WHEN date_sub('month', acquisition_date, month_start) <= 35 THEN '24-35 months'
      ELSE '36+ months'
    END AS tenure_band,
    CASE
      WHEN date_sub('month', acquisition_date, month_start) <= 5 THEN 1
      WHEN date_sub('month', acquisition_date, month_start) <= 11 THEN 2
      WHEN date_sub('month', acquisition_date, month_start) <= 23 THEN 3
      WHEN date_sub('month', acquisition_date, month_start) <= 35 THEN 4
      ELSE 5
    END AS tenure_sort
  FROM opening_ranked
  WHERE state_rank = 1 AND opening_arr_usd > 0
), exposure_with_churn AS (
  SELECT
    e.*,
    count(m.movement_id) AS churn_events
  FROM exposure e
  LEFT JOIN fct_arr_movements m
    ON m.customer_id = e.customer_id
   AND m.movement_type = 'churn'
   AND m.event_date >= e.month_start
   AND m.event_date < e.month_start + INTERVAL '1 month'
  GROUP BY e.month_start, e.customer_id, e.acquisition_plan, e.tenure_band, e.tenure_sort
)
SELECT
  acquisition_plan,
  tenure_band,
  count(*) AS opening_active_customer_months,
  sum(churn_events) AS churn_events,
  round(100.0 * sum(churn_events) / count(*), 2) AS churns_per_100_opening_active_customer_months
FROM exposure_with_churn
GROUP BY acquisition_plan, tenure_band, tenure_sort
ORDER BY acquisition_plan, tenure_sort`

const LIFECYCLE_REACTIVATION_SQL = `WITH acquisition AS (
  SELECT customer_id, plan_name AS acquisition_plan
  FROM fct_arr_movements
  WHERE movement_type = 'new'
  QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY event_date, movement_id) = 1
), sequenced AS (
  SELECT
    m.customer_id,
    a.acquisition_plan,
    m.movement_type,
    m.event_date,
    m.arr_after_usd,
    lag(m.movement_type) OVER customer_events AS prior_movement_type,
    lag(m.event_date) OVER customer_events AS prior_event_date,
    lag(m.arr_before_usd) OVER customer_events AS pre_churn_arr_usd,
    lead(m.movement_id) OVER customer_events AS next_movement_id
  FROM fct_arr_movements m
  JOIN acquisition a USING (customer_id)
  WINDOW customer_events AS (PARTITION BY customer_id ORDER BY event_date, movement_id)
), episodes AS (
  SELECT * FROM sequenced WHERE movement_type = 'reactivation'
)
SELECT
  coalesce(acquisition_plan, 'All plans') AS acquisition_plan,
  count(*) AS reactivation_episodes,
  count(*) FILTER (WHERE prior_movement_type IS DISTINCT FROM 'churn') AS prior_event_not_churn_episodes,
  median(date_diff('day', prior_event_date, event_date)) AS median_inactive_days,
  round(sum(pre_churn_arr_usd), 2) AS pre_churn_arr_usd,
  round(sum(arr_after_usd), 2) AS restored_arr_usd,
  round(100.0 * sum(arr_after_usd) / sum(pre_churn_arr_usd), 1) AS restored_arr_pct,
  count(next_movement_id) AS episodes_with_follow_on_events
FROM episodes
GROUP BY GROUPING SETS ((acquisition_plan), ())
ORDER BY CASE WHEN acquisition_plan IS NULL THEN 0 ELSE 1 END, acquisition_plan`

const LIFECYCLE_SHRINKAGE_QUEUE_SQL = `WITH acquisition AS (
  SELECT
    customer_id,
    plan_name AS acquisition_plan,
    event_date AS acquisition_date,
    arr_after_usd AS acquisition_arr_usd
  FROM fct_arr_movements
  WHERE movement_type = 'new'
  QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY event_date, movement_id) = 1
), june AS (
  SELECT customer_id, arr_usd AS june_arr_usd
  FROM fct_subscription_snapshot_monthly
  WHERE month_start = DATE '2026-06-01'
), latest_csm AS (
  SELECT customer_id, csm_name
  FROM stg_customer_csm_assignments
  WHERE assigned_on <= DATE '2026-06-30'
  QUALIFY row_number() OVER (
    PARTITION BY customer_id
    ORDER BY assigned_on DESC, csm_name
  ) = 1
)
SELECT
  a.customer_id,
  d.customer_name AS current_customer_name,
  d.segment AS current_segment,
  a.acquisition_date,
  date_sub('month', a.acquisition_date, DATE '2026-06-30') AS tenure_months,
  a.acquisition_plan,
  round(a.acquisition_arr_usd, 2) AS acquisition_arr_usd,
  round(j.june_arr_usd, 2) AS june_arr_usd,
  round(j.june_arr_usd - a.acquisition_arr_usd, 2) AS shrinkage_usd,
  l.csm_name AS latest_csm_as_of_june_30
FROM acquisition a
JOIN june j USING (customer_id)
JOIN dim_customer d USING (customer_id)
LEFT JOIN latest_csm l USING (customer_id)
WHERE last_day(a.acquisition_date + INTERVAL '24 months') <= DATE '2026-06-30'
  AND j.june_arr_usd < a.acquisition_arr_usd
ORDER BY shrinkage_usd, a.customer_id`

const LIFECYCLE_HANDOFF_SQL = `WITH acquisition AS (
  SELECT
    customer_id,
    plan_name AS acquisition_plan,
    event_date AS acquisition_date,
    arr_after_usd AS acquisition_arr_usd
  FROM fct_arr_movements
  WHERE movement_type = 'new'
  QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY event_date, movement_id) = 1
), horizons AS (
  SELECT * FROM (VALUES (6), (12), (24)) AS h(horizon_months)
), eligible AS (
  SELECT
    a.*,
    h.horizon_months,
    last_day(a.acquisition_date + h.horizon_months * INTERVAL '1 month') AS horizon_month_end
  FROM acquisition a
  CROSS JOIN horizons h
  WHERE last_day(a.acquisition_date + h.horizon_months * INTERVAL '1 month') <= DATE '2026-06-30'
), ranked_states AS (
  SELECT
    e.*,
    m.arr_after_usd AS endpoint_arr_usd,
    row_number() OVER (
      PARTITION BY e.customer_id, e.horizon_months
      ORDER BY m.event_date DESC, m.movement_id DESC
    ) AS state_rank
  FROM eligible e
  JOIN fct_arr_movements m
    ON m.customer_id = e.customer_id
   AND m.event_date <= e.horizon_month_end
), endpoints AS (
  SELECT * FROM ranked_states WHERE state_rank = 1
), maturity AS (
  SELECT
    count(*) FILTER (WHERE horizon_months = 6) AS eligible_6m_customers,
    count(*) FILTER (WHERE horizon_months = 12) AS eligible_12m_customers,
    count(*) FILTER (WHERE horizon_months = 24) AS eligible_24m_customers,
    count(*) FILTER (WHERE horizon_months = 24 AND endpoint_arr_usd > 0) AS endpoint_active_24m_customers,
    round(100.0 * count(*) FILTER (WHERE horizon_months = 24 AND endpoint_arr_usd > 0) / count(*) FILTER (WHERE horizon_months = 24), 1) AS endpoint_logo_survival_24m_pct,
    round(100.0 * sum(least(endpoint_arr_usd, acquisition_arr_usd)) FILTER (WHERE horizon_months = 24) / sum(acquisition_arr_usd) FILTER (WHERE horizon_months = 24), 1) AS capped_grr_24m_pct,
    round(100.0 * sum(endpoint_arr_usd) FILTER (WHERE horizon_months = 24) / sum(acquisition_arr_usd) FILTER (WHERE horizon_months = 24), 1) AS nrr_24m_pct
  FROM endpoints
), months AS (
  SELECT DISTINCT month_start
  FROM dim_date
  WHERE month_start BETWEEN DATE '2023-01-01' AND DATE '2026-06-01'
), opening_ranked AS (
  SELECT
    mo.month_start,
    a.customer_id,
    m.arr_after_usd AS opening_arr_usd,
    row_number() OVER (
      PARTITION BY mo.month_start, a.customer_id
      ORDER BY m.event_date DESC, m.movement_id DESC
    ) AS state_rank
  FROM months mo
  JOIN acquisition a ON a.acquisition_date < mo.month_start
  JOIN fct_arr_movements m
    ON m.customer_id = a.customer_id
   AND m.event_date < mo.month_start
), exposure AS (
  SELECT month_start, customer_id
  FROM opening_ranked
  WHERE state_rank = 1 AND opening_arr_usd > 0
), exposure_with_churn AS (
  SELECT
    e.month_start,
    e.customer_id,
    count(m.movement_id) AS churn_events
  FROM exposure e
  LEFT JOIN fct_arr_movements m
    ON m.customer_id = e.customer_id
   AND m.movement_type = 'churn'
   AND m.event_date >= e.month_start
   AND m.event_date < e.month_start + INTERVAL '1 month'
  GROUP BY e.month_start, e.customer_id
), hazard AS (
  SELECT
    count(*) AS loaded_window_opening_active_customer_months,
    sum(churn_events) AS loaded_window_churn_events,
    round(100.0 * sum(churn_events) / count(*), 2) AS churns_per_100_opening_active_customer_months
  FROM exposure_with_churn
), sequenced AS (
  SELECT
    movement_type,
    lead(movement_id) OVER (
      PARTITION BY customer_id ORDER BY event_date, movement_id
    ) AS next_movement_id
  FROM fct_arr_movements
), reactivation AS (
  SELECT
    count(*) AS reactivation_episodes,
    count(next_movement_id) AS reactivation_episodes_with_follow_on_events
  FROM sequenced
  WHERE movement_type = 'reactivation'
), june AS (
  SELECT customer_id, arr_usd AS june_arr_usd
  FROM fct_subscription_snapshot_monthly
  WHERE month_start = DATE '2026-06-01'
), shrinkage AS (
  SELECT
    count(*) AS mature_active_shrinkage_customers,
    round(sum(j.june_arr_usd - a.acquisition_arr_usd), 2) AS mature_active_shrinkage_usd
  FROM acquisition a
  JOIN june j USING (customer_id)
  WHERE last_day(a.acquisition_date + INTERVAL '24 months') <= DATE '2026-06-30'
    AND j.june_arr_usd < a.acquisition_arr_usd
), populations AS (
  SELECT
    count(DISTINCT customer_id) AS loaded_customers,
    count(*) AS loaded_movement_rows
  FROM fct_arr_movements
), snapshot_population AS (
  SELECT count(*) AS loaded_active_customer_months
  FROM fct_subscription_snapshot_monthly
)
SELECT
  p.loaded_customers,
  p.loaded_movement_rows,
  s.loaded_active_customer_months,
  m.eligible_6m_customers,
  m.eligible_12m_customers,
  m.eligible_24m_customers,
  m.endpoint_active_24m_customers,
  m.endpoint_logo_survival_24m_pct,
  m.capped_grr_24m_pct,
  m.nrr_24m_pct,
  h.loaded_window_opening_active_customer_months,
  h.loaded_window_churn_events,
  h.churns_per_100_opening_active_customer_months,
  r.reactivation_episodes,
  r.reactivation_episodes_with_follow_on_events,
  q.mature_active_shrinkage_customers,
  q.mature_active_shrinkage_usd
FROM populations p
CROSS JOIN snapshot_population s
CROSS JOIN maturity m
CROSS JOIN hazard h
CROSS JOIN reactivation r
CROSS JOIN shrinkage q`

const OWNERSHIP_PROFILE_SQL = `WITH employee_name_profile AS (
  SELECT
    full_name,
    count(*) AS matching_employees,
    count(*) FILTER (WHERE dept_id = 'D-CSM-01') AS matching_csm_employees
  FROM dim_employee
  GROUP BY full_name
), customer_history AS (
  SELECT customer_id, count(*) AS assignment_rows
  FROM stg_customer_csm_assignments
  GROUP BY customer_id
), assignment_profile AS (
  SELECT
    count(*) AS assignment_rows,
    count(DISTINCT a.customer_id) AS assigned_customers,
    count(DISTINCT a.csm_name) FILTER (
      WHERE p.matching_employees = 1 AND p.matching_csm_employees = 1
    ) AS matched_csms,
    min(a.assigned_on) AS first_assigned_on,
    max(a.assigned_on) AS last_assigned_on,
    count(*) FILTER (WHERE coalesce(p.matching_csm_employees, 0) = 0) AS unmatched_assignment_rows,
    count(*) FILTER (
      WHERE coalesce(p.matching_employees, 0) > 1
         OR coalesce(p.matching_csm_employees, 0) > 1
    ) AS ambiguous_assignment_rows
  FROM stg_customer_csm_assignments a
  LEFT JOIN employee_name_profile p ON a.csm_name = p.full_name
)
SELECT
  assignment_rows,
  assigned_customers,
  (SELECT count(*) FROM dim_customer) AS total_customers,
  (SELECT count(*) FROM dim_customer) - (SELECT count(*) FROM customer_history) AS never_assigned_customers,
  matched_csms,
  (SELECT count(*) FROM customer_history WHERE assignment_rows > 1) AS multirow_customers,
  (SELECT sum(assignment_rows - 1) FROM customer_history) AS historical_fanout_rows,
  first_assigned_on,
  last_assigned_on,
  unmatched_assignment_rows,
  ambiguous_assignment_rows
FROM assignment_profile`

const OWNERSHIP_EMPLOYMENT_SQL = `WITH employee_name_profile AS (
  SELECT
    full_name,
    count(*) AS matching_employees,
    count(*) FILTER (WHERE dept_id = 'D-CSM-01') AS matching_csm_employees
  FROM dim_employee
  GROUP BY full_name
), exact_csm_roster AS (
  SELECT e.*
  FROM dim_employee e
  JOIN employee_name_profile p ON e.full_name = p.full_name
  WHERE p.matching_employees = 1 AND p.matching_csm_employees = 1
), assignment_rows AS (
  SELECT a.*, r.hire_date, r.termination_date
  FROM stg_customer_csm_assignments a
  JOIN exact_csm_roster r ON a.csm_name = r.full_name
)
SELECT
  assignment_reason,
  count(*) AS assignment_rows,
  count(*) FILTER (WHERE assigned_on < hire_date) AS assigned_before_hire_rows,
  count(*) FILTER (
    WHERE termination_date IS NOT NULL AND assigned_on > termination_date
  ) AS assigned_after_termination_rows,
  count(*) FILTER (
    WHERE assigned_on >= hire_date
      AND (termination_date IS NULL OR assigned_on <= termination_date)
  ) AS employment_consistent_rows,
  round(100.0 * count(*) FILTER (
    WHERE assigned_on < hire_date
       OR (termination_date IS NOT NULL AND assigned_on > termination_date)
  ) / count(*), 1) AS employment_exception_pct
FROM assignment_rows
GROUP BY assignment_reason
ORDER BY assignment_reason`

const OWNERSHIP_ASSIGNMENT_STATE_SQL = `WITH assignment_states AS (
  SELECT
    a.*,
    state.arr_after_usd AS point_in_time_arr_usd
  FROM stg_customer_csm_assignments a
  LEFT JOIN LATERAL (
    SELECT m.arr_after_usd
    FROM fct_arr_movements m
    WHERE m.customer_id = a.customer_id
      AND m.event_date <= a.assigned_on
    ORDER BY m.event_date DESC, m.movement_id DESC
    LIMIT 1
  ) state ON true
)
SELECT
  assignment_reason,
  count(*) AS assignment_rows,
  count(*) FILTER (WHERE point_in_time_arr_usd IS NULL) AS state_missing_rows,
  count(*) FILTER (
    WHERE round(point_in_time_arr_usd * 100)::BIGINT > 0
  ) AS active_arr_assignment_rows,
  count(*) FILTER (
    WHERE round(point_in_time_arr_usd * 100)::BIGINT = 0
  ) AS zero_arr_assignment_rows,
  count(DISTINCT customer_id) FILTER (
    WHERE round(point_in_time_arr_usd * 100)::BIGINT = 0
  ) AS zero_arr_customers
FROM assignment_states
GROUP BY assignment_reason
ORDER BY assignment_reason`

const OWNERSHIP_TRANSITION_SQL = `WITH employee_name_profile AS (
  SELECT
    full_name,
    count(*) AS matching_employees,
    count(*) FILTER (WHERE dept_id = 'D-CSM-01') AS matching_csm_employees
  FROM dim_employee
  GROUP BY full_name
), exact_csm_roster AS (
  SELECT e.*
  FROM dim_employee e
  JOIN employee_name_profile p ON e.full_name = p.full_name
  WHERE p.matching_employees = 1 AND p.matching_csm_employees = 1
), sequenced AS (
  SELECT
    a.*,
    row_number() OVER customer_history AS assignment_ordinal,
    lag(csm_name) OVER customer_history AS prior_csm_name,
    count(*) OVER (
      PARTITION BY customer_id, csm_name
      ORDER BY assigned_on, assignment_reason
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS prior_same_owner_rows
  FROM stg_customer_csm_assignments a
  WINDOW customer_history AS (
    PARTITION BY customer_id ORDER BY assigned_on, csm_name, assignment_reason
  )
), evidence AS (
  SELECT s.*, prior_owner.termination_date AS prior_owner_termination_date
  FROM sequenced s
  LEFT JOIN exact_csm_roster prior_owner ON s.prior_csm_name = prior_owner.full_name
), control AS (
  SELECT
    count(*) FILTER (WHERE assignment_ordinal > 1) AS transition_rows,
    count(*) FILTER (
      WHERE assignment_ordinal > 1 AND csm_name IS DISTINCT FROM prior_csm_name
    ) AS owner_change_rows,
    count(*) FILTER (
      WHERE assignment_ordinal > 1 AND csm_name IS NOT DISTINCT FROM prior_csm_name
    ) AS adjacent_noop_rows,
    count(*) FILTER (WHERE prior_same_owner_rows > 0) AS repeated_owner_rows,
    count(*) FILTER (
      WHERE prior_same_owner_rows > 0 AND csm_name IS DISTINCT FROM prior_csm_name
    ) AS returned_owner_rows,
    count(*) FILTER (WHERE assignment_reason = 'CSM departure') AS departure_reason_rows,
    count(*) FILTER (
      WHERE assignment_reason = 'CSM departure'
        AND prior_owner_termination_date <= assigned_on
    ) AS departure_reason_with_timing_support_rows,
    count(*) FILTER (
      WHERE assignment_ordinal > 1 AND assignment_reason <> 'CSM departure'
    ) AS other_reason_rows_not_timing_verifiable
  FROM evidence
)
SELECT
  transition_rows,
  owner_change_rows,
  adjacent_noop_rows,
  repeated_owner_rows,
  returned_owner_rows,
  departure_reason_rows,
  departure_reason_with_timing_support_rows,
  departure_reason_rows - departure_reason_with_timing_support_rows AS departure_reason_without_timing_support_rows,
  other_reason_rows_not_timing_verifiable
FROM control`

const OWNERSHIP_RANGES_SQL = `WITH employee_name_profile AS (
  SELECT
    full_name,
    count(*) AS matching_employees,
    count(*) FILTER (WHERE dept_id = 'D-CSM-01') AS matching_csm_employees
  FROM dim_employee
  GROUP BY full_name
), exact_csm_roster AS (
  SELECT e.*
  FROM dim_employee e
  JOIN employee_name_profile p ON e.full_name = p.full_name
  WHERE p.matching_employees = 1 AND p.matching_csm_employees = 1
), assignment_ranges AS (
  SELECT
    a.*,
    lead(assigned_on, 1, DATE '2026-07-01') OVER (
      PARTITION BY customer_id ORDER BY assigned_on, csm_name, assignment_reason
    ) AS range_end_exclusive
  FROM stg_customer_csm_assignments a
), range_intersections AS (
  SELECT
    a.*,
    r.hire_date,
    r.termination_date,
    date_diff('day', assigned_on, range_end_exclusive) AS assignment_days,
    greatest(0, date_diff(
      'day',
      greatest(assigned_on, r.hire_date),
      least(
        range_end_exclusive,
        coalesce(r.termination_date + INTERVAL '1 day', DATE '2026-07-01')
      )
    )) AS employed_overlap_days
  FROM assignment_ranges a
  JOIN exact_csm_roster r ON a.csm_name = r.full_name
), range_days AS (
  SELECT *, assignment_days - employed_overlap_days AS outside_employment_days
  FROM range_intersections
)
SELECT
  count(*) AS assignment_ranges,
  count(*) FILTER (WHERE assignment_days <= 0) AS invalid_or_empty_ranges,
  count(*) FILTER (WHERE employed_overlap_days = 0) AS ranges_without_employment_intersection,
  count(*) FILTER (
    WHERE employed_overlap_days > 0 AND employed_overlap_days < assignment_days
  ) AS partially_employed_ranges,
  count(*) FILTER (WHERE employed_overlap_days = assignment_days) AS fully_employed_ranges,
  sum(assignment_days) AS assignment_days,
  sum(employed_overlap_days) AS employed_overlap_days,
  sum(outside_employment_days) AS outside_employment_days
FROM range_days`

const OWNERSHIP_MONTH_COVERAGE_SQL = `WITH employee_name_profile AS (
  SELECT
    full_name,
    count(*) AS matching_employees,
    count(*) FILTER (WHERE dept_id = 'D-CSM-01') AS matching_csm_employees
  FROM dim_employee
  GROUP BY full_name
), exact_csm_roster AS (
  SELECT e.*
  FROM dim_employee e
  JOIN employee_name_profile p ON e.full_name = p.full_name
  WHERE p.matching_employees = 1 AND p.matching_csm_employees = 1
), acquisition AS (
  SELECT customer_id, plan_name AS acquisition_plan
  FROM fct_arr_movements
  WHERE movement_type = 'new'
  QUALIFY row_number() OVER (
    PARTITION BY customer_id ORDER BY event_date, movement_id
  ) = 1
), active_months AS (
  SELECT
    s.month_start,
    last_day(s.month_start) AS month_end,
    s.customer_id,
    s.arr_usd,
    a.acquisition_plan
  FROM fct_subscription_snapshot_monthly s
  JOIN acquisition a USING (customer_id)
), resolved_months AS (
  SELECT
    am.*,
    assignment.csm_name,
    assignment.assigned_on,
    roster.hire_date,
    roster.termination_date
  FROM active_months am
  LEFT JOIN LATERAL (
    SELECT a.csm_name, a.assigned_on
    FROM stg_customer_csm_assignments a
    WHERE a.customer_id = am.customer_id
      AND a.assigned_on <= am.month_end
    ORDER BY a.assigned_on DESC, a.csm_name, a.assignment_reason
    LIMIT 1
  ) assignment ON true
  LEFT JOIN exact_csm_roster roster ON assignment.csm_name = roster.full_name
)
SELECT
  CASE WHEN grouping(acquisition_plan) = 1 THEN 'All plans' ELSE acquisition_plan END AS acquisition_plan,
  count(*) AS active_customer_months,
  count(csm_name) AS assigned_customer_months,
  round(100.0 * count(csm_name) / count(*), 1) AS assignment_coverage_pct,
  count(*) FILTER (
    WHERE csm_name IS NOT NULL
      AND assigned_on >= hire_date
      AND (termination_date IS NULL OR assigned_on <= termination_date)
      AND month_end >= hire_date
      AND (termination_date IS NULL OR month_end <= termination_date)
  ) AS employment_consistent_owner_customer_months,
  round(100.0 * count(*) FILTER (
    WHERE csm_name IS NOT NULL
      AND assigned_on >= hire_date
      AND (termination_date IS NULL OR assigned_on <= termination_date)
      AND month_end >= hire_date
      AND (termination_date IS NULL OR month_end <= termination_date)
  ) / count(*), 1) AS employment_consistent_owner_coverage_pct,
  round(sum(arr_usd), 2) AS total_active_arr_month_usd,
  round(coalesce(sum(arr_usd) FILTER (WHERE csm_name IS NOT NULL), 0), 2) AS assigned_arr_month_usd,
  round(100.0 * coalesce(sum(arr_usd) FILTER (WHERE csm_name IS NOT NULL), 0) / sum(arr_usd), 1) AS assignment_arr_coverage_pct
FROM resolved_months
GROUP BY GROUPING SETS ((acquisition_plan), ())
ORDER BY CASE WHEN acquisition_plan = 'All plans' THEN 0 ELSE 1 END, acquisition_plan`

const OWNERSHIP_ACTIVE_GAPS_SQL = `WITH acquisition AS (
  SELECT customer_id, plan_name AS acquisition_plan
  FROM fct_arr_movements
  WHERE movement_type = 'new'
  QUALIFY row_number() OVER (
    PARTITION BY customer_id ORDER BY event_date, movement_id
  ) = 1
), active_months AS (
  SELECT s.month_start, s.customer_id, s.arr_usd, a.acquisition_plan
  FROM fct_subscription_snapshot_monthly s
  JOIN acquisition a USING (customer_id)
), resolved_months AS (
  SELECT am.*, assignment.csm_name
  FROM active_months am
  LEFT JOIN LATERAL (
    SELECT a.csm_name
    FROM stg_customer_csm_assignments a
    WHERE a.customer_id = am.customer_id
      AND a.assigned_on <= last_day(am.month_start)
    ORDER BY a.assigned_on DESC, a.csm_name, a.assignment_reason
    LIMIT 1
  ) assignment ON true
), uncovered AS (
  SELECT
    *,
    lag(month_start) OVER (
      PARTITION BY customer_id ORDER BY month_start
    ) AS prior_uncovered_month
  FROM resolved_months
  WHERE csm_name IS NULL
), episode_rows AS (
  SELECT
    *,
    sum(CASE
      WHEN prior_uncovered_month IS NULL
        OR date_diff('month', prior_uncovered_month, month_start) <> 1
      THEN 1 ELSE 0 END
    ) OVER (
      PARTITION BY customer_id ORDER BY month_start
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS gap_episode
  FROM uncovered
), episodes AS (
  SELECT
    acquisition_plan,
    customer_id,
    gap_episode,
    count(*) AS uncovered_active_customer_months,
    sum(arr_usd) AS uncovered_arr_month_usd
  FROM episode_rows
  GROUP BY acquisition_plan, customer_id, gap_episode
)
SELECT
  acquisition_plan,
  count(*) AS gap_episodes,
  count(DISTINCT customer_id) AS customers_with_gap,
  sum(uncovered_active_customer_months) AS uncovered_active_customer_months,
  max(uncovered_active_customer_months) AS longest_gap_active_months,
  round(sum(uncovered_arr_month_usd), 2) AS uncovered_arr_month_usd
FROM episodes
GROUP BY acquisition_plan
ORDER BY acquisition_plan`

const OWNERSHIP_ACTIVE_GAPS_COLLAPSED_SQL = `WITH acquisition AS (
  SELECT customer_id, plan_name AS acquisition_plan
  FROM fct_arr_movements
  WHERE movement_type = 'new'
  QUALIFY row_number() OVER (
    PARTITION BY customer_id ORDER BY event_date, movement_id
  ) = 1
), active_months AS (
  SELECT s.month_start, s.customer_id, s.arr_usd, a.acquisition_plan
  FROM fct_subscription_snapshot_monthly s
  JOIN acquisition a USING (customer_id)
), uncovered AS (
  SELECT am.*
  FROM active_months am
  LEFT JOIN LATERAL (
    SELECT a.csm_name
    FROM stg_customer_csm_assignments a
    WHERE a.customer_id = am.customer_id
      AND a.assigned_on <= last_day(am.month_start)
    ORDER BY a.assigned_on DESC, a.csm_name, a.assignment_reason
    LIMIT 1
  ) assignment ON true
  WHERE assignment.csm_name IS NULL
), episodes AS (
  SELECT
    acquisition_plan,
    customer_id,
    date_diff('month', min(month_start), max(month_start)) + 1 AS uncovered_active_customer_months,
    sum(arr_usd) AS uncovered_arr_month_usd
  FROM uncovered
  GROUP BY acquisition_plan, customer_id
)
SELECT
  acquisition_plan,
  count(*) AS gap_episodes,
  count(DISTINCT customer_id) AS customers_with_gap,
  sum(uncovered_active_customer_months) AS uncovered_active_customer_months,
  max(uncovered_active_customer_months) AS longest_gap_active_months,
  round(sum(uncovered_arr_month_usd), 2) AS uncovered_arr_month_usd
FROM episodes
GROUP BY acquisition_plan
ORDER BY acquisition_plan`

const OWNERSHIP_JUNE_CONTROL_SQL = `WITH employee_name_profile AS (
  SELECT
    full_name,
    count(*) AS matching_employees,
    count(*) FILTER (WHERE dept_id = 'D-CSM-01') AS matching_csm_employees
  FROM dim_employee
  GROUP BY full_name
), exact_csm_roster AS (
  SELECT e.*
  FROM dim_employee e
  JOIN employee_name_profile p ON e.full_name = p.full_name
  WHERE p.matching_employees = 1 AND p.matching_csm_employees = 1
), latest_assignment AS (
  SELECT customer_id, csm_name, assigned_on
  FROM stg_customer_csm_assignments
  WHERE assigned_on <= DATE '2026-06-30'
  QUALIFY row_number() OVER (
    PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name, assignment_reason
  ) = 1
), june_rows AS (
  SELECT
    s.customer_id,
    s.arr_usd,
    assignment.csm_name,
    assignment.assigned_on,
    roster.hire_date,
    roster.termination_date
  FROM fct_subscription_snapshot_monthly s
  LEFT JOIN latest_assignment assignment USING (customer_id)
  LEFT JOIN exact_csm_roster roster ON assignment.csm_name = roster.full_name
  WHERE s.month_start = DATE '2026-06-01'
), classified AS (
  SELECT
    *,
    CASE
      WHEN csm_name IS NULL THEN 'unassigned'
      WHEN NOT (
        assigned_on >= hire_date
        AND (termination_date IS NULL OR assigned_on <= termination_date)
      ) THEN 'start outside owner employment'
      WHEN NOT (
        hire_date <= DATE '2026-06-30'
        AND (termination_date IS NULL OR termination_date >= DATE '2026-06-30')
      ) THEN 'currently unemployed owner'
      ELSE NULL
    END AS review_class
  FROM june_rows
)
SELECT
  count(*) AS june_active_customers,
  round(sum(arr_usd), 2) AS june_arr_usd,
  count(*) FILTER (WHERE csm_name IS NOT NULL) AS june_assigned_customers,
  count(*) FILTER (WHERE review_class = 'unassigned') AS june_unassigned_customers,
  round(coalesce(sum(arr_usd) FILTER (WHERE review_class = 'unassigned'), 0), 2) AS june_unassigned_arr_usd,
  count(*) FILTER (WHERE review_class = 'start outside owner employment') AS june_start_outside_employment_customers,
  round(coalesce(sum(arr_usd) FILTER (WHERE review_class = 'start outside owner employment'), 0), 2) AS june_start_outside_employment_arr_usd,
  count(*) FILTER (WHERE review_class = 'currently unemployed owner') AS june_currently_unemployed_owner_customers,
  count(review_class) AS june_review_customers,
  round(coalesce(sum(arr_usd) FILTER (WHERE review_class IS NOT NULL), 0), 2) AS june_review_arr_usd,
  round(100.0 * coalesce(sum(arr_usd) FILTER (WHERE review_class IS NOT NULL), 0) / sum(arr_usd), 1) AS june_review_arr_pct
FROM classified`

const OWNERSHIP_EXCEPTION_QUEUE_SQL = `WITH employee_name_profile AS (
  SELECT
    full_name,
    count(*) AS matching_employees,
    count(*) FILTER (WHERE dept_id = 'D-CSM-01') AS matching_csm_employees
  FROM dim_employee
  GROUP BY full_name
), exact_csm_roster AS (
  SELECT e.*
  FROM dim_employee e
  JOIN employee_name_profile p ON e.full_name = p.full_name
  WHERE p.matching_employees = 1 AND p.matching_csm_employees = 1
), latest_assignment AS (
  SELECT customer_id, csm_name, assigned_on
  FROM stg_customer_csm_assignments
  WHERE assigned_on <= DATE '2026-06-30'
  QUALIFY row_number() OVER (
    PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name, assignment_reason
  ) = 1
), june_rows AS (
  SELECT
    s.customer_id,
    c.customer_name AS current_customer_name,
    c.segment AS current_segment,
    s.arr_usd,
    assignment.csm_name,
    assignment.assigned_on,
    roster.hire_date,
    roster.termination_date
  FROM fct_subscription_snapshot_monthly s
  JOIN dim_customer c USING (customer_id)
  LEFT JOIN latest_assignment assignment USING (customer_id)
  LEFT JOIN exact_csm_roster roster ON assignment.csm_name = roster.full_name
  WHERE s.month_start = DATE '2026-06-01'
), classified AS (
  SELECT
    *,
    CASE
      WHEN csm_name IS NULL THEN 'unassigned'
      WHEN NOT (
        assigned_on >= hire_date
        AND (termination_date IS NULL OR assigned_on <= termination_date)
      ) THEN 'start outside owner employment'
      ELSE NULL
    END AS exception_class
  FROM june_rows
), ranked AS (
  SELECT
    *,
    row_number() OVER (
      PARTITION BY exception_class ORDER BY arr_usd DESC, customer_id
    ) AS class_rank
  FROM classified
  WHERE exception_class IS NOT NULL
)
SELECT
  exception_class,
  class_rank,
  customer_id,
  current_customer_name,
  current_segment,
  round(arr_usd, 2) AS june_arr_usd,
  csm_name AS latest_csm_name,
  assigned_on AS latest_csm_assigned_on,
  hire_date AS owner_hire_date,
  termination_date AS owner_termination_date
FROM ranked
WHERE class_rank <= 10
ORDER BY exception_class, class_rank`

const OWNERSHIP_HANDOFF_SQL = `WITH employee_name_profile AS (
  SELECT
    full_name,
    count(*) AS matching_employees,
    count(*) FILTER (WHERE dept_id = 'D-CSM-01') AS matching_csm_employees
  FROM dim_employee
  GROUP BY full_name
), exact_csm_roster AS (
  SELECT e.*
  FROM dim_employee e
  JOIN employee_name_profile p ON e.full_name = p.full_name
  WHERE p.matching_employees = 1 AND p.matching_csm_employees = 1
), assignment_control AS (
  SELECT
    count(*) AS assignment_rows,
    count(DISTINCT a.customer_id) AS assigned_customers,
    count(*) FILTER (
      WHERE a.assigned_on < r.hire_date
         OR (r.termination_date IS NOT NULL AND a.assigned_on > r.termination_date)
    ) AS employment_exception_rows
  FROM stg_customer_csm_assignments a
  JOIN exact_csm_roster r ON a.csm_name = r.full_name
), assignment_states AS (
  SELECT a.*, state.arr_after_usd AS point_in_time_arr_usd
  FROM stg_customer_csm_assignments a
  LEFT JOIN LATERAL (
    SELECT m.arr_after_usd
    FROM fct_arr_movements m
    WHERE m.customer_id = a.customer_id
      AND m.event_date <= a.assigned_on
    ORDER BY m.event_date DESC, m.movement_id DESC
    LIMIT 1
  ) state ON true
), state_control AS (
  SELECT count(*) FILTER (
    WHERE round(point_in_time_arr_usd * 100)::BIGINT = 0
  ) AS zero_arr_assignment_rows
  FROM assignment_states
), sequenced AS (
  SELECT
    a.*,
    row_number() OVER customer_history AS assignment_ordinal,
    lag(csm_name) OVER customer_history AS prior_csm_name,
    count(*) OVER (
      PARTITION BY customer_id, csm_name
      ORDER BY assigned_on, assignment_reason
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS prior_same_owner_rows
  FROM stg_customer_csm_assignments a
  WINDOW customer_history AS (
    PARTITION BY customer_id ORDER BY assigned_on, csm_name, assignment_reason
  )
), transition_evidence AS (
  SELECT s.*, prior_owner.termination_date AS prior_owner_termination_date
  FROM sequenced s
  LEFT JOIN exact_csm_roster prior_owner ON s.prior_csm_name = prior_owner.full_name
), transition_control AS (
  SELECT
    count(*) FILTER (
      WHERE assignment_ordinal > 1 AND csm_name IS NOT DISTINCT FROM prior_csm_name
    ) AS adjacent_noop_rows,
    count(*) FILTER (WHERE prior_same_owner_rows > 0) AS repeated_owner_rows,
    count(*) FILTER (WHERE assignment_reason = 'CSM departure')
      - count(*) FILTER (
        WHERE assignment_reason = 'CSM departure'
          AND prior_owner_termination_date <= assigned_on
      ) AS departure_reason_without_timing_support_rows
  FROM transition_evidence
), assignment_ranges AS (
  SELECT
    a.*,
    lead(assigned_on, 1, DATE '2026-07-01') OVER (
      PARTITION BY customer_id ORDER BY assigned_on, csm_name, assignment_reason
    ) AS range_end_exclusive
  FROM stg_customer_csm_assignments a
), range_control AS (
  SELECT sum(
    date_diff('day', a.assigned_on, a.range_end_exclusive)
    - greatest(0, date_diff(
      'day',
      greatest(a.assigned_on, r.hire_date),
      least(
        a.range_end_exclusive,
        coalesce(r.termination_date + INTERVAL '1 day', DATE '2026-07-01')
      )
    ))
  ) AS outside_employment_days
  FROM assignment_ranges a
  JOIN exact_csm_roster r ON a.csm_name = r.full_name
), acquisition AS (
  SELECT customer_id, plan_name AS acquisition_plan
  FROM fct_arr_movements
  WHERE movement_type = 'new'
  QUALIFY row_number() OVER (
    PARTITION BY customer_id ORDER BY event_date, movement_id
  ) = 1
), active_months AS (
  SELECT
    s.month_start,
    last_day(s.month_start) AS month_end,
    s.customer_id,
    s.arr_usd,
    a.acquisition_plan
  FROM fct_subscription_snapshot_monthly s
  JOIN acquisition a USING (customer_id)
), active_month_control AS (
  SELECT
    count(*) AS active_customer_months,
    sum(arr_usd) AS total_active_arr_month_usd
  FROM active_months
), resolved_months AS (
  SELECT
    am.*,
    assignment.csm_name,
    assignment.assigned_on,
    roster.hire_date,
    roster.termination_date
  FROM active_months am
  LEFT JOIN LATERAL (
    SELECT a.csm_name, a.assigned_on
    FROM stg_customer_csm_assignments a
    WHERE a.customer_id = am.customer_id
      AND a.assigned_on <= am.month_end
    ORDER BY a.assigned_on DESC, a.csm_name, a.assignment_reason
    LIMIT 1
  ) assignment ON true
  LEFT JOIN exact_csm_roster roster ON assignment.csm_name = roster.full_name
), month_assignment_control AS (
  SELECT
    count(csm_name) AS assigned_customer_months,
    count(*) FILTER (
      WHERE csm_name IS NOT NULL
        AND assigned_on >= hire_date
        AND (termination_date IS NULL OR assigned_on <= termination_date)
        AND month_end >= hire_date
        AND (termination_date IS NULL OR month_end <= termination_date)
    ) AS employment_consistent_owner_customer_months,
    coalesce(sum(arr_usd) FILTER (WHERE csm_name IS NOT NULL), 0) AS assigned_arr_month_usd
  FROM resolved_months
), uncovered AS (
  SELECT
    *,
    lag(month_start) OVER (
      PARTITION BY customer_id ORDER BY month_start
    ) AS prior_uncovered_month
  FROM resolved_months
  WHERE csm_name IS NULL
), gap_rows AS (
  SELECT
    *,
    sum(CASE
      WHEN prior_uncovered_month IS NULL
        OR date_diff('month', prior_uncovered_month, month_start) <> 1
      THEN 1 ELSE 0 END
    ) OVER (
      PARTITION BY customer_id ORDER BY month_start
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS gap_episode
  FROM uncovered
), gap_control AS (
  SELECT count(*) AS gap_episodes
  FROM (
    SELECT customer_id, gap_episode
    FROM gap_rows
    GROUP BY customer_id, gap_episode
  )
), june_latest_assignment AS (
  SELECT customer_id, csm_name, assigned_on
  FROM stg_customer_csm_assignments
  WHERE assigned_on <= DATE '2026-06-30'
  QUALIFY row_number() OVER (
    PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name, assignment_reason
  ) = 1
), june_rows AS (
  SELECT
    s.customer_id,
    s.arr_usd,
    assignment.csm_name,
    assignment.assigned_on,
    roster.hire_date,
    roster.termination_date
  FROM fct_subscription_snapshot_monthly s
  LEFT JOIN june_latest_assignment assignment USING (customer_id)
  LEFT JOIN exact_csm_roster roster ON assignment.csm_name = roster.full_name
  WHERE s.month_start = DATE '2026-06-01'
), june_classified AS (
  SELECT
    *,
    CASE
      WHEN csm_name IS NULL THEN 'unassigned'
      WHEN NOT (
        assigned_on >= hire_date
        AND (termination_date IS NULL OR assigned_on <= termination_date)
      ) THEN 'start outside owner employment'
      WHEN NOT (
        hire_date <= DATE '2026-06-30'
        AND (termination_date IS NULL OR termination_date >= DATE '2026-06-30')
      ) THEN 'currently unemployed owner'
      ELSE NULL
    END AS review_class
  FROM june_rows
), june_control AS (
  SELECT
    count(*) AS june_active_customers,
    count(csm_name) AS june_assigned_customers,
    count(*) FILTER (WHERE review_class = 'unassigned') AS june_unassigned_customers,
    coalesce(sum(arr_usd) FILTER (WHERE review_class = 'unassigned'), 0) AS june_unassigned_arr_usd,
    count(*) FILTER (
      WHERE review_class = 'start outside owner employment'
    ) AS june_start_outside_employment_customers,
    coalesce(sum(arr_usd) FILTER (
      WHERE review_class = 'start outside owner employment'
    ), 0) AS june_start_outside_employment_arr_usd,
    count(*) FILTER (
      WHERE review_class = 'currently unemployed owner'
    ) AS june_currently_unemployed_owner_customers,
    count(*) FILTER (WHERE review_class IS NOT NULL) AS june_review_customers,
    coalesce(sum(arr_usd) FILTER (WHERE review_class IS NOT NULL), 0) AS june_review_arr_usd,
    sum(arr_usd) AS june_arr_usd
  FROM june_classified
)
SELECT
  a.assignment_rows,
  a.assigned_customers,
  a.employment_exception_rows,
  s.zero_arr_assignment_rows,
  t.adjacent_noop_rows,
  t.repeated_owner_rows,
  t.departure_reason_without_timing_support_rows,
  r.outside_employment_days,
  am.active_customer_months,
  mc.assigned_customer_months,
  round(100.0 * mc.assigned_customer_months / am.active_customer_months, 1) AS assignment_coverage_pct,
  mc.employment_consistent_owner_customer_months,
  round(100.0 * mc.employment_consistent_owner_customer_months / am.active_customer_months, 1) AS employment_consistent_owner_coverage_pct,
  round(am.total_active_arr_month_usd, 2) AS total_active_arr_month_usd,
  round(mc.assigned_arr_month_usd, 2) AS assigned_arr_month_usd,
  round(100.0 * mc.assigned_arr_month_usd / am.total_active_arr_month_usd, 1) AS assignment_arr_coverage_pct,
  g.gap_episodes,
  j.june_active_customers,
  round(j.june_arr_usd, 2) AS june_arr_usd,
  j.june_assigned_customers,
  j.june_unassigned_customers,
  round(j.june_unassigned_arr_usd, 2) AS june_unassigned_arr_usd,
  j.june_start_outside_employment_customers,
  round(j.june_start_outside_employment_arr_usd, 2) AS june_start_outside_employment_arr_usd,
  j.june_currently_unemployed_owner_customers,
  j.june_review_customers,
  round(j.june_review_arr_usd, 2) AS june_review_arr_usd,
  round(100.0 * j.june_review_arr_usd / j.june_arr_usd, 1) AS june_review_arr_pct
FROM assignment_control a
CROSS JOIN state_control s
CROSS JOIN transition_control t
CROSS JOIN range_control r
CROSS JOIN active_month_control am
CROSS JOIN month_assignment_control mc
CROSS JOIN gap_control g
CROSS JOIN june_control j`

export const MISSIONS = [
  {
    id: 'm01',
    part: 1,
    title: 'How big is this place?',
    from: 'priya',
    ask: `ARCHIVED OPERATING QUEUE · 2026\n\nI'm Riff — CFO in this incident replay. Our previous analyst left two Fridays ago, so the warehouse is yours. First thing every new hire did: find out how big it was. Ask the general ledger to count every transaction line it has. The query's already written — just press Run.`,
    deliverable: `One number: the count of all rows in fct_gl_transactions.`,
    tables: ['fct_gl_transactions'],
    prefill: `SELECT count(*) AS transaction_lines\nFROM fct_gl_transactions;`,
    canonical: `SELECT count(*) AS transaction_lines FROM fct_gl_transactions`,
    ordered: false,
    hints: [
      `Just press Run — the query is already written. SELECT count(*) means "count every row." FROM names the table.`,
      `SELECT count(*) AS transaction_lines\nFROM fct_gl_transactions;`,
      `SELECT count(*) AS transaction_lines\nFROM fct_gl_transactions;\n\ncount(*) counts rows; FROM says which table; AS just gives the answer a readable name. That's the whole query. Every query you'll ever write starts with this skeleton: SELECT what, FROM where.`,
    ],
    sayIt: `"I'd start any new table by checking its row count and asking what one row represents — here, one row is one GL line."`,
    successNote: `Excel tops out at 1,048,576 rows. You just queried more than double that, in a tenth of a second. This is why finance teams at Figma and Datadog live in the warehouse — and you're now someone who queries it.`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm02',
    part: 1,
    title: 'One number for the board deck',
    from: 'priya',
    ask: `Board meeting Thursday. I need one number sanity-checked: total subscription revenue for March 2026. Subscription revenue books to account 4000 in the GL — filter to that account and that month, and sum the amount.`,
    deliverable: `One number: the sum of amount for account_id '4000', transactions dated March 1–31, 2026.`,
    tables: ['fct_gl_transactions'],
    canonical: `SELECT round(sum(amount), 2) AS subscription_revenue FROM fct_gl_transactions WHERE account_id = '4000' AND txn_date BETWEEN DATE '2026-03-01' AND DATE '2026-03-31'`,
    ordered: false,
    hints: [
      `This is a SUMIFS. In Excel: SUMIFS(amount, account, "4000", date, ">=" & Mar 1). In SQL, the conditions go in WHERE: filter rows first, then SUM what's left.`,
      `SELECT sum(amount)\nFROM fct_gl_transactions\nWHERE account_id = '____'\n  AND txn_date BETWEEN DATE '____-__-01' AND DATE '____-__-31';`,
      `SELECT sum(amount)\nFROM fct_gl_transactions\nWHERE account_id = '4000'\n  AND txn_date BETWEEN DATE '2026-03-01' AND DATE '2026-03-31';\n\nWHERE keeps only the rows that match (like a filter), then sum() adds up what survived. Text values like '4000' take single quotes; dates are written 'YYYY-MM-DD'.`,
    ],
    sayIt: `"I filtered the GL to the subscription revenue account and the month, then summed — a SUMIFS, but on two million rows."`,
    jdCompanies: ['Harvey'],
  },
  {
    id: 'm03',
    part: 1,
    title: 'Our ten biggest customers',
    from: 'priya',
    ask: `I'm prepping the enterprise business review. Who are our ten biggest customers by ARR right now? "Right now" in this warehouse means the latest month-end snapshot — June 2026. One habit worth stealing from day one: before using a new table, ask "what is one row here?" For fct_subscription_snapshot_monthly, one row = one customer in one month.`,
    deliverable: `Ten rows: customer_id and arr_usd from the June 2026 snapshot, sorted biggest ARR first, top 10 only.`,
    tables: ['fct_subscription_snapshot_monthly'],
    canonical: `SELECT customer_id, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01' ORDER BY arr_usd DESC LIMIT 10`,
    ordered: true,
    orderedNote: 'biggest ARR first',
    hints: [
      `Filter to one month first (month_start = the first of the month) — this table has one row per customer per MONTH, so without it the same customer shows up once for every month they've been active. Then it's a sort: ORDER BY ... DESC is "Sort Largest to Smallest," and LIMIT 10 keeps the top ten.`,
      `SELECT customer_id, arr_usd\nFROM fct_subscription_snapshot_monthly\nWHERE month_start = DATE '____-__-01'\nORDER BY ____ DESC\nLIMIT 10;`,
      `SELECT customer_id, arr_usd\nFROM fct_subscription_snapshot_monthly\nWHERE month_start = DATE '2026-06-01'\nORDER BY arr_usd DESC\nLIMIT 10;\n\nThe WHERE is doing the real work: without it you'd be mixing months together. Stating a table's grain out loud before querying it is the single most interviewer-impressing habit that exists.`,
    ],
    sayIt: `"The snapshot table's grain is customer-month, so I pinned it to the latest month before ranking — otherwise the same customer shows up once per active month."`,
    jdCompanies: ['Instacart'],
  },
  {
    id: 'm04',
    part: 2,
    title: 'The revenue trend, by month',
    from: 'priya',
    ask: `I want the 2025 revenue story in one table: total revenue by month, January through December. Revenue lives in two GL accounts — 4000 (subscription) and 4010 (usage). This is your first GROUP BY, and here's the secret: GROUP BY is a pivot table. The column you GROUP BY is the Rows area; the SUM is the Values area.`,
    deliverable: `Twelve rows: the month (as a date, first-of-month) and total revenue (sum of amount for accounts 4000 and 4010) for each month of 2025, in chronological order.`,
    tables: ['fct_gl_transactions'],
    canonical: `SELECT date_trunc('month', txn_date)::DATE AS month, round(sum(amount), 2) AS revenue FROM fct_gl_transactions WHERE account_id IN ('4000', '4010') AND txn_date BETWEEN DATE '2025-01-01' AND DATE '2025-12-31' GROUP BY 1 ORDER BY 1`,
    ordered: true,
    orderedNote: 'January first',
    hints: [
      `Pivot-table thinking: Rows = month, Values = SUM(amount), Filter = the two revenue accounts + year 2025. date_trunc('month', txn_date) turns any date into its month — that's your Rows column. And IN ('4000','4010') is a filter that accepts either value.`,
      `SELECT date_trunc('month', txn_date) AS month,\n       sum(amount) AS revenue\nFROM fct_gl_transactions\nWHERE account_id IN ('____', '____')\n  AND txn_date BETWEEN DATE '2025-01-01' AND DATE '2025-12-31'\nGROUP BY month\nORDER BY month;`,
      `SELECT date_trunc('month', txn_date) AS month,\n       sum(amount) AS revenue\nFROM fct_gl_transactions\nWHERE account_id IN ('4000', '4010')\n  AND txn_date BETWEEN DATE '2025-01-01' AND DATE '2025-12-31'\nGROUP BY month\nORDER BY month;\n\nGROUP BY collapses the millions of GL lines into one row per month — exactly what dragging a date field into a pivot's Rows area does. AS gives a column a readable name.`,
    ],
    sayIt: `"I bucketed transactions to month with date_trunc and grouped — GROUP BY is the pivot table of SQL."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm05',
    part: 2,
    title: 'Where the money goes',
    from: 'elena',
    ask: `Rex here — Controller. Riff wants opex by department for Q1 2026 at her staff meeting. In our chart of accounts, operating expense account ids start with 6 or 7. Group the GL by department and sum. Fair warning: the department column is going to look like robot-speak. That's tomorrow's problem.`,
    deliverable: `One row per department: dept_id and total opex (sum of amount, accounts starting with 6 or 7, Jan 1 – Mar 31 2026), sorted biggest spend first.`,
    tables: ['fct_gl_transactions'],
    canonical: `SELECT dept_id, round(sum(amount), 2) AS opex FROM fct_gl_transactions WHERE (account_id LIKE '6%' OR account_id LIKE '7%') AND txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-03-31' GROUP BY dept_id ORDER BY opex DESC`,
    ordered: true,
    orderedNote: 'biggest spend first',
    fingerprintSQL: `SELECT dept_id, round(sum(amount), 2) AS opex FROM fct_gl_transactions WHERE account_id LIKE '6%' OR account_id LIKE '7%' AND txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-03-31' GROUP BY dept_id ORDER BY opex DESC`,
    fingerprintMessage: `Your row count looks right, but the 6000-series spend ignored the date window. SQL reads AND before OR, so without parentheses this means “all 6s, or Q1 7s.” Wrap the two account tests together — (starts with 6 OR starts with 7) — then apply the date with AND.`,
    hints: [
      `LIKE '6%' is a wildcard match — the % works like the * in Excel's filters, so account_id LIKE '6%' means "starts with 6." You need starts-with-6 OR starts-with-7, and parentheses around that OR so it doesn't tangle with the date filter.`,
      `SELECT dept_id, sum(amount) AS opex\nFROM fct_gl_transactions\nWHERE (account_id LIKE '__%' OR account_id LIKE '__%')\n  AND txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-03-31'\nGROUP BY dept_id\nORDER BY opex DESC;`,
      `SELECT dept_id, sum(amount) AS opex\nFROM fct_gl_transactions\nWHERE (account_id LIKE '6%' OR account_id LIKE '7%')\n  AND txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-03-31'\nGROUP BY dept_id\nORDER BY opex DESC;\n\nThe parentheses matter: without them, SQL reads A OR (B AND C) and quietly gives you the wrong rows — the closest thing SQL has to a mis-nested IF.`,
    ],
    sayIt: `"Opex accounts are the 6000s and 7000s in our chart, so I pattern-matched on the account id and grouped by department."`,
    successNote: `See those D-ENG-01 codes? Riff can't read those either. Next ask, you'll bring in the humans' names — that move is called a join, and it's the XLOOKUP you already know.`,
    jdCompanies: ['Harvey'],
  },
  {
    id: 'm06',
    part: 3,
    title: 'Names, not codes',
    from: 'priya',
    ask: `That opex pull was right, but I'm not putting D-ENG-01 on a slide. Department names live in a lookup table, dim_department. Bring the name in. You already know this move — it's an XLOOKUP: you're in the GL and you want a column from the department table, matched on dept_id. In SQL it's called JOIN, and it brings back the whole matching row.`,
    deliverable: `One row per department: dept_name (from dim_department) and total opex (accounts starting 6 or 7, Q1 2026), sorted biggest spend first.`,
    tables: ['fct_gl_transactions', 'dim_department'],
    canonical: `SELECT d.dept_name, round(sum(g.amount), 2) AS opex FROM fct_gl_transactions g JOIN dim_department d ON g.dept_id = d.dept_id WHERE (g.account_id LIKE '6%' OR g.account_id LIKE '7%') AND g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-03-31' GROUP BY d.dept_name ORDER BY opex DESC`,
    ordered: true,
    orderedNote: 'biggest spend first',
    hints: [
      `JOIN dim_department d ON g.dept_id = d.dept_id — read it as "look up each GL row's dept_id in the department table." The single letters (g, d) are nicknames so you can say g.amount and d.dept_name without typing full table names.`,
      `SELECT d.dept_name, sum(g.amount) AS opex\nFROM fct_gl_transactions g\nJOIN dim_department d ON g.____ = d.____\nWHERE (g.account_id LIKE '6%' OR g.account_id LIKE '7%')\n  AND g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-03-31'\nGROUP BY d.dept_name\nORDER BY opex DESC;`,
      `SELECT d.dept_name, sum(g.amount) AS opex\nFROM fct_gl_transactions g\nJOIN dim_department d ON g.dept_id = d.dept_id\nWHERE (g.account_id LIKE '6%' OR g.account_id LIKE '7%')\n  AND g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-03-31'\nGROUP BY d.dept_name\nORDER BY opex DESC;\n\nOne difference from XLOOKUP to keep in your pocket: XLOOKUP returns the FIRST match; JOIN returns EVERY match. Here dim_department has exactly one row per dept_id, so they behave the same. When the lookup table has several rows per key… that's a story for a later ask.`,
    ],
    sayIt: `"I joined the GL to the department dimension on dept_id — fact tables carry ids, dims carry the names, and the join stitches them."`,
    jdCompanies: ['Instacart'],
  },
  {
    id: 'm07',
    part: 3,
    title: 'Revenue by segment',
    from: 'priya',
    ask: `The board wants revenue split by customer segment — SMB, Mid-Market, Enterprise — for the first half of 2026. Segment lives on dim_customer; revenue is accounts 4000 and 4010 in the GL, and revenue lines carry a customer_id. Same XLOOKUP move, different lookup table.`,
    deliverable: `Three rows: segment and total revenue (accounts 4000 + 4010, Jan 1 – Jun 30 2026), sorted biggest first.`,
    tables: ['fct_gl_transactions', 'dim_customer'],
    canonical: `SELECT c.segment, round(sum(g.amount), 2) AS revenue FROM fct_gl_transactions g JOIN dim_customer c ON g.customer_id = c.customer_id WHERE g.account_id IN ('4000', '4010') AND g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-06-30' GROUP BY c.segment ORDER BY revenue DESC`,
    ordered: true,
    orderedNote: 'biggest first',
    hints: [
      `Identical shape to the department join: JOIN dim_customer c ON g.customer_id = c.customer_id, then GROUP BY c.segment. The join key changed; the move didn't.`,
      `SELECT c.segment, sum(g.amount) AS revenue\nFROM fct_gl_transactions g\nJOIN dim_customer c ON g.customer_id = c.customer_id\nWHERE g.account_id IN ('____', '____')\n  AND g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-06-30'\nGROUP BY c.segment\nORDER BY revenue DESC;`,
      `SELECT c.segment, sum(g.amount) AS revenue\nFROM fct_gl_transactions g\nJOIN dim_customer c ON g.customer_id = c.customer_id\nWHERE g.account_id IN ('4000', '4010')\n  AND g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-06-30'\nGROUP BY c.segment\nORDER BY revenue DESC;\n\nNotice you can filter on one table's columns and group by another's — after the join they're one wide sheet.`,
    ],
    sayIt: `"Revenue lines carry customer_id, so I joined to the customer dim and grouped by segment — one fact, one dim, the everyday warehouse pattern."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm08',
    part: 3,
    title: 'ARR by success manager',
    from: 'elena',
    ask: `Customer Success wants each CSM's book of business: current ARR (June 2026 snapshot) by csm_name. Assignments live in stg_customer_csm_assignments. Heads up — the previous analyst once burned an afternoon on this exact pull. See if you can spot why before the warehouse tells you.`,
    deliverable: `One row per CSM: csm_name and their customers' total June-2026 ARR, sorted biggest book first. Each customer counts once, under their CURRENT (latest-assigned) CSM.`,
    tables: ['fct_subscription_snapshot_monthly', 'stg_customer_csm_assignments'],
    canonical: `WITH latest AS (SELECT customer_id, csm_name FROM stg_customer_csm_assignments QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC) = 1) SELECT l.csm_name, round(sum(s.arr_usd), 2) AS book_arr FROM fct_subscription_snapshot_monthly s JOIN latest l ON s.customer_id = l.customer_id WHERE s.month_start = DATE '2026-06-01' GROUP BY l.csm_name ORDER BY book_arr DESC`,
    ordered: true,
    orderedNote: 'biggest book first',
    fingerprintSQL: `SELECT a.csm_name, round(sum(s.arr_usd), 2) AS book_arr FROM fct_subscription_snapshot_monthly s JOIN stg_customer_csm_assignments a ON s.customer_id = a.customer_id WHERE s.month_start = DATE '2026-06-01' GROUP BY a.csm_name ORDER BY book_arr DESC`,
    fingerprintMessage: `Add up your ARR column — it comes to far more than Star67's entire ARR. This is the trap the previous analyst hit: the assignments table has SEVERAL rows per customer (their whole assignment history), so the join counted each customer's ARR once per assignment. XLOOKUP returns the first match; JOIN returns every match. You need just the LATEST assignment per customer — hint 1 shows the move.`,
    hints: [
      `The assignments table is a history — run a quick check: SELECT customer_id, count(*) FROM stg_customer_csm_assignments GROUP BY customer_id HAVING count(*) > 1. Customers appear multiple times, so a straight join double-counts. You need one row per customer first: their latest assignment (the max assigned_on).`,
      `WITH latest AS (\n  SELECT customer_id, csm_name\n  FROM stg_customer_csm_assignments\n  QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC) = 1\n)\nSELECT l.csm_name, sum(s.arr_usd) AS book_arr\nFROM fct_subscription_snapshot_monthly s\nJOIN latest l ON s.customer_id = l.customer_id\nWHERE s.month_start = DATE '____-__-01'\nGROUP BY l.csm_name\nORDER BY book_arr DESC;`,
      `WITH latest AS (\n  SELECT customer_id, csm_name\n  FROM stg_customer_csm_assignments\n  QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC) = 1\n)\nSELECT l.csm_name, sum(s.arr_usd) AS book_arr\nFROM fct_subscription_snapshot_monthly s\nJOIN latest l ON s.customer_id = l.customer_id\nWHERE s.month_start = DATE '2026-06-01'\nGROUP BY l.csm_name\nORDER BY book_arr DESC;\n\nTwo pro moves at once: WITH gives a sub-result a name (a CTE — think "a helper tab you build first"), and QUALIFY row_number() = 1 means "rank each customer's rows newest-first, keep #1." "Latest record per key" is one of the most-asked warehouse patterns in interviews — this exact move.`,
    ],
    sayIt: `"The assignments table has multiple rows per customer, so I deduped to the latest with row_number over a partition by customer — then the join is safe. Checking a lookup table's grain before joining is the habit."`,
    jdCompanies: ['Hightouch', '1Password'],
  },
  {
    id: 'm09',
    part: 4,
    title: 'Budget vs actuals — find the overspend',
    from: 'priya',
    ask: `Variance reviews start Monday. For the first half of 2025: opex by department, actuals against the FY2025 Plan, biggest overspend first. Budget lives in fct_budget (it's by month × account × department — plan versions in version_name; the department there is a NAME, not an id, because the plan comes from Excel uploads). One warning from experience: some departments spend without a budget line. If your join silently drops those, you'll miss exactly what a variance review exists to catch.`,
    deliverable: `One row per department that has actuals or budget: dept_name, actual opex (GL accounts starting 6/7, Jan–Jun 2025), FY2025 Plan budget for the same accounts and months (0 where unplanned), and variance (actual − budget), sorted by variance, biggest overspend first.`,
    tables: ['fct_gl_transactions', 'fct_budget', 'dim_department'],
    canonical: `WITH actuals AS (SELECT g.dept_id, sum(g.amount) AS actual FROM fct_gl_transactions g WHERE (g.account_id LIKE '6%' OR g.account_id LIKE '7%') AND g.txn_date BETWEEN DATE '2025-01-01' AND DATE '2025-06-30' GROUP BY g.dept_id), plan AS (SELECT b.dept_name_raw AS dept_name, sum(b.amount_usd) AS budget FROM fct_budget b WHERE b.version_name = 'FY2025 Plan' AND (b.account_id LIKE '6%' OR b.account_id LIKE '7%') AND b.fiscal_month BETWEEN DATE '2025-01-01' AND DATE '2025-06-01' GROUP BY 1) SELECT d.dept_name, round(a.actual, 2) AS actual, round(COALESCE(p.budget, 0), 2) AS budget, round(a.actual - COALESCE(p.budget, 0), 2) AS variance FROM actuals a JOIN dim_department d ON d.dept_id = a.dept_id LEFT JOIN plan p ON p.dept_name = d.dept_name ORDER BY variance DESC`,
    ordered: true,
    orderedNote: 'biggest overspend first',
    fingerprintSQL: `WITH actuals AS (SELECT g.dept_id, sum(g.amount) AS actual FROM fct_gl_transactions g WHERE (g.account_id LIKE '6%' OR g.account_id LIKE '7%') AND g.txn_date BETWEEN DATE '2025-01-01' AND DATE '2025-06-30' GROUP BY g.dept_id), plan AS (SELECT b.dept_name_raw AS dept_name, sum(b.amount_usd) AS budget FROM fct_budget b WHERE b.version_name = 'FY2025 Plan' AND (b.account_id LIKE '6%' OR b.account_id LIKE '7%') AND b.fiscal_month BETWEEN DATE '2025-01-01' AND DATE '2025-06-01' GROUP BY 1) SELECT d.dept_name, round(a.actual, 2) AS actual, round(COALESCE(p.budget, 0), 2) AS budget, round(a.actual - COALESCE(p.budget, 0), 2) AS variance FROM actuals a JOIN dim_department d ON d.dept_id = a.dept_id JOIN plan p ON p.dept_name = d.dept_name ORDER BY variance DESC`,
    fingerprintMessage: `Data & Analytics disappeared because its actual spend has no matching plan row. That's exactly the exception this review needs to expose: keep every actuals department with a LEFT JOIN to plan, then COALESCE the missing budget to 0.`,
    hints: [
      `Two pivot tables, then a lookup between them: a CTE for actuals-by-department (from the GL) and a CTE for budget-by-department (fct_budget, version_name = 'FY2025 Plan' — its months run first-of-month Jan through Jun). Then join them through dim_department, because actuals speak dept_id and budget speaks dept_name. Use a LEFT JOIN onto the budget so departments with no plan line survive, and COALESCE(budget, 0) to turn their missing budget into a zero.`,
      `WITH actuals AS (\n  SELECT dept_id, sum(amount) AS actual\n  FROM fct_gl_transactions\n  WHERE (account_id LIKE '6%' OR account_id LIKE '7%')\n    AND txn_date BETWEEN DATE '2025-01-01' AND DATE '2025-06-30'\n  GROUP BY dept_id\n),\nplan AS (\n  SELECT dept_name_raw AS dept_name, sum(amount_usd) AS budget\n  FROM fct_budget\n  WHERE version_name = '____'\n    AND (account_id LIKE '6%' OR account_id LIKE '7%')\n    AND fiscal_month BETWEEN DATE '2025-01-01' AND DATE '2025-06-01'\n  GROUP BY 1\n)\nSELECT d.dept_name,\n       a.actual,\n       COALESCE(p.budget, 0) AS budget,\n       a.actual - COALESCE(p.budget, 0) AS variance\nFROM actuals a\nJOIN dim_department d ON d.dept_id = a.dept_id\nLEFT JOIN plan p ON p.dept_name = d.dept_name\nORDER BY variance DESC;`,
      `WITH actuals AS (\n  SELECT dept_id, sum(amount) AS actual\n  FROM fct_gl_transactions\n  WHERE (account_id LIKE '6%' OR account_id LIKE '7%')\n    AND txn_date BETWEEN DATE '2025-01-01' AND DATE '2025-06-30'\n  GROUP BY dept_id\n),\nplan AS (\n  SELECT dept_name_raw AS dept_name, sum(amount_usd) AS budget\n  FROM fct_budget\n  WHERE version_name = 'FY2025 Plan'\n    AND (account_id LIKE '6%' OR account_id LIKE '7%')\n    AND fiscal_month BETWEEN DATE '2025-01-01' AND DATE '2025-06-01'\n  GROUP BY 1\n)\nSELECT d.dept_name,\n       round(a.actual, 2) AS actual,\n       round(COALESCE(p.budget, 0), 2) AS budget,\n       round(a.actual - COALESCE(p.budget, 0), 2) AS variance\nFROM actuals a\nJOIN dim_department d ON d.dept_id = a.dept_id\nLEFT JOIN plan p ON p.dept_name = d.dept_name\nORDER BY variance DESC;\n\nThe LEFT JOIN is the whole lesson. An INNER JOIN would silently drop any department missing from the plan — and one of Star67's departments was reorganized after the plan was locked, so its spend has no budget line. LEFT JOIN + COALESCE(…, 0) keeps it visible with a zero budget. This exact move is the signature FP&A query.`,
    ],
    sayIt: `"Budget-to-actuals is two aggregations joined through the department dim — and it's a LEFT join with COALESCE, because a department with spend and no budget line is precisely what a variance review needs to surface."`,
    jdCompanies: ['Cockroach Labs'],
  },
  {
    id: 'm10',
    part: 4,
    title: `The reforecast that came back from Excel`,
    from: 'elena',
    ask: `We reforecast Q2 2025 mid-year — version_name 'FY2025 Q2 Reforecast' in fct_budget. Except the file came back from department heads' spreadsheets, and the department names came back… creative: 'ENGINEERING ', ' sales - enterprise', 'Marketing'. Same department, three spellings. Give me total reforecast opex by CLEAN department name — every variant folded into one row. TRIM() strips stray spaces; UPPER() levels the casing.`,
    deliverable: `One row per department: the clean dept_name from dim_department, and total reforecast amount (version 'FY2025 Q2 Reforecast', accounts starting 6/7, all its months), sorted biggest first.`,
    tables: ['fct_budget', 'dim_department'],
    canonical: `SELECT d.dept_name, round(sum(b.amount_usd), 2) AS reforecast FROM fct_budget b JOIN dim_department d ON upper(trim(b.dept_name_raw)) = upper(d.dept_name) WHERE b.version_name = 'FY2025 Q2 Reforecast' AND (b.account_id LIKE '6%' OR b.account_id LIKE '7%') GROUP BY d.dept_name ORDER BY reforecast DESC`,
    ordered: true,
    orderedNote: 'biggest first',
    fingerprintSQL: `SELECT d.dept_name, round(sum(b.amount_usd), 2) AS reforecast FROM fct_budget b JOIN dim_department d ON b.dept_name_raw = d.dept_name WHERE b.version_name = 'FY2025 Q2 Reforecast' AND (b.account_id LIKE '6%' OR b.account_id LIKE '7%') GROUP BY d.dept_name ORDER BY reforecast DESC`,
    fingerprintMessage: `Close — but you joined on the raw upload names, so every row spelled 'ENGINEERING ' or ' sales - enterprise' silently fell out of the match. This isn't a LEFT-JOIN problem; it's a cleaning problem: wrap BOTH sides of the join in upper(trim(…)) and the strays fold back in.`,
    hints: [
      `The join condition can hold expressions, not just bare columns: ON upper(trim(b.dept_name_raw)) = upper(d.dept_name). TRIM eats the stray spaces, UPPER makes 'Sales - Enterprise' and ' sales - enterprise' agree. It's the same cleanup you'd do in Excel with =TRIM(UPPER(A2)) before a lookup.`,
      `SELECT d.dept_name, sum(b.amount_usd) AS reforecast\nFROM fct_budget b\nJOIN dim_department d\n  ON upper(trim(b.____)) = upper(d.____)\nWHERE b.version_name = '____'\n  AND (b.account_id LIKE '6%' OR b.account_id LIKE '7%')\nGROUP BY d.dept_name\nORDER BY reforecast DESC;`,
      `SELECT d.dept_name, sum(b.amount_usd) AS reforecast\nFROM fct_budget b\nJOIN dim_department d\n  ON upper(trim(b.dept_name_raw)) = upper(d.dept_name)\nWHERE b.version_name = 'FY2025 Q2 Reforecast'\n  AND (b.account_id LIKE '6%' OR b.account_id LIKE '7%')\nGROUP BY d.dept_name\nORDER BY reforecast DESC;\n\nGrouping by the CLEAN name (from the dim) is what folds the variants together. Plans come from spreadsheets at every company on earth — the analyst who reflexively TRIMs and UPPERs before joining is the analyst whose numbers tie.`,
    ],
    sayIt: `"The plan upload had dirty free-text department names, so I normalized both sides with UPPER and TRIM in the join condition and grouped by the dimension's clean name."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm11',
    part: 4,
    title: 'What do we really pay AWS?',
    from: 'priya',
    ask: `I'm renegotiating our cloud contract and need our true AWS spend for the trailing twelve months — July 2025 through June 2026. Careful: AP has been sloppy over the years, and I'd bet money we pay Amazon under more than one vendor name. Find every variant before you total.`,
    deliverable: `One number: total GL spend for all AWS/Amazon vendor entries, July 1 2025 – June 30 2026.`,
    tables: ['fct_gl_transactions', 'dim_vendor'],
    canonical: `SELECT round(sum(g.amount), 2) AS aws_spend FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id WHERE (v.vendor_name ILIKE '%amazon%' OR v.vendor_name = 'AWS') AND g.txn_date BETWEEN DATE '2025-07-01' AND DATE '2026-06-30'`,
    ordered: false,
    fingerprintSQL: `SELECT round(sum(g.amount), 2) AS aws_spend FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id WHERE v.vendor_name = 'Amazon Web Services' AND g.txn_date BETWEEN DATE '2025-07-01' AND DATE '2026-06-30'`,
    fingerprintMessage: `That's the spend for ONE vendor spelling — but AP pays Amazon under three. Peek at the vendor list: SELECT vendor_name FROM dim_vendor WHERE vendor_name ILIKE '%amazon%' OR vendor_name = 'AWS'. Real vendor tables are always this messy; the renegotiation number needs all of them.`,
    hints: [
      `First find the variants: SELECT vendor_name FROM dim_vendor WHERE vendor_name ILIKE '%amazon%' — ILIKE is LIKE that ignores capitalization, and % on both ends means "contains." (Watch for a short 'AWS' entry that 'amazon' won't catch.)`,
      `SELECT sum(g.amount) AS aws_spend\nFROM fct_gl_transactions g\nJOIN dim_vendor v ON g.vendor_id = v.vendor_id\nWHERE (v.vendor_name ILIKE '%____%' OR v.vendor_name = '____')\n  AND g.txn_date BETWEEN DATE '2025-07-01' AND DATE '2026-06-30';`,
      `SELECT sum(g.amount) AS aws_spend\nFROM fct_gl_transactions g\nJOIN dim_vendor v ON g.vendor_id = v.vendor_id\nWHERE (v.vendor_name ILIKE '%amazon%' OR v.vendor_name = 'AWS')\n  AND g.txn_date BETWEEN DATE '2025-07-01' AND DATE '2026-06-30';\n\n'Amazon Web Services', 'AWS', and 'Amazon Web Services, Inc.' are three separate vendor ids here. Naïvely filtering one exact name undercounts the true spend badly — a real contract-negotiation mistake that real companies really make.`,
    ],
    sayIt: `"Vendor masters always have duplicates, so I pattern-matched the name variants with ILIKE before totaling — the naive exact-match answer was 40% low."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm12',
    part: 4,
    title: 'Gross margin, eight quarters',
    from: 'priya',
    ask: `Zi (CEO) heard a competitor bragging about 82% gross margin and wants ours, by quarter, for the last eight quarters — Q3 2024 through Q2 2026. Revenue and COGS both live in the GL; dim_account's account_type tells them apart. You'll want SUM with a CASE inside — that's SUMIFS with the IF written out loud.`,
    deliverable: `Eight rows: the quarter (like '2024-Q3'), and gross margin % — (revenue − COGS) ÷ revenue × 100, rounded to 1 decimal — in chronological order.`,
    tables: ['fct_gl_transactions', 'dim_account'],
    canonical: `SELECT year(g.txn_date) || '-Q' || quarter(g.txn_date) AS qtr, round(100.0 * (sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END) - sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END)) / sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), 1) AS gross_margin_pct FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE a.account_type IN ('Revenue', 'COGS') AND g.txn_date BETWEEN DATE '2024-07-01' AND DATE '2026-06-30' GROUP BY 1 ORDER BY 1`,
    ordered: true,
    orderedNote: 'oldest quarter first',
    hints: [
      `SUM(CASE WHEN account_type = 'Revenue' THEN amount ELSE 0 END) is a SUMIFS: sum amount where type is Revenue. Do it twice in the same query — once for Revenue, once for COGS — and you have both numbers on every quarter's row, ready for the margin math. For the quarter label: year(txn_date) || '-Q' || quarter(txn_date) glues '2024' + '-Q' + '3' together (|| is SQL's &).`,
      `SELECT year(g.txn_date) || '-Q' || quarter(g.txn_date) AS qtr,\n       round(100.0 * (sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END)\n                    - sum(CASE WHEN a.account_type = '____' THEN g.amount ELSE 0 END))\n           / sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), 1) AS gross_margin_pct\nFROM fct_gl_transactions g\nJOIN dim_account a ON g.account_id = a.account_id\nWHERE a.account_type IN ('Revenue', 'COGS')\n  AND g.txn_date BETWEEN DATE '2024-07-01' AND DATE '2026-06-30'\nGROUP BY 1\nORDER BY 1;`,
      `SELECT year(g.txn_date) || '-Q' || quarter(g.txn_date) AS qtr,\n       round(100.0 * (sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END)\n                    - sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END))\n           / sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), 1) AS gross_margin_pct\nFROM fct_gl_transactions g\nJOIN dim_account a ON g.account_id = a.account_id\nWHERE a.account_type IN ('Revenue', 'COGS')\n  AND g.txn_date BETWEEN DATE '2024-07-01' AND DATE '2026-06-30'\nGROUP BY 1\nORDER BY 1;\n\nConditional aggregation — SUM(CASE WHEN …) — is how one query produces a whole P&L cross-tab. GROUP BY 1 / ORDER BY 1 are shorthand for "the first column."`,
    ],
    sayIt: `"I used conditional aggregation — a SUM over a CASE — to get revenue and COGS side by side per quarter from one pass over the GL, then computed margin on the row."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm13',
    part: 5,
    title: 'Month-over-month growth',
    from: 'priya',
    ask: `For the operating review: 2026 monthly revenue with month-over-month growth percent next to each month. "Compare this row to the previous row" has a name in SQL — LAG — and it's the move interviewers most love to ask finance candidates. January's growth will show a dash (—); that's correct, not broken — there's no December in the window to compare against.`,
    deliverable: `Six rows, Jan–Jun 2026, chronological: month, revenue (accounts 4000 + 4010), and MoM growth % (vs prior month, 1 decimal; empty for January — shown as a dash).`,
    tables: ['fct_gl_transactions'],
    canonical: `WITH m AS (SELECT date_trunc('month', txn_date)::DATE AS month, sum(amount) AS revenue FROM fct_gl_transactions WHERE account_id IN ('4000', '4010') AND txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-06-30' GROUP BY 1) SELECT month, round(revenue, 2) AS revenue, round(100.0 * (revenue - lag(revenue) OVER (ORDER BY month)) / lag(revenue) OVER (ORDER BY month), 1) AS mom_growth_pct FROM m ORDER BY month`,
    ordered: true,
    orderedNote: 'January first',
    requireRegex: ORDERED_WINDOW_REQUIREMENT,
    requireMessage: `Your numbers match — but your OVER () has no ORDER BY inside it, which means the engine picked "the previous row" by luck, not by month. On a real warehouse (and in a live screen) that answer changes run to run. Put ORDER BY month inside the OVER ( ) and it's genuinely right.`,
    hints: [
      `Two steps: first a CTE that's just your monthly-revenue pivot (you built this in an earlier ask). Then, over that little 6-row result, lag(revenue) OVER (ORDER BY month) means "the revenue from the row one above, when sorted by month" — like writing =B2/B1-1 down a column, except SQL needs you to say what "the row above" means.`,
      `WITH m AS (\n  SELECT date_trunc('month', txn_date)::DATE AS month, sum(amount) AS revenue\n  FROM fct_gl_transactions\n  WHERE account_id IN ('4000', '4010')\n    AND txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-06-30'\n  GROUP BY 1\n)\nSELECT month,\n       revenue,\n       round(100.0 * (revenue - lag(revenue) OVER (ORDER BY month))\n                   / lag(revenue) OVER (ORDER BY month), 1) AS mom_growth_pct\nFROM m\nORDER BY month;`,
      `WITH m AS (\n  SELECT date_trunc('month', txn_date)::DATE AS month, sum(amount) AS revenue\n  FROM fct_gl_transactions\n  WHERE account_id IN ('4000', '4010')\n    AND txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-06-30'\n  GROUP BY 1\n)\nSELECT month,\n       round(revenue, 2) AS revenue,\n       round(100.0 * (revenue - lag(revenue) OVER (ORDER BY month))\n                   / lag(revenue) OVER (ORDER BY month), 1) AS mom_growth_pct\nFROM m\nORDER BY month;\n\nlag() is a window function: it looks at other rows without collapsing them the way GROUP BY does. LAG for month-over-month is the single most common window function in finance work — own this one and window functions stop being scary.`,
    ],
    sayIt: `"I aggregated to month in a CTE, then used LAG over the month order for the MoM delta — window functions read across rows without collapsing them."`,
    jdCompanies: ['Navan'],
  },
  {
    id: 'm14',
    part: 5,
    title: 'The ARR waterfall, from the log',
    from: 'priya',
    ask: `My favorite board slide: FY2025 net-new ARR by month, split into its five movements — new, expansion, contraction, churn, reactivation — plus the net. fct_arr_movements logs every ARR event with a signed dollar delta (contraction and churn are negative). One row per month, one column per movement. This is your SUM(CASE) move again, five times across.`,
    deliverable: `Twelve rows, Jan–Dec 2025, chronological: month, then new, expansion, contraction, churn, reactivation (each the sum of arr_delta_usd for that movement_type), then net (sum of all deltas).`,
    tables: ['fct_arr_movements'],
    canonical: `SELECT date_trunc('month', event_date)::DATE AS month, round(sum(CASE WHEN movement_type = 'new' THEN arr_delta_usd ELSE 0 END), 2) AS new_arr, round(sum(CASE WHEN movement_type = 'expansion' THEN arr_delta_usd ELSE 0 END), 2) AS expansion, round(sum(CASE WHEN movement_type = 'contraction' THEN arr_delta_usd ELSE 0 END), 2) AS contraction, round(sum(CASE WHEN movement_type = 'churn' THEN arr_delta_usd ELSE 0 END), 2) AS churn, round(sum(CASE WHEN movement_type = 'reactivation' THEN arr_delta_usd ELSE 0 END), 2) AS reactivation, round(sum(arr_delta_usd), 2) AS net FROM fct_arr_movements WHERE event_date BETWEEN DATE '2025-01-01' AND DATE '2025-12-31' GROUP BY 1 ORDER BY 1`,
    ordered: true,
    orderedNote: 'January first',
    hints: [
      `Same skeleton as gross margin: GROUP BY the month, then one SUM(CASE WHEN movement_type = '…' THEN arr_delta_usd ELSE 0 END) per movement. The net column needs no CASE at all — the deltas are signed, so a plain sum(arr_delta_usd) nets itself.`,
      `SELECT date_trunc('month', event_date)::DATE AS month,\n       sum(CASE WHEN movement_type = 'new' THEN arr_delta_usd ELSE 0 END) AS new_arr,\n       sum(CASE WHEN movement_type = '____' THEN arr_delta_usd ELSE 0 END) AS expansion,\n       …(three more)…,\n       sum(arr_delta_usd) AS net\nFROM fct_arr_movements\nWHERE event_date BETWEEN DATE '2025-01-01' AND DATE '2025-12-31'\nGROUP BY 1\nORDER BY 1;`,
      `SELECT date_trunc('month', event_date)::DATE AS month,\n       round(sum(CASE WHEN movement_type = 'new' THEN arr_delta_usd ELSE 0 END), 2) AS new_arr,\n       round(sum(CASE WHEN movement_type = 'expansion' THEN arr_delta_usd ELSE 0 END), 2) AS expansion,\n       round(sum(CASE WHEN movement_type = 'contraction' THEN arr_delta_usd ELSE 0 END), 2) AS contraction,\n       round(sum(CASE WHEN movement_type = 'churn' THEN arr_delta_usd ELSE 0 END), 2) AS churn,\n       round(sum(CASE WHEN movement_type = 'reactivation' THEN arr_delta_usd ELSE 0 END), 2) AS reactivation,\n       round(sum(arr_delta_usd), 2) AS net\nFROM fct_arr_movements\nWHERE event_date BETWEEN DATE '2025-01-01' AND DATE '2025-12-31'\nGROUP BY 1\nORDER BY 1;\n\nThis table is pre-labeled, which makes the waterfall a pivot. The advanced version — deriving those labels yourself from raw month-end balances — is the capstone waiting at the end of your queue.`,
    ],
    sayIt: `"The movements table is an event log with signed deltas, so the waterfall is conditional sums by month — and the signed deltas mean net is just a plain sum."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm15',
    part: 5,
    title: 'June paid heads, without the ghosts',
    from: 'elena',
    ask: `People-cost review: June 2026 paid heads and average monthly all-in comp, by division (R&D, S&M, G&A, COGS — it's on dim_department). Use fct_payroll_monthly: one June row means one person paid during June. This is an employee-month population, not a June 30 active-roster snapshot.`,
    deliverable: `Four rows: division, headcount (count of paid employee-month rows for June 2026), and average total_comp_usd per paid head (rounded to 0 decimals), sorted by headcount descending.`,
    tables: ['fct_payroll_monthly', 'dim_department'],
    canonical: `SELECT d.division, count(*) AS headcount, round(avg(p.total_comp_usd), 0) AS avg_monthly_comp FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id WHERE p.payroll_month = DATE '2026-06-01' GROUP BY d.division ORDER BY headcount DESC`,
    ordered: true,
    orderedNote: 'biggest division first',
    hints: [
      `The payroll table's grain is employee-month, so June's rows are June paid heads: filter payroll_month = '2026-06-01', join dim_department for the division, then count(*) and avg(total_comp_usd). Do not label this as a June 30 active roster.`,
      `SELECT d.division,\n       count(*) AS headcount,\n       round(avg(p.total_comp_usd), 0) AS avg_monthly_comp\nFROM fct_payroll_monthly p\nJOIN dim_department d ON p.____ = d.____\nWHERE p.payroll_month = DATE '____-__-01'\nGROUP BY d.division\nORDER BY headcount DESC;`,
      `SELECT d.division,\n       count(*) AS headcount,\n       round(avg(p.total_comp_usd), 0) AS avg_monthly_comp\nFROM fct_payroll_monthly p\nJOIN dim_department d ON p.dept_id = d.dept_id\nWHERE p.payroll_month = DATE '2026-06-01'\nGROUP BY d.division\nORDER BY headcount DESC;\n\nThis answers who was paid during June. It does not answer who remained active on June 30; that requires an explicit as-of roster population.`,
    ],
    sayIt: `"I counted June paid employee-months and labeled them paid heads. That population supports the cost review, but it is not a June 30 active-roster snapshot."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm16',
    part: 6,
    title: `The deck that didn't tie`,
    from: 'elena',
    ask: `Something's wrong. Riff's March 2024 board deck shows subscription revenue way above what the ARR snapshot implies, and it traces to a query the previous analyst left behind:\n\nSELECT sum(amount) FROM fct_gl_transactions\nWHERE account_id = '4000'\n  AND txn_date BETWEEN DATE '2024-03-01' AND DATE '2024-03-31';\n\nThe query looks right… which means the DATA is wrong. March 2024 is when we migrated billing systems. My money's on rows loaded twice. Find the duplicates and tell me exactly how overstated that number is.`,
    deliverable: `One number: the total overstatement — the extra dollars from duplicate-loaded March 2024 subscription revenue lines (same je_id, memo, and amount appearing more than once from the Stripe source).`,
    tables: ['fct_gl_transactions'],
    canonical: `SELECT round(sum(amount), 2) AS overstatement FROM (SELECT je_id, memo, amount, count(*) AS copies FROM fct_gl_transactions WHERE txn_date BETWEEN DATE '2024-03-01' AND DATE '2024-03-31' AND account_id = '4000' AND source_system = 'Stripe' GROUP BY 1, 2, 3 HAVING count(*) > 1) dupes`,
    ordered: false,
    fingerprintSQL: `SELECT round(sum(amount), 2) AS overstatement FROM fct_gl_transactions WHERE txn_date BETWEEN DATE '2024-03-01' AND DATE '2024-03-31' AND account_id = '4000' AND source_system = 'Stripe' AND (je_id, memo, amount) IN (SELECT je_id, memo, amount FROM fct_gl_transactions WHERE txn_date BETWEEN DATE '2024-03-01' AND DATE '2024-03-31' AND account_id = '4000' AND source_system = 'Stripe' GROUP BY 1, 2, 3 HAVING count(*) > 1)`,
    fingerprintMessage: `You found the duplicated entries, but summed both copies — that reports twice the overstatement. Group each duplicate key down to one row first, then sum one amount per duplicate group: one real copy plus one extra means only one copy is overstated.`,
    hints: [
      `Duplicate-hunting has a standard move: GROUP BY the columns that should be unique together (je_id, memo, amount), then HAVING count(*) > 1 keeps only the groups that appear more than once. HAVING is a filter that runs AFTER the pivot — WHERE filters rows, HAVING filters groups.`,
      `SELECT sum(amount) AS overstatement\nFROM (\n  SELECT je_id, memo, amount, count(*) AS copies\n  FROM fct_gl_transactions\n  WHERE txn_date BETWEEN DATE '2024-03-01' AND DATE '2024-03-31'\n    AND account_id = '4000'\n    AND source_system = 'Stripe'\n  GROUP BY 1, 2, 3\n  HAVING count(*) > ___\n) dupes;`,
      `SELECT round(sum(amount), 2) AS overstatement\nFROM (\n  SELECT je_id, memo, amount, count(*) AS copies\n  FROM fct_gl_transactions\n  WHERE txn_date BETWEEN DATE '2024-03-01' AND DATE '2024-03-31'\n    AND account_id = '4000'\n    AND source_system = 'Stripe'\n  GROUP BY 1, 2, 3\n  HAVING count(*) > 1\n) dupes;\n\nEach duplicated entry appears exactly twice — once real, once from the migration job's re-run — so the extra dollars are one amount per duplicate group, which is exactly what summing the grouped amount gives you. Congratulations: "comfortable debugging SQL" (1Password's actual job requirement) now includes finding a real double-load in a real-shaped GL.`,
    ],
    sayIt: `"The deck query was fine — the load was duplicated. I grouped on the natural key and used HAVING count greater than one to isolate and quantify the double-loaded rows."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm17',
    part: 6,
    title: 'The capstone: derive the ARR bridge',
    from: 'priya',
    ask: `Last one from me, and it's the real thing — this is THE question SaaS finance interviews build up to. For June 2026: derive the ARR movements yourself from the raw month-end snapshots (May vs June), without touching fct_arr_movements. A customer in June but not May is new. In May but not June: churned. In both, higher: expansion; lower: contraction. When you're done, eyeball your answer against fct_arr_movements for June — deriving the bridge AND tying it out is the whole job in one query. (One nuance: a returning customer looks "new" to this method — the movements log calls those reactivation. Fold them into new; mention the caveat like a pro.)`,
    deliverable: `Up to four rows — movement_type ('new', 'expansion', 'contraction', 'churn'), total ARR delta (June ARR − May ARR per customer, summed), and customer count — sorted alphabetically by movement_type. Skip customers with no change.`,
    tables: ['fct_subscription_snapshot_monthly'],
    canonical: `WITH may AS (SELECT customer_id, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-05-01'), jun AS (SELECT customer_id, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01') SELECT CASE WHEN m.customer_id IS NULL THEN 'new' WHEN j.customer_id IS NULL THEN 'churn' WHEN j.arr_usd > m.arr_usd THEN 'expansion' ELSE 'contraction' END AS movement_type, round(sum(COALESCE(j.arr_usd, 0) - COALESCE(m.arr_usd, 0)), 2) AS arr_delta, count(*) AS customers FROM may m FULL OUTER JOIN jun j ON m.customer_id = j.customer_id WHERE COALESCE(j.arr_usd, 0) <> COALESCE(m.arr_usd, 0) GROUP BY 1 ORDER BY 1`,
    ordered: true,
    orderedNote: 'alphabetical by movement type',
    extraFingerprints: [
      {
        sql: `WITH may AS (SELECT customer_id, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-05-01'), jun AS (SELECT customer_id, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01') SELECT CASE WHEN m.customer_id IS NULL THEN 'new' WHEN j.customer_id IS NULL THEN 'churn' WHEN j.arr_usd > m.arr_usd THEN 'expansion' ELSE 'contraction' END AS movement_type, round(sum(COALESCE(j.arr_usd, 0) - COALESCE(m.arr_usd, 0)), 2) AS arr_delta, count(*) AS customers FROM may m JOIN jun j ON m.customer_id = j.customer_id WHERE COALESCE(j.arr_usd, 0) <> COALESCE(m.arr_usd, 0) GROUP BY 1 ORDER BY 1`,
        message: `Expansion and contraction look right — but 'new' and 'churn' vanished. A plain (INNER) JOIN keeps only customers present in BOTH months, and the whole point of the bridge is the customers who exist in just one. You need a join that keeps non-matches from BOTH sides: FULL OUTER JOIN.`,
      },
      {
        sql: `WITH may AS (SELECT customer_id, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-05-01'), jun AS (SELECT customer_id, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01') SELECT CASE WHEN m.customer_id IS NULL THEN 'new' WHEN j.customer_id IS NULL THEN 'churn' WHEN j.arr_usd > m.arr_usd THEN 'expansion' ELSE 'contraction' END AS movement_type, round(sum(COALESCE(j.arr_usd, 0) - COALESCE(m.arr_usd, 0)), 2) AS arr_delta, count(*) AS customers FROM may m LEFT JOIN jun j ON m.customer_id = j.customer_id WHERE COALESCE(j.arr_usd, 0) <> COALESCE(m.arr_usd, 0) GROUP BY 1 ORDER BY 1`,
        message: `So close — churn, expansion, and contraction are all there, but 'new' is missing. LEFT JOIN keeps May's non-matches (the churns) but drops June's (the new customers). This is the one place LEFT isn't enough: FULL OUTER JOIN keeps the strays from BOTH months.`,
      },
    ],
    hints: [
      `Build two CTEs — may and jun, each customer_id + arr_usd for that one month. Now you need customers who are in EITHER month: that's a FULL OUTER JOIN (a lookup that keeps non-matches from BOTH sides). A customer missing from may shows up with NULL may-columns → that's your 'new'. Missing from jun → 'churn'. Then a CASE classifies each customer, and you group by the classification.`,
      `WITH may AS (\n  SELECT customer_id, arr_usd FROM fct_subscription_snapshot_monthly\n  WHERE month_start = DATE '2026-05-01'\n),\njun AS (\n  SELECT customer_id, arr_usd FROM fct_subscription_snapshot_monthly\n  WHERE month_start = DATE '2026-06-01'\n)\nSELECT CASE WHEN m.customer_id IS NULL THEN 'new'\n            WHEN j.customer_id IS NULL THEN '____'\n            WHEN j.arr_usd > m.arr_usd THEN '____'\n            ELSE 'contraction' END AS movement_type,\n       sum(COALESCE(j.arr_usd, 0) - COALESCE(m.arr_usd, 0)) AS arr_delta,\n       count(*) AS customers\nFROM may m\nFULL OUTER JOIN jun j ON m.customer_id = j.customer_id\nWHERE COALESCE(j.arr_usd, 0) <> COALESCE(m.arr_usd, 0)\nGROUP BY 1\nORDER BY 1;`,
      `WITH may AS (\n  SELECT customer_id, arr_usd FROM fct_subscription_snapshot_monthly\n  WHERE month_start = DATE '2026-05-01'\n),\njun AS (\n  SELECT customer_id, arr_usd FROM fct_subscription_snapshot_monthly\n  WHERE month_start = DATE '2026-06-01'\n)\nSELECT CASE WHEN m.customer_id IS NULL THEN 'new'\n            WHEN j.customer_id IS NULL THEN 'churn'\n            WHEN j.arr_usd > m.arr_usd THEN 'expansion'\n            ELSE 'contraction' END AS movement_type,\n       round(sum(COALESCE(j.arr_usd, 0) - COALESCE(m.arr_usd, 0)), 2) AS arr_delta,\n       count(*) AS customers\nFROM may m\nFULL OUTER JOIN jun j ON m.customer_id = j.customer_id\nWHERE COALESCE(j.arr_usd, 0) <> COALESCE(m.arr_usd, 0)\nGROUP BY 1\nORDER BY 1;\n\nRead the CASE out loud — it IS the business definition of the bridge, written as code. Now run the June rows of fct_arr_movements and watch your derived numbers tie (with reactivation folding into your 'new'). That tie-out instinct — "does my derived number match the system of record?" — is what separates a hire from a maybe.`,
    ],
    sayIt: `"I take the two month-end snapshots at customer grain, full-outer-join them so entrants and churns both survive, classify each customer's delta with a CASE, and tie the result back to the movements log."`,
    jdCompanies: ['Navan', 'Figma'],
  },
  {
    id: 'm18',
    part: 6,
    title: 'Net revenue retention',
    from: 'priya',
    ask: `One more for the road — the metric every SaaS board asks about: net revenue retention. For each segment: take everyone who was a customer in June 2025, and divide what those same customers pay TODAY (June 2026 — churned ones count as zero) by what they paid then. Over 100% means the base grows even with zero new logos. Which of our segments quietly shrinks?`,
    deliverable: `Three rows: segment, and NRR % (June-2026 ARR of June-2025 customers ÷ their June-2025 ARR × 100, 1 decimal), sorted alphabetically by segment.`,
    tables: ['fct_subscription_snapshot_monthly', 'dim_customer'],
    canonical: `WITH base AS (SELECT s.customer_id, s.arr_usd, c.segment FROM fct_subscription_snapshot_monthly s JOIN dim_customer c ON s.customer_id = c.customer_id WHERE s.month_start = DATE '2025-06-01'), now AS (SELECT customer_id, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01') SELECT b.segment, round(100.0 * sum(COALESCE(n.arr_usd, 0)) / sum(b.arr_usd), 1) AS nrr_pct FROM base b LEFT JOIN now n ON b.customer_id = n.customer_id GROUP BY b.segment ORDER BY b.segment`,
    ordered: true,
    orderedNote: 'alphabetical',
    extraFingerprints: [
      {
        sql: `WITH base AS (SELECT s.customer_id, s.arr_usd, c.segment FROM fct_subscription_snapshot_monthly s JOIN dim_customer c ON s.customer_id = c.customer_id WHERE s.month_start = DATE '2025-06-01'), now AS (SELECT customer_id, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01') SELECT b.segment, round(100.0 * sum(n.arr_usd) / sum(b.arr_usd), 1) AS nrr_pct FROM base b JOIN now n ON b.customer_id = n.customer_id GROUP BY b.segment ORDER BY b.segment`,
        message: `Every segment came back over 100% — that should smell wrong for a company with real churn. Your INNER JOIN silently removed every churned customer from the math, so retention flatters itself. Churned customers must STAY in the cohort as zeros: LEFT JOIN their current ARR onto the base, and COALESCE the misses to 0. (This exact mistake is why some companies' reported NRR doesn't survive diligence.)`,
      },
    ],
    hints: [
      `The cohort is fixed at June 2025 — that's your base CTE (customer, ARR, segment). LEFT JOIN their June 2026 ARR onto it: LEFT, not INNER, because churned customers must stay in the math as zeros (COALESCE(now.arr_usd, 0)). If you INNER join, churn silently vanishes and NRR flatters itself — the classic way this metric gets computed wrong.`,
      `WITH base AS (\n  SELECT s.customer_id, s.arr_usd, c.segment\n  FROM fct_subscription_snapshot_monthly s\n  JOIN dim_customer c ON s.customer_id = c.customer_id\n  WHERE s.month_start = DATE '2025-06-01'\n),\nnow AS (\n  SELECT customer_id, arr_usd FROM fct_subscription_snapshot_monthly\n  WHERE month_start = DATE '2026-06-01'\n)\nSELECT b.segment,\n       round(100.0 * sum(COALESCE(n.arr_usd, 0)) / sum(b.arr_usd), 1) AS nrr_pct\nFROM base b\n____ JOIN now n ON b.customer_id = n.customer_id\nGROUP BY b.segment\nORDER BY b.segment;`,
      `WITH base AS (\n  SELECT s.customer_id, s.arr_usd, c.segment\n  FROM fct_subscription_snapshot_monthly s\n  JOIN dim_customer c ON s.customer_id = c.customer_id\n  WHERE s.month_start = DATE '2025-06-01'\n),\nnow AS (\n  SELECT customer_id, arr_usd FROM fct_subscription_snapshot_monthly\n  WHERE month_start = DATE '2026-06-01'\n)\nSELECT b.segment,\n       round(100.0 * sum(COALESCE(n.arr_usd, 0)) / sum(b.arr_usd), 1) AS nrr_pct\nFROM base b\nLEFT JOIN now n ON b.customer_id = n.customer_id\nGROUP BY b.segment\nORDER BY b.segment;\n\nOne caveat worth saying out loud in an interview: segment here is the customer's CURRENT segment (this dim keeps no history), so a customer who grew from SMB into Enterprise counts as Enterprise even in the 2025 base. Naming that limitation unprompted is a very senior move.`,
    ],
    sayIt: `"NRR is a cohort metric: freeze the base period's customers, LEFT-join their current ARR so churn stays in as zero, divide. And I'd flag that segment is current-state here — the dim is type 1, so there's mild survivorship drift."`,
    jdCompanies: ['Hightouch', 'Navan'],
  },
  {
    id: 'm19',
    part: 6,
    title: 'Why January moved after close',
    from: 'elena',
    ask: `Riff's locked January close deck no longer ties to the warehouse. The deck was cut on February 5, but Accounting posted a late January reclass after that date. Show me the two affected accounts side by side: what the locked deck knew, what the warehouse says now, and the change. This is the finance version of time travel — txn_date says which accounting period a line belongs to; posted_at says when the warehouse learned about it.`,
    deliverable: `Two rows: account_name, locked_deck_amount (January transactions posted by February 5), current_amount (all January transactions), and change_usd (transactions posted after February 5), sorted biggest change first. Return only accounts affected by a late posting.`,
    tables: ['fct_gl_transactions', 'dim_account'],
    canonical: `SELECT a.account_name, round(sum(CASE WHEN g.posted_at <= DATE '2026-02-05' THEN g.amount ELSE 0 END), 2) AS locked_deck_amount, round(sum(g.amount), 2) AS current_amount, round(sum(CASE WHEN g.posted_at > DATE '2026-02-05' THEN g.amount ELSE 0 END), 2) AS change_usd FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31' GROUP BY a.account_name HAVING sum(CASE WHEN g.posted_at > DATE '2026-02-05' THEN abs(g.amount) ELSE 0 END) > 0 ORDER BY change_usd DESC`,
    ordered: true,
    orderedNote: 'biggest change first',
    fingerprintSQL: `SELECT a.account_name, round(sum(g.amount), 2) AS locked_deck_amount, round(sum(g.amount), 2) AS current_amount, 0::DOUBLE AS change_usd FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31' AND g.account_id IN ('5000', '7000') GROUP BY a.account_name ORDER BY a.account_name`,
    fingerprintMessage: `Your locked and current columns are identical because both rebuilt January from today's warehouse rows. txn_date tells you the accounting period; posted_at tells you what the warehouse knew when the deck was locked on February 5. Use conditional sums around that posting cutoff, then keep only accounts with a late-posted line.`,
    hints: [
      `This is a SUMIFS with two different clocks. Filter txn_date to January for both versions. For the locked deck, sum only rows whose posted_at is on or before February 5; for today's number, sum every January row. Their difference is the late-posted change.`,
      `SELECT a.account_name,
       sum(CASE WHEN g.posted_at <= DATE '____-__-__' THEN g.amount ELSE 0 END) AS locked_deck_amount,
       sum(g.amount) AS current_amount,
       sum(CASE WHEN g.posted_at > DATE '____-__-__' THEN g.amount ELSE 0 END) AS change_usd
FROM fct_gl_transactions g
JOIN dim_account a ON g.account_id = a.account_id
WHERE g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31'
GROUP BY a.account_name
HAVING sum(CASE WHEN g.posted_at > DATE '2026-02-05' THEN abs(g.amount) ELSE 0 END) > 0
ORDER BY change_usd DESC;`,
      `SELECT a.account_name,
       round(sum(CASE WHEN g.posted_at <= DATE '2026-02-05' THEN g.amount ELSE 0 END), 2) AS locked_deck_amount,
       round(sum(g.amount), 2) AS current_amount,
       round(sum(CASE WHEN g.posted_at > DATE '2026-02-05' THEN g.amount ELSE 0 END), 2) AS change_usd
FROM fct_gl_transactions g
JOIN dim_account a ON g.account_id = a.account_id
WHERE g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31'
GROUP BY a.account_name
HAVING sum(CASE WHEN g.posted_at > DATE '2026-02-05' THEN abs(g.amount) ELSE 0 END) > 0
ORDER BY change_usd DESC;

The accounting date and posting date answer different questions: txn_date puts the cost in January, while posted_at proves the February 5 deck could not have known about it. Conditional aggregation reconstructs both versions without overwriting history.`,
    ],
    sayIt: `"I separated accounting date from warehouse posting date, reconstructed the locked-deck cutoff with conditional sums, and isolated the late reclass that explains the restatement."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm20',
    part: 6,
    title: 'Twelve-month cohort retention',
    from: 'priya',
    ask: `Last board-prep check: for customers who first contracted in 2024, show twelve-month logo retention by acquisition quarter. Each customer needs to be tested exactly twelve months after their own starting month — not against one shared calendar month. Keep the customers who churned before the anniversary in the starting count; disappearing them is how a retention table magically becomes 100%.`,
    deliverable: `Four rows: 2024 cohort quarter, starting customer count, customers still active exactly 12 months after their cohort month, and logo retention %, rounded to 1 decimal, in chronological order.`,
    tables: ['dim_customer', 'fct_subscription_snapshot_monthly'],
    canonical: `WITH cohorts AS (SELECT customer_id, date_trunc('month', first_contract_date)::DATE AS cohort_month, date_trunc('quarter', first_contract_date)::DATE AS cohort_quarter FROM dim_customer WHERE first_contract_date BETWEEN DATE '2024-01-01' AND DATE '2024-12-31') SELECT cohort_quarter, count(*) AS starting_customers, count(r.customer_id) AS retained_customers_12m, round(100.0 * count(r.customer_id) / count(*), 1) AS logo_retention_pct FROM cohorts c LEFT JOIN fct_subscription_snapshot_monthly r ON r.customer_id = c.customer_id AND r.month_start = (c.cohort_month + INTERVAL 12 MONTH)::DATE GROUP BY 1 ORDER BY 1`,
    ordered: true,
    orderedNote: 'earliest cohort first',
    fingerprintSQL: `WITH cohorts AS (SELECT customer_id, date_trunc('month', first_contract_date)::DATE AS cohort_month, date_trunc('quarter', first_contract_date)::DATE AS cohort_quarter FROM dim_customer WHERE first_contract_date BETWEEN DATE '2024-01-01' AND DATE '2024-12-31') SELECT cohort_quarter, count(*) AS starting_customers, count(r.customer_id) AS retained_customers_12m, round(100.0 * count(r.customer_id) / count(*), 1) AS logo_retention_pct FROM cohorts c JOIN fct_subscription_snapshot_monthly r ON r.customer_id = c.customer_id AND r.month_start = (c.cohort_month + INTERVAL 12 MONTH)::DATE GROUP BY 1 ORDER BY 1`,
    fingerprintMessage: `Every cohort came back at 100% because the INNER JOIN dropped every churned logo before you counted the starting cohort. Keep the full cohort with a LEFT JOIN, use count(*) for starting customers, and count(r.customer_id) only for customers with a twelve-month snapshot.`,
    hints: [
      `Build a cohort CTE with one row per customer, their first-contract month, and its quarter. Then LEFT JOIN the monthly snapshot at cohort_month + 12 months. count(*) keeps the full starting cohort; count(r.customer_id) counts only logos that still have an anniversary snapshot.`,
      `WITH cohorts AS (
  SELECT customer_id,
         date_trunc('month', first_contract_date)::DATE AS cohort_month,
         date_trunc('quarter', first_contract_date)::DATE AS cohort_quarter
  FROM dim_customer
  WHERE first_contract_date BETWEEN DATE '2024-01-01' AND DATE '2024-12-31'
)
SELECT cohort_quarter,
       count(*) AS starting_customers,
       count(r.customer_id) AS retained_customers_12m,
       round(100.0 * count(r.customer_id) / count(*), 1) AS logo_retention_pct
FROM cohorts c
____ JOIN fct_subscription_snapshot_monthly r
  ON r.customer_id = c.customer_id
 AND r.month_start = (c.cohort_month + INTERVAL 12 MONTH)::DATE
GROUP BY 1
ORDER BY 1;`,
      `WITH cohorts AS (
  SELECT customer_id,
         date_trunc('month', first_contract_date)::DATE AS cohort_month,
         date_trunc('quarter', first_contract_date)::DATE AS cohort_quarter
  FROM dim_customer
  WHERE first_contract_date BETWEEN DATE '2024-01-01' AND DATE '2024-12-31'
)
SELECT cohort_quarter,
       count(*) AS starting_customers,
       count(r.customer_id) AS retained_customers_12m,
       round(100.0 * count(r.customer_id) / count(*), 1) AS logo_retention_pct
FROM cohorts c
LEFT JOIN fct_subscription_snapshot_monthly r
  ON r.customer_id = c.customer_id
 AND r.month_start = (c.cohort_month + INTERVAL 12 MONTH)::DATE
GROUP BY 1
ORDER BY 1;

The denominator is the original cohort, including churned logos. An INNER JOIN removes the misses before aggregation and guarantees a fake 100%; LEFT JOIN preserves the denominator while count(r.customer_id) counts only the retained logos.`,
    ],
    sayIt: `"I fixed each customer's cohort month, left-joined their exact twelve-month anniversary snapshot so churn stays in the denominator, and rolled the result up to acquisition quarter."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm21',
    part: 7,
    title: 'Set the Q3 revenue baseline',
    from: 'priya',
    ask: `I'm handing the Q3 forecast to you. Start with the cleanest baseline we can defend today: June 2026 ARR, translated into one quarter of subscription revenue by segment. This is not a forecast of bookings or usage — it is the recurring-revenue run rate before we layer in pipeline, churn, or expansion.`,
    deliverable: `Three rows: segment and q3_subscription_revenue_run_rate, calculated as June-2026 ARR divided by 4, rounded to 2 decimals, sorted largest first.`,
    tables: ['fct_subscription_snapshot_monthly', 'dim_customer'],
    canonical: `SELECT c.segment, round(sum(s.arr_usd) / 4, 2) AS q3_subscription_revenue_run_rate FROM fct_subscription_snapshot_monthly s JOIN dim_customer c ON s.customer_id = c.customer_id WHERE s.month_start = DATE '2026-06-01' GROUP BY c.segment ORDER BY q3_subscription_revenue_run_rate DESC`,
    ordered: true,
    orderedNote: 'largest quarterly run rate first',
    fingerprintSQL: `SELECT c.segment, round(sum(s.arr_usd) / 12, 2) AS q3_subscription_revenue_run_rate FROM fct_subscription_snapshot_monthly s JOIN dim_customer c ON s.customer_id = c.customer_id WHERE s.month_start = DATE '2026-06-01' GROUP BY c.segment ORDER BY q3_subscription_revenue_run_rate DESC`,
    fingerprintMessage: `You translated annual recurring revenue into one month, not one quarter. ARR divided by 12 is monthly run rate; the Q3 baseline is three months, so divide ARR by 4. Keep calling it a baseline — pipeline and churn are still outside this number.`,
    hints: [
      `ARR is annual. One quarter is one fourth of a year, so aggregate June ARR by segment and divide each segment total by 4. Pin the snapshot to one month before grouping.`,
      `SELECT c.segment, round(sum(s.arr_usd) / __, 2) AS q3_subscription_revenue_run_rate FROM fct_subscription_snapshot_monthly s JOIN dim_customer c ON s.customer_id = c.customer_id WHERE s.month_start = DATE '____-__-01' GROUP BY c.segment ORDER BY q3_subscription_revenue_run_rate DESC;`,
      `SELECT c.segment, round(sum(s.arr_usd) / 4, 2) AS q3_subscription_revenue_run_rate FROM fct_subscription_snapshot_monthly s JOIN dim_customer c ON s.customer_id = c.customer_id WHERE s.month_start = DATE '2026-06-01' GROUP BY c.segment ORDER BY q3_subscription_revenue_run_rate DESC;\n\nThis is deliberately a baseline, not a complete forecast: new bookings, expansion, contraction, churn, and usage need separate assumptions.`,
    ],
    sayIt: `"I pinned the customer snapshot to June, grouped current ARR by segment, and divided by four to express one quarter of recurring revenue. I would label this the baseline before pipeline and retention assumptions."`,
    jdCompanies: ['Figma', 'Hightouch'],
  },
  {
    id: 'm22',
    part: 7,
    title: 'Name the concentration risk',
    from: 'priya',
    ask: `Before I show the baseline to the board, tell me how much of June ARR sits in our ten largest customers. I need the dollars and the percentage in one row, with the denominator coming from the same June snapshot. A top-ten list is interesting; concentration is decision-useful.`,
    deliverable: `One row: top_10_arr, total_arr, and top_10_concentration_pct for June 2026, with dollars rounded to 2 decimals and percentage to 1 decimal.`,
    tables: ['fct_subscription_snapshot_monthly'],
    canonical: `WITH ranked AS (SELECT arr_usd, row_number() OVER (ORDER BY arr_usd DESC, customer_id) AS arr_rank, sum(arr_usd) OVER () AS total_arr FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01') SELECT round(sum(CASE WHEN arr_rank <= 10 THEN arr_usd ELSE 0 END), 2) AS top_10_arr, round(max(total_arr), 2) AS total_arr, round(100.0 * sum(CASE WHEN arr_rank <= 10 THEN arr_usd ELSE 0 END) / max(total_arr), 1) AS top_10_concentration_pct FROM ranked`,
    ordered: false,
    requireRegex: ORDERED_ROW_NUMBER_REQUIREMENT,
    requireMessage: `The dollars happen to tie, but the query never defined which customers are the top ten. Rank the June snapshot with ROW_NUMBER() OVER (ORDER BY arr_usd DESC, customer_id), then aggregate ranks 1–10 against the full total.`,
    hints: [
      `Use one June-only CTE. Rank customers with row_number() over (order by arr_usd desc, customer_id), and put the full denominator on every row with sum(arr_usd) over ().`,
      `WITH ranked AS (SELECT arr_usd, row_number() OVER (ORDER BY ____ DESC, customer_id) AS arr_rank, sum(arr_usd) OVER () AS total_arr FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '____-__-01') SELECT sum(CASE WHEN arr_rank <= 10 THEN arr_usd ELSE 0 END) AS top_10_arr, max(total_arr) AS total_arr, 100.0 * sum(CASE WHEN arr_rank <= 10 THEN arr_usd ELSE 0 END) / max(total_arr) AS top_10_concentration_pct FROM ranked;`,
      `WITH ranked AS (SELECT arr_usd, row_number() OVER (ORDER BY arr_usd DESC, customer_id) AS arr_rank, sum(arr_usd) OVER () AS total_arr FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01') SELECT round(sum(CASE WHEN arr_rank <= 10 THEN arr_usd ELSE 0 END), 2) AS top_10_arr, round(max(total_arr), 2) AS total_arr, round(100.0 * sum(CASE WHEN arr_rank <= 10 THEN arr_usd ELSE 0 END) / max(total_arr), 1) AS top_10_concentration_pct FROM ranked;\n\nThe customer_id tie-break makes the ranking deterministic when two customers have identical ARR.`,
    ],
    sayIt: `"I ranked the June customer book deterministically, summed the first ten, and divided by the full June ARR denominator. That turns a customer list into a concentration assumption."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm23',
    part: 7,
    title: 'Carry the people-cost exit rate',
    from: 'elena',
    ask: `Revenue is only half the handoff. Use June payroll as the current people-cost exit rate and carry it across July through December, by division. This is a no-hiring, no-attrition baseline — useful because it makes the staffing assumptions we still need explicit.`,
    deliverable: `Four rows: division and h2_people_cost_run_rate, calculated as June-2026 total compensation multiplied by 6, rounded to 2 decimals, sorted largest first.`,
    tables: ['fct_payroll_monthly', 'dim_department'],
    canonical: `SELECT d.division, round(sum(p.total_comp_usd) * 6, 2) AS h2_people_cost_run_rate FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id WHERE p.payroll_month = DATE '2026-06-01' GROUP BY d.division ORDER BY h2_people_cost_run_rate DESC`,
    ordered: true,
    orderedNote: 'largest H2 run rate first',
    fingerprintSQL: `SELECT d.division, round(sum(p.total_comp_usd) * 12, 2) AS h2_people_cost_run_rate FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id WHERE p.payroll_month = DATE '2026-06-01' GROUP BY d.division ORDER BY h2_people_cost_run_rate DESC`,
    fingerprintMessage: `That annualizes June across twelve months, but the handoff asks for July through December — six months. Multiply the June exit rate by 6 and keep the no-hiring/no-attrition limitation attached.`,
    hints: [
      `June payroll has one row per paid employee. Join department for division, sum total_comp_usd by division, and multiply the monthly exit rate by the six remaining months.`,
      `SELECT d.division, round(sum(p.total_comp_usd) * __, 2) AS h2_people_cost_run_rate FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id WHERE p.payroll_month = DATE '____-__-01' GROUP BY d.division ORDER BY h2_people_cost_run_rate DESC;`,
      `SELECT d.division, round(sum(p.total_comp_usd) * 6, 2) AS h2_people_cost_run_rate FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id WHERE p.payroll_month = DATE '2026-06-01' GROUP BY d.division ORDER BY h2_people_cost_run_rate DESC;\n\nThis is an exit-rate baseline, not a workforce forecast: hiring, attrition, raises, bonus timing, and transfers stay visible as missing assumptions.`,
    ],
    sayIt: `"I used June payroll as the paid-employee exit rate, rolled six months by division, and would reconcile the result to the hiring plan next. The baseline and the missing assumptions are both explicit."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm24',
    part: 7,
    title: 'Package the forecast handoff',
    from: 'priya',
    ask: `Close the loop. Put the three assumptions into one compact handoff row: Q3 subscription-revenue run rate, top-ten ARR concentration, and H2 people-cost run rate. Do not join customer rows to payroll rows — aggregate each source to one row first, then combine the one-row results.`,
    deliverable: `Exactly one row: q3_subscription_revenue_run_rate, top_10_concentration_pct, and h2_people_cost_run_rate, rounded to 2, 1, and 2 decimals respectively.`,
    tables: ['fct_subscription_snapshot_monthly', 'fct_payroll_monthly'],
    canonical: `WITH revenue AS (SELECT sum(arr_usd) / 4 AS q3_subscription_revenue_run_rate FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'), ranked AS (SELECT arr_usd, row_number() OVER (ORDER BY arr_usd DESC, customer_id) AS arr_rank, sum(arr_usd) OVER () AS total_arr FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'), concentration AS (SELECT 100.0 * sum(CASE WHEN arr_rank <= 10 THEN arr_usd ELSE 0 END) / max(total_arr) AS top_10_concentration_pct FROM ranked), people AS (SELECT sum(total_comp_usd) * 6 AS h2_people_cost_run_rate FROM fct_payroll_monthly WHERE payroll_month = DATE '2026-06-01') SELECT round(r.q3_subscription_revenue_run_rate, 2) AS q3_subscription_revenue_run_rate, round(c.top_10_concentration_pct, 1) AS top_10_concentration_pct, round(p.h2_people_cost_run_rate, 2) AS h2_people_cost_run_rate FROM revenue r CROSS JOIN concentration c CROSS JOIN people p`,
    ordered: false,
    fingerprintSQL: `WITH revenue AS (SELECT sum(arr_usd) / 12 AS q3_subscription_revenue_run_rate FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'), ranked AS (SELECT arr_usd, row_number() OVER (ORDER BY arr_usd DESC, customer_id) AS arr_rank, sum(arr_usd) OVER () AS total_arr FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'), concentration AS (SELECT 100.0 * sum(CASE WHEN arr_rank <= 10 THEN arr_usd ELSE 0 END) / max(total_arr) AS top_10_concentration_pct FROM ranked), people AS (SELECT sum(total_comp_usd) * 12 AS h2_people_cost_run_rate FROM fct_payroll_monthly WHERE payroll_month = DATE '2026-06-01') SELECT round(r.q3_subscription_revenue_run_rate, 2) AS q3_subscription_revenue_run_rate, round(c.top_10_concentration_pct, 1) AS top_10_concentration_pct, round(p.h2_people_cost_run_rate, 2) AS h2_people_cost_run_rate FROM revenue r CROSS JOIN concentration c CROSS JOIN people p`,
    fingerprintMessage: `The row shape is right, but both time conversions are wrong: ARR divided by 12 is one month rather than Q3, and June payroll multiplied by 12 is a year rather than H2. Use /4 for the quarter and *6 for July–December.`,
    hints: [
      `Build one-row CTEs before combining anything: revenue from June ARR divided by 4; concentration from a ranked June customer book; people from June payroll multiplied by 6. CROSS JOIN is safe only after each CTE returns one row.`,
      `WITH revenue AS (... one row ...), ranked AS (... June customers with arr_rank and total_arr ...), concentration AS (... one row ...), people AS (... one row ...) SELECT round(r.q3_subscription_revenue_run_rate, 2), round(c.top_10_concentration_pct, 1), round(p.h2_people_cost_run_rate, 2) FROM revenue r CROSS JOIN concentration c CROSS JOIN people p;`,
      `WITH revenue AS (SELECT sum(arr_usd) / 4 AS q3_subscription_revenue_run_rate FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'), ranked AS (SELECT arr_usd, row_number() OVER (ORDER BY arr_usd DESC, customer_id) AS arr_rank, sum(arr_usd) OVER () AS total_arr FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'), concentration AS (SELECT 100.0 * sum(CASE WHEN arr_rank <= 10 THEN arr_usd ELSE 0 END) / max(total_arr) AS top_10_concentration_pct FROM ranked), people AS (SELECT sum(total_comp_usd) * 6 AS h2_people_cost_run_rate FROM fct_payroll_monthly WHERE payroll_month = DATE '2026-06-01') SELECT round(r.q3_subscription_revenue_run_rate, 2) AS q3_subscription_revenue_run_rate, round(c.top_10_concentration_pct, 1) AS top_10_concentration_pct, round(p.h2_people_cost_run_rate, 2) AS h2_people_cost_run_rate FROM revenue r CROSS JOIN concentration c CROSS JOIN people p;\n\nAggregate first, combine second. Joining raw customer and payroll grains would create a many-to-many explosion.`,
    ],
    sayIt: `"I kept the customer book and payroll at their native grains, reduced each assumption to one row, then cross-joined only those outputs. Every headline number traces to a named assumption."`,
    jdCompanies: ['Figma', 'Datadog'],
  },
  {
    id: 'm25',
    part: 8,
    title: 'Open the cutoff queue',
    from: 'elena',
    ask: `We need to reopen January without turning it into a fishing expedition. The board deck locked on February 5. Start with a population control: split every January accounting-date line into what the locked deck knew and what arrived afterward. I want the exception count beside the gross activity so we can see scale before touching individual accounts.`,
    deliverable: `Exactly two rows: cutoff_status, line_count, and gross_activity_usd. Use status labels Arrived after lock and In locked deck, with the exception row first and dollars rounded to 2 decimals.`,
    tables: ['fct_gl_transactions'],
    canonical: `SELECT CASE WHEN posted_at <= DATE '2026-02-05' THEN 'In locked deck' ELSE 'Arrived after lock' END AS cutoff_status, count(*)::BIGINT AS line_count, round(sum(abs(amount)), 2) AS gross_activity_usd FROM fct_gl_transactions WHERE txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31' GROUP BY 1 ORDER BY CASE cutoff_status WHEN 'Arrived after lock' THEN 1 ELSE 2 END`,
    ordered: true,
    orderedNote: 'exception row first',
    fingerprintSQL: `SELECT CASE WHEN posted_at <= DATE '2026-02-05' THEN 'In locked deck' ELSE 'Arrived after lock' END AS cutoff_status, count(*)::BIGINT AS line_count, round(sum(abs(amount)), 2) AS gross_activity_usd FROM fct_gl_transactions WHERE txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31' AND posted_at <= DATE '2026-02-05' GROUP BY 1 ORDER BY CASE cutoff_status WHEN 'Arrived after lock' THEN 1 ELSE 2 END`,
    fingerprintMessage: `The locked population is right, but the exception row vanished because the posting-date filter removed it before classification. txn_date defines the January close population; posted_at tells which version knew each line. Keep every January row in WHERE, then classify the cutoff with CASE.`,
    hints: [
      `Treat this like adding a status column to a January sheet. WHERE keeps January by txn_date; CASE labels each retained line by whether posted_at was on or before the February 5 lock. Then group by the label and count rows plus absolute dollars.`,
      `SELECT CASE WHEN posted_at <= DATE '____-__-__' THEN 'In locked deck' ELSE 'Arrived after lock' END AS cutoff_status, count(*) AS line_count, sum(abs(amount)) AS gross_activity_usd FROM fct_gl_transactions WHERE txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31' GROUP BY 1 ORDER BY CASE cutoff_status WHEN 'Arrived after lock' THEN 1 ELSE 2 END;`,
      `SELECT CASE WHEN posted_at <= DATE '2026-02-05' THEN 'In locked deck' ELSE 'Arrived after lock' END AS cutoff_status, count(*)::BIGINT AS line_count, round(sum(abs(amount)), 2) AS gross_activity_usd FROM fct_gl_transactions WHERE txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31' GROUP BY 1 ORDER BY CASE cutoff_status WHEN 'Arrived after lock' THEN 1 ELSE 2 END;\n\nAccounting date defines the close population. Posting date reconstructs what the warehouse knew at the lock. Filtering on both clocks would erase the evidence you are trying to measure.`,
    ],
    sayIt: `"I fixed the population to January by accounting date, then classified each line by the warehouse cutoff. Two late lines carry $370,000 of gross movement, so this is small by row count but material enough to investigate."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm26',
    part: 8,
    title: 'Prove the journal balances',
    from: 'elena',
    ask: `The cutoff queue points to a late journal. Test the exception at journal-entry grain before deciding what it changed. Preserve its accounting date and posting date, count its lines and accounts, and show both net and gross movement. A reclass can balance perfectly and still move a board metric.`,
    deliverable: `One row per post-lock January journal: je_id, accounting_date, posted_date, line_count, accounts_touched, net_usd, and gross_movement_usd, ordered by je_id.`,
    tables: ['fct_gl_transactions'],
    canonical: `SELECT je_id, min(txn_date)::DATE AS accounting_date, max(posted_at)::DATE AS posted_date, count(*)::BIGINT AS line_count, count(DISTINCT account_id)::BIGINT AS accounts_touched, round(sum(amount), 2) AS net_usd, round(sum(abs(amount)), 2) AS gross_movement_usd FROM fct_gl_transactions WHERE txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31' AND posted_at > DATE '2026-02-05' GROUP BY je_id ORDER BY je_id`,
    ordered: true,
    orderedNote: 'journal id',
    fingerprintSQL: `SELECT je_id, min(txn_date)::DATE AS accounting_date, max(posted_at)::DATE AS posted_date, count(*)::BIGINT AS line_count, count(DISTINCT account_id)::BIGINT AS accounts_touched, round(sum(amount), 2) AS net_usd, round(sum(abs(amount)), 2) AS gross_movement_usd FROM fct_gl_transactions WHERE txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31' AND posted_at > DATE '2026-02-05' GROUP BY je_id, account_id ORDER BY je_id`,
    fingerprintMessage: `You split the journal by account before testing whether it balances, so each side looks like a separate nonzero entry. A reclass nets at JE grain. Group by je_id, keep the dates with MIN/MAX, and count the distinct accounts inside that journal.`,
    hints: [
      `Filter to January rows posted after the lock, then GROUP BY je_id only. MIN(txn_date) and MAX(posted_at) preserve the two dates; count(*) counts lines; count(DISTINCT account_id) counts classifications; SUM(amount) proves balance; SUM(abs(amount)) preserves gross movement.`,
      `SELECT je_id, min(txn_date) AS accounting_date, max(posted_at) AS posted_date, count(*) AS line_count, count(DISTINCT account_id) AS accounts_touched, sum(amount) AS net_usd, sum(abs(amount)) AS gross_movement_usd FROM fct_gl_transactions WHERE txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31' AND posted_at > DATE '____-__-__' GROUP BY je_id ORDER BY je_id;`,
      `SELECT je_id, min(txn_date)::DATE AS accounting_date, max(posted_at)::DATE AS posted_date, count(*)::BIGINT AS line_count, count(DISTINCT account_id)::BIGINT AS accounts_touched, round(sum(amount), 2) AS net_usd, round(sum(abs(amount)), 2) AS gross_movement_usd FROM fct_gl_transactions WHERE txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31' AND posted_at > DATE '2026-02-05' GROUP BY je_id ORDER BY je_id;\n\nNet answers whether the journal balances. Gross answers how much classification moved. You need both before calling a zero-net entry immaterial.`,
    ],
    sayIt: `"I tested the exception at journal grain: two accounts and two lines net to zero, while gross movement is $370,000. It balances, but that does not yet tell us whether presentation changed."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm27',
    part: 8,
    title: 'Follow where the dollars moved',
    from: 'elena',
    ask: `Now route the review. Map both sides of the late journal to the division, department, account type, and account name that own them. Preserve the signed direction — absolute value is useful for materiality, but it cannot tell Riff what increased and what decreased.`,
    deliverable: `Two rows: division, dept_name, account_type, account_name, and signed change_usd, rounded to 2 decimals, positive side first.`,
    tables: ['fct_gl_transactions', 'dim_account', 'dim_department'],
    canonical: `SELECT d.division, d.dept_name, a.account_type, a.account_name, round(sum(g.amount), 2) AS change_usd FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id JOIN dim_department d ON g.dept_id = d.dept_id WHERE g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31' AND g.posted_at > DATE '2026-02-05' GROUP BY d.division, d.dept_name, a.account_type, a.account_name ORDER BY change_usd DESC`,
    ordered: true,
    orderedNote: 'positive side first',
    fingerprintSQL: `SELECT d.division, d.dept_name, a.account_type, a.account_name, round(sum(abs(g.amount)), 2) AS change_usd FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id JOIN dim_department d ON g.dept_id = d.dept_id WHERE g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31' AND g.posted_at > DATE '2026-02-05' GROUP BY d.division, d.dept_name, a.account_type, a.account_name ORDER BY change_usd DESC`,
    fingerprintMessage: `Both rows are positive because ABS destroyed the journal's direction. Gross movement belongs in the materiality check; this owner map needs signed amount so the reviewer can see that COGS increased while Opex decreased.`,
    hints: [
      `The late rows carry account_id and dept_id. JOIN dim_account for account_type/account_name and dim_department for division/dept_name, then group at exactly those four labels and sum the original signed amount.`,
      `SELECT d.division, d.dept_name, a.account_type, a.account_name, sum(g.amount) AS change_usd FROM fct_gl_transactions g JOIN dim_account a ON g.____ = a.____ JOIN dim_department d ON g.____ = d.____ WHERE g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31' AND g.posted_at > DATE '2026-02-05' GROUP BY d.division, d.dept_name, a.account_type, a.account_name ORDER BY change_usd DESC;`,
      `SELECT d.division, d.dept_name, a.account_type, a.account_name, round(sum(g.amount), 2) AS change_usd FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id JOIN dim_department d ON g.dept_id = d.dept_id WHERE g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31' AND g.posted_at > DATE '2026-02-05' GROUP BY d.division, d.dept_name, a.account_type, a.account_name ORDER BY change_usd DESC;\n\nSigned dollars preserve the accounting story: Hosting Costs in COGS went up while Software & SaaS in Opex went down. The journal balances across classifications.`,
    ],
    sayIt: `"The reclass moved $185,000 from Engineering Opex into Cloud Operations COGS. That preserves operating result but changes gross profit, gross margin, and who owns the explanation."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm28',
    part: 8,
    title: 'Restate the board gross margin',
    from: 'priya',
    ask: `Show me the visible consequence. Rebuild January revenue, COGS, and gross margin twice: first exactly as the February 5 deck knew them, then as the warehouse shows them now. Do not reduce COGS to the one account that changed — the board line includes every account classified as COGS.`,
    deliverable: `Exactly two rows: version, revenue_usd, cogs_usd, and gross_margin_pct. Use version labels Locked deck and Current warehouse, locked first; round dollars to 2 decimals and margin to 1 decimal.`,
    tables: ['fct_gl_transactions', 'dim_account'],
    canonical: `WITH versions AS (SELECT 'Locked deck' AS version, sum(CASE WHEN a.account_type = 'Revenue' AND g.posted_at <= DATE '2026-02-05' THEN g.amount ELSE 0 END) AS revenue_usd, sum(CASE WHEN a.account_type = 'COGS' AND g.posted_at <= DATE '2026-02-05' THEN g.amount ELSE 0 END) AS cogs_usd FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31' UNION ALL SELECT 'Current warehouse', sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END) FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31') SELECT version, round(revenue_usd, 2) AS revenue_usd, round(cogs_usd, 2) AS cogs_usd, round(100.0 * (revenue_usd - cogs_usd) / revenue_usd, 1) AS gross_margin_pct FROM versions ORDER BY CASE version WHEN 'Locked deck' THEN 1 ELSE 2 END`,
    ordered: true,
    orderedNote: 'locked deck first',
    fingerprintSQL: `WITH versions AS (SELECT 'Locked deck' AS version, sum(CASE WHEN a.account_type = 'Revenue' AND g.posted_at <= DATE '2026-02-05' THEN g.amount ELSE 0 END) AS revenue_usd, sum(CASE WHEN g.account_id = '5000' AND g.posted_at <= DATE '2026-02-05' THEN g.amount ELSE 0 END) AS cogs_usd FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31' UNION ALL SELECT 'Current warehouse', sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), sum(CASE WHEN g.account_id = '5000' THEN g.amount ELSE 0 END) FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31') SELECT version, round(revenue_usd, 2) AS revenue_usd, round(cogs_usd, 2) AS cogs_usd, round(100.0 * (revenue_usd - cogs_usd) / revenue_usd, 1) AS gross_margin_pct FROM versions ORDER BY CASE version WHEN 'Locked deck' THEN 1 ELSE 2 END`,
    fingerprintMessage: `Hosting Costs is the changed account, but it is not the whole COGS line. Gross margin must include every account whose dimension type is COGS. Use dim_account.account_type for the full board metric, and use the posting cutoff only to reconstruct the locked version.`,
    hints: [
      `Build a versions CTE with two one-row branches. Both filter txn_date to January. The locked branch conditionally sums Revenue and COGS only when posted_at is on or before February 5; the current branch sums every January row. UNION ALL the versions, then calculate margin.`,
      `WITH versions AS (SELECT 'Locked deck' AS version, sum(CASE WHEN a.account_type = 'Revenue' AND g.posted_at <= DATE '____-__-__' THEN g.amount ELSE 0 END) AS revenue_usd, sum(CASE WHEN a.account_type = 'COGS' AND g.posted_at <= DATE '____-__-__' THEN g.amount ELSE 0 END) AS cogs_usd FROM ... WHERE January UNION ALL SELECT 'Current warehouse', sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END) FROM ... WHERE January) SELECT version, revenue_usd, cogs_usd, 100.0 * (revenue_usd - cogs_usd) / revenue_usd AS gross_margin_pct FROM versions;`,
      `WITH versions AS (SELECT 'Locked deck' AS version, sum(CASE WHEN a.account_type = 'Revenue' AND g.posted_at <= DATE '2026-02-05' THEN g.amount ELSE 0 END) AS revenue_usd, sum(CASE WHEN a.account_type = 'COGS' AND g.posted_at <= DATE '2026-02-05' THEN g.amount ELSE 0 END) AS cogs_usd FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31' UNION ALL SELECT 'Current warehouse', sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END), sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END) FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31') SELECT version, round(revenue_usd, 2) AS revenue_usd, round(cogs_usd, 2) AS cogs_usd, round(100.0 * (revenue_usd - cogs_usd) / revenue_usd, 1) AS gross_margin_pct FROM versions ORDER BY CASE version WHEN 'Locked deck' THEN 1 ELSE 2 END;\n\nRevenue does not move. COGS does. The restatement therefore changes gross profit and margin even though the balanced reclass leaves operating result intact.`,
    ],
    sayIt: `"I reconstructed the locked knowledge cutoff and current warehouse using the full account classification. Revenue holds, COGS rises $185,000, and January gross margin restates from 63.6% to 60.8%."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm29',
    part: 8,
    title: 'Give Rex the close conclusion',
    from: 'elena',
    ask: `Close the review in one row. Show whether operating result changed, how gross profit and gross margin changed, and the gross amount moved after lock. The conclusion needs to say both truths at once: a net-zero reclass can be immaterial to operating profit and material to presentation.`,
    deliverable: `Exactly one row: operating_result_change_usd, gross_profit_change_usd, gross_margin_change_pp, and late_gross_movement_usd, rounded to 2, 2, 1, and 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_account'],
    canonical: `WITH totals AS (SELECT sum(CASE WHEN a.account_type = 'Revenue' AND g.posted_at <= DATE '2026-02-05' THEN g.amount ELSE 0 END) AS locked_revenue, sum(CASE WHEN a.account_type = 'COGS' AND g.posted_at <= DATE '2026-02-05' THEN g.amount ELSE 0 END) AS locked_cogs, sum(CASE WHEN a.account_type = 'Opex' AND g.posted_at <= DATE '2026-02-05' THEN g.amount ELSE 0 END) AS locked_opex, sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END) AS current_revenue, sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END) AS current_cogs, sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END) AS current_opex, sum(CASE WHEN g.posted_at > DATE '2026-02-05' THEN abs(g.amount) ELSE 0 END) AS late_gross FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31') SELECT round((current_revenue - current_cogs - current_opex) - (locked_revenue - locked_cogs - locked_opex), 2) AS operating_result_change_usd, round((current_revenue - current_cogs) - (locked_revenue - locked_cogs), 2) AS gross_profit_change_usd, round(100.0 * (current_revenue - current_cogs) / current_revenue - 100.0 * (locked_revenue - locked_cogs) / locked_revenue, 1) AS gross_margin_change_pp, round(late_gross, 2) AS late_gross_movement_usd FROM totals`,
    ordered: false,
    fingerprintSQL: `WITH totals AS (SELECT sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END) AS locked_revenue, sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END) AS locked_cogs, sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END) AS locked_opex, sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END) AS current_revenue, sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END) AS current_cogs, sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END) AS current_opex, sum(CASE WHEN g.posted_at > DATE '2026-02-05' THEN abs(g.amount) ELSE 0 END) AS late_gross FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31') SELECT round((current_revenue - current_cogs - current_opex) - (locked_revenue - locked_cogs - locked_opex), 2) AS operating_result_change_usd, round((current_revenue - current_cogs) - (locked_revenue - locked_cogs), 2) AS gross_profit_change_usd, round(100.0 * (current_revenue - current_cogs) / current_revenue - 100.0 * (locked_revenue - locked_cogs) / locked_revenue, 1) AS gross_margin_change_pp, round(late_gross, 2) AS late_gross_movement_usd FROM totals`,
    fingerprintMessage: `Gross movement is visible, but every impact is zero because both versions were rebuilt from today's rows. Apply the February 5 posting cutoff separately to the locked Revenue, COGS, and Opex aggregates; leave the current aggregates unrestricted within January.`,
    hints: [
      `In one totals CTE, build locked and current sums for Revenue, COGS, and Opex. Locked columns use the posting cutoff; current columns do not. Operating result is revenue minus COGS minus Opex. Gross profit excludes Opex. Margin change is current percentage minus locked percentage.`,
      `WITH totals AS (SELECT ... locked_revenue, locked_cogs, locked_opex using posted_at <= February 5, ... current_revenue, current_cogs, current_opex using all January rows, ... late_gross using abs(amount) after February 5 FROM the January GL joined to dim_account) SELECT (current operating result) - (locked operating result), (current gross profit) - (locked gross profit), (current gross margin %) - (locked gross margin %), late_gross FROM totals;`,
      `WITH totals AS (SELECT sum(CASE WHEN a.account_type = 'Revenue' AND g.posted_at <= DATE '2026-02-05' THEN g.amount ELSE 0 END) AS locked_revenue, sum(CASE WHEN a.account_type = 'COGS' AND g.posted_at <= DATE '2026-02-05' THEN g.amount ELSE 0 END) AS locked_cogs, sum(CASE WHEN a.account_type = 'Opex' AND g.posted_at <= DATE '2026-02-05' THEN g.amount ELSE 0 END) AS locked_opex, sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END) AS current_revenue, sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END) AS current_cogs, sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END) AS current_opex, sum(CASE WHEN g.posted_at > DATE '2026-02-05' THEN abs(g.amount) ELSE 0 END) AS late_gross FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31') SELECT round((current_revenue - current_cogs - current_opex) - (locked_revenue - locked_cogs - locked_opex), 2) AS operating_result_change_usd, round((current_revenue - current_cogs) - (locked_revenue - locked_cogs), 2) AS gross_profit_change_usd, round(100.0 * (current_revenue - current_cogs) / current_revenue - 100.0 * (locked_revenue - locked_cogs) / locked_revenue, 1) AS gross_margin_change_pp, round(late_gross, 2) AS late_gross_movement_usd FROM totals;\n\nThe final row keeps net and presentation materiality separate: operating result changes $0, gross profit changes -$185,000, gross margin changes -2.8 points, and the balanced journal moved $370,000 gross.`,
    ],
    sayIt: `"The entry is zero-net to operating result, but it reduces gross profit by $185,000 and gross margin by 2.8 points. I would restate the presentation, document the $370,000 gross reclass, and tighten the post-lock journal control."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm30',
    part: 9,
    title: 'Size the vendor book',
    from: 'priya',
    ask: `Procurement review is Friday, and I do not want the meeting to start from a list of anecdotes. Size the vendor-backed spend for the trailing twelve months, July 2025 through June 2026, by category. Give me the transaction volume, vendor-record count, dollars, and share of the whole book so we can decide where the review deserves time.`,
    deliverable: `One row per vendor category: category, line_count, vendor_records, spend_usd, and spend_pct. Round dollars to 2 decimals and share to 1; order largest spend first.`,
    tables: ['fct_gl_transactions', 'dim_vendor'],
    canonical: `SELECT v.category, count(*)::BIGINT AS line_count, count(DISTINCT g.vendor_id)::BIGINT AS vendor_records, round(sum(g.amount), 2) AS spend_usd, round(100.0 * sum(g.amount) / sum(sum(g.amount)) OVER (), 1) AS spend_pct FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id WHERE g.txn_date >= DATE '2025-07-01' AND g.txn_date < DATE '2026-07-01' GROUP BY v.category ORDER BY spend_usd DESC`,
    ordered: true,
    orderedNote: 'largest spend first',
    fingerprintSQL: `SELECT v.category, count(*)::BIGINT AS line_count, count(DISTINCT g.vendor_id)::BIGINT AS vendor_records, round(sum(g.amount), 2) AS spend_usd, round(100.0 * sum(g.amount) / sum(sum(g.amount)) OVER (), 1) AS spend_pct FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id GROUP BY v.category ORDER BY spend_usd DESC`,
    fingerprintMessage: `This is the all-history vendor book, not the trailing twelve months. Keep the category aggregation, but bound txn_date from July 1, 2025 through June 30, 2026 before calculating dollars and shares.`,
    hints: [
      `JOIN each vendor-backed GL line to dim_vendor, filter the half-open twelve-month window, then GROUP BY category. A window over the grouped SUM gives each category's share without a second query.`,
      `SELECT v.category, count(*) AS line_count, count(DISTINCT g.vendor_id) AS vendor_records, sum(g.amount) AS spend_usd, 100.0 * sum(g.amount) / sum(sum(g.amount)) OVER () AS spend_pct FROM fct_gl_transactions g JOIN dim_vendor v ON ... WHERE g.txn_date >= DATE '2025-07-01' AND g.txn_date < DATE '2026-07-01' GROUP BY v.category ORDER BY spend_usd DESC;`,
      `SELECT v.category, count(*)::BIGINT AS line_count, count(DISTINCT g.vendor_id)::BIGINT AS vendor_records, round(sum(g.amount), 2) AS spend_usd, round(100.0 * sum(g.amount) / sum(sum(g.amount)) OVER (), 1) AS spend_pct FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id WHERE g.txn_date >= DATE '2025-07-01' AND g.txn_date < DATE '2026-07-01' GROUP BY v.category ORDER BY spend_usd DESC;\n\nThe denominator is the same filtered vendor book, so the category shares reconcile to roughly 100%.`,
    ],
    sayIt: `"The trailing-twelve-month vendor book is $150.6 million. Marketing Programs is the largest category at $45.0 million, or 29.9%, so I would start the operating review there rather than with the loudest individual invoice."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm31',
    part: 9,
    title: 'Repair the vendor identity map',
    from: 'elena',
    ask: `Before we rank suppliers, audit the vendor master. AP has separate records for Amazon Web Services, Google Cloud, and LinkedIn under multiple names and payment terms. Normalize those known families, preserve every master record even if it had no spend in the trailing twelve months, and show which canonical suppliers have more than one source name.`,
    deliverable: `One row per duplicated canonical supplier: canonical_vendor, source_names, terms_versions, and ttm_spend_usd. Round dollars to 2 decimals and order largest spend first.`,
    tables: ['dim_vendor', 'fct_gl_transactions'],
    canonical: `WITH vendor_spend AS (SELECT vendor_id, sum(amount) AS spend_usd FROM fct_gl_transactions WHERE txn_date >= DATE '2025-07-01' AND txn_date < DATE '2026-07-01' GROUP BY vendor_id), cleaned AS (SELECT CASE WHEN lower(v.vendor_name) IN ('aws', 'amazon web services', 'amazon web services, inc.') THEN 'Amazon Web Services' WHEN lower(v.vendor_name) IN ('google cloud', 'google llc') THEN 'Google Cloud' WHEN lower(v.vendor_name) IN ('linkedin', 'linkedin corp') THEN 'LinkedIn' ELSE v.vendor_name END AS canonical_vendor, v.vendor_name, v.payment_terms, coalesce(s.spend_usd, 0) AS spend_usd FROM dim_vendor v LEFT JOIN vendor_spend s ON v.vendor_id = s.vendor_id) SELECT canonical_vendor, count(DISTINCT vendor_name)::BIGINT AS source_names, count(DISTINCT payment_terms)::BIGINT AS terms_versions, round(sum(spend_usd), 2) AS ttm_spend_usd FROM cleaned GROUP BY canonical_vendor HAVING count(DISTINCT vendor_name) > 1 ORDER BY ttm_spend_usd DESC`,
    ordered: true,
    orderedNote: 'largest trailing-twelve-month spend first',
    fingerprintSQL: `WITH cleaned AS (SELECT CASE WHEN lower(v.vendor_name) IN ('aws', 'amazon web services', 'amazon web services, inc.') THEN 'Amazon Web Services' WHEN lower(v.vendor_name) IN ('google cloud', 'google llc') THEN 'Google Cloud' WHEN lower(v.vendor_name) IN ('linkedin', 'linkedin corp') THEN 'LinkedIn' ELSE v.vendor_name END AS canonical_vendor, v.vendor_name, v.payment_terms, g.amount FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id WHERE g.txn_date >= DATE '2025-07-01' AND g.txn_date < DATE '2026-07-01') SELECT canonical_vendor, count(DISTINCT vendor_name)::BIGINT AS source_names, count(DISTINCT payment_terms)::BIGINT AS terms_versions, round(sum(amount), 2) AS ttm_spend_usd FROM cleaned GROUP BY canonical_vendor HAVING count(DISTINCT vendor_name) > 1 ORDER BY ttm_spend_usd DESC`,
    fingerprintMessage: `The INNER JOIN made an inactive LinkedIn master alias disappear, so the audit says that family has only one name. Aggregate TTM spend by vendor_id first, then LEFT JOIN it onto the complete vendor master before testing duplicate identities.`,
    hints: [
      `This is a master-data audit with spend attached, not a spend table with names attached. First aggregate TTM GL spend by vendor_id. Then start from dim_vendor and LEFT JOIN that spend so zero-spend aliases remain visible.`,
      `WITH vendor_spend AS (... TTM sum by vendor_id ...), cleaned AS (SELECT CASE ... END AS canonical_vendor, v.vendor_name, v.payment_terms, coalesce(s.spend_usd, 0) FROM dim_vendor v LEFT JOIN vendor_spend s ON ...) SELECT canonical_vendor, count(DISTINCT vendor_name), count(DISTINCT payment_terms), sum(spend_usd) FROM cleaned GROUP BY canonical_vendor HAVING count(DISTINCT vendor_name) > 1;`,
      `WITH vendor_spend AS (SELECT vendor_id, sum(amount) AS spend_usd FROM fct_gl_transactions WHERE txn_date >= DATE '2025-07-01' AND txn_date < DATE '2026-07-01' GROUP BY vendor_id), cleaned AS (SELECT CASE WHEN lower(v.vendor_name) IN ('aws', 'amazon web services', 'amazon web services, inc.') THEN 'Amazon Web Services' WHEN lower(v.vendor_name) IN ('google cloud', 'google llc') THEN 'Google Cloud' WHEN lower(v.vendor_name) IN ('linkedin', 'linkedin corp') THEN 'LinkedIn' ELSE v.vendor_name END AS canonical_vendor, v.vendor_name, v.payment_terms, coalesce(s.spend_usd, 0) AS spend_usd FROM dim_vendor v LEFT JOIN vendor_spend s ON v.vendor_id = s.vendor_id) SELECT canonical_vendor, count(DISTINCT vendor_name)::BIGINT AS source_names, count(DISTINCT payment_terms)::BIGINT AS terms_versions, round(sum(spend_usd), 2) AS ttm_spend_usd FROM cleaned GROUP BY canonical_vendor HAVING count(DISTINCT vendor_name) > 1 ORDER BY ttm_spend_usd DESC;\n\nThe LEFT JOIN is the control: an unused alias is still a duplicate master record and should not vanish from the audit.`,
    ],
    sayIt: `"The master has three AWS names, two Google names, and two LinkedIn names, with conflicting terms inside every family. I kept inactive records in the audit because identity risk exists even when one alias had no recent spend."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm32',
    part: 9,
    title: 'Measure supplier concentration',
    from: 'priya',
    ask: `Now rank the real suppliers, not AP spellings. Using the identity map you just established, show the five largest canonical vendors in the trailing twelve months and each supplier's share of the complete vendor-backed spend base. Deterministic ties matter because this table is going into the review packet.`,
    deliverable: `Exactly five rows: spend_rank, canonical_vendor, spend_usd, and spend_pct. Round dollars to 2 decimals and share to 1; order by rank.`,
    tables: ['fct_gl_transactions', 'dim_vendor'],
    canonical: `WITH cleaned AS (SELECT CASE WHEN lower(v.vendor_name) IN ('aws', 'amazon web services', 'amazon web services, inc.') THEN 'Amazon Web Services' WHEN lower(v.vendor_name) IN ('google cloud', 'google llc') THEN 'Google Cloud' WHEN lower(v.vendor_name) IN ('linkedin', 'linkedin corp') THEN 'LinkedIn' ELSE v.vendor_name END AS canonical_vendor, g.amount FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id WHERE g.txn_date >= DATE '2025-07-01' AND g.txn_date < DATE '2026-07-01'), vendors AS (SELECT canonical_vendor, sum(amount) AS spend_usd FROM cleaned GROUP BY canonical_vendor), ranked AS (SELECT canonical_vendor, spend_usd, row_number() OVER (ORDER BY spend_usd DESC, canonical_vendor) AS spend_rank, 100.0 * spend_usd / sum(spend_usd) OVER () AS spend_pct FROM vendors) SELECT spend_rank, canonical_vendor, round(spend_usd, 2) AS spend_usd, round(spend_pct, 1) AS spend_pct FROM ranked WHERE spend_rank <= 5 ORDER BY spend_rank`,
    ordered: true,
    orderedNote: 'supplier spend rank',
    fingerprintSQL: `WITH vendors AS (SELECT v.vendor_name AS canonical_vendor, sum(g.amount) AS spend_usd FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id WHERE g.txn_date >= DATE '2025-07-01' AND g.txn_date < DATE '2026-07-01' GROUP BY v.vendor_name), ranked AS (SELECT canonical_vendor, spend_usd, row_number() OVER (ORDER BY spend_usd DESC, canonical_vendor) AS spend_rank, 100.0 * spend_usd / sum(spend_usd) OVER () AS spend_pct FROM vendors) SELECT spend_rank, canonical_vendor, round(spend_usd, 2) AS spend_usd, round(spend_pct, 1) AS spend_pct FROM ranked WHERE spend_rank <= 5 ORDER BY spend_rank`,
    fingerprintMessage: `You ranked AP names rather than canonical suppliers, splitting AWS and Google across multiple rows. Normalize vendor_name before the supplier GROUP BY, then rank the consolidated spend against the complete TTM denominator.`,
    hints: [
      `Clean vendor_name at line grain, aggregate the cleaned rows to one row per canonical supplier, then add rank and denominator windows. Filter to the top five only after the denominator has seen every supplier.`,
      `WITH cleaned AS (SELECT CASE ... END AS canonical_vendor, g.amount FROM ... WHERE TTM), vendors AS (SELECT canonical_vendor, sum(amount) AS spend_usd FROM cleaned GROUP BY 1), ranked AS (SELECT ..., row_number() OVER (ORDER BY spend_usd DESC, canonical_vendor) AS spend_rank, 100.0 * spend_usd / sum(spend_usd) OVER () AS spend_pct FROM vendors) SELECT ... FROM ranked WHERE spend_rank <= 5 ORDER BY spend_rank;`,
      `WITH cleaned AS (SELECT CASE WHEN lower(v.vendor_name) IN ('aws', 'amazon web services', 'amazon web services, inc.') THEN 'Amazon Web Services' WHEN lower(v.vendor_name) IN ('google cloud', 'google llc') THEN 'Google Cloud' WHEN lower(v.vendor_name) IN ('linkedin', 'linkedin corp') THEN 'LinkedIn' ELSE v.vendor_name END AS canonical_vendor, g.amount FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id WHERE g.txn_date >= DATE '2025-07-01' AND g.txn_date < DATE '2026-07-01'), vendors AS (SELECT canonical_vendor, sum(amount) AS spend_usd FROM cleaned GROUP BY canonical_vendor), ranked AS (SELECT canonical_vendor, spend_usd, row_number() OVER (ORDER BY spend_usd DESC, canonical_vendor) AS spend_rank, 100.0 * spend_usd / sum(spend_usd) OVER () AS spend_pct FROM vendors) SELECT spend_rank, canonical_vendor, round(spend_usd, 2) AS spend_usd, round(spend_pct, 1) AS spend_pct FROM ranked WHERE spend_rank <= 5 ORDER BY spend_rank;\n\nThe total window runs before the top-five filter, so shares use the whole vendor book rather than only the displayed rows.`,
    ],
    sayIt: `"After consolidating aliases, AWS is the largest supplier at $11.3 million and 7.5% of vendor-backed spend. The top vendor matters, but the book is not dominated by a single counterparty."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm33',
    part: 9,
    title: 'Map the loaded payment terms',
    from: 'elena',
    ask: `Supplier concentration is only one lens. Show me how the same trailing-twelve-month spend base is distributed across the payment terms loaded on each vendor record. This is historical booked-spend mix, not an outstanding-payables report—we do not have invoices, due dates, or payment status here. Count vendor records as loaded; do not pretend duplicate identities are already a clean contract master.`,
    deliverable: `One row per payment_terms value: payment_terms, vendor_records, spend_usd, and spend_pct. Round dollars to 2 decimals and share to 1; order largest spend first.`,
    tables: ['fct_gl_transactions', 'dim_vendor'],
    canonical: `SELECT v.payment_terms, count(DISTINCT g.vendor_id)::BIGINT AS vendor_records, round(sum(g.amount), 2) AS spend_usd, round(100.0 * sum(g.amount) / sum(sum(g.amount)) OVER (), 1) AS spend_pct FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id WHERE g.txn_date >= DATE '2025-07-01' AND g.txn_date < DATE '2026-07-01' GROUP BY v.payment_terms ORDER BY spend_usd DESC`,
    ordered: true,
    orderedNote: 'largest spend first',
    fingerprintSQL: `SELECT v.payment_terms, count(DISTINCT g.vendor_id)::BIGINT AS vendor_records, round(sum(g.amount), 2) AS spend_usd, round(100.0 * sum(g.amount) / sum(sum(g.amount)) OVER (), 1) AS spend_pct FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id GROUP BY v.payment_terms ORDER BY spend_usd DESC`,
    fingerprintMessage: `The terms split is internally consistent but it uses all 42 months, so it cannot reconcile to the TTM vendor baseline. Apply the same July 2025 through June 2026 filter before grouping by payment_terms.`,
    hints: [
      `Reuse the exact TTM population from the category baseline, but group on payment_terms. Count distinct vendor_id records, sum spend, and divide each grouped sum by the windowed total of grouped sums.`,
      `SELECT v.payment_terms, count(DISTINCT g.vendor_id), sum(g.amount), 100.0 * sum(g.amount) / sum(sum(g.amount)) OVER () FROM fct_gl_transactions g JOIN dim_vendor v ON ... WHERE g.txn_date >= DATE '2025-07-01' AND g.txn_date < DATE '2026-07-01' GROUP BY v.payment_terms ORDER BY spend_usd DESC;`,
      `SELECT v.payment_terms, count(DISTINCT g.vendor_id)::BIGINT AS vendor_records, round(sum(g.amount), 2) AS spend_usd, round(100.0 * sum(g.amount) / sum(sum(g.amount)) OVER (), 1) AS spend_pct FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id WHERE g.txn_date >= DATE '2025-07-01' AND g.txn_date < DATE '2026-07-01' GROUP BY v.payment_terms ORDER BY spend_usd DESC;\n\nThis is historical spend grouped by the loaded term. It does not measure open invoices or current cash due, and it does not claim the vendor master has been remediated.`,
    ],
    sayIt: `"Vendor records labeled Due on receipt carried $27.1 million, or 18.0% of TTM booked spend. That is a historical spend-mix flag—not a payable balance—so Procurement should validate the conflicting master terms and Treasury should use invoice data for an actual cash view."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm34',
    part: 9,
    title: 'Explain the quarter-over-quarter swings',
    from: 'priya',
    ask: `The baseline tells me where spend is; now tell me what moved. Compare Q1 and Q2 2026 vendor-backed spend by category, show the dollar and percentage change, and sort by the dollar increase. Keep decreases visible—review packets that show only bad news are as misleading as packets that show only good news.`,
    deliverable: `One row per category: category, q1_spend_usd, q2_spend_usd, change_usd, and change_pct. Round dollars to 2 decimals and percent to 1; order largest dollar change first.`,
    tables: ['fct_gl_transactions', 'dim_vendor'],
    canonical: `WITH quarters AS (SELECT v.category, sum(CASE WHEN g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-04-01' THEN g.amount ELSE 0 END) AS q1_spend_usd, sum(CASE WHEN g.txn_date >= DATE '2026-04-01' AND g.txn_date < DATE '2026-07-01' THEN g.amount ELSE 0 END) AS q2_spend_usd FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY v.category) SELECT category, round(q1_spend_usd, 2) AS q1_spend_usd, round(q2_spend_usd, 2) AS q2_spend_usd, round(q2_spend_usd - q1_spend_usd, 2) AS change_usd, round(100.0 * (q2_spend_usd - q1_spend_usd) / nullif(q1_spend_usd, 0), 1) AS change_pct FROM quarters ORDER BY change_usd DESC`,
    ordered: true,
    orderedNote: 'largest dollar increase first',
    fingerprintSQL: `WITH quarters AS (SELECT v.category, sum(CASE WHEN date_part('quarter', g.txn_date) = 1 THEN g.amount ELSE 0 END) AS q1_spend_usd, sum(CASE WHEN date_part('quarter', g.txn_date) = 2 THEN g.amount ELSE 0 END) AS q2_spend_usd FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id GROUP BY v.category) SELECT category, round(q1_spend_usd, 2) AS q1_spend_usd, round(q2_spend_usd, 2) AS q2_spend_usd, round(q2_spend_usd - q1_spend_usd, 2) AS change_usd, round(100.0 * (q2_spend_usd - q1_spend_usd) / nullif(q1_spend_usd, 0), 1) AS change_pct FROM quarters ORDER BY change_usd DESC`,
    fingerprintMessage: `DATE_PART found Q1 and Q2 in every year, so this is a multi-year seasonal comparison rather than 2026 quarter over quarter. Bound the population to January through June 2026, then split it with half-open quarter dates.`,
    hints: [
      `First fix the population to H1 2026. Inside one category GROUP BY, conditional SUMs build Q1 and Q2 columns. The outer query calculates Q2 minus Q1 and divides that change by Q1.`,
      `WITH quarters AS (SELECT v.category, sum(CASE WHEN g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-04-01' THEN g.amount ELSE 0 END) AS q1_spend_usd, sum(CASE WHEN g.txn_date >= DATE '2026-04-01' AND g.txn_date < DATE '2026-07-01' THEN g.amount ELSE 0 END) AS q2_spend_usd FROM ... WHERE H1 2026 GROUP BY v.category) SELECT ..., q2_spend_usd - q1_spend_usd, 100.0 * (q2_spend_usd - q1_spend_usd) / nullif(q1_spend_usd, 0) FROM quarters;`,
      `WITH quarters AS (SELECT v.category, sum(CASE WHEN g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-04-01' THEN g.amount ELSE 0 END) AS q1_spend_usd, sum(CASE WHEN g.txn_date >= DATE '2026-04-01' AND g.txn_date < DATE '2026-07-01' THEN g.amount ELSE 0 END) AS q2_spend_usd FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY v.category) SELECT category, round(q1_spend_usd, 2) AS q1_spend_usd, round(q2_spend_usd, 2) AS q2_spend_usd, round(q2_spend_usd - q1_spend_usd, 2) AS change_usd, round(100.0 * (q2_spend_usd - q1_spend_usd) / nullif(q1_spend_usd, 0), 1) AS change_pct FROM quarters ORDER BY change_usd DESC;\n\nHalf-open date ranges prevent boundary overlap and keep the year explicit.`,
    ],
    sayIt: `"Marketing Programs is the largest Q2 increase at $1.24 million, up 10.3%. Recruiting moved the other way, down $168,000, so the review should ask whether both movements reflect the operating plan rather than treating every variance as a problem."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm35',
    part: 9,
    title: 'Route every material swing',
    from: 'priya',
    ask: `A variance without an owner is trivia. For every vendor category whose absolute Q2-versus-Q1 change is at least $250,000, find the department with the most Q2 spend in that category and the leader who owns it. Show that department's share of the category too—a dominant owner and a fragmented category require different conversations.`,
    deliverable: `One row per material category: category, change_usd, dept_name, leader_name, owner_spend_usd, and owner_pct. Round dollars to 2 decimals and share to 1; order by absolute change largest first.`,
    tables: ['fct_gl_transactions', 'dim_vendor', 'dim_department'],
    canonical: `WITH quarters AS (SELECT v.category, sum(CASE WHEN g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-04-01' THEN g.amount ELSE 0 END) AS q1_spend, sum(CASE WHEN g.txn_date >= DATE '2026-04-01' AND g.txn_date < DATE '2026-07-01' THEN g.amount ELSE 0 END) AS q2_spend FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY v.category), swings AS (SELECT category, q2_spend - q1_spend AS change_usd FROM quarters WHERE abs(q2_spend - q1_spend) >= 250000), dept_spend AS (SELECT v.category, d.dept_name, d.leader_name, sum(g.amount) AS q2_dept_spend FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id JOIN dim_department d ON g.dept_id = d.dept_id JOIN swings s ON v.category = s.category WHERE g.txn_date >= DATE '2026-04-01' AND g.txn_date < DATE '2026-07-01' GROUP BY v.category, d.dept_name, d.leader_name), ranked AS (SELECT category, dept_name, leader_name, q2_dept_spend, sum(q2_dept_spend) OVER (PARTITION BY category) AS q2_category_spend, row_number() OVER (PARTITION BY category ORDER BY q2_dept_spend DESC, dept_name) AS owner_rank FROM dept_spend) SELECT r.category, round(s.change_usd, 2) AS change_usd, r.dept_name, r.leader_name, round(r.q2_dept_spend, 2) AS owner_spend_usd, round(100.0 * r.q2_dept_spend / r.q2_category_spend, 1) AS owner_pct FROM ranked r JOIN swings s ON r.category = s.category WHERE r.owner_rank = 1 ORDER BY abs(s.change_usd) DESC`,
    ordered: true,
    orderedNote: 'largest absolute quarter-over-quarter change first',
    fingerprintSQL: `WITH quarters AS (SELECT v.category, sum(CASE WHEN g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-04-01' THEN g.amount ELSE 0 END) AS q1_spend, sum(CASE WHEN g.txn_date >= DATE '2026-04-01' AND g.txn_date < DATE '2026-07-01' THEN g.amount ELSE 0 END) AS q2_spend FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY v.category), swings AS (SELECT category, q2_spend - q1_spend AS change_usd FROM quarters WHERE abs(q2_spend - q1_spend) >= 250000), dept_spend AS (SELECT v.category, d.dept_name, d.leader_name, sum(g.amount) AS q2_dept_spend FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id JOIN dim_department d ON g.dept_id = d.dept_id JOIN swings s ON v.category = s.category WHERE g.txn_date >= DATE '2026-04-01' AND g.txn_date < DATE '2026-07-01' GROUP BY v.category, d.dept_name, d.leader_name), ranked AS (SELECT category, dept_name, leader_name, q2_dept_spend, sum(q2_dept_spend) OVER () AS q2_category_spend, row_number() OVER (ORDER BY q2_dept_spend DESC, dept_name) AS owner_rank FROM dept_spend) SELECT r.category, round(s.change_usd, 2) AS change_usd, r.dept_name, r.leader_name, round(r.q2_dept_spend, 2) AS owner_spend_usd, round(100.0 * r.q2_dept_spend / r.q2_category_spend, 1) AS owner_pct FROM ranked r JOIN swings s ON r.category = s.category WHERE r.owner_rank = 1 ORDER BY abs(s.change_usd) DESC`,
    fingerprintMessage: `You found one owner for the whole review, but the ask needs one dominant department per material category. Both ROW_NUMBER and the category total window must PARTITION BY category before filtering owner_rank = 1.`,
    hints: [
      `Carry the material category swings from the prior analysis. Aggregate Q2 spend by category and department, then use two windows partitioned by category: SUM for the category denominator and ROW_NUMBER for the dominant owner.`,
      `WITH ... swings AS (... abs(change) >= 250000 ...), dept_spend AS (... Q2 sum by category, dept, leader ...), ranked AS (SELECT ..., sum(q2_dept_spend) OVER (PARTITION BY category) AS category_total, row_number() OVER (PARTITION BY category ORDER BY q2_dept_spend DESC, dept_name) AS owner_rank FROM dept_spend) SELECT ... FROM ranked JOIN swings USING (category) WHERE owner_rank = 1;`,
      `WITH quarters AS (SELECT v.category, sum(CASE WHEN g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-04-01' THEN g.amount ELSE 0 END) AS q1_spend, sum(CASE WHEN g.txn_date >= DATE '2026-04-01' AND g.txn_date < DATE '2026-07-01' THEN g.amount ELSE 0 END) AS q2_spend FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY v.category), swings AS (SELECT category, q2_spend - q1_spend AS change_usd FROM quarters WHERE abs(q2_spend - q1_spend) >= 250000), dept_spend AS (SELECT v.category, d.dept_name, d.leader_name, sum(g.amount) AS q2_dept_spend FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id JOIN dim_department d ON g.dept_id = d.dept_id JOIN swings s ON v.category = s.category WHERE g.txn_date >= DATE '2026-04-01' AND g.txn_date < DATE '2026-07-01' GROUP BY v.category, d.dept_name, d.leader_name), ranked AS (SELECT category, dept_name, leader_name, q2_dept_spend, sum(q2_dept_spend) OVER (PARTITION BY category) AS q2_category_spend, row_number() OVER (PARTITION BY category ORDER BY q2_dept_spend DESC, dept_name) AS owner_rank FROM dept_spend) SELECT r.category, round(s.change_usd, 2) AS change_usd, r.dept_name, r.leader_name, round(r.q2_dept_spend, 2) AS owner_spend_usd, round(100.0 * r.q2_dept_spend / r.q2_category_spend, 1) AS owner_pct FROM ranked r JOIN swings s ON r.category = s.category WHERE r.owner_rank = 1 ORDER BY abs(s.change_usd) DESC;\n\nThe partition is the SQL version of ranking within each category rather than across the entire sheet.`,
    ],
    sayIt: `"Marketing and Cloud Infrastructure each have one clear owner, while T&E's largest department is only 13.6% of the category. I would route the first two directly and treat T&E as a cross-functional policy review."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm36',
    part: 9,
    title: 'Package the vendor review',
    from: 'priya',
    ask: `Close the loop for my staff meeting. Put the decision frame in one row: total trailing-twelve-month vendor spend, the largest canonical supplier's share, the share of historical spend booked to records labeled Due on receipt, and the category with the largest Q2 dollar increase. Build each metric at its correct grain before combining them.`,
    deliverable: `Exactly one row: ttm_spend_usd, top_vendor_pct, due_on_receipt_pct, largest_q2_increase_category, and largest_q2_increase_usd. Round dollars to 2 decimals and shares to 1.`,
    tables: ['fct_gl_transactions', 'dim_vendor'],
    canonical: `WITH cleaned AS (SELECT CASE WHEN lower(v.vendor_name) IN ('aws', 'amazon web services', 'amazon web services, inc.') THEN 'Amazon Web Services' WHEN lower(v.vendor_name) IN ('google cloud', 'google llc') THEN 'Google Cloud' WHEN lower(v.vendor_name) IN ('linkedin', 'linkedin corp') THEN 'LinkedIn' ELSE v.vendor_name END AS canonical_vendor, v.category, v.payment_terms, g.amount, g.txn_date FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id), ttm_vendors AS (SELECT canonical_vendor, sum(amount) AS spend_usd FROM cleaned WHERE txn_date >= DATE '2025-07-01' AND txn_date < DATE '2026-07-01' GROUP BY canonical_vendor), ttm AS (SELECT sum(spend_usd) AS total_spend, max(spend_usd) AS top_vendor_spend FROM ttm_vendors), terms AS (SELECT sum(CASE WHEN payment_terms = 'Due on receipt' THEN amount ELSE 0 END) AS due_on_receipt_spend, sum(amount) AS total_spend FROM cleaned WHERE txn_date >= DATE '2025-07-01' AND txn_date < DATE '2026-07-01'), quarters AS (SELECT category, sum(CASE WHEN txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-04-01' THEN amount ELSE 0 END) AS q1_spend, sum(CASE WHEN txn_date >= DATE '2026-04-01' AND txn_date < DATE '2026-07-01' THEN amount ELSE 0 END) AS q2_spend FROM cleaned WHERE txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY category), swing AS (SELECT category, q2_spend - q1_spend AS change_usd FROM quarters ORDER BY change_usd DESC LIMIT 1) SELECT round(t.total_spend, 2) AS ttm_spend_usd, round(100.0 * t.top_vendor_spend / t.total_spend, 1) AS top_vendor_pct, round(100.0 * x.due_on_receipt_spend / x.total_spend, 1) AS due_on_receipt_pct, s.category AS largest_q2_increase_category, round(s.change_usd, 2) AS largest_q2_increase_usd FROM ttm t CROSS JOIN terms x CROSS JOIN swing s`,
    ordered: false,
    fingerprintSQL: `WITH cleaned AS (SELECT v.vendor_name AS canonical_vendor, v.category, v.payment_terms, g.amount, g.txn_date FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id), ttm_vendors AS (SELECT canonical_vendor, sum(amount) AS spend_usd FROM cleaned WHERE txn_date >= DATE '2025-07-01' AND txn_date < DATE '2026-07-01' GROUP BY canonical_vendor), ttm AS (SELECT sum(spend_usd) AS total_spend, max(spend_usd) AS top_vendor_spend FROM ttm_vendors), terms AS (SELECT sum(CASE WHEN payment_terms = 'Due on receipt' THEN amount ELSE 0 END) AS due_on_receipt_spend, sum(amount) AS total_spend FROM cleaned WHERE txn_date >= DATE '2025-07-01' AND txn_date < DATE '2026-07-01'), quarters AS (SELECT category, sum(CASE WHEN txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-04-01' THEN amount ELSE 0 END) AS q1_spend, sum(CASE WHEN txn_date >= DATE '2026-04-01' AND txn_date < DATE '2026-07-01' THEN amount ELSE 0 END) AS q2_spend FROM cleaned WHERE txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY category), swing AS (SELECT category, q2_spend - q1_spend AS change_usd FROM quarters ORDER BY change_usd DESC LIMIT 1) SELECT round(t.total_spend, 2) AS ttm_spend_usd, round(100.0 * t.top_vendor_spend / t.total_spend, 1) AS top_vendor_pct, round(100.0 * x.due_on_receipt_spend / x.total_spend, 1) AS due_on_receipt_pct, s.category AS largest_q2_increase_category, round(s.change_usd, 2) AS largest_q2_increase_usd FROM ttm t CROSS JOIN terms x CROSS JOIN swing s`,
    fingerprintMessage: `Four metrics tie, but top-vendor share is understated because the supplier ranking split known aliases. Normalize vendor identity before the TTM supplier GROUP BY; the terms and category metrics stay at their own grains.`,
    hints: [
      `Use one cleaned line-level CTE, then branch into three independent summaries: TTM spend by canonical supplier, TTM payment-term totals, and Q1/Q2 category totals. Reduce each branch to one row before CROSS JOIN.`,
      `WITH cleaned AS (... canonical_vendor, category, payment_terms, amount, txn_date ...), ttm_vendors AS (... one row per supplier ...), ttm AS (... one row ...), terms AS (... one row ...), quarters AS (... one row per category ...), swing AS (... largest increase LIMIT 1 ...) SELECT ... FROM ttm CROSS JOIN terms CROSS JOIN swing;`,
      `WITH cleaned AS (SELECT CASE WHEN lower(v.vendor_name) IN ('aws', 'amazon web services', 'amazon web services, inc.') THEN 'Amazon Web Services' WHEN lower(v.vendor_name) IN ('google cloud', 'google llc') THEN 'Google Cloud' WHEN lower(v.vendor_name) IN ('linkedin', 'linkedin corp') THEN 'LinkedIn' ELSE v.vendor_name END AS canonical_vendor, v.category, v.payment_terms, g.amount, g.txn_date FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id), ttm_vendors AS (SELECT canonical_vendor, sum(amount) AS spend_usd FROM cleaned WHERE txn_date >= DATE '2025-07-01' AND txn_date < DATE '2026-07-01' GROUP BY canonical_vendor), ttm AS (SELECT sum(spend_usd) AS total_spend, max(spend_usd) AS top_vendor_spend FROM ttm_vendors), terms AS (SELECT sum(CASE WHEN payment_terms = 'Due on receipt' THEN amount ELSE 0 END) AS due_on_receipt_spend, sum(amount) AS total_spend FROM cleaned WHERE txn_date >= DATE '2025-07-01' AND txn_date < DATE '2026-07-01'), quarters AS (SELECT category, sum(CASE WHEN txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-04-01' THEN amount ELSE 0 END) AS q1_spend, sum(CASE WHEN txn_date >= DATE '2026-04-01' AND txn_date < DATE '2026-07-01' THEN amount ELSE 0 END) AS q2_spend FROM cleaned WHERE txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY category), swing AS (SELECT category, q2_spend - q1_spend AS change_usd FROM quarters ORDER BY change_usd DESC LIMIT 1) SELECT round(t.total_spend, 2) AS ttm_spend_usd, round(100.0 * t.top_vendor_spend / t.total_spend, 1) AS top_vendor_pct, round(100.0 * x.due_on_receipt_spend / x.total_spend, 1) AS due_on_receipt_pct, s.category AS largest_q2_increase_category, round(s.change_usd, 2) AS largest_q2_increase_usd FROM ttm t CROSS JOIN terms x CROSS JOIN swing s;\n\nAggregate each business question first. CROSS JOIN only the one-row outputs so no source grain can multiply another.`,
    ],
    sayIt: `"The TTM vendor book is $150.6 million; the top canonical supplier is 7.5%, records labeled Due on receipt carry 18.0% of historical spend, and Marketing Programs is the largest Q2 increase at $1.24 million. I would validate the term master and review Marketing rather than overstate either metric as current cash due."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm37',
    part: 10,
    title: 'Build the Q2 P&L',
    from: 'elena',
    ask: `Operating review starts with one controlled P&L. Build Q2 2026 revenue, COGS, gross profit and margin, Opex, operating result, and operating margin from account classifications. Star67 stores P&L-natural positive revenue and expense values, so make the sign logic explicit rather than trusting a chart label.`,
    deliverable: `Exactly one row: revenue_usd, cogs_usd, gross_profit_usd, gross_margin_pct, opex_usd, operating_result_usd, and operating_margin_pct. Round dollars to 2 decimals and percentages to 1.`,
    tables: ['fct_gl_transactions', 'dim_account'],
    canonical: `WITH totals AS (SELECT sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END) AS revenue, sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END) AS cogs, sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END) AS opex FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE g.txn_date >= DATE '2026-04-01' AND g.txn_date < DATE '2026-07-01') SELECT round(revenue, 2) AS revenue_usd, round(cogs, 2) AS cogs_usd, round(revenue - cogs, 2) AS gross_profit_usd, round(100.0 * (revenue - cogs) / revenue, 1) AS gross_margin_pct, round(opex, 2) AS opex_usd, round(revenue - cogs - opex, 2) AS operating_result_usd, round(100.0 * (revenue - cogs - opex) / revenue, 1) AS operating_margin_pct FROM totals`,
    ordered: false,
    fingerprintSQL: `WITH totals AS (SELECT sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END) AS revenue, sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END) AS cogs, sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END) AS opex FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE g.txn_date >= DATE '2026-04-01' AND g.txn_date < DATE '2026-07-01') SELECT round(revenue, 2) AS revenue_usd, round(cogs, 2) AS cogs_usd, round(revenue - cogs, 2) AS gross_profit_usd, round(100.0 * (revenue - cogs) / revenue, 1) AS gross_margin_pct, round(opex, 2) AS opex_usd, round(revenue - cogs + opex, 2) AS operating_result_usd, round(100.0 * (revenue - cogs + opex) / revenue, 1) AS operating_margin_pct FROM totals`,
    fingerprintMessage: `Gross profit is right, but adding Opex turns spending into profit. Star67 stores COGS and Opex as positive expense totals, so operating result is revenue minus COGS minus Opex.`,
    hints: [
      `Aggregate the three account types into one totals row with conditional SUMs. Revenue, COGS, and Opex are all stored as positive P&L-natural values; subtract both expense pools from revenue.`,
      `WITH totals AS (SELECT sum(CASE WHEN account_type = 'Revenue' THEN amount ELSE 0 END) revenue, ... cogs, ... opex FROM GL JOIN account WHERE Q2) SELECT revenue, cogs, revenue - cogs, 100.0 * (revenue - cogs) / revenue, opex, revenue - cogs - opex, 100.0 * (revenue - cogs - opex) / revenue FROM totals;`,
      `WITH totals AS (SELECT sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END) AS revenue, sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END) AS cogs, sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END) AS opex FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE g.txn_date >= DATE '2026-04-01' AND g.txn_date < DATE '2026-07-01') SELECT round(revenue, 2) AS revenue_usd, round(cogs, 2) AS cogs_usd, round(revenue - cogs, 2) AS gross_profit_usd, round(100.0 * (revenue - cogs) / revenue, 1) AS gross_margin_pct, round(opex, 2) AS opex_usd, round(revenue - cogs - opex, 2) AS operating_result_usd, round(100.0 * (revenue - cogs - opex) / revenue, 1) AS operating_margin_pct FROM totals;\n\nA negative operating margin is the exact result of this fixture, not a sign error to hide.`,
    ],
    sayIt: `"Q2 revenue is $21.9 million at 65.9% gross margin, but $68.2 million of Opex drives a $53.7 million operating loss and -245.0% margin. The review needs to explain the investment load, not massage the sign."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm38',
    part: 10,
    title: 'Show where Star67 is investing',
    from: 'priya',
    ask: `The operating loss is a headline, not an explanation. Break Q2 Opex out by division and show each division's spend as a percentage of Q2 revenue. Keep the revenue denominator separate from the Opex pool—functional cost ratios can exceed 100% when a company is investing ahead of revenue.`,
    deliverable: `One row per division: division, opex_usd, and opex_pct_of_revenue. Round dollars to 2 decimals and percent to 1; order largest Opex first.`,
    tables: ['fct_gl_transactions', 'dim_account', 'dim_department'],
    canonical: `WITH revenue AS (SELECT sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-04-01' AND g.txn_date < DATE '2026-07-01'), spend AS (SELECT d.division, sum(g.amount) AS opex FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id JOIN dim_department d ON g.dept_id = d.dept_id WHERE a.account_type = 'Opex' AND g.txn_date >= DATE '2026-04-01' AND g.txn_date < DATE '2026-07-01' GROUP BY d.division) SELECT s.division, round(s.opex, 2) AS opex_usd, round(100.0 * s.opex / r.revenue, 1) AS opex_pct_of_revenue FROM spend s CROSS JOIN revenue r ORDER BY opex_usd DESC`,
    ordered: true,
    orderedNote: 'largest Opex first',
    fingerprintSQL: `WITH spend AS (SELECT d.division, sum(g.amount) AS opex FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id JOIN dim_department d ON g.dept_id = d.dept_id WHERE a.account_type = 'Opex' AND g.txn_date >= DATE '2026-04-01' AND g.txn_date < DATE '2026-07-01' GROUP BY d.division) SELECT division, round(opex, 2) AS opex_usd, round(100.0 * opex / sum(opex) OVER (), 1) AS opex_pct_of_revenue FROM spend ORDER BY opex_usd DESC`,
    fingerprintMessage: `Those percentages are shares of the Opex pool, not percentages of revenue. Preserve Q2 revenue as its own one-row denominator, then divide every division's Opex by that same revenue total.`,
    hints: [
      `Build one CTE for Q2 revenue and one for Q2 Opex by division. CROSS JOIN is safe because revenue is exactly one row; it lets every division use the same business denominator.`,
      `WITH revenue AS (... one Q2 revenue row ...), spend AS (... Q2 Opex grouped by division ...) SELECT division, opex, 100.0 * opex / revenue FROM spend CROSS JOIN revenue ORDER BY opex DESC;`,
      `WITH revenue AS (SELECT sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-04-01' AND g.txn_date < DATE '2026-07-01'), spend AS (SELECT d.division, sum(g.amount) AS opex FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id JOIN dim_department d ON g.dept_id = d.dept_id WHERE a.account_type = 'Opex' AND g.txn_date >= DATE '2026-04-01' AND g.txn_date < DATE '2026-07-01' GROUP BY d.division) SELECT s.division, round(s.opex, 2) AS opex_usd, round(100.0 * s.opex / r.revenue, 1) AS opex_pct_of_revenue FROM spend s CROSS JOIN revenue r ORDER BY opex_usd DESC;\n\nPercent of revenue and percent of Opex answer different management questions; label the denominator you actually used.`,
    ],
    sayIt: `"S&M is $34.7 million, or 158.0% of Q2 revenue; R&D is another 80.1%. Those ratios are mathematically possible because Star67's investment base is far ahead of current revenue, and that is the decision context."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm39',
    part: 10,
    title: 'Test operating leverage',
    from: 'priya',
    ask: `The absolute spend is heavy, but direction matters too. Compare Q2 2026 with Q2 2025: revenue growth, Opex growth, and the spread between them. Use the same quarter in both years so seasonality does not masquerade as leverage. Positive spread means revenue grew faster than Opex even if the company is still loss-making.`,
    deliverable: `Exactly one row: yoy_revenue_growth_pct, yoy_opex_growth_pct, and operating_leverage_spread_pp. Round all three to 1 decimal.`,
    tables: ['fct_gl_transactions', 'dim_account'],
    canonical: `WITH periods AS (SELECT CASE WHEN g.txn_date >= DATE '2025-04-01' AND g.txn_date < DATE '2025-07-01' THEN 'Q2 2025' ELSE 'Q2 2026' END AS period, sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END) AS revenue, sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END) AS opex FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE (g.txn_date >= DATE '2025-04-01' AND g.txn_date < DATE '2025-07-01') OR (g.txn_date >= DATE '2026-04-01' AND g.txn_date < DATE '2026-07-01') GROUP BY 1), values AS (SELECT max(CASE WHEN period = 'Q2 2025' THEN revenue END) AS prior_revenue, max(CASE WHEN period = 'Q2 2026' THEN revenue END) AS current_revenue, max(CASE WHEN period = 'Q2 2025' THEN opex END) AS prior_opex, max(CASE WHEN period = 'Q2 2026' THEN opex END) AS current_opex FROM periods) SELECT round(100.0 * (current_revenue - prior_revenue) / prior_revenue, 1) AS yoy_revenue_growth_pct, round(100.0 * (current_opex - prior_opex) / prior_opex, 1) AS yoy_opex_growth_pct, round(100.0 * (current_revenue - prior_revenue) / prior_revenue - 100.0 * (current_opex - prior_opex) / prior_opex, 1) AS operating_leverage_spread_pp FROM values`,
    ordered: false,
    fingerprintSQL: `WITH periods AS (SELECT CASE WHEN g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-04-01' THEN 'Prior' ELSE 'Current' END AS period, sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END) AS revenue, sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END) AS opex FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1), values AS (SELECT max(CASE WHEN period = 'Prior' THEN revenue END) AS prior_revenue, max(CASE WHEN period = 'Current' THEN revenue END) AS current_revenue, max(CASE WHEN period = 'Prior' THEN opex END) AS prior_opex, max(CASE WHEN period = 'Current' THEN opex END) AS current_opex FROM periods) SELECT round(100.0 * (current_revenue - prior_revenue) / prior_revenue, 1) AS yoy_revenue_growth_pct, round(100.0 * (current_opex - prior_opex) / prior_opex, 1) AS yoy_opex_growth_pct, round(100.0 * (current_revenue - prior_revenue) / prior_revenue - 100.0 * (current_opex - prior_opex) / prior_opex, 1) AS operating_leverage_spread_pp FROM values`,
    fingerprintMessage: `The arithmetic works, but you compared Q2 with Q1 while labeling the result year over year. Use Q2 2025 as the prior period so the growth spread compares the same seasonal quarter.`,
    hints: [
      `Filter to two explicit three-month windows: Q2 2025 and Q2 2026. Aggregate Revenue and Opex within each label, pivot those two rows into prior/current columns, then calculate growth and the difference in growth rates.`,
      `WITH periods AS (SELECT CASE WHEN txn_date is in Q2 2025 THEN 'Q2 2025' ELSE 'Q2 2026' END period, conditional revenue SUM, conditional Opex SUM FROM ... WHERE Q2 2025 OR Q2 2026 GROUP BY 1), values AS (SELECT max(CASE WHEN period = ... THEN revenue END) ... FROM periods) SELECT revenue growth, Opex growth, revenue growth - Opex growth FROM values;`,
      `WITH periods AS (SELECT CASE WHEN g.txn_date >= DATE '2025-04-01' AND g.txn_date < DATE '2025-07-01' THEN 'Q2 2025' ELSE 'Q2 2026' END AS period, sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END) AS revenue, sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END) AS opex FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE (g.txn_date >= DATE '2025-04-01' AND g.txn_date < DATE '2025-07-01') OR (g.txn_date >= DATE '2026-04-01' AND g.txn_date < DATE '2026-07-01') GROUP BY 1), values AS (SELECT max(CASE WHEN period = 'Q2 2025' THEN revenue END) AS prior_revenue, max(CASE WHEN period = 'Q2 2026' THEN revenue END) AS current_revenue, max(CASE WHEN period = 'Q2 2025' THEN opex END) AS prior_opex, max(CASE WHEN period = 'Q2 2026' THEN opex END) AS current_opex FROM periods) SELECT round(100.0 * (current_revenue - prior_revenue) / prior_revenue, 1) AS yoy_revenue_growth_pct, round(100.0 * (current_opex - prior_opex) / prior_opex, 1) AS yoy_opex_growth_pct, round(100.0 * (current_revenue - prior_revenue) / prior_revenue - 100.0 * (current_opex - prior_opex) / prior_opex, 1) AS operating_leverage_spread_pp FROM values;\n\nThe spread is a rate difference in percentage points, not a dollar variance.`,
    ],
    sayIt: `"Q2 revenue grew 40.2% year over year while Opex grew 33.9%, a positive 6.3-point leverage spread. That is directional improvement, not profitability—the operating margin remains deeply negative."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm40',
    part: 10,
    title: 'Put growth on a quarter-end-month paid-head denominator',
    from: 'elena',
    ask: `Now test whether scale is improving against the paid workforce. For each of the last eight quarters, show total quarterly revenue, quarter-end ARR, quarter-end-month paid heads, quarterly revenue per paid head, and ARR per paid head. Payroll is employee-month grain, so use only the quarter-end month's paid population. Do not relabel it as an exact last-day active roster.`,
    deliverable: `Eight chronological rows: quarter_start, revenue_usd, ending_arr_usd, paid_heads, quarterly_revenue_per_head, and arr_per_head. Round dollars to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_account', 'fct_subscription_snapshot_monthly', 'fct_payroll_monthly'],
    canonical: `WITH revenue AS (SELECT date_trunc('quarter', g.txn_date)::DATE AS quarter_start, sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2024-07-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1), arr AS (SELECT date_trunc('quarter', month_start)::DATE AS quarter_start, sum(arr_usd) AS ending_arr FROM fct_subscription_snapshot_monthly WHERE month_start >= DATE '2024-07-01' AND month_start < DATE '2026-07-01' AND month(month_start) IN (3, 6, 9, 12) GROUP BY 1), heads AS (SELECT date_trunc('quarter', payroll_month)::DATE AS quarter_start, count(*)::BIGINT AS paid_heads FROM fct_payroll_monthly WHERE payroll_month >= DATE '2024-07-01' AND payroll_month < DATE '2026-07-01' AND month(payroll_month) IN (3, 6, 9, 12) GROUP BY 1) SELECT r.quarter_start, round(r.revenue, 2) AS revenue_usd, round(a.ending_arr, 2) AS ending_arr_usd, h.paid_heads, round(r.revenue / h.paid_heads, 2) AS quarterly_revenue_per_head, round(a.ending_arr / h.paid_heads, 2) AS arr_per_head FROM revenue r JOIN arr a ON r.quarter_start = a.quarter_start JOIN heads h ON r.quarter_start = h.quarter_start ORDER BY r.quarter_start`,
    ordered: true,
    orderedNote: 'oldest quarter first',
    fingerprintSQL: `WITH revenue AS (SELECT date_trunc('quarter', g.txn_date)::DATE AS quarter_start, sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2024-07-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1), arr AS (SELECT date_trunc('quarter', month_start)::DATE AS quarter_start, sum(arr_usd) AS ending_arr FROM fct_subscription_snapshot_monthly WHERE month_start >= DATE '2024-07-01' AND month_start < DATE '2026-07-01' AND month(month_start) IN (3, 6, 9, 12) GROUP BY 1), heads AS (SELECT date_trunc('quarter', payroll_month)::DATE AS quarter_start, count(*)::BIGINT AS paid_heads FROM fct_payroll_monthly WHERE payroll_month >= DATE '2024-07-01' AND payroll_month < DATE '2026-07-01' GROUP BY 1) SELECT r.quarter_start, round(r.revenue, 2) AS revenue_usd, round(a.ending_arr, 2) AS ending_arr_usd, h.paid_heads, round(r.revenue / h.paid_heads, 2) AS quarterly_revenue_per_head, round(a.ending_arr / h.paid_heads, 2) AS arr_per_head FROM revenue r JOIN arr a ON r.quarter_start = a.quarter_start JOIN heads h ON r.quarter_start = h.quarter_start ORDER BY r.quarter_start`,
    fingerprintMessage: `You counted all three employee-month payroll rows in each quarter, roughly tripling the headcount and shrinking productivity. Keep only March, June, September, and December payroll rows for the quarter-end paid-head snapshot.`,
    hints: [
      `Each source has a different grain. Revenue sums all GL lines in a quarter. ARR is a quarter-end snapshot; payroll contributes the quarter-end month's paid population. Retain only March, June, September, and December payroll rows before joining the three quarterly outputs.`,
      `WITH revenue AS (... quarter SUM ...), arr AS (... quarter-end months only, SUM arr ...), heads AS (... quarter-end months only, COUNT payroll rows ...) SELECT ..., revenue / paid_heads, ending_arr / paid_heads FROM revenue JOIN arr USING (quarter_start) JOIN heads USING (quarter_start) ORDER BY quarter_start;`,
      `WITH revenue AS (SELECT date_trunc('quarter', g.txn_date)::DATE AS quarter_start, sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2024-07-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1), arr AS (SELECT date_trunc('quarter', month_start)::DATE AS quarter_start, sum(arr_usd) AS ending_arr FROM fct_subscription_snapshot_monthly WHERE month_start >= DATE '2024-07-01' AND month_start < DATE '2026-07-01' AND month(month_start) IN (3, 6, 9, 12) GROUP BY 1), heads AS (SELECT date_trunc('quarter', payroll_month)::DATE AS quarter_start, count(*)::BIGINT AS paid_heads FROM fct_payroll_monthly WHERE payroll_month >= DATE '2024-07-01' AND payroll_month < DATE '2026-07-01' AND month(payroll_month) IN (3, 6, 9, 12) GROUP BY 1) SELECT r.quarter_start, round(r.revenue, 2) AS revenue_usd, round(a.ending_arr, 2) AS ending_arr_usd, h.paid_heads, round(r.revenue / h.paid_heads, 2) AS quarterly_revenue_per_head, round(a.ending_arr / h.paid_heads, 2) AS arr_per_head FROM revenue r JOIN arr a ON r.quarter_start = a.quarter_start JOIN heads h ON r.quarter_start = h.quarter_start ORDER BY r.quarter_start;\n\nRevenue is a quarterly flow, ARR is a quarter-end snapshot, and paid heads are the quarter-end month's employee-month population.`,
    ],
    sayIt: `"Quarterly revenue per quarter-end-month paid head rose from $22.7 thousand to $32.4 thousand across the eight quarters, while ARR per paid head reached $110.1 thousand. The denominator is one payroll month, not three employee-months or an exact last-day roster."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm41',
    part: 10,
    title: 'Measure lagged GTM efficiency',
    from: 'priya',
    ask: `For the last six quarters, compare each quarter's net-new ARR with the prior quarter's S&M Opex. Call this exactly what it is: a planning efficiency ratio, not the standardized SaaS Magic Number. The spend precedes the output in this definition, so use an ordered LAG rather than dividing by same-quarter cost.`,
    deliverable: `Six chronological rows from Q1 2025 through Q2 2026: quarter_start, net_new_arr_usd, prior_q_sm_opex_usd, and net_new_arr_per_prior_q_sm_dollar. Round dollars to 2 decimals and the ratio to 2.`,
    tables: ['fct_arr_movements', 'fct_gl_transactions', 'dim_account', 'dim_department'],
    canonical: `WITH arr AS (SELECT date_trunc('quarter', event_date)::DATE AS quarter_start, sum(arr_delta_usd) AS net_new_arr FROM fct_arr_movements WHERE event_date >= DATE '2024-10-01' AND event_date < DATE '2026-07-01' GROUP BY 1), sm AS (SELECT date_trunc('quarter', g.txn_date)::DATE AS quarter_start, sum(g.amount) AS sm_opex FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id JOIN dim_department d ON g.dept_id = d.dept_id WHERE a.account_type = 'Opex' AND d.division = 'S&M' AND g.txn_date >= DATE '2024-10-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1), lagged AS (SELECT a.quarter_start, a.net_new_arr, lag(s.sm_opex) OVER (ORDER BY a.quarter_start) AS prior_q_sm_opex FROM arr a JOIN sm s ON a.quarter_start = s.quarter_start) SELECT quarter_start, round(net_new_arr, 2) AS net_new_arr_usd, round(prior_q_sm_opex, 2) AS prior_q_sm_opex_usd, round(net_new_arr / prior_q_sm_opex, 2) AS net_new_arr_per_prior_q_sm_dollar FROM lagged WHERE quarter_start >= DATE '2025-01-01' ORDER BY quarter_start`,
    ordered: true,
    orderedNote: 'oldest quarter first',
    requireRegex: ORDERED_WINDOW_REQUIREMENT,
    requireMessage: `The result needs an ordered window because the planning definition uses the prior quarter's S&M spend. Use LAG(... ) OVER (ORDER BY quarter_start), not a same-quarter denominator.`,
    fingerprintSQL: `WITH arr AS (SELECT date_trunc('quarter', event_date)::DATE AS quarter_start, sum(arr_delta_usd) AS net_new_arr FROM fct_arr_movements WHERE event_date >= DATE '2025-01-01' AND event_date < DATE '2026-07-01' GROUP BY 1), sm AS (SELECT date_trunc('quarter', g.txn_date)::DATE AS quarter_start, sum(g.amount) AS sm_opex FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id JOIN dim_department d ON g.dept_id = d.dept_id WHERE a.account_type = 'Opex' AND d.division = 'S&M' AND g.txn_date >= DATE '2025-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1) SELECT a.quarter_start, round(a.net_new_arr, 2) AS net_new_arr_usd, round(s.sm_opex, 2) AS prior_q_sm_opex_usd, round(a.net_new_arr / s.sm_opex, 2) AS net_new_arr_per_prior_q_sm_dollar FROM arr a JOIN sm s ON a.quarter_start = s.quarter_start ORDER BY a.quarter_start`,
    fingerprintMessage: `You divided by same-quarter S&M Opex. This planning definition intentionally lags spend: calculate prior-quarter cost with LAG ordered by quarter, and include Q4 2024 in the input so Q1 2025 has a denominator.`,
    hints: [
      `Aggregate ARR movements and S&M Opex to quarter first. Join those same-quarter rows, use LAG(sm_opex) over chronological quarter order, then filter the displayed output to Q1 2025 onward.`,
      `WITH arr AS (... net-new ARR by quarter from Q4 2024 ...), sm AS (... S&M Opex by quarter from Q4 2024 ...), lagged AS (SELECT quarter_start, net_new_arr, lag(sm_opex) OVER (ORDER BY quarter_start) AS prior_q_sm_opex FROM arr JOIN sm USING (quarter_start)) SELECT ... FROM lagged WHERE quarter_start >= DATE '2025-01-01' ORDER BY quarter_start;`,
      `WITH arr AS (SELECT date_trunc('quarter', event_date)::DATE AS quarter_start, sum(arr_delta_usd) AS net_new_arr FROM fct_arr_movements WHERE event_date >= DATE '2024-10-01' AND event_date < DATE '2026-07-01' GROUP BY 1), sm AS (SELECT date_trunc('quarter', g.txn_date)::DATE AS quarter_start, sum(g.amount) AS sm_opex FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id JOIN dim_department d ON g.dept_id = d.dept_id WHERE a.account_type = 'Opex' AND d.division = 'S&M' AND g.txn_date >= DATE '2024-10-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1), lagged AS (SELECT a.quarter_start, a.net_new_arr, lag(s.sm_opex) OVER (ORDER BY a.quarter_start) AS prior_q_sm_opex FROM arr a JOIN sm s ON a.quarter_start = s.quarter_start) SELECT quarter_start, round(net_new_arr, 2) AS net_new_arr_usd, round(prior_q_sm_opex, 2) AS prior_q_sm_opex_usd, round(net_new_arr / prior_q_sm_opex, 2) AS net_new_arr_per_prior_q_sm_dollar FROM lagged WHERE quarter_start >= DATE '2025-01-01' ORDER BY quarter_start;\n\nThis is a transparent internal planning ratio. Do not relabel it as the standardized SaaS Magic Number.`,
    ],
    sayIt: `"Net-new ARR per prior-quarter S&M dollar declined from 0.23 to 0.17 across the six quarters. That is a lagged planning-efficiency signal, not a standardized Magic Number, and it adds pressure to the S&M investment discussion."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm42',
    part: 10,
    title: 'Package the operating review',
    from: 'priya',
    ask: `Close the operating review in one row: Q2 revenue, year-over-year revenue growth, gross margin, operating margin, quarterly revenue per June paid head, and Q2 net-new ARR per Q1 S&M dollar. Keep each source at its own grain and preserve the exact labels—we are not turning the planning ratio into a standardized benchmark.`,
    deliverable: `Exactly one row: q2_revenue_usd, yoy_revenue_growth_pct, gross_margin_pct, operating_margin_pct, quarterly_revenue_per_paid_head, and net_new_arr_per_prior_q_sm_dollar. Round dollars to 2 decimals, percentages to 1, and the efficiency ratio to 2.`,
    tables: ['fct_gl_transactions', 'dim_account', 'dim_department', 'fct_payroll_monthly', 'fct_arr_movements'],
    canonical: `WITH pnl AS (SELECT sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END) AS revenue, sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END) AS cogs, sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END) AS opex FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE g.txn_date >= DATE '2026-04-01' AND g.txn_date < DATE '2026-07-01'), prior AS (SELECT sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2025-04-01' AND g.txn_date < DATE '2025-07-01'), heads AS (SELECT count(*)::BIGINT AS paid_heads FROM fct_payroll_monthly WHERE payroll_month = DATE '2026-06-01'), net_new AS (SELECT sum(arr_delta_usd) AS net_new_arr FROM fct_arr_movements WHERE event_date >= DATE '2026-04-01' AND event_date < DATE '2026-07-01'), sm AS (SELECT sum(g.amount) AS prior_q_sm_opex FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id JOIN dim_department d ON g.dept_id = d.dept_id WHERE a.account_type = 'Opex' AND d.division = 'S&M' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-04-01') SELECT round(p.revenue, 2) AS q2_revenue_usd, round(100.0 * (p.revenue - prior.revenue) / prior.revenue, 1) AS yoy_revenue_growth_pct, round(100.0 * (p.revenue - p.cogs) / p.revenue, 1) AS gross_margin_pct, round(100.0 * (p.revenue - p.cogs - p.opex) / p.revenue, 1) AS operating_margin_pct, round(p.revenue / h.paid_heads, 2) AS quarterly_revenue_per_paid_head, round(n.net_new_arr / s.prior_q_sm_opex, 2) AS net_new_arr_per_prior_q_sm_dollar FROM pnl p CROSS JOIN prior CROSS JOIN heads h CROSS JOIN net_new n CROSS JOIN sm s`,
    ordered: false,
    fingerprintSQL: `WITH pnl AS (SELECT sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END) AS revenue, sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END) AS cogs, sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END) AS opex FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE g.txn_date >= DATE '2026-04-01' AND g.txn_date < DATE '2026-07-01'), june AS (SELECT sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-06-01' AND g.txn_date < DATE '2026-07-01'), prior AS (SELECT sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2025-04-01' AND g.txn_date < DATE '2025-07-01'), heads AS (SELECT count(*)::BIGINT AS paid_heads FROM fct_payroll_monthly WHERE payroll_month = DATE '2026-06-01'), net_new AS (SELECT sum(arr_delta_usd) AS net_new_arr FROM fct_arr_movements WHERE event_date >= DATE '2026-04-01' AND event_date < DATE '2026-07-01'), sm AS (SELECT sum(g.amount) AS prior_q_sm_opex FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id JOIN dim_department d ON g.dept_id = d.dept_id WHERE a.account_type = 'Opex' AND d.division = 'S&M' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-04-01') SELECT round(p.revenue, 2) AS q2_revenue_usd, round(100.0 * (p.revenue - prior.revenue) / prior.revenue, 1) AS yoy_revenue_growth_pct, round(100.0 * (p.revenue - p.cogs) / p.revenue, 1) AS gross_margin_pct, round(100.0 * (p.revenue - p.cogs - p.opex) / p.revenue, 1) AS operating_margin_pct, round(j.revenue / h.paid_heads, 2) AS quarterly_revenue_per_paid_head, round(n.net_new_arr / s.prior_q_sm_opex, 2) AS net_new_arr_per_prior_q_sm_dollar FROM pnl p CROSS JOIN june j CROSS JOIN prior CROSS JOIN heads h CROSS JOIN net_new n CROSS JOIN sm s`,
    fingerprintMessage: `Five metrics tie, but revenue per head uses June-only revenue under a quarterly label. Keep June payroll as the point-in-time denominator and divide the full Q2 revenue flow by that paid-head count.`,
    hints: [
      `Build five independent one-row CTEs: Q2 P&L, prior-year Q2 revenue, June paid heads, Q2 net-new ARR, and Q1 S&M Opex. CROSS JOIN only those one-row outputs.`,
      `WITH pnl AS (... Q2 revenue/cogs/opex ...), prior AS (... Q2 2025 revenue ...), heads AS (... June payroll count ...), net_new AS (... Q2 ARR movements ...), sm AS (... Q1 S&M Opex ...) SELECT Q2 revenue, YoY growth, margins, pnl.revenue / paid_heads, net_new_arr / prior_q_sm_opex FROM each one-row CTE CROSS JOINed;`,
      `WITH pnl AS (SELECT sum(CASE WHEN a.account_type = 'Revenue' THEN g.amount ELSE 0 END) AS revenue, sum(CASE WHEN a.account_type = 'COGS' THEN g.amount ELSE 0 END) AS cogs, sum(CASE WHEN a.account_type = 'Opex' THEN g.amount ELSE 0 END) AS opex FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE g.txn_date >= DATE '2026-04-01' AND g.txn_date < DATE '2026-07-01'), prior AS (SELECT sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2025-04-01' AND g.txn_date < DATE '2025-07-01'), heads AS (SELECT count(*)::BIGINT AS paid_heads FROM fct_payroll_monthly WHERE payroll_month = DATE '2026-06-01'), net_new AS (SELECT sum(arr_delta_usd) AS net_new_arr FROM fct_arr_movements WHERE event_date >= DATE '2026-04-01' AND event_date < DATE '2026-07-01'), sm AS (SELECT sum(g.amount) AS prior_q_sm_opex FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id JOIN dim_department d ON g.dept_id = d.dept_id WHERE a.account_type = 'Opex' AND d.division = 'S&M' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-04-01') SELECT round(p.revenue, 2) AS q2_revenue_usd, round(100.0 * (p.revenue - prior.revenue) / prior.revenue, 1) AS yoy_revenue_growth_pct, round(100.0 * (p.revenue - p.cogs) / p.revenue, 1) AS gross_margin_pct, round(100.0 * (p.revenue - p.cogs - p.opex) / p.revenue, 1) AS operating_margin_pct, round(p.revenue / h.paid_heads, 2) AS quarterly_revenue_per_paid_head, round(n.net_new_arr / s.prior_q_sm_opex, 2) AS net_new_arr_per_prior_q_sm_dollar FROM pnl p CROSS JOIN prior CROSS JOIN heads h CROSS JOIN net_new n CROSS JOIN sm s;\n\nThe flow numerator covers Q2; the point-in-time paid-head denominator is June. The GTM ratio uses Q2 output over Q1 spend by definition.`,
    ],
    sayIt: `"Q2 revenue grew 40.2% year over year at 65.9% gross margin, but operating margin is -245.0%. Revenue per paid head reached $32.4 thousand while the lagged GTM planning ratio fell to 0.17, so productivity improved even as investment efficiency remains the pressure point."`,
    jdCompanies: ['Figma', 'Datadog'],
  },
  {
    id: 'm43',
    part: 11,
    title: 'Build the retention scoreboard',
    from: 'priya',
    ask: `Customer council starts with a fixed Q2 opening book. For every segment, take the March 2026 customer snapshot as the cohort and test it against June. Show logo retention and gross dollar retention. Gross dollar retention caps each customer's June ARR at their March ARR so expansion cannot hide churn or contraction. Keep churned customers in both denominators.`,
    deliverable: `Three rows: segment, opening_logos, retained_logos, logo_retention_pct, opening_arr_usd, retained_arr_capped_usd, and gross_dollar_retention_pct. Round dollars to 2 decimals and percentages to 1; order by opening ARR descending.`,
    tables: ['fct_subscription_snapshot_monthly', 'dim_customer'],
    canonical: `WITH opening AS (SELECT s.customer_id, s.arr_usd AS opening_arr, c.segment FROM fct_subscription_snapshot_monthly s JOIN dim_customer c ON s.customer_id = c.customer_id WHERE s.month_start = DATE '2026-03-01'), closing AS (SELECT customer_id, arr_usd AS closing_arr FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01') SELECT o.segment, count(*)::BIGINT AS opening_logos, count(c.customer_id)::BIGINT AS retained_logos, round(100.0 * count(c.customer_id) / count(*), 1) AS logo_retention_pct, round(sum(o.opening_arr), 2) AS opening_arr_usd, round(sum(least(o.opening_arr, coalesce(c.closing_arr, 0))), 2) AS retained_arr_capped_usd, round(100.0 * sum(least(o.opening_arr, coalesce(c.closing_arr, 0))) / sum(o.opening_arr), 1) AS gross_dollar_retention_pct FROM opening o LEFT JOIN closing c ON o.customer_id = c.customer_id GROUP BY o.segment ORDER BY opening_arr_usd DESC`,
    ordered: true,
    orderedNote: 'largest opening ARR first',
    fingerprintSQL: `WITH opening AS (SELECT s.customer_id, s.arr_usd AS opening_arr, c.segment FROM fct_subscription_snapshot_monthly s JOIN dim_customer c ON s.customer_id = c.customer_id WHERE s.month_start = DATE '2026-03-01'), closing AS (SELECT customer_id, arr_usd AS closing_arr FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01') SELECT o.segment, count(*)::BIGINT AS opening_logos, count(c.customer_id)::BIGINT AS retained_logos, round(100.0 * count(c.customer_id) / count(*), 1) AS logo_retention_pct, round(sum(o.opening_arr), 2) AS opening_arr_usd, round(sum(least(o.opening_arr, c.closing_arr)), 2) AS retained_arr_capped_usd, round(100.0 * sum(least(o.opening_arr, c.closing_arr)) / sum(o.opening_arr), 1) AS gross_dollar_retention_pct FROM opening o JOIN closing c ON o.customer_id = c.customer_id GROUP BY o.segment ORDER BY opening_arr_usd DESC`,
    fingerprintMessage: `Every churned logo disappeared before aggregation because the closing snapshot was INNER-joined to the opening cohort. Preserve every March customer with a LEFT JOIN, count the June matches for retained logos, and turn missing June ARR into zero before capping it.`,
    hints: [
      `Treat March as a fixed cohort table and June as an optional lookup. LEFT JOIN June onto March so customers with no closing row remain in the opening counts. For GRR, sum LEAST(opening ARR, COALESCE(closing ARR, 0)).`,
      `WITH opening AS (... March customer, ARR, segment ...), closing AS (... June customer, ARR ...) SELECT segment, count(*) opening_logos, count(closing.customer_id) retained_logos, retained/opening %, sum(opening_arr), sum(least(opening_arr, coalesce(closing_arr, 0))), capped/opening % FROM opening LEFT JOIN closing ... GROUP BY segment;`,
      `WITH opening AS (SELECT s.customer_id, s.arr_usd AS opening_arr, c.segment FROM fct_subscription_snapshot_monthly s JOIN dim_customer c ON s.customer_id = c.customer_id WHERE s.month_start = DATE '2026-03-01'), closing AS (SELECT customer_id, arr_usd AS closing_arr FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01') SELECT o.segment, count(*)::BIGINT AS opening_logos, count(c.customer_id)::BIGINT AS retained_logos, round(100.0 * count(c.customer_id) / count(*), 1) AS logo_retention_pct, round(sum(o.opening_arr), 2) AS opening_arr_usd, round(sum(least(o.opening_arr, coalesce(c.closing_arr, 0))), 2) AS retained_arr_capped_usd, round(100.0 * sum(least(o.opening_arr, coalesce(c.closing_arr, 0))) / sum(o.opening_arr), 1) AS gross_dollar_retention_pct FROM opening o LEFT JOIN closing c ON o.customer_id = c.customer_id GROUP BY o.segment ORDER BY opening_arr_usd DESC;

The cap excludes expansion from GRR while the LEFT JOIN keeps churn in the denominator. Segment is current-state because dim_customer is type 1; do not imply historical segment snapshots.`,
    ],
    sayIt: `"Enterprise retained 97.3% of opening logos and 96.4% of opening dollars; SMB retained 88.6% of logos and 90.9% of dollars. This is a Q2 fixed-book gross-retention view using current segment labels, not annual NRR."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm44',
    part: 11,
    title: 'Decompose gross attrition',
    from: 'priya',
    ask: `The scoreboard says how much survived; now show how ARR left. For Q2 2026, separate churn from contraction within each current customer segment, count affected customers, and report lost ARR as a positive dollar value. Keep the signed movement logic explicit.`,
    deliverable: `One row per segment and movement type: segment, movement_type, affected_customers, and arr_lost_usd. Include only churn and contraction; round loss to 2 decimals and order largest loss first, then segment and type.`,
    tables: ['fct_arr_movements', 'dim_customer'],
    canonical: `SELECT c.segment, m.movement_type, count(DISTINCT m.customer_id)::BIGINT AS affected_customers, round(-sum(m.arr_delta_usd), 2) AS arr_lost_usd FROM fct_arr_movements m JOIN dim_customer c ON m.customer_id = c.customer_id WHERE m.event_date >= DATE '2026-04-01' AND m.event_date < DATE '2026-07-01' AND m.movement_type IN ('churn', 'contraction') GROUP BY c.segment, m.movement_type ORDER BY arr_lost_usd DESC, c.segment, m.movement_type`,
    ordered: true,
    orderedNote: 'largest lost ARR first, then segment and type',
    fingerprintSQL: `SELECT c.segment, m.movement_type, count(DISTINCT m.customer_id)::BIGINT AS affected_customers, round(-sum(m.arr_delta_usd), 2) AS arr_lost_usd FROM fct_arr_movements m JOIN dim_customer c ON m.customer_id = c.customer_id WHERE m.event_date >= DATE '2026-04-01' AND m.event_date < DATE '2026-07-01' AND m.movement_type = 'churn' GROUP BY c.segment, m.movement_type ORDER BY arr_lost_usd DESC, c.segment, m.movement_type`,
    fingerprintMessage: `The churn rows are right, but contraction is missing from gross attrition. Filter to both signed downside types—churn and contraction—so partial losses do not vanish from the council.`,
    hints: [
      `The movement table already owns the event taxonomy and signed ARR delta. Filter one half-open quarter and the two downside types, group by segment and type, then negate the negative sum for a positive loss display.`,
      `SELECT segment, movement_type, count(DISTINCT customer_id), -sum(arr_delta_usd) FROM movements JOIN customer WHERE event_date >= Q2 start AND event_date < Q3 start AND movement_type IN ('churn','contraction') GROUP BY segment, movement_type;`,
      `SELECT c.segment, m.movement_type, count(DISTINCT m.customer_id)::BIGINT AS affected_customers, round(-sum(m.arr_delta_usd), 2) AS arr_lost_usd FROM fct_arr_movements m JOIN dim_customer c ON m.customer_id = c.customer_id WHERE m.event_date >= DATE '2026-04-01' AND m.event_date < DATE '2026-07-01' AND m.movement_type IN ('churn', 'contraction') GROUP BY c.segment, m.movement_type ORDER BY arr_lost_usd DESC, c.segment, m.movement_type;

arr_delta_usd is negative for both downside types. Negating the sum changes presentation, not economic meaning.`,
    ],
    sayIt: `"Enterprise churn drove $1.82 million of Q2 loss across eight customers, while Mid-Market contraction added $55.4 thousand. I keep churn and contraction separate because they route to different operating responses."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm45',
    part: 11,
    title: 'Test expansion-movement coverage',
    from: 'priya',
    ask: `Next question: how much Q2 gross attrition did expansion-class movements offset, by current segment? Use movement_type = 'expansion' only in the numerator and churn plus contraction in the denominator. This movement-log control covers every Q2 event, so a customer acquired during Q2 can later contribute an expansion; it is intentionally separate from the fixed March cohort. New business and reactivation stay excluded from the numerator.`,
    deliverable: `Three rows: segment, expansion_movement_arr_usd, gross_attrition_arr_usd, and expansion_movement_coverage_pct. Round dollars to 2 decimals and percentage to 1; order by gross attrition descending.`,
    tables: ['fct_arr_movements', 'dim_customer'],
    canonical: `SELECT c.segment, round(sum(CASE WHEN m.movement_type = 'expansion' THEN m.arr_delta_usd ELSE 0 END), 2) AS expansion_movement_arr_usd, round(-sum(CASE WHEN m.movement_type IN ('churn', 'contraction') THEN m.arr_delta_usd ELSE 0 END), 2) AS gross_attrition_arr_usd, round(100.0 * sum(CASE WHEN m.movement_type = 'expansion' THEN m.arr_delta_usd ELSE 0 END) / nullif(-sum(CASE WHEN m.movement_type IN ('churn', 'contraction') THEN m.arr_delta_usd ELSE 0 END), 0), 1) AS expansion_movement_coverage_pct FROM fct_arr_movements m JOIN dim_customer c ON m.customer_id = c.customer_id WHERE m.event_date >= DATE '2026-04-01' AND m.event_date < DATE '2026-07-01' GROUP BY c.segment ORDER BY gross_attrition_arr_usd DESC`,
    ordered: true,
    orderedNote: 'largest gross attrition first',
    fingerprintSQL: `SELECT c.segment, round(sum(CASE WHEN m.arr_delta_usd > 0 THEN m.arr_delta_usd ELSE 0 END), 2) AS expansion_movement_arr_usd, round(-sum(CASE WHEN m.movement_type IN ('churn', 'contraction') THEN m.arr_delta_usd ELSE 0 END), 2) AS gross_attrition_arr_usd, round(100.0 * sum(CASE WHEN m.arr_delta_usd > 0 THEN m.arr_delta_usd ELSE 0 END) / nullif(-sum(CASE WHEN m.movement_type IN ('churn', 'contraction') THEN m.arr_delta_usd ELSE 0 END), 0), 1) AS expansion_movement_coverage_pct FROM fct_arr_movements m JOIN dim_customer c ON m.customer_id = c.customer_id WHERE m.event_date >= DATE '2026-04-01' AND m.event_date < DATE '2026-07-01' GROUP BY c.segment ORDER BY gross_attrition_arr_usd DESC`,
    fingerprintMessage: `The positive numerator includes new business and reactivation, so it is not expansion coverage. Filter the numerator to movement_type = 'expansion'; acquisition cannot be used to flatter an existing-customer retention control.`,
    hints: [
      `Use conditional SUMs over the same Q2 movement base. Expansion is one positive type. Gross attrition is the negative of churn plus contraction. NULLIF protects a segment with no downside from division by zero.`,
      `SELECT segment, sum(CASE WHEN type='expansion' THEN delta ELSE 0 END), -sum(CASE WHEN type IN ('churn','contraction') THEN delta ELSE 0 END), 100.0 * expansion / nullif(gross_attrition,0) FROM movements JOIN customer WHERE Q2 GROUP BY segment;`,
      `SELECT c.segment, round(sum(CASE WHEN m.movement_type = 'expansion' THEN m.arr_delta_usd ELSE 0 END), 2) AS expansion_movement_arr_usd, round(-sum(CASE WHEN m.movement_type IN ('churn', 'contraction') THEN m.arr_delta_usd ELSE 0 END), 2) AS gross_attrition_arr_usd, round(100.0 * sum(CASE WHEN m.movement_type = 'expansion' THEN m.arr_delta_usd ELSE 0 END) / nullif(-sum(CASE WHEN m.movement_type IN ('churn', 'contraction') THEN m.arr_delta_usd ELSE 0 END), 0), 1) AS expansion_movement_coverage_pct FROM fct_arr_movements m JOIN dim_customer c ON m.customer_id = c.customer_id WHERE m.event_date >= DATE '2026-04-01' AND m.event_date < DATE '2026-07-01' GROUP BY c.segment ORDER BY gross_attrition_arr_usd DESC;

Coverage can exceed 100%, but it is not NRR. Current segment is type-1, and because the control scans all Q2 events it does not arithmetically tie to the fixed March-cohort GRR.`,
    ],
    sayIt: `"Expansion-class movements covered 58.4% of Enterprise Q2 gross attrition, 41.3% in Mid-Market, and 10.6% in SMB. This event-book control excludes new business and reactivation, uses current segment labels, and is separate from the fixed March-cohort GRR."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm46',
    part: 11,
    title: 'Build the downside account queue',
    from: 'elena',
    ask: `Turn the aggregate loss into an operating queue. Rank the fifteen customers with the most Q2 churn or contraction ARR, attach the current segment and the latest CSM assignment known by June 30, and preserve unassigned accounts. This is a realized-downside queue, not a renewal forecast—the warehouse has no contract end dates.`,
    deliverable: `Fifteen rows: customer_id, customer_name, segment, csm_name, downside_types, and arr_lost_usd. Use 'Unassigned' when no CSM row exists; round loss to 2 decimals and order largest loss first, then customer_id.`,
    tables: ['fct_arr_movements', 'dim_customer', 'stg_customer_csm_assignments'],
    canonical: `WITH latest_csm AS (SELECT customer_id, csm_name FROM stg_customer_csm_assignments WHERE assigned_on <= DATE '2026-06-30' QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name) = 1), downside AS (SELECT customer_id, sum(arr_delta_usd) AS downside_delta_usd, string_agg(DISTINCT movement_type, ', ' ORDER BY movement_type) AS downside_types FROM fct_arr_movements WHERE event_date >= DATE '2026-04-01' AND event_date < DATE '2026-07-01' AND movement_type IN ('churn', 'contraction') GROUP BY customer_id) SELECT d.customer_id, c.customer_name, c.segment, coalesce(l.csm_name, 'Unassigned') AS csm_name, d.downside_types, round(-d.downside_delta_usd, 2) AS arr_lost_usd FROM downside d JOIN dim_customer c ON d.customer_id = c.customer_id LEFT JOIN latest_csm l ON d.customer_id = l.customer_id ORDER BY arr_lost_usd DESC, d.customer_id LIMIT 15`,
    ordered: true,
    orderedNote: 'largest realized loss first, then customer id',
    fingerprintSQL: `WITH downside AS (SELECT customer_id, sum(arr_delta_usd) AS downside_delta_usd, string_agg(DISTINCT movement_type, ', ' ORDER BY movement_type) AS downside_types FROM fct_arr_movements WHERE event_date >= DATE '2026-04-01' AND event_date < DATE '2026-07-01' AND movement_type IN ('churn', 'contraction') GROUP BY customer_id) SELECT d.customer_id, c.customer_name, c.segment, coalesce(a.csm_name, 'Unassigned') AS csm_name, d.downside_types, round(-d.downside_delta_usd, 2) AS arr_lost_usd FROM downside d JOIN dim_customer c ON d.customer_id = c.customer_id LEFT JOIN stg_customer_csm_assignments a ON d.customer_id = a.customer_id AND a.assigned_on <= DATE '2026-06-30' ORDER BY arr_lost_usd DESC, d.customer_id, a.assigned_on, csm_name LIMIT 15`,
    fingerprintMessage: `Historical CSM assignments fan the same lost account into multiple queue rows. Reduce assignments to one latest row per customer first with an ordered ROW_NUMBER/QUALIFY, then join the realized downside.`,
    requireRegex: ASSIGNMENT_CUTOFF_REQUIREMENT,
    requireMessage: `The loaded fixture has no post-June assignments, so the rows happen to match without a cutoff—but the ownership question is explicitly as of June 30. Keep an assignment-date predicate at or before June 30 (or before July 1) so the query stays correct when later assignments arrive.`,
    hints: [
      `Build two one-row-per-customer CTEs: latest CSM as of June 30 using QUALIFY ROW_NUMBER within customer, and Q2 downside using signed movements. Join the customer dimension, LEFT JOIN ownership, then rank the aggregated losses.`,
      `WITH latest_csm AS (SELECT customer_id,csm_name FROM assignments WHERE assigned_on<=cutoff QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC,csm_name)=1), downside AS (SELECT customer_id,sum(delta),string_agg(DISTINCT type,', ' ORDER BY type) FROM movements WHERE Q2 AND downside GROUP BY customer_id) SELECT ... FROM downside JOIN customer LEFT JOIN latest_csm ORDER BY loss DESC LIMIT 15;`,
      `WITH latest_csm AS (SELECT customer_id, csm_name FROM stg_customer_csm_assignments WHERE assigned_on <= DATE '2026-06-30' QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name) = 1), downside AS (SELECT customer_id, sum(arr_delta_usd) AS downside_delta_usd, string_agg(DISTINCT movement_type, ', ' ORDER BY movement_type) AS downside_types FROM fct_arr_movements WHERE event_date >= DATE '2026-04-01' AND event_date < DATE '2026-07-01' AND movement_type IN ('churn', 'contraction') GROUP BY customer_id) SELECT d.customer_id, c.customer_name, c.segment, coalesce(l.csm_name, 'Unassigned') AS csm_name, d.downside_types, round(-d.downside_delta_usd, 2) AS arr_lost_usd FROM downside d JOIN dim_customer c ON d.customer_id = c.customer_id LEFT JOIN latest_csm l ON d.customer_id = l.customer_id ORDER BY arr_lost_usd DESC, d.customer_id LIMIT 15;

This queue contains realized Q2 downside. Without renewal dates, pipeline, or health signals, it cannot support a renewal-risk label.`,
    ],
    sayIt: `"The top account lost $431.2 thousand, and the fifteen-row queue carries the latest loaded CSM without duplicating assignment history. I would route follow-up from this realized-loss list, not call it a renewal forecast."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm47',
    part: 11,
    title: 'Measure loss concentration',
    from: 'priya',
    ask: `The account queue is long. Quantify how concentrated Q2 gross attrition is in the five largest lost accounts. Rank customer-level churn plus contraction loss against the full downside book, then report the top-five dollars, total dollars, and share in one row.`,
    deliverable: `Exactly one row: top_5_arr_lost_usd, total_arr_lost_usd, and top_5_loss_concentration_pct. Round dollars to 2 decimals and percentage to 1.`,
    tables: ['fct_arr_movements'],
    canonical: `WITH downside AS (SELECT customer_id, -sum(arr_delta_usd) AS arr_lost_usd FROM fct_arr_movements WHERE event_date >= DATE '2026-04-01' AND event_date < DATE '2026-07-01' AND movement_type IN ('churn', 'contraction') GROUP BY customer_id), ranked AS (SELECT customer_id, arr_lost_usd, row_number() OVER (ORDER BY arr_lost_usd DESC, customer_id) AS loss_rank, sum(arr_lost_usd) OVER () AS total_arr_lost FROM downside) SELECT round(sum(CASE WHEN loss_rank <= 5 THEN arr_lost_usd ELSE 0 END), 2) AS top_5_arr_lost_usd, round(max(total_arr_lost), 2) AS total_arr_lost_usd, round(100.0 * sum(CASE WHEN loss_rank <= 5 THEN arr_lost_usd ELSE 0 END) / max(total_arr_lost), 1) AS top_5_loss_concentration_pct FROM ranked`,
    ordered: false,
    fingerprintSQL: `WITH downside AS (SELECT customer_id, -sum(arr_delta_usd) AS arr_lost_usd FROM fct_arr_movements WHERE event_date >= DATE '2026-04-01' AND event_date < DATE '2026-07-01' AND movement_type IN ('churn', 'contraction') GROUP BY customer_id ORDER BY arr_lost_usd DESC, customer_id LIMIT 5) SELECT round(sum(arr_lost_usd), 2) AS top_5_arr_lost_usd, round(sum(arr_lost_usd), 2) AS total_arr_lost_usd, 100.0 AS top_5_loss_concentration_pct FROM downside`,
    fingerprintMessage: `You filtered to the top five before calculating the denominator, so the concentration must be 100%. Carry the full downside total as a window across every ranked customer, then conditionally sum ranks one through five.`,
    hints: [
      `Aggregate downside to customer first. In the next CTE, rank by lost ARR and put SUM(arr_lost) OVER () on every row before filtering. The final one-row aggregation can conditionally sum ranks 1–5 against MAX(full total).`,
      `WITH downside AS (... one loss row per customer ...), ranked AS (SELECT ..., row_number() OVER (ORDER BY loss DESC,id), sum(loss) OVER () total FROM downside) SELECT sum(CASE WHEN rank<=5 THEN loss ELSE 0 END), max(total), 100.0*top5/max(total) FROM ranked;`,
      `WITH downside AS (SELECT customer_id, -sum(arr_delta_usd) AS arr_lost_usd FROM fct_arr_movements WHERE event_date >= DATE '2026-04-01' AND event_date < DATE '2026-07-01' AND movement_type IN ('churn', 'contraction') GROUP BY customer_id), ranked AS (SELECT customer_id, arr_lost_usd, row_number() OVER (ORDER BY arr_lost_usd DESC, customer_id) AS loss_rank, sum(arr_lost_usd) OVER () AS total_arr_lost FROM downside) SELECT round(sum(CASE WHEN loss_rank <= 5 THEN arr_lost_usd ELSE 0 END), 2) AS top_5_arr_lost_usd, round(max(total_arr_lost), 2) AS total_arr_lost_usd, round(100.0 * sum(CASE WHEN loss_rank <= 5 THEN arr_lost_usd ELSE 0 END) / max(total_arr_lost), 1) AS top_5_loss_concentration_pct FROM ranked;

The full-book denominator must exist before the display subset. Otherwise every top-N concentration query becomes 100%.`,
    ],
    sayIt: `"The five largest lost accounts represent $1.38 million, or 43.0% of Q2 gross attrition. That concentration makes targeted account review material, but more than half of loss still sits outside the top five."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm48',
    part: 11,
    title: 'Assign the CSM exposure',
    from: 'elena',
    ask: `Now put downside on an owner denominator. Show the ten highest-rate latest CSM books among those with at least $1 million of March opening ARR: opening book, Q2 churn plus contraction loss, and gross attrition rate. Use the March book so churned accounts remain in both dollars and ownership; a June-only denominator would erase the very losses we need to route.`,
    deliverable: `Ten rows: csm_name, opening_arr_usd, q2_arr_lost_usd, and gross_attrition_pct for books with at least $1 million opening ARR, ordered highest attrition rate first then CSM. Use 'Unassigned' when needed; round dollars to 2 decimals and percent to 1.`,
    tables: ['fct_subscription_snapshot_monthly', 'fct_arr_movements', 'stg_customer_csm_assignments'],
    canonical: `WITH latest_csm AS (SELECT customer_id, csm_name FROM stg_customer_csm_assignments WHERE assigned_on <= DATE '2026-06-30' QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name) = 1), opening AS (SELECT customer_id, arr_usd AS opening_arr FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-03-01'), downside AS (SELECT customer_id, -sum(arr_delta_usd) AS arr_lost_usd FROM fct_arr_movements WHERE event_date >= DATE '2026-04-01' AND event_date < DATE '2026-07-01' AND movement_type IN ('churn', 'contraction') GROUP BY customer_id), books AS (SELECT coalesce(l.csm_name, 'Unassigned') AS csm_name, sum(o.opening_arr) AS opening_arr, sum(coalesce(d.arr_lost_usd, 0)) AS arr_lost FROM opening o LEFT JOIN latest_csm l ON o.customer_id = l.customer_id LEFT JOIN downside d ON o.customer_id = d.customer_id GROUP BY 1) SELECT csm_name, round(opening_arr, 2) AS opening_arr_usd, round(arr_lost, 2) AS q2_arr_lost_usd, round(100.0 * arr_lost / opening_arr, 1) AS gross_attrition_pct FROM books WHERE opening_arr >= 1000000 ORDER BY gross_attrition_pct DESC, csm_name LIMIT 10`,
    ordered: true,
    orderedNote: 'highest gross attrition rate first, then CSM',
    fingerprintSQL: `WITH latest_csm AS (SELECT customer_id, csm_name FROM stg_customer_csm_assignments WHERE assigned_on <= DATE '2026-06-30' QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name) = 1), closing AS (SELECT customer_id, arr_usd AS opening_arr FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'), downside AS (SELECT customer_id, -sum(arr_delta_usd) AS arr_lost_usd FROM fct_arr_movements WHERE event_date >= DATE '2026-04-01' AND event_date < DATE '2026-07-01' AND movement_type IN ('churn', 'contraction') GROUP BY customer_id), books AS (SELECT coalesce(l.csm_name, 'Unassigned') AS csm_name, sum(c.opening_arr) AS opening_arr, sum(coalesce(d.arr_lost_usd, 0)) AS arr_lost FROM closing c LEFT JOIN latest_csm l ON c.customer_id = l.customer_id LEFT JOIN downside d ON c.customer_id = d.customer_id GROUP BY 1) SELECT csm_name, round(opening_arr, 2) AS opening_arr_usd, round(arr_lost, 2) AS q2_arr_lost_usd, round(100.0 * arr_lost / opening_arr, 1) AS gross_attrition_pct FROM books WHERE opening_arr >= 1000000 ORDER BY gross_attrition_pct DESC, csm_name LIMIT 10`,
    fingerprintMessage: `The denominator uses June's surviving book, so churned customers disappear before their Q2 loss can be assigned. Start from the March opening snapshot and LEFT JOIN loss; that preserves every opening account and its latest loaded owner.`,
    requireRegex: ASSIGNMENT_CUTOFF_REQUIREMENT,
    requireMessage: `The fixture has no post-June assignment rows, so an omitted cutoff can look right today. Preserve the explicit as-of-June-30 assignment predicate (or assigned_on before July 1) so later owner changes cannot rewrite this council.`,
    hints: [
      `Start from one row per March customer. Reduce assignments to the latest row by June 30, aggregate Q2 downside per customer, then LEFT JOIN both onto the opening cohort. Group the preserved opening dollars and loss by owner before applying the $1 million materiality floor.`,
      `WITH latest_csm AS (... QUALIFY latest ...), opening AS (... March customer ARR ...), downside AS (... Q2 loss per customer ...), books AS (SELECT coalesce(owner,'Unassigned'),sum(opening ARR),sum(coalesce(loss,0)) FROM opening LEFT JOIN owner LEFT JOIN downside GROUP BY owner) SELECT ... WHERE opening>=1000000 ORDER BY loss/opening DESC LIMIT 10;`,
      `WITH latest_csm AS (SELECT customer_id, csm_name FROM stg_customer_csm_assignments WHERE assigned_on <= DATE '2026-06-30' QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name) = 1), opening AS (SELECT customer_id, arr_usd AS opening_arr FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-03-01'), downside AS (SELECT customer_id, -sum(arr_delta_usd) AS arr_lost_usd FROM fct_arr_movements WHERE event_date >= DATE '2026-04-01' AND event_date < DATE '2026-07-01' AND movement_type IN ('churn', 'contraction') GROUP BY customer_id), books AS (SELECT coalesce(l.csm_name, 'Unassigned') AS csm_name, sum(o.opening_arr) AS opening_arr, sum(coalesce(d.arr_lost_usd, 0)) AS arr_lost FROM opening o LEFT JOIN latest_csm l ON o.customer_id = l.customer_id LEFT JOIN downside d ON o.customer_id = d.customer_id GROUP BY 1) SELECT csm_name, round(opening_arr, 2) AS opening_arr_usd, round(arr_lost, 2) AS q2_arr_lost_usd, round(100.0 * arr_lost / opening_arr, 1) AS gross_attrition_pct FROM books WHERE opening_arr >= 1000000 ORDER BY gross_attrition_pct DESC, csm_name LIMIT 10;

Ownership is the latest assignment loaded by the cutoff, not proof of who owned the account when each event occurred. This is an operational routing view, not historical attribution.`,
    ],
    sayIt: `"Among material books, Ava Rossi's opening book has the highest realized Q2 attrition rate at 23.2%, followed by Sofia Iyer at 20.9%. This is a ranked top-ten routing view using latest loaded ownership, not event-time attribution or predicted risk."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm49',
    part: 11,
    title: 'Package the retention council',
    from: 'priya',
    ask: `Close the council in one controlled row. Snapshot retention uses the fixed March opening cohort; Q2 movement gross attrition, expansion-movement coverage, and top-five loss concentration use every Q2 event; owner routing uses March opening books, the latest assignment by June 30, and a $1 million materiality floor. These controls share a council, not one arithmetic population, so preserve their labels instead of forcing a false tie.`,
    deliverable: `Exactly one row: opening_arr_usd, logo_retention_pct, gross_dollar_retention_pct, q2_movement_gross_attrition_arr_usd, q2_expansion_movement_coverage_pct, top_5_loss_concentration_pct, highest_realized_attrition_csm, and highest_realized_attrition_csm_pct. Round dollars to 2 decimals and percentages to 1.`,
    tables: ['fct_subscription_snapshot_monthly', 'fct_arr_movements', 'stg_customer_csm_assignments'],
    canonical: `WITH opening AS (SELECT customer_id, arr_usd AS opening_arr FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-03-01'), closing AS (SELECT customer_id, arr_usd AS closing_arr FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'), retention AS (SELECT count(*) AS opening_logos, count(c.customer_id) AS retained_logos, sum(o.opening_arr) AS opening_arr, sum(least(o.opening_arr, coalesce(c.closing_arr, 0))) AS retained_arr_capped FROM opening o LEFT JOIN closing c ON o.customer_id = c.customer_id), downside AS (SELECT customer_id, -sum(arr_delta_usd) AS arr_lost FROM fct_arr_movements WHERE event_date >= DATE '2026-04-01' AND event_date < DATE '2026-07-01' AND movement_type IN ('churn', 'contraction') GROUP BY customer_id), concentration AS (SELECT sum(CASE WHEN loss_rank <= 5 THEN arr_lost ELSE 0 END) AS top_5_loss, sum(arr_lost) AS total_loss FROM (SELECT customer_id, arr_lost, row_number() OVER (ORDER BY arr_lost DESC, customer_id) AS loss_rank FROM downside)), expansion AS (SELECT sum(CASE WHEN movement_type = 'expansion' THEN arr_delta_usd ELSE 0 END) AS expansion_arr FROM fct_arr_movements WHERE event_date >= DATE '2026-04-01' AND event_date < DATE '2026-07-01'), latest_csm AS (SELECT customer_id, csm_name FROM stg_customer_csm_assignments WHERE assigned_on <= DATE '2026-06-30' QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name) = 1), books AS (SELECT coalesce(l.csm_name, 'Unassigned') AS csm_name, sum(o.opening_arr) AS opening_arr, sum(coalesce(d.arr_lost, 0)) AS arr_lost FROM opening o LEFT JOIN latest_csm l ON o.customer_id = l.customer_id LEFT JOIN downside d ON o.customer_id = d.customer_id GROUP BY 1), top_book AS (SELECT csm_name, 100.0 * arr_lost / opening_arr AS attrition_pct FROM books WHERE opening_arr >= 1000000 ORDER BY attrition_pct DESC, csm_name LIMIT 1) SELECT round(r.opening_arr, 2) AS opening_arr_usd, round(100.0 * r.retained_logos / r.opening_logos, 1) AS logo_retention_pct, round(100.0 * r.retained_arr_capped / r.opening_arr, 1) AS gross_dollar_retention_pct, round(c.total_loss, 2) AS q2_movement_gross_attrition_arr_usd, round(100.0 * e.expansion_arr / c.total_loss, 1) AS q2_expansion_movement_coverage_pct, round(100.0 * c.top_5_loss / c.total_loss, 1) AS top_5_loss_concentration_pct, b.csm_name AS highest_realized_attrition_csm, round(b.attrition_pct, 1) AS highest_realized_attrition_csm_pct FROM retention r CROSS JOIN concentration c CROSS JOIN expansion e CROSS JOIN top_book b`,
    ordered: false,
    fingerprintSQL: `WITH opening AS (SELECT customer_id, arr_usd AS opening_arr FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-03-01'), closing AS (SELECT customer_id, arr_usd AS closing_arr FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'), retention AS (SELECT count(*) AS opening_logos, count(c.customer_id) AS retained_logos, sum(o.opening_arr) AS opening_arr, sum(least(o.opening_arr, coalesce(c.closing_arr, 0))) AS retained_arr_capped FROM opening o LEFT JOIN closing c ON o.customer_id = c.customer_id), downside AS (SELECT customer_id, -sum(arr_delta_usd) AS arr_lost FROM fct_arr_movements WHERE event_date >= DATE '2026-04-01' AND event_date < DATE '2026-07-01' AND movement_type IN ('churn', 'contraction') GROUP BY customer_id), concentration AS (SELECT sum(CASE WHEN loss_rank <= 5 THEN arr_lost ELSE 0 END) AS top_5_loss, sum(arr_lost) AS total_loss FROM (SELECT customer_id, arr_lost, row_number() OVER (ORDER BY arr_lost DESC, customer_id) AS loss_rank FROM downside)), expansion AS (SELECT sum(CASE WHEN arr_delta_usd > 0 THEN arr_delta_usd ELSE 0 END) AS expansion_arr FROM fct_arr_movements WHERE event_date >= DATE '2026-04-01' AND event_date < DATE '2026-07-01'), latest_csm AS (SELECT customer_id, csm_name FROM stg_customer_csm_assignments WHERE assigned_on <= DATE '2026-06-30' QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name) = 1), books AS (SELECT coalesce(l.csm_name, 'Unassigned') AS csm_name, sum(o.opening_arr) AS opening_arr, sum(coalesce(d.arr_lost, 0)) AS arr_lost FROM opening o LEFT JOIN latest_csm l ON o.customer_id = l.customer_id LEFT JOIN downside d ON o.customer_id = d.customer_id GROUP BY 1), top_book AS (SELECT csm_name, 100.0 * arr_lost / opening_arr AS attrition_pct FROM books WHERE opening_arr >= 1000000 ORDER BY attrition_pct DESC, csm_name LIMIT 1) SELECT round(r.opening_arr, 2) AS opening_arr_usd, round(100.0 * r.retained_logos / r.opening_logos, 1) AS logo_retention_pct, round(100.0 * r.retained_arr_capped / r.opening_arr, 1) AS gross_dollar_retention_pct, round(c.total_loss, 2) AS q2_movement_gross_attrition_arr_usd, round(100.0 * e.expansion_arr / c.total_loss, 1) AS q2_expansion_movement_coverage_pct, round(100.0 * c.top_5_loss / c.total_loss, 1) AS top_5_loss_concentration_pct, b.csm_name AS highest_realized_attrition_csm, round(b.attrition_pct, 1) AS highest_realized_attrition_csm_pct FROM retention r CROSS JOIN concentration c CROSS JOIN expansion e CROSS JOIN top_book b`,
    fingerprintMessage: `The handoff's coverage numerator includes every positive movement, including new business and reactivation. Keep the council definition consistent: expansion coverage uses movement_type = 'expansion' only.`,
    requireRegex: ASSIGNMENT_CUTOFF_REQUIREMENT,
    requireMessage: `The fixture currently has no later owner change, so result equality cannot prove the assignment cutoff. Keep the explicit June 30 as-of predicate (or assigned_on before July 1) in the council query.`,
    hints: [
      `Rebuild four independent controls at their proper grains: fixed-book retention, customer-level downside plus concentration, expansion-only movement dollars, and latest-owner opening books. Reduce each to one row before the final CROSS JOIN.`,
      `WITH opening/closing/retention AS (...), downside/concentration AS (...), expansion AS (... expansion type only ...), latest_csm/books/top_book AS (... March denominator, latest owner, $1m floor ...) SELECT the eight labeled metrics FROM the four one-row outputs CROSS JOINed;`,
      `WITH opening AS (SELECT customer_id, arr_usd AS opening_arr FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-03-01'), closing AS (SELECT customer_id, arr_usd AS closing_arr FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'), retention AS (SELECT count(*) AS opening_logos, count(c.customer_id) AS retained_logos, sum(o.opening_arr) AS opening_arr, sum(least(o.opening_arr, coalesce(c.closing_arr, 0))) AS retained_arr_capped FROM opening o LEFT JOIN closing c ON o.customer_id = c.customer_id), downside AS (SELECT customer_id, -sum(arr_delta_usd) AS arr_lost FROM fct_arr_movements WHERE event_date >= DATE '2026-04-01' AND event_date < DATE '2026-07-01' AND movement_type IN ('churn', 'contraction') GROUP BY customer_id), concentration AS (SELECT sum(CASE WHEN loss_rank <= 5 THEN arr_lost ELSE 0 END) AS top_5_loss, sum(arr_lost) AS total_loss FROM (SELECT customer_id, arr_lost, row_number() OVER (ORDER BY arr_lost DESC, customer_id) AS loss_rank FROM downside)), expansion AS (SELECT sum(CASE WHEN movement_type = 'expansion' THEN arr_delta_usd ELSE 0 END) AS expansion_arr FROM fct_arr_movements WHERE event_date >= DATE '2026-04-01' AND event_date < DATE '2026-07-01'), latest_csm AS (SELECT customer_id, csm_name FROM stg_customer_csm_assignments WHERE assigned_on <= DATE '2026-06-30' QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name) = 1), books AS (SELECT coalesce(l.csm_name, 'Unassigned') AS csm_name, sum(o.opening_arr) AS opening_arr, sum(coalesce(d.arr_lost, 0)) AS arr_lost FROM opening o LEFT JOIN latest_csm l ON o.customer_id = l.customer_id LEFT JOIN downside d ON o.customer_id = d.customer_id GROUP BY 1), top_book AS (SELECT csm_name, 100.0 * arr_lost / opening_arr AS attrition_pct FROM books WHERE opening_arr >= 1000000 ORDER BY attrition_pct DESC, csm_name LIMIT 1) SELECT round(r.opening_arr, 2) AS opening_arr_usd, round(100.0 * r.retained_logos / r.opening_logos, 1) AS logo_retention_pct, round(100.0 * r.retained_arr_capped / r.opening_arr, 1) AS gross_dollar_retention_pct, round(c.total_loss, 2) AS q2_movement_gross_attrition_arr_usd, round(100.0 * e.expansion_arr / c.total_loss, 1) AS q2_expansion_movement_coverage_pct, round(100.0 * c.top_5_loss / c.total_loss, 1) AS top_5_loss_concentration_pct, b.csm_name AS highest_realized_attrition_csm, round(b.attrition_pct, 1) AS highest_realized_attrition_csm_pct FROM retention r CROSS JOIN concentration c CROSS JOIN expansion e CROSS JOIN top_book b;

The snapshot metrics use a fixed March cohort. The movement metrics cover all Q2 events, so their $3.21 million total does not equal the $3.14 million capped-ARR loss implied by GRR. The owner is latest loaded by June 30, not event-time history, and no field is a renewal forecast.`,
    ],
    sayIt: `"The March opening book was $68.9 million; Q2 logo retention was 89.9% and GRR 95.4%. Across all Q2 movement events, gross attrition was $3.21 million, expansion-class movements covered 43.8%, and the top five losses were 43.0%. Ava Rossi's material opening book had the highest realized attrition rate at 23.2%."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm50',
    part: 12,
    title: 'Reconcile the roster to payroll',
    from: 'elena',
    ask: `People and payroll disagree on June headcount, and both can be right. Reconcile everyone paid in the June employee-month fact with the roster population active at June 30. Show the two totals plus the people present on only one side. June payroll is not a June 30 snapshot: someone who left during the month can still have a June row.`,
    deliverable: `Exactly one row: june_paid_heads, june_30_active_roster, paid_not_active_at_close, and active_not_paid_in_june. Preserve both populations with a FULL OUTER JOIN.`,
    tables: ['fct_payroll_monthly', 'dim_employee'],
    canonical: `WITH paid AS (SELECT employee_id FROM fct_payroll_monthly WHERE payroll_month = DATE '2026-06-01'), active AS (SELECT employee_id FROM dim_employee WHERE hire_date <= DATE '2026-06-30' AND (termination_date IS NULL OR termination_date > DATE '2026-06-30')) SELECT count(p.employee_id)::BIGINT AS june_paid_heads, count(a.employee_id)::BIGINT AS june_30_active_roster, count(*) FILTER (WHERE p.employee_id IS NOT NULL AND a.employee_id IS NULL)::BIGINT AS paid_not_active_at_close, count(*) FILTER (WHERE p.employee_id IS NULL AND a.employee_id IS NOT NULL)::BIGINT AS active_not_paid_in_june FROM paid p FULL OUTER JOIN active a USING (employee_id)`,
    ordered: false,
    fingerprintSQL: `SELECT count(*)::BIGINT AS june_paid_heads, count(*)::BIGINT AS june_30_active_roster, 0::BIGINT AS paid_not_active_at_close, 0::BIGINT AS active_not_paid_in_june FROM fct_payroll_monthly WHERE payroll_month = DATE '2026-06-01'`,
    fingerprintMessage: `You treated June payroll as the June 30 roster. Payroll contains six people who were paid during June but were no longer active at month end. Build the paid and active sets separately, then compare their employee IDs.`,
    requireRegex: String.raw`full\s+(?:outer\s+)?join`,
    requireMessage: `The loaded data has no active employee missing from June payroll, so a one-sided join happens to return the same numbers. Keep a FULL OUTER JOIN so both exception directions remain visible when the sources drift.`,
    hints: [
      `Define one employee-ID set from June payroll and another from the roster as of June 30. FULL OUTER JOIN the sets, then use conditional counts for the two unmatched directions.`,
      `WITH paid AS (... June payroll IDs ...), active AS (... hired by cutoff and not terminated by cutoff ...) SELECT count(p.id), count(a.id), count(*) FILTER (WHERE paid only), count(*) FILTER (WHERE active only) FROM paid FULL OUTER JOIN active USING (employee_id);`,
      `WITH paid AS (SELECT employee_id FROM fct_payroll_monthly WHERE payroll_month = DATE '2026-06-01'), active AS (SELECT employee_id FROM dim_employee WHERE hire_date <= DATE '2026-06-30' AND (termination_date IS NULL OR termination_date > DATE '2026-06-30')) SELECT count(p.employee_id)::BIGINT AS june_paid_heads, count(a.employee_id)::BIGINT AS june_30_active_roster, count(*) FILTER (WHERE p.employee_id IS NOT NULL AND a.employee_id IS NULL)::BIGINT AS paid_not_active_at_close, count(*) FILTER (WHERE p.employee_id IS NULL AND a.employee_id IS NOT NULL)::BIGINT AS active_not_paid_in_june FROM paid p FULL OUTER JOIN active a USING (employee_id);\n\nPaid during a month and active at the end of that month are different grains. The six-row difference is a timing population, not proof of a payroll error.`,
    ],
    sayIt: `"June payroll has 678 people while the June 30 active roster has 672. The six-person gap is entirely paid employees who exited during June; no active June 30 employee is missing from the payroll fact."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm51',
    part: 12,
    title: 'Build the monthly workforce flow',
    from: 'maria',
    ask: `Before we discuss capacity, put the first half of 2026 on one monthly bridge. Count hires, exits, net change, and active roster at each month end. Use lifecycle dates for the ending population rather than calling everyone paid during a month active at its final day.`,
    deliverable: `Six chronological rows from January through June 2026: month_start, hires, exits, net_change, and month_end_active. A termination during the month is excluded from that month's ending roster.`,
    tables: ['dim_date', 'dim_employee'],
    canonical: `WITH months AS (SELECT DISTINCT month_start FROM dim_date WHERE month_start BETWEEN DATE '2026-01-01' AND DATE '2026-06-01') SELECT m.month_start, count(*) FILTER (WHERE e.hire_date >= m.month_start AND e.hire_date < m.month_start + INTERVAL 1 MONTH)::BIGINT AS hires, count(*) FILTER (WHERE e.termination_date >= m.month_start AND e.termination_date < m.month_start + INTERVAL 1 MONTH)::BIGINT AS exits, (count(*) FILTER (WHERE e.hire_date >= m.month_start AND e.hire_date < m.month_start + INTERVAL 1 MONTH) - count(*) FILTER (WHERE e.termination_date >= m.month_start AND e.termination_date < m.month_start + INTERVAL 1 MONTH))::BIGINT AS net_change, count(*) FILTER (WHERE e.hire_date < m.month_start + INTERVAL 1 MONTH AND (e.termination_date IS NULL OR e.termination_date >= m.month_start + INTERVAL 1 MONTH))::BIGINT AS month_end_active FROM months m CROSS JOIN dim_employee e GROUP BY m.month_start ORDER BY m.month_start`,
    ordered: true,
    orderedNote: 'January through June in order',
    fingerprintSQL: `WITH months AS (SELECT DISTINCT month_start FROM dim_date WHERE month_start BETWEEN DATE '2026-01-01' AND DATE '2026-06-01') SELECT m.month_start, count(*) FILTER (WHERE e.hire_date >= m.month_start AND e.hire_date < m.month_start + INTERVAL 1 MONTH)::BIGINT AS hires, count(*) FILTER (WHERE e.termination_date >= m.month_start AND e.termination_date < m.month_start + INTERVAL 1 MONTH)::BIGINT AS exits, (count(*) FILTER (WHERE e.hire_date >= m.month_start AND e.hire_date < m.month_start + INTERVAL 1 MONTH) - count(*) FILTER (WHERE e.termination_date >= m.month_start AND e.termination_date < m.month_start + INTERVAL 1 MONTH))::BIGINT AS net_change, count(*) FILTER (WHERE e.hire_date < m.month_start + INTERVAL 1 MONTH AND (e.termination_date IS NULL OR e.termination_date >= m.month_start))::BIGINT AS month_end_active FROM months m CROSS JOIN dim_employee e GROUP BY m.month_start ORDER BY m.month_start`,
    fingerprintMessage: `The movement counts are right, but month-end active still includes people terminated during that month. Test termination against the start of the next month, not the current month start.`,
    hints: [
      `Build six month starts from dim_date. CROSS JOIN the employee roster, then use FILTERed counts for hires, exits, and the as-of population at the end of each month.`,
      `month_end_active means hire_date < next_month AND (termination_date IS NULL OR termination_date >= next_month). Net change is hires minus exits.`,
      `WITH months AS (SELECT DISTINCT month_start FROM dim_date WHERE month_start BETWEEN DATE '2026-01-01' AND DATE '2026-06-01') SELECT m.month_start, count(*) FILTER (WHERE e.hire_date >= m.month_start AND e.hire_date < m.month_start + INTERVAL 1 MONTH)::BIGINT AS hires, count(*) FILTER (WHERE e.termination_date >= m.month_start AND e.termination_date < m.month_start + INTERVAL 1 MONTH)::BIGINT AS exits, (count(*) FILTER (WHERE e.hire_date >= m.month_start AND e.hire_date < m.month_start + INTERVAL 1 MONTH) - count(*) FILTER (WHERE e.termination_date >= m.month_start AND e.termination_date < m.month_start + INTERVAL 1 MONTH))::BIGINT AS net_change, count(*) FILTER (WHERE e.hire_date < m.month_start + INTERVAL 1 MONTH AND (e.termination_date IS NULL OR e.termination_date >= m.month_start + INTERVAL 1 MONTH))::BIGINT AS month_end_active FROM months m CROSS JOIN dim_employee e GROUP BY m.month_start ORDER BY m.month_start;\n\nThe loaded roster shows no hires in May or June. Report that observation; without requisitions or an approved plan, do not relabel it a hiring freeze.`,
    ],
    sayIt: `"Active roster grew from 657 in January to 683 in April, then fell to 672 by June. The loaded data shows zero May and June hires, but it does not contain a requisition plan, so I would call that a roster observation rather than an approved freeze."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm52',
    part: 12,
    title: 'Measure trailing exits by division',
    from: 'maria',
    ask: `Normalize the last twelve months of exits for the size of each division. Count terminations from July 1, 2025 through June 30, 2026 and divide by average monthly paid heads over the same twelve payroll months. This is a trailing exit rate over all employment types, not a regrettable-attrition score.`,
    deliverable: `Four rows: division, exits, avg_monthly_paid_heads, and trailing_12m_exit_rate_pct. Round average heads and rate to 1 decimal; sort highest exit rate first, then division.`,
    tables: ['dim_employee', 'fct_payroll_monthly', 'dim_department'],
    canonical: `WITH exits AS (SELECT d.division, count(*)::BIGINT AS exits FROM dim_employee e JOIN dim_department d ON e.dept_id = d.dept_id WHERE e.termination_date >= DATE '2025-07-01' AND e.termination_date < DATE '2026-07-01' GROUP BY d.division), paid AS (SELECT d.division, count(*) / 12.0 AS avg_monthly_paid_heads FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id WHERE p.payroll_month >= DATE '2025-07-01' AND p.payroll_month < DATE '2026-07-01' GROUP BY d.division) SELECT p.division, e.exits, round(p.avg_monthly_paid_heads, 1) AS avg_monthly_paid_heads, round(100.0 * e.exits / p.avg_monthly_paid_heads, 1) AS trailing_12m_exit_rate_pct FROM paid p JOIN exits e USING (division) ORDER BY trailing_12m_exit_rate_pct DESC, p.division`,
    ordered: true,
    orderedNote: 'highest trailing exit rate first, then division',
    fingerprintSQL: `WITH exits AS (SELECT d.division, count(*)::BIGINT AS exits FROM dim_employee e JOIN dim_department d ON e.dept_id = d.dept_id WHERE e.termination_date >= DATE '2025-07-01' AND e.termination_date < DATE '2026-07-01' GROUP BY d.division), paid AS (SELECT d.division, count(*) AS avg_monthly_paid_heads FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id WHERE p.payroll_month >= DATE '2025-07-01' AND p.payroll_month < DATE '2026-07-01' GROUP BY d.division) SELECT p.division, e.exits, round(p.avg_monthly_paid_heads, 1) AS avg_monthly_paid_heads, round(100.0 * e.exits / p.avg_monthly_paid_heads, 1) AS trailing_12m_exit_rate_pct FROM paid p JOIN exits e USING (division) ORDER BY trailing_12m_exit_rate_pct DESC, p.division`,
    fingerprintMessage: `Your denominator is twelve months of employee rows, not average monthly heads, so every rate is about one-twelfth of the intended value. Divide the employee-month count by 12 before calculating the exit rate.`,
    hints: [
      `Use one CTE for trailing-twelve-month exits and one for twelve months of payroll rows. Payroll is employee-month grain, so total rows divided by 12 is average monthly paid headcount.`,
      `WITH exits AS (... count terminations by division ...), paid AS (... count payroll rows / 12.0 by division ...) SELECT division, exits, average heads, 100 * exits / average heads ...;`,
      `WITH exits AS (SELECT d.division, count(*)::BIGINT AS exits FROM dim_employee e JOIN dim_department d ON e.dept_id = d.dept_id WHERE e.termination_date >= DATE '2025-07-01' AND e.termination_date < DATE '2026-07-01' GROUP BY d.division), paid AS (SELECT d.division, count(*) / 12.0 AS avg_monthly_paid_heads FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id WHERE p.payroll_month >= DATE '2025-07-01' AND p.payroll_month < DATE '2026-07-01' GROUP BY d.division) SELECT p.division, e.exits, round(p.avg_monthly_paid_heads, 1) AS avg_monthly_paid_heads, round(100.0 * e.exits / p.avg_monthly_paid_heads, 1) AS trailing_12m_exit_rate_pct FROM paid p JOIN exits e USING (division) ORDER BY trailing_12m_exit_rate_pct DESC, p.division;\n\nThe rate covers every loaded termination. The warehouse has no regrettable flag, performance score, or benchmark target.`,
    ],
    sayIt: `"G&A has the highest trailing exit rate at 16.4%, followed by S&M at 15.6% and R&D at 15.5%. These are size-normalized loaded exits across all employment types, not regrettable attrition or a benchmark judgment."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm53',
    part: 12,
    title: 'Show when exits occur',
    from: 'elena',
    ask: `The division rate says where. Now show when in the employee lifecycle the same trailing-twelve-month exits occurred. Measure tenure from hire date to termination date, then place exits into Under 6 months, 6-11 months, 12-23 months, and 24+ months.`,
    deliverable: `Four rows in lifecycle order: tenure_band, exits, and share_of_exits_pct. Round share to 1 decimal.`,
    tables: ['dim_employee'],
    canonical: `SELECT CASE WHEN date_diff('month', hire_date, termination_date) < 6 THEN 'Under 6 months' WHEN date_diff('month', hire_date, termination_date) < 12 THEN '6-11 months' WHEN date_diff('month', hire_date, termination_date) < 24 THEN '12-23 months' ELSE '24+ months' END AS tenure_band, count(*)::BIGINT AS exits, round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS share_of_exits_pct FROM dim_employee WHERE termination_date >= DATE '2025-07-01' AND termination_date < DATE '2026-07-01' GROUP BY 1 ORDER BY CASE tenure_band WHEN 'Under 6 months' THEN 1 WHEN '6-11 months' THEN 2 WHEN '12-23 months' THEN 3 ELSE 4 END`,
    ordered: true,
    orderedNote: 'shortest tenure band through longest',
    fingerprintSQL: `SELECT CASE WHEN date_diff('month', hire_date, DATE '2026-06-30') < 6 THEN 'Under 6 months' WHEN date_diff('month', hire_date, DATE '2026-06-30') < 12 THEN '6-11 months' WHEN date_diff('month', hire_date, DATE '2026-06-30') < 24 THEN '12-23 months' ELSE '24+ months' END AS tenure_band, count(*)::BIGINT AS exits, round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS share_of_exits_pct FROM dim_employee WHERE termination_date >= DATE '2025-07-01' AND termination_date < DATE '2026-07-01' GROUP BY 1 ORDER BY CASE tenure_band WHEN 'Under 6 months' THEN 1 WHEN '6-11 months' THEN 2 WHEN '12-23 months' THEN 3 ELSE 4 END`,
    fingerprintMessage: `You measured former employees through June 30, adding time after they had already left. Exit tenure ends on termination_date, so use date_diff from hire_date to termination_date.`,
    hints: [
      `Filter the same July-through-June termination population. Use date_diff in months from hire to termination inside a CASE expression, then calculate each band's share with a window over the grouped counts.`,
      `CASE WHEN tenure_months < 6 ... < 12 ... < 24 ... ELSE ... END; share = count(*) / sum(count(*)) OVER ().`,
      `SELECT CASE WHEN date_diff('month', hire_date, termination_date) < 6 THEN 'Under 6 months' WHEN date_diff('month', hire_date, termination_date) < 12 THEN '6-11 months' WHEN date_diff('month', hire_date, termination_date) < 24 THEN '12-23 months' ELSE '24+ months' END AS tenure_band, count(*)::BIGINT AS exits, round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS share_of_exits_pct FROM dim_employee WHERE termination_date >= DATE '2025-07-01' AND termination_date < DATE '2026-07-01' GROUP BY 1 ORDER BY CASE tenure_band WHEN 'Under 6 months' THEN 1 WHEN '6-11 months' THEN 2 WHEN '12-23 months' THEN 3 ELSE 4 END;`,
    ],
    sayIt: `"Of 101 trailing-twelve-month exits, 41 occurred after at least two years and 32 between twelve and twenty-three months. Fifteen exits happened inside six months; this table sizes lifecycle timing but does not explain causes."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm54',
    part: 12,
    title: 'Map contractor dependence',
    from: 'maria',
    ask: `Show which material departments rely most on contractors in June payroll. Keep departments with at least ten paid heads, rank by contractor headcount share, and carry the contractors' loaded monthly cost. Employment type is a roster label; do not infer contract length or conversion plans.`,
    deliverable: `Ten rows: dept_name, paid_heads, contractor_heads, contractor_share_pct, and contractor_monthly_cost_usd. Round percent to 1 and cost to 2; sort highest share first, then department.`,
    tables: ['fct_payroll_monthly', 'dim_employee', 'dim_department'],
    canonical: `SELECT d.dept_name, count(*)::BIGINT AS paid_heads, count(*) FILTER (WHERE e.employment_type = 'Contractor')::BIGINT AS contractor_heads, round(100.0 * count(*) FILTER (WHERE e.employment_type = 'Contractor') / count(*), 1) AS contractor_share_pct, round(sum(p.total_comp_usd) FILTER (WHERE e.employment_type = 'Contractor'), 2) AS contractor_monthly_cost_usd FROM fct_payroll_monthly p JOIN dim_employee e ON p.employee_id = e.employee_id JOIN dim_department d ON p.dept_id = d.dept_id WHERE p.payroll_month = DATE '2026-06-01' GROUP BY d.dept_name HAVING count(*) >= 10 ORDER BY contractor_share_pct DESC, d.dept_name LIMIT 10`,
    ordered: true,
    orderedNote: 'highest contractor share first, then department',
    fingerprintSQL: `SELECT d.dept_name, count(*)::BIGINT AS paid_heads, count(*) FILTER (WHERE e.employment_type = 'Contractor')::BIGINT AS contractor_heads, 100.0 AS contractor_share_pct, round(sum(p.total_comp_usd) FILTER (WHERE e.employment_type = 'Contractor'), 2) AS contractor_monthly_cost_usd FROM fct_payroll_monthly p JOIN dim_employee e ON p.employee_id = e.employee_id JOIN dim_department d ON p.dept_id = d.dept_id WHERE p.payroll_month = DATE '2026-06-01' AND e.employment_type = 'Contractor' GROUP BY d.dept_name HAVING count(*) >= 1 ORDER BY contractor_share_pct DESC, d.dept_name LIMIT 10`,
    fingerprintMessage: `You filtered to contractors before building the department denominator, so every contractor share is 100%. Keep all June paid heads in the grouped population and use a conditional count only for the numerator.`,
    hints: [
      `Start from all June payroll rows, then join employment type and department. Conditional COUNT gives contractor heads without removing FTEs from the denominator.`,
      `GROUP BY department; HAVING count(*) >= 10; contractor share = 100 * count(*) FILTER (WHERE type='Contractor') / count(*).`,
      `SELECT d.dept_name, count(*)::BIGINT AS paid_heads, count(*) FILTER (WHERE e.employment_type = 'Contractor')::BIGINT AS contractor_heads, round(100.0 * count(*) FILTER (WHERE e.employment_type = 'Contractor') / count(*), 1) AS contractor_share_pct, round(sum(p.total_comp_usd) FILTER (WHERE e.employment_type = 'Contractor'), 2) AS contractor_monthly_cost_usd FROM fct_payroll_monthly p JOIN dim_employee e ON p.employee_id = e.employee_id JOIN dim_department d ON p.dept_id = d.dept_id WHERE p.payroll_month = DATE '2026-06-01' GROUP BY d.dept_name HAVING count(*) >= 10 ORDER BY contractor_share_pct DESC, d.dept_name LIMIT 10;`,
    ],
    sayIt: `"Finance has the highest contractor share among departments with at least ten paid heads at 18.8%, followed by Cloud Operations and Solutions Engineering at 11.5%. This is June roster and cost exposure, not a conversion recommendation."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm55',
    part: 12,
    title: 'Put people cost on the location map',
    from: 'elena',
    ask: `Now map June paid heads and loaded people cost by location. Use total_comp_usd so the view includes base, variable pay, benefits, and employer taxes. Keep this as a USD cost mix; the warehouse has no local-currency or purchasing-power fields.`,
    deliverable: `Five rows: location, paid_heads, monthly_people_cost_usd, avg_monthly_cost_per_head, and people_cost_share_pct. Round dollars to 2 and share to 1; sort highest total cost first, then location.`,
    tables: ['fct_payroll_monthly', 'dim_employee'],
    canonical: `WITH by_location AS (SELECT e.location, count(*)::BIGINT AS paid_heads, sum(p.total_comp_usd) AS monthly_people_cost FROM fct_payroll_monthly p JOIN dim_employee e ON p.employee_id = e.employee_id WHERE p.payroll_month = DATE '2026-06-01' GROUP BY e.location) SELECT location, paid_heads, round(monthly_people_cost, 2) AS monthly_people_cost_usd, round(monthly_people_cost / paid_heads, 2) AS avg_monthly_cost_per_head, round(100.0 * monthly_people_cost / sum(monthly_people_cost) OVER (), 1) AS people_cost_share_pct FROM by_location ORDER BY monthly_people_cost_usd DESC, location`,
    ordered: true,
    orderedNote: 'highest monthly people cost first, then location',
    fingerprintSQL: `WITH by_location AS (SELECT e.location, count(*)::BIGINT AS paid_heads, sum(p.base_pay_usd) AS monthly_people_cost FROM fct_payroll_monthly p JOIN dim_employee e ON p.employee_id = e.employee_id WHERE p.payroll_month = DATE '2026-06-01' GROUP BY e.location) SELECT location, paid_heads, round(monthly_people_cost, 2) AS monthly_people_cost_usd, round(monthly_people_cost / paid_heads, 2) AS avg_monthly_cost_per_head, round(100.0 * monthly_people_cost / sum(monthly_people_cost) OVER (), 1) AS people_cost_share_pct FROM by_location ORDER BY monthly_people_cost_usd DESC, location`,
    fingerprintMessage: `You mapped base salary only. The ask is loaded people cost, so use total_comp_usd to include variable pay, benefits, and employer taxes in both dollars and mix.`,
    hints: [
      `Join June payroll to employee location and aggregate paid heads plus total_comp_usd. A window over location totals gives each location's share without a second query.`,
      `WITH by_location AS (SELECT location, count(*) heads, sum(total_comp_usd) cost ... GROUP BY location) SELECT ..., cost / heads, 100 * cost / sum(cost) OVER () ...;`,
      `WITH by_location AS (SELECT e.location, count(*)::BIGINT AS paid_heads, sum(p.total_comp_usd) AS monthly_people_cost FROM fct_payroll_monthly p JOIN dim_employee e ON p.employee_id = e.employee_id WHERE p.payroll_month = DATE '2026-06-01' GROUP BY e.location) SELECT location, paid_heads, round(monthly_people_cost, 2) AS monthly_people_cost_usd, round(monthly_people_cost / paid_heads, 2) AS avg_monthly_cost_per_head, round(100.0 * monthly_people_cost / sum(monthly_people_cost) OVER (), 1) AS people_cost_share_pct FROM by_location ORDER BY monthly_people_cost_usd DESC, location;\n\nAll amounts are loaded USD from the fixture. This is not a local-market pay comparison.`,
    ],
    sayIt: `"New York is 36.0% of June loaded people cost at $3.94 million. Remote US is 25.1%; Sydney has the highest average monthly cost per paid head at $18.1 thousand. Those are USD cost facts, not market-adjusted compensation benchmarks."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm56',
    part: 12,
    title: 'Explain the compensation mix',
    from: 'priya',
    ask: `Break first-half 2026 loaded people cost into base pay, variable pay, and benefits plus employer taxes by division. Variable pay is bonus plus commission only; benefits and taxes stay in their own bucket.`,
    deliverable: `Four rows: division, base_pay_usd, variable_pay_usd, benefits_and_taxes_usd, total_people_cost_usd, and variable_pay_share_pct. Round dollars to 2 and share to 1; sort highest total cost first.`,
    tables: ['fct_payroll_monthly', 'dim_department'],
    canonical: `SELECT d.division, round(sum(p.base_pay_usd), 2) AS base_pay_usd, round(sum(p.bonus_usd + p.commission_usd), 2) AS variable_pay_usd, round(sum(p.benefits_usd + p.employer_taxes_usd), 2) AS benefits_and_taxes_usd, round(sum(p.total_comp_usd), 2) AS total_people_cost_usd, round(100.0 * sum(p.bonus_usd + p.commission_usd) / sum(p.total_comp_usd), 1) AS variable_pay_share_pct FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id WHERE p.payroll_month >= DATE '2026-01-01' AND p.payroll_month < DATE '2026-07-01' GROUP BY d.division ORDER BY total_people_cost_usd DESC`,
    ordered: true,
    orderedNote: 'highest first-half people cost first',
    fingerprintSQL: `SELECT d.division, round(sum(p.base_pay_usd), 2) AS base_pay_usd, round(sum(p.bonus_usd + p.commission_usd), 2) AS variable_pay_usd, round(sum(p.benefits_usd + p.employer_taxes_usd), 2) AS benefits_and_taxes_usd, round(sum(p.total_comp_usd), 2) AS total_people_cost_usd, round(100.0 * sum(p.bonus_usd + p.commission_usd + p.benefits_usd + p.employer_taxes_usd) / sum(p.total_comp_usd), 1) AS variable_pay_share_pct FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id WHERE p.payroll_month >= DATE '2026-01-01' AND p.payroll_month < DATE '2026-07-01' GROUP BY d.division ORDER BY total_people_cost_usd DESC`,
    fingerprintMessage: `The dollar buckets are right, but the variable-pay percentage also includes benefits and employer taxes. Keep the numerator to bonus plus commission only.`,
    hints: [
      `Filter the six payroll months, join division, and use separate SUM expressions for base, bonus plus commission, benefits plus taxes, and total comp.`,
      `variable_pay_share_pct = 100 * sum(bonus_usd + commission_usd) / sum(total_comp_usd).`,
      `SELECT d.division, round(sum(p.base_pay_usd), 2) AS base_pay_usd, round(sum(p.bonus_usd + p.commission_usd), 2) AS variable_pay_usd, round(sum(p.benefits_usd + p.employer_taxes_usd), 2) AS benefits_and_taxes_usd, round(sum(p.total_comp_usd), 2) AS total_people_cost_usd, round(100.0 * sum(p.bonus_usd + p.commission_usd) / sum(p.total_comp_usd), 1) AS variable_pay_share_pct FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id WHERE p.payroll_month >= DATE '2026-01-01' AND p.payroll_month < DATE '2026-07-01' GROUP BY d.division ORDER BY total_people_cost_usd DESC;\n\nThe separately rounded components exceed the employee-level total_comp_usd field by $0.99 across H1. The next control makes that rounding seam visible instead of forcing the buckets to tie artificially.`,
    ],
    sayIt: `"S&M carried $31.9 million of first-half loaded people cost and a 20.4% variable-pay mix, versus 13.2% in R&D. The difference is driven by the loaded bonus and commission fields; it is not a statement about target compensation design."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm57',
    part: 12,
    title: 'Tie payroll to the ledger',
    from: 'elena',
    ask: `Close the people-cost control. Reconcile each first-half payroll fact total to Payroll-source GL accounts 5300, 5310, 6000, 6020, and 6030. The GL aggregates rounded components, so penny-level differences are expected; large gaps are not.`,
    deliverable: `Six chronological rows: payroll_month, payroll_fact_usd, payroll_gl_usd, and difference_usd (GL minus fact). Round all dollars to 2.`,
    tables: ['fct_payroll_monthly', 'fct_gl_transactions'],
    canonical: `WITH payroll AS (SELECT payroll_month, sum(total_comp_usd) AS payroll_cost FROM fct_payroll_monthly WHERE payroll_month >= DATE '2026-01-01' AND payroll_month < DATE '2026-07-01' GROUP BY payroll_month), gl AS (SELECT date_trunc('month', txn_date)::DATE AS payroll_month, sum(amount) AS gl_people_cost FROM fct_gl_transactions WHERE source_system = 'Payroll' AND account_id IN ('5300', '5310', '6000', '6020', '6030') AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY 1) SELECT coalesce(p.payroll_month, gl.payroll_month) AS payroll_month, round(coalesce(p.payroll_cost, 0), 2) AS payroll_fact_usd, round(coalesce(gl.gl_people_cost, 0), 2) AS payroll_gl_usd, round(coalesce(gl.gl_people_cost, 0) - coalesce(p.payroll_cost, 0), 2) AS difference_usd FROM payroll p FULL OUTER JOIN gl USING (payroll_month) ORDER BY payroll_month`,
    ordered: true,
    orderedNote: 'January through June in order',
    fingerprintSQL: `WITH payroll AS (SELECT payroll_month, sum(total_comp_usd) AS payroll_cost FROM fct_payroll_monthly WHERE payroll_month >= DATE '2026-01-01' AND payroll_month < DATE '2026-07-01' GROUP BY payroll_month), gl AS (SELECT date_trunc('month', txn_date)::DATE AS payroll_month, sum(amount) AS gl_people_cost FROM fct_gl_transactions WHERE source_system = 'Payroll' AND account_id IN ('6000', '6020', '6030') AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY 1) SELECT coalesce(p.payroll_month, gl.payroll_month) AS payroll_month, round(coalesce(p.payroll_cost, 0), 2) AS payroll_fact_usd, round(coalesce(gl.gl_people_cost, 0), 2) AS payroll_gl_usd, round(coalesce(gl.gl_people_cost, 0) - coalesce(p.payroll_cost, 0), 2) AS difference_usd FROM payroll p FULL OUTER JOIN gl USING (payroll_month) ORDER BY payroll_month`,
    fingerprintMessage: `The GL side excludes support and cloud-operations compensation, which land in COGS accounts 5300 and 5310 rather than Opex salary account 6000. Include all five payroll accounts before judging the tie.`,
    requireRegex: String.raw`(?=[\s\S]*${PAYROLL_SOURCE_REQUIREMENT})(?=[\s\S]*full\s+(?:outer\s+)?join)`,
    requireMessage: `Keep this control Payroll-source specific and FULL JOIN the monthly fact and GL totals. Equality or singleton IN is valid for source_system; the full join prevents a missing month on either side from disappearing.`,
    hints: [
      `Aggregate total_comp_usd by payroll_month. Separately aggregate Payroll-source GL dollars by transaction month across the five people-cost accounts, then FULL JOIN the months so a missing fact or GL period remains visible.`,
      `Payroll fact uses payroll_month. GL uses date_trunc('month', txn_date), source_system='Payroll', and accounts 5300, 5310, 6000, 6020, 6030. FULL OUTER JOIN by month, coalesce a missing side to zero, and calculate GL minus fact.`,
      `WITH payroll AS (SELECT payroll_month, sum(total_comp_usd) AS payroll_cost FROM fct_payroll_monthly WHERE payroll_month >= DATE '2026-01-01' AND payroll_month < DATE '2026-07-01' GROUP BY payroll_month), gl AS (SELECT date_trunc('month', txn_date)::DATE AS payroll_month, sum(amount) AS gl_people_cost FROM fct_gl_transactions WHERE source_system = 'Payroll' AND account_id IN ('5300', '5310', '6000', '6020', '6030') AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY 1) SELECT coalesce(p.payroll_month, gl.payroll_month) AS payroll_month, round(coalesce(p.payroll_cost, 0), 2) AS payroll_fact_usd, round(coalesce(gl.gl_people_cost, 0), 2) AS payroll_gl_usd, round(coalesce(gl.gl_people_cost, 0) - coalesce(p.payroll_cost, 0), 2) AS difference_usd FROM payroll p FULL OUTER JOIN gl USING (payroll_month) ORDER BY payroll_month;\n\nThe full join exposes a missing month instead of silently dropping it. In the loaded six months, the largest difference is $0.29 because the GL sums rounded components while the fact sums rounded employee totals.`,
    ],
    sayIt: `"Payroll fact and the Payroll-source GL tie within twenty-nine cents in every first-half month. I included support and cloud-operations compensation in COGS accounts 5300 and 5310; omitting those would create a false control break."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm58',
    part: 12,
    title: 'Package the workforce council',
    from: 'priya',
    ask: `Package the council in one row without collapsing unlike populations. June paid heads are an employee-month population; June 30 active roster is an as-of population; trailing exits use twelve months and average monthly paid heads; contractor share and location use June payroll; first-half people cost and the GL tie use six months. Keep each label honest.`,
    deliverable: `Exactly one row: june_paid_heads, june_30_active_roster, paid_not_active_at_close, trailing_12m_exits, trailing_12m_exit_rate_pct, june_contractor_share_pct, h1_people_cost_usd, h1_payroll_gl_difference_usd, largest_people_cost_location, and highest_exit_rate_division. Round percentages to 1 and dollars to 2.`,
    tables: ['dim_employee', 'fct_payroll_monthly', 'dim_department', 'fct_gl_transactions'],
    canonical: `WITH paid AS (SELECT employee_id FROM fct_payroll_monthly WHERE payroll_month = DATE '2026-06-01'), active AS (SELECT employee_id FROM dim_employee WHERE hire_date <= DATE '2026-06-30' AND (termination_date IS NULL OR termination_date > DATE '2026-06-30')), heads AS (SELECT count(p.employee_id)::BIGINT AS june_paid_heads, count(a.employee_id)::BIGINT AS june_30_active_roster, count(*) FILTER (WHERE p.employee_id IS NOT NULL AND a.employee_id IS NULL)::BIGINT AS paid_not_active_at_close FROM paid p FULL OUTER JOIN active a USING (employee_id)), attrition AS (SELECT count(*) FILTER (WHERE termination_date >= DATE '2025-07-01' AND termination_date < DATE '2026-07-01')::BIGINT AS trailing_12m_exits, (SELECT count(*) / 12.0 FROM fct_payroll_monthly WHERE payroll_month >= DATE '2025-07-01' AND payroll_month < DATE '2026-07-01') AS avg_paid_heads FROM dim_employee), contractor AS (SELECT 100.0 * count(*) FILTER (WHERE e.employment_type = 'Contractor') / count(*) AS contractor_share FROM fct_payroll_monthly p JOIN dim_employee e USING (employee_id) WHERE p.payroll_month = DATE '2026-06-01'), payroll_h1 AS (SELECT sum(total_comp_usd) AS people_cost FROM fct_payroll_monthly WHERE payroll_month >= DATE '2026-01-01' AND payroll_month < DATE '2026-07-01'), gl_h1 AS (SELECT sum(amount) AS people_cost FROM fct_gl_transactions WHERE source_system = 'Payroll' AND account_id IN ('5300', '5310', '6000', '6020', '6030') AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01'), loc AS (SELECT e.location, sum(p.total_comp_usd) AS cost FROM fct_payroll_monthly p JOIN dim_employee e USING (employee_id) WHERE p.payroll_month = DATE '2026-06-01' GROUP BY e.location ORDER BY cost DESC, e.location LIMIT 1), div_exit AS (SELECT d.division, count(*) AS exits FROM dim_employee e JOIN dim_department d ON e.dept_id = d.dept_id WHERE e.termination_date >= DATE '2025-07-01' AND e.termination_date < DATE '2026-07-01' GROUP BY d.division), div_paid AS (SELECT d.division, count(*) / 12.0 AS avg_heads FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id WHERE p.payroll_month >= DATE '2025-07-01' AND p.payroll_month < DATE '2026-07-01' GROUP BY d.division), top_div AS (SELECT e.division, 100.0 * e.exits / p.avg_heads AS exit_rate FROM div_exit e JOIN div_paid p USING (division) ORDER BY exit_rate DESC, e.division LIMIT 1) SELECT h.june_paid_heads, h.june_30_active_roster, h.paid_not_active_at_close, a.trailing_12m_exits, round(100.0 * a.trailing_12m_exits / a.avg_paid_heads, 1) AS trailing_12m_exit_rate_pct, round(c.contractor_share, 1) AS june_contractor_share_pct, round(p.people_cost, 2) AS h1_people_cost_usd, round(g.people_cost - p.people_cost, 2) AS h1_payroll_gl_difference_usd, l.location AS largest_people_cost_location, d.division AS highest_exit_rate_division FROM heads h CROSS JOIN attrition a CROSS JOIN contractor c CROSS JOIN payroll_h1 p CROSS JOIN gl_h1 g CROSS JOIN loc l CROSS JOIN top_div d`,
    ordered: false,
    fingerprintSQL: `WITH paid AS (SELECT employee_id FROM fct_payroll_monthly WHERE payroll_month = DATE '2026-06-01'), heads AS (SELECT count(*)::BIGINT AS june_paid_heads, count(*)::BIGINT AS june_30_active_roster, 0::BIGINT AS paid_not_active_at_close FROM paid), attrition AS (SELECT count(*) FILTER (WHERE termination_date >= DATE '2025-07-01' AND termination_date < DATE '2026-07-01')::BIGINT AS trailing_12m_exits, (SELECT count(*) / 12.0 FROM fct_payroll_monthly WHERE payroll_month >= DATE '2025-07-01' AND payroll_month < DATE '2026-07-01') AS avg_paid_heads FROM dim_employee), contractor AS (SELECT 100.0 * count(*) FILTER (WHERE e.employment_type = 'Contractor') / count(*) AS contractor_share FROM fct_payroll_monthly p JOIN dim_employee e USING (employee_id) WHERE p.payroll_month = DATE '2026-06-01'), payroll_h1 AS (SELECT sum(total_comp_usd) AS people_cost FROM fct_payroll_monthly WHERE payroll_month >= DATE '2026-01-01' AND payroll_month < DATE '2026-07-01'), gl_h1 AS (SELECT sum(amount) AS people_cost FROM fct_gl_transactions WHERE source_system = 'Payroll' AND account_id IN ('5300', '5310', '6000', '6020', '6030') AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01'), loc AS (SELECT e.location, sum(p.total_comp_usd) AS cost FROM fct_payroll_monthly p JOIN dim_employee e USING (employee_id) WHERE p.payroll_month = DATE '2026-06-01' GROUP BY e.location ORDER BY cost DESC, e.location LIMIT 1), div_exit AS (SELECT d.division, count(*) AS exits FROM dim_employee e JOIN dim_department d ON e.dept_id = d.dept_id WHERE e.termination_date >= DATE '2025-07-01' AND e.termination_date < DATE '2026-07-01' GROUP BY d.division), div_paid AS (SELECT d.division, count(*) / 12.0 AS avg_heads FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id WHERE p.payroll_month >= DATE '2025-07-01' AND p.payroll_month < DATE '2026-07-01' GROUP BY d.division), top_div AS (SELECT e.division, 100.0 * e.exits / p.avg_heads AS exit_rate FROM div_exit e JOIN div_paid p USING (division) ORDER BY exit_rate DESC, e.division LIMIT 1) SELECT h.june_paid_heads, h.june_30_active_roster, h.paid_not_active_at_close, a.trailing_12m_exits, round(100.0 * a.trailing_12m_exits / a.avg_paid_heads, 1) AS trailing_12m_exit_rate_pct, round(c.contractor_share, 1) AS june_contractor_share_pct, round(p.people_cost, 2) AS h1_people_cost_usd, round(g.people_cost - p.people_cost, 2) AS h1_payroll_gl_difference_usd, l.location AS largest_people_cost_location, d.division AS highest_exit_rate_division FROM heads h CROSS JOIN attrition a CROSS JOIN contractor c CROSS JOIN payroll_h1 p CROSS JOIN gl_h1 g CROSS JOIN loc l CROSS JOIN top_div d`,
    fingerprintMessage: `The handoff again treats June payroll as the June 30 roster, erasing the six employees paid during June who had exited by month end. Preserve the paid and as-of populations separately.`,
    requireRegex: PAYROLL_SOURCE_REQUIREMENT,
    requireMessage: `The handoff's GL tie must remain a Payroll-source control. Keep source_system = 'Payroll' rather than trusting that no other journal will ever use the same people-cost accounts.`,
    hints: [
      `Build one-row controls independently: paid-versus-active heads, trailing exits plus average paid heads, June contractor mix, H1 payroll and GL totals, highest-cost location, and highest exit-rate division. CROSS JOIN only after each is reduced to one row.`,
      `WITH paid/active/heads AS (...), attrition AS (...), contractor AS (...), payroll_h1/gl_h1 AS (...), loc AS (... LIMIT 1), div_exit/div_paid/top_div AS (... LIMIT 1) SELECT the ten labeled outputs FROM those one-row controls;`,
      `Use the same definitions from missions 50 through 57. The handoff should return 678 June paid heads, 672 June 30 active employees, 6 paid-not-active exceptions, 101 trailing exits at 15.3%, 6.2% June contractor share, $73.91 million H1 loaded people cost, a $0.99 aggregate payroll-to-GL rounding difference, New York as the largest June cost location, and G&A as the highest exit-rate division. These controls share a meeting, not one grain.`,
    ],
    sayIt: `"June payroll covered 678 people while the June 30 roster had 672, with six paid-during-month exits explaining the gap. Trailing exits were 101, or 15.3% of average paid heads; contractors were 6.2% of June paid heads. First-half loaded people cost was $73.9 million and tied to the Payroll-source GL within $0.99. New York was the largest cost location, and G&A had the highest loaded exit rate."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm59',
    part: 13,
    title: 'Size the regional ARR footprint',
    from: 'priya',
    ask: `Regional revenue council tomorrow. Start with the current footprint: June 2026 active customers and ending ARR by region, plus average ARR per active customer and each region's share of company ARR. dim_customer is a current-state dimension, so this is today's regional classification only.`,
    deliverable: `Three rows: region, active_customers, ending_arr_usd, avg_arr_per_customer, and arr_share_pct. Round dollars to 2 and share to 1; sort highest ending ARR first.`,
    tables: ['fct_subscription_snapshot_monthly', 'dim_customer'],
    canonical: `WITH regional AS (SELECT c.region, count(*)::BIGINT AS active_customers, sum(s.arr_usd) AS ending_arr FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) WHERE s.month_start = DATE '2026-06-01' GROUP BY c.region) SELECT region, active_customers, round(ending_arr, 2) AS ending_arr_usd, round(ending_arr / active_customers, 2) AS avg_arr_per_customer, round(100.0 * ending_arr / sum(ending_arr) OVER (), 1) AS arr_share_pct FROM regional ORDER BY ending_arr_usd DESC, region`,
    ordered: true,
    orderedNote: 'highest ending ARR first, then region',
    fingerprintSQL: `WITH regional AS (SELECT c.region, count(*)::BIGINT AS active_customers, sum(s.arr_usd) AS ending_arr FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) GROUP BY c.region) SELECT region, active_customers, round(ending_arr, 2) AS ending_arr_usd, round(ending_arr / active_customers, 2) AS avg_arr_per_customer, round(100.0 * ending_arr / sum(ending_arr) OVER (), 1) AS arr_share_pct FROM regional ORDER BY ending_arr_usd DESC, region`,
    fingerprintMessage: `You summed every customer-month ever loaded, so this is active history rather than the June footprint. Pin the snapshot to month_start = DATE '2026-06-01' before counting customers or ARR.`,
    hints: [
      `Filter the subscription snapshot to June first, then join current region. Aggregate customers and ARR by region; a window over the three regional totals gives ARR share without a second query.`,
      `WITH regional AS (SELECT region, count(*) customers, sum(arr_usd) arr FROM June snapshot JOIN customer GROUP BY region) SELECT ..., arr/customers, 100*arr/sum(arr) OVER () ...;`,
      `WITH regional AS (SELECT c.region, count(*)::BIGINT AS active_customers, sum(s.arr_usd) AS ending_arr FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) WHERE s.month_start = DATE '2026-06-01' GROUP BY c.region) SELECT region, active_customers, round(ending_arr, 2) AS ending_arr_usd, round(ending_arr / active_customers, 2) AS avg_arr_per_customer, round(100.0 * ending_arr / sum(ending_arr) OVER (), 1) AS arr_share_pct FROM regional ORDER BY ending_arr_usd DESC, region;\n\nThese are current region labels applied to the June snapshot, not a history of where accounts were located.`,
    ],
    sayIt: `"AMER carries $51.0 million, or 68.3% of June ending ARR, across 3,153 active customers. EMEA is 23.9% and APAC 7.8%; those labels are current-state classifications."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm60',
    part: 13,
    title: 'Explain Q2 movement by current region',
    from: 'priya',
    ask: `Now explain Q2 ARR movement by current region. Break out new-logo count, new ARR, expansion, contraction loss, churn loss, and net movement. Net includes reactivation because it is a real signed movement, but do not hide new or reactivation inside the expansion column. Historical events inherit today's region label in this type-1 dimension.`,
    deliverable: `Three rows: region, new_logos, new_arr_usd, expansion_arr_usd, contraction_arr_lost_usd, churn_arr_lost_usd, and net_arr_movement_usd. Round dollars to 2; sort highest net movement first.`,
    tables: ['fct_arr_movements', 'dim_customer'],
    canonical: `SELECT c.region, count(DISTINCT m.customer_id) FILTER (WHERE m.movement_type = 'new')::BIGINT AS new_logos, round(sum(CASE WHEN m.movement_type = 'new' THEN m.arr_delta_usd ELSE 0 END), 2) AS new_arr_usd, round(sum(CASE WHEN m.movement_type = 'expansion' THEN m.arr_delta_usd ELSE 0 END), 2) AS expansion_arr_usd, round(-sum(CASE WHEN m.movement_type = 'contraction' THEN m.arr_delta_usd ELSE 0 END), 2) AS contraction_arr_lost_usd, round(-sum(CASE WHEN m.movement_type = 'churn' THEN m.arr_delta_usd ELSE 0 END), 2) AS churn_arr_lost_usd, round(sum(m.arr_delta_usd), 2) AS net_arr_movement_usd FROM fct_arr_movements m JOIN dim_customer c USING (customer_id) WHERE m.event_date >= DATE '2026-04-01' AND m.event_date < DATE '2026-07-01' GROUP BY c.region ORDER BY net_arr_movement_usd DESC, c.region`,
    ordered: true,
    orderedNote: 'highest net ARR movement first, then region',
    fingerprintSQL: `SELECT c.region, count(DISTINCT m.customer_id) FILTER (WHERE m.movement_type = 'new')::BIGINT AS new_logos, round(sum(CASE WHEN m.movement_type = 'new' THEN m.arr_delta_usd ELSE 0 END), 2) AS new_arr_usd, round(sum(CASE WHEN m.arr_delta_usd > 0 THEN m.arr_delta_usd ELSE 0 END), 2) AS expansion_arr_usd, round(-sum(CASE WHEN m.movement_type = 'contraction' THEN m.arr_delta_usd ELSE 0 END), 2) AS contraction_arr_lost_usd, round(-sum(CASE WHEN m.movement_type = 'churn' THEN m.arr_delta_usd ELSE 0 END), 2) AS churn_arr_lost_usd, round(sum(m.arr_delta_usd), 2) AS net_arr_movement_usd FROM fct_arr_movements m JOIN dim_customer c USING (customer_id) WHERE m.event_date >= DATE '2026-04-01' AND m.event_date < DATE '2026-07-01' GROUP BY c.region ORDER BY net_arr_movement_usd DESC, c.region`,
    fingerprintMessage: `The expansion column includes every positive movement, so new business and reactivation are counted twice in the story. Expansion must use movement_type = 'expansion' only; the signed net can include every type.`,
    hints: [
      `Filter one half-open Q2 event window, join current region, and use conditional aggregates for each movement class. Loss columns negate the signed contraction and churn deltas for readable positive loss dollars.`,
      `COUNT DISTINCT customer FILTER new; SUM CASE for new and expansion; -SUM CASE for contraction and churn; plain SUM for net.`,
      `SELECT c.region, count(DISTINCT m.customer_id) FILTER (WHERE m.movement_type = 'new')::BIGINT AS new_logos, round(sum(CASE WHEN m.movement_type = 'new' THEN m.arr_delta_usd ELSE 0 END), 2) AS new_arr_usd, round(sum(CASE WHEN m.movement_type = 'expansion' THEN m.arr_delta_usd ELSE 0 END), 2) AS expansion_arr_usd, round(-sum(CASE WHEN m.movement_type = 'contraction' THEN m.arr_delta_usd ELSE 0 END), 2) AS contraction_arr_lost_usd, round(-sum(CASE WHEN m.movement_type = 'churn' THEN m.arr_delta_usd ELSE 0 END), 2) AS churn_arr_lost_usd, round(sum(m.arr_delta_usd), 2) AS net_arr_movement_usd FROM fct_arr_movements m JOIN dim_customer c USING (customer_id) WHERE m.event_date >= DATE '2026-04-01' AND m.event_date < DATE '2026-07-01' GROUP BY c.region ORDER BY net_arr_movement_usd DESC, c.region;\n\nThe net includes reactivation; the expansion column does not. Region is today's label applied to historical events.`,
    ],
    sayIt: `"Q2 net ARR movement was $3.76 million in AMER, $1.44 million in EMEA, and $0.54 million in APAC. I kept new and reactivation out of expansion and used current, not historical, region labels."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm61',
    part: 13,
    title: 'Map June revenue by billing country',
    from: 'elena',
    ask: `Take the June revenue book down one level to current billing country. Count distinct billed customers and separate subscription account 4000 from usage account 4010. Usage share is usage divided by total customer-linked revenue, not usage divided by subscription alone.`,
    deliverable: `Ten rows: billing_country, billed_customers, subscription_revenue_usd, usage_revenue_usd, total_revenue_usd, and usage_share_pct. Round dollars to 2 and share to 1; sort highest total revenue first.`,
    tables: ['fct_gl_transactions', 'dim_customer'],
    canonical: `SELECT c.billing_country, count(DISTINCT g.customer_id)::BIGINT AS billed_customers, round(sum(g.amount) FILTER (WHERE g.account_id = '4000'), 2) AS subscription_revenue_usd, round(sum(g.amount) FILTER (WHERE g.account_id = '4010'), 2) AS usage_revenue_usd, round(sum(g.amount), 2) AS total_revenue_usd, round(100.0 * sum(g.amount) FILTER (WHERE g.account_id = '4010') / sum(g.amount), 1) AS usage_share_pct FROM fct_gl_transactions g JOIN dim_customer c USING (customer_id) WHERE g.txn_date >= DATE '2026-06-01' AND g.txn_date < DATE '2026-07-01' AND g.account_id IN ('4000', '4010') GROUP BY c.billing_country ORDER BY total_revenue_usd DESC, c.billing_country LIMIT 10`,
    ordered: true,
    orderedNote: 'highest June customer-linked revenue first, then country',
    fingerprintSQL: `SELECT c.billing_country, count(DISTINCT g.customer_id)::BIGINT AS billed_customers, round(sum(g.amount) FILTER (WHERE g.account_id = '4000'), 2) AS subscription_revenue_usd, round(sum(g.amount) FILTER (WHERE g.account_id = '4010'), 2) AS usage_revenue_usd, round(sum(g.amount), 2) AS total_revenue_usd, round(100.0 * sum(g.amount) FILTER (WHERE g.account_id = '4010') / sum(g.amount) FILTER (WHERE g.account_id = '4000'), 1) AS usage_share_pct FROM fct_gl_transactions g JOIN dim_customer c USING (customer_id) WHERE g.txn_date >= DATE '2026-06-01' AND g.txn_date < DATE '2026-07-01' AND g.account_id IN ('4000', '4010') GROUP BY c.billing_country ORDER BY total_revenue_usd DESC, c.billing_country LIMIT 10`,
    fingerprintMessage: `The dollars are right, but usage share divides by subscription revenue rather than total revenue. Use usage / (subscription + usage), which is the grouped sum across both selected accounts.`,
    hints: [
      `Filter the GL to June and the two customer revenue accounts, then join current billing country. FILTER clauses split the dollars while the grouped SUM stays the total denominator.`,
      `usage_share = 100 * sum(amount) FILTER (WHERE account='4010') / sum(amount) after restricting rows to 4000 and 4010.`,
      `SELECT c.billing_country, count(DISTINCT g.customer_id)::BIGINT AS billed_customers, round(sum(g.amount) FILTER (WHERE g.account_id = '4000'), 2) AS subscription_revenue_usd, round(sum(g.amount) FILTER (WHERE g.account_id = '4010'), 2) AS usage_revenue_usd, round(sum(g.amount), 2) AS total_revenue_usd, round(100.0 * sum(g.amount) FILTER (WHERE g.account_id = '4010') / sum(g.amount), 1) AS usage_share_pct FROM fct_gl_transactions g JOIN dim_customer c USING (customer_id) WHERE g.txn_date >= DATE '2026-06-01' AND g.txn_date < DATE '2026-07-01' AND g.account_id IN ('4000', '4010') GROUP BY c.billing_country ORDER BY total_revenue_usd DESC, c.billing_country LIMIT 10;\n\nCountry is the customer's current billing-country label; the GL dollars are June recognized revenue in USD.`,
    ],
    sayIt: `"The United States produced $3.74 million of June customer-linked revenue across 2,390 billed customers. Canada was $1.38 million; usage was roughly 17% of total revenue across the leading countries."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm62',
    part: 13,
    title: 'Split regional revenue by plan',
    from: 'priya',
    ask: `Show June revenue mix by current region and June plan. Join each customer-linked GL line to exactly one June snapshot row, then split subscription and usage. Starter has no metered usage in this fixture, so display zero dollars and zero percent rather than implying missing data.`,
    deliverable: `Nine rows: region, plan_name, billed_customers, subscription_revenue_usd, usage_revenue_usd, total_revenue_usd, and usage_share_pct. Round dollars to 2 and share to 1; sort by region, then highest total revenue.`,
    tables: ['fct_gl_transactions', 'dim_customer', 'fct_subscription_snapshot_monthly'],
    canonical: `SELECT c.region, s.plan_name, count(DISTINCT g.customer_id)::BIGINT AS billed_customers, round(sum(g.amount) FILTER (WHERE g.account_id = '4000'), 2) AS subscription_revenue_usd, round(coalesce(sum(g.amount) FILTER (WHERE g.account_id = '4010'), 0), 2) AS usage_revenue_usd, round(sum(g.amount), 2) AS total_revenue_usd, round(100.0 * coalesce(sum(g.amount) FILTER (WHERE g.account_id = '4010'), 0) / sum(g.amount), 1) AS usage_share_pct FROM fct_gl_transactions g JOIN dim_customer c USING (customer_id) JOIN fct_subscription_snapshot_monthly s ON s.customer_id = g.customer_id AND s.month_start = DATE '2026-06-01' WHERE g.txn_date >= DATE '2026-06-01' AND g.txn_date < DATE '2026-07-01' AND g.account_id IN ('4000', '4010') GROUP BY c.region, s.plan_name ORDER BY c.region, total_revenue_usd DESC, s.plan_name`,
    ordered: true,
    orderedNote: 'region alphabetically, then highest total revenue and plan',
    fingerprintSQL: `SELECT c.region, s.plan_name, count(DISTINCT g.customer_id)::BIGINT AS billed_customers, round(sum(g.amount) FILTER (WHERE g.account_id = '4000'), 2) AS subscription_revenue_usd, round(coalesce(sum(g.amount) FILTER (WHERE g.account_id = '4010'), 0), 2) AS usage_revenue_usd, round(sum(g.amount), 2) AS total_revenue_usd, round(100.0 * coalesce(sum(g.amount) FILTER (WHERE g.account_id = '4010'), 0) / sum(g.amount), 1) AS usage_share_pct FROM fct_gl_transactions g JOIN dim_customer c USING (customer_id) JOIN fct_subscription_snapshot_monthly s ON s.customer_id = g.customer_id WHERE g.txn_date >= DATE '2026-06-01' AND g.txn_date < DATE '2026-07-01' AND g.account_id IN ('4000', '4010') GROUP BY c.region, s.plan_name ORDER BY c.region, total_revenue_usd DESC, s.plan_name`,
    fingerprintMessage: `Each June GL line joined to every historical snapshot row for its customer, multiplying revenue and sometimes assigning one line to several plans. Pin the snapshot join itself to June so its key is one customer-month.`,
    hints: [
      `The critical grain is one June GL line to one June customer snapshot. Put s.month_start = DATE '2026-06-01' in the join, then group by current region and June plan.`,
      `JOIN snapshot s ON s.customer_id=g.customer_id AND s.month_start=June; COALESCE the filtered usage SUM to zero for Starter.`,
      `SELECT c.region, s.plan_name, count(DISTINCT g.customer_id)::BIGINT AS billed_customers, round(sum(g.amount) FILTER (WHERE g.account_id = '4000'), 2) AS subscription_revenue_usd, round(coalesce(sum(g.amount) FILTER (WHERE g.account_id = '4010'), 0), 2) AS usage_revenue_usd, round(sum(g.amount), 2) AS total_revenue_usd, round(100.0 * coalesce(sum(g.amount) FILTER (WHERE g.account_id = '4010'), 0) / sum(g.amount), 1) AS usage_share_pct FROM fct_gl_transactions g JOIN dim_customer c USING (customer_id) JOIN fct_subscription_snapshot_monthly s ON s.customer_id = g.customer_id AND s.month_start = DATE '2026-06-01' WHERE g.txn_date >= DATE '2026-06-01' AND g.txn_date < DATE '2026-07-01' AND g.account_id IN ('4000', '4010') GROUP BY c.region, s.plan_name ORDER BY c.region, total_revenue_usd DESC, s.plan_name;`,
    ],
    sayIt: `"Enterprise is the largest June revenue plan in every region, and Enterprise and Growth each carry about a 17.8% usage mix. Starter correctly shows zero usage because this fixture does not meter that plan."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm63',
    part: 13,
    title: 'Measure concentration inside each region',
    from: 'elena',
    ask: `Concentration has to be measured inside each regional book, not against the company globally. For June ending ARR, calculate each region's total, top-five customer ARR share, and largest-customer share. Use a deterministic rank inside region so equal ARR never makes the top five drift.`,
    deliverable: `Three rows: region, region_arr_usd, top_5_arr_usd, top_5_share_pct, and largest_customer_share_pct. Round dollars to 2 and shares to 1; sort highest top-five share first.`,
    tables: ['fct_subscription_snapshot_monthly', 'dim_customer'],
    canonical: `WITH ranked AS (SELECT c.region, c.customer_id, s.arr_usd, row_number() OVER (PARTITION BY c.region ORDER BY s.arr_usd DESC, c.customer_id) AS regional_rank, sum(s.arr_usd) OVER (PARTITION BY c.region) AS region_arr FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) WHERE s.month_start = DATE '2026-06-01') SELECT region, round(max(region_arr), 2) AS region_arr_usd, round(sum(arr_usd) FILTER (WHERE regional_rank <= 5), 2) AS top_5_arr_usd, round(100.0 * sum(arr_usd) FILTER (WHERE regional_rank <= 5) / max(region_arr), 1) AS top_5_share_pct, round(100.0 * max(arr_usd) / max(region_arr), 1) AS largest_customer_share_pct FROM ranked GROUP BY region ORDER BY top_5_share_pct DESC, region`,
    ordered: true,
    orderedNote: 'highest top-five concentration first, then region',
    fingerprintSQL: `WITH ranked AS (SELECT c.region, c.customer_id, s.arr_usd, row_number() OVER (ORDER BY s.arr_usd DESC, c.customer_id) AS regional_rank, sum(s.arr_usd) OVER (PARTITION BY c.region) AS region_arr FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) WHERE s.month_start = DATE '2026-06-01') SELECT region, round(max(region_arr), 2) AS region_arr_usd, round(coalesce(sum(arr_usd) FILTER (WHERE regional_rank <= 5), 0), 2) AS top_5_arr_usd, round(100.0 * coalesce(sum(arr_usd) FILTER (WHERE regional_rank <= 5), 0) / max(region_arr), 1) AS top_5_share_pct, round(100.0 * max(arr_usd) / max(region_arr), 1) AS largest_customer_share_pct FROM ranked GROUP BY region ORDER BY top_5_share_pct DESC, region`,
    fingerprintMessage: `The customer rank is global, so a region can miss its own largest accounts entirely. Partition row_number by region, and keep the regional ARR denominator partitioned the same way.`,
    hints: [
      `Window the June customer rows twice by region: ROW_NUMBER orders ARR with customer_id as the tiebreak, and SUM gives the regional denominator on every row. Then aggregate the top five.`,
      `row_number() OVER (PARTITION BY region ORDER BY arr DESC, customer_id); sum(arr) OVER (PARTITION BY region).`,
      `WITH ranked AS (SELECT c.region, c.customer_id, s.arr_usd, row_number() OVER (PARTITION BY c.region ORDER BY s.arr_usd DESC, c.customer_id) AS regional_rank, sum(s.arr_usd) OVER (PARTITION BY c.region) AS region_arr FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) WHERE s.month_start = DATE '2026-06-01') SELECT region, round(max(region_arr), 2) AS region_arr_usd, round(sum(arr_usd) FILTER (WHERE regional_rank <= 5), 2) AS top_5_arr_usd, round(100.0 * sum(arr_usd) FILTER (WHERE regional_rank <= 5) / max(region_arr), 1) AS top_5_share_pct, round(100.0 * max(arr_usd) / max(region_arr), 1) AS largest_customer_share_pct FROM ranked GROUP BY region ORDER BY top_5_share_pct DESC, region;`,
    ],
    sayIt: `"APAC is the most concentrated regional book: its top five customers are 24.1% of ARR and its largest is 5.5%. EMEA is 10.3% top-five; AMER is 3.8%."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm64',
    part: 13,
    title: 'Follow the 2025 new-logo cohort',
    from: 'priya',
    ask: `Follow customers first acquired during calendar 2025 through the June 2026 snapshot. By current region, show acquired logos and acquisition ARR, then how many remain active and their current ARR. A churned logo must stay in the cohort as zero, so preserve every acquisition with a LEFT JOIN.`,
    deliverable: `Three rows: region, acquired_logos, acquired_arr_usd, active_in_june, june_arr_usd, and logo_survival_pct. Round dollars to 2 and survival to 1; sort highest survival first.`,
    tables: ['fct_arr_movements', 'dim_customer', 'fct_subscription_snapshot_monthly'],
    canonical: `WITH acquired AS (SELECT m.customer_id, c.region, sum(m.arr_delta_usd) AS acquisition_arr FROM fct_arr_movements m JOIN dim_customer c USING (customer_id) WHERE m.movement_type = 'new' AND m.event_date >= DATE '2025-01-01' AND m.event_date < DATE '2026-01-01' GROUP BY m.customer_id, c.region), june AS (SELECT customer_id, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01') SELECT a.region, count(*)::BIGINT AS acquired_logos, round(sum(a.acquisition_arr), 2) AS acquired_arr_usd, count(j.customer_id)::BIGINT AS active_in_june, round(sum(coalesce(j.arr_usd, 0)), 2) AS june_arr_usd, round(100.0 * count(j.customer_id) / count(*), 1) AS logo_survival_pct FROM acquired a LEFT JOIN june j USING (customer_id) GROUP BY a.region ORDER BY logo_survival_pct DESC, a.region`,
    ordered: true,
    orderedNote: 'highest logo survival first, then region',
    fingerprintSQL: `WITH acquired AS (SELECT m.customer_id, c.region, sum(m.arr_delta_usd) AS acquisition_arr FROM fct_arr_movements m JOIN dim_customer c USING (customer_id) WHERE m.movement_type = 'new' AND m.event_date >= DATE '2025-01-01' AND m.event_date < DATE '2026-01-01' GROUP BY m.customer_id, c.region), june AS (SELECT customer_id, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01') SELECT a.region, count(*)::BIGINT AS acquired_logos, round(sum(a.acquisition_arr), 2) AS acquired_arr_usd, count(j.customer_id)::BIGINT AS active_in_june, round(sum(coalesce(j.arr_usd, 0)), 2) AS june_arr_usd, round(100.0 * count(j.customer_id) / count(*), 1) AS logo_survival_pct FROM acquired a JOIN june j USING (customer_id) GROUP BY a.region ORDER BY logo_survival_pct DESC, a.region`,
    fingerprintMessage: `The INNER JOIN removes every acquired customer absent in June, so the surviving denominator makes every region look 100% retained. LEFT JOIN June onto the fixed acquisition cohort and count the matches.`,
    hints: [
      `Build one row per 2025 new customer first. LEFT JOIN the June snapshot so customers who later churned remain in the denominator with no June row.`,
      `acquired GROUP BY customer and current region; LEFT JOIN june USING customer_id; survival = count(june customer_id) / count(all acquired rows).`,
      `WITH acquired AS (SELECT m.customer_id, c.region, sum(m.arr_delta_usd) AS acquisition_arr FROM fct_arr_movements m JOIN dim_customer c USING (customer_id) WHERE m.movement_type = 'new' AND m.event_date >= DATE '2025-01-01' AND m.event_date < DATE '2026-01-01' GROUP BY m.customer_id, c.region), june AS (SELECT customer_id, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01') SELECT a.region, count(*)::BIGINT AS acquired_logos, round(sum(a.acquisition_arr), 2) AS acquired_arr_usd, count(j.customer_id)::BIGINT AS active_in_june, round(sum(coalesce(j.arr_usd, 0)), 2) AS june_arr_usd, round(100.0 * count(j.customer_id) / count(*), 1) AS logo_survival_pct FROM acquired a LEFT JOIN june j USING (customer_id) GROUP BY a.region ORDER BY logo_survival_pct DESC, a.region;\n\nRegion is today's label, and survival means present in the June snapshot; it does not explain why a logo left.`,
    ],
    sayIt: `"Of the 2025 new-logo cohort, 67.2% of currently EMEA-classified logos remained active in June 2026, versus 65.7% in AMER and 65.2% in APAC. Those are current-region cohort cuts, not historical territory attribution."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm65',
    part: 13,
    title: 'Audit assignment coverage by region',
    from: 'elena',
    ask: `Before routing any regional follow-up, audit how much of the June book has an assignment record as of June 30. Resolve the latest CSM row per customer, preserve unassigned active customers, and report coverage by customer count and ARR. This measures the assignment log's coverage, not staffing capacity or account health.`,
    deliverable: `Three rows: region, active_customers, assigned_customers, customer_assignment_coverage_pct, ending_arr_usd, assigned_arr_usd, and arr_assignment_coverage_pct. Round dollars to 2 and percentages to 1; sort lowest ARR coverage first.`,
    tables: ['fct_subscription_snapshot_monthly', 'dim_customer', 'stg_customer_csm_assignments'],
    canonical: `WITH latest AS (SELECT customer_id, csm_name FROM stg_customer_csm_assignments WHERE assigned_on <= DATE '2026-06-30' QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name) = 1), base AS (SELECT c.region, s.customer_id, s.arr_usd, l.csm_name FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) LEFT JOIN latest l USING (customer_id) WHERE s.month_start = DATE '2026-06-01') SELECT region, count(*)::BIGINT AS active_customers, count(*) FILTER (WHERE csm_name IS NOT NULL)::BIGINT AS assigned_customers, round(100.0 * count(*) FILTER (WHERE csm_name IS NOT NULL) / count(*), 1) AS customer_assignment_coverage_pct, round(sum(arr_usd), 2) AS ending_arr_usd, round(coalesce(sum(arr_usd) FILTER (WHERE csm_name IS NOT NULL), 0), 2) AS assigned_arr_usd, round(100.0 * coalesce(sum(arr_usd) FILTER (WHERE csm_name IS NOT NULL), 0) / sum(arr_usd), 1) AS arr_assignment_coverage_pct FROM base GROUP BY region ORDER BY arr_assignment_coverage_pct, region`,
    ordered: true,
    orderedNote: 'lowest assigned ARR coverage first, then region',
    fingerprintSQL: `WITH base AS (SELECT c.region, s.customer_id, s.arr_usd, a.csm_name FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) LEFT JOIN stg_customer_csm_assignments a ON s.customer_id = a.customer_id AND a.assigned_on <= DATE '2026-06-30' WHERE s.month_start = DATE '2026-06-01') SELECT region, count(*)::BIGINT AS active_customers, count(*) FILTER (WHERE csm_name IS NOT NULL)::BIGINT AS assigned_customers, round(100.0 * count(*) FILTER (WHERE csm_name IS NOT NULL) / count(*), 1) AS customer_assignment_coverage_pct, round(sum(arr_usd), 2) AS ending_arr_usd, round(coalesce(sum(arr_usd) FILTER (WHERE csm_name IS NOT NULL), 0), 2) AS assigned_arr_usd, round(100.0 * coalesce(sum(arr_usd) FILTER (WHERE csm_name IS NOT NULL), 0) / sum(arr_usd), 1) AS arr_assignment_coverage_pct FROM base GROUP BY region ORDER BY arr_assignment_coverage_pct, region`,
    fingerprintMessage: `Assignment history is one-to-many, so joining it raw duplicates active customers and ARR. Resolve one latest row per customer as of June 30 before the LEFT JOIN to the active book.`,
    requireRegex: ASSIGNMENT_CUTOFF_REQUIREMENT,
    requireMessage: `The loaded fixture has no post-June assignments, so an omitted cutoff can look right today. Preserve the explicit as-of-June-30 assignment predicate (or assigned_on before July 1) so later owner changes cannot rewrite regional coverage.`,
    hints: [
      `Use QUALIFY ROW_NUMBER to keep the latest assignment at the cutoff. LEFT JOIN it to every June active customer, then use conditional counts and sums for assigned coverage.`,
      `latest: row_number() OVER (PARTITION BY customer ORDER BY assigned_on DESC, csm_name)=1; base: June snapshot LEFT JOIN latest.`,
      `WITH latest AS (SELECT customer_id, csm_name FROM stg_customer_csm_assignments WHERE assigned_on <= DATE '2026-06-30' QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name) = 1), base AS (SELECT c.region, s.customer_id, s.arr_usd, l.csm_name FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) LEFT JOIN latest l USING (customer_id) WHERE s.month_start = DATE '2026-06-01') SELECT region, count(*)::BIGINT AS active_customers, count(*) FILTER (WHERE csm_name IS NOT NULL)::BIGINT AS assigned_customers, round(100.0 * count(*) FILTER (WHERE csm_name IS NOT NULL) / count(*), 1) AS customer_assignment_coverage_pct, round(sum(arr_usd), 2) AS ending_arr_usd, round(coalesce(sum(arr_usd) FILTER (WHERE csm_name IS NOT NULL), 0), 2) AS assigned_arr_usd, round(100.0 * coalesce(sum(arr_usd) FILTER (WHERE csm_name IS NOT NULL), 0) / sum(arr_usd), 1) AS arr_assignment_coverage_pct FROM base GROUP BY region ORDER BY arr_assignment_coverage_pct, region;`,
    ],
    sayIt: `"The assignment log covers 95.5% of APAC ARR, 96.1% of EMEA, and 96.7% of AMER, but only about half of active logos. This is a data-coverage control, not a claim about CSM capacity."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm66',
    part: 13,
    title: 'Size the current industry mix',
    from: 'priya',
    ask: `Give the council one market-mix view without inventing TAM. Rank the top eight current industries by June ending ARR, with active customers, represented-region count, largest ARR region, and company ARR share. Industry and region are current customer attributes.`,
    deliverable: `Eight rows: industry, active_customers, ending_arr_usd, represented_regions, largest_arr_region, and arr_share_pct. Round dollars to 2 and share to 1; sort highest ARR first.`,
    tables: ['fct_subscription_snapshot_monthly', 'dim_customer'],
    canonical: `WITH by_region AS (SELECT c.industry, c.region, count(*)::BIGINT AS active_customers, sum(s.arr_usd) AS ending_arr FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) WHERE s.month_start = DATE '2026-06-01' GROUP BY c.industry, c.region), by_industry AS (SELECT industry, sum(active_customers)::BIGINT AS active_customers, sum(ending_arr) AS ending_arr, count(*)::BIGINT AS represented_regions, max_by(region, ending_arr) AS largest_arr_region FROM by_region GROUP BY industry) SELECT industry, active_customers, round(ending_arr, 2) AS ending_arr_usd, represented_regions, largest_arr_region, round(100.0 * ending_arr / sum(ending_arr) OVER (), 1) AS arr_share_pct FROM by_industry ORDER BY ending_arr_usd DESC, industry LIMIT 8`,
    ordered: true,
    orderedNote: 'highest current industry ARR first, then industry',
    fingerprintSQL: `WITH by_region AS (SELECT c.industry, c.region, count(*)::BIGINT AS active_customers, sum(s.arr_usd) AS ending_arr FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) GROUP BY c.industry, c.region), by_industry AS (SELECT industry, sum(active_customers)::BIGINT AS active_customers, sum(ending_arr) AS ending_arr, count(*)::BIGINT AS represented_regions, max_by(region, ending_arr) AS largest_arr_region FROM by_region GROUP BY industry) SELECT industry, active_customers, round(ending_arr, 2) AS ending_arr_usd, represented_regions, largest_arr_region, round(100.0 * ending_arr / sum(ending_arr) OVER (), 1) AS arr_share_pct FROM by_industry ORDER BY ending_arr_usd DESC, industry LIMIT 8`,
    fingerprintMessage: `This ranks cumulative customer-month history, not the current industry book. Filter the snapshot to June before aggregating industry or region.`,
    hints: [
      `First aggregate the June snapshot by current industry and region. A second grouping can total each industry, count represented regions, and use max_by to name the largest ARR region.`,
      `by_region: June only, GROUP BY industry, region; by_industry: SUM customers/ARR, COUNT regions, max_by(region, ARR).`,
      `WITH by_region AS (SELECT c.industry, c.region, count(*)::BIGINT AS active_customers, sum(s.arr_usd) AS ending_arr FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) WHERE s.month_start = DATE '2026-06-01' GROUP BY c.industry, c.region), by_industry AS (SELECT industry, sum(active_customers)::BIGINT AS active_customers, sum(ending_arr) AS ending_arr, count(*)::BIGINT AS represented_regions, max_by(region, ending_arr) AS largest_arr_region FROM by_region GROUP BY industry) SELECT industry, active_customers, round(ending_arr, 2) AS ending_arr_usd, represented_regions, largest_arr_region, round(100.0 * ending_arr / sum(ending_arr) OVER (), 1) AS arr_share_pct FROM by_industry ORDER BY ending_arr_usd DESC, industry LIMIT 8;\n\nThis describes the loaded book; it does not measure addressable market or historical industry changes.`,
    ],
    sayIt: `"Financial Services is the largest current industry at $8.03 million, or 10.8% of ARR, followed by Retail & E-commerce at 10.1%. Every top-eight industry is represented in all three regions, with AMER the largest ARR region."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm67',
    part: 13,
    title: 'Package the regional revenue council',
    from: 'priya',
    ask: `Package the council in one row while keeping the grains explicit: June ending ARR, Q2 signed movement, June customer-linked revenue, June regional concentration, the fixed 2025 new-logo cohort observed in June 2026, assignment-log coverage as of June 30, and current industry mix. Do not turn current geography into historical territory truth.`,
    deliverable: `Exactly one row: largest_arr_region, largest_arr_region_share_pct, q2_net_arr_movement_usd, strongest_q2_net_movement_region, highest_top_5_concentration_region, highest_top_5_concentration_pct, top_june_revenue_country, top_june_revenue_usd, best_2025_cohort_survival_region, best_2025_cohort_survival_pct, lowest_arr_assignment_coverage_region, lowest_arr_assignment_coverage_pct, largest_current_industry, and largest_current_industry_arr_usd. Round dollars to 2 and percentages to 1.`,
    tables: ['fct_subscription_snapshot_monthly', 'dim_customer', 'fct_arr_movements', 'fct_gl_transactions', 'stg_customer_csm_assignments'],
    canonical: `WITH footprint AS (SELECT c.region, sum(s.arr_usd) AS arr FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) WHERE s.month_start = DATE '2026-06-01' GROUP BY c.region), footprint_pick AS (SELECT region, arr, 100.0 * arr / sum(arr) OVER () AS share FROM footprint ORDER BY arr DESC, region LIMIT 1), movement AS (SELECT c.region, sum(m.arr_delta_usd) AS net_movement FROM fct_arr_movements m JOIN dim_customer c USING (customer_id) WHERE m.event_date >= DATE '2026-04-01' AND m.event_date < DATE '2026-07-01' GROUP BY c.region), movement_pick AS (SELECT region, net_movement, sum(net_movement) OVER () AS company_net_movement FROM movement ORDER BY net_movement DESC, region LIMIT 1), ranked AS (SELECT c.region, c.customer_id, s.arr_usd, row_number() OVER (PARTITION BY c.region ORDER BY s.arr_usd DESC, c.customer_id) AS regional_rank, sum(s.arr_usd) OVER (PARTITION BY c.region) AS region_arr FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) WHERE s.month_start = DATE '2026-06-01'), concentration AS (SELECT region, 100.0 * sum(arr_usd) FILTER (WHERE regional_rank <= 5) / max(region_arr) AS top_5_share FROM ranked GROUP BY region), concentration_pick AS (SELECT * FROM concentration ORDER BY top_5_share DESC, region LIMIT 1), country AS (SELECT c.billing_country, sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_customer c USING (customer_id) WHERE g.txn_date >= DATE '2026-06-01' AND g.txn_date < DATE '2026-07-01' AND g.account_id IN ('4000', '4010') GROUP BY c.billing_country ORDER BY revenue DESC, c.billing_country LIMIT 1), acquired AS (SELECT m.customer_id, c.region FROM fct_arr_movements m JOIN dim_customer c USING (customer_id) WHERE m.movement_type = 'new' AND m.event_date >= DATE '2025-01-01' AND m.event_date < DATE '2026-01-01' GROUP BY m.customer_id, c.region), june AS (SELECT customer_id FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'), cohort AS (SELECT a.region, 100.0 * count(j.customer_id) / count(*) AS survival FROM acquired a LEFT JOIN june j USING (customer_id) GROUP BY a.region), cohort_pick AS (SELECT * FROM cohort ORDER BY survival DESC, region LIMIT 1), latest AS (SELECT customer_id, csm_name FROM stg_customer_csm_assignments WHERE assigned_on <= DATE '2026-06-30' QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name) = 1), coverage AS (SELECT c.region, 100.0 * coalesce(sum(s.arr_usd) FILTER (WHERE l.csm_name IS NOT NULL), 0) / sum(s.arr_usd) AS arr_coverage FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) LEFT JOIN latest l USING (customer_id) WHERE s.month_start = DATE '2026-06-01' GROUP BY c.region), coverage_pick AS (SELECT * FROM coverage ORDER BY arr_coverage, region LIMIT 1), industry AS (SELECT c.industry, sum(s.arr_usd) AS arr FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) WHERE s.month_start = DATE '2026-06-01' GROUP BY c.industry ORDER BY arr DESC, c.industry LIMIT 1) SELECT f.region AS largest_arr_region, round(f.share, 1) AS largest_arr_region_share_pct, round(m.company_net_movement, 2) AS q2_net_arr_movement_usd, m.region AS strongest_q2_net_movement_region, x.region AS highest_top_5_concentration_region, round(x.top_5_share, 1) AS highest_top_5_concentration_pct, c.billing_country AS top_june_revenue_country, round(c.revenue, 2) AS top_june_revenue_usd, h.region AS best_2025_cohort_survival_region, round(h.survival, 1) AS best_2025_cohort_survival_pct, v.region AS lowest_arr_assignment_coverage_region, round(v.arr_coverage, 1) AS lowest_arr_assignment_coverage_pct, i.industry AS largest_current_industry, round(i.arr, 2) AS largest_current_industry_arr_usd FROM footprint_pick f CROSS JOIN movement_pick m CROSS JOIN concentration_pick x CROSS JOIN country c CROSS JOIN cohort_pick h CROSS JOIN coverage_pick v CROSS JOIN industry i`,
    ordered: false,
    fingerprintSQL: `WITH footprint AS (SELECT c.region, sum(s.arr_usd) AS arr FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) WHERE s.month_start = DATE '2026-06-01' GROUP BY c.region), footprint_pick AS (SELECT region, arr, 100.0 * arr / sum(arr) OVER () AS share FROM footprint ORDER BY arr DESC, region LIMIT 1), movement AS (SELECT c.region, sum(m.arr_delta_usd) AS net_movement FROM fct_arr_movements m JOIN dim_customer c USING (customer_id) WHERE m.event_date >= DATE '2026-04-01' AND m.event_date < DATE '2026-07-01' GROUP BY c.region), movement_pick AS (SELECT region, net_movement, sum(net_movement) OVER () AS company_net_movement FROM movement ORDER BY net_movement DESC, region LIMIT 1), ranked AS (SELECT c.region, c.customer_id, s.arr_usd, row_number() OVER (PARTITION BY c.region ORDER BY s.arr_usd DESC, c.customer_id) AS regional_rank, sum(s.arr_usd) OVER (PARTITION BY c.region) AS region_arr FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) WHERE s.month_start = DATE '2026-06-01'), concentration AS (SELECT region, 100.0 * sum(arr_usd) FILTER (WHERE regional_rank <= 5) / max(region_arr) AS top_5_share FROM ranked GROUP BY region), concentration_pick AS (SELECT * FROM concentration ORDER BY top_5_share DESC, region LIMIT 1), country AS (SELECT c.billing_country, sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_customer c USING (customer_id) WHERE g.txn_date >= DATE '2026-06-01' AND g.txn_date < DATE '2026-07-01' AND g.account_id IN ('4000', '4010') GROUP BY c.billing_country ORDER BY revenue DESC, c.billing_country LIMIT 1), acquired AS (SELECT m.customer_id, c.region FROM fct_arr_movements m JOIN dim_customer c USING (customer_id) WHERE m.movement_type = 'new' AND m.event_date >= DATE '2025-01-01' AND m.event_date < DATE '2026-01-01' GROUP BY m.customer_id, c.region), june AS (SELECT customer_id FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'), cohort AS (SELECT a.region, 100.0 * count(j.customer_id) / count(*) AS survival FROM acquired a JOIN june j USING (customer_id) GROUP BY a.region), cohort_pick AS (SELECT * FROM cohort ORDER BY survival DESC, region LIMIT 1), latest AS (SELECT customer_id, csm_name FROM stg_customer_csm_assignments WHERE assigned_on <= DATE '2026-06-30' QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name) = 1), coverage AS (SELECT c.region, 100.0 * coalesce(sum(s.arr_usd) FILTER (WHERE l.csm_name IS NOT NULL), 0) / sum(s.arr_usd) AS arr_coverage FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) LEFT JOIN latest l USING (customer_id) WHERE s.month_start = DATE '2026-06-01' GROUP BY c.region), coverage_pick AS (SELECT * FROM coverage ORDER BY arr_coverage, region LIMIT 1), industry AS (SELECT c.industry, sum(s.arr_usd) AS arr FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) WHERE s.month_start = DATE '2026-06-01' GROUP BY c.industry ORDER BY arr DESC, c.industry LIMIT 1) SELECT f.region AS largest_arr_region, round(f.share, 1) AS largest_arr_region_share_pct, round(m.company_net_movement, 2) AS q2_net_arr_movement_usd, m.region AS strongest_q2_net_movement_region, x.region AS highest_top_5_concentration_region, round(x.top_5_share, 1) AS highest_top_5_concentration_pct, c.billing_country AS top_june_revenue_country, round(c.revenue, 2) AS top_june_revenue_usd, h.region AS best_2025_cohort_survival_region, round(h.survival, 1) AS best_2025_cohort_survival_pct, v.region AS lowest_arr_assignment_coverage_region, round(v.arr_coverage, 1) AS lowest_arr_assignment_coverage_pct, i.industry AS largest_current_industry, round(i.arr, 2) AS largest_current_industry_arr_usd FROM footprint_pick f CROSS JOIN movement_pick m CROSS JOIN concentration_pick x CROSS JOIN country c CROSS JOIN cohort_pick h CROSS JOIN coverage_pick v CROSS JOIN industry i`,
    fingerprintMessage: `The handoff uses an INNER JOIN for the 2025 cohort, removing every logo absent in June and turning survival into 100%. Keep the fixed acquisition cohort with a LEFT JOIN to the June snapshot.`,
    requireRegex: ASSIGNMENT_CUTOFF_REQUIREMENT,
    requireMessage: `The loaded fixture has no post-June assignment rows, so an omitted cutoff can look right today. Preserve the explicit as-of-June-30 assignment predicate (or assigned_on before July 1) so later owner changes cannot rewrite the council handoff.`,
    hints: [
      `Reduce each council control to one row: largest regional ARR, strongest regional Q2 movement plus company net, highest regional concentration, top June country, best fixed-cohort survival, lowest assignment-log ARR coverage, and largest current industry. CROSS JOIN only those one-row picks.`,
      `Preserve the 2025 acquisition cohort with LEFT JOIN June. Keep all geographic and industry labels described as current state. Use deterministic secondary sorts before every LIMIT 1.`,
      `Use the same population definitions from missions 59 through 66. The handoff should return AMER at 68.3% of ending ARR, $5.74 million of company Q2 net movement led by AMER, APAC at 24.1% top-five concentration, United States at $3.74 million June revenue, EMEA at 67.2% 2025-cohort logo survival, APAC at 95.5% assignment-log ARR coverage, and Financial Services at $8.03 million current ARR. These controls share a meeting, not one grain.`,
    ],
    sayIt: `"AMER is 68.3% of current ARR and led Q2 net movement; company net movement was $5.74 million. APAC has the highest regional top-five concentration at 24.1% and the lowest assignment-log ARR coverage at 95.5%. The United States led June revenue, EMEA had the best loaded 2025-cohort survival, and Financial Services is the largest current industry. Geography and industry are current-state labels."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm68',
    part: 14,
    title: 'Prove the plan is reviewable',
    from: 'elena',
    ask: `The midyear checkpoint starts with a control, not a variance chart. Prove exactly what is loaded for version_name = 'FY2026 Plan': its first and last months, row count, department count, account count, and total planned dollars. The loaded version ends in June, so this is an H1 checkpoint even though the source label says FY2026.`,
    deliverable: `Exactly one row: version_name, first_plan_month, last_plan_month, plan_rows, planned_departments, planned_accounts, and planned_usd. Round planned_usd to 2.`,
    tables: ['fct_budget'],
    canonical: `SELECT version_name, min(fiscal_month) AS first_plan_month, max(fiscal_month) AS last_plan_month, count(*)::BIGINT AS plan_rows, count(DISTINCT dept_name_raw)::BIGINT AS planned_departments, count(DISTINCT account_id)::BIGINT AS planned_accounts, round(sum(amount_usd), 2) AS planned_usd FROM fct_budget WHERE version_name = 'FY2026 Plan' GROUP BY version_name`,
    ordered: false,
    fingerprintSQL: `SELECT 'All loaded versions' AS version_name, min(fiscal_month) AS first_plan_month, max(fiscal_month) AS last_plan_month, count(*)::BIGINT AS plan_rows, count(DISTINCT dept_name_raw)::BIGINT AS planned_departments, count(DISTINCT account_id)::BIGINT AS planned_accounts, round(sum(amount_usd), 2) AS planned_usd FROM fct_budget`,
    fingerprintMessage: `That profile blends four plan versions and stretches the loaded window back to FY2024. Filter to FY2026 Plan before profiling the checkpoint population.`,
    hints: [
      `Filter the budget fact to one version first. MIN and MAX establish the loaded month boundary; COUNT and COUNT DISTINCT establish its row, department, and account coverage.`,
      `SELECT version_name, min(fiscal_month), max(fiscal_month), count(*), count(DISTINCT dept_name_raw), count(DISTINCT account_id), sum(amount_usd) FROM fct_budget WHERE version_name = ... GROUP BY version_name.`,
      `SELECT version_name, min(fiscal_month) AS first_plan_month, max(fiscal_month) AS last_plan_month, count(*)::BIGINT AS plan_rows, count(DISTINCT dept_name_raw)::BIGINT AS planned_departments, count(DISTINCT account_id)::BIGINT AS planned_accounts, round(sum(amount_usd), 2) AS planned_usd FROM fct_budget WHERE version_name = 'FY2026 Plan' GROUP BY version_name;\n\nThe loaded version contains January through June only. Do not infer a missing H2 forecast or annual outlook from an H1 file.`,
    ],
    sayIt: `"The loaded FY2026 Plan is an H1 file: 576 rows across January through June, 19 departments, and 20 accounts. I would scope every checkpoint conclusion to that loaded boundary."`,
    jdCompanies: ['Cockroach Labs'],
  },
  {
    id: 'm69',
    part: 14,
    title: 'Build the H1 plan bridge',
    from: 'priya',
    ask: `Now compare H1 actuals with the loaded FY2026 Plan across Revenue, COGS, and Opex. Keep raw actual-minus-plan variance and a separate favorable variance: revenue above plan is favorable, while COGS or Opex above plan is unfavorable.`,
    deliverable: `Three rows: pl_line, actual_usd, plan_usd, raw_variance_usd, and favorable_variance_usd. Round dollars to 2; order Revenue, COGS, Opex.`,
    tables: ['fct_gl_transactions', 'fct_budget', 'dim_account'],
    canonical: `WITH actual AS (SELECT CASE WHEN a.account_type = 'Revenue' THEN 'Revenue' WHEN a.account_type = 'COGS' THEN 'COGS' ELSE 'Opex' END AS pl_line, sum(g.amount) AS actual FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.is_pl AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1), plan AS (SELECT CASE WHEN a.account_type = 'Revenue' THEN 'Revenue' WHEN a.account_type = 'COGS' THEN 'COGS' ELSE 'Opex' END AS pl_line, sum(b.amount_usd) AS plan FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' GROUP BY 1) SELECT a.pl_line, round(a.actual, 2) AS actual_usd, round(p.plan, 2) AS plan_usd, round(a.actual - p.plan, 2) AS raw_variance_usd, round(CASE WHEN a.pl_line = 'Revenue' THEN a.actual - p.plan ELSE p.plan - a.actual END, 2) AS favorable_variance_usd FROM actual a JOIN plan p USING (pl_line) ORDER BY CASE a.pl_line WHEN 'Revenue' THEN 1 WHEN 'COGS' THEN 2 ELSE 3 END`,
    ordered: true,
    orderedNote: 'Revenue, COGS, then Opex',
    fingerprintSQL: `WITH actual AS (SELECT CASE WHEN a.account_type = 'Revenue' THEN 'Revenue' WHEN a.account_type = 'COGS' THEN 'COGS' ELSE 'Opex' END AS pl_line, sum(g.amount) AS actual FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.is_pl AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1), plan AS (SELECT CASE WHEN a.account_type = 'Revenue' THEN 'Revenue' WHEN a.account_type = 'COGS' THEN 'COGS' ELSE 'Opex' END AS pl_line, sum(b.amount_usd) AS plan FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' GROUP BY 1) SELECT a.pl_line, round(a.actual, 2) AS actual_usd, round(p.plan, 2) AS plan_usd, round(a.actual - p.plan, 2) AS raw_variance_usd, round(a.actual - p.plan, 2) AS favorable_variance_usd FROM actual a JOIN plan p USING (pl_line) ORDER BY CASE a.pl_line WHEN 'Revenue' THEN 1 WHEN 'COGS' THEN 2 ELSE 3 END`,
    fingerprintMessage: `Actual minus plan is a useful raw variance, but it reverses business meaning between revenue and expense. For favorable variance, keep revenue as actual minus plan and flip COGS and Opex to plan minus actual.`,
    hints: [
      `Aggregate actual and plan separately to the same three P&L lines. Keep actual-minus-plan as the raw control, then use CASE to normalize favorable direction.`,
      `Revenue favorable = actual - plan. COGS/Opex favorable = plan - actual. The account dimension supplies account_type and is_pl.`,
      `WITH actual AS (SELECT CASE WHEN a.account_type = 'Revenue' THEN 'Revenue' WHEN a.account_type = 'COGS' THEN 'COGS' ELSE 'Opex' END AS pl_line, sum(g.amount) AS actual FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.is_pl AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1), plan AS (SELECT CASE WHEN a.account_type = 'Revenue' THEN 'Revenue' WHEN a.account_type = 'COGS' THEN 'COGS' ELSE 'Opex' END AS pl_line, sum(b.amount_usd) AS plan FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' GROUP BY 1) SELECT a.pl_line, round(a.actual, 2) AS actual_usd, round(p.plan, 2) AS plan_usd, round(a.actual - p.plan, 2) AS raw_variance_usd, round(CASE WHEN a.pl_line = 'Revenue' THEN a.actual - p.plan ELSE p.plan - a.actual END, 2) AS favorable_variance_usd FROM actual a JOIN plan p USING (pl_line) ORDER BY CASE a.pl_line WHEN 'Revenue' THEN 1 WHEN 'COGS' THEN 2 ELSE 3 END;`,
    ],
    sayIt: `"H1 revenue was $1.31 million above plan, but COGS was $78 thousand over and Opex was $2.15 million over. Normalizing the signs makes the expense misses visibly unfavorable instead of calling every positive raw variance good."`,
    jdCompanies: ['Harvey'],
  },
  {
    id: 'm70',
    part: 14,
    title: 'Trace monthly revenue attainment',
    from: 'priya',
    ask: `Show whether the H1 revenue beat is broad or carried by one month. Compare monthly recognized revenue actuals with the loaded plan, including every Revenue-typed account through dim_account.`,
    deliverable: `Six rows: month, actual_revenue_usd, plan_revenue_usd, variance_usd, and attainment_pct. Round dollars to 2 and percentage to 1; order January through June.`,
    tables: ['fct_gl_transactions', 'fct_budget', 'dim_account'],
    canonical: `WITH actual AS (SELECT date_trunc('month', g.txn_date)::DATE AS month, sum(g.amount) AS actual_revenue FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1), plan AS (SELECT fiscal_month AS month, sum(amount_usd) AS plan_revenue FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Revenue' GROUP BY 1) SELECT a.month, round(a.actual_revenue, 2) AS actual_revenue_usd, round(p.plan_revenue, 2) AS plan_revenue_usd, round(a.actual_revenue - p.plan_revenue, 2) AS variance_usd, round(100.0 * a.actual_revenue / p.plan_revenue, 1) AS attainment_pct FROM actual a JOIN plan p USING (month) ORDER BY month`,
    ordered: true,
    orderedNote: 'January through June',
    fingerprintSQL: `WITH actual AS (SELECT date_trunc('month', g.txn_date)::DATE AS month, sum(g.amount) AS actual_revenue FROM fct_gl_transactions g WHERE g.account_id = '4000' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1), plan AS (SELECT fiscal_month AS month, sum(amount_usd) AS plan_revenue FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Revenue' GROUP BY 1) SELECT a.month, round(a.actual_revenue, 2) AS actual_revenue_usd, round(p.plan_revenue, 2) AS plan_revenue_usd, round(a.actual_revenue - p.plan_revenue, 2) AS variance_usd, round(100.0 * a.actual_revenue / p.plan_revenue, 1) AS attainment_pct FROM actual a JOIN plan p USING (month) ORDER BY month`,
    fingerprintMessage: `The actual side includes subscription account 4000 but drops usage account 4010, while the plan includes every Revenue-typed account. Classify actuals through dim_account so the populations match.`,
    hints: [
      `Build one monthly actual CTE and one monthly plan CTE. Use account_type = 'Revenue' on both sides, then join the six month rows.`,
      `Actual month = date_trunc('month', txn_date); plan month = fiscal_month. Attainment is 100 × actual / plan.`,
      `WITH actual AS (SELECT date_trunc('month', g.txn_date)::DATE AS month, sum(g.amount) AS actual_revenue FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1), plan AS (SELECT fiscal_month AS month, sum(amount_usd) AS plan_revenue FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Revenue' GROUP BY 1) SELECT a.month, round(a.actual_revenue, 2) AS actual_revenue_usd, round(p.plan_revenue, 2) AS plan_revenue_usd, round(a.actual_revenue - p.plan_revenue, 2) AS variance_usd, round(100.0 * a.actual_revenue / p.plan_revenue, 1) AS attainment_pct FROM actual a JOIN plan p USING (month) ORDER BY month;`,
    ],
    sayIt: `"Recognized revenue beat plan in all six loaded months, with attainment between 103.2% and 103.4%. The beat is broad across H1 rather than a one-month spike."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm71',
    part: 14,
    title: 'Test gross-margin attainment',
    from: 'danny',
    ask: `Revenue is ahead, but did gross margin clear plan? Compare actual and planned gross margin by month. Both use (Revenue - COGS) / Revenue, and variance is actual minus plan in percentage points.`,
    deliverable: `Six rows: month, actual_gross_margin_pct, plan_gross_margin_pct, and variance_pp. Round all percentages to 1; order January through June.`,
    tables: ['fct_gl_transactions', 'fct_budget', 'dim_account'],
    canonical: `WITH actual AS (SELECT date_trunc('month', g.txn_date)::DATE AS month, sum(g.amount) FILTER (WHERE a.account_type = 'Revenue') AS revenue, sum(g.amount) FILTER (WHERE a.account_type = 'COGS') AS cogs FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type IN ('Revenue', 'COGS') AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1), plan AS (SELECT fiscal_month AS month, sum(amount_usd) FILTER (WHERE a.account_type = 'Revenue') AS revenue, sum(amount_usd) FILTER (WHERE a.account_type = 'COGS') AS cogs FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' AND a.account_type IN ('Revenue', 'COGS') GROUP BY 1) SELECT a.month, round(100.0 * (a.revenue - a.cogs) / a.revenue, 1) AS actual_gross_margin_pct, round(100.0 * (p.revenue - p.cogs) / p.revenue, 1) AS plan_gross_margin_pct, round(100.0 * (a.revenue - a.cogs) / a.revenue - 100.0 * (p.revenue - p.cogs) / p.revenue, 1) AS variance_pp FROM actual a JOIN plan p USING (month) ORDER BY month`,
    ordered: true,
    orderedNote: 'January through June',
    fingerprintSQL: `WITH actual AS (SELECT date_trunc('month', g.txn_date)::DATE AS month, sum(g.amount) FILTER (WHERE a.account_type = 'Revenue') AS revenue, sum(g.amount) FILTER (WHERE a.account_type = 'COGS') AS cogs FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type IN ('Revenue', 'COGS') AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1), plan AS (SELECT fiscal_month AS month, sum(amount_usd) FILTER (WHERE a.account_type = 'Revenue') AS revenue, sum(amount_usd) FILTER (WHERE a.account_type = 'COGS') AS cogs FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' AND a.account_type IN ('Revenue', 'COGS') GROUP BY 1) SELECT a.month, round(100.0 * (a.revenue - a.cogs) / a.revenue, 1) AS actual_gross_margin_pct, round(100.0 * (p.revenue - p.cogs) / p.cogs, 1) AS plan_gross_margin_pct, round(100.0 * (a.revenue - a.cogs) / a.revenue - 100.0 * (p.revenue - p.cogs) / p.cogs, 1) AS variance_pp FROM actual a JOIN plan p USING (month) ORDER BY month`,
    fingerprintMessage: `The planned margin divides gross profit by COGS. Gross margin always uses Revenue as the denominator on both actual and plan.`,
    hints: [
      `Within each month, conditionally sum Revenue and COGS for actual and plan. Compute each margin before taking the percentage-point difference.`,
      `gross margin = 100 × (revenue - cogs) / revenue; variance_pp = actual margin - plan margin.`,
      `WITH actual AS (SELECT date_trunc('month', g.txn_date)::DATE AS month, sum(g.amount) FILTER (WHERE a.account_type = 'Revenue') AS revenue, sum(g.amount) FILTER (WHERE a.account_type = 'COGS') AS cogs FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type IN ('Revenue', 'COGS') AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1), plan AS (SELECT fiscal_month AS month, sum(amount_usd) FILTER (WHERE a.account_type = 'Revenue') AS revenue, sum(amount_usd) FILTER (WHERE a.account_type = 'COGS') AS cogs FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' AND a.account_type IN ('Revenue', 'COGS') GROUP BY 1) SELECT a.month, round(100.0 * (a.revenue - a.cogs) / a.revenue, 1) AS actual_gross_margin_pct, round(100.0 * (p.revenue - p.cogs) / p.revenue, 1) AS plan_gross_margin_pct, round(100.0 * (a.revenue - a.cogs) / a.revenue - 100.0 * (p.revenue - p.cogs) / p.revenue, 1) AS variance_pp FROM actual a JOIN plan p USING (month) ORDER BY month;`,
    ],
    sayIt: `"H1 gross margin finished at 62.1% against 61.1% planned. January missed by 1.4 points, while February through June each cleared plan by roughly 1.4 to 1.7 points."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm72',
    part: 14,
    title: 'Locate the division spend miss',
    from: 'priya',
    ask: `Reconcile H1 Opex actuals to plan by department division. Actual Opex means every GL source whose account_type is Opex, not payroll alone. Note that division = 'COGS' is an org-chart rollup for departments; these rows are still Opex accounts.`,
    deliverable: `Four rows: division, actual_opex_usd, plan_opex_usd, variance_usd, and spend_attainment_pct. Round dollars to 2 and percentage to 1; order highest overspend first.`,
    tables: ['fct_gl_transactions', 'fct_budget', 'dim_account', 'dim_department'],
    canonical: `WITH actual AS (SELECT d.division, sum(g.amount) AS actual_opex FROM fct_gl_transactions g JOIN dim_account a USING (account_id) JOIN dim_department d USING (dept_id) WHERE a.account_type = 'Opex' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY d.division), plan AS (SELECT d.division, sum(b.amount_usd) AS plan_opex FROM fct_budget b JOIN dim_account a USING (account_id) JOIN dim_department d ON b.dept_name_raw = d.dept_name WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Opex' GROUP BY d.division) SELECT a.division, round(a.actual_opex, 2) AS actual_opex_usd, round(p.plan_opex, 2) AS plan_opex_usd, round(a.actual_opex - p.plan_opex, 2) AS variance_usd, round(100.0 * a.actual_opex / p.plan_opex, 1) AS spend_attainment_pct FROM actual a JOIN plan p USING (division) ORDER BY variance_usd DESC, division`,
    ordered: true,
    orderedNote: 'highest Opex overspend first, then division',
    fingerprintSQL: `WITH actual AS (SELECT d.division, sum(g.amount) AS actual_opex FROM fct_gl_transactions g JOIN dim_account a USING (account_id) JOIN dim_department d USING (dept_id) WHERE a.account_type = 'Opex' AND g.source_system = 'Payroll' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY d.division), plan AS (SELECT d.division, sum(b.amount_usd) AS plan_opex FROM fct_budget b JOIN dim_account a USING (account_id) JOIN dim_department d ON b.dept_name_raw = d.dept_name WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Opex' GROUP BY d.division) SELECT a.division, round(a.actual_opex, 2) AS actual_opex_usd, round(p.plan_opex, 2) AS plan_opex_usd, round(a.actual_opex - p.plan_opex, 2) AS variance_usd, round(100.0 * a.actual_opex / p.plan_opex, 1) AS spend_attainment_pct FROM actual a JOIN plan p USING (division) ORDER BY variance_usd DESC, division`,
    fingerprintMessage: `That actual population keeps Payroll only, dropping software, marketing, facilities, travel, and every other Opex source. Filter by Opex account type, not one source system.`,
    hints: [
      `Aggregate actuals by dim_department.division after filtering dim_account to Opex. Aggregate FY2026 Plan the same way by mapping its clean department names to dim_department.`,
      `Actuals need every source system. The plan joins dept_name_raw to dept_name for this clean FY2026 version.`,
      `WITH actual AS (SELECT d.division, sum(g.amount) AS actual_opex FROM fct_gl_transactions g JOIN dim_account a USING (account_id) JOIN dim_department d USING (dept_id) WHERE a.account_type = 'Opex' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY d.division), plan AS (SELECT d.division, sum(b.amount_usd) AS plan_opex FROM fct_budget b JOIN dim_account a USING (account_id) JOIN dim_department d ON b.dept_name_raw = d.dept_name WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Opex' GROUP BY d.division) SELECT a.division, round(a.actual_opex, 2) AS actual_opex_usd, round(p.plan_opex, 2) AS plan_opex_usd, round(a.actual_opex - p.plan_opex, 2) AS variance_usd, round(100.0 * a.actual_opex / p.plan_opex, 1) AS spend_attainment_pct FROM actual a JOIN plan p USING (division) ORDER BY variance_usd DESC, division;`,
    ],
    sayIt: `"R&D is $1.18 million over plan and S&M is $914 thousand over; together they explain nearly all of the $2.15 million H1 Opex miss. The COGS division row here is an org rollup of Opex accounts, not P&L COGS."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm73',
    part: 14,
    title: 'Rank the account drivers',
    from: 'elena',
    ask: `Move from org ownership to accounting cause. Rank the ten Opex accounts with the largest absolute H1 variance so an underspend can outrank a smaller overspend. Preserve accounts that appear on only one side of the control.`,
    deliverable: `Ten rows: account_id, account_name, actual_usd, plan_usd, variance_usd, and variance_direction. Direction is Overspend when actual exceeds plan, otherwise Underspend. Round dollars to 2; sort largest absolute variance first, then account_id.`,
    tables: ['fct_gl_transactions', 'fct_budget', 'dim_account'],
    canonical: `WITH actual AS (SELECT account_id, sum(amount) AS actual FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Opex' AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY account_id), plan AS (SELECT b.account_id, sum(amount_usd) AS plan FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Opex' GROUP BY b.account_id), compared AS (SELECT coalesce(x.account_id, p.account_id) AS account_id, coalesce(x.actual, 0) AS actual, coalesce(p.plan, 0) AS plan FROM actual x FULL OUTER JOIN plan p USING (account_id)) SELECT c.account_id, a.account_name, round(c.actual, 2) AS actual_usd, round(c.plan, 2) AS plan_usd, round(c.actual - c.plan, 2) AS variance_usd, CASE WHEN c.actual > c.plan THEN 'Overspend' ELSE 'Underspend' END AS variance_direction FROM compared c JOIN dim_account a USING (account_id) ORDER BY abs(variance_usd) DESC, c.account_id LIMIT 10`,
    ordered: true,
    orderedNote: 'largest absolute variance first, then account id',
    fingerprintSQL: `WITH actual AS (SELECT account_id, sum(amount) AS actual FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Opex' AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY account_id), plan AS (SELECT b.account_id, sum(amount_usd) AS plan FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Opex' GROUP BY b.account_id), compared AS (SELECT coalesce(x.account_id, p.account_id) AS account_id, coalesce(x.actual, 0) AS actual, coalesce(p.plan, 0) AS plan FROM actual x FULL OUTER JOIN plan p USING (account_id)) SELECT c.account_id, a.account_name, round(c.actual, 2) AS actual_usd, round(c.plan, 2) AS plan_usd, round(c.actual - c.plan, 2) AS variance_usd, CASE WHEN c.actual > c.plan THEN 'Overspend' ELSE 'Underspend' END AS variance_direction FROM compared c JOIN dim_account a USING (account_id) ORDER BY variance_usd DESC, c.account_id LIMIT 10`,
    fingerprintMessage: `Sorting signed variance descending hides the largest underruns. Rank by absolute variance so Office & Facilities appears beside the larger overspend drivers.`,
    requireRegex: String.raw`full\s+(?:outer\s+)?join`,
    requireMessage: `The frozen H1 fixture currently has the same 14 Opex accounts on actual and plan, so an INNER JOIN happens to match. Keep the FULL OUTER JOIN so one-sided accounts remain visible when the next plan or actual load changes.`,
    hints: [
      `Aggregate actual and plan to account first, then FULL OUTER JOIN the two sets. Rank the compared rows by ABS(actual - plan).`,
      `COALESCE keeps a one-sided account at zero on the missing side. Direction comes from actual > plan after the join.`,
      `WITH actual AS (SELECT account_id, sum(amount) AS actual FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Opex' AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY account_id), plan AS (SELECT b.account_id, sum(amount_usd) AS plan FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Opex' GROUP BY b.account_id), compared AS (SELECT coalesce(x.account_id, p.account_id) AS account_id, coalesce(x.actual, 0) AS actual, coalesce(p.plan, 0) AS plan FROM actual x FULL OUTER JOIN plan p USING (account_id)) SELECT c.account_id, a.account_name, round(c.actual, 2) AS actual_usd, round(c.plan, 2) AS plan_usd, round(c.actual - c.plan, 2) AS variance_usd, CASE WHEN c.actual > c.plan THEN 'Overspend' ELSE 'Underspend' END AS variance_direction FROM compared c JOIN dim_account a USING (account_id) ORDER BY abs(variance_usd) DESC, c.account_id LIMIT 10;`,
    ],
    sayIt: `"Salaries and wages is the largest account miss at $1.88 million over plan. Office and facilities is the second-largest absolute driver at $852 thousand under, so an absolute ranking keeps that offset visible."`,
    jdCompanies: ['Harvey'],
  },
  {
    id: 'm74',
    part: 14,
    title: 'Measure department miss concentration',
    from: 'priya',
    ask: `How concentrated is the Opex overspend? At department grain, set underspends to zero, rank positive misses, and divide the five largest department overspends by total department overspend. Do not net underruns into this concentration denominator.`,
    deliverable: `Exactly one row: top_5_overspend_usd, total_overspend_usd, top_5_overspend_concentration_pct, and overspending_departments. Round dollars to 2 and percentage to 1.`,
    tables: ['fct_gl_transactions', 'fct_budget', 'dim_account', 'dim_department'],
    canonical: `WITH actual AS (SELECT d.dept_name, sum(g.amount) AS actual FROM fct_gl_transactions g JOIN dim_account a USING (account_id) JOIN dim_department d USING (dept_id) WHERE a.account_type = 'Opex' AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY d.dept_name), plan AS (SELECT b.dept_name_raw AS dept_name, sum(amount_usd) AS plan FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Opex' GROUP BY b.dept_name_raw), compared AS (SELECT a.dept_name, greatest(a.actual - p.plan, 0) AS overspend FROM actual a JOIN plan p USING (dept_name)), ranked AS (SELECT dept_name, overspend, row_number() OVER (ORDER BY overspend DESC, dept_name) AS rnk, sum(overspend) OVER () AS total_overspend, count(*) FILTER (WHERE overspend > 0) OVER () AS overspending_departments FROM compared) SELECT round(sum(overspend) FILTER (WHERE rnk <= 5), 2) AS top_5_overspend_usd, round(max(total_overspend), 2) AS total_overspend_usd, round(100.0 * sum(overspend) FILTER (WHERE rnk <= 5) / max(total_overspend), 1) AS top_5_overspend_concentration_pct, max(overspending_departments)::BIGINT AS overspending_departments FROM ranked`,
    ordered: false,
    fingerprintSQL: `WITH actual AS (SELECT d.dept_name, sum(g.amount) AS actual FROM fct_gl_transactions g JOIN dim_account a USING (account_id) JOIN dim_department d USING (dept_id) WHERE a.account_type = 'Opex' AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY d.dept_name), plan AS (SELECT b.dept_name_raw AS dept_name, sum(amount_usd) AS plan FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Opex' GROUP BY b.dept_name_raw), compared AS (SELECT a.dept_name, p.plan, greatest(a.actual - p.plan, 0) AS overspend FROM actual a JOIN plan p USING (dept_name)), ranked AS (SELECT dept_name, plan, overspend, row_number() OVER (ORDER BY overspend DESC, dept_name) AS rnk, sum(overspend) OVER () AS total_overspend, sum(plan) OVER () AS total_plan, count(*) FILTER (WHERE overspend > 0) OVER () AS overspending_departments FROM compared) SELECT round(sum(overspend) FILTER (WHERE rnk <= 5), 2) AS top_5_overspend_usd, round(max(total_overspend), 2) AS total_overspend_usd, round(100.0 * sum(overspend) FILTER (WHERE rnk <= 5) / max(total_plan), 1) AS top_5_overspend_concentration_pct, max(overspending_departments)::BIGINT AS overspending_departments FROM ranked`,
    fingerprintMessage: `That percentage divides the top-five misses by total planned Opex, which measures budget share rather than miss concentration. Use total positive department overspend as the denominator.`,
    hints: [
      `Compare actual and plan at department grain. GREATEST(actual - plan, 0) isolates positive misses; a window can rank them and carry the total denominator.`,
      `Top-five concentration = sum positive overspend for ranks 1–5 / sum positive overspend for all departments. Underspends do not offset this denominator.`,
      `WITH actual AS (SELECT d.dept_name, sum(g.amount) AS actual FROM fct_gl_transactions g JOIN dim_account a USING (account_id) JOIN dim_department d USING (dept_id) WHERE a.account_type = 'Opex' AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY d.dept_name), plan AS (SELECT b.dept_name_raw AS dept_name, sum(amount_usd) AS plan FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Opex' GROUP BY b.dept_name_raw), compared AS (SELECT a.dept_name, greatest(a.actual - p.plan, 0) AS overspend FROM actual a JOIN plan p USING (dept_name)), ranked AS (SELECT dept_name, overspend, row_number() OVER (ORDER BY overspend DESC, dept_name) AS rnk, sum(overspend) OVER () AS total_overspend, count(*) FILTER (WHERE overspend > 0) OVER () AS overspending_departments FROM compared) SELECT round(sum(overspend) FILTER (WHERE rnk <= 5), 2) AS top_5_overspend_usd, round(max(total_overspend), 2) AS total_overspend_usd, round(100.0 * sum(overspend) FILTER (WHERE rnk <= 5) / max(total_overspend), 1) AS top_5_overspend_concentration_pct, max(overspending_departments)::BIGINT AS overspending_departments FROM ranked;`,
    ],
    sayIt: `"Thirteen departments are over plan, with $3.62 million of gross overspend before underruns. The five largest misses contribute $2.66 million, or 73.4%, so the review can stay focused without hiding the offsets."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm75',
    part: 14,
    title: 'Show how the Opex gap accumulated',
    from: 'priya',
    ask: `The H1 miss is a stock at June. Show its monthly flow and cumulative build: monthly actual, plan, and variance, plus cumulative actual, plan, and variance from January through each month. This is historical pacing through the loaded H1 file, not an H2 forecast.`,
    deliverable: `Six rows: month, actual_opex_usd, plan_opex_usd, monthly_variance_usd, cumulative_actual_opex_usd, cumulative_plan_opex_usd, and cumulative_variance_usd. Round dollars to 2; order January through June.`,
    tables: ['fct_gl_transactions', 'fct_budget', 'dim_account'],
    canonical: `WITH actual AS (SELECT date_trunc('month', txn_date)::DATE AS month, sum(amount) AS actual FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Opex' AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY 1), plan AS (SELECT fiscal_month AS month, sum(amount_usd) AS plan FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Opex' GROUP BY 1), monthly AS (SELECT a.month, a.actual, p.plan, a.actual - p.plan AS variance FROM actual a JOIN plan p USING (month)) SELECT month, round(actual, 2) AS actual_opex_usd, round(plan, 2) AS plan_opex_usd, round(variance, 2) AS monthly_variance_usd, round(sum(actual) OVER (ORDER BY month), 2) AS cumulative_actual_opex_usd, round(sum(plan) OVER (ORDER BY month), 2) AS cumulative_plan_opex_usd, round(sum(variance) OVER (ORDER BY month), 2) AS cumulative_variance_usd FROM monthly ORDER BY month`,
    ordered: true,
    orderedNote: 'January through June',
    fingerprintSQL: `WITH actual AS (SELECT date_trunc('month', txn_date)::DATE AS month, sum(amount) AS actual FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Opex' AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY 1), plan AS (SELECT fiscal_month AS month, sum(amount_usd) AS plan FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Opex' GROUP BY 1), monthly AS (SELECT a.month, a.actual, p.plan, a.actual - p.plan AS variance FROM actual a JOIN plan p USING (month)) SELECT month, round(actual, 2) AS actual_opex_usd, round(plan, 2) AS plan_opex_usd, round(variance, 2) AS monthly_variance_usd, round(actual, 2) AS cumulative_actual_opex_usd, round(plan, 2) AS cumulative_plan_opex_usd, round(variance, 2) AS cumulative_variance_usd FROM monthly ORDER BY month`,
    fingerprintMessage: `The three cumulative columns repeat each month's values, so the June row does not tie to the H1 control. Use ordered window sums from January through the current row.`,
    hints: [
      `First build one row per month with actual, plan, and monthly variance. Then apply SUM(...) OVER (ORDER BY month) to each cumulative column.`,
      `The default ordered window is cumulative here because month is unique. Keep monthly and cumulative measures side by side.`,
      `WITH actual AS (SELECT date_trunc('month', txn_date)::DATE AS month, sum(amount) AS actual FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Opex' AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY 1), plan AS (SELECT fiscal_month AS month, sum(amount_usd) AS plan FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Opex' GROUP BY 1), monthly AS (SELECT a.month, a.actual, p.plan, a.actual - p.plan AS variance FROM actual a JOIN plan p USING (month)) SELECT month, round(actual, 2) AS actual_opex_usd, round(plan, 2) AS plan_opex_usd, round(variance, 2) AS monthly_variance_usd, round(sum(actual) OVER (ORDER BY month), 2) AS cumulative_actual_opex_usd, round(sum(plan) OVER (ORDER BY month), 2) AS cumulative_plan_opex_usd, round(sum(variance) OVER (ORDER BY month), 2) AS cumulative_variance_usd FROM monthly ORDER BY month;\n\nThis is an H1 historical control. The loaded plan has no July–December rows, so it cannot support an H2 outlook.`,
    ],
    sayIt: `"Opex ran over plan in every loaded month, and the cumulative gap widened from $160 thousand in January to $2.15 million by June. That is H1 pacing evidence, not a forecast beyond the loaded file."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm76',
    part: 14,
    title: 'Route the department owners',
    from: 'elena',
    ask: `Turn the department control into a review queue. Rank the ten largest H1 Opex overspends, attach the department leader from the org chart, and show both dollar and percentage variance.`,
    deliverable: `Ten rows: leader_name, dept_name, actual_opex_usd, plan_opex_usd, variance_usd, and variance_pct. Round dollars to 2 and percentage to 1; order largest overspend first, then department.`,
    tables: ['fct_gl_transactions', 'fct_budget', 'dim_account', 'dim_department'],
    canonical: `WITH actual AS (SELECT d.dept_name, sum(g.amount) AS actual FROM fct_gl_transactions g JOIN dim_account a USING (account_id) JOIN dim_department d USING (dept_id) WHERE a.account_type = 'Opex' AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY d.dept_name), plan AS (SELECT b.dept_name_raw AS dept_name, sum(amount_usd) AS plan FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Opex' GROUP BY b.dept_name_raw) SELECT d.leader_name, a.dept_name, round(a.actual, 2) AS actual_opex_usd, round(p.plan, 2) AS plan_opex_usd, round(a.actual - p.plan, 2) AS variance_usd, round(100.0 * (a.actual - p.plan) / p.plan, 1) AS variance_pct FROM actual a JOIN plan p USING (dept_name) JOIN dim_department d USING (dept_name) ORDER BY variance_usd DESC, a.dept_name LIMIT 10`,
    ordered: true,
    orderedNote: 'largest overspend first, then department',
    fingerprintSQL: `WITH actual AS (SELECT d.dept_name, sum(g.amount) AS actual FROM fct_gl_transactions g JOIN dim_account a USING (account_id) JOIN dim_department d USING (dept_id) WHERE a.account_type = 'Opex' AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY d.dept_name), plan AS (SELECT b.dept_name_raw AS dept_name, sum(amount_usd) AS plan FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Opex' GROUP BY b.dept_name_raw) SELECT d.leader_name, a.dept_name, round(a.actual, 2) AS actual_opex_usd, round(p.plan, 2) AS plan_opex_usd, round(p.plan - a.actual, 2) AS variance_usd, round(100.0 * (p.plan - a.actual) / p.plan, 1) AS variance_pct FROM actual a JOIN plan p USING (dept_name) JOIN dim_department d USING (dept_name) ORDER BY variance_usd DESC, a.dept_name LIMIT 10`,
    fingerprintMessage: `The variance is reversed, so the queue promotes the largest underspends instead of the largest overspends. For this routing view use actual minus plan.`,
    hints: [
      `Reuse the department-grain actual and plan CTEs, then join the clean department name to dim_department for leader_name.`,
      `Variance = actual - plan; variance_pct = 100 × variance / plan. Sort the signed overspend descending before LIMIT 10.`,
      `WITH actual AS (SELECT d.dept_name, sum(g.amount) AS actual FROM fct_gl_transactions g JOIN dim_account a USING (account_id) JOIN dim_department d USING (dept_id) WHERE a.account_type = 'Opex' AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY d.dept_name), plan AS (SELECT b.dept_name_raw AS dept_name, sum(amount_usd) AS plan FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Opex' GROUP BY b.dept_name_raw) SELECT d.leader_name, a.dept_name, round(a.actual, 2) AS actual_opex_usd, round(p.plan, 2) AS plan_opex_usd, round(a.actual - p.plan, 2) AS variance_usd, round(100.0 * (a.actual - p.plan) / p.plan, 1) AS variance_pct FROM actual a JOIN plan p USING (dept_name) JOIN dim_department d USING (dept_name) ORDER BY variance_usd DESC, a.dept_name LIMIT 10;`,
    ],
    sayIt: `"Engineering is the largest department miss at $814 thousand over plan, followed by Enterprise Sales at $707 thousand and Platform Infrastructure at $416 thousand. The queue names the loaded org-chart leaders for review routing, not blame."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm77',
    part: 14,
    title: 'Package the midyear plan checkpoint',
    from: 'priya',
    ask: `Package the loaded H1 checkpoint in one row: revenue attainment, actual and planned gross margin, operating-result variance, the largest division and account Opex drivers, department miss concentration, and the largest department owner. Operating result is Revenue minus COGS minus Opex. Keep the handoff scoped to January through June; there is no loaded H2 plan.`,
    deliverable: `Exactly one row: h1_revenue_attainment_pct, actual_gross_margin_pct, plan_gross_margin_pct, operating_result_variance_usd, largest_opex_overspend_division, largest_division_variance_usd, largest_absolute_opex_variance_account, largest_account_variance_usd, top_5_department_overspend_concentration_pct, largest_overspend_department, accountable_leader, and largest_department_variance_usd. Round dollars to 2 and percentages to 1.`,
    tables: ['fct_gl_transactions', 'fct_budget', 'dim_account', 'dim_department'],
    canonical: `WITH actual AS (SELECT CASE WHEN a.account_type = 'Revenue' THEN 'Revenue' WHEN a.account_type = 'COGS' THEN 'COGS' ELSE 'Opex' END AS line, sum(g.amount) AS amount FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.is_pl AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY 1), plan AS (SELECT CASE WHEN a.account_type = 'Revenue' THEN 'Revenue' WHEN a.account_type = 'COGS' THEN 'COGS' ELSE 'Opex' END AS line, sum(b.amount_usd) AS amount FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' GROUP BY 1), p AS (SELECT max(amount) FILTER (WHERE line = 'Revenue') AS revenue, max(amount) FILTER (WHERE line = 'COGS') AS cogs, max(amount) FILTER (WHERE line = 'Opex') AS opex FROM plan), x AS (SELECT max(amount) FILTER (WHERE line = 'Revenue') AS revenue, max(amount) FILTER (WHERE line = 'COGS') AS cogs, max(amount) FILTER (WHERE line = 'Opex') AS opex FROM actual), div_actual AS (SELECT d.division, sum(g.amount) AS actual FROM fct_gl_transactions g JOIN dim_account a USING (account_id) JOIN dim_department d USING (dept_id) WHERE a.account_type = 'Opex' AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY d.division), div_plan AS (SELECT d.division, sum(b.amount_usd) AS plan FROM fct_budget b JOIN dim_account a USING (account_id) JOIN dim_department d ON b.dept_name_raw = d.dept_name WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Opex' GROUP BY d.division), div_pick AS (SELECT a.division, a.actual - p.plan AS variance FROM div_actual a JOIN div_plan p USING (division) ORDER BY variance DESC, division LIMIT 1), acct_actual AS (SELECT account_id, sum(amount) AS actual FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Opex' AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY account_id), acct_plan AS (SELECT b.account_id, sum(amount_usd) AS plan FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Opex' GROUP BY b.account_id), acct_pick AS (SELECT coalesce(a.account_id, p.account_id) AS account_id, coalesce(a.actual, 0) - coalesce(p.plan, 0) AS variance FROM acct_actual a FULL OUTER JOIN acct_plan p USING (account_id) ORDER BY abs(variance) DESC, account_id LIMIT 1), dept_actual AS (SELECT d.dept_name, sum(g.amount) AS actual FROM fct_gl_transactions g JOIN dim_account a USING (account_id) JOIN dim_department d USING (dept_id) WHERE a.account_type = 'Opex' AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY d.dept_name), dept_plan AS (SELECT b.dept_name_raw AS dept_name, sum(amount_usd) AS plan FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Opex' GROUP BY b.dept_name_raw), dept_comp AS (SELECT a.dept_name, a.actual - p.plan AS variance, greatest(a.actual - p.plan, 0) AS overspend FROM dept_actual a JOIN dept_plan p USING (dept_name)), dept_pick AS (SELECT c.dept_name, d.leader_name, c.variance FROM dept_comp c JOIN dim_department d USING (dept_name) ORDER BY c.variance DESC, c.dept_name LIMIT 1), conc AS (SELECT 100.0 * sum(overspend) FILTER (WHERE rnk <= 5) / sum(overspend) AS share FROM (SELECT overspend, row_number() OVER (ORDER BY overspend DESC, dept_name) AS rnk FROM dept_comp)) SELECT round(100.0 * x.revenue / p.revenue, 1) AS h1_revenue_attainment_pct, round(100.0 * (x.revenue - x.cogs) / x.revenue, 1) AS actual_gross_margin_pct, round(100.0 * (p.revenue - p.cogs) / p.revenue, 1) AS plan_gross_margin_pct, round((x.revenue - x.cogs - x.opex) - (p.revenue - p.cogs - p.opex), 2) AS operating_result_variance_usd, dv.division AS largest_opex_overspend_division, round(dv.variance, 2) AS largest_division_variance_usd, ap.account_id AS largest_absolute_opex_variance_account, round(ap.variance, 2) AS largest_account_variance_usd, round(c.share, 1) AS top_5_department_overspend_concentration_pct, dp.dept_name AS largest_overspend_department, dp.leader_name AS accountable_leader, round(dp.variance, 2) AS largest_department_variance_usd FROM x CROSS JOIN p CROSS JOIN div_pick dv CROSS JOIN acct_pick ap CROSS JOIN conc c CROSS JOIN dept_pick dp`,
    ordered: false,
    fingerprintSQL: `WITH actual AS (SELECT CASE WHEN a.account_type = 'Revenue' THEN 'Revenue' WHEN a.account_type = 'COGS' THEN 'COGS' ELSE 'Opex' END AS line, sum(g.amount) AS amount FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.is_pl AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY 1), plan AS (SELECT CASE WHEN a.account_type = 'Revenue' THEN 'Revenue' WHEN a.account_type = 'COGS' THEN 'COGS' ELSE 'Opex' END AS line, sum(b.amount_usd) AS amount FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' GROUP BY 1), p AS (SELECT max(amount) FILTER (WHERE line = 'Revenue') AS revenue, max(amount) FILTER (WHERE line = 'COGS') AS cogs, max(amount) FILTER (WHERE line = 'Opex') AS opex FROM plan), x AS (SELECT max(amount) FILTER (WHERE line = 'Revenue') AS revenue, max(amount) FILTER (WHERE line = 'COGS') AS cogs, max(amount) FILTER (WHERE line = 'Opex') AS opex FROM actual), div_actual AS (SELECT d.division, sum(g.amount) AS actual FROM fct_gl_transactions g JOIN dim_account a USING (account_id) JOIN dim_department d USING (dept_id) WHERE a.account_type = 'Opex' AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY d.division), div_plan AS (SELECT d.division, sum(b.amount_usd) AS plan FROM fct_budget b JOIN dim_account a USING (account_id) JOIN dim_department d ON b.dept_name_raw = d.dept_name WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Opex' GROUP BY d.division), div_pick AS (SELECT a.division, a.actual - p.plan AS variance FROM div_actual a JOIN div_plan p USING (division) ORDER BY variance DESC, division LIMIT 1), acct_actual AS (SELECT account_id, sum(amount) AS actual FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Opex' AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY account_id), acct_plan AS (SELECT b.account_id, sum(amount_usd) AS plan FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Opex' GROUP BY b.account_id), acct_pick AS (SELECT coalesce(a.account_id, p.account_id) AS account_id, coalesce(a.actual, 0) - coalesce(p.plan, 0) AS variance FROM acct_actual a FULL OUTER JOIN acct_plan p USING (account_id) ORDER BY abs(variance) DESC, account_id LIMIT 1), dept_actual AS (SELECT d.dept_name, sum(g.amount) AS actual FROM fct_gl_transactions g JOIN dim_account a USING (account_id) JOIN dim_department d USING (dept_id) WHERE a.account_type = 'Opex' AND txn_date >= DATE '2026-01-01' AND txn_date < DATE '2026-07-01' GROUP BY d.dept_name), dept_plan AS (SELECT b.dept_name_raw AS dept_name, sum(amount_usd) AS plan FROM fct_budget b JOIN dim_account a USING (account_id) WHERE b.version_name = 'FY2026 Plan' AND a.account_type = 'Opex' GROUP BY b.dept_name_raw), dept_comp AS (SELECT a.dept_name, a.actual - p.plan AS variance, greatest(a.actual - p.plan, 0) AS overspend FROM dept_actual a JOIN dept_plan p USING (dept_name)), dept_pick AS (SELECT c.dept_name, d.leader_name, c.variance FROM dept_comp c JOIN dim_department d USING (dept_name) ORDER BY c.variance DESC, c.dept_name LIMIT 1), conc AS (SELECT 100.0 * sum(overspend) FILTER (WHERE rnk <= 5) / sum(overspend) AS share FROM (SELECT overspend, row_number() OVER (ORDER BY overspend DESC, dept_name) AS rnk FROM dept_comp)) SELECT round(100.0 * x.revenue / p.revenue, 1) AS h1_revenue_attainment_pct, round(100.0 * (x.revenue - x.cogs) / x.revenue, 1) AS actual_gross_margin_pct, round(100.0 * (p.revenue - p.cogs) / p.revenue, 1) AS plan_gross_margin_pct, round((x.revenue + x.cogs + x.opex) - (p.revenue + p.cogs + p.opex), 2) AS operating_result_variance_usd, dv.division AS largest_opex_overspend_division, round(dv.variance, 2) AS largest_division_variance_usd, ap.account_id AS largest_absolute_opex_variance_account, round(ap.variance, 2) AS largest_account_variance_usd, round(c.share, 1) AS top_5_department_overspend_concentration_pct, dp.dept_name AS largest_overspend_department, dp.leader_name AS accountable_leader, round(dp.variance, 2) AS largest_department_variance_usd FROM x CROSS JOIN p CROSS JOIN div_pick dv CROSS JOIN acct_pick ap CROSS JOIN conc c CROSS JOIN dept_pick dp`,
    fingerprintMessage: `The operating-result bridge adds COGS and Opex to revenue. Those are positive stored expense amounts, so operating result must subtract both on actual and plan before taking the variance.`,
    requireRegex: String.raw`full\s+(?:outer\s+)?join`,
    requireMessage: `The frozen H1 fixture has no one-sided Opex accounts, so the largest-driver pick looks right with an INNER JOIN. Preserve the FULL OUTER JOIN in the account comparison so the handoff cannot hide future actual-only or plan-only accounts.`,
    hints: [
      `Reduce the H1 P&L to one actual row and one plan row, then reuse one-row picks for the largest division, absolute account driver, department concentration, and department owner.`,
      `Operating result = Revenue - COGS - Opex. The largest account ranks absolute variance; the department and division picks rank signed overspend.`,
      `Use the same H1 populations and definitions from missions 68–76. The handoff should show 103.2% revenue attainment, 62.1% actual versus 61.1% planned gross margin, a $912.5 thousand unfavorable operating-result variance, R&D as the largest division miss, account 6000 as the largest absolute account driver, 73.4% top-five department concentration, and Engineering owned by Wei Zhang as the largest department miss. The loaded plan ends in June; do not extend this row into an H2 forecast.`,
    ],
    sayIt: `"Revenue attained 103.2% of plan and gross margin beat by one point, but the H1 operating result still finished $912 thousand below plan because expense misses more than absorbed the revenue beat. R&D, salaries and wages, and Engineering are the first review routes; the file supports no H2 outlook."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm78',
    part: 15,
    title: 'Prove the calendar boundary',
    from: 'priya',
    ask: `Before we read daily revenue, prove the calendar we can actually support. Profile January through June 2026: its first and last date, calendar days, weekdays, weekends, represented months, and calendar month-ends that fall on a weekend. This date table has weekends but no holiday calendar, so call them weekdays—not business days.`,
    deliverable: `Exactly one row: first_date, last_date, calendar_days, weekdays, weekends, months, and weekend_month_ends.`,
    tables: ['dim_date'],
    canonical: `SELECT min(date_day) AS first_date, max(date_day) AS last_date, count(*) AS calendar_days, count(*) FILTER (WHERE NOT is_weekend) AS weekdays, count(*) FILTER (WHERE is_weekend) AS weekends, count(DISTINCT month_start) AS months, count(*) FILTER (WHERE is_month_end AND is_weekend) AS weekend_month_ends FROM dim_date WHERE date_day >= DATE '2026-01-01' AND date_day < DATE '2026-07-01'`,
    ordered: false,
    fingerprintSQL: `SELECT min(date_day) AS first_date, max(date_day) AS last_date, count(*) AS calendar_days, count(*) FILTER (WHERE NOT is_weekend) AS weekdays, count(*) FILTER (WHERE is_weekend) AS weekends, count(DISTINCT month_start) AS months, count(*) FILTER (WHERE is_month_end AND is_weekend) AS weekend_month_ends FROM dim_date`,
    fingerprintMessage: `That profiles the entire date dimension through December, not the loaded H1 review window. Bound the spine from January 1 through June 30 before counting days or month-ends.`,
    hints: [
      `Filter dim_date to the six-month window, then use conditional COUNTs for weekday, weekend, and weekend month-end rows.`,
      `Use a half-open date range: date_day >= January 1 and date_day < July 1. Count distinct month_start values for represented months.`,
      `SELECT min(date_day) AS first_date, max(date_day) AS last_date, count(*) AS calendar_days, count(*) FILTER (WHERE NOT is_weekend) AS weekdays, count(*) FILTER (WHERE is_weekend) AS weekends, count(DISTINCT month_start) AS months, count(*) FILTER (WHERE is_month_end AND is_weekend) AS weekend_month_ends FROM dim_date WHERE date_day >= DATE '2026-01-01' AND date_day < DATE '2026-07-01';\n\nThis proves 181 loaded calendar days: 129 weekdays, 52 weekends, six months, and three calendar month-ends on weekends. The table does not encode holidays.`,
    ],
    sayIt: `"The H1 spine is complete at 181 calendar days. Three month-ends land on weekends, but I would not call the remaining dates business days without a holiday calendar."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm79',
    part: 15,
    title: 'Build the complete daily revenue spine',
    from: 'elena',
    ask: `Give me one row for every H1 calendar date, even if a future load has no revenue that day. Join every Revenue-typed account onto dim_date and preserve the date spine.`,
    deliverable: `181 rows: date_day, day_of_week, is_weekend, and revenue_usd. Revenue includes every dim_account row with account_type Revenue. Missing activity is zero. Round revenue to 2; sort oldest date first.`,
    tables: ['dim_date', 'fct_gl_transactions', 'dim_account'],
    canonical: `WITH daily AS (SELECT g.txn_date AS date_day, sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY g.txn_date) SELECT c.date_day, c.day_of_week, c.is_weekend, round(coalesce(d.revenue, 0), 2) AS revenue_usd FROM dim_date c LEFT JOIN daily d USING (date_day) WHERE c.date_day >= DATE '2026-01-01' AND c.date_day < DATE '2026-07-01' ORDER BY c.date_day`,
    ordered: true,
    orderedNote: 'oldest calendar date first',
    fingerprintSQL: `WITH daily AS (SELECT g.txn_date AS date_day, sum(g.amount) AS revenue FROM fct_gl_transactions g WHERE g.account_id = '4000' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY g.txn_date) SELECT c.date_day, c.day_of_week, c.is_weekend, round(coalesce(d.revenue, 0), 2) AS revenue_usd FROM dim_date c LEFT JOIN daily d USING (date_day) WHERE c.date_day >= DATE '2026-01-01' AND c.date_day < DATE '2026-07-01' ORDER BY c.date_day`,
    fingerprintMessage: `The spine is complete, but the revenue population drops usage account 4010. Classify revenue through dim_account so subscription and usage remain in the same daily control.`,
    requireRegex: DIM_DATE_OUTER_JOIN_REQUIREMENT,
    requireMessage: `Every frozen H1 date currently has revenue, so an INNER JOIN happens to return 181 rows. Preserve dim_date with an outer join so a future zero-revenue day remains visible as zero instead of disappearing.`,
    hints: [
      `Aggregate Revenue-account GL lines to txn_date first. Then LEFT JOIN that daily result onto the H1 rows from dim_date.`,
      `The date table is the left side. COALESCE the missing daily amount to zero and sort by date_day.`,
      `WITH daily AS (SELECT g.txn_date AS date_day, sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY g.txn_date) SELECT c.date_day, c.day_of_week, c.is_weekend, round(coalesce(d.revenue, 0), 2) AS revenue_usd FROM dim_date c LEFT JOIN daily d USING (date_day) WHERE c.date_day >= DATE '2026-01-01' AND c.date_day < DATE '2026-07-01' ORDER BY c.date_day;`,
    ],
    sayIt: `"I made the calendar the controlling grain and left-joined revenue, so a quiet date cannot vanish from the time series."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm80',
    part: 15,
    title: 'Separate weekday and weekend revenue',
    from: 'priya',
    ask: `Split the complete H1 series into Weekday and Weekend. I need the number of calendar days, total revenue, average daily revenue, and share of all H1 revenue for each class. Keep the language literal: weekend versus weekday, not open versus closed.`,
    deliverable: `Two rows: day_class, calendar_days, revenue_usd, avg_daily_revenue_usd, and revenue_share_pct. Round dollars to 2 and share to 1; sort Weekday before Weekend.`,
    tables: ['dim_date', 'fct_gl_transactions', 'dim_account'],
    canonical: `WITH daily AS (SELECT g.txn_date AS date_day, sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY g.txn_date), classified AS (SELECT CASE WHEN c.is_weekend THEN 'Weekend' ELSE 'Weekday' END AS day_class, coalesce(d.revenue, 0) AS revenue FROM dim_date c LEFT JOIN daily d USING (date_day) WHERE c.date_day >= DATE '2026-01-01' AND c.date_day < DATE '2026-07-01') SELECT day_class, count(*) AS calendar_days, round(sum(revenue), 2) AS revenue_usd, round(avg(revenue), 2) AS avg_daily_revenue_usd, round(100.0 * sum(revenue) / sum(sum(revenue)) OVER (), 1) AS revenue_share_pct FROM classified GROUP BY day_class ORDER BY CASE day_class WHEN 'Weekday' THEN 1 ELSE 2 END`,
    ordered: true,
    orderedNote: 'Weekday before Weekend',
    fingerprintSQL: `WITH daily AS (SELECT g.txn_date AS date_day, sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY g.txn_date), classified AS (SELECT CASE WHEN c.is_weekend THEN 'Weekend' ELSE 'Weekday' END AS day_class, coalesce(d.revenue, 0) AS revenue FROM dim_date c LEFT JOIN daily d USING (date_day) WHERE c.date_day >= DATE '2026-01-01' AND c.date_day < DATE '2026-07-01') SELECT day_class, count(*) AS calendar_days, round(sum(revenue), 2) AS revenue_usd, round(avg(revenue), 2) AS avg_daily_revenue_usd, round(100.0 * sum(revenue) / sum(sum(revenue)) OVER (PARTITION BY day_class), 1) AS revenue_share_pct FROM classified GROUP BY day_class ORDER BY CASE day_class WHEN 'Weekday' THEN 1 ELSE 2 END`,
    fingerprintMessage: `Both shares are 100% because the window denominator restarts inside each day class. Remove the partition so Weekday and Weekend divide by the same H1 revenue total.`,
    requireRegex: DIM_DATE_OUTER_JOIN_REQUIREMENT,
    requireMessage: `Every frozen H1 date currently has revenue, so an INNER JOIN happens to preserve the two totals. Preserve dim_date with an outer join so a future zero-revenue date remains in the weekday/weekend day counts and averages.`,
    hints: [
      `Classify each calendar row with CASE, then GROUP BY the two labels. A window over the grouped revenue supplies the common denominator.`,
      `Use sum(sum(revenue)) OVER () for all-H1 revenue; do not partition that denominator by day_class.`,
      `WITH daily AS (SELECT g.txn_date AS date_day, sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY g.txn_date), classified AS (SELECT CASE WHEN c.is_weekend THEN 'Weekend' ELSE 'Weekday' END AS day_class, coalesce(d.revenue, 0) AS revenue FROM dim_date c LEFT JOIN daily d USING (date_day) WHERE c.date_day >= DATE '2026-01-01' AND c.date_day < DATE '2026-07-01') SELECT day_class, count(*) AS calendar_days, round(sum(revenue), 2) AS revenue_usd, round(avg(revenue), 2) AS avg_daily_revenue_usd, round(100.0 * sum(revenue) / sum(sum(revenue)) OVER (), 1) AS revenue_share_pct FROM classified GROUP BY day_class ORDER BY CASE day_class WHEN 'Weekday' THEN 1 ELSE 2 END;`,
    ],
    sayIt: `"Weekdays carry 72.1% of H1 revenue and weekends 27.9%, close to their calendar mix. I would describe cadence, not operating hours, because revenue is recognized every day in this fixture."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm81',
    part: 15,
    title: 'Find the recurring calendar-day peak',
    from: 'elena',
    ask: `Look across the six months and rank calendar day numbers by average daily revenue. Normalize by the number of times each day appears so the 29th through 31st are not penalized just because fewer months contain them.`,
    deliverable: `Top ten rows: day_of_month, observed_days, avg_daily_revenue_usd, and revenue_usd. Round dollars to 2; sort highest average first, then day number.`,
    tables: ['dim_date', 'fct_gl_transactions', 'dim_account'],
    canonical: `WITH daily AS (SELECT g.txn_date AS date_day, sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY g.txn_date) SELECT day(c.date_day) AS day_of_month, count(*) AS observed_days, round(avg(coalesce(d.revenue, 0)), 2) AS avg_daily_revenue_usd, round(sum(coalesce(d.revenue, 0)), 2) AS revenue_usd FROM dim_date c LEFT JOIN daily d USING (date_day) WHERE c.date_day >= DATE '2026-01-01' AND c.date_day < DATE '2026-07-01' GROUP BY 1 ORDER BY avg_daily_revenue_usd DESC, day_of_month LIMIT 10`,
    ordered: true,
    orderedNote: 'highest average daily revenue first, then calendar day',
    fingerprintSQL: `SELECT day(c.date_day) AS day_of_month, count(*) AS observed_days, round(avg(g.amount), 2) AS avg_daily_revenue_usd, round(sum(g.amount), 2) AS revenue_usd FROM dim_date c JOIN fct_gl_transactions g ON g.txn_date = c.date_day JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND c.date_day >= DATE '2026-01-01' AND c.date_day < DATE '2026-07-01' GROUP BY 1 ORDER BY avg_daily_revenue_usd DESC, day_of_month LIMIT 10`,
    fingerprintMessage: `The join is still at GL-line grain, so observed_days counts transaction lines and AVG measures the average line—not average daily revenue. Aggregate to one revenue row per date before grouping by calendar day.`,
    requireRegex: DIM_DATE_OUTER_JOIN_REQUIREMENT,
    requireMessage: `Every frozen H1 date currently has revenue, so an INNER JOIN happens to preserve the ranking. Preserve dim_date with an outer join so a future zero-revenue date still counts in that calendar day's observed-day denominator.`,
    hints: [
      `Start from the complete daily spine, group by day(date_day), and carry both COUNT and AVG before ranking.`,
      `Sort by avg_daily_revenue_usd descending. Keep total revenue as context, not as the ranking metric.`,
      `WITH daily AS (SELECT g.txn_date AS date_day, sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY g.txn_date) SELECT day(c.date_day) AS day_of_month, count(*) AS observed_days, round(avg(coalesce(d.revenue, 0)), 2) AS avg_daily_revenue_usd, round(sum(coalesce(d.revenue, 0)), 2) AS revenue_usd FROM dim_date c LEFT JOIN daily d USING (date_day) WHERE c.date_day >= DATE '2026-01-01' AND c.date_day < DATE '2026-07-01' GROUP BY 1 ORDER BY avg_daily_revenue_usd DESC, day_of_month LIMIT 10;`,
    ],
    sayIt: `"The 24th is the strongest recurring calendar day at about $360 thousand on average across six observations. I normalized by observed days before ranking."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm82',
    part: 15,
    title: 'Trace the twenty-fourth',
    from: 'priya',
    ask: `The 24th leads the normalized ranking. Show that accounting date in each H1 month, split Revenue into subscription, usage, and every other Revenue account, and measure its share of the full month. This is a recognized-revenue cadence—not proof of billing terms or customer behavior.`,
    deliverable: `Six rows: month_start, revenue_24th_usd, subscription_24th_usd, usage_24th_usd, other_revenue_24th_usd, and monthly_revenue_share_pct. Round dollars to 2 and share to 1; sort oldest month first.`,
    tables: ['dim_date', 'fct_gl_transactions', 'dim_account'],
    canonical: `WITH calendar_24 AS (SELECT date_day, month_start FROM dim_date WHERE date_day >= DATE '2026-01-01' AND date_day < DATE '2026-07-01' AND day(date_day) = 24), day_24 AS (SELECT g.txn_date AS date_day, sum(g.amount) AS revenue_24th, sum(g.amount) FILTER (WHERE g.account_id = '4000') AS subscription_24th, sum(g.amount) FILTER (WHERE g.account_id = '4010') AS usage_24th, sum(g.amount) FILTER (WHERE g.account_id NOT IN ('4000', '4010')) AS other_revenue_24th FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' AND day(g.txn_date) = 24 GROUP BY g.txn_date), monthly AS (SELECT date_trunc('month', g.txn_date)::DATE AS month_start, sum(g.amount) AS monthly_revenue FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1) SELECT c.month_start, round(coalesce(d.revenue_24th, 0), 2) AS revenue_24th_usd, round(coalesce(d.subscription_24th, 0), 2) AS subscription_24th_usd, round(coalesce(d.usage_24th, 0), 2) AS usage_24th_usd, round(coalesce(d.other_revenue_24th, 0), 2) AS other_revenue_24th_usd, round(100.0 * coalesce(d.revenue_24th, 0) / m.monthly_revenue, 1) AS monthly_revenue_share_pct FROM calendar_24 c LEFT JOIN day_24 d USING (date_day) LEFT JOIN monthly m USING (month_start) ORDER BY c.month_start`,
    ordered: true,
    orderedNote: 'oldest month first',
    fingerprintSQL: `WITH calendar_24 AS (SELECT date_day, month_start FROM dim_date WHERE date_day >= DATE '2026-01-01' AND date_day < DATE '2026-07-01' AND day(date_day) = 24), day_24 AS (SELECT g.txn_date AS date_day, sum(g.amount) AS revenue_24th, sum(g.amount) FILTER (WHERE g.account_id = '4000') AS subscription_24th, sum(g.amount) FILTER (WHERE g.account_id = '4010') AS usage_24th, sum(g.amount) FILTER (WHERE g.account_id NOT IN ('4000', '4010')) AS other_revenue_24th FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' AND day(g.txn_date) = 24 GROUP BY g.txn_date) SELECT c.month_start, round(coalesce(d.revenue_24th, 0), 2) AS revenue_24th_usd, round(coalesce(d.subscription_24th, 0), 2) AS subscription_24th_usd, round(coalesce(d.usage_24th, 0), 2) AS usage_24th_usd, round(coalesce(d.other_revenue_24th, 0), 2) AS other_revenue_24th_usd, round(100.0 * coalesce(d.revenue_24th, 0) / d.revenue_24th, 1) AS monthly_revenue_share_pct FROM calendar_24 c LEFT JOIN day_24 d USING (date_day) ORDER BY c.month_start`,
    fingerprintMessage: `Every share is 100% because the monthly denominator was built after filtering to the 24th. Build the full-month revenue CTE before applying the day-of-month filter.`,
    requireRegex: DIM_DATE_OUTER_JOIN_REQUIREMENT,
    requireMessage: `Use dim_date as the six-row calendar source and preserve those dates with an outer join to Revenue activity, so a future zero-revenue 24th remains visible with zero dollars instead of removing that month.`,
    hints: [
      `Drive from the six calendar 24ths. Aggregate that date's Revenue lines separately from the full-month Revenue denominator.`,
      `Conditional SUMs split 4000, 4010, and every other Revenue account. LEFT JOIN the date-level result so an empty 24th remains a zero row.`,
      `WITH calendar_24 AS (SELECT date_day, month_start FROM dim_date WHERE date_day >= DATE '2026-01-01' AND date_day < DATE '2026-07-01' AND day(date_day) = 24), day_24 AS (SELECT g.txn_date AS date_day, sum(g.amount) AS revenue_24th, sum(g.amount) FILTER (WHERE g.account_id = '4000') AS subscription_24th, sum(g.amount) FILTER (WHERE g.account_id = '4010') AS usage_24th, sum(g.amount) FILTER (WHERE g.account_id NOT IN ('4000', '4010')) AS other_revenue_24th FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' AND day(g.txn_date) = 24 GROUP BY g.txn_date), monthly AS (SELECT date_trunc('month', g.txn_date)::DATE AS month_start, sum(g.amount) AS monthly_revenue FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1) SELECT c.month_start, round(coalesce(d.revenue_24th, 0), 2) AS revenue_24th_usd, round(coalesce(d.subscription_24th, 0), 2) AS subscription_24th_usd, round(coalesce(d.usage_24th, 0), 2) AS usage_24th_usd, round(coalesce(d.other_revenue_24th, 0), 2) AS other_revenue_24th_usd, round(100.0 * coalesce(d.revenue_24th, 0) / m.monthly_revenue, 1) AS monthly_revenue_share_pct FROM calendar_24 c LEFT JOIN day_24 d USING (date_day) LEFT JOIN monthly m USING (month_start) ORDER BY c.month_start;`,
    ],
    sayIt: `"The 24th contributes roughly 4.9% to 5.3% of each month's recognized revenue, mostly subscription with a smaller usage component and no other-account activity in H1. That is an accounting-date cadence signal, not a customer-behavior conclusion."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm83',
    part: 15,
    title: 'Rank the rolling seven-day peaks',
    from: 'elena',
    ask: `Smooth the complete daily spine with a trailing seven-calendar-day revenue total, including the current date. Rank the ten highest rolling windows.`,
    deliverable: `Ten rows: date_day, revenue_usd, and revenue_7d_usd. The window is current row plus six preceding calendar rows. Round dollars to 2; sort highest rolling revenue first, then date.`,
    tables: ['dim_date', 'fct_gl_transactions', 'dim_account'],
    canonical: `WITH daily AS (SELECT g.txn_date AS date_day, sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY g.txn_date), spine AS (SELECT c.date_day, coalesce(d.revenue, 0) AS revenue FROM dim_date c LEFT JOIN daily d USING (date_day) WHERE c.date_day >= DATE '2026-01-01' AND c.date_day < DATE '2026-07-01'), rolled AS (SELECT date_day, revenue, sum(revenue) OVER (ORDER BY date_day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS revenue_7d FROM spine) SELECT date_day, round(revenue, 2) AS revenue_usd, round(revenue_7d, 2) AS revenue_7d_usd FROM rolled ORDER BY revenue_7d DESC, date_day LIMIT 10`,
    ordered: true,
    orderedNote: 'highest trailing seven-calendar-day revenue first, then date',
    fingerprintSQL: `WITH daily AS (SELECT g.txn_date AS date_day, sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY g.txn_date), spine AS (SELECT c.date_day, coalesce(d.revenue, 0) AS revenue FROM dim_date c LEFT JOIN daily d USING (date_day) WHERE c.date_day >= DATE '2026-01-01' AND c.date_day < DATE '2026-07-01'), rolled AS (SELECT date_day, revenue, sum(revenue) OVER (ORDER BY date_day ROWS BETWEEN 7 PRECEDING AND CURRENT ROW) AS revenue_7d FROM spine) SELECT date_day, round(revenue, 2) AS revenue_usd, round(revenue_7d, 2) AS revenue_7d_usd FROM rolled ORDER BY revenue_7d DESC, date_day LIMIT 10`,
    fingerprintMessage: `That frame contains the current date plus seven preceding rows—eight calendar days. A seven-day window is ROWS BETWEEN 6 PRECEDING AND CURRENT ROW.`,
    requireRegex: CALENDAR_ORDERED_WINDOW_REQUIREMENT,
    requireMessage: `The rolling total must preserve the complete dim_date calendar with an outer join and order that spine inside the window; without both controls, zero-revenue dates can disappear or the trailing seven-day sequence is undefined.`,
    hints: [
      `Build the complete daily spine first. Then SUM(revenue) OVER an ordered seven-row frame.`,
      `The current row counts as day seven, so the frame begins 6 PRECEDING—not 7 PRECEDING.`,
      `WITH daily AS (SELECT g.txn_date AS date_day, sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY g.txn_date), spine AS (SELECT c.date_day, coalesce(d.revenue, 0) AS revenue FROM dim_date c LEFT JOIN daily d USING (date_day) WHERE c.date_day >= DATE '2026-01-01' AND c.date_day < DATE '2026-07-01'), rolled AS (SELECT date_day, revenue, sum(revenue) OVER (ORDER BY date_day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS revenue_7d FROM spine) SELECT date_day, round(revenue, 2) AS revenue_usd, round(revenue_7d, 2) AS revenue_7d_usd FROM rolled ORDER BY revenue_7d DESC, date_day LIMIT 10;`,
    ],
    sayIt: `"The strongest trailing week ends June 9 at $2.07 million. The metric uses seven consecutive calendar rows, so weekends stay inside the cadence."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm84',
    part: 15,
    title: 'Measure the last-five-weekday share',
    from: 'priya',
    ask: `For each H1 month, measure how much of full-month revenue lands on its last five weekdays. Show the last weekday date and the share of all monthly revenue. Do not call this a five-business-day window: holidays are absent.`,
    deliverable: `Six rows: month_start, last_weekday, last_5_weekday_revenue_usd, and last_5_weekday_share_pct. Round dollars to 2 and share to 1; sort oldest month first.`,
    tables: ['dim_date', 'fct_gl_transactions', 'dim_account'],
    canonical: `WITH daily AS (SELECT g.txn_date AS date_day, sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY g.txn_date), weekdays AS (SELECT date_day, month_start, row_number() OVER (PARTITION BY month_start ORDER BY date_day DESC) AS weekday_rank FROM dim_date WHERE date_day >= DATE '2026-01-01' AND date_day < DATE '2026-07-01' AND NOT is_weekend), weekday_spine AS (SELECT w.date_day, w.month_start, w.weekday_rank, coalesce(d.revenue, 0) AS revenue FROM weekdays w LEFT JOIN daily d USING (date_day)), monthly AS (SELECT c.month_start, sum(coalesce(d.revenue, 0)) AS monthly_revenue FROM dim_date c LEFT JOIN daily d USING (date_day) WHERE c.date_day >= DATE '2026-01-01' AND c.date_day < DATE '2026-07-01' GROUP BY c.month_start) SELECT w.month_start, max(w.date_day) FILTER (WHERE w.weekday_rank = 1) AS last_weekday, round(sum(w.revenue) FILTER (WHERE w.weekday_rank <= 5), 2) AS last_5_weekday_revenue_usd, round(100.0 * sum(w.revenue) FILTER (WHERE w.weekday_rank <= 5) / m.monthly_revenue, 1) AS last_5_weekday_share_pct FROM weekday_spine w JOIN monthly m USING (month_start) GROUP BY w.month_start, m.monthly_revenue ORDER BY w.month_start`,
    ordered: true,
    orderedNote: 'oldest month first',
    fingerprintSQL: `WITH daily AS (SELECT g.txn_date AS date_day, sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY g.txn_date), weekdays AS (SELECT date_day, month_start, row_number() OVER (PARTITION BY month_start ORDER BY date_day DESC) AS weekday_rank FROM dim_date WHERE date_day >= DATE '2026-01-01' AND date_day < DATE '2026-07-01' AND NOT is_weekend), weekday_spine AS (SELECT w.date_day, w.month_start, w.weekday_rank, coalesce(d.revenue, 0) AS revenue FROM weekdays w LEFT JOIN daily d USING (date_day)), weekday_monthly AS (SELECT month_start, sum(revenue) AS monthly_revenue FROM weekday_spine GROUP BY month_start) SELECT w.month_start, max(w.date_day) FILTER (WHERE w.weekday_rank = 1) AS last_weekday, round(sum(w.revenue) FILTER (WHERE w.weekday_rank <= 5), 2) AS last_5_weekday_revenue_usd, round(100.0 * sum(w.revenue) FILTER (WHERE w.weekday_rank <= 5) / m.monthly_revenue, 1) AS last_5_weekday_share_pct FROM weekday_spine w JOIN weekday_monthly m USING (month_start) GROUP BY w.month_start, m.monthly_revenue ORDER BY w.month_start`,
    fingerprintMessage: `The numerator is right, but the denominator excludes weekend revenue. Divide the last five weekdays by the full month's revenue so the share answers the stated question.`,
    requireRegex: DIM_DATE_OUTER_JOIN_REQUIREMENT,
    requireMessage: `The last weekday comes from dim_date even if it has no revenue. Preserve the calendar dates with an outer join to daily Revenue so an empty date remains in the window with zero dollars instead of disappearing.`,
    hints: [
      `Rank only weekday dates backward within each month. Build the monthly revenue denominator separately from every calendar date.`,
      `Conditional SUM weekday_rank <= 5 is the numerator; the unfiltered monthly total is the denominator.`,
      `WITH daily AS (SELECT g.txn_date AS date_day, sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY g.txn_date), weekdays AS (SELECT date_day, month_start, row_number() OVER (PARTITION BY month_start ORDER BY date_day DESC) AS weekday_rank FROM dim_date WHERE date_day >= DATE '2026-01-01' AND date_day < DATE '2026-07-01' AND NOT is_weekend), weekday_spine AS (SELECT w.date_day, w.month_start, w.weekday_rank, coalesce(d.revenue, 0) AS revenue FROM weekdays w LEFT JOIN daily d USING (date_day)), monthly AS (SELECT c.month_start, sum(coalesce(d.revenue, 0)) AS monthly_revenue FROM dim_date c LEFT JOIN daily d USING (date_day) WHERE c.date_day >= DATE '2026-01-01' AND c.date_day < DATE '2026-07-01' GROUP BY c.month_start) SELECT w.month_start, max(w.date_day) FILTER (WHERE w.weekday_rank = 1) AS last_weekday, round(sum(w.revenue) FILTER (WHERE w.weekday_rank <= 5), 2) AS last_5_weekday_revenue_usd, round(100.0 * sum(w.revenue) FILTER (WHERE w.weekday_rank <= 5) / m.monthly_revenue, 1) AS last_5_weekday_share_pct FROM weekday_spine w JOIN monthly m USING (month_start) GROUP BY w.month_start, m.monthly_revenue ORDER BY w.month_start;`,
    ],
    sayIt: `"The last five weekdays contribute 7.1% to 18.2% of monthly revenue, highest in February. This is a weekday-window concentration measure, not a holiday-adjusted close calendar."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm85',
    part: 15,
    title: 'Package the daily revenue cadence',
    from: 'priya',
    ask: `Package the H1 daily cadence in one row: total revenue and calendar coverage, weekday share, the largest single date, the strongest recurring calendar day, the peak trailing seven-day window, and the month with the highest last-five-weekday share. Keep every label faithful to the calendar we actually have.`,
    deliverable: `Exactly one row: h1_revenue_usd, calendar_days, weekday_revenue_share_pct, peak_revenue_date, peak_daily_revenue_usd, top_day_of_month, top_day_of_month_avg_revenue_usd, peak_7d_end_date, peak_7d_revenue_usd, highest_last_5_weekday_month, and highest_last_5_weekday_share_pct. Round dollars to 2 and percentages to 1.`,
    tables: ['dim_date', 'fct_gl_transactions', 'dim_account'],
    canonical: `WITH daily AS (SELECT g.txn_date AS date_day, sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY g.txn_date), spine AS (SELECT c.date_day, c.month_start, c.is_weekend, coalesce(d.revenue, 0) AS revenue FROM dim_date c LEFT JOIN daily d USING (date_day) WHERE c.date_day >= DATE '2026-01-01' AND c.date_day < DATE '2026-07-01'), summary AS (SELECT sum(revenue) AS h1_revenue, count(*) AS calendar_days, 100.0 * sum(revenue) FILTER (WHERE NOT is_weekend) / sum(revenue) AS weekday_share FROM spine), peak_day AS (SELECT date_day, revenue FROM spine ORDER BY revenue DESC, date_day LIMIT 1), day_profile AS (SELECT day(date_day) AS day_of_month, avg(revenue) AS avg_revenue FROM spine GROUP BY 1), top_day AS (SELECT * FROM day_profile ORDER BY avg_revenue DESC, day_of_month LIMIT 1), rolled AS (SELECT date_day, sum(revenue) OVER (ORDER BY date_day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS revenue_7d FROM spine), peak_roll AS (SELECT * FROM rolled ORDER BY revenue_7d DESC, date_day LIMIT 1), weekdays AS (SELECT date_day, month_start, row_number() OVER (PARTITION BY month_start ORDER BY date_day DESC) AS weekday_rank FROM dim_date WHERE date_day >= DATE '2026-01-01' AND date_day < DATE '2026-07-01' AND NOT is_weekend), month_profile AS (SELECT w.month_start, 100.0 * sum(s.revenue) FILTER (WHERE w.weekday_rank <= 5) / max(m.month_revenue) AS share FROM weekdays w JOIN spine s ON s.date_day = w.date_day JOIN (SELECT month_start, sum(revenue) AS month_revenue FROM spine GROUP BY month_start) m ON m.month_start = w.month_start GROUP BY w.month_start), top_month AS (SELECT * FROM month_profile ORDER BY share DESC, month_start LIMIT 1) SELECT round(s.h1_revenue, 2) AS h1_revenue_usd, s.calendar_days, round(s.weekday_share, 1) AS weekday_revenue_share_pct, p.date_day AS peak_revenue_date, round(p.revenue, 2) AS peak_daily_revenue_usd, d.day_of_month AS top_day_of_month, round(d.avg_revenue, 2) AS top_day_of_month_avg_revenue_usd, r.date_day AS peak_7d_end_date, round(r.revenue_7d, 2) AS peak_7d_revenue_usd, m.month_start AS highest_last_5_weekday_month, round(m.share, 1) AS highest_last_5_weekday_share_pct FROM summary s CROSS JOIN peak_day p CROSS JOIN top_day d CROSS JOIN peak_roll r CROSS JOIN top_month m`,
    ordered: false,
    fingerprintSQL: `WITH daily AS (SELECT g.txn_date AS date_day, sum(g.amount) AS revenue FROM fct_gl_transactions g JOIN dim_account a USING (account_id) WHERE a.account_type = 'Revenue' AND g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY g.txn_date), spine AS (SELECT c.date_day, c.month_start, c.is_weekend, coalesce(d.revenue, 0) AS revenue FROM dim_date c LEFT JOIN daily d USING (date_day) WHERE c.date_day >= DATE '2026-01-01' AND c.date_day < DATE '2026-07-01'), summary AS (SELECT sum(revenue) AS h1_revenue, count(*) AS calendar_days, 100.0 * sum(revenue) FILTER (WHERE NOT is_weekend) / sum(revenue) AS weekday_share FROM spine), peak_day AS (SELECT date_day, revenue FROM spine ORDER BY revenue DESC, date_day LIMIT 1), day_profile AS (SELECT day(date_day) AS day_of_month, avg(revenue) AS avg_revenue FROM spine GROUP BY 1), top_day AS (SELECT * FROM day_profile ORDER BY avg_revenue DESC, day_of_month LIMIT 1), rolled AS (SELECT date_day, sum(revenue) OVER (ORDER BY date_day ROWS BETWEEN 7 PRECEDING AND CURRENT ROW) AS revenue_7d FROM spine), peak_roll AS (SELECT * FROM rolled ORDER BY revenue_7d DESC, date_day LIMIT 1), weekdays AS (SELECT date_day, month_start, row_number() OVER (PARTITION BY month_start ORDER BY date_day DESC) AS weekday_rank FROM dim_date WHERE date_day >= DATE '2026-01-01' AND date_day < DATE '2026-07-01' AND NOT is_weekend), month_profile AS (SELECT w.month_start, 100.0 * sum(s.revenue) FILTER (WHERE w.weekday_rank <= 5) / max(m.month_revenue) AS share FROM weekdays w JOIN spine s ON s.date_day = w.date_day JOIN (SELECT month_start, sum(revenue) AS month_revenue FROM spine GROUP BY month_start) m ON m.month_start = w.month_start GROUP BY w.month_start), top_month AS (SELECT * FROM month_profile ORDER BY share DESC, month_start LIMIT 1) SELECT round(s.h1_revenue, 2) AS h1_revenue_usd, s.calendar_days, round(s.weekday_share, 1) AS weekday_revenue_share_pct, p.date_day AS peak_revenue_date, round(p.revenue, 2) AS peak_daily_revenue_usd, d.day_of_month AS top_day_of_month, round(d.avg_revenue, 2) AS top_day_of_month_avg_revenue_usd, r.date_day AS peak_7d_end_date, round(r.revenue_7d, 2) AS peak_7d_revenue_usd, m.month_start AS highest_last_5_weekday_month, round(m.share, 1) AS highest_last_5_weekday_share_pct FROM summary s CROSS JOIN peak_day p CROSS JOIN top_day d CROSS JOIN peak_roll r CROSS JOIN top_month m`,
    fingerprintMessage: `The handoff's rolling peak uses eight calendar rows because the frame starts at 7 PRECEDING. Keep the same seven-day definition as the detail: current row plus 6 preceding.`,
    requireRegex: DIM_DATE_OUTER_JOIN_REQUIREMENT,
    requireMessage: `The handoff must derive from the complete calendar spine. Preserve dim_date with an outer join so every downstream count, average, rolling window, and weekday pick preserves future zero-revenue dates.`,
    hints: [
      `Reuse one complete H1 spine, then reduce it into one-row picks for the peak date, calendar-day profile, rolling window, and last-five-weekday month.`,
      `Keep every Revenue-typed account, use six preceding rows for the seven-day window, and divide the weekday-window numerator by full-month revenue.`,
      `Use the same populations and definitions from missions 78–84. The handoff should show $41.99 million across 181 days, 72.1% on weekdays, June 24 as the $393.6 thousand peak day, day 24 as the $360.4 thousand recurring average leader, June 9 as the $2.07 million trailing-week peak, and February as the 18.2% last-five-weekday concentration high. These are accounting-date revenue-cadence observations; no holiday calendar, billing terms, or operating-hours claim is supported.`,
    ],
    sayIt: `"H1 revenue is $41.99 million across a complete 181-day spine. The 24th recurs as the strongest calendar day, the top trailing week ends June 9, and February has the highest last-five-weekday share; those are cadence signals, not causal explanations."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm86',
    part: 16,
    title: 'Set the active org boundary',
    from: 'maria',
    ask: `Coco from People Ops again. Riff wants to review manager capacity, but first we need the roster boundary. Count active employees as of June 30, 2026, then split them into people with a manager id and people without one. Do not use the full historical roster.`,
    deliverable: `Exactly one row: active_employees, active_without_manager_id, and active_with_manager_id.`,
    tables: ['dim_employee'],
    canonical: `WITH active AS (SELECT * FROM dim_employee WHERE hire_date <= DATE '2026-06-30' AND (termination_date IS NULL OR termination_date > DATE '2026-06-30')) SELECT count(*) AS active_employees, count(*) FILTER (WHERE manager_employee_id IS NULL) AS active_without_manager_id, count(*) FILTER (WHERE manager_employee_id IS NOT NULL) AS active_with_manager_id FROM active`,
    ordered: false,
    fingerprintSQL: `SELECT count(*) AS active_employees, count(*) FILTER (WHERE manager_employee_id IS NULL) AS active_without_manager_id, count(*) FILTER (WHERE manager_employee_id IS NOT NULL) AS active_with_manager_id FROM dim_employee`,
    fingerprintMessage: `That counted the full employee history. The review is an as-of roster, so filter to people hired by June 30, 2026 whose termination_date is NULL or after June 30.`,
    requireRegex: ACTIVE_JUNE_30_REQUIREMENT,
    requireMessage: `Use the active-as-of boundary, not the full employee history. Current employees are people hired by June 30 whose termination date is blank or later than June 30.`,
    hints: [
      `Build an active CTE first. That is the roster version for the whole review.`,
      `manager_employee_id is just a stored id. NULL means no manager id on the active row; it does not prove an executive exception.`,
      `WITH active AS (SELECT * FROM dim_employee WHERE hire_date <= DATE '2026-06-30' AND (termination_date IS NULL OR termination_date > DATE '2026-06-30')) SELECT count(*) AS active_employees, count(*) FILTER (WHERE manager_employee_id IS NULL) AS active_without_manager_id, count(*) FILTER (WHERE manager_employee_id IS NOT NULL) AS active_with_manager_id FROM active;`,
    ],
    sayIt: `"I set the review boundary to the June 30 active roster: 672 employees, 660 with a manager id and 12 without one. That is a roster completeness signal, not an org-design recommendation yet."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm87',
    part: 16,
    title: 'Rank active direct-report spans',
    from: 'maria',
    ask: `Now rank the current manager spans. Use only active employees reporting to active managers, join the manager row back to the employee table, and bring in the manager's division. I need the widest ten spans, not a rollup by title.`,
    deliverable: `Ten rows: manager_id, manager_name, manager_title, division, and direct_reports. Sort widest span first, then manager_name.`,
    tables: ['dim_employee', 'dim_department'],
    canonical: `WITH active AS (SELECT * FROM dim_employee WHERE hire_date <= DATE '2026-06-30' AND (termination_date IS NULL OR termination_date > DATE '2026-06-30')) SELECT m.employee_id AS manager_id, m.full_name AS manager_name, m.title AS manager_title, d.division, count(*) AS direct_reports FROM active e JOIN active m ON e.manager_employee_id = m.employee_id JOIN dim_department d ON m.dept_id = d.dept_id GROUP BY 1, 2, 3, 4 ORDER BY direct_reports DESC, manager_name LIMIT 10`,
    ordered: true,
    orderedNote: 'widest span first, then manager name',
    fingerprintSQL: `WITH active AS (SELECT * FROM dim_employee WHERE hire_date <= DATE '2026-06-30' AND (termination_date IS NULL OR termination_date > DATE '2026-06-30')) SELECT m.employee_id AS manager_id, m.full_name AS manager_name, m.title AS manager_title, d.division, count(*) AS direct_reports FROM active e JOIN dim_employee m ON e.manager_employee_id = m.employee_id JOIN dim_department d ON m.dept_id = d.dept_id GROUP BY 1, 2, 3, 4 ORDER BY direct_reports DESC, manager_name LIMIT 10`,
    fingerprintMessage: `The employee side is active, but the manager side still comes from the full roster. Join active employees to active managers so terminated managers do not appear as current span owners.`,
    hints: [
      `This is a self-join: active employees as e, active managers as m, joined on e.manager_employee_id = m.employee_id.`,
      `Join dim_department from the manager row, not the report row, because the output is manager ownership by manager division.`,
      `WITH active AS (SELECT * FROM dim_employee WHERE hire_date <= DATE '2026-06-30' AND (termination_date IS NULL OR termination_date > DATE '2026-06-30')) SELECT m.employee_id AS manager_id, m.full_name AS manager_name, m.title AS manager_title, d.division, count(*) AS direct_reports FROM active e JOIN active m ON e.manager_employee_id = m.employee_id JOIN dim_department d ON m.dept_id = d.dept_id GROUP BY 1, 2, 3, 4 ORDER BY direct_reports DESC, manager_name LIMIT 10;`,
    ],
    sayIt: `"The widest current spans are in the high 30s. I joined active employees to active manager rows, so the list excludes reports whose manager id points to someone no longer active."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm88',
    part: 16,
    title: 'Find broken active manager links',
    from: 'maria',
    ask: `Before anyone reacts to span counts, quantify the dirty links. Among active employees, count how many have no manager id and how many have a manager id that does not resolve to an active manager row.`,
    deliverable: `Exactly one row: active_reports_without_manager_id and active_reports_missing_active_manager.`,
    tables: ['dim_employee'],
    canonical: `WITH active AS (SELECT * FROM dim_employee WHERE hire_date <= DATE '2026-06-30' AND (termination_date IS NULL OR termination_date > DATE '2026-06-30')) SELECT count(*) FILTER (WHERE e.manager_employee_id IS NULL) AS active_reports_without_manager_id, count(*) FILTER (WHERE e.manager_employee_id IS NOT NULL AND m.employee_id IS NULL) AS active_reports_missing_active_manager FROM active e LEFT JOIN active m ON e.manager_employee_id = m.employee_id`,
    ordered: false,
    fingerprintSQL: `WITH active AS (SELECT * FROM dim_employee WHERE hire_date <= DATE '2026-06-30' AND (termination_date IS NULL OR termination_date > DATE '2026-06-30')) SELECT count(*) FILTER (WHERE e.manager_employee_id IS NULL) AS active_reports_without_manager_id, count(*) FILTER (WHERE e.manager_employee_id IS NOT NULL AND m.employee_id IS NULL) AS active_reports_missing_active_manager FROM active e JOIN active m ON e.manager_employee_id = m.employee_id`,
    fingerprintMessage: `The inner join removed the broken links before you counted them. Use a LEFT JOIN from every active employee to the active manager table, then count unresolved manager ids where the manager row is NULL.`,
    hints: [
      `Drive from all active employees. The manager row is optional, so use LEFT JOIN.`,
      `No manager id and missing active manager are different controls: one is NULL; the other has an id that fails the active-manager lookup.`,
      `WITH active AS (SELECT * FROM dim_employee WHERE hire_date <= DATE '2026-06-30' AND (termination_date IS NULL OR termination_date > DATE '2026-06-30')) SELECT count(*) FILTER (WHERE e.manager_employee_id IS NULL) AS active_reports_without_manager_id, count(*) FILTER (WHERE e.manager_employee_id IS NOT NULL AND m.employee_id IS NULL) AS active_reports_missing_active_manager FROM active e LEFT JOIN active m ON e.manager_employee_id = m.employee_id;`,
    ],
    sayIt: `"There are 12 active employees without a manager id and 302 with a manager id that does not resolve to an active manager. That means the manager map needs cleanup before it can support a capacity decision."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm89',
    part: 16,
    title: 'Separate actual managers from coded managers',
    from: 'maria',
    ask: `The org file has another problem: some people with direct reports are not coded like managers by level or title. List the active people who have active direct reports but are not manager-coded. Treat manager-coded as level M*, D1, VP, or a title containing manager, director, vp, chief, or head.`,
    deliverable: `Ten rows: employee_id, full_name, title, level, division, and direct_reports for the largest IC-coded managers. Sort widest span first, then full_name.`,
    tables: ['dim_employee', 'dim_department'],
    canonical: `WITH active AS (SELECT * FROM dim_employee WHERE hire_date <= DATE '2026-06-30' AND (termination_date IS NULL OR termination_date > DATE '2026-06-30')), manager_rollup AS (SELECT manager_employee_id, count(*) AS direct_reports FROM active WHERE manager_employee_id IS NOT NULL GROUP BY 1) SELECT m.employee_id, m.full_name, m.title, m.level, d.division, r.direct_reports FROM manager_rollup r JOIN active m ON m.employee_id = r.manager_employee_id JOIN dim_department d ON m.dept_id = d.dept_id WHERE NOT (m.level LIKE 'M%' OR m.level IN ('D1', 'VP') OR regexp_matches(lower(m.title), 'manager|director|vp|chief|head')) ORDER BY r.direct_reports DESC, m.full_name LIMIT 10`,
    ordered: true,
    orderedNote: 'widest IC-coded span first',
    fingerprintSQL: `WITH active AS (SELECT * FROM dim_employee WHERE hire_date <= DATE '2026-06-30' AND (termination_date IS NULL OR termination_date > DATE '2026-06-30')), manager_rollup AS (SELECT manager_employee_id, count(*) AS direct_reports FROM active WHERE manager_employee_id IS NOT NULL GROUP BY 1) SELECT m.employee_id, m.full_name, m.title, m.level, d.division, r.direct_reports FROM manager_rollup r JOIN active m ON m.employee_id = r.manager_employee_id JOIN dim_department d ON m.dept_id = d.dept_id WHERE NOT (m.level LIKE 'M%' OR m.level IN ('D1', 'VP')) ORDER BY r.direct_reports DESC, m.full_name LIMIT 10`,
    fingerprintMessage: `That only checked level. The coding rule also treats manager-like titles as manager-coded, so include the title pattern before labeling someone IC-coded.`,
    hints: [
      `First count actual managers from the reporting edge. Then classify their own employee row.`,
      `Manager-coded is broader than level: level M*, D1, VP, or manager-like words in title.`,
      `WITH active AS (SELECT * FROM dim_employee WHERE hire_date <= DATE '2026-06-30' AND (termination_date IS NULL OR termination_date > DATE '2026-06-30')), manager_rollup AS (SELECT manager_employee_id, count(*) AS direct_reports FROM active WHERE manager_employee_id IS NOT NULL GROUP BY 1) SELECT m.employee_id, m.full_name, m.title, m.level, d.division, r.direct_reports FROM manager_rollup r JOIN active m ON m.employee_id = r.manager_employee_id JOIN dim_department d ON m.dept_id = d.dept_id WHERE NOT (m.level LIKE 'M%' OR m.level IN ('D1', 'VP') OR regexp_matches(lower(m.title), 'manager|director|vp|chief|head')) ORDER BY r.direct_reports DESC, m.full_name LIMIT 10;`,
    ],
    sayIt: `"Seven active span owners are IC-coded by level and title, covering 226 active reports. I would treat that as a data-governance queue before turning it into a people-management conclusion."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm90',
    part: 16,
    title: 'Measure actual span by division',
    from: 'priya',
    ask: `Roll the actual manager spans up by the manager's division. Use people who truly have active direct reports, not everyone whose level looks managerial. Show managers_with_reports, direct_reports, average span, and max span.`,
    deliverable: `One row per manager division: division, managers_with_reports, direct_reports, avg_span, and max_span. Round avg_span to 2; sort highest avg_span first, then division.`,
    tables: ['dim_employee', 'dim_department'],
    canonical: `WITH active AS (SELECT * FROM dim_employee WHERE hire_date <= DATE '2026-06-30' AND (termination_date IS NULL OR termination_date > DATE '2026-06-30')), manager_rollup AS (SELECT manager_employee_id, count(*) AS direct_reports FROM active WHERE manager_employee_id IS NOT NULL GROUP BY 1), actual_managers AS (SELECT m.employee_id, d.division, r.direct_reports FROM manager_rollup r JOIN active m ON m.employee_id = r.manager_employee_id JOIN dim_department d ON m.dept_id = d.dept_id) SELECT division, count(*) AS managers_with_reports, sum(direct_reports) AS direct_reports, round(avg(direct_reports), 2) AS avg_span, max(direct_reports) AS max_span FROM actual_managers GROUP BY division ORDER BY avg_span DESC, division`,
    ordered: true,
    orderedNote: 'highest average span first',
    fingerprintSQL: `WITH active AS (SELECT * FROM dim_employee WHERE hire_date <= DATE '2026-06-30' AND (termination_date IS NULL OR termination_date > DATE '2026-06-30')), manager_rollup AS (SELECT manager_employee_id, count(*) AS direct_reports FROM active WHERE manager_employee_id IS NOT NULL GROUP BY 1), active_managers AS (SELECT m.employee_id, d.division, coalesce(r.direct_reports, 0) AS direct_reports FROM active m JOIN dim_department d USING (dept_id) LEFT JOIN manager_rollup r ON r.manager_employee_id = m.employee_id WHERE m.level LIKE 'M%' OR m.level = 'D1' OR m.level = 'VP') SELECT division, count(*) AS managers_with_reports, sum(direct_reports) AS direct_reports, round(avg(direct_reports), 2) AS avg_span, max(direct_reports) AS max_span FROM active_managers GROUP BY division ORDER BY avg_span DESC, division`,
    fingerprintMessage: `That denominator is formal manager-coded employees, including many with zero active reports and missing the IC-coded people who do have reports. For this control, define managers from the reporting edge: people with active direct reports.`,
    hints: [
      `Build manager_rollup from active reports grouped by manager_employee_id. That is the set of actual managers for this metric.`,
      `Join dim_department through the manager row so the rollup is by manager division.`,
      `WITH active AS (SELECT * FROM dim_employee WHERE hire_date <= DATE '2026-06-30' AND (termination_date IS NULL OR termination_date > DATE '2026-06-30')), manager_rollup AS (SELECT manager_employee_id, count(*) AS direct_reports FROM active WHERE manager_employee_id IS NOT NULL GROUP BY 1), actual_managers AS (SELECT m.employee_id, d.division, r.direct_reports FROM manager_rollup r JOIN active m ON m.employee_id = r.manager_employee_id JOIN dim_department d ON m.dept_id = d.dept_id) SELECT division, count(*) AS managers_with_reports, sum(direct_reports) AS direct_reports, round(avg(direct_reports), 2) AS avg_span, max(direct_reports) AS max_span FROM actual_managers GROUP BY division ORDER BY avg_span DESC, division;`,
    ],
    sayIt: `"Using actual reporting edges, R&D has six active managers with 204 active direct reports and a 34.00 average span. That is a span-data readout, not a staffing recommendation."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm91',
    part: 16,
    title: 'Attach June people cost to manager spans',
    from: 'priya',
    ask: `Now add money to the span review. For active employees paid in June, roll each active manager's direct-report compensation plus the manager's own June compensation into a managed pod cost. Rank the ten largest pods.`,
    deliverable: `Ten rows: manager_id, manager_name, division, direct_reports, report_cost_usd, manager_cost_usd, and managed_pod_cost_usd. Round dollars to 2; sort highest managed pod cost first, then manager_name.`,
    tables: ['dim_employee', 'dim_department', 'fct_payroll_monthly'],
    canonical: `WITH active AS (SELECT e.*, p.total_comp_usd FROM dim_employee e JOIN fct_payroll_monthly p USING (employee_id) WHERE p.payroll_month = DATE '2026-06-01' AND e.hire_date <= DATE '2026-06-30' AND (e.termination_date IS NULL OR e.termination_date > DATE '2026-06-30')), manager_rollup AS (SELECT m.employee_id AS manager_id, m.full_name AS manager_name, d.division, count(e.employee_id) AS direct_reports, sum(e.total_comp_usd) AS report_cost, m.total_comp_usd AS manager_cost FROM active e JOIN active m ON e.manager_employee_id = m.employee_id JOIN dim_department d ON m.dept_id = d.dept_id GROUP BY 1, 2, 3, 6) SELECT manager_id, manager_name, division, direct_reports, round(report_cost, 2) AS report_cost_usd, round(manager_cost, 2) AS manager_cost_usd, round(report_cost + manager_cost, 2) AS managed_pod_cost_usd FROM manager_rollup ORDER BY managed_pod_cost_usd DESC, manager_name LIMIT 10`,
    ordered: true,
    orderedNote: 'largest managed pod cost first',
    fingerprintSQL: `WITH active AS (SELECT e.*, p.total_comp_usd FROM dim_employee e JOIN fct_payroll_monthly p USING (employee_id) WHERE p.payroll_month = DATE '2026-06-01' AND e.hire_date <= DATE '2026-06-30' AND (e.termination_date IS NULL OR e.termination_date > DATE '2026-06-30')), manager_rollup AS (SELECT m.employee_id AS manager_id, m.full_name AS manager_name, d.division, count(e.employee_id) AS direct_reports, sum(e.total_comp_usd) AS report_cost, m.total_comp_usd AS manager_cost FROM active e JOIN active m ON e.manager_employee_id = m.employee_id JOIN dim_department d ON m.dept_id = d.dept_id GROUP BY 1, 2, 3, 6) SELECT manager_id, manager_name, division, direct_reports, round(report_cost, 2) AS report_cost_usd, round(manager_cost, 2) AS manager_cost_usd, round(report_cost, 2) AS managed_pod_cost_usd FROM manager_rollup ORDER BY managed_pod_cost_usd DESC, manager_name LIMIT 10`,
    fingerprintMessage: `The managed pod cost left out the manager's own June compensation. Add manager_cost to report_cost for the final ranking.`,
    hints: [
      `Join June payroll into the active roster before the self-join, so both reports and managers carry total_comp_usd.`,
      `report_cost is the sum of direct reports. managed_pod_cost adds the manager's own June cost.`,
      `WITH active AS (SELECT e.*, p.total_comp_usd FROM dim_employee e JOIN fct_payroll_monthly p USING (employee_id) WHERE p.payroll_month = DATE '2026-06-01' AND e.hire_date <= DATE '2026-06-30' AND (e.termination_date IS NULL OR e.termination_date > DATE '2026-06-30')), manager_rollup AS (SELECT m.employee_id AS manager_id, m.full_name AS manager_name, d.division, count(e.employee_id) AS direct_reports, sum(e.total_comp_usd) AS report_cost, m.total_comp_usd AS manager_cost FROM active e JOIN active m ON e.manager_employee_id = m.employee_id JOIN dim_department d ON m.dept_id = d.dept_id GROUP BY 1, 2, 3, 6) SELECT manager_id, manager_name, division, direct_reports, round(report_cost, 2) AS report_cost_usd, round(manager_cost, 2) AS manager_cost_usd, round(report_cost + manager_cost, 2) AS managed_pod_cost_usd FROM manager_rollup ORDER BY managed_pod_cost_usd DESC, manager_name LIMIT 10;`,
    ],
    sayIt: `"The largest managed pod is Lena Johnson's at $653.6 thousand of June people cost, including her own cost. This is exposure tied to the loaded payroll fixture, not a productivity judgment."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm92',
    part: 16,
    title: 'Package the org manager review',
    from: 'maria',
    ask: `Package the manager-map review for Riff: active roster coverage, broken active manager links, number of actual managers, IC-coded manager count, widest span, and highest managed-pod cost. One row, with careful labels.`,
    deliverable: `Exactly one row: active_employees, active_without_manager_id, active_missing_active_manager, actual_managers, ic_coded_managers, widest_manager, widest_direct_reports, highest_cost_manager, and highest_managed_pod_cost_usd. Round dollars to 2.`,
    tables: ['dim_employee', 'dim_department', 'fct_payroll_monthly'],
    canonical: `WITH active AS (SELECT e.*, p.total_comp_usd FROM dim_employee e JOIN fct_payroll_monthly p USING (employee_id) WHERE p.payroll_month = DATE '2026-06-01' AND e.hire_date <= DATE '2026-06-30' AND (e.termination_date IS NULL OR e.termination_date > DATE '2026-06-30')), manager_edges AS (SELECT e.employee_id, e.manager_employee_id, m.employee_id AS active_manager_id FROM active e LEFT JOIN active m ON e.manager_employee_id = m.employee_id), manager_rollup AS (SELECT manager_employee_id, count(*) AS direct_reports, sum(total_comp_usd) AS report_cost FROM active WHERE manager_employee_id IS NOT NULL GROUP BY 1), actual_managers AS (SELECT m.*, r.direct_reports, r.report_cost FROM manager_rollup r JOIN active m ON m.employee_id = r.manager_employee_id), coding AS (SELECT *, CASE WHEN level LIKE 'M%' OR level IN ('D1', 'VP') OR regexp_matches(lower(title), 'manager|director|vp|chief|head') THEN true ELSE false END AS manager_coded FROM actual_managers), top_span AS (SELECT * FROM coding ORDER BY direct_reports DESC, full_name LIMIT 1), top_cost AS (SELECT * FROM coding ORDER BY report_cost + total_comp_usd DESC, full_name LIMIT 1) SELECT count(*) AS active_employees, count(*) FILTER (WHERE manager_employee_id IS NULL) AS active_without_manager_id, count(*) FILTER (WHERE manager_employee_id IS NOT NULL AND active_manager_id IS NULL) AS active_missing_active_manager, (SELECT count(*) FROM actual_managers) AS actual_managers, (SELECT count(*) FROM coding WHERE NOT manager_coded) AS ic_coded_managers, (SELECT full_name FROM top_span) AS widest_manager, (SELECT direct_reports FROM top_span) AS widest_direct_reports, (SELECT full_name FROM top_cost) AS highest_cost_manager, round((SELECT report_cost + total_comp_usd FROM top_cost), 2) AS highest_managed_pod_cost_usd FROM manager_edges`,
    ordered: false,
    fingerprintSQL: `WITH active AS (SELECT e.*, p.total_comp_usd FROM dim_employee e JOIN fct_payroll_monthly p USING (employee_id) WHERE p.payroll_month = DATE '2026-06-01' AND e.hire_date <= DATE '2026-06-30' AND (e.termination_date IS NULL OR e.termination_date > DATE '2026-06-30')), manager_edges AS (SELECT e.employee_id, e.manager_employee_id, m.employee_id AS active_manager_id FROM active e LEFT JOIN active m ON e.manager_employee_id = m.employee_id), manager_rollup AS (SELECT manager_employee_id, count(*) AS direct_reports, sum(total_comp_usd) AS report_cost FROM active WHERE manager_employee_id IS NOT NULL GROUP BY 1), actual_managers AS (SELECT m.*, r.direct_reports, r.report_cost FROM manager_rollup r JOIN active m ON m.employee_id = r.manager_employee_id), coding AS (SELECT *, CASE WHEN level LIKE 'M%' OR level IN ('D1', 'VP') THEN true ELSE false END AS manager_coded FROM actual_managers), top_span AS (SELECT * FROM coding ORDER BY direct_reports DESC, full_name LIMIT 1), top_cost AS (SELECT * FROM coding ORDER BY report_cost + total_comp_usd DESC, full_name LIMIT 1) SELECT count(*) AS active_employees, count(*) FILTER (WHERE manager_employee_id IS NULL) AS active_without_manager_id, count(*) FILTER (WHERE manager_employee_id IS NOT NULL AND active_manager_id IS NULL) AS active_missing_active_manager, (SELECT count(*) FROM actual_managers) AS actual_managers, (SELECT count(*) FROM coding WHERE NOT manager_coded) AS ic_coded_managers, (SELECT full_name FROM top_span) AS widest_manager, (SELECT direct_reports FROM top_span) AS widest_direct_reports, (SELECT full_name FROM top_cost) AS highest_cost_manager, round((SELECT report_cost + total_comp_usd FROM top_cost), 2) AS highest_managed_pod_cost_usd FROM manager_edges`,
    fingerprintMessage: `The handoff reused the level-only coding rule. The scenario's manager-coded rule includes level and title, so keep the title pattern in the final IC-coded manager count.`,
    hints: [
      `Use one active payroll roster, one manager_edges CTE for broken links, and one actual_managers CTE from reporting edges.`,
      `The final row should not recommend reorg action. It packages data readiness, span, and cost exposure for review.`,
      `The correct handoff shows 672 active employees, 12 without manager ids, 302 missing active manager links, 11 actual managers, 7 IC-coded managers, Lena Johnson as both widest span owner and highest managed-pod cost owner, and $653,574.05 of managed June pod cost.`,
    ],
    sayIt: `"The manager map is not ready for direct capacity decisions: 302 active employees point to inactive or missing active manager rows, and 7 actual managers are IC-coded by level/title. Lena Johnson is the largest current span and cost exposure owner in the clean active-manager subset."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm93',
    part: 17,
    title: 'Size the June licensed-seat book',
    from: 'priya',
    ask: `Riff wants the starting point for a licensed-seat book review. For the June 2026 subscription snapshot, show each subscription plan's active customer count, licensed seats, and ending ARR. Seats are contracted licenses in this warehouse—not people who actually used the product.`,
    deliverable: `Three rows: plan_name, customers, licensed_seats, and ending_arr_usd. Round ARR to 2; sort highest ending ARR first, then plan_name.`,
    tables: ['fct_subscription_snapshot_monthly'],
    canonical: `SELECT plan_name, count(*) AS customers, sum(seats) AS licensed_seats, round(sum(arr_usd), 2) AS ending_arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01' GROUP BY plan_name ORDER BY ending_arr_usd DESC, plan_name`,
    ordered: true,
    orderedNote: 'highest ending ARR first, then plan name',
    fingerprintSQL: `SELECT plan_name, count(*) AS customers, count(seats) AS licensed_seats, round(sum(arr_usd), 2) AS ending_arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01' GROUP BY plan_name ORDER BY ending_arr_usd DESC, plan_name`,
    fingerprintMessage: `That counted customer rows twice: count(*) and count(seats) are both customer counts because every June row has a seat value. Licensed seats are additive here, so SUM(seats) is the seat-book total.`,
    hints: [
      `Treat the June snapshot like a pivot: Rows = plan_name; Values = count of customer rows, sum of seats, and sum of ARR.`,
      `Pin month_start to June 1 before grouping. One row is one active customer in one month, and SUM(seats)—not COUNT(seats)—adds the licensed seats.`,
      `SELECT plan_name, count(*) AS customers, sum(seats) AS licensed_seats, round(sum(arr_usd), 2) AS ending_arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01' GROUP BY plan_name ORDER BY ending_arr_usd DESC, plan_name;\n\nEnterprise has 325 customers, 35,739 licensed seats, and $55.83 million of ending ARR; Growth has 1,289 customers, 22,630 seats, and $14.93 million; Starter has 3,255 customers, 9,827 seats, and $3.90 million. These are licensed-seat and month-end ARR facts, not usage or realized pricing.`,
    ],
    sayIt: `"The June book holds 4,869 active customers and 68,196 licensed seats. Enterprise carries most ARR and seats despite the smallest logo count; that is a subscription-book baseline, not evidence of product usage."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm94',
    part: 17,
    title: 'Bridge the licensed-seat book year over year',
    from: 'elena',
    ask: `Rex wants the full customer bridge from June 2025 to June 2026. Keep customers found in either snapshot. Split customers absent from the prior endpoint into new logos versus reactivations using first_contract_date, then classify customers present at both endpoints by ARR change. Call those customers endpoint-retained—this two-snapshot bridge cannot prove they stayed active continuously. Carry licensed seats and ending ARR through the bridge; never relabel seats as usage.`,
    deliverable: `Six rows: movement_type, customers, june_2025_licensed_seats, june_2026_licensed_seats, licensed_seat_delta, june_2025_arr_usd, june_2026_arr_usd, and arr_delta_usd. Use new, reactivated, churned, endpoint_expansion, endpoint_contraction, and endpoint_no_arr_change. Round ARR to 2; sort largest ARR delta first, then movement_type.`,
    tables: ['fct_subscription_snapshot_monthly', 'dim_customer'],
    canonical: `WITH base AS (SELECT customer_id, seats, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2025-06-01'), now AS (SELECT customer_id, seats, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'), bridge AS (SELECT CASE WHEN b.customer_id IS NULL AND d.first_contract_date > DATE '2025-06-30' THEN 'new' WHEN b.customer_id IS NULL THEN 'reactivated' WHEN n.customer_id IS NULL THEN 'churned' WHEN n.arr_usd > b.arr_usd THEN 'endpoint_expansion' WHEN n.arr_usd < b.arr_usd THEN 'endpoint_contraction' ELSE 'endpoint_no_arr_change' END AS movement_type, coalesce(b.seats, 0) AS base_seats, coalesce(n.seats, 0) AS now_seats, coalesce(b.arr_usd, 0) AS base_arr, coalesce(n.arr_usd, 0) AS now_arr FROM base b FULL OUTER JOIN now n USING (customer_id) JOIN dim_customer d ON d.customer_id = coalesce(n.customer_id, b.customer_id)) SELECT movement_type, count(*) AS customers, sum(base_seats) AS june_2025_licensed_seats, sum(now_seats) AS june_2026_licensed_seats, sum(now_seats - base_seats) AS licensed_seat_delta, round(sum(base_arr), 2) AS june_2025_arr_usd, round(sum(now_arr), 2) AS june_2026_arr_usd, round(sum(now_arr - base_arr), 2) AS arr_delta_usd FROM bridge GROUP BY movement_type ORDER BY arr_delta_usd DESC, movement_type`,
    ordered: true,
    orderedNote: 'largest ARR delta first, then movement type',
    fingerprintSQL: `WITH base AS (SELECT customer_id, seats, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2025-06-01'), now AS (SELECT customer_id, seats, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'), bridge AS (SELECT CASE WHEN b.customer_id IS NULL AND d.first_contract_date > DATE '2025-06-30' THEN 'new' WHEN b.customer_id IS NULL THEN 'reactivated' WHEN n.customer_id IS NULL THEN 'churned' WHEN n.arr_usd > b.arr_usd THEN 'endpoint_expansion' WHEN n.arr_usd < b.arr_usd THEN 'endpoint_contraction' ELSE 'endpoint_no_arr_change' END AS movement_type, coalesce(b.seats, 0) AS base_seats, coalesce(n.seats, 0) AS now_seats, coalesce(b.arr_usd, 0) AS base_arr, coalesce(n.arr_usd, 0) AS now_arr FROM base b JOIN now n USING (customer_id) JOIN dim_customer d ON d.customer_id = coalesce(n.customer_id, b.customer_id)) SELECT movement_type, count(*) AS customers, sum(base_seats) AS june_2025_licensed_seats, sum(now_seats) AS june_2026_licensed_seats, sum(now_seats - base_seats) AS licensed_seat_delta, round(sum(base_arr), 2) AS june_2025_arr_usd, round(sum(now_arr), 2) AS june_2026_arr_usd, round(sum(now_arr - base_arr), 2) AS arr_delta_usd FROM bridge GROUP BY movement_type ORDER BY arr_delta_usd DESC, movement_type`,
    fingerprintMessage: `The inner join kept only customers present at both endpoints. Use a FULL OUTER JOIN so new, reactivated, and churned populations remain in the customer, licensed-seat, and ARR bridge.`,
    hints: [
      `Build one customer-grain helper table for each June endpoint. FULL OUTER JOIN keeps unmatched ids from both tabs; dim_customer.first_contract_date separates a post-prior-endpoint first contract from a returning customer.`,
      `For unmatched current rows, first_contract_date after June 30, 2025 means new; an older first contract means reactivated. Compare ARR only for customers present at both endpoints, and name that endpoint status honestly.`,
      `WITH base AS (SELECT customer_id, seats, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2025-06-01'), now AS (SELECT customer_id, seats, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'), bridge AS (SELECT CASE WHEN b.customer_id IS NULL AND d.first_contract_date > DATE '2025-06-30' THEN 'new' WHEN b.customer_id IS NULL THEN 'reactivated' WHEN n.customer_id IS NULL THEN 'churned' WHEN n.arr_usd > b.arr_usd THEN 'endpoint_expansion' WHEN n.arr_usd < b.arr_usd THEN 'endpoint_contraction' ELSE 'endpoint_no_arr_change' END AS movement_type, coalesce(b.seats, 0) AS base_seats, coalesce(n.seats, 0) AS now_seats, coalesce(b.arr_usd, 0) AS base_arr, coalesce(n.arr_usd, 0) AS now_arr FROM base b FULL OUTER JOIN now n USING (customer_id) JOIN dim_customer d ON d.customer_id = coalesce(n.customer_id, b.customer_id)) SELECT movement_type, count(*) AS customers, sum(base_seats) AS june_2025_licensed_seats, sum(now_seats) AS june_2026_licensed_seats, sum(now_seats - base_seats) AS licensed_seat_delta, round(sum(base_arr), 2) AS june_2025_arr_usd, round(sum(now_arr), 2) AS june_2026_arr_usd, round(sum(now_arr - base_arr), 2) AS arr_delta_usd FROM bridge GROUP BY movement_type ORDER BY arr_delta_usd DESC, movement_type;\n\nThe current-only population contains 2,178 new logos and 32 reactivations; churn removes 1,224 customers. Customers present at both endpoints add $2.25 million of ARR in aggregate, but 33 of them churned and returned inside the interval, so endpoint-retained does not mean continuously retained. This bridge describes loaded snapshot change, not usage, renewal cause, or health.`,
    ],
    sayIt: `"The full bridge moves from 49,796 to 68,196 licensed seats and adds $21.11 million of ending ARR. It separates 2,178 new logos from 32 reactivations, and I would call the matched population endpoint-retained because two snapshots cannot prove continuous retention."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm95',
    part: 17,
    title: 'Profile ARR per licensed seat',
    from: 'danny',
    ask: `Zi wants to understand how loaded ARR per licensed seat varies inside each June plan—not just one blended ratio. Calculate the customer-level ratio first, show its 25th percentile, median, and 75th percentile, then compare that distribution with the seat-weighted book ratio: total ARR divided by total licensed seats. Call it ARR per licensed seat, never realized price or discount.`,
    deliverable: `Three rows: plan_name, customers, arr_per_licensed_seat_p25_usd, arr_per_licensed_seat_median_usd, arr_per_licensed_seat_p75_usd, and weighted_arr_per_licensed_seat_usd. Round ratios to 2; sort highest median first, then plan_name.`,
    tables: ['fct_subscription_snapshot_monthly'],
    canonical: `WITH ratios AS (SELECT plan_name, seats, arr_usd, arr_usd / seats AS arr_per_licensed_seat FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01' AND seats > 0) SELECT plan_name, count(*) AS customers, round(quantile_cont(arr_per_licensed_seat, 0.25), 2) AS arr_per_licensed_seat_p25_usd, round(median(arr_per_licensed_seat), 2) AS arr_per_licensed_seat_median_usd, round(quantile_cont(arr_per_licensed_seat, 0.75), 2) AS arr_per_licensed_seat_p75_usd, round(sum(arr_usd) / sum(seats), 2) AS weighted_arr_per_licensed_seat_usd FROM ratios GROUP BY plan_name ORDER BY arr_per_licensed_seat_median_usd DESC, plan_name`,
    ordered: true,
    orderedNote: 'highest customer-level median first, then plan name',
    fingerprintSQL: `WITH ratios AS (SELECT plan_name, seats, arr_usd, arr_usd / seats AS arr_per_licensed_seat FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01' AND seats > 0) SELECT plan_name, count(*) AS customers, round(quantile_cont(arr_per_licensed_seat, 0.25), 2) AS arr_per_licensed_seat_p25_usd, round(median(arr_per_licensed_seat), 2) AS arr_per_licensed_seat_median_usd, round(quantile_cont(arr_per_licensed_seat, 0.75), 2) AS arr_per_licensed_seat_p75_usd, round(avg(arr_per_licensed_seat), 2) AS weighted_arr_per_licensed_seat_usd FROM ratios GROUP BY plan_name ORDER BY arr_per_licensed_seat_median_usd DESC, plan_name`,
    fingerprintMessage: `The percentiles are right, but the last column is an unweighted average of customer ratios. The weighted book ratio is SUM(arr_usd) divided by SUM(seats), so a one-seat customer does not carry the same weight as a hundred-seat customer.`,
    hints: [
      `In Excel, add a calculated column on every customer row: ARR / licensed seats. Percentiles come after that row-level calculation.`,
      `Filter to the June snapshot and seats > 0 in a ratios CTE. Percentiles use the row-level ratio; the weighted book ratio uses SUM(arr_usd) / SUM(seats) inside each plan.`,
      `WITH ratios AS (SELECT plan_name, seats, arr_usd, arr_usd / seats AS arr_per_licensed_seat FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01' AND seats > 0) SELECT plan_name, count(*) AS customers, round(quantile_cont(arr_per_licensed_seat, 0.25), 2) AS arr_per_licensed_seat_p25_usd, round(median(arr_per_licensed_seat), 2) AS arr_per_licensed_seat_median_usd, round(quantile_cont(arr_per_licensed_seat, 0.75), 2) AS arr_per_licensed_seat_p75_usd, round(sum(arr_usd) / sum(seats), 2) AS weighted_arr_per_licensed_seat_usd FROM ratios GROUP BY plan_name ORDER BY arr_per_licensed_seat_median_usd DESC, plan_name;\n\nEnterprise's median is $1,551.20 per licensed seat with a $953.84–$2,748.69 interquartile range and a $1,562.24 seat-weighted book ratio. Growth's weighted ratio is $659.92 and Starter's is $397.15. Growth's tight pattern partly reflects fixture construction; none of these loaded ratios proves realized price, discount, or utilization.`,
    ],
    sayIt: `"Enterprise has the widest and highest ARR-per-licensed-seat distribution. Its $1,551 median and $1,562 seat-weighted ratio answer different questions; both are loaded book ratios, not realized price, discount, or usage."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm96',
    part: 17,
    title: 'Attach recognized revenue per licensed seat',
    from: 'elena',
    ask: `Rex wants the June accounting view beside the subscription book. Aggregate June recognized subscription revenue (account 4000) and usage revenue (4010) to customer first, join that result to the June snapshot, and calculate each plan's recognized revenue per licensed seat. This is P&L revenue—not billing or cash.`,
    deliverable: `Three rows: plan_name, licensed_seats, subscription_revenue_usd, usage_revenue_usd, subscription_revenue_per_licensed_seat_usd, and usage_revenue_per_licensed_seat_usd. Round dollars and ratios to 2; sort highest subscription revenue per licensed seat first, then plan_name.`,
    tables: ['fct_subscription_snapshot_monthly', 'fct_gl_transactions'],
    canonical: `WITH customer_revenue AS (SELECT customer_id, sum(amount) FILTER (WHERE account_id = '4000') AS subscription_revenue, sum(amount) FILTER (WHERE account_id = '4010') AS usage_revenue FROM fct_gl_transactions WHERE txn_date >= DATE '2026-06-01' AND txn_date < DATE '2026-07-01' AND account_id IN ('4000', '4010') GROUP BY customer_id) SELECT s.plan_name, sum(s.seats) AS licensed_seats, round(sum(coalesce(r.subscription_revenue, 0)), 2) AS subscription_revenue_usd, round(sum(coalesce(r.usage_revenue, 0)), 2) AS usage_revenue_usd, round(sum(coalesce(r.subscription_revenue, 0)) / sum(s.seats), 2) AS subscription_revenue_per_licensed_seat_usd, round(sum(coalesce(r.usage_revenue, 0)) / sum(s.seats), 2) AS usage_revenue_per_licensed_seat_usd FROM fct_subscription_snapshot_monthly s LEFT JOIN customer_revenue r USING (customer_id) WHERE s.month_start = DATE '2026-06-01' GROUP BY s.plan_name ORDER BY subscription_revenue_per_licensed_seat_usd DESC, s.plan_name`,
    ordered: true,
    orderedNote: 'highest subscription revenue per licensed seat first, then plan name',
    fingerprintSQL: `WITH customer_revenue AS (SELECT customer_id, sum(amount) FILTER (WHERE account_id = '4000') AS subscription_revenue, sum(amount) FILTER (WHERE account_id = '4010') AS usage_revenue FROM fct_gl_transactions WHERE txn_date >= DATE '2026-06-01' AND txn_date < DATE '2026-07-01' AND account_id IN ('4000', '4010') GROUP BY customer_id) SELECT s.plan_name, sum(s.seats) AS licensed_seats, round(sum(coalesce(r.subscription_revenue, 0)), 2) AS subscription_revenue_usd, round(sum(coalesce(r.usage_revenue, 0)), 2) AS usage_revenue_usd, round(sum(coalesce(r.subscription_revenue, 0)) / count(*), 2) AS subscription_revenue_per_licensed_seat_usd, round(sum(coalesce(r.usage_revenue, 0)) / count(*), 2) AS usage_revenue_per_licensed_seat_usd FROM fct_subscription_snapshot_monthly s LEFT JOIN customer_revenue r USING (customer_id) WHERE s.month_start = DATE '2026-06-01' GROUP BY s.plan_name ORDER BY subscription_revenue_per_licensed_seat_usd DESC, s.plan_name`,
    fingerprintMessage: `The revenue dollars tie, but both per-seat columns divide by customer rows. The denominator is the plan's SUM(seats), because the requested unit is one licensed seat rather than one customer.`,
    hints: [
      `GL is line-grain and the snapshot is customer-month grain. Aggregate the two June revenue accounts to one row per customer before joining, just like making a clean lookup tab before XLOOKUP.`,
      `Drive from the June snapshot, LEFT JOIN customer revenue, then divide each plan's recognized subscription and usage totals by SUM(seats).`,
      `WITH customer_revenue AS (SELECT customer_id, sum(amount) FILTER (WHERE account_id = '4000') AS subscription_revenue, sum(amount) FILTER (WHERE account_id = '4010') AS usage_revenue FROM fct_gl_transactions WHERE txn_date >= DATE '2026-06-01' AND txn_date < DATE '2026-07-01' AND account_id IN ('4000', '4010') GROUP BY customer_id) SELECT s.plan_name, sum(s.seats) AS licensed_seats, round(sum(coalesce(r.subscription_revenue, 0)), 2) AS subscription_revenue_usd, round(sum(coalesce(r.usage_revenue, 0)), 2) AS usage_revenue_usd, round(sum(coalesce(r.subscription_revenue, 0)) / sum(s.seats), 2) AS subscription_revenue_per_licensed_seat_usd, round(sum(coalesce(r.usage_revenue, 0)) / sum(s.seats), 2) AS usage_revenue_per_licensed_seat_usd FROM fct_subscription_snapshot_monthly s LEFT JOIN customer_revenue r USING (customer_id) WHERE s.month_start = DATE '2026-06-01' GROUP BY s.plan_name ORDER BY subscription_revenue_per_licensed_seat_usd DESC, s.plan_name;\n\nEnterprise recognizes $130.19 of subscription and $28.12 of usage revenue per licensed seat in June; Growth recognizes $54.99 and $11.92; Starter recognizes $33.10 and no usage revenue. These are recognized-revenue ratios, not billing, collections, or cash.`,
    ],
    sayIt: `"Enterprise recognizes $130.19 of subscription and $28.12 of usage revenue per licensed seat in June, versus $54.99 and $11.92 for Growth. Those are P&L ratios by plan—not billing, collections, or cash."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm97',
    part: 17,
    title: 'Measure concentration inside each plan',
    from: 'priya',
    ask: `Riff wants concentration measured inside each plan. Rank June customers by ending ARR within their own plan, then compare those same ten ARR-ranked accounts' share of the plan's licensed seats with their share of its ARR. Do not silently switch to a different top-ten population, and do not turn concentration into a renewal, capacity, or pricing recommendation.`,
    deliverable: `Three rows: plan_name, customers, licensed_seats, ending_arr_usd, top_10_arr_accounts_licensed_seat_share_pct, and top_10_arr_accounts_arr_share_pct. Round ARR to 2 and shares to 1; sort highest top-ten ARR share first, then plan_name.`,
    tables: ['fct_subscription_snapshot_monthly'],
    canonical: `WITH ranked AS (SELECT plan_name, customer_id, seats, arr_usd, row_number() OVER (PARTITION BY plan_name ORDER BY arr_usd DESC, customer_id) AS arr_rank FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01') SELECT plan_name, count(*) AS customers, sum(seats) AS licensed_seats, round(sum(arr_usd), 2) AS ending_arr_usd, round(100.0 * sum(seats) FILTER (WHERE arr_rank <= 10) / sum(seats), 1) AS top_10_arr_accounts_licensed_seat_share_pct, round(100.0 * sum(arr_usd) FILTER (WHERE arr_rank <= 10) / sum(arr_usd), 1) AS top_10_arr_accounts_arr_share_pct FROM ranked GROUP BY plan_name ORDER BY top_10_arr_accounts_arr_share_pct DESC, plan_name`,
    ordered: true,
    orderedNote: 'highest within-plan top-ten ARR share first, then plan name',
    fingerprintSQL: `WITH ranked AS (SELECT plan_name, customer_id, seats, arr_usd, row_number() OVER (ORDER BY arr_usd DESC, customer_id) AS arr_rank FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01') SELECT plan_name, count(*) AS customers, sum(seats) AS licensed_seats, round(sum(arr_usd), 2) AS ending_arr_usd, round(100.0 * sum(seats) FILTER (WHERE arr_rank <= 10) / sum(seats), 1) AS top_10_arr_accounts_licensed_seat_share_pct, round(100.0 * sum(arr_usd) FILTER (WHERE arr_rank <= 10) / sum(arr_usd), 1) AS top_10_arr_accounts_arr_share_pct FROM ranked GROUP BY plan_name ORDER BY top_10_arr_accounts_arr_share_pct DESC, plan_name`,
    fingerprintMessage: `That ranks one global top ten, so Growth and Starter never get their own ten-account comparison. PARTITION BY plan_name inside ROW_NUMBER restarts the ARR rank for each plan before you calculate within-plan shares.`,
    hints: [
      `Think three separate ranked sheets, one per plan. ROW_NUMBER with PARTITION BY plan_name restarts at one inside each plan.`,
      `Rank by ARR descending with customer_id as a stable tie-break. In the grouped result, conditionally sum seats and ARR where arr_rank <= 10, then divide each by its full plan total.`,
      `WITH ranked AS (SELECT plan_name, customer_id, seats, arr_usd, row_number() OVER (PARTITION BY plan_name ORDER BY arr_usd DESC, customer_id) AS arr_rank FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01') SELECT plan_name, count(*) AS customers, sum(seats) AS licensed_seats, round(sum(arr_usd), 2) AS ending_arr_usd, round(100.0 * sum(seats) FILTER (WHERE arr_rank <= 10) / sum(seats), 1) AS top_10_arr_accounts_licensed_seat_share_pct, round(100.0 * sum(arr_usd) FILTER (WHERE arr_rank <= 10) / sum(arr_usd), 1) AS top_10_arr_accounts_arr_share_pct FROM ranked GROUP BY plan_name ORDER BY top_10_arr_accounts_arr_share_pct DESC, plan_name;\n\nEnterprise's ten highest-ARR accounts hold 3.1% of licensed seats and 6.8% of ARR; Growth's shares are both 2.4%; Starter's are 0.3% and 0.5%. These are two shares for the same ARR-ranked cohort, not independent top-seat and top-ARR lists and not evidence for renewal, health, capacity, or pricing action.`,
    ],
    sayIt: `"Enterprise's top ten accounts carry 6.8% of plan ARR against 3.1% of licensed seats, the widest gap of the three plans. That identifies review concentration only; it does not support a commercial recommendation."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm98',
    part: 17,
    title: 'Build the highest-ratio account queue',
    from: 'elena',
    ask: `Rex needs a ten-account review queue sorted by June ARR per licensed seat. Add the current customer label and the latest CSM assignment known by June 30, 2026. Filter the assignment history to the cutoff before selecting one row per customer, and keep an account even if no assignment resolves. The queue is for data review—not a renewal, health, capacity, or pricing call.`,
    deliverable: `Ten rows: customer_id, customer_name, current_segment, plan_name, licensed_seats, ending_arr_usd, arr_per_licensed_seat_usd, as_of_csm_name, and csm_assigned_on. Sort highest ARR per licensed seat first, then ending ARR, then customer_id.`,
    tables: ['fct_subscription_snapshot_monthly', 'dim_customer', 'stg_customer_csm_assignments'],
    canonical: `WITH latest_csm AS (SELECT customer_id, csm_name, assigned_on FROM stg_customer_csm_assignments WHERE assigned_on <= DATE '2026-06-30' QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name) = 1) SELECT s.customer_id, c.customer_name, c.segment AS current_segment, s.plan_name, s.seats AS licensed_seats, round(s.arr_usd, 2) AS ending_arr_usd, round(s.arr_usd / s.seats, 2) AS arr_per_licensed_seat_usd, l.csm_name AS as_of_csm_name, l.assigned_on AS csm_assigned_on FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) LEFT JOIN latest_csm l USING (customer_id) WHERE s.month_start = DATE '2026-06-01' AND s.seats > 0 ORDER BY arr_per_licensed_seat_usd DESC, ending_arr_usd DESC, s.customer_id LIMIT 10`,
    ordered: true,
    orderedNote: 'highest ARR per licensed seat first, then ending ARR, then customer id',
    fingerprintSQL: `WITH latest_csm AS (SELECT customer_id, csm_name, assigned_on FROM stg_customer_csm_assignments WHERE assigned_on <= DATE '2026-06-30' QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on, csm_name) = 1) SELECT s.customer_id, c.customer_name, c.segment AS current_segment, s.plan_name, s.seats AS licensed_seats, round(s.arr_usd, 2) AS ending_arr_usd, round(s.arr_usd / s.seats, 2) AS arr_per_licensed_seat_usd, l.csm_name AS as_of_csm_name, l.assigned_on AS csm_assigned_on FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) LEFT JOIN latest_csm l USING (customer_id) WHERE s.month_start = DATE '2026-06-01' AND s.seats > 0 ORDER BY arr_per_licensed_seat_usd DESC, ending_arr_usd DESC, s.customer_id LIMIT 10`,
    fingerprintMessage: `The account ranking is right, but the assignment window keeps each customer's earliest CSM row. Order assigned_on DESC inside ROW_NUMBER so rank one is the latest assignment known by the June 30 cutoff.`,
    requireRegex: ASSIGNMENT_CUTOFF_REQUIREMENT,
    requireMessage: `Keep the CSM lookup as-of June 30. Filter assigned_on to the cutoff before deduping so a later assignment cannot rewrite this review when the staging table grows.`,
    hints: [
      `The CSM sheet is history. Filter assigned_on through June 30 first, then number each customer's rows newest-first and keep row one.`,
      `Join the current customer dimension for labels and LEFT JOIN the deduped CSM result so an unassigned account remains visible. The queue ratio is each June row's ARR divided by its licensed seats.`,
      `WITH latest_csm AS (SELECT customer_id, csm_name, assigned_on FROM stg_customer_csm_assignments WHERE assigned_on <= DATE '2026-06-30' QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name) = 1) SELECT s.customer_id, c.customer_name, c.segment AS current_segment, s.plan_name, s.seats AS licensed_seats, round(s.arr_usd, 2) AS ending_arr_usd, round(s.arr_usd / s.seats, 2) AS arr_per_licensed_seat_usd, l.csm_name AS as_of_csm_name, l.assigned_on AS csm_assigned_on FROM fct_subscription_snapshot_monthly s JOIN dim_customer c USING (customer_id) LEFT JOIN latest_csm l USING (customer_id) WHERE s.month_start = DATE '2026-06-01' AND s.seats > 0 ORDER BY arr_per_licensed_seat_usd DESC, ending_arr_usd DESC, s.customer_id LIMIT 10;\n\nKingsley Biosciences East leads at $14,200.19 of ARR per licensed seat and is assigned to Wren Petrov as of the cutoff. Customer name and segment come from a current-state dimension, and the ratio is not realized price or discount; the fixture contains no renewal, health, utilization, or capacity evidence.`,
    ],
    sayIt: `"Kingsley Biosciences East is the highest loaded ARR-per-licensed-seat account at $14.2 thousand, with Wren Petrov as the latest CSM known by June 30. I would use this as a data-review queue only, not a pricing or account-health conclusion."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm99',
    part: 17,
    title: 'Package the licensed-seat book review',
    from: 'priya',
    ask: `Package the licensed-seat review for Riff in one row: the June book; new, reactivated, and churned customer counts from the full June-to-June bridge; recognized subscription and usage revenue per licensed seat; the plan with the highest within-plan top-ten ARR concentration; and the highest ARR-per-seat account with its latest CSM known by June 30. Keep every label faithful to the loaded data and make no commercial recommendation.`,
    deliverable: `Exactly one row: june_customers, june_licensed_seats, june_ending_arr_usd, june_arr_per_licensed_seat_usd, new_customers, reactivated_customers, churned_customers, yoy_customer_delta, yoy_licensed_seat_delta, yoy_ending_arr_delta_usd, june_subscription_revenue_per_licensed_seat_usd, june_usage_revenue_per_licensed_seat_usd, highest_top_10_arr_concentration_plan, highest_top_10_arr_concentration_pct, highest_ratio_current_customer_name, highest_arr_per_licensed_seat_usd, and highest_ratio_as_of_csm. Round dollars and ratios to 2 and concentration to 1.`,
    tables: ['fct_subscription_snapshot_monthly', 'fct_gl_transactions', 'dim_customer', 'stg_customer_csm_assignments'],
    canonical: `WITH june AS (SELECT customer_id, plan_name, seats, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'), base AS (SELECT customer_id, seats, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2025-06-01'), totals AS (SELECT count(*) AS june_customers, sum(seats) AS june_licensed_seats, sum(arr_usd) AS june_ending_arr FROM june), bridge_rows AS (SELECT b.customer_id AS prior_id, j.customer_id AS current_id, d.first_contract_date, coalesce(b.seats, 0) AS base_seats, coalesce(j.seats, 0) AS now_seats, coalesce(b.arr_usd, 0) AS base_arr, coalesce(j.arr_usd, 0) AS now_arr FROM base b FULL OUTER JOIN june j USING (customer_id) JOIN dim_customer d ON d.customer_id = coalesce(j.customer_id, b.customer_id)), bridge AS (SELECT count(*) FILTER (WHERE prior_id IS NULL AND first_contract_date > DATE '2025-06-30') AS new_customers, count(*) FILTER (WHERE prior_id IS NULL AND first_contract_date <= DATE '2025-06-30') AS reactivated_customers, count(*) FILTER (WHERE current_id IS NULL) AS churned_customers, sum(CASE WHEN prior_id IS NULL THEN 1 WHEN current_id IS NULL THEN -1 ELSE 0 END) AS customer_delta, sum(now_seats - base_seats) AS seat_delta, sum(now_arr - base_arr) AS arr_delta FROM bridge_rows), customer_revenue AS (SELECT customer_id, sum(amount) FILTER (WHERE account_id = '4000') AS subscription_revenue, sum(amount) FILTER (WHERE account_id = '4010') AS usage_revenue FROM fct_gl_transactions WHERE txn_date >= DATE '2026-06-01' AND txn_date < DATE '2026-07-01' AND account_id IN ('4000', '4010') GROUP BY customer_id), recognized AS (SELECT sum(coalesce(r.subscription_revenue, 0)) AS subscription_revenue, sum(coalesce(r.usage_revenue, 0)) AS usage_revenue FROM june j LEFT JOIN customer_revenue r USING (customer_id)), ranked AS (SELECT plan_name, customer_id, arr_usd, row_number() OVER (PARTITION BY plan_name ORDER BY arr_usd DESC, customer_id) AS arr_rank FROM june), concentration AS (SELECT plan_name, 100.0 * sum(arr_usd) FILTER (WHERE arr_rank <= 10) / sum(arr_usd) AS top_10_arr_share FROM ranked GROUP BY plan_name), top_plan AS (SELECT * FROM concentration ORDER BY top_10_arr_share DESC, plan_name LIMIT 1), latest_csm AS (SELECT customer_id, csm_name FROM stg_customer_csm_assignments WHERE assigned_on <= DATE '2026-06-30' QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name) = 1), top_ratio AS (SELECT c.customer_name, j.arr_usd / j.seats AS arr_per_seat, l.csm_name FROM june j JOIN dim_customer c USING (customer_id) LEFT JOIN latest_csm l USING (customer_id) WHERE j.seats > 0 ORDER BY arr_per_seat DESC, j.arr_usd DESC, j.customer_id LIMIT 1) SELECT t.june_customers, t.june_licensed_seats, round(t.june_ending_arr, 2) AS june_ending_arr_usd, round(t.june_ending_arr / t.june_licensed_seats, 2) AS june_arr_per_licensed_seat_usd, b.new_customers, b.reactivated_customers, b.churned_customers, b.customer_delta AS yoy_customer_delta, b.seat_delta AS yoy_licensed_seat_delta, round(b.arr_delta, 2) AS yoy_ending_arr_delta_usd, round(r.subscription_revenue / t.june_licensed_seats, 2) AS june_subscription_revenue_per_licensed_seat_usd, round(r.usage_revenue / t.june_licensed_seats, 2) AS june_usage_revenue_per_licensed_seat_usd, p.plan_name AS highest_top_10_arr_concentration_plan, round(p.top_10_arr_share, 1) AS highest_top_10_arr_concentration_pct, q.customer_name AS highest_ratio_current_customer_name, round(q.arr_per_seat, 2) AS highest_arr_per_licensed_seat_usd, q.csm_name AS highest_ratio_as_of_csm FROM totals t CROSS JOIN bridge b CROSS JOIN recognized r CROSS JOIN top_plan p CROSS JOIN top_ratio q`,
    ordered: false,
    fingerprintSQL: `WITH june AS (SELECT customer_id, plan_name, seats, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'), base AS (SELECT customer_id, seats, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2025-06-01'), totals AS (SELECT count(*) AS june_customers, sum(seats) AS june_licensed_seats, sum(arr_usd) AS june_ending_arr FROM june), bridge_rows AS (SELECT b.customer_id AS prior_id, j.customer_id AS current_id, d.first_contract_date, coalesce(b.seats, 0) AS base_seats, coalesce(j.seats, 0) AS now_seats, coalesce(b.arr_usd, 0) AS base_arr, coalesce(j.arr_usd, 0) AS now_arr FROM base b JOIN june j USING (customer_id) JOIN dim_customer d ON d.customer_id = coalesce(j.customer_id, b.customer_id)), bridge AS (SELECT count(*) FILTER (WHERE prior_id IS NULL AND first_contract_date > DATE '2025-06-30') AS new_customers, count(*) FILTER (WHERE prior_id IS NULL AND first_contract_date <= DATE '2025-06-30') AS reactivated_customers, count(*) FILTER (WHERE current_id IS NULL) AS churned_customers, sum(CASE WHEN prior_id IS NULL THEN 1 WHEN current_id IS NULL THEN -1 ELSE 0 END) AS customer_delta, sum(now_seats - base_seats) AS seat_delta, sum(now_arr - base_arr) AS arr_delta FROM bridge_rows), customer_revenue AS (SELECT customer_id, sum(amount) FILTER (WHERE account_id = '4000') AS subscription_revenue, sum(amount) FILTER (WHERE account_id = '4010') AS usage_revenue FROM fct_gl_transactions WHERE txn_date >= DATE '2026-06-01' AND txn_date < DATE '2026-07-01' AND account_id IN ('4000', '4010') GROUP BY customer_id), recognized AS (SELECT sum(coalesce(r.subscription_revenue, 0)) AS subscription_revenue, sum(coalesce(r.usage_revenue, 0)) AS usage_revenue FROM june j LEFT JOIN customer_revenue r USING (customer_id)), ranked AS (SELECT plan_name, customer_id, arr_usd, row_number() OVER (PARTITION BY plan_name ORDER BY arr_usd DESC, customer_id) AS arr_rank FROM june), concentration AS (SELECT plan_name, 100.0 * sum(arr_usd) FILTER (WHERE arr_rank <= 10) / sum(arr_usd) AS top_10_arr_share FROM ranked GROUP BY plan_name), top_plan AS (SELECT * FROM concentration ORDER BY top_10_arr_share DESC, plan_name LIMIT 1), latest_csm AS (SELECT customer_id, csm_name FROM stg_customer_csm_assignments WHERE assigned_on <= DATE '2026-06-30' QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name) = 1), top_ratio AS (SELECT c.customer_name, j.arr_usd / j.seats AS arr_per_seat, l.csm_name FROM june j JOIN dim_customer c USING (customer_id) LEFT JOIN latest_csm l USING (customer_id) WHERE j.seats > 0 ORDER BY arr_per_seat DESC, j.arr_usd DESC, j.customer_id LIMIT 1) SELECT t.june_customers, t.june_licensed_seats, round(t.june_ending_arr, 2) AS june_ending_arr_usd, round(t.june_ending_arr / t.june_licensed_seats, 2) AS june_arr_per_licensed_seat_usd, b.new_customers, b.reactivated_customers, b.churned_customers, b.customer_delta AS yoy_customer_delta, b.seat_delta AS yoy_licensed_seat_delta, round(b.arr_delta, 2) AS yoy_ending_arr_delta_usd, round(r.subscription_revenue / t.june_licensed_seats, 2) AS june_subscription_revenue_per_licensed_seat_usd, round(r.usage_revenue / t.june_licensed_seats, 2) AS june_usage_revenue_per_licensed_seat_usd, p.plan_name AS highest_top_10_arr_concentration_plan, round(p.top_10_arr_share, 1) AS highest_top_10_arr_concentration_pct, q.customer_name AS highest_ratio_current_customer_name, round(q.arr_per_seat, 2) AS highest_arr_per_licensed_seat_usd, q.csm_name AS highest_ratio_as_of_csm FROM totals t CROSS JOIN bridge b CROSS JOIN recognized r CROSS JOIN top_plan p CROSS JOIN top_ratio q`,
    fingerprintMessage: `The June point-in-time metrics tie, but the handoff's year-over-year bridge used an inner join. That zeroes the new, reactivated, and churned counts and reduces the bridge deltas to matched endpoints. Keep the FULL OUTER JOIN from the detailed control.`,
    requireRegex: ASSIGNMENT_CUTOFF_REQUIREMENT,
    requireMessage: `The handoff must preserve the historical CSM cutoff. Filter assigned_on through June 30 before selecting the latest CSM so future assignment rows cannot rewrite this review.`,
    hints: [
      `Build small helper tabs: June totals, a full customer bridge with first-contract evidence, customer-grain recognized revenue, within-plan concentration, and the as-of CSM queue. Reduce each to one row before combining them.`,
      `Keep the units and populations separate: month-end ARR and licensed seats come from the snapshot; new versus reactivated comes from first_contract_date; recognized revenue comes from June GL accounts 4000 and 4010; CSM history is cut off and deduped before lookup.`,
      `WITH june AS (SELECT customer_id, plan_name, seats, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'), base AS (SELECT customer_id, seats, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2025-06-01'), totals AS (SELECT count(*) AS june_customers, sum(seats) AS june_licensed_seats, sum(arr_usd) AS june_ending_arr FROM june), bridge_rows AS (SELECT b.customer_id AS prior_id, j.customer_id AS current_id, d.first_contract_date, coalesce(b.seats, 0) AS base_seats, coalesce(j.seats, 0) AS now_seats, coalesce(b.arr_usd, 0) AS base_arr, coalesce(j.arr_usd, 0) AS now_arr FROM base b FULL OUTER JOIN june j USING (customer_id) JOIN dim_customer d ON d.customer_id = coalesce(j.customer_id, b.customer_id)), bridge AS (SELECT count(*) FILTER (WHERE prior_id IS NULL AND first_contract_date > DATE '2025-06-30') AS new_customers, count(*) FILTER (WHERE prior_id IS NULL AND first_contract_date <= DATE '2025-06-30') AS reactivated_customers, count(*) FILTER (WHERE current_id IS NULL) AS churned_customers, sum(CASE WHEN prior_id IS NULL THEN 1 WHEN current_id IS NULL THEN -1 ELSE 0 END) AS customer_delta, sum(now_seats - base_seats) AS seat_delta, sum(now_arr - base_arr) AS arr_delta FROM bridge_rows), customer_revenue AS (SELECT customer_id, sum(amount) FILTER (WHERE account_id = '4000') AS subscription_revenue, sum(amount) FILTER (WHERE account_id = '4010') AS usage_revenue FROM fct_gl_transactions WHERE txn_date >= DATE '2026-06-01' AND txn_date < DATE '2026-07-01' AND account_id IN ('4000', '4010') GROUP BY customer_id), recognized AS (SELECT sum(coalesce(r.subscription_revenue, 0)) AS subscription_revenue, sum(coalesce(r.usage_revenue, 0)) AS usage_revenue FROM june j LEFT JOIN customer_revenue r USING (customer_id)), ranked AS (SELECT plan_name, customer_id, arr_usd, row_number() OVER (PARTITION BY plan_name ORDER BY arr_usd DESC, customer_id) AS arr_rank FROM june), concentration AS (SELECT plan_name, 100.0 * sum(arr_usd) FILTER (WHERE arr_rank <= 10) / sum(arr_usd) AS top_10_arr_share FROM ranked GROUP BY plan_name), top_plan AS (SELECT * FROM concentration ORDER BY top_10_arr_share DESC, plan_name LIMIT 1), latest_csm AS (SELECT customer_id, csm_name FROM stg_customer_csm_assignments WHERE assigned_on <= DATE '2026-06-30' QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY assigned_on DESC, csm_name) = 1), top_ratio AS (SELECT c.customer_name, j.arr_usd / j.seats AS arr_per_seat, l.csm_name FROM june j JOIN dim_customer c USING (customer_id) LEFT JOIN latest_csm l USING (customer_id) WHERE j.seats > 0 ORDER BY arr_per_seat DESC, j.arr_usd DESC, j.customer_id LIMIT 1) SELECT t.june_customers, t.june_licensed_seats, round(t.june_ending_arr, 2) AS june_ending_arr_usd, round(t.june_ending_arr / t.june_licensed_seats, 2) AS june_arr_per_licensed_seat_usd, b.new_customers, b.reactivated_customers, b.churned_customers, b.customer_delta AS yoy_customer_delta, b.seat_delta AS yoy_licensed_seat_delta, round(b.arr_delta, 2) AS yoy_ending_arr_delta_usd, round(r.subscription_revenue / t.june_licensed_seats, 2) AS june_subscription_revenue_per_licensed_seat_usd, round(r.usage_revenue / t.june_licensed_seats, 2) AS june_usage_revenue_per_licensed_seat_usd, p.plan_name AS highest_top_10_arr_concentration_plan, round(p.top_10_arr_share, 1) AS highest_top_10_arr_concentration_pct, q.customer_name AS highest_ratio_current_customer_name, round(q.arr_per_seat, 2) AS highest_arr_per_licensed_seat_usd, q.csm_name AS highest_ratio_as_of_csm FROM totals t CROSS JOIN bridge b CROSS JOIN recognized r CROSS JOIN top_plan p CROSS JOIN top_ratio q;\n\nThe June book is 4,869 customers, 68,196 licensed seats, and $74.67 million of ending ARR, or $1,094.93 per licensed seat. The bridge has 2,178 new logos, 32 reactivations, and 1,224 churned customers, for net growth of 986 customers, 18,400 seats, and $21.11 million of ARR. June recognized revenue is $91.24 of subscription plus $18.70 of usage per licensed seat. Enterprise has the highest top-ten ARR concentration at 6.8%; Kingsley Biosciences East is the highest loaded ratio and Wren Petrov is its latest CSM known by June 30. None of those facts supplies utilization, billing, cash, price, discount, renewal, health, or capacity evidence.`,
    ],
    sayIt: `"June closes at 4,869 customers, 68,196 licensed seats, and $74.67 million of ending ARR. The endpoint bridge separates 2,178 new logos from 32 reactivations and 1,224 churned customers; the ratio and concentration outputs remain review facts, not commercial recommendations."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm100',
    part: 18,
    title: 'Scope the loaded ARR event ledger',
    from: 'elena',
    ask: `Rex here. Before Finance relies on the ARR event ledger, profile the complete loaded history by movement type. Show the population, customer reach, signed ARR movement, and date boundary. The snapshot mart begins later, so do not cut this first control to the mart window.`,
    deliverable: `Five rows: movement_type, movement_rows, customers, net_arr_delta_usd, first_event_date, and last_event_date. Round ARR delta to 2; sort alphabetically by movement_type.`,
    tables: ['fct_arr_movements'],
    canonical: `SELECT movement_type, count(*) AS movement_rows, count(DISTINCT customer_id) AS customers, round(sum(arr_delta_usd), 2) AS net_arr_delta_usd, min(event_date) AS first_event_date, max(event_date) AS last_event_date FROM fct_arr_movements GROUP BY movement_type ORDER BY movement_type`,
    ordered: true,
    orderedNote: 'movement type alphabetically',
    fingerprintSQL: `SELECT movement_type, count(*) AS movement_rows, count(DISTINCT customer_id) AS customers, round(sum(arr_delta_usd), 2) AS net_arr_delta_usd, min(event_date) AS first_event_date, max(event_date) AS last_event_date FROM fct_arr_movements WHERE event_date >= DATE '2023-01-01' GROUP BY movement_type ORDER BY movement_type`,
    fingerprintMessage: `The event ledger begins before the snapshot mart. Profile the complete loaded ledger here; the mart cutoff belongs in the later reconciliation.`,
    hints: [
      `This is a pivot-table profile: movement_type on rows, then counts, signed SUM of delta, and MIN/MAX dates as values.`,
      `Do not add a date filter yet. COUNT DISTINCT customer_id measures customer reach; SUM(arr_delta_usd) keeps contraction and churn signs.`,
      `SELECT movement_type, count(*) AS movement_rows, count(DISTINCT customer_id) AS customers, round(sum(arr_delta_usd), 2) AS net_arr_delta_usd, min(event_date) AS first_event_date, max(event_date) AS last_event_date FROM fct_arr_movements GROUP BY movement_type ORDER BY movement_type;\n\nThe complete ledger contains 16,734 events across five movement types from January 2021 through June 2026. That scopes the loaded event history; it does not certify a production source or a revenue-recognition process.`,
    ],
    sayIt: `"The loaded ledger contains 16,734 events across five movement types and begins before the snapshot mart. I am scoping the internal dataset first, not treating the snapshot window as the full event history."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm101',
    part: 18,
    title: 'Prove event identity and completeness',
    from: 'elena',
    ask: `Now test whether every loaded movement has a unique trace id and the fields needed for the control. A customer can have many events, so customer_id is not the event key.`,
    deliverable: `Exactly one row: movement_rows, distinct_movement_ids, duplicate_movement_ids, null_movement_ids, and incomplete_rows. Incomplete means event_date, customer_id, plan_name, movement_type, delta, before ARR, or after ARR is null.`,
    tables: ['fct_arr_movements'],
    canonical: `SELECT count(*) AS movement_rows, count(DISTINCT movement_id) AS distinct_movement_ids, count(*) - count(DISTINCT movement_id) AS duplicate_movement_ids, count(*) FILTER (WHERE movement_id IS NULL) AS null_movement_ids, count(*) FILTER (WHERE event_date IS NULL OR customer_id IS NULL OR plan_name IS NULL OR movement_type IS NULL OR arr_delta_usd IS NULL OR arr_before_usd IS NULL OR arr_after_usd IS NULL) AS incomplete_rows FROM fct_arr_movements`,
    ordered: false,
    fingerprintSQL: `SELECT count(*) AS movement_rows, count(DISTINCT customer_id) AS distinct_movement_ids, count(*) - count(DISTINCT customer_id) AS duplicate_movement_ids, count(*) FILTER (WHERE customer_id IS NULL) AS null_movement_ids, count(*) FILTER (WHERE event_date IS NULL OR customer_id IS NULL OR plan_name IS NULL OR movement_type IS NULL OR arr_delta_usd IS NULL OR arr_before_usd IS NULL OR arr_after_usd IS NULL) AS incomplete_rows FROM fct_arr_movements`,
    fingerprintMessage: `A customer can have several movements. Test event uniqueness with movement_id, not customer_id.`,
    hints: [
      `Compare COUNT(*) with COUNT(DISTINCT movement_id), then count null ids and rows missing any required field.`,
      `Duplicate events are total rows minus distinct movement ids. Keep plan_name in the completeness test because it is the plan recorded at event time.`,
      `SELECT count(*) AS movement_rows, count(DISTINCT movement_id) AS distinct_movement_ids, count(*) - count(DISTINCT movement_id) AS duplicate_movement_ids, count(*) FILTER (WHERE movement_id IS NULL) AS null_movement_ids, count(*) FILTER (WHERE event_date IS NULL OR customer_id IS NULL OR plan_name IS NULL OR movement_type IS NULL OR arr_delta_usd IS NULL OR arr_before_usd IS NULL OR arr_after_usd IS NULL) AS incomplete_rows FROM fct_arr_movements;\n\nAll 16,734 loaded rows have distinct movement ids and the required fields. That is a loaded-data identity check, not a claim about upstream application controls.`,
    ],
    sayIt: `"All 16,734 loaded events have unique trace ids and complete control fields. Customer id is intentionally non-unique because 7,234 rows are follow-on events in a customer chain."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm102',
    part: 18,
    title: 'Test the row equation in cents',
    from: 'elena',
    ask: `For every event, test that before ARR plus signed movement equals after ARR and that neither endpoint is negative. Convert each amount to rounded integer cents before comparing; raw DOUBLE equality creates fake exceptions.`,
    deliverable: `Exactly one row: equation_exception_rows, negative_before_rows, and negative_after_rows.`,
    tables: ['fct_arr_movements'],
    canonical: `SELECT count(*) FILTER (WHERE round(arr_before_usd * 100)::BIGINT + round(arr_delta_usd * 100)::BIGINT <> round(arr_after_usd * 100)::BIGINT) AS equation_exception_rows, count(*) FILTER (WHERE round(arr_before_usd * 100)::BIGINT < 0) AS negative_before_rows, count(*) FILTER (WHERE round(arr_after_usd * 100)::BIGINT < 0) AS negative_after_rows FROM fct_arr_movements`,
    ordered: false,
    fingerprintSQL: `SELECT count(*) FILTER (WHERE arr_before_usd + arr_delta_usd <> arr_after_usd) AS equation_exception_rows, count(*) FILTER (WHERE arr_before_usd < 0) AS negative_before_rows, count(*) FILTER (WHERE arr_after_usd < 0) AS negative_after_rows FROM fct_arr_movements`,
    fingerprintMessage: `Those apparent breaks are floating-point noise. Convert each amount to rounded cents before testing the equation.`,
    hints: [
      `Treat each dollar field like Excel currency stored as cents: ROUND(amount * 100), then cast to BIGINT.`,
      `Compare before_cents + delta_cents with after_cents. Count negative before and after endpoints separately.`,
      `SELECT count(*) FILTER (WHERE round(arr_before_usd * 100)::BIGINT + round(arr_delta_usd * 100)::BIGINT <> round(arr_after_usd * 100)::BIGINT) AS equation_exception_rows, count(*) FILTER (WHERE round(arr_before_usd * 100)::BIGINT < 0) AS negative_before_rows, count(*) FILTER (WHERE round(arr_after_usd * 100)::BIGINT < 0) AS negative_after_rows FROM fct_arr_movements;\n\nAll loaded rows pass the cents equation and have nonnegative endpoints. Raw floating-point equality would invent 290 exceptions, which is a query defect rather than a ledger finding.`,
    ],
    sayIt: `"The before-plus-movement equation holds for every loaded event at currency precision, with no negative endpoints. I converted to cents so binary floating-point noise could not become a fake control exception."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm103',
    part: 18,
    title: 'Validate movement-type semantics',
    from: 'elena',
    ask: `The row equation can pass while an event is labeled incorrectly. Test the cents-level start, sign, and ending rules for new, reactivation, expansion, contraction, and churn, then show exceptions by type.`,
    deliverable: `Five rows: movement_type, movement_rows, and semantic_exception_rows. Sort alphabetically by movement_type.`,
    tables: ['fct_arr_movements'],
    canonical: `SELECT movement_type, count(*) AS movement_rows, count(*) FILTER (WHERE CASE movement_type WHEN 'new' THEN NOT (round(arr_before_usd * 100)::BIGINT = 0 AND round(arr_delta_usd * 100)::BIGINT > 0 AND round(arr_after_usd * 100)::BIGINT = round(arr_delta_usd * 100)::BIGINT) WHEN 'reactivation' THEN NOT (round(arr_before_usd * 100)::BIGINT = 0 AND round(arr_delta_usd * 100)::BIGINT > 0 AND round(arr_after_usd * 100)::BIGINT = round(arr_delta_usd * 100)::BIGINT) WHEN 'expansion' THEN NOT (round(arr_before_usd * 100)::BIGINT > 0 AND round(arr_delta_usd * 100)::BIGINT > 0 AND round(arr_after_usd * 100)::BIGINT > round(arr_before_usd * 100)::BIGINT) WHEN 'contraction' THEN NOT (round(arr_before_usd * 100)::BIGINT > 0 AND round(arr_delta_usd * 100)::BIGINT < 0 AND round(arr_after_usd * 100)::BIGINT > 0 AND round(arr_after_usd * 100)::BIGINT < round(arr_before_usd * 100)::BIGINT) WHEN 'churn' THEN NOT (round(arr_before_usd * 100)::BIGINT > 0 AND round(arr_delta_usd * 100)::BIGINT < 0 AND round(arr_after_usd * 100)::BIGINT = 0) ELSE true END) AS semantic_exception_rows FROM fct_arr_movements GROUP BY movement_type ORDER BY movement_type`,
    ordered: true,
    orderedNote: 'movement type alphabetically',
    fingerprintSQL: `SELECT movement_type, count(*) AS movement_rows, count(*) FILTER (WHERE CASE movement_type WHEN 'new' THEN NOT (round(arr_before_usd * 100)::BIGINT = 0 AND round(arr_delta_usd * 100)::BIGINT > 0 AND round(arr_after_usd * 100)::BIGINT = round(arr_delta_usd * 100)::BIGINT) WHEN 'reactivation' THEN NOT (round(arr_before_usd * 100)::BIGINT > 0 AND round(arr_delta_usd * 100)::BIGINT > 0 AND round(arr_after_usd * 100)::BIGINT > round(arr_before_usd * 100)::BIGINT) WHEN 'expansion' THEN NOT (round(arr_before_usd * 100)::BIGINT > 0 AND round(arr_delta_usd * 100)::BIGINT > 0 AND round(arr_after_usd * 100)::BIGINT > round(arr_before_usd * 100)::BIGINT) WHEN 'contraction' THEN NOT (round(arr_before_usd * 100)::BIGINT > 0 AND round(arr_delta_usd * 100)::BIGINT < 0 AND round(arr_after_usd * 100)::BIGINT > 0 AND round(arr_after_usd * 100)::BIGINT < round(arr_before_usd * 100)::BIGINT) WHEN 'churn' THEN NOT (round(arr_before_usd * 100)::BIGINT > 0 AND round(arr_delta_usd * 100)::BIGINT < 0 AND round(arr_after_usd * 100)::BIGINT = 0) ELSE true END) AS semantic_exception_rows FROM fct_arr_movements GROUP BY movement_type ORDER BY movement_type`,
    fingerprintMessage: `A reactivation restarts from zero. It is not an expansion of a currently active balance.`,
    hints: [
      `Write a CASE rule for each movement type, using integer cents throughout. Count rows where that type's rule is not true.`,
      `New and reactivation start at zero. Expansion stays positive and rises; contraction stays positive and falls; churn ends at zero.`,
      `SELECT movement_type, count(*) AS movement_rows, count(*) FILTER (WHERE CASE movement_type WHEN 'new' THEN NOT (round(arr_before_usd * 100)::BIGINT = 0 AND round(arr_delta_usd * 100)::BIGINT > 0 AND round(arr_after_usd * 100)::BIGINT = round(arr_delta_usd * 100)::BIGINT) WHEN 'reactivation' THEN NOT (round(arr_before_usd * 100)::BIGINT = 0 AND round(arr_delta_usd * 100)::BIGINT > 0 AND round(arr_after_usd * 100)::BIGINT = round(arr_delta_usd * 100)::BIGINT) WHEN 'expansion' THEN NOT (round(arr_before_usd * 100)::BIGINT > 0 AND round(arr_delta_usd * 100)::BIGINT > 0 AND round(arr_after_usd * 100)::BIGINT > round(arr_before_usd * 100)::BIGINT) WHEN 'contraction' THEN NOT (round(arr_before_usd * 100)::BIGINT > 0 AND round(arr_delta_usd * 100)::BIGINT < 0 AND round(arr_after_usd * 100)::BIGINT > 0 AND round(arr_after_usd * 100)::BIGINT < round(arr_before_usd * 100)::BIGINT) WHEN 'churn' THEN NOT (round(arr_before_usd * 100)::BIGINT > 0 AND round(arr_delta_usd * 100)::BIGINT < 0 AND round(arr_after_usd * 100)::BIGINT = 0) ELSE true END) AS semantic_exception_rows FROM fct_arr_movements GROUP BY movement_type ORDER BY movement_type;\n\nEvery loaded event satisfies its type's endpoint and sign rule. These are internal fixture semantics, not GAAP classifications or renewal conclusions.`,
    ],
    sayIt: `"All five movement types follow their loaded endpoint and sign rules. Reactivation correctly starts from zero; it is not treated as expansion of an active balance."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm104',
    part: 18,
    title: 'Trace every customer chain',
    from: 'elena',
    ask: `Now reconstruct every customer forward through time. The first event must start at zero, and each later event's before ARR must equal the prior event's after ARR. Use movement_id as the deterministic tie-breaker after event_date.`,
    deliverable: `Exactly one row: customer_chains, transition_rows, opening_state_exceptions, and continuity_exceptions.`,
    tables: ['fct_arr_movements'],
    canonical: `WITH sequenced AS (SELECT customer_id, event_date, movement_id, arr_before_usd, arr_after_usd, row_number() OVER (PARTITION BY customer_id ORDER BY event_date, movement_id) AS event_ordinal, lag(arr_after_usd) OVER (PARTITION BY customer_id ORDER BY event_date, movement_id) AS prior_arr_after_usd FROM fct_arr_movements) SELECT count(*) FILTER (WHERE event_ordinal = 1) AS customer_chains, count(*) FILTER (WHERE event_ordinal > 1) AS transition_rows, count(*) FILTER (WHERE event_ordinal = 1 AND round(arr_before_usd * 100)::BIGINT <> 0) AS opening_state_exceptions, count(*) FILTER (WHERE event_ordinal > 1 AND round(arr_before_usd * 100)::BIGINT <> round(prior_arr_after_usd * 100)::BIGINT) AS continuity_exceptions FROM sequenced`,
    ordered: false,
    fingerprintSQL: `WITH sequenced AS (SELECT customer_id, event_date, movement_id, arr_before_usd, arr_after_usd, row_number() OVER (PARTITION BY customer_id ORDER BY event_date DESC, movement_id DESC) AS event_ordinal, lag(arr_after_usd) OVER (PARTITION BY customer_id ORDER BY event_date DESC, movement_id DESC) AS prior_arr_after_usd FROM fct_arr_movements) SELECT count(*) FILTER (WHERE event_ordinal = 1) AS customer_chains, count(*) FILTER (WHERE event_ordinal > 1) AS transition_rows, count(*) FILTER (WHERE event_ordinal = 1 AND round(arr_before_usd * 100)::BIGINT <> 0) AS opening_state_exceptions, count(*) FILTER (WHERE event_ordinal > 1 AND round(arr_before_usd * 100)::BIGINT <> round(prior_arr_after_usd * 100)::BIGINT) AS continuity_exceptions FROM sequenced`,
    fingerprintMessage: `Reconstruct each customer forward from oldest event to newest. Descending order compares a row with its future state.`,
    hints: [
      `Partition both ROW_NUMBER and LAG by customer_id. Order oldest event first, then movement_id for same-date ties.`,
      `The first row tests before ARR against zero. Later rows compare before ARR with LAG(arr_after_usd), in rounded cents.`,
      `WITH sequenced AS (SELECT customer_id, event_date, movement_id, arr_before_usd, arr_after_usd, row_number() OVER (PARTITION BY customer_id ORDER BY event_date, movement_id) AS event_ordinal, lag(arr_after_usd) OVER (PARTITION BY customer_id ORDER BY event_date, movement_id) AS prior_arr_after_usd FROM fct_arr_movements) SELECT count(*) FILTER (WHERE event_ordinal = 1) AS customer_chains, count(*) FILTER (WHERE event_ordinal > 1) AS transition_rows, count(*) FILTER (WHERE event_ordinal = 1 AND round(arr_before_usd * 100)::BIGINT <> 0) AS opening_state_exceptions, count(*) FILTER (WHERE event_ordinal > 1 AND round(arr_before_usd * 100)::BIGINT <> round(prior_arr_after_usd * 100)::BIGINT) AS continuity_exceptions FROM sequenced;\n\nThe control follows 9,500 customer chains through 7,234 transitions with no opening or continuity breaks in the loaded data.`,
    ],
    sayIt: `"All 9,500 customer chains open at zero and all 7,234 follow-on events begin where the preceding event ended, ordered forward by date and trace id."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm105',
    part: 18,
    title: 'Reconcile every loaded month',
    from: 'elena',
    ask: `Reconcile the event ledger to every month-end snapshot from January 2023 through June 2026. Build the complete month spine from dim_date and carry the pre-mart event history in as January's opening balance. Remember: month_start labels a month-end photograph.`,
    deliverable: `Forty-two chronological rows: month_start, ledger_ending_arr_usd, snapshot_ending_arr_usd, and variance_usd. Round dollars to 2.`,
    tables: ['dim_date', 'fct_arr_movements', 'fct_subscription_snapshot_monthly'],
    canonical: `WITH months AS (SELECT DISTINCT month_start FROM dim_date WHERE month_start BETWEEN DATE '2023-01-01' AND DATE '2026-06-01'), opening AS (SELECT coalesce(sum(round(arr_delta_usd * 100)::BIGINT), 0) AS opening_arr_cents FROM fct_arr_movements WHERE event_date < DATE '2023-01-01'), monthly_movements AS (SELECT date_trunc('month', event_date)::DATE AS month_start, sum(round(arr_delta_usd * 100)::BIGINT) AS movement_arr_cents FROM fct_arr_movements WHERE event_date >= DATE '2023-01-01' AND event_date < DATE '2026-07-01' GROUP BY 1), ledger AS (SELECT m.month_start, o.opening_arr_cents + sum(coalesce(mm.movement_arr_cents, 0)) OVER (ORDER BY m.month_start ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS ledger_ending_arr_cents FROM months m CROSS JOIN opening o LEFT JOIN monthly_movements mm USING (month_start)), snapshot AS (SELECT month_start, sum(round(arr_usd * 100)::BIGINT) AS snapshot_ending_arr_cents FROM fct_subscription_snapshot_monthly WHERE month_start BETWEEN DATE '2023-01-01' AND DATE '2026-06-01' GROUP BY month_start) SELECT l.month_start, round(l.ledger_ending_arr_cents / 100.0, 2) AS ledger_ending_arr_usd, round(s.snapshot_ending_arr_cents / 100.0, 2) AS snapshot_ending_arr_usd, round((l.ledger_ending_arr_cents - s.snapshot_ending_arr_cents) / 100.0, 2) AS variance_usd FROM ledger l JOIN snapshot s USING (month_start) ORDER BY l.month_start`,
    ordered: true,
    orderedNote: 'January 2023 through June 2026',
    fingerprintSQL: `WITH months AS (SELECT DISTINCT month_start FROM dim_date WHERE month_start BETWEEN DATE '2023-01-01' AND DATE '2026-06-01'), monthly_movements AS (SELECT date_trunc('month', event_date)::DATE AS month_start, sum(round(arr_delta_usd * 100)::BIGINT) AS movement_arr_cents FROM fct_arr_movements WHERE event_date >= DATE '2023-01-01' AND event_date < DATE '2026-07-01' GROUP BY 1), ledger AS (SELECT m.month_start, sum(coalesce(mm.movement_arr_cents, 0)) OVER (ORDER BY m.month_start ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS ledger_ending_arr_cents FROM months m LEFT JOIN monthly_movements mm USING (month_start)), snapshot AS (SELECT month_start, sum(round(arr_usd * 100)::BIGINT) AS snapshot_ending_arr_cents FROM fct_subscription_snapshot_monthly WHERE month_start BETWEEN DATE '2023-01-01' AND DATE '2026-06-01' GROUP BY month_start) SELECT l.month_start, round(l.ledger_ending_arr_cents / 100.0, 2) AS ledger_ending_arr_usd, round(s.snapshot_ending_arr_cents / 100.0, 2) AS snapshot_ending_arr_usd, round((l.ledger_ending_arr_cents - s.snapshot_ending_arr_cents) / 100.0, 2) AS variance_usd FROM ledger l JOIN snapshot s USING (month_start) ORDER BY l.month_start`,
    fingerprintMessage: `January's movement is not January's ending balance. Carry the complete pre-2023 ledger state into the 42-month mart reconciliation.`,
    hints: [
      `Build 42 distinct month_start rows from dim_date. Separately sum pre-2023 movement cents as the opening balance.`,
      `Aggregate post-cutoff movement cents by event month, cumulatively sum them across the complete spine, then add the opening before comparing with monthly snapshot cents.`,
      `WITH months AS (SELECT DISTINCT month_start FROM dim_date WHERE month_start BETWEEN DATE '2023-01-01' AND DATE '2026-06-01'), opening AS (SELECT coalesce(sum(round(arr_delta_usd * 100)::BIGINT), 0) AS opening_arr_cents FROM fct_arr_movements WHERE event_date < DATE '2023-01-01'), monthly_movements AS (SELECT date_trunc('month', event_date)::DATE AS month_start, sum(round(arr_delta_usd * 100)::BIGINT) AS movement_arr_cents FROM fct_arr_movements WHERE event_date >= DATE '2023-01-01' AND event_date < DATE '2026-07-01' GROUP BY 1), ledger AS (SELECT m.month_start, o.opening_arr_cents + sum(coalesce(mm.movement_arr_cents, 0)) OVER (ORDER BY m.month_start ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS ledger_ending_arr_cents FROM months m CROSS JOIN opening o LEFT JOIN monthly_movements mm USING (month_start)), snapshot AS (SELECT month_start, sum(round(arr_usd * 100)::BIGINT) AS snapshot_ending_arr_cents FROM fct_subscription_snapshot_monthly WHERE month_start BETWEEN DATE '2023-01-01' AND DATE '2026-06-01' GROUP BY month_start) SELECT l.month_start, round(l.ledger_ending_arr_cents / 100.0, 2) AS ledger_ending_arr_usd, round(s.snapshot_ending_arr_cents / 100.0, 2) AS snapshot_ending_arr_usd, round((l.ledger_ending_arr_cents - s.snapshot_ending_arr_cents) / 100.0, 2) AS variance_usd FROM ledger l JOIN snapshot s USING (month_start) ORDER BY l.month_start;\n\nThe pre-mart opening is $14,387,802.71. With it, all 42 month-end snapshots reconcile at zero variance, from $15.98 million in January 2023 to $74.67 million in June 2026.`,
    ],
    sayIt: `"All 42 loaded month-end snapshots reconcile to the event ledger at currency precision after carrying the $14.39 million pre-mart opening balance into January 2023."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm106',
    part: 18,
    title: 'Preserve every ending customer state',
    from: 'elena',
    ask: `Reconcile each customer's final event state to the June 2026 active snapshot. Preserve the complete 9,500-customer population: an inactive ledger state should be absent from the active-only snapshot, not removed by the join. Compare the event-time ending plan only for active states.`,
    deliverable: `Exactly one row: customer_states_checked, active_ledger_states, inactive_ledger_states, june_snapshot_rows, and state_exception_rows.`,
    tables: ['fct_arr_movements', 'fct_subscription_snapshot_monthly', 'dim_customer'],
    canonical: `WITH ending AS (SELECT customer_id, plan_name AS event_time_ending_plan, round(arr_after_usd * 100)::BIGINT AS ledger_ending_arr_cents FROM fct_arr_movements QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY event_date DESC, movement_id DESC) = 1), june AS (SELECT customer_id, plan_name AS june_snapshot_plan, round(arr_usd * 100)::BIGINT AS june_snapshot_arr_cents FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'), control AS (SELECT d.customer_id, e.event_time_ending_plan, e.ledger_ending_arr_cents, j.june_snapshot_plan, j.june_snapshot_arr_cents FROM dim_customer d JOIN ending e USING (customer_id) LEFT JOIN june j USING (customer_id)) SELECT count(*) AS customer_states_checked, count(*) FILTER (WHERE ledger_ending_arr_cents > 0) AS active_ledger_states, count(*) FILTER (WHERE ledger_ending_arr_cents = 0) AS inactive_ledger_states, count(june_snapshot_arr_cents) AS june_snapshot_rows, count(*) FILTER (WHERE (ledger_ending_arr_cents > 0 AND (june_snapshot_arr_cents IS NULL OR ledger_ending_arr_cents <> june_snapshot_arr_cents OR event_time_ending_plan IS DISTINCT FROM june_snapshot_plan)) OR (ledger_ending_arr_cents = 0 AND june_snapshot_arr_cents IS NOT NULL)) AS state_exception_rows FROM control`,
    ordered: false,
    fingerprintSQL: `WITH ending AS (SELECT customer_id, plan_name AS event_time_ending_plan, round(arr_after_usd * 100)::BIGINT AS ledger_ending_arr_cents FROM fct_arr_movements QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY event_date DESC, movement_id DESC) = 1), june AS (SELECT customer_id, plan_name AS june_snapshot_plan, round(arr_usd * 100)::BIGINT AS june_snapshot_arr_cents FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'), control AS (SELECT d.customer_id, e.event_time_ending_plan, e.ledger_ending_arr_cents, j.june_snapshot_plan, j.june_snapshot_arr_cents FROM dim_customer d JOIN ending e USING (customer_id) JOIN june j USING (customer_id)) SELECT count(*) AS customer_states_checked, count(*) FILTER (WHERE ledger_ending_arr_cents > 0) AS active_ledger_states, count(*) FILTER (WHERE ledger_ending_arr_cents = 0) AS inactive_ledger_states, count(june_snapshot_arr_cents) AS june_snapshot_rows, count(*) FILTER (WHERE (ledger_ending_arr_cents > 0 AND (june_snapshot_arr_cents IS NULL OR ledger_ending_arr_cents <> june_snapshot_arr_cents OR event_time_ending_plan IS DISTINCT FROM june_snapshot_plan)) OR (ledger_ending_arr_cents = 0 AND june_snapshot_arr_cents IS NOT NULL)) AS state_exception_rows FROM control`,
    fingerprintMessage: `A zero exception count is not enough if the join discarded 4,631 inactive customers. Preserve the complete ending-state population.`,
    hints: [
      `Rank movement rows newest-first per customer and keep one ending event. Build June snapshot rows separately.`,
      `Start from all dim_customer ids with an ending event, then LEFT JOIN the active-only June snapshot. Active states must match ARR and plan; zero states should have no June row.`,
      `WITH ending AS (SELECT customer_id, plan_name AS event_time_ending_plan, round(arr_after_usd * 100)::BIGINT AS ledger_ending_arr_cents FROM fct_arr_movements QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY event_date DESC, movement_id DESC) = 1), june AS (SELECT customer_id, plan_name AS june_snapshot_plan, round(arr_usd * 100)::BIGINT AS june_snapshot_arr_cents FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01'), control AS (SELECT d.customer_id, e.event_time_ending_plan, e.ledger_ending_arr_cents, j.june_snapshot_plan, j.june_snapshot_arr_cents FROM dim_customer d JOIN ending e USING (customer_id) LEFT JOIN june j USING (customer_id)) SELECT count(*) AS customer_states_checked, count(*) FILTER (WHERE ledger_ending_arr_cents > 0) AS active_ledger_states, count(*) FILTER (WHERE ledger_ending_arr_cents = 0) AS inactive_ledger_states, count(june_snapshot_arr_cents) AS june_snapshot_rows, count(*) FILTER (WHERE (ledger_ending_arr_cents > 0 AND (june_snapshot_arr_cents IS NULL OR ledger_ending_arr_cents <> june_snapshot_arr_cents OR event_time_ending_plan IS DISTINCT FROM june_snapshot_plan)) OR (ledger_ending_arr_cents = 0 AND june_snapshot_arr_cents IS NOT NULL)) AS state_exception_rows FROM control;\n\nAll 9,500 ending states reconcile: 4,869 active rows match June and 4,631 inactive states are correctly absent. Plan on the event is event-time; this control does not turn current customer labels into history.`,
    ],
    sayIt: `"The ending-state control covers all 9,500 customers: 4,869 active states match the June snapshot and 4,631 inactive states remain in scope instead of disappearing through an inner join."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm107',
    part: 18,
    title: 'Route the material movement queue',
    from: 'elena',
    ask: `Build a review queue for the 15 largest nonterminal expansion and contraction events by absolute ARR movement. Keep the trace id, event-time plan, before/delta/after amounts, percent movement, and current customer/CRM labels. This is review routing, not an account recommendation.`,
    deliverable: `Fifteen rows: movement_id, event_date, customer_id, current_customer_name, movement_type, event_time_plan, arr_before_usd, arr_delta_usd, arr_after_usd, movement_pct, current_segment, and current_crm_account_id. Round dollars to 2 and percent to 1; sort largest absolute movement first, then movement_id.`,
    tables: ['fct_arr_movements', 'dim_customer'],
    canonical: `SELECT m.movement_id, m.event_date, m.customer_id, c.customer_name AS current_customer_name, m.movement_type, m.plan_name AS event_time_plan, round(m.arr_before_usd, 2) AS arr_before_usd, round(m.arr_delta_usd, 2) AS arr_delta_usd, round(m.arr_after_usd, 2) AS arr_after_usd, round(100.0 * m.arr_delta_usd / nullif(m.arr_before_usd, 0), 1) AS movement_pct, c.segment AS current_segment, c.crm_account_id AS current_crm_account_id FROM fct_arr_movements m JOIN dim_customer c USING (customer_id) WHERE m.movement_type IN ('expansion', 'contraction') AND round(m.arr_after_usd * 100)::BIGINT > 0 ORDER BY abs(round(m.arr_delta_usd * 100)::BIGINT) DESC, m.movement_id LIMIT 15`,
    ordered: true,
    orderedNote: 'largest absolute ARR movement first, then trace id',
    fingerprintSQL: `SELECT m.movement_id, m.event_date, m.customer_id, c.customer_name AS current_customer_name, m.movement_type, m.plan_name AS event_time_plan, round(m.arr_before_usd, 2) AS arr_before_usd, round(m.arr_delta_usd, 2) AS arr_delta_usd, round(m.arr_after_usd, 2) AS arr_after_usd, round(100.0 * m.arr_delta_usd / nullif(m.arr_before_usd, 0), 1) AS movement_pct, c.segment AS current_segment, c.crm_account_id AS current_crm_account_id FROM fct_arr_movements m JOIN dim_customer c USING (customer_id) WHERE m.movement_type IN ('expansion', 'contraction') AND round(m.arr_after_usd * 100)::BIGINT > 0 ORDER BY round(m.arr_delta_usd * 100)::BIGINT DESC, m.movement_id LIMIT 15`,
    fingerprintMessage: `Materiality uses the absolute movement. Sorting the signed delta alone silently removes the largest contractions.`,
    hints: [
      `Filter to expansion and contraction events that end above zero. Rank ABS(delta cents), not the signed delta.`,
      `The movement table supplies event-time plan and trace fields. The customer dimension supplies current-state name, segment, and CRM id; label them that way.`,
      `SELECT m.movement_id, m.event_date, m.customer_id, c.customer_name AS current_customer_name, m.movement_type, m.plan_name AS event_time_plan, round(m.arr_before_usd, 2) AS arr_before_usd, round(m.arr_delta_usd, 2) AS arr_delta_usd, round(m.arr_after_usd, 2) AS arr_after_usd, round(100.0 * m.arr_delta_usd / nullif(m.arr_before_usd, 0), 1) AS movement_pct, c.segment AS current_segment, c.crm_account_id AS current_crm_account_id FROM fct_arr_movements m JOIN dim_customer c USING (customer_id) WHERE m.movement_type IN ('expansion', 'contraction') AND round(m.arr_after_usd * 100)::BIGINT > 0 ORDER BY abs(round(m.arr_delta_usd * 100)::BIGINT) DESC, m.movement_id LIMIT 15;\n\nThe queue includes the $90,598.78 contraction at movement 3830 because materiality is absolute. Current labels route review only; they do not establish historical segment, causality, renewal risk, or a commercial action.`,
    ],
    sayIt: `"The absolute-movement queue keeps both directions visible, including the $90.6 thousand contraction that signed descending order would hide. The attached CRM labels are current-state routing context only."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm108',
    part: 18,
    title: 'Package the loaded-data control handoff',
    from: 'elena',
    ask: `Package one internal-control row for Riff: loaded event and movement-type counts, month and customer coverage, inactive customer coverage, and every exception class from identity through customer-state reconciliation. Status is PASS only when all exception counts are zero—and the population columns must remain visible so a narrow join cannot fake a pass.`,
    deliverable: `Exactly one row: control_status, movement_rows, movement_types, loaded_months_checked, customer_states_checked, inactive_customer_states, identity_exception_rows, equation_exception_rows, semantic_exception_rows, chain_exception_rows, month_reconciliation_exception_rows, and customer_state_exception_rows.`,
    tables: ['fct_arr_movements', 'dim_date', 'fct_subscription_snapshot_monthly', 'dim_customer'],
    canonical: ARR_LEDGER_HANDOFF_SQL,
    ordered: false,
    fingerprintSQL: ARR_LEDGER_HANDOFF_SQL.replace('LEFT JOIN june j USING (customer_id)', 'JOIN june j USING (customer_id)'),
    fingerprintMessage: `The status says PASS, but the population proves the control is incomplete. A valid handoff must account for all 9,500 customer states, including 4,631 inactive states.`,
    hints: [
      `Reduce each prior control to one row: event identity, cents equation/endpoints, type semantics, chain continuity, 42-month reconciliation, and 9,500-customer ending states.`,
      `Cross join those one-row controls. Derive PASS only from the exception sum, while carrying the month, customer, and inactive-state denominators into the visible result.`,
      ARR_LEDGER_HANDOFF_SQL + `;\n\nThe loaded-data handoff is PASS across 16,734 events, five movement types, 42 month-end snapshots, and all 9,500 customer states including 4,631 inactive states. It is an internal fixture control—not an external audit, GAAP conclusion, billing or cash proof, or production-system assurance.`,
    ],
    sayIt: `"The loaded ARR event ledger passes every internal control across 16,734 events, 42 month-end snapshots, and all 9,500 customer ending states. I would call that a complete loaded-data control, not an external audit or a commercial conclusion."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm109',
    part: 19,
    title: 'Fix the lifecycle denominators first',
    from: 'priya',
    ask: `Riff wants a customer lifecycle council, starting with the denominator. Profile each acquisition plan at 6, 12, and 24 months. A customer is eligible only when that anniversary month has fully closed by June 30, 2026. Keep every acquired customer visible before you look at who survived.`,
    deliverable: `Nine rows, one per acquisition plan × horizon: acquisition_plan, horizon_months, first_acquisition_date, last_acquisition_date, acquired_customers, eligible_customers, ineligible_customers, and acquisition_cutoff_month_end. Sort by horizon, then plan.`,
    tables: ['fct_arr_movements'],
    canonical: LIFECYCLE_ELIGIBILITY_SQL,
    ordered: true,
    orderedNote: '6, 12, then 24 months; plan alphabetically within each horizon',
    fingerprintSQL: LIFECYCLE_ELIGIBILITY_SQL.replace(
      `count(*) FILTER (WHERE horizon_month_end <= DATE '2026-06-30') AS eligible_customers`,
      `count(*) FILTER (WHERE horizon_month_end <= DATE '2026-06-30' AND customer_id IN (SELECT customer_id FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01')) AS eligible_customers`,
    ),
    fingerprintMessage: `Eligibility was filtered through the June active snapshot, so inactive customers disappeared before outcomes were measured. Fix the age-eligible cohort from acquisition dates alone; survival comes later.`,
    hints: [
      `This is the cohort equivalent of fixing a budget population before calculating variance. First keep one acquisition row per customer, then CROSS JOIN the three horizon labels.`,
      `Use last_day(acquisition_date + horizon months) for the observation date. Eligibility means that month-end is on or before June 30, 2026; do not join the June survivor table.`,
      LIFECYCLE_ELIGIBILITY_SQL + `;\n\nThe loaded ledger has 9,500 acquired customers. The eligible population is 8,080 at 6 months, 6,866 at 12 months, and 4,545 at 24 months. The acquisition cutoffs are December 31, 2025; June 30, 2025; and June 30, 2024. Those denominators are fixed before any outcome join.`,
    ],
    sayIt: `"I fixed eligibility from acquisition date and a closed anniversary month before joining outcomes. That keeps later survival from rewriting the denominator."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm110',
    part: 19,
    title: 'Build the age-normalized maturity curve',
    from: 'priya',
    ask: `Now measure the eligible cohorts at each anniversary month-end. For every acquisition plan and horizon, show endpoint logo survival, opening ARR, endpoint ARR, capped gross retention, and net retention. Active at the endpoint does not mean continuously retained: a customer can churn and reactivate before the checkpoint.`,
    deliverable: `Nine rows, one per acquisition plan × horizon: acquisition_plan, horizon_months, eligible_customers, endpoint_active_customers, endpoint_logo_survival_pct, opening_arr_usd, endpoint_arr_usd, capped_grr_pct, and nrr_pct. Round dollars to 2 and rates to 1; sort by horizon, then plan.`,
    tables: ['fct_arr_movements'],
    canonical: LIFECYCLE_RETENTION_CURVE_SQL,
    ordered: true,
    orderedNote: '6, 12, then 24 months; plan alphabetically within each horizon',
    fingerprintSQL: LIFECYCLE_RETENTION_CURVE_SQL.replace(
      `FROM endpoint\nGROUP BY acquisition_plan, horizon_months`,
      `FROM endpoint\nWHERE endpoint_arr_usd > 0\nGROUP BY acquisition_plan, horizon_months`,
    ),
    fingerprintMessage: `The denominator contains only endpoint-active customers, making logo survival 100% by construction. Aggregate every eligible customer and count positive endpoint ARR inside the result.`,
    hints: [
      `For each eligible customer × horizon, find the last ledger event on or before the anniversary month-end. That arr_after_usd is the endpoint state, including zero.`,
      `GRR caps each customer's endpoint ARR at acquisition ARR before summing; NRR keeps expansion. Keep zero endpoints in both denominators.`,
      LIFECYCLE_RETENTION_CURVE_SQL + `;\n\nAcross all plans, endpoint survival is 80.0% at 6 months, 64.2% at 12, and 44.2% at 24. Capped GRR is 92.5%, 85.8%, and 76.6%; NRR is 96.0%, 91.8%, and 86.7%. At 24 months, endpoint logo survival is 90.1% for Enterprise, 66.2% for Growth, and 36.3% for Starter. Endpoint survival still does not prove uninterrupted retention.`,
    ],
    sayIt: `"I age-normalized every customer to a closed anniversary month and preserved the full eligible denominator. The 24-month endpoint is 44.2% active, with 76.6% GRR and 86.7% NRR; endpoint active is not the same as continuously retained."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm111',
    part: 19,
    title: 'Read the June book by tenure',
    from: 'danny',
    ask: `Zi wants a June 2026 tenure view before the council. Band every acquired customer by completed months since first contract, then show how many are active or inactive at June month-end and the active book's ending ARR. Preserve inactive customers with a left join.`,
    deliverable: `Five rows: tenure_band, acquired_customers, june_active_customers, june_inactive_customers, june_active_share_pct, and june_ending_arr_usd. Use 0–5, 6–11, 12–23, 24–35, and 36+ month bands in that order; round share to 1 and ARR to 2.`,
    tables: ['dim_customer', 'fct_subscription_snapshot_monthly'],
    canonical: LIFECYCLE_TENURE_BOOK_SQL,
    ordered: true,
    orderedNote: 'youngest tenure band first',
    fingerprintSQL: LIFECYCLE_TENURE_BOOK_SQL.replace('LEFT JOIN june j USING (customer_id)', 'JOIN june j USING (customer_id)'),
    fingerprintMessage: `The inner join removed every inactive customer, so each band's acquired population became its active population. Start from all customers and LEFT JOIN the active-only June snapshot.`,
    hints: [
      `dim_customer supplies all 9,500 first-contract dates. The June snapshot contains active customers only, so it belongs on the optional side of a LEFT JOIN.`,
      `Use date_sub('month', first_contract_date, June 30) to count completed months and assign one tenure band. COUNT(arr_usd) counts matched active rows; COUNT(*) keeps the full acquired population.`,
      LIFECYCLE_TENURE_BOOK_SQL + `;\n\nThe bands retain all 9,500 customers. Active/acquired counts are 1,293/1,420; 885/1,214; 1,295/2,321; 758/2,011; and 638/2,534. Their active June ARR is $14.92M, $11.57M, $18.03M, $14.38M, and $15.77M. These are loaded tenure and endpoint facts, not health or renewal signals.`,
    ],
    sayIt: `"I started from every acquired customer and left-joined the active-only June book, so the tenure view keeps both 4,869 active and 4,631 inactive customers visible."`,
    jdCompanies: ['Instacart'],
  },
  {
    id: 'm112',
    part: 19,
    title: 'Measure lifecycle-event incidence',
    from: 'priya',
    ask: `Riff wants to know which lifecycle events appear before each maturity checkpoint. For every eligible customer, flag whether expansion, contraction, churn, and reactivation occurred after acquisition and by the 6-, 12-, or 24-month endpoint. These populations overlap, so never add their percentages together.`,
    deliverable: `Nine rows, one per acquisition plan × horizon: eligible_customers plus customer counts and incidence percentages for expansion, contraction, churn, and reactivation. Count a customer at most once per event type; round percentages to 1 and sort by horizon, then plan.`,
    tables: ['fct_arr_movements'],
    canonical: LIFECYCLE_EVENT_INCIDENCE_SQL,
    ordered: true,
    orderedNote: '6, 12, then 24 months; plan alphabetically within each horizon',
    fingerprintSQL: LIFECYCLE_EVENT_INCIDENCE_SQL.replace('LEFT JOIN fct_arr_movements m', 'JOIN fct_arr_movements m'),
    fingerprintMessage: `The inner join discarded eligible customers with no follow-on event, shrinking the denominator. Build one flag row for every eligible customer, with zeros when no event occurred.`,
    hints: [
      `Think of four COUNTIFS flags on one customer roster. Build eligibility first, LEFT JOIN follow-on events, then MAX each 1/0 flag at customer × horizon grain.`,
      `A customer can expand, contract, and churn before the same checkpoint. Count once inside each event type, but do not force the four flags into exclusive categories.`,
      LIFECYCLE_EVENT_INCIDENCE_SQL + `;\n\nEach row keeps the same eligibility denominator as the maturity curve. The four incidence rates are deliberately non-additive: they describe whether an event appeared by the checkpoint, not mutually exclusive customer states or causal drivers.`,
    ],
    sayIt: `"I reduced event rows to customer-level yes/no flags before calculating incidence. The event populations overlap, so each rate stands on its own eligible denominator."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm113',
    part: 19,
    title: 'Find the first 24-month transition',
    from: 'priya',
    ask: `For the fully observable 24-month cohort, classify each customer's first event after acquisition. Keep customers with no follow-on event as an explicit none group, and show median days only when a transition exists.`,
    deliverable: `Four rows: transition_type, eligible_customers, customers, cohort_share_pct, and median_days_to_transition. Use the first expansion, contraction, churn, or none through the closed 24-month anniversary month; round share to 1 and sort largest customer group first.`,
    tables: ['fct_arr_movements'],
    canonical: LIFECYCLE_FIRST_TRANSITION_SQL,
    ordered: true,
    orderedNote: 'largest customer group first, then transition type',
    fingerprintSQL: LIFECYCLE_FIRST_TRANSITION_SQL.replace(`   AND m.event_date <= e.horizon_month_end`, ''),
    fingerprintMessage: `The cohort is eligible, but the event join looks beyond each customer's 24-month endpoint. Bound the first-transition search to the same anniversary month-end as the denominator.`,
    hints: [
      `Start with the fixed 24-month-eligible roster. LEFT JOIN events after acquisition and through the anniversary month-end, then rank earliest event per customer.`,
      `The LEFT JOIN produces one null event row when nothing happened. Convert that null to none only after keeping rank 1; do not drop it.`,
      LIFECYCLE_FIRST_TRANSITION_SQL + `;\n\nAmong 4,545 eligible customers, the first transition is churn for 2,433 (53.5%), none for 1,285 (28.3%), expansion for 668 (14.7%), and contraction for 159 (3.5%). This orders loaded first events; it does not explain why they occurred.`,
    ],
    sayIt: `"I fixed the fully observed 24-month cohort, ranked each customer's first follow-on event, and kept 1,285 no-transition customers in the denominator instead of dropping them."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm114',
    part: 19,
    title: 'Put churn over real exposure',
    from: 'elena',
    ask: `Rex wants an exposure-based churn view for the loaded mart window, January 2023 through June 2026. Reconstruct which customers were active at each month opening, band their tenure at that opening, and count churn events during the month. Report churns per 100 opening-active customer-months—not a customer probability.`,
    deliverable: `One row per acquisition_plan × tenure_band: opening_active_customer_months, churn_events, and churns_per_100_opening_active_customer_months. Use 0–5, 6–11, 12–23, 24–35, and 36+ month bands; round the rate to 2 and sort by plan, then tenure.`,
    tables: ['dim_date', 'fct_arr_movements'],
    canonical: LIFECYCLE_CHURN_EXPOSURE_SQL,
    ordered: true,
    orderedNote: 'plan alphabetically, then youngest tenure band first',
    fingerprintSQL: LIFECYCLE_CHURN_EXPOSURE_SQL.replace(
      `count(*) AS opening_active_customer_months`,
      `count(DISTINCT customer_id) AS opening_active_customer_months`,
    ).replace(
      `round(100.0 * sum(churn_events) / count(*), 2)`,
      `round(100.0 * sum(churn_events) / count(DISTINCT customer_id), 2)`,
    ),
    fingerprintMessage: `Distinct customers are not the exposure denominator: one active customer contributes once in every month they open active. Use opening-active customer-month rows for the rate.`,
    hints: [
      `Build the 42 loaded month starts. For each month and customer, keep the latest event strictly before month_start; a positive arr_after_usd contributes one opening-active customer-month.`,
      `Attach churn events from that same month, then aggregate exposures and churns by acquisition plan and tenure at month opening. Do not divide by distinct customers.`,
      LIFECYCLE_CHURN_EXPOSURE_SQL + `;\n\nThe output is bounded to the 42 loaded months and tenure uses completed months at each opening. Across tenure bands, rates are 0.54–1.02 per 100 opening-active customer-months for Enterprise, 1.61–1.90 for Growth, and 3.52–4.59 for Starter. These are exposure rates in the loaded window, not individual churn probabilities or causal estimates.`,
    ],
    sayIt: `"I divided churn events by opening-active customer-month exposure across the 42 loaded months. That is a comparable operating rate, not a customer's probability of churn."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm115',
    part: 19,
    title: 'Control the reactivation episodes',
    from: 'elena',
    ask: `Now inspect every loaded reactivation. Pair it to the immediately prior churn, measure inactive days, compare restored ARR with pre-churn ARR, and count any later event. The fixture has no follow-on events after reactivation, so this cannot support a durability or program-success claim.`,
    deliverable: `Four rows: All plans, then each acquisition_plan, with reactivation_episodes, prior_event_not_churn_episodes, median_inactive_days, pre_churn_arr_usd, restored_arr_usd, restored_arr_pct, and episodes_with_follow_on_events. Round dollars to 2 and percent to 1.`,
    tables: ['fct_arr_movements'],
    canonical: LIFECYCLE_REACTIVATION_SQL,
    ordered: true,
    orderedNote: 'All plans first, then acquisition plan alphabetically',
    fingerprintSQL: LIFECYCLE_REACTIVATION_SQL.replace('lag(m.arr_before_usd)', 'lag(m.arr_after_usd)'),
    fingerprintMessage: `The prior churn's arr_after_usd is zero by definition, so it cannot be the pre-churn ARR denominator. Carry the churn row's arr_before_usd forward instead.`,
    hints: [
      `Order each customer ledger once. On a reactivation row, LAG(movement_type), LAG(event_date), and LAG(arr_before_usd) describe the immediately prior churn episode.`,
      `LEAD(movement_id) tests whether anything happened after the return. Preserve its zero count; absence of follow-on observation blocks a durability conclusion.`,
      LIFECYCLE_REACTIVATION_SQL + `;\n\nThere are 205 reactivation episodes, all immediately after churn. Median inactive time is 138 days; $773,694 was restored against $968,417 of pre-churn ARR, or 79.9%. Every episode has zero follow-on events, so the ledger supplies no post-return durability or program-effect evidence.`,
    ],
    sayIt: `"The ledger shows 205 returns after a median 138 inactive days and 79.9% of pre-churn ARR restored. Because none has a later event, I would not claim durability or program success."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm116',
    part: 19,
    title: 'Route realized mature-book shrinkage',
    from: 'danny',
    ask: `Build the council's review queue: customers old enough for a closed 24-month checkpoint, active in June 2026, but below their acquisition ARR. Keep all qualifying rows, attach current customer labels and the latest CSM known by June 30 when available, and rank the largest realized shrinkage first. This is a review queue, not predicted risk.`,
    deliverable: `All qualifying rows: customer_id, current_customer_name, current_segment, acquisition_date, tenure_months, acquisition_plan, acquisition_arr_usd, june_arr_usd, shrinkage_usd, and latest_csm_as_of_june_30. Round dollars to 2; sort most negative shrinkage first, then customer_id.`,
    tables: ['fct_arr_movements', 'fct_subscription_snapshot_monthly', 'dim_customer', 'stg_customer_csm_assignments'],
    canonical: LIFECYCLE_SHRINKAGE_QUEUE_SQL,
    ordered: true,
    orderedNote: 'largest realized shrinkage first, then customer id',
    fingerprintSQL: LIFECYCLE_SHRINKAGE_QUEUE_SQL.replace('LEFT JOIN latest_csm l USING (customer_id)', 'JOIN latest_csm l USING (customer_id)'),
    fingerprintMessage: `The inner join discarded 81 qualifying customers without a loaded CSM assignment. Keep the complete shrinkage queue and let the routing label be null when assignment coverage is absent.`,
    hints: [
      `Keep one acquisition row, then join the active June snapshot. Eligibility is a closed 24-month anniversary; shrinkage means June ARR is below acquisition ARR.`,
      `Deduplicate assignments to the latest row known by June 30, but LEFT JOIN that optional routing label. Current customer labels are type-1 context, not historical facts.`,
      LIFECYCLE_SHRINKAGE_QUEUE_SQL + `;\n\nThe queue contains 243 mature active customers: $4.20M of acquisition ARR versus $3.51M in June, a $692,679 loaded decline. Eighty-one lack an assignment. C-09185 is the largest row at negative $97,441.53 over 47 completed months. This is realized endpoint shrinkage for review—not prediction, health, renewal timing, pricing, or causality.`,
    ],
    sayIt: `"I routed all 243 mature active customers below acquisition ARR, including 81 without a CSM label. The $692.7 thousand decline is realized endpoint shrinkage, not predicted churn risk."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm117',
    part: 19,
    title: 'Package the lifecycle council handoff',
    from: 'priya',
    ask: `Package one controlled handoff for the council. Keep the loaded populations, 6/12/24-month eligibility, 24-month endpoint maturity, opening-active customer-month exposure, reactivation observation, and mature-shrinkage queue together. The row must preserve every denominator and the zero post-reactivation follow-on count.`,
    deliverable: `Exactly one row: loaded_customers, loaded_movement_rows, loaded_active_customer_months, eligible_6m_customers, eligible_12m_customers, eligible_24m_customers, endpoint_active_24m_customers, endpoint_logo_survival_24m_pct, capped_grr_24m_pct, nrr_24m_pct, loaded_window_opening_active_customer_months, loaded_window_churn_events, churns_per_100_opening_active_customer_months, reactivation_episodes, reactivation_episodes_with_follow_on_events, mature_active_shrinkage_customers, and mature_active_shrinkage_usd.`,
    tables: ['dim_date', 'fct_arr_movements', 'fct_subscription_snapshot_monthly'],
    canonical: LIFECYCLE_HANDOFF_SQL,
    ordered: false,
    fingerprintSQL: LIFECYCLE_HANDOFF_SQL.replace(
      `  FROM endpoints\n), months AS`,
      `  FROM endpoints\n  WHERE endpoint_arr_usd > 0\n), months AS`,
    ),
    fingerprintMessage: `The handoff filtered maturity to endpoint survivors before counting eligibility, so the 24-month denominator collapsed to the active population. Preserve zero endpoints in the maturity CTE.`,
    hints: [
      `Reduce the maturity, exposure, reactivation, and shrinkage analyses to one row each, then CROSS JOIN those one-row controls. Carry populations beside rates.`,
      `The maturity denominator is fixed before endpoint state; churn uses customer-month exposure; reactivation keeps its zero follow-on count; shrinkage remains a realized endpoint queue.`,
      LIFECYCLE_HANDOFF_SQL + `;\n\nThe handoff preserves 9,500 customers, 16,734 movements, 131,550 active customer-month snapshots, 8,080/6,866/4,545 eligible customers, 24-month endpoint maturity, the 42-month churn exposure, 205 reactivations with zero follow-on events, and 243 mature active shrinkage rows. It supports a bounded loaded-data review—not renewal, health, usage, pricing, causality, staffing, or program-effect conclusions.`,
    ],
    sayIt: `"The handoff keeps every denominator visible: eligibility before outcomes, customer-month exposure beneath churn, zero follow-on evidence after reactivation, and the full realized shrinkage queue. I would present it as a bounded lifecycle review, not a prediction model."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm118',
    part: 20,
    title: 'Profile the ownership log before trusting it',
    from: 'elena',
    ask: `Assess whether the loaded ownership staging log can be reconstructed under stated rules—not whether ownership was good. Profile its grain, customer coverage, fanout, date bounds, and exact-name mapping to the CSM roster. In this fixture, a globally unique exact name is a checked invariant for reconstruction, not proof of real-world identity.`,
    deliverable: `Exactly one row: assignment_rows, assigned_customers, total_customers, never_assigned_customers, matched_csms, multirow_customers, historical_fanout_rows, first_assigned_on, last_assigned_on, unmatched_assignment_rows, and ambiguous_assignment_rows.`,
    tables: ['stg_customer_csm_assignments', 'dim_employee', 'dim_customer'],
    canonical: OWNERSHIP_PROFILE_SQL,
    ordered: false,
    fingerprintSQL: OWNERSHIP_PROFILE_SQL
      .replace('count(DISTINCT a.customer_id) AS assigned_customers', 'count(*) AS assigned_customers')
      .replace('(SELECT count(*) FROM dim_customer) - (SELECT count(*) FROM customer_history) AS never_assigned_customers', '(SELECT count(*) FROM dim_customer) - assignment_rows AS never_assigned_customers'),
    fingerprintMessage: `Assignment rows are not assigned customers. Deduplicate customer_id before subtracting coverage from the 9,500-customer population.`,
    hints: [
      `Treat the staging table like a transaction tab: rows, distinct customers, and extra history rows are three different populations. Profile names before using them as a join key.`,
      `Group assignments by customer for multirow and fanout counts. Separately group dim_employee by full_name and require exactly one global employee row and one CSM-department row.`,
      OWNERSHIP_PROFILE_SQL + `;\n\nThe log contains 8,546 rows for 4,674 customers; 2,688 customers have history, creating 3,872 extra rows. All 93 labels satisfy the fixture's unique exact-name rule, but 4,826 customers have no assignment. Name uniqueness is a loaded-data invariant, not identity proof.`,
    ],
    sayIt: `"I fixed the grain before joining: 8,546 assignment events cover 4,674 customers, while 4,826 customers are never assigned. The exact-name map is reconstructable in this fixture, not a real-world identity guarantee."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm119',
    part: 20,
    title: 'Check every assignment start against employment',
    from: 'priya',
    ask: `Now test each assignment start against the uniquely matched CSM's employment window. Treat hire date and termination date as inclusive boundaries, and keep assignment reason only as a reporting slice—not an explanation.`,
    deliverable: `Five rows by assignment_reason: assignment_rows, assigned_before_hire_rows, assigned_after_termination_rows, employment_consistent_rows, and employment_exception_pct. Round percent to 1 and sort by reason.`,
    tables: ['stg_customer_csm_assignments', 'dim_employee'],
    canonical: OWNERSHIP_EMPLOYMENT_SQL,
    ordered: true,
    orderedNote: 'assignment reason alphabetically',
    fingerprintSQL: OWNERSHIP_EMPLOYMENT_SQL
      .replace('WHERE assigned_on < hire_date) AS assigned_before_hire_rows', 'WHERE false) AS assigned_before_hire_rows')
      .replace(`WHERE assigned_on < hire_date\n       OR (termination_date IS NOT NULL AND assigned_on > termination_date)`, `WHERE termination_date IS NOT NULL AND assigned_on > termination_date`),
    fingerprintMessage: `Checking only post-termination starts finds 780 exceptions but misses 2,948 starts before hire. Test both inclusive employment boundaries.`,
    hints: [
      `This is a date-boundary control: assigned_on must be on or after hire_date and on or before termination_date when one exists.`,
      `Join through the unique exact-name roster from the profile. Count pre-hire and post-termination rows separately, then calculate their combined exception percentage by reason.`,
      OWNERSHIP_EMPLOYMENT_SQL + `;\n\nThe loaded log has 3,728 employment-window exceptions: 2,948 starts before hire and 780 after termination. Reason labels describe the source row; they do not explain why an exception exists.`,
    ],
    sayIt: `"The start-date control finds 3,728 exceptions across both sides of the employment window. I would call those reconstruction exceptions, not evidence about CSM performance or ownership quality."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm120',
    part: 20,
    title: 'Reconstruct ARR at each assignment start',
    from: 'elena',
    ask: `For every assignment event, recover the customer's latest ARR state on or before assigned_on. When multiple events share a date, movement_id is the deterministic tie-breaker. Show zero-state rows and customers by assignment reason without treating zero ARR as a performance signal.`,
    deliverable: `Five rows by assignment_reason: assignment_rows, state_missing_rows, active_arr_assignment_rows, zero_arr_assignment_rows, and zero_arr_customers. Sort by reason.`,
    tables: ['stg_customer_csm_assignments', 'fct_arr_movements'],
    canonical: OWNERSHIP_ASSIGNMENT_STATE_SQL,
    ordered: true,
    orderedNote: 'assignment reason alphabetically',
    fingerprintSQL: OWNERSHIP_ASSIGNMENT_STATE_SQL.replace('m.event_date <= a.assigned_on', 'm.event_date < a.assigned_on'),
    fingerprintMessage: `Strictly-before lookup drops the same-day acquisition state: 3,851 initial assignments become falsely missing. Use the latest event on or before assigned_on.`,
    hints: [
      `For each assignment row, think XLOOKUP newest-to-oldest: same customer, event_date no later than assigned_on, then latest date and movement_id.`,
      `A LEFT JOIN LATERAL with ORDER BY event_date DESC, movement_id DESC LIMIT 1 preserves every assignment while selecting one point-in-time state.`,
      OWNERSHIP_ASSIGNMENT_STATE_SQL + `;\n\nThe on-or-before lookup finds 1,085 zero-ARR assignment rows and no missing states. Those rows are a staging-control population; the fixture contains no evidence that links them to CSM health, performance, or causality.`,
    ],
    sayIt: `"I reconstructed state at the assignment timestamp using an inclusive date boundary and deterministic event tie-breaker. The 1,085 zero-state rows are control exceptions to review, not account-health conclusions."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm121',
    part: 20,
    title: 'Separate transitions from reason claims',
    from: 'priya',
    ask: `Sequence each customer's ownership events. Count owner changes, adjacent no-ops, any repeated owner, and owners who return after someone else. Then test only whether a CSM departure label is supported by the prior owner's termination on or before reassignment; do not let any reason label change the sequence or imply cause.`,
    deliverable: `Exactly one row: transition_rows, owner_change_rows, adjacent_noop_rows, repeated_owner_rows, returned_owner_rows, departure_reason_rows, departure_reason_with_timing_support_rows, departure_reason_without_timing_support_rows, and other_reason_rows_not_timing_verifiable.`,
    tables: ['stg_customer_csm_assignments', 'dim_employee'],
    canonical: OWNERSHIP_TRANSITION_SQL,
    ordered: false,
    fingerprintSQL: OWNERSHIP_TRANSITION_SQL.replace('prior_owner_termination_date <= assigned_on', 'prior_owner_termination_date IS NOT NULL'),
    fingerprintMessage: `A prior owner terminating eventually does not support the departure label at reassignment time. The termination must occur on or before that transition.`,
    hints: [
      `Use LAG for the adjacent owner and a cumulative prior count at customer × owner grain for repeats. A repeat after a different adjacent owner is a return.`,
      `Join the prior owner—not the new owner—to employment dates. Timing can support a departure label, but the other synthetic labels remain unverifiable from these tables.`,
      OWNERSHIP_TRANSITION_SQL + `;\n\nThere are 3,872 transitions, 3,845 owner changes, 27 adjacent no-ops, 44 repeated-owner rows, and 17 returns. Only 255 of 1,000 departure labels have timing support; 745 do not. Timing support is not causal proof.`,
    ],
    sayIt: `"I separated event structure from source labels: 27 transitions are no-ops and 44 repeat an owner. Only 255 departure labels align with a prior termination by reassignment, which supports timing—not cause."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm122',
    part: 20,
    title: 'Build half-open ownership ranges',
    from: 'elena',
    ask: `Turn every assignment start into a half-open range: assigned_on inclusive, the next assignment exclusive, and July 1, 2026 as the loaded terminal boundary. Intersect each range with the matched owner's inclusive employment dates. Reason labels must not alter the ranges.`,
    deliverable: `Exactly one row: assignment_ranges, invalid_or_empty_ranges, ranges_without_employment_intersection, partially_employed_ranges, fully_employed_ranges, assignment_days, employed_overlap_days, and outside_employment_days.`,
    tables: ['stg_customer_csm_assignments', 'dim_employee'],
    canonical: OWNERSHIP_RANGES_SQL,
    ordered: false,
    fingerprintSQL: OWNERSHIP_RANGES_SQL
      .replace(`lead(assigned_on, 1, DATE '2026-07-01')`, `lead(assigned_on)`)
      .replace(`JOIN exact_csm_roster r ON a.csm_name = r.full_name\n), range_days`, `JOIN exact_csm_roster r ON a.csm_name = r.full_name\n  WHERE a.range_end_exclusive IS NOT NULL\n), range_days`),
    fingerprintMessage: `LEAD without a terminal boundary drops each customer's current range. Preserve all 8,546 starts by ending open ranges at July 1, 2026.`,
    hints: [
      `A half-open range is the SQL version of “effective from this date until, but not including, the next start.” LEAD supplies the next boundary.`,
      `Termination date is inclusive, so its exclusive boundary is termination_date plus one day. Clip overlap with GREATEST starts and LEAST ends, then keep zero overlap.`,
      OWNERSHIP_RANGES_SQL + `;\n\nAll 8,546 starts become ranges through the loaded cutoff. They contain 3,270,299 assignment-days: 2,167,100 inside employment and 1,103,199 outside. That is reconstructability evidence, not a staffing or performance conclusion.`,
    ],
    sayIt: `"I built all 8,546 half-open ranges, including current assignments, and intersected them with inclusive employment windows. About 1.10 million loaded assignment-days sit outside employment."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm123',
    part: 20,
    title: 'Measure point-in-time month coverage',
    from: 'danny',
    ask: `For every loaded active customer-month, independently resolve the latest assignment as of that month-end. Show assignment coverage and the stricter population where both the assignment start and that month-end are employment-consistent. Include ARR-month coverage as a diagnostic sum of monthly ending ARR observations—not revenue, risk, or capacity.`,
    deliverable: `Four rows: All plans, then each acquisition_plan, with active_customer_months, assigned_customer_months, assignment_coverage_pct, employment_consistent_owner_customer_months, employment_consistent_owner_coverage_pct, total_active_arr_month_usd, assigned_arr_month_usd, and assignment_arr_coverage_pct. Round dollars to 2 and percentages to 1.`,
    tables: ['fct_subscription_snapshot_monthly', 'fct_arr_movements', 'stg_customer_csm_assignments', 'dim_employee'],
    canonical: OWNERSHIP_MONTH_COVERAGE_SQL,
    ordered: true,
    orderedNote: 'All plans first, then acquisition plan alphabetically',
    fingerprintSQL: OWNERSHIP_MONTH_COVERAGE_SQL.replace(`a.assigned_on <= am.month_end`, `a.assigned_on <= DATE '2026-06-30'`),
    fingerprintMessage: `The June owner was pushed backward into earlier months. Resolve the latest assignment independently at every month-end before testing employment consistency.`,
    hints: [
      `Start from the 131,550 active snapshot rows. Each customer-month gets its own newest assignment whose start is no later than that month's last day.`,
      `Employment-consistent coverage requires the assignment start and the observed month-end to both fall inside the same matched owner's employment window.`,
      OWNERSHIP_MONTH_COVERAGE_SQL + `;\n\nAcross 131,550 active customer-months, 70,745 are assigned (53.8%) and 35,076 are employment-consistent through month-end (26.7%). Assigned ARR-month coverage is 95.9%; ARR-month is repeated monthly ending ARR, not revenue or economic exposure.`,
    ],
    sayIt: `"I resolved ownership separately at every month-end. Assignment coverage is 53.8% of active customer-months and 95.9% of ARR-month observations; the stricter employment-consistent population is 26.7%."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm124',
    part: 20,
    title: 'Find active-month coverage gaps',
    from: 'danny',
    ask: `Turn uncovered active customer-months into contiguous calendar episodes. An inactive calendar month breaks an episode even when the customer later reactivates; do not stretch one gap across months absent from the active-only snapshot.`,
    deliverable: `One row per acquisition_plan with a gap: gap_episodes, customers_with_gap, uncovered_active_customer_months, longest_gap_active_months, and uncovered_arr_month_usd. Round ARR-month to 2 and sort by plan.`,
    tables: ['fct_subscription_snapshot_monthly', 'fct_arr_movements', 'stg_customer_csm_assignments'],
    canonical: OWNERSHIP_ACTIVE_GAPS_SQL,
    ordered: true,
    orderedNote: 'acquisition plan alphabetically',
    fingerprintSQL: OWNERSHIP_ACTIVE_GAPS_COLLAPSED_SQL,
    fingerprintMessage: `One lifetime gap per customer bridges inactive calendar periods and invents uncovered active months. Break episodes whenever adjacent uncovered rows are not consecutive months.`,
    hints: [
      `Filter to active customer-months without an as-of assignment. LAG the prior uncovered month per customer; a new episode starts unless the dates are one month apart.`,
      `Cumulatively sum the new-episode flag, then group customer × episode. Count actual active rows for duration—never infer duration from first and last date across inactivity.`,
      OWNERSHIP_ACTIVE_GAPS_SQL + `;\n\nStarter contains 4,624 active-month gap episodes across 4,515 customers and 60,805 uncovered active customer-months. The $72.84 million ARR-month review population is a diagnostic sum, not realized revenue or ARR at risk.`,
    ],
    sayIt: `"I found 4,624 contiguous active-month gaps without bridging inactive periods. The 60,805 rows are a coverage-diagnostic population, not a risk or capacity measure."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm125',
    part: 20,
    title: 'Size the June review population',
    from: 'priya',
    ask: `At June 30, 2026, preserve the full active customer book and assign each row to at most one review class: unassigned first, then start outside owner employment, then currently unemployed owner. Keep the classes mutually exclusive and report their union without double counting.`,
    deliverable: `Exactly one row: june_active_customers, june_arr_usd, june_assigned_customers, june_unassigned_customers, june_unassigned_arr_usd, june_start_outside_employment_customers, june_start_outside_employment_arr_usd, june_currently_unemployed_owner_customers, june_review_customers, june_review_arr_usd, and june_review_arr_pct. Round dollars to 2 and percent to 1.`,
    tables: ['fct_subscription_snapshot_monthly', 'stg_customer_csm_assignments', 'dim_employee'],
    canonical: OWNERSHIP_JUNE_CONTROL_SQL,
    ordered: false,
    fingerprintSQL: OWNERSHIP_JUNE_CONTROL_SQL.replace('LEFT JOIN latest_assignment assignment USING (customer_id)', 'JOIN latest_assignment assignment USING (customer_id)'),
    fingerprintMessage: `The inner as-of join removed all 2,206 unassigned customers before review materiality was calculated. Preserve the full June active population with a left join.`,
    hints: [
      `Begin with all 4,869 June active snapshot rows. Resolve at most one latest assignment as of June 30, then classify with one ordered CASE so categories cannot overlap.`,
      `Current employment and assignment-start consistency are different checks. Preserve the zero currently-unemployed class rather than silently dropping it.`,
      OWNERSHIP_JUNE_CONTROL_SQL + `;\n\nJune has 4,869 active customers and $74.67 million ARR. The mutually exclusive review union contains 2,206 unassigned customers plus 656 starts outside owner employment: 2,862 customers and $19.85 million, or 26.6% of the loaded June book. This is review materiality, not ARR at risk.`,
    ],
    sayIt: `"I preserved the full June book and built mutually exclusive review classes. The union is 2,862 customers and $19.85 million of loaded ending ARR, a review population rather than economic risk."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm126',
    part: 20,
    title: 'Build a balanced two-class review queue',
    from: 'elena',
    ask: `Build a deterministic review queue with exactly the ten largest June ARR rows from each populated class: unassigned and start outside owner employment. Rank inside each class by ending ARR, then customer_id; do not let one larger-dollar class crowd out the other.`,
    deliverable: `Twenty rows: exception_class, class_rank, customer_id, current_customer_name, current_segment, june_arr_usd, latest_csm_name, latest_csm_assigned_on, owner_hire_date, and owner_termination_date. Sort by class, then class_rank.`,
    tables: ['fct_subscription_snapshot_monthly', 'dim_customer', 'stg_customer_csm_assignments', 'dim_employee'],
    canonical: OWNERSHIP_EXCEPTION_QUEUE_SQL,
    ordered: true,
    orderedNote: 'exception class alphabetically, then rank 1 through 10',
    fingerprintSQL: OWNERSHIP_EXCEPTION_QUEUE_SQL.replace('LEFT JOIN latest_assignment assignment USING (customer_id)', 'JOIN latest_assignment assignment USING (customer_id)'),
    fingerprintMessage: `The inner join erased the unassigned class, leaving ten rows from only one exception type. Preserve unassigned customers, then rank ten rows independently inside each class.`,
    hints: [
      `Classify the complete June book first. Then ROW_NUMBER within exception_class—this is two top-ten lists unioned into one deterministic queue.`,
      `Keep source evidence beside each row: current labels, latest assignment start, and matched employment dates. The queue routes review; it does not score accounts or people.`,
      OWNERSHIP_EXCEPTION_QUEUE_SQL + `;\n\nThe balanced queue contains ten rows per class and $3.51 million of June ending ARR. C-06736 leads starts outside owner employment at $513,921.58; the largest unassigned rows are $1,856.25. Balance preserves both control classes without implying risk or priority beyond this review rule.`,
    ],
    sayIt: `"I ranked inside each exception class, so the queue keeps ten unassigned and ten start-outside-employment rows instead of letting the larger-dollar class erase the other control."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm127',
    part: 20,
    title: 'Package the ownership-control handoff',
    from: 'priya',
    ask: `Package one controlled row that preserves the ownership-log populations, employment and transition exceptions, half-open range days, point-in-time active-month coverage, gap episodes, and mutually exclusive June review materiality. Keep every denominator beside its percentage.`,
    deliverable: `Exactly one row: assignment_rows, assigned_customers, employment_exception_rows, zero_arr_assignment_rows, adjacent_noop_rows, repeated_owner_rows, departure_reason_without_timing_support_rows, outside_employment_days, active_customer_months, assigned_customer_months, assignment_coverage_pct, employment_consistent_owner_customer_months, employment_consistent_owner_coverage_pct, total_active_arr_month_usd, assigned_arr_month_usd, assignment_arr_coverage_pct, gap_episodes, june_active_customers, june_arr_usd, june_assigned_customers, june_unassigned_customers, june_unassigned_arr_usd, june_start_outside_employment_customers, june_start_outside_employment_arr_usd, june_currently_unemployed_owner_customers, june_review_customers, june_review_arr_usd, and june_review_arr_pct.`,
    tables: ['stg_customer_csm_assignments', 'dim_employee', 'fct_arr_movements', 'fct_subscription_snapshot_monthly'],
    canonical: OWNERSHIP_HANDOFF_SQL,
    ordered: false,
    fingerprintSQL: OWNERSHIP_HANDOFF_SQL.replace(
      `FROM active_months am\n  LEFT JOIN LATERAL (\n    SELECT a.csm_name, a.assigned_on\n    FROM stg_customer_csm_assignments a\n    WHERE a.customer_id = am.customer_id\n      AND a.assigned_on <= am.month_end\n    ORDER BY a.assigned_on DESC, a.csm_name, a.assignment_reason\n    LIMIT 1\n  ) assignment ON true`,
      `FROM active_months am\n  LEFT JOIN stg_customer_csm_assignments assignment\n    ON assignment.customer_id = am.customer_id\n   AND assignment.assigned_on <= am.month_end`,
    ),
    fingerprintMessage: `The raw history join fans one customer-month into many assignment rows, producing impossible ARR-month coverage above 100%. Resolve one latest assignment per customer-month before aggregating.`,
    hints: [
      `Treat each prior control like a one-cell summary tab, then CROSS JOIN those one-row aggregates. The month numerator must come from one as-of assignment per active customer-month.`,
      `Keep customer-month and ARR-month denominators visible. ARR-month is the sum of loaded monthly ending ARR observations; it is not revenue, capacity, risk, or a causal outcome.`,
      OWNERSHIP_HANDOFF_SQL + `;\n\nThe handoff preserves 8,546 assignment rows for 4,674 customers, 3,728 employment exceptions, 1,085 zero-state starts, 1,103,199 days outside employment, 131,550 active customer-months, 70,745 assigned months (53.8%), 35,076 employment-consistent months (26.7%), and 95.9% ARR-month assignment coverage. June's mutually exclusive review union is 2,862 customers and $19.85 million of the $74.67 million loaded book, or 26.6%. These are reconstruction controls, not conclusions about account health, employee performance, staffing, renewals, or ARR at risk.`,
    ],
    sayIt: `"The handoff keeps every population beside its rate and catches raw-history fanout through ARR-month coverage. It supports a bounded reconstruction review, not a performance, health, staffing, or economic-risk claim."`,
    jdCompanies: ['Figma'],
  },
  ...REFORECAST_OUTCOME_MISSIONS,
  ...SHARED_SERVICES_ALLOCATION_MISSIONS,
  ...COST_TO_SERVE_REVIEW_MISSIONS,
  ...CONTRACTOR_CONSULTING_COST_REVIEW_MISSIONS,
  ...TRAVEL_EXPENSE_REVIEW_MISSIONS,
  ...REVENUE_CLOSE_USAGE_REVIEW_MISSIONS,
  ...H1_PNL_PLAN_VARIANCE_REVIEW_MISSIONS,
  ...ARR_RETENTION_REVIEW_MISSIONS,
  ...MONTHLY_PNL_TREND_MISSIONS,
  ...PAYROLL_BRIDGE_MISSIONS,
  ...REVENUE_ARR_RECONCILIATION_MISSIONS,
  ...COHORT_TENURE_MISSIONS,
  ...PAYMENT_TERMS_MISSIONS,
  ...PLAN_MIX_MISSIONS,
  ...COMP_BAND_MISSIONS,
]

// Authored Screen Simulations (unlock after m17). Each set follows the real
// decision loop it teaches; question count is content, not a product constant.
// Timer counts up, hints are off, and every question has a model answer plus
// model narration for the debrief.
const SCREEN_SIM_01 = {
  id: 'sim01',
  title: 'The customer-metrics screen',
  intro: `This fictional Star67 screen turns the SQL and modern-warehouse work in Hightouch's verified Strategic Finance requirement into four escalating customer-metrics questions. It is not a claim about Hightouch's interview format or internal process. Hints are off. The timer counts up — it's information, not pressure. Say your plan out loud before you type, even alone at your desk. Especially alone at your desk.`,
  questions: [
    {
      id: 'sim01-q1',
      ask: `Q1 — warm-up: Total ARR for the Enterprise segment, June 2026.`,
      deliverable: `One number: sum of June-2026 arr_usd for customers whose segment is Enterprise.`,
      tables: ['fct_subscription_snapshot_monthly', 'dim_customer'],
      canonical: `SELECT round(sum(s.arr_usd), 2) AS enterprise_arr FROM fct_subscription_snapshot_monthly s JOIN dim_customer c ON s.customer_id = c.customer_id WHERE s.month_start = DATE '2026-06-01' AND c.segment = 'Enterprise'`,
      ordered: false,
      narration: `"Snapshot is customer-month grain, so I pin the month, join the customer dim for segment, filter, sum."`,
    },
    {
      id: 'sim01-q2',
      ask: `Q2 — the join: Number of active customers and total ARR by segment, June 2026.`,
      deliverable: `Three rows: segment, customer count, total ARR, sorted by ARR descending.`,
      tables: ['fct_subscription_snapshot_monthly', 'dim_customer'],
      canonical: `SELECT c.segment, count(*) AS customers, round(sum(s.arr_usd), 2) AS arr FROM fct_subscription_snapshot_monthly s JOIN dim_customer c ON s.customer_id = c.customer_id WHERE s.month_start = DATE '2026-06-01' GROUP BY c.segment ORDER BY arr DESC`,
      ordered: true,
      orderedNote: 'biggest ARR first',
      narration: `"Same join, now grouped by segment — and I'd sanity-check that the three ARR numbers sum to the total from Q1's table before moving on."`,
    },
    {
      id: 'sim01-q3',
      ask: `Q3 — time comparison: monthly total ARR with month-over-month change, for the first half of 2026.`,
      deliverable: `Six rows, chronological: month, total ARR, MoM change in dollars (NULL for January).`,
      tables: ['fct_subscription_snapshot_monthly'],
      canonical: `WITH m AS (SELECT month_start, sum(arr_usd) AS arr FROM fct_subscription_snapshot_monthly WHERE month_start BETWEEN DATE '2026-01-01' AND DATE '2026-06-01' GROUP BY 1) SELECT month_start, round(arr, 2) AS arr, round(arr - lag(arr) OVER (ORDER BY month_start), 2) AS mom_change FROM m ORDER BY month_start`,
      ordered: true,
      orderedNote: 'January first',
      requireRegex: ORDERED_WINDOW_REQUIREMENT,
      requireMessage: `Right numbers — but the OVER ( ) has no ORDER BY, so "the previous row" was luck, not logic. In the real screen this is exactly what the interviewer probes. ORDER BY inside the OVER and it's genuinely correct.`,
      narration: `"Aggregate to month first, then LAG over the month order for the delta — aggregate, then window, in that order."`,
    },
    {
      id: 'sim01-q4',
      ask: `Q4 — the stretch: Which customers churned in Q2 2026 (active in March, gone by June), and how much ARR walked out? Return the churned ARR total and the customer count.`,
      deliverable: `One row: total ARR that churned (their March-2026 ARR) and the count of churned customers.`,
      tables: ['fct_subscription_snapshot_monthly'],
      canonical: `SELECT round(sum(m.arr_usd), 2) AS churned_arr, count(*) AS churned_customers FROM (SELECT customer_id, arr_usd FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-03-01') m LEFT JOIN (SELECT customer_id FROM fct_subscription_snapshot_monthly WHERE month_start = DATE '2026-06-01') j ON m.customer_id = j.customer_id WHERE j.customer_id IS NULL`,
      ordered: false,
      narration: `"Churn is an anti-join: March's customers, LEFT-joined to June, keeping the ones with no match. I'd quote their March ARR as the walked-out number and note that mid-quarter joins-and-churns are invisible at this grain."`,
    },
  ],
}

const SCREEN_SIM_02 = {
  id: 'sim02',
  title: 'The workforce screen: 30 minutes, 4 questions',
  intro: `This screen is the operating-plan version of the interview: one employee dimension, monthly payroll, the GL, and the budget. Four questions build from a point-in-time headcount to a plan variance. Hints are off. The timer counts up, and the strongest answer includes the grain and date logic before the SQL. Say what each row means, name the edge cases, then type.`,
  questions: [
    {
      id: 'sim02-q1',
      ask: `Q1 — warm-up: How many employees were active at the end of June 2026?`,
      deliverable: `One number: active headcount as of June 30, 2026. Include employees hired by that date and exclude anyone whose termination date was on or before it.`,
      tables: ['dim_employee'],
      canonical: `SELECT count(*) AS active_headcount FROM dim_employee WHERE hire_date <= DATE '2026-06-30' AND (termination_date IS NULL OR termination_date > DATE '2026-06-30')`,
      ordered: false,
      narration: `"This is a point-in-time population: hired by June 30, with no termination on or before the cutoff. I keep the NULL termination dates because those are current employees."`,
    },
    {
      id: 'sim02-q2',
      ask: `Q2 — the cost view: For June 2026, show paid employees and total people cost by division.`,
      deliverable: `One row per division: division, count of June payroll rows, and total_comp_usd summed and rounded to 2 decimals, sorted from highest people cost to lowest.`,
      tables: ['fct_payroll_monthly', 'dim_department'],
      canonical: `SELECT d.division, count(*) AS employees, round(sum(p.total_comp_usd), 2) AS monthly_people_cost FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id WHERE p.payroll_month = DATE '2026-06-01' GROUP BY d.division ORDER BY monthly_people_cost DESC`,
      ordered: true,
      orderedNote: 'highest people cost first',
      narration: `"Payroll is employee-month grain, so one month gives one paid row per employee. I join the department dimension for division, then aggregate headcount and fully loaded cost at the same grain."`,
    },
    {
      id: 'sim02-q3',
      ask: `Q3 — the workforce bridge: Reconcile opening headcount to closing headcount for the first half of 2026, by division.`,
      deliverable: `One row per division: opening headcount at December 31, 2025; hires and exits from January 1 through June 30, 2026; and closing headcount at June 30, 2026. Sort by closing headcount descending, then division.`,
      tables: ['dim_employee', 'dim_department'],
      canonical: `SELECT d.division, count(*) FILTER (WHERE e.hire_date <= DATE '2025-12-31' AND (e.termination_date IS NULL OR e.termination_date > DATE '2025-12-31')) AS opening_headcount, count(*) FILTER (WHERE e.hire_date BETWEEN DATE '2026-01-01' AND DATE '2026-06-30') AS hires, count(*) FILTER (WHERE e.termination_date BETWEEN DATE '2026-01-01' AND DATE '2026-06-30') AS exits, count(*) FILTER (WHERE e.hire_date <= DATE '2026-06-30' AND (e.termination_date IS NULL OR e.termination_date > DATE '2026-06-30')) AS closing_headcount FROM dim_employee e JOIN dim_department d ON e.dept_id = d.dept_id GROUP BY d.division ORDER BY closing_headcount DESC, d.division`,
      ordered: true,
      orderedNote: 'highest closing headcount first, then division',
      narration: `"I use conditional counts over one employee population: two as-of definitions plus the hires and exits between them. Then I check opening plus hires minus exits equals closing in every division before sharing it."`,
    },
    {
      id: 'sim02-q4',
      ask: `Q4 — the stretch: Which departments were most over their Q2 2026 people-cost plan?`,
      deliverable: `Five rows: department name, Q2 actual people cost, FY2026 Plan people cost, and variance (actual minus plan), sorted by the largest unfavorable variance. People cost is GL accounts 5300, 5310, 6000, 6020, and 6030. Keep departments that appear on only one side of the comparison.`,
      tables: ['fct_gl_transactions', 'dim_department', 'fct_budget'],
      canonical: `WITH actuals AS (SELECT d.dept_name, sum(g.amount) AS actual_people_cost FROM fct_gl_transactions g JOIN dim_department d ON g.dept_id = d.dept_id WHERE g.account_id IN ('5300', '5310', '6000', '6020', '6030') AND g.txn_date BETWEEN DATE '2026-04-01' AND DATE '2026-06-30' GROUP BY d.dept_name), plan AS (SELECT dept_name_raw AS dept_name, sum(amount_usd) AS plan_people_cost FROM fct_budget WHERE version_name = 'FY2026 Plan' AND account_id IN ('5300', '5310', '6000', '6020', '6030') AND fiscal_month BETWEEN DATE '2026-04-01' AND DATE '2026-06-01' GROUP BY dept_name_raw) SELECT COALESCE(a.dept_name, p.dept_name) AS dept_name, round(COALESCE(a.actual_people_cost, 0), 2) AS actual_people_cost, round(COALESCE(p.plan_people_cost, 0), 2) AS plan_people_cost, round(COALESCE(a.actual_people_cost, 0) - COALESCE(p.plan_people_cost, 0), 2) AS variance_usd FROM actuals a FULL OUTER JOIN plan p USING (dept_name) ORDER BY variance_usd DESC, dept_name LIMIT 5`,
      ordered: true,
      orderedNote: 'largest unfavorable variance first',
      requireRegex: String.raw`full\s+(?:outer\s+)?join`,
      requireMessage: `Right numbers on this slice, but the join still needs to preserve departments found on only one side. Use a FULL OUTER JOIN between actuals and plan, then COALESCE the missing dollars to zero — otherwise an unplanned department or an unused budget quietly disappears.`,
      narration: `"I align actual and plan to the same quarter, account set, and department grain before joining. FULL OUTER JOIN protects both unplanned spend and unused budget; COALESCE turns either missing side into zero before I calculate the variance."`,
    },
  ],
}

const SCREEN_SIM_03 = {
  id: 'sim03',
  title: 'The 1Password close-debugging audition',
  intro: `This audition is built from 1Password's verified requirement that you be as comfortable debugging SQL as discussing pipeline risk. Star67's warehouse has one known duplicate load and one late-posted close entry. Four questions move from detection to a quantified Controller-ready summary. This is JD-informed practice over fictional Star67 data — not a claim about 1Password's interview.`,
  questions: [
    {
      id: 'sim03-q1',
      ask: `Q1 — identify the load problem: Which March 2024 Stripe subscription-revenue entries were loaded more than once?`,
      deliverable: `One row with duplicate_groups and extra_rows. Restrict the search to account 4000, Stripe, and March 2024; group on the journal-entry business key before counting the repeated groups.`,
      tables: ['fct_gl_transactions'],
      canonical: `WITH repeated AS (SELECT je_id, memo, amount, count(*) AS copies FROM fct_gl_transactions WHERE txn_date BETWEEN DATE '2024-03-01' AND DATE '2024-03-31' AND account_id = '4000' AND source_system = 'Stripe' GROUP BY je_id, memo, amount HAVING count(*) > 1) SELECT count(*) AS duplicate_groups, sum(copies - 1)::BIGINT AS extra_rows FROM repeated`,
      ordered: false,
      narration: `"I grouped the narrow Stripe revenue slice by the business key and amount, then used HAVING to isolate keys loaded more than once. That distinguishes a duplicate ingestion from legitimate separate revenue lines."`,
    },
    {
      id: 'sim03-q2',
      ask: `Q2 — correct the close number: What should March 2024 Stripe subscription revenue be after deduplicating the repeated entries?`,
      deliverable: `One row with reported_revenue, duplicate_overstatement, and corrected_revenue, each rounded to 2 decimals. Count one copy of each duplicated journal entry as real and remove only the extras.`,
      tables: ['fct_gl_transactions'],
      canonical: `WITH stripe AS (SELECT je_id, memo, amount FROM fct_gl_transactions WHERE txn_date BETWEEN DATE '2024-03-01' AND DATE '2024-03-31' AND account_id = '4000' AND source_system = 'Stripe'), deduped AS (SELECT je_id, memo, amount, row_number() OVER (PARTITION BY je_id, memo, amount ORDER BY je_id) AS copy_number FROM stripe) SELECT round(sum(amount), 2) AS reported_revenue, round(sum(CASE WHEN copy_number > 1 THEN amount ELSE 0 END), 2) AS duplicate_overstatement, round(sum(CASE WHEN copy_number = 1 THEN amount ELSE 0 END), 2) AS corrected_revenue FROM deduped`,
      ordered: false,
      narration: `"I retained one legitimate row per duplicated business key, quantified only the excess copies as overstatement, and reconciled reported less overstatement to corrected revenue."`,
    },
    {
      id: 'sim03-q3',
      ask: `Q3 — reconstruct the locked deck: For January 2026, which accounts changed after the February 5 board-deck lock?`,
      deliverable: `One row per affected account: account_name, locked_deck_amount using rows posted by February 5, current_amount using all January accounting-date rows, and change_usd, ordered by the largest change first.`,
      tables: ['fct_gl_transactions', 'dim_account'],
      canonical: `SELECT a.account_name, round(sum(CASE WHEN g.posted_at <= DATE '2026-02-05' THEN g.amount ELSE 0 END), 2) AS locked_deck_amount, round(sum(g.amount), 2) AS current_amount, round(sum(CASE WHEN g.posted_at > DATE '2026-02-05' THEN g.amount ELSE 0 END), 2) AS change_usd FROM fct_gl_transactions g JOIN dim_account a ON g.account_id = a.account_id WHERE g.txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31' GROUP BY a.account_name HAVING sum(CASE WHEN g.posted_at > DATE '2026-02-05' THEN abs(g.amount) ELSE 0 END) > 0 ORDER BY change_usd DESC`,
      ordered: true,
      orderedNote: 'largest change first',
      narration: `"I separated accounting date from warehouse posting date, rebuilt the exact February 5 knowledge cutoff, and isolated only January accounts with later postings."`,
    },
    {
      id: 'sim03-q4',
      ask: `Q4 — quantify the close risk: Summarize the two known integrity issues in a compact table for Rex.`,
      deliverable: `Exactly two rows: issue, period, net_exposure_usd, gross_movement_usd, and affected_items. Use issue labels Duplicate Stripe load and Late-posted close change. The late reclass nets to zero, so preserve its gross movement and affected-account count instead of hiding the close risk.`,
      tables: ['fct_gl_transactions'],
      canonical: `WITH duplicate_load AS (SELECT 'Duplicate Stripe load' AS issue, '2024-03' AS period, round(sum(amount * (copies - 1)), 2) AS net_exposure_usd, round(sum(abs(amount) * (copies - 1)), 2) AS gross_movement_usd, count(*)::BIGINT AS affected_items FROM (SELECT amount, count(*) AS copies FROM fct_gl_transactions WHERE txn_date BETWEEN DATE '2024-03-01' AND DATE '2024-03-31' AND account_id = '4000' AND source_system = 'Stripe' GROUP BY je_id, memo, amount HAVING count(*) > 1) d), late_close AS (SELECT 'Late-posted close change' AS issue, '2026-01' AS period, round(sum(amount), 2) AS net_exposure_usd, round(sum(abs(amount)), 2) AS gross_movement_usd, count(DISTINCT account_id)::BIGINT AS affected_items FROM fct_gl_transactions WHERE txn_date BETWEEN DATE '2026-01-01' AND DATE '2026-01-31' AND posted_at > DATE '2026-02-05') SELECT * FROM duplicate_load UNION ALL SELECT * FROM late_close ORDER BY gross_movement_usd DESC`,
      ordered: true,
      orderedNote: 'largest absolute exposure first',
      narration: `"The duplicate load is a historical revenue overstatement that needs a deduped correction; the late-posted item is a timing-driven close restatement. I quantified both dollars and affected records so the Controller can prioritize remediation and disclosure."`,
    },
  ],
}

const FIGMA_COMPARISON_POPULATION_SQL = `WITH original AS (
  SELECT
    fiscal_month,
    account_id,
    upper(trim(dept_name_raw)) AS dept_key,
    amount_usd
  FROM fct_budget
  WHERE version_name = 'FY2025 Plan'
    AND fiscal_month BETWEEN DATE '2025-04-01' AND DATE '2025-12-01'
),
reforecast AS (
  SELECT
    fiscal_month,
    account_id,
    upper(trim(dept_name_raw)) AS dept_key,
    amount_usd
  FROM fct_budget
  WHERE version_name = 'FY2025 Q2 Reforecast'
    AND fiscal_month BETWEEN DATE '2025-04-01' AND DATE '2025-12-01'
),
compared AS (
  SELECT
    coalesce(o.fiscal_month, r.fiscal_month) AS fiscal_month,
    coalesce(o.account_id, r.account_id) AS account_id,
    coalesce(o.dept_key, r.dept_key) AS dept_key,
    o.amount_usd AS original_usd,
    r.amount_usd AS reforecast_usd
  FROM original o
  FULL OUTER JOIN reforecast r
    USING (fiscal_month, account_id, dept_key)
)
SELECT
  min(fiscal_month) AS first_comparison_month,
  max(fiscal_month) AS last_comparison_month,
  count(DISTINCT fiscal_month)::BIGINT AS comparison_months,
  count(original_usd)::BIGINT AS original_keys,
  count(reforecast_usd)::BIGINT AS reforecast_keys,
  count(*) FILTER (
    WHERE original_usd IS NOT NULL
      AND reforecast_usd IS NOT NULL
  )::BIGINT AS matched_keys,
  count(*) FILTER (
    WHERE original_usd IS NOT NULL
      AND reforecast_usd IS NOT NULL
      AND original_usd <> reforecast_usd
  )::BIGINT AS changed_matched_keys,
  count(*) FILTER (
    WHERE original_usd IS NOT NULL
      AND reforecast_usd IS NOT NULL
      AND original_usd = reforecast_usd
  )::BIGINT AS unchanged_matched_keys,
  count(*) FILTER (
    WHERE original_usd IS NOT NULL
      AND reforecast_usd IS NULL
  )::BIGINT AS original_only_keys,
  count(*) FILTER (
    WHERE original_usd IS NULL
      AND reforecast_usd IS NOT NULL
  )::BIGINT AS reforecast_only_keys,
  round(sum(coalesce(original_usd, 0)), 2) AS original_plan_usd,
  round(sum(coalesce(reforecast_usd, 0)), 2) AS q2_reforecast_usd
FROM compared`

const FIGMA_ARTIFACT_BRIDGE_SQL = `WITH original AS (
  SELECT
    fiscal_month,
    account_id,
    upper(trim(dept_name_raw)) AS dept_key,
    amount_usd
  FROM fct_budget
  WHERE version_name = 'FY2025 Plan'
    AND fiscal_month BETWEEN DATE '2025-04-01' AND DATE '2025-12-01'
),
reforecast AS (
  SELECT
    fiscal_month,
    account_id,
    upper(trim(dept_name_raw)) AS dept_key,
    amount_usd
  FROM fct_budget
  WHERE version_name = 'FY2025 Q2 Reforecast'
    AND fiscal_month BETWEEN DATE '2025-04-01' AND DATE '2025-12-01'
),
compared AS (
  SELECT
    coalesce(o.account_id, r.account_id) AS account_id,
    coalesce(o.amount_usd, 0) AS original_usd,
    coalesce(r.amount_usd, 0) AS reforecast_usd
  FROM original o
  FULL OUTER JOIN reforecast r
    USING (fiscal_month, account_id, dept_key)
)
SELECT
  a.account_type AS pl_line,
  round(sum(c.original_usd), 2) AS original_plan_usd,
  round(sum(c.reforecast_usd), 2) AS q2_reforecast_usd,
  round(sum(c.reforecast_usd - c.original_usd), 2) AS artifact_delta_usd,
  round(
    100.0 * sum(c.reforecast_usd - c.original_usd)
      / nullif(sum(c.original_usd), 0),
    1
  ) AS artifact_delta_pct
FROM compared c
JOIN dim_account a USING (account_id)
GROUP BY a.account_type
ORDER BY CASE a.account_type
  WHEN 'Revenue' THEN 1
  WHEN 'COGS' THEN 2
  ELSE 3
END`

const FIGMA_OUTCOME_REVIEW_SQL = `WITH actual AS (
  SELECT
    a.account_type AS pl_line,
    sum(cast(g.amount AS DECIMAL(38, 2))) AS actual_usd
  FROM fct_gl_transactions g
  JOIN dim_account a USING (account_id)
  WHERE a.account_type IN ('Revenue', 'COGS', 'Opex')
    AND g.txn_date >= DATE '2025-04-01'
    AND g.txn_date < DATE '2026-01-01'
  GROUP BY a.account_type
),
original AS (
  SELECT
    a.account_type AS pl_line,
    sum(b.amount_usd) AS original_plan_usd
  FROM fct_budget b
  JOIN dim_account a USING (account_id)
  WHERE b.version_name = 'FY2025 Plan'
    AND b.fiscal_month BETWEEN DATE '2025-04-01' AND DATE '2025-12-01'
  GROUP BY a.account_type
),
reforecast AS (
  SELECT
    a.account_type AS pl_line,
    sum(b.amount_usd) AS q2_reforecast_usd
  FROM fct_budget b
  JOIN dim_account a USING (account_id)
  WHERE b.version_name = 'FY2025 Q2 Reforecast'
    AND b.fiscal_month BETWEEN DATE '2025-04-01' AND DATE '2025-12-01'
  GROUP BY a.account_type
)
SELECT
  a.pl_line,
  round(a.actual_usd, 2) AS actual_usd,
  round(o.original_plan_usd, 2) AS original_plan_usd,
  round(r.q2_reforecast_usd, 2) AS q2_reforecast_usd,
  round(abs(a.actual_usd - o.original_plan_usd), 2) AS original_abs_error_usd,
  round(abs(a.actual_usd - r.q2_reforecast_usd), 2) AS reforecast_abs_error_usd,
  round(
    abs(a.actual_usd - o.original_plan_usd)
      - abs(a.actual_usd - r.q2_reforecast_usd),
    2
  ) AS error_reduction_usd,
  CASE
    WHEN abs(a.actual_usd - r.q2_reforecast_usd)
       < abs(a.actual_usd - o.original_plan_usd)
      THEN 'Improved'
    WHEN abs(a.actual_usd - r.q2_reforecast_usd)
       > abs(a.actual_usd - o.original_plan_usd)
      THEN 'Worsened'
    ELSE 'Unchanged'
  END AS accuracy_outcome
FROM actual a
JOIN original o USING (pl_line)
JOIN reforecast r USING (pl_line)
ORDER BY CASE a.pl_line
  WHEN 'Revenue' THEN 1
  WHEN 'COGS' THEN 2
  ELSE 3
END`

const SCREEN_SIM_04 = {
  id: 'sim04',
  title: 'The named-plan outcome review',
  intro: `Figma's Strategic Finance evidence in this practice set mentions SQL tooling and large datasets. This fictional Star67 screen tests whether you can reconcile two named planning artifacts and measure their ex-post outcome. It is not a claim about Figma's interview format, planning process, or forecast governance.`,
  questions: [
    {
      id: 'sim04-q1',
      ask: `Q1 — prove the comparison population: Align FY2025 Plan and FY2025 Q2 Reforecast to their common loaded months, April through December 2025. Compare them at month × account × normalized department grain, preserving keys found on only one side.`,
      deliverable: `Exactly one row: first_comparison_month, last_comparison_month, comparison_months, original_keys, reforecast_keys, matched_keys, changed_matched_keys, unchanged_matched_keys, original_only_keys, reforecast_only_keys, original_plan_usd, and q2_reforecast_usd.`,
      tables: ['fct_budget'],
      canonical: FIGMA_COMPARISON_POPULATION_SQL,
      ordered: false,
      fingerprintSQL: FIGMA_COMPARISON_POPULATION_SQL.replace('FULL OUTER JOIN reforecast r', 'INNER JOIN reforecast r'),
      fingerprintMessage: `The inner join discarded 45 reforecast-only keys and understated the reforecast by $5,984,430.48. Preserve both named artifacts with a FULL OUTER JOIN after normalizing department labels. Those 45 keys are Data & Analytics coverage, not evidence of a causal forecast assumption.`,
      narration: `"I aligned both uploads at month, account, and normalized-department grain. The common window has 819 matched keys and 45 reforecast-only keys, so an inner join would materially understate the second artifact."`,
    },
    {
      id: 'sim04-q2',
      ask: `Q2 — bridge the named artifacts: Across the aligned April–December population, show how the loaded totals differ at Revenue, COGS, and Opex. Report the second artifact minus the original in dollars and percent. Call it an artifact delta, not forecast causality.`,
      deliverable: `Three rows ordered Revenue, COGS, Opex: pl_line, original_plan_usd, q2_reforecast_usd, artifact_delta_usd, and artifact_delta_pct.`,
      tables: ['fct_budget', 'dim_account'],
      canonical: FIGMA_ARTIFACT_BRIDGE_SQL,
      ordered: true,
      orderedNote: 'Revenue, then COGS, then Opex',
      fingerprintSQL: FIGMA_ARTIFACT_BRIDGE_SQL.replace(
        `  WHERE version_name = 'FY2025 Plan'\n    AND fiscal_month BETWEEN DATE '2025-04-01' AND DATE '2025-12-01'`,
        `  WHERE version_name = 'FY2025 Plan'`,
      ),
      fingerprintMessage: `You compared twelve months of the original with nine months of the reforecast. Align both artifacts to April–December before calculating their difference; otherwise missing calendar coverage masquerades as a massive downward revision.`,
      narration: `"On the aligned window, the second artifact is 4.8% lower for Revenue, 3.8% higher for COGS, and 3.2% higher for Opex. Those are differences between loaded artifacts, not evidence about why anyone changed an assumption."`,
    },
    {
      id: 'sim04-q3',
      ask: `Q3 — test both artifacts against realized outcomes: Compare April–December 2025 actual Revenue, COGS, and Opex with each artifact. Measure absolute error at the P&L-line total. Error reduction is original absolute error minus reforecast absolute error, so positive means the second artifact was closer.`,
      deliverable: `Three rows ordered Revenue, COGS, Opex: pl_line, actual_usd, original_plan_usd, q2_reforecast_usd, original_abs_error_usd, reforecast_abs_error_usd, error_reduction_usd, and accuracy_outcome.`,
      tables: ['fct_gl_transactions', 'dim_account', 'fct_budget'],
      canonical: FIGMA_OUTCOME_REVIEW_SQL,
      ordered: true,
      orderedNote: 'Revenue, then COGS, then Opex',
      fingerprintSQL: FIGMA_OUTCOME_REVIEW_SQL
        .replaceAll('abs(a.actual_usd - o.original_plan_usd)', '(a.actual_usd - o.original_plan_usd)')
        .replaceAll('abs(a.actual_usd - r.q2_reforecast_usd)', '(a.actual_usd - r.q2_reforecast_usd)'),
      fingerprintMessage: `Signed variance tells direction; absolute error tells distance from actual. Taking no absolute value makes under-plan and over-plan errors carry opposite signs and misstates the accuracy comparison.`,
      narration: `"Against realized April–December results, the second artifact reduced COGS error by $372 thousand and Opex error by $5.01 million, but increased Revenue error by $1.12 million. Its outcome improved selectively, not uniformly."`,
    },
  ],
}

const AFFIRM_CALIBRATION_CTES = `opening AS (
  SELECT
    c.segment,
    sum(s.arr_usd) AS march_opening_arr_usd
  FROM fct_subscription_snapshot_monthly s
  JOIN dim_customer c USING (customer_id)
  WHERE s.month_start = DATE '2026-03-01'
  GROUP BY c.segment
),
movements AS (
  SELECT
    c.segment,
    sum(
      CASE WHEN m.arr_delta_usd > 0
        THEN m.arr_delta_usd
        ELSE 0
      END
    ) AS q2_gross_adds_usd,
    -sum(
      CASE WHEN m.arr_delta_usd < 0
        THEN m.arr_delta_usd
        ELSE 0
      END
    ) AS q2_gross_losses_usd
  FROM fct_arr_movements m
  JOIN dim_customer c USING (customer_id)
  WHERE m.event_date >= DATE '2026-04-01'
    AND m.event_date < DATE '2026-07-01'
  GROUP BY c.segment
),
ending AS (
  SELECT
    c.segment,
    sum(s.arr_usd) AS june_ending_arr_usd
  FROM fct_subscription_snapshot_monthly s
  JOIN dim_customer c USING (customer_id)
  WHERE s.month_start = DATE '2026-06-01'
  GROUP BY c.segment
),
calibration AS (
  SELECT
    o.segment,
    o.march_opening_arr_usd,
    m.q2_gross_adds_usd,
    m.q2_gross_losses_usd,
    m.q2_gross_adds_usd
      / nullif(o.march_opening_arr_usd, 0) AS gross_add_rate,
    m.q2_gross_losses_usd
      / nullif(o.march_opening_arr_usd, 0) AS gross_loss_rate,
    e.june_ending_arr_usd,
    o.march_opening_arr_usd
      + m.q2_gross_adds_usd
      - m.q2_gross_losses_usd
      - e.june_ending_arr_usd AS bridge_gap_usd
  FROM opening o
  JOIN movements m USING (segment)
  JOIN ending e USING (segment)
)`

const AFFIRM_CALIBRATION_SQL = `WITH ${AFFIRM_CALIBRATION_CTES}
SELECT
  segment,
  round(march_opening_arr_usd, 2) AS march_opening_arr_usd,
  round(q2_gross_adds_usd, 2) AS q2_gross_adds_usd,
  round(q2_gross_losses_usd, 2) AS q2_gross_losses_usd,
  round(100.0 * gross_add_rate, 2) AS gross_add_rate_pct,
  round(100.0 * gross_loss_rate, 2) AS gross_loss_rate_pct,
  round(june_ending_arr_usd, 2) AS june_ending_arr_usd,
  CASE
    WHEN abs(bridge_gap_usd) < 0.005 THEN 0.00
    ELSE round(bridge_gap_usd, 2)
  END AS bridge_gap_usd
FROM calibration
ORDER BY segment`

const AFFIRM_SCENARIO_CTES = `${AFFIRM_CALIBRATION_CTES},
scenarios(scenario, scenario_order, add_multiplier, loss_multiplier) AS (
  VALUES
    ('Downside', 1, 0.80, 1.25),
    ('Base', 2, 1.00, 1.00),
    ('Upside', 3, 1.15, 0.85)
)`

const AFFIRM_SCENARIO_SEGMENT_SQL = `SELECT
  s.scenario,
  s.scenario_order,
  c.segment,
  c.june_ending_arr_usd AS june_starting_arr_usd,
  c.june_ending_arr_usd
    * c.gross_add_rate
    * s.add_multiplier AS modeled_gross_adds_usd,
  c.june_ending_arr_usd
    * c.gross_loss_rate
    * s.loss_multiplier AS modeled_gross_losses_usd,
  c.june_ending_arr_usd
    + c.june_ending_arr_usd * c.gross_add_rate * s.add_multiplier
    - c.june_ending_arr_usd * c.gross_loss_rate * s.loss_multiplier
      AS modeled_next_quarter_ending_arr_usd
FROM calibration c
CROSS JOIN scenarios s`

const AFFIRM_SCENARIO_GRID_SQL = `WITH ${AFFIRM_SCENARIO_CTES}
SELECT
  s.scenario,
  c.segment,
  round(c.june_ending_arr_usd, 2) AS june_starting_arr_usd,
  round(100.0 * c.gross_add_rate, 2) AS calibrated_add_rate_pct,
  round(100.0 * c.gross_loss_rate, 2) AS calibrated_loss_rate_pct,
  s.add_multiplier,
  s.loss_multiplier,
  round(
    c.june_ending_arr_usd * c.gross_add_rate * s.add_multiplier,
    2
  ) AS modeled_gross_adds_usd,
  round(
    c.june_ending_arr_usd * c.gross_loss_rate * s.loss_multiplier,
    2
  ) AS modeled_gross_losses_usd,
  round(
    c.june_ending_arr_usd
      + c.june_ending_arr_usd * c.gross_add_rate * s.add_multiplier
      - c.june_ending_arr_usd * c.gross_loss_rate * s.loss_multiplier,
    2
  ) AS modeled_next_quarter_ending_arr_usd
FROM calibration c
CROSS JOIN scenarios s
ORDER BY s.scenario_order, c.segment`

const AFFIRM_SCENARIO_TOTALS_SQL = `WITH ${AFFIRM_SCENARIO_CTES},
scenario_segment AS (
  ${AFFIRM_SCENARIO_SEGMENT_SQL}
)
SELECT
  scenario,
  round(sum(june_starting_arr_usd), 2) AS june_starting_arr_usd,
  round(
    sum(modeled_next_quarter_ending_arr_usd),
    2
  ) AS modeled_next_quarter_ending_arr_usd,
  round(
    sum(modeled_next_quarter_ending_arr_usd - june_starting_arr_usd),
    2
  ) AS modeled_net_change_usd,
  round(
    (sum(june_starting_arr_usd)
      + sum(modeled_next_quarter_ending_arr_usd)) / 2 / 4,
    2
  ) AS mechanical_quarterly_arr_sensitivity_usd
FROM scenario_segment
GROUP BY scenario, scenario_order
ORDER BY scenario_order`

const AFFIRM_SCENARIO_ATTRIBUTION_SQL = `WITH ${AFFIRM_SCENARIO_CTES},
scenario_segment AS (
  ${AFFIRM_SCENARIO_SEGMENT_SQL}
),
base AS (
  SELECT
    segment,
    modeled_next_quarter_ending_arr_usd
      AS base_modeled_next_quarter_ending_arr_usd
  FROM scenario_segment
  WHERE scenario = 'Base'
),
deltas AS (
  SELECT
    s.scenario,
    s.scenario_order,
    s.segment,
    b.base_modeled_next_quarter_ending_arr_usd,
    s.modeled_next_quarter_ending_arr_usd
      AS scenario_modeled_next_quarter_ending_arr_usd,
    s.modeled_next_quarter_ending_arr_usd
      - b.base_modeled_next_quarter_ending_arr_usd AS delta_vs_base_usd
  FROM scenario_segment s
  JOIN base b USING (segment)
  WHERE s.scenario <> 'Base'
)
SELECT
  scenario,
  segment,
  round(
    base_modeled_next_quarter_ending_arr_usd,
    2
  ) AS base_modeled_next_quarter_ending_arr_usd,
  round(
    scenario_modeled_next_quarter_ending_arr_usd,
    2
  ) AS scenario_modeled_next_quarter_ending_arr_usd,
  round(delta_vs_base_usd, 2) AS delta_vs_base_usd,
  round(
    100.0 * abs(delta_vs_base_usd)
      / sum(abs(delta_vs_base_usd)) OVER (PARTITION BY scenario),
    1
  ) AS scenario_delta_contribution_pct
FROM deltas
ORDER BY scenario_order, abs(delta_vs_base_usd) DESC, segment`

const SCREEN_SIM_05 = {
  id: 'sim05',
  title: 'The parameterized revenue sensitivity',
  intro: `Affirm's current Strategic Finance Analyst II (Revenue) evidence pairs a financial-model case study with comfort using SQL and analytics tools. This fictional Star67 audition calibrates a loaded ARR bridge and layers explicit forward assumptions onto it. It is not a claim about Affirm's interview format, case prompt, or internal forecasting process.`,
  questions: [
    {
      id: 'sim05-q1',
      ask: `Q1 — calibrate the loaded quarter: By current customer segment, bridge March 2026 ending ARR to June ending ARR with Q2 gross adds and gross losses. Gross adds include every positive movement, including reactivation; gross losses are the absolute value of every negative movement.`,
      deliverable: `Three rows ordered by segment: segment, march_opening_arr_usd, q2_gross_adds_usd, q2_gross_losses_usd, gross_add_rate_pct, gross_loss_rate_pct, june_ending_arr_usd, and bridge_gap_usd. The bridge gap must be zero.`,
      tables: ['fct_subscription_snapshot_monthly', 'fct_arr_movements', 'dim_customer'],
      canonical: AFFIRM_CALIBRATION_SQL,
      ordered: true,
      orderedNote: 'alphabetical by current segment',
      fingerprintSQL: AFFIRM_CALIBRATION_SQL.replace(
        `CASE WHEN m.arr_delta_usd > 0
        THEN m.arr_delta_usd`,
        `CASE WHEN m.arr_delta_usd > 0
          AND m.movement_type <> 'reactivation'
        THEN m.arr_delta_usd`,
      ),
      fingerprintMessage: `The bridge excluded positive reactivation movements, so gross adds no longer reconcile March to June. Treat every positive Q2 ARR delta as a gross add for this calibration and keep reactivation inside the loaded bridge.`,
      narration: `"The loaded quarter reconciles to zero in every current segment. Enterprise opens at $51.10 million, adds $6.59 million, loses $1.86 million, and closes at $55.83 million. Current segment is a type-1 label, so this is a present-day segmentation of historical movement."`,
    },
    {
      id: 'sim05-q2',
      ask: `Q2 — apply explicit assumptions: Start from June ending ARR and CROSS JOIN three authored next-quarter cases to every segment. Downside applies 0.80× calibrated gross adds and 1.25× calibrated gross losses; Base applies 1.00× and 1.00×; Upside applies 1.15× and 0.85×. Keep calibration rates at full precision until the displayed result.`,
      deliverable: `Nine rows ordered Downside, Base, Upside and then segment: scenario, segment, june_starting_arr_usd, calibrated_add_rate_pct, calibrated_loss_rate_pct, add_multiplier, loss_multiplier, modeled_gross_adds_usd, modeled_gross_losses_usd, and modeled_next_quarter_ending_arr_usd.`,
      tables: ['fct_subscription_snapshot_monthly', 'fct_arr_movements', 'dim_customer'],
      canonical: AFFIRM_SCENARIO_GRID_SQL,
      ordered: true,
      orderedNote: 'Downside, Base, Upside; then alphabetical by segment',
      fingerprintSQL: AFFIRM_SCENARIO_GRID_SQL
        .replaceAll('c.gross_add_rate', 'round(c.gross_add_rate, 3)')
        .replaceAll('c.gross_loss_rate', 'round(c.gross_loss_rate, 3)'),
      fingerprintMessage: `You rounded the calibrated rates before applying the scenario multipliers, so the sensitivity silently drifts from the loaded bridge. Keep full-precision rates through the model and round only the displayed columns.`,
      narration: `"The cases are explicit VALUES inputs, not predictions. Applied to the $74.67 million June starting book, their segment rows roll to approximately $78.10 million, $80.90 million, and $82.87 million."`,
    },
    {
      id: 'sim05-q3',
      ask: `Q3 — roll the model up: Aggregate the segment grid to one row per scenario. Show starting ARR, modeled next-quarter ending ARR, net change, and a mechanical quarterly ARR sensitivity equal to the average of starting and ending ARR divided by four.`,
      deliverable: `Three rows ordered Downside, Base, Upside: scenario, june_starting_arr_usd, modeled_next_quarter_ending_arr_usd, modeled_net_change_usd, and mechanical_quarterly_arr_sensitivity_usd.`,
      tables: ['fct_subscription_snapshot_monthly', 'fct_arr_movements', 'dim_customer'],
      canonical: AFFIRM_SCENARIO_TOTALS_SQL,
      ordered: true,
      orderedNote: 'Downside, Base, Upside',
      fingerprintSQL: AFFIRM_SCENARIO_TOTALS_SQL.replace(
        `(sum(june_starting_arr_usd)
      + sum(modeled_next_quarter_ending_arr_usd)) / 2 / 4`,
        `sum(modeled_next_quarter_ending_arr_usd) / 4`,
      ),
      fingerprintMessage: `Ending ARR divided by four ignores the book's path through the quarter. For this deliberately mechanical sensitivity, average the starting and ending ARR first, then divide by four.`,
      narration: `"The modeled endings are $78.10 million downside, $80.90 million base, and $82.87 million upside. The average-ARR-over-four column is only a mechanical sensitivity—not GAAP revenue, bookings, cash, pricing, a prediction, or a loaded plan."`,
    },
    {
      id: 'sim05-q4',
      ask: `Q4 — explain the swing: For Downside and Upside, compare each segment's modeled ending ARR with Base and calculate that segment's share of the absolute scenario delta. Reset the contribution denominator inside each scenario.`,
      deliverable: `Six rows ordered Downside then Upside, largest absolute contribution first: scenario, segment, base_modeled_next_quarter_ending_arr_usd, scenario_modeled_next_quarter_ending_arr_usd, delta_vs_base_usd, and scenario_delta_contribution_pct.`,
      tables: ['fct_subscription_snapshot_monthly', 'fct_arr_movements', 'dim_customer'],
      canonical: AFFIRM_SCENARIO_ATTRIBUTION_SQL,
      ordered: true,
      orderedNote: 'Downside, then Upside; largest absolute contribution first',
      fingerprintSQL: AFFIRM_SCENARIO_ATTRIBUTION_SQL.replace(
        'OVER (PARTITION BY scenario)',
        'OVER ()',
      ),
      fingerprintMessage: `The contribution denominator spans both scenarios, so neither Downside nor Upside sums to 100%. Partition the absolute-delta denominator by scenario before assigning contribution shares.`,
      narration: `"Enterprise contributes 69.6% of the Downside delta and 70.3% of the Upside delta. Those shares explain the arithmetic of these authored assumptions; they do not establish causality or forecast confidence."`,
    },
  ],
}

export const SCREEN_SIMS = [SCREEN_SIM_01, SCREEN_SIM_02, SCREEN_SIM_03, SCREEN_SIM_04, SCREEN_SIM_05]
