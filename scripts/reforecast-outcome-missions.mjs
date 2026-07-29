// One complete Star67 workday: validate two uploaded planning artifacts,
// explain their differences, test realized outcomes, and route follow-up.
// The nine missions are content-shaped. Nothing in the runtime assumes nine.

const VERSION_INVENTORY_SQL = `WITH profiled AS (
  SELECT
    version_name,
    min(fiscal_month) AS first_loaded_month,
    max(fiscal_month) AS last_loaded_month,
    count(DISTINCT fiscal_month)::BIGINT AS loaded_months,
    count(*)::BIGINT AS budget_rows,
    count(DISTINCT dept_name_raw)::BIGINT AS raw_department_labels,
    count(DISTINCT upper(trim(dept_name_raw)))::BIGINT AS normalized_departments,
    count(DISTINCT account_id)::BIGINT AS accounts,
    sum(cast(amount_usd AS DECIMAL(38, 2))) AS loaded_usd
  FROM fct_budget
  WHERE version_name IN ('FY2025 Plan', 'FY2025 Q2 Reforecast')
  GROUP BY version_name
), bounded AS (
  SELECT
    *,
    max(first_loaded_month) OVER () AS comparison_start_month,
    min(last_loaded_month) OVER () AS comparison_end_month
  FROM profiled
)
SELECT
  version_name,
  first_loaded_month,
  last_loaded_month,
  loaded_months,
  budget_rows,
  raw_department_labels,
  normalized_departments,
  accounts,
  round(loaded_usd, 2) AS loaded_usd,
  comparison_start_month,
  comparison_end_month,
  date_diff('month', comparison_start_month, comparison_end_month) + 1 AS comparison_months
FROM bounded
ORDER BY first_loaded_month, version_name`

const ALL_VERSION_INVENTORY_SQL = VERSION_INVENTORY_SQL.replace(
  `  WHERE version_name IN ('FY2025 Plan', 'FY2025 Q2 Reforecast')\n`,
  '',
)

const NORMALIZATION_CONTROL_SQL = `WITH dimension_keys AS (
  SELECT
    upper(trim(dept_name)) AS normalized_department,
    count(*)::BIGINT AS dimension_matches
  FROM dim_department
  GROUP BY 1
), raw_labels AS (
  SELECT
    dept_name_raw,
    upper(trim(dept_name_raw)) AS normalized_department,
    count(*)::BIGINT AS budget_rows,
    sum(cast(amount_usd AS DECIMAL(38, 2))) AS budget_usd
  FROM fct_budget
  WHERE version_name = 'FY2025 Q2 Reforecast'
  GROUP BY 1, 2
), checked AS (
  SELECT
    r.*,
    d.dimension_matches,
    count(*) OVER (PARTITION BY r.normalized_department) AS raw_variants
  FROM raw_labels r
  LEFT JOIN dimension_keys d USING (normalized_department)
)
SELECT
  sum(budget_rows)::BIGINT AS reforecast_rows,
  count(*)::BIGINT AS raw_department_labels,
  count(DISTINCT normalized_department)::BIGINT AS normalized_departments,
  count(DISTINCT normalized_department) FILTER (WHERE raw_variants > 1)::BIGINT AS departments_with_raw_variants,
  coalesce(sum(budget_rows) FILTER (WHERE dimension_matches = 1), 0)::BIGINT AS uniquely_matched_rows,
  coalesce(sum(budget_rows) FILTER (WHERE dimension_matches IS NULL), 0)::BIGINT AS unmatched_rows,
  coalesce(sum(budget_rows) FILTER (WHERE dimension_matches > 1), 0)::BIGINT AS ambiguous_rows,
  round(sum(budget_usd), 2) AS reforecast_usd,
  round(coalesce(sum(budget_usd) FILTER (WHERE dimension_matches = 1), 0), 2) AS uniquely_matched_usd
FROM checked`

const RAW_NAME_NORMALIZATION_SQL = `WITH raw_labels AS (
  SELECT
    dept_name_raw,
    upper(trim(dept_name_raw)) AS normalized_department,
    count(*)::BIGINT AS budget_rows,
    sum(cast(amount_usd AS DECIMAL(38, 2))) AS budget_usd
  FROM fct_budget
  WHERE version_name = 'FY2025 Q2 Reforecast'
  GROUP BY 1, 2
), checked AS (
  SELECT
    r.*,
    d.dimension_matches,
    count(*) OVER (PARTITION BY r.normalized_department) AS raw_variants
  FROM raw_labels r
  LEFT JOIN (
    SELECT dept_name, count(*)::BIGINT AS dimension_matches
    FROM dim_department
    GROUP BY dept_name
  ) d ON r.dept_name_raw = d.dept_name
)
SELECT
  sum(budget_rows)::BIGINT AS reforecast_rows,
  count(*)::BIGINT AS raw_department_labels,
  count(DISTINCT normalized_department)::BIGINT AS normalized_departments,
  count(DISTINCT normalized_department) FILTER (WHERE raw_variants > 1)::BIGINT AS departments_with_raw_variants,
  coalesce(sum(budget_rows) FILTER (WHERE dimension_matches = 1), 0)::BIGINT AS uniquely_matched_rows,
  coalesce(sum(budget_rows) FILTER (WHERE dimension_matches IS NULL), 0)::BIGINT AS unmatched_rows,
  coalesce(sum(budget_rows) FILTER (WHERE dimension_matches > 1), 0)::BIGINT AS ambiguous_rows,
  round(sum(budget_usd), 2) AS reforecast_usd,
  round(coalesce(sum(budget_usd) FILTER (WHERE dimension_matches = 1), 0), 2) AS uniquely_matched_usd
FROM checked`

const NORMALIZED_BUDGET_BOOK_CTES = `WITH normalized_budget AS (
  SELECT
    b.version_name,
    b.fiscal_month,
    b.account_id,
    d.dept_id,
    d.dept_name,
    sum(cast(b.amount_usd AS DECIMAL(38, 2))) AS amount_usd
  FROM fct_budget b
  LEFT JOIN dim_department d
    ON upper(trim(b.dept_name_raw)) = upper(trim(d.dept_name))
  WHERE b.version_name IN ('FY2025 Plan', 'FY2025 Q2 Reforecast')
    AND b.fiscal_month >= DATE '2025-04-01'
    AND b.fiscal_month < DATE '2026-01-01'
  GROUP BY 1, 2, 3, 4, 5
), original AS (
  SELECT fiscal_month, account_id, dept_id, dept_name, amount_usd AS original_usd
  FROM normalized_budget
  WHERE version_name = 'FY2025 Plan'
), reforecast AS (
  SELECT fiscal_month, account_id, dept_id, dept_name, amount_usd AS reforecast_usd
  FROM normalized_budget
  WHERE version_name = 'FY2025 Q2 Reforecast'
), budget_book AS (
  SELECT
    coalesce(o.fiscal_month, r.fiscal_month) AS fiscal_month,
    coalesce(o.account_id, r.account_id) AS account_id,
    coalesce(o.dept_id, r.dept_id) AS dept_id,
    coalesce(o.dept_name, r.dept_name) AS dept_name,
    o.original_usd,
    r.reforecast_usd
  FROM original o
  FULL OUTER JOIN reforecast r
    USING (fiscal_month, account_id, dept_id)
)`

const COVERAGE_ADDITIONS_SQL = `${NORMALIZED_BUDGET_BOOK_CTES}, classified AS (
  SELECT
    CASE
      WHEN original_usd IS NULL THEN 'Reforecast only'
      WHEN reforecast_usd IS NULL THEN 'Original plan only'
    END AS coverage_class,
    account_id,
    dept_name,
    count(*)::BIGINT AS key_rows,
    sum(coalesce(original_usd, 0)) AS original_usd,
    sum(coalesce(reforecast_usd, 0)) AS reforecast_usd
  FROM budget_book
  WHERE original_usd IS NULL OR reforecast_usd IS NULL
  GROUP BY 1, 2, 3
)
SELECT
  coverage_class,
  CASE
    WHEN a.account_type = 'Revenue' THEN 'Revenue'
    WHEN a.account_type = 'COGS' THEN 'COGS'
    ELSE 'Opex'
  END AS pl_line,
  dept_name,
  sum(key_rows)::BIGINT AS one_sided_keys,
  round(sum(original_usd), 2) AS original_usd,
  round(sum(reforecast_usd), 2) AS reforecast_usd,
  round(sum(reforecast_usd - original_usd), 2) AS coverage_delta_usd
FROM classified c
JOIN dim_account a USING (account_id)
GROUP BY 1, 2, 3
ORDER BY CASE coverage_class WHEN 'Original plan only' THEN 1 ELSE 2 END,
  min(CASE a.account_type WHEN 'Revenue' THEN 1 WHEN 'COGS' THEN 2 ELSE 3 END),
  dept_name`

const RAW_NAME_BUDGET_BOOK_CTES = NORMALIZED_BUDGET_BOOK_CTES.replace(
  `ON upper(trim(b.dept_name_raw)) = upper(trim(d.dept_name))`,
  `ON b.dept_name_raw = d.dept_name`,
)
const RAW_NAME_COVERAGE_SQL = COVERAGE_ADDITIONS_SQL.replace(
  NORMALIZED_BUDGET_BOOK_CTES,
  RAW_NAME_BUDGET_BOOK_CTES,
)

const CHANGE_BRIDGE_SQL = `${NORMALIZED_BUDGET_BOOK_CTES}
SELECT
  CASE
    WHEN a.account_type = 'Revenue' THEN 'Revenue'
    WHEN a.account_type = 'COGS' THEN 'COGS'
    ELSE 'Opex'
  END AS pl_line,
  round(sum(original_usd) FILTER (WHERE reforecast_usd IS NOT NULL), 2) AS matched_original_usd,
  round(sum(reforecast_usd) FILTER (WHERE original_usd IS NOT NULL), 2) AS matched_reforecast_usd,
  round(sum(reforecast_usd - original_usd) FILTER (
    WHERE original_usd IS NOT NULL AND reforecast_usd IS NOT NULL
  ), 2) AS matched_revision_usd,
  round(coalesce(sum(original_usd) FILTER (WHERE reforecast_usd IS NULL), 0), 2) AS original_only_usd,
  round(coalesce(sum(reforecast_usd) FILTER (WHERE original_usd IS NULL), 0), 2) AS reforecast_only_usd,
  round(sum(coalesce(reforecast_usd, 0) - coalesce(original_usd, 0)), 2) AS total_artifact_delta_usd
FROM budget_book b
JOIN dim_account a USING (account_id)
GROUP BY 1
ORDER BY min(CASE a.account_type WHEN 'Revenue' THEN 1 WHEN 'COGS' THEN 2 ELSE 3 END)`

const MATCHED_ONLY_CHANGE_BRIDGE_SQL = CHANGE_BRIDGE_SQL.replace(
  `FULL OUTER JOIN reforecast r`,
  `INNER JOIN reforecast r`,
)

const OUTCOME_BOOK_CTES = `${NORMALIZED_BUDGET_BOOK_CTES}, actual AS (
  SELECT
    date_trunc('month', g.txn_date)::DATE AS fiscal_month,
    g.account_id,
    coalesce(g.dept_id, 'D-OPS-01') AS dept_id,
    sum(cast(g.amount AS DECIMAL(38, 2))) AS actual_usd
  FROM fct_gl_transactions g
  JOIN dim_account account_filter USING (account_id)
  WHERE g.txn_date >= DATE '2025-04-01'
    AND g.txn_date < DATE '2026-01-01'
    AND account_filter.account_type IN ('Revenue', 'COGS', 'Opex')
  GROUP BY 1, 2, 3
), outcome_book AS (
  SELECT
    coalesce(a.fiscal_month, b.fiscal_month) AS fiscal_month,
    coalesce(a.account_id, b.account_id) AS account_id,
    coalesce(a.dept_id, b.dept_id) AS dept_id,
    coalesce(a.actual_usd, 0) AS actual_usd,
    coalesce(b.original_usd, 0) AS original_usd,
    coalesce(b.reforecast_usd, 0) AS reforecast_usd,
    a.actual_usd IS NOT NULL AS actual_present,
    b.original_usd IS NOT NULL AS original_present,
    b.reforecast_usd IS NOT NULL AS reforecast_present
  FROM actual a
  FULL OUTER JOIN budget_book b USING (fiscal_month, account_id, dept_id)
)`

const ACCOUNT_MONTH_OUTCOME_SQL = `${OUTCOME_BOOK_CTES}, account_month AS (
  SELECT
    fiscal_month,
    account_id,
    sum(actual_usd) AS actual_usd,
    sum(original_usd) AS original_usd,
    sum(reforecast_usd) AS reforecast_usd
  FROM outcome_book
  GROUP BY 1, 2
)
SELECT
  CASE
    WHEN a.account_type = 'Revenue' THEN 'Revenue'
    WHEN a.account_type = 'COGS' THEN 'COGS'
    ELSE 'Opex'
  END AS pl_line,
  count(*)::BIGINT AS comparison_points,
  round(sum(abs(actual_usd - original_usd)), 2) AS original_abs_error_usd,
  round(sum(abs(actual_usd - reforecast_usd)), 2) AS reforecast_abs_error_usd,
  round(sum(abs(actual_usd - original_usd)) - sum(abs(actual_usd - reforecast_usd)), 2) AS error_reduction_usd,
  round(sum(actual_usd - reforecast_usd), 2) AS net_signed_error_usd,
  CASE
    WHEN sum(abs(actual_usd - reforecast_usd)) < sum(abs(actual_usd - original_usd)) THEN 'Closer'
    WHEN sum(abs(actual_usd - reforecast_usd)) > sum(abs(actual_usd - original_usd)) THEN 'Farther'
    ELSE 'Same'
  END AS outcome
FROM account_month m
JOIN dim_account a USING (account_id)
GROUP BY 1
ORDER BY min(CASE a.account_type WHEN 'Revenue' THEN 1 WHEN 'COGS' THEN 2 ELSE 3 END)`

const SIGNED_ERROR_OUTCOME_SQL = ACCOUNT_MONTH_OUTCOME_SQL
  .replaceAll(`abs(actual_usd - original_usd)`, `(actual_usd - original_usd)`)
  .replaceAll(`abs(actual_usd - reforecast_usd)`, `(actual_usd - reforecast_usd)`)

const POPULATION_SENSITIVITY_SQL = `${OUTCOME_BOOK_CTES}, scored AS (
  SELECT
    'Full department-key book' AS population,
    1 AS population_order,
    account_id,
    sum(abs(actual_usd - original_usd)) AS original_abs_error_usd,
    sum(abs(actual_usd - reforecast_usd)) AS reforecast_abs_error_usd
  FROM outcome_book
  GROUP BY account_id
  UNION ALL
  SELECT
    'Matched department keys' AS population,
    2 AS population_order,
    account_id,
    sum(abs(actual_usd - original_usd)) AS original_abs_error_usd,
    sum(abs(actual_usd - reforecast_usd)) AS reforecast_abs_error_usd
  FROM outcome_book
  WHERE original_present AND reforecast_present
  GROUP BY account_id
  UNION ALL
  SELECT
    'Rolled account-month' AS population,
    3 AS population_order,
    account_id,
    sum(abs(actual_usd - original_usd)) AS original_abs_error_usd,
    sum(abs(actual_usd - reforecast_usd)) AS reforecast_abs_error_usd
  FROM (
    SELECT fiscal_month, account_id,
      sum(actual_usd) AS actual_usd,
      sum(original_usd) AS original_usd,
      sum(reforecast_usd) AS reforecast_usd
    FROM outcome_book
    GROUP BY 1, 2
  ) account_month
  GROUP BY account_id
)
SELECT
  population,
  CASE
    WHEN a.account_type = 'Revenue' THEN 'Revenue'
    WHEN a.account_type = 'COGS' THEN 'COGS'
    ELSE 'Opex'
  END AS pl_line,
  round(sum(original_abs_error_usd), 2) AS original_abs_error_usd,
  round(sum(reforecast_abs_error_usd), 2) AS reforecast_abs_error_usd,
  round(sum(original_abs_error_usd - reforecast_abs_error_usd), 2) AS error_reduction_usd,
  CASE
    WHEN sum(reforecast_abs_error_usd) < sum(original_abs_error_usd) THEN 'Closer'
    WHEN sum(reforecast_abs_error_usd) > sum(original_abs_error_usd) THEN 'Farther'
    ELSE 'Same'
  END AS outcome
FROM scored s
JOIN dim_account a USING (account_id)
GROUP BY population, population_order, a.account_type
ORDER BY population_order, min(CASE a.account_type WHEN 'Revenue' THEN 1 WHEN 'COGS' THEN 2 ELSE 3 END)`

const MATCHED_ONLY_SENSITIVITY_SQL = POPULATION_SENSITIVITY_SQL.replace(
  `  FROM outcome_book\n  GROUP BY account_id\n  UNION ALL`,
  `  FROM outcome_book\n  WHERE original_present AND reforecast_present\n  GROUP BY account_id\n  UNION ALL`,
)

const MONTHLY_TRAJECTORY_SQL = `${OUTCOME_BOOK_CTES}, monthly AS (
  SELECT
    fiscal_month,
    sum(CASE WHEN a.account_type = 'Revenue' THEN original_usd ELSE -original_usd END) AS original_operating_result_usd,
    sum(CASE WHEN a.account_type = 'Revenue' THEN reforecast_usd ELSE -reforecast_usd END) AS reforecast_operating_result_usd,
    sum(CASE WHEN a.account_type = 'Revenue' THEN actual_usd ELSE -actual_usd END) AS actual_operating_result_usd
  FROM outcome_book b
  JOIN dim_account a USING (account_id)
  WHERE a.account_type IN ('Revenue', 'COGS', 'Opex')
  GROUP BY fiscal_month
)
SELECT
  fiscal_month,
  round(original_operating_result_usd, 2) AS original_operating_result_usd,
  round(reforecast_operating_result_usd, 2) AS reforecast_operating_result_usd,
  round(actual_operating_result_usd, 2) AS actual_operating_result_usd,
  round(reforecast_operating_result_usd - original_operating_result_usd, 2) AS artifact_change_usd,
  round(actual_operating_result_usd - reforecast_operating_result_usd, 2) AS actual_vs_reforecast_usd,
  round(sum(actual_operating_result_usd - reforecast_operating_result_usd) OVER (
    ORDER BY fiscal_month ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ), 2) AS cumulative_actual_vs_reforecast_usd
FROM monthly
ORDER BY fiscal_month`

const NON_CUMULATIVE_TRAJECTORY_SQL = MONTHLY_TRAJECTORY_SQL.replace(
  `sum(actual_operating_result_usd - reforecast_operating_result_usd) OVER (\n    ORDER BY fiscal_month ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\n  )`,
  `actual_operating_result_usd - reforecast_operating_result_usd`,
)

const WORSE_OPEX_QUEUE_SQL = `${OUTCOME_BOOK_CTES}, opex_groups AS (
  SELECT
    b.account_id,
    b.dept_id,
    sum(actual_usd) AS actual_usd,
    sum(original_usd) AS original_usd,
    sum(reforecast_usd) AS reforecast_usd,
    sum(abs(actual_usd - original_usd)) AS original_abs_error_usd,
    sum(abs(actual_usd - reforecast_usd)) AS reforecast_abs_error_usd
  FROM outcome_book b
  JOIN dim_account a USING (account_id)
  WHERE a.account_type = 'Opex'
  GROUP BY 1, 2
), worsened AS (
  SELECT
    *,
    reforecast_abs_error_usd - original_abs_error_usd AS error_worsening_usd
  FROM opex_groups
  WHERE reforecast_abs_error_usd > original_abs_error_usd
), ranked AS (
  SELECT
    *,
    row_number() OVER (ORDER BY error_worsening_usd DESC, account_id, dept_id) AS review_rank,
    sum(error_worsening_usd) OVER () AS total_worsening_usd
  FROM worsened
)
SELECT
  review_rank,
  r.account_id,
  a.account_name,
  d.dept_name,
  d.leader_name,
  round(actual_usd, 2) AS actual_usd,
  round(original_usd, 2) AS original_usd,
  round(reforecast_usd, 2) AS reforecast_usd,
  round(original_abs_error_usd, 2) AS original_abs_error_usd,
  round(reforecast_abs_error_usd, 2) AS reforecast_abs_error_usd,
  round(error_worsening_usd, 2) AS error_worsening_usd,
  round(100.0 * error_worsening_usd / total_worsening_usd, 1) AS worsening_share_pct
FROM ranked r
JOIN dim_account a USING (account_id)
JOIN dim_department d USING (dept_id)
WHERE review_rank <= 10
ORDER BY review_rank`

const ACCOUNT_DENOMINATOR_QUEUE_SQL = WORSE_OPEX_QUEUE_SQL.replace(
  `sum(error_worsening_usd) OVER () AS total_worsening_usd`,
  `sum(error_worsening_usd) OVER (PARTITION BY account_id) AS total_worsening_usd`,
)

const OUTCOME_HANDOFF_SQL = `${OUTCOME_BOOK_CTES}, coverage AS (
  SELECT
    count(*) FILTER (WHERE original_present)::BIGINT AS original_keys,
    count(*) FILTER (WHERE reforecast_present)::BIGINT AS reforecast_keys,
    count(*) FILTER (WHERE NOT original_present AND reforecast_present)::BIGINT AS reforecast_only_keys,
    sum(reforecast_usd) FILTER (WHERE NOT original_present AND reforecast_present) AS reforecast_only_usd,
    sum(reforecast_usd - original_usd) FILTER (WHERE original_present AND reforecast_present) AS matched_revision_usd,
    sum(reforecast_usd - original_usd) AS total_artifact_delta_usd
  FROM outcome_book
), account_month AS (
  SELECT fiscal_month, account_id,
    sum(actual_usd) AS actual_usd,
    sum(original_usd) AS original_usd,
    sum(reforecast_usd) AS reforecast_usd
  FROM outcome_book
  GROUP BY 1, 2
), line_outcome AS (
  SELECT
    a.account_type AS pl_line,
    sum(abs(actual_usd - original_usd)) - sum(abs(actual_usd - reforecast_usd)) AS error_reduction_usd
  FROM account_month m
  JOIN dim_account a USING (account_id)
  GROUP BY 1
), matched_opex AS (
  SELECT
    sum(abs(actual_usd - original_usd)) - sum(abs(actual_usd - reforecast_usd)) AS matched_opex_error_reduction_usd
  FROM outcome_book b
  JOIN dim_account a USING (account_id)
  WHERE a.account_type = 'Opex'
    AND original_present
    AND reforecast_present
), monthly AS (
  SELECT
    fiscal_month,
    sum(CASE WHEN a.account_type = 'Revenue' THEN reforecast_usd ELSE -reforecast_usd END) AS reforecast_operating_result_usd,
    sum(CASE WHEN a.account_type = 'Revenue' THEN actual_usd ELSE -actual_usd END) AS actual_operating_result_usd
  FROM outcome_book b
  JOIN dim_account a USING (account_id)
  GROUP BY 1
), operating_result AS (
  SELECT sum(actual_operating_result_usd - reforecast_operating_result_usd) AS actual_vs_reforecast_operating_result_usd
  FROM monthly
), opex_groups AS (
  SELECT
    b.account_id,
    b.dept_id,
    sum(abs(actual_usd - original_usd)) AS original_abs_error_usd,
    sum(abs(actual_usd - reforecast_usd)) AS reforecast_abs_error_usd
  FROM outcome_book b
  JOIN dim_account a USING (account_id)
  WHERE a.account_type = 'Opex'
  GROUP BY 1, 2
), worsened AS (
  SELECT
    *,
    reforecast_abs_error_usd - original_abs_error_usd AS error_worsening_usd
  FROM opex_groups
  WHERE reforecast_abs_error_usd > original_abs_error_usd
), ranked AS (
  SELECT
    *,
    row_number() OVER (ORDER BY error_worsening_usd DESC, account_id, dept_id) AS review_rank,
    count(*) OVER ()::BIGINT AS worsened_opex_groups,
    sum(error_worsening_usd) OVER () AS total_worsening_usd
  FROM worsened
), top_route AS (
  SELECT
    worsened_opex_groups,
    total_worsening_usd,
    account_id,
    dept_id,
    error_worsening_usd,
    100.0 * error_worsening_usd / total_worsening_usd AS worsening_share_pct
  FROM ranked
  WHERE review_rank = 1
), pivoted_outcome AS (
  SELECT
    max(error_reduction_usd) FILTER (WHERE pl_line = 'Revenue') AS revenue_error_reduction_usd,
    max(error_reduction_usd) FILTER (WHERE pl_line = 'COGS') AS cogs_error_reduction_usd,
    max(error_reduction_usd) FILTER (WHERE pl_line = 'Opex') AS opex_error_reduction_usd
  FROM line_outcome
)
SELECT
  9::BIGINT AS comparison_months,
  c.original_keys,
  c.reforecast_keys,
  c.reforecast_only_keys,
  round(c.reforecast_only_usd, 2) AS reforecast_only_usd,
  round(c.matched_revision_usd, 2) AS matched_revision_usd,
  round(c.total_artifact_delta_usd, 2) AS total_artifact_delta_usd,
  round(p.revenue_error_reduction_usd, 2) AS revenue_error_reduction_usd,
  round(p.cogs_error_reduction_usd, 2) AS cogs_error_reduction_usd,
  round(p.opex_error_reduction_usd, 2) AS opex_error_reduction_usd,
  round(m.matched_opex_error_reduction_usd, 2) AS matched_opex_error_reduction_usd,
  round(o.actual_vs_reforecast_operating_result_usd, 2) AS actual_vs_reforecast_operating_result_usd,
  r.worsened_opex_groups,
  round(r.total_worsening_usd, 2) AS total_worsening_usd,
  r.account_id AS top_review_account_id,
  d.dept_name AS top_review_department,
  d.leader_name AS top_review_leader,
  round(r.error_worsening_usd, 2) AS top_error_worsening_usd,
  round(r.worsening_share_pct, 1) AS top_worsening_share_pct
FROM coverage c
CROSS JOIN pivoted_outcome p
CROSS JOIN matched_opex m
CROSS JOIN operating_result o
CROSS JOIN top_route r
JOIN dim_department d USING (dept_id)`

const MATCHED_ONLY_HANDOFF_SQL = OUTCOME_HANDOFF_SQL.replace(
  `FULL OUTER JOIN reforecast r`,
  `INNER JOIN reforecast r`,
)

export const REFORECAST_OUTCOME_MISSIONS = [
  {
    id: 'm128',
    part: 21,
    title: 'Inventory the two loaded files',
    from: 'elena',
    ask: `I handed you the original FY2025 Plan and the FY2025 Q2 Reforecast before the afternoon review. Start with intake, not arithmetic: profile both named artifacts and prove the exact period where they can be compared. The label “Q2 Reforecast” names when the file was prepared; its loaded rows run from April through December.`,
    deliverable: `Two rows, original plan then reforecast: version_name, first_loaded_month, last_loaded_month, loaded_months, budget_rows, raw_department_labels, normalized_departments, accounts, loaded_usd, comparison_start_month, comparison_end_month, and comparison_months. Round dollars to 2.`,
    tables: ['fct_budget'],
    canonical: VERSION_INVENTORY_SQL,
    solutionSql: VERSION_INVENTORY_SQL,
    solutionNote: `The common window is April through December 2025: nine months. The original is a twelve-month file; the reforecast is a nine-month file, so comparing their unaligned totals would mix periods.`,
    ordered: true,
    orderedNote: 'original plan first, then reforecast',
    fingerprintSQL: ALL_VERSION_INVENTORY_SQL,
    fingerprintMessage: `You profiled all four planning versions, so the overlap now mixes unrelated fiscal years. Keep the same intake controls, but scope them to the two named FY2025 artifacts before deriving the common window.`,
    hints: [
      `Think of this as checking two workbook tabs before a reconciliation: row count, date bounds, distinct fields, and total dollars. Then use the later start and earlier end as the shared window.`,
      `Build one profiled row per version. MAX(first_loaded_month) OVER () gives the later start; MIN(last_loaded_month) OVER () gives the earlier end.`,
      VERSION_INVENTORY_SQL,
    ],
    sayIt: `"The original plan loads twelve months, while the Q2 reforecast loads April through December. I fixed the comparison population at those nine common months before reading any delta."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm129',
    part: 21,
    title: 'Prove the department cleanup is safe',
    from: 'elena',
    ask: `The reforecast came back with 58 department spellings. Before those labels become join keys, prove that UPPER(TRIM()) maps every reforecast row to exactly one department in dim_department. Multiple raw spellings may collapse to one real department; that is expected. Unmatched or multiply matched rows are the failures.`,
    deliverable: `Exactly one row: reforecast_rows, raw_department_labels, normalized_departments, departments_with_raw_variants, uniquely_matched_rows, unmatched_rows, ambiguous_rows, reforecast_usd, and uniquely_matched_usd. Round dollars to 2.`,
    tables: ['fct_budget', 'dim_department'],
    canonical: NORMALIZATION_CONTROL_SQL,
    solutionSql: NORMALIZATION_CONTROL_SQL,
    solutionNote: `All 864 rows and $231.42 million map uniquely after normalization. Eighteen of 19 departments have multiple raw spellings; that is cleanup evidence, not an ambiguity.`,
    ordered: false,
    fingerprintSQL: RAW_NAME_NORMALIZATION_SQL,
    fingerprintMessage: `Exact raw-name matching accounts for only the rows whose spreadsheet spelling already matches the dimension. Normalize both sides before judging unmatched or ambiguous coverage.`,
    hints: [
      `Audit the mapping, not another department total. First reduce the dimension to normalized keys and match counts; separately reduce the reforecast to its raw labels, normalized key, row count, and dollars.`,
      `A safe row has dimension_matches = 1. Count distinct normalized departments with more than one raw label, but do not call those variants ambiguous.`,
      NORMALIZATION_CONTROL_SQL,
    ],
    sayIt: `"The upload has 58 spellings for 19 departments. After UPPER and TRIM, every one of the 864 rows and every dollar maps exactly once; 18 departments simply have multiple source spellings."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm130',
    part: 21,
    title: 'Find what entered the reforecast',
    from: 'priya',
    ask: `Now compare the files at their real grain: fiscal month × account × normalized department, April through December. Preserve keys that exist on only one side and show what entered or left the loaded artifact. Do not collapse to account-month; that would hide department coverage changes.`,
    deliverable: `One row per one-sided coverage group: coverage_class, pl_line, dept_name, one_sided_keys, original_usd, reforecast_usd, and coverage_delta_usd. Round dollars to 2; order original-only before reforecast-only, then Revenue, COGS, Opex, and department.`,
    tables: ['fct_budget', 'dim_department', 'dim_account'],
    canonical: COVERAGE_ADDITIONS_SQL,
    solutionSql: COVERAGE_ADDITIONS_SQL,
    solutionNote: `The only one-sided population is Data & Analytics Opex: 45 reforecast-only month-account-department keys totaling $5,984,430.48. It must remain visible downstream.`,
    ordered: true,
    orderedNote: 'coverage class, P&L line, then department',
    fingerprintSQL: RAW_NAME_COVERAGE_SQL,
    fingerprintMessage: `The raw-name comparison manufactures one-sided keys from casing and spaces. Reuse the proven normalized department identity before the full-outer comparison.`,
    requireRegex: String.raw`full\s+(?:outer\s+)?join`,
    requireMessage: `Your values are right. Keep a FULL OUTER comparison (or an equivalent two-sided union) in production so future one-sided keys cannot disappear silently.`,
    hints: [
      `Build normalized original and reforecast CTEs at month × account × department. FULL OUTER JOIN those keys, then keep rows where either amount is null.`,
      `Use COALESCE only after classifying presence. A missing amount is the evidence that a key exists on one side only.`,
      COVERAGE_ADDITIONS_SQL,
    ],
    sayIt: `"At the real file grain, Data & Analytics contributes 45 reforecast-only keys and $5.98 million. An account-month comparison would have netted that new coverage into existing accounts and hidden it."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm131',
    part: 21,
    title: 'Separate changed assumptions from added coverage',
    from: 'priya',
    ask: `Explain the artifact delta by P&L line without blending two different stories. For keys present in both files, measure the matched revision. Separately show original-only removal and reforecast-only addition, then tie those pieces to the total artifact delta.`,
    deliverable: `Three rows ordered Revenue, COGS, Opex: pl_line, matched_original_usd, matched_reforecast_usd, matched_revision_usd, original_only_usd, reforecast_only_usd, and total_artifact_delta_usd. Round dollars to 2.`,
    tables: ['fct_budget', 'dim_department', 'dim_account'],
    canonical: CHANGE_BRIDGE_SQL,
    solutionSql: CHANGE_BRIDGE_SQL,
    solutionNote: `Opex is the key read: matched assumptions fell $977,091.20, while $5,984,430.48 of added coverage moved the full artifact up $5,007,339.28.`,
    ordered: true,
    orderedNote: 'Revenue, COGS, then Opex',
    fingerprintSQL: MATCHED_ONLY_CHANGE_BRIDGE_SQL,
    fingerprintMessage: `The matched-key revisions tie, but added Data & Analytics coverage disappeared. Preserve both sides of the artifact comparison and split matched change from one-sided coverage.`,
    hints: [
      `Reuse the normalized full-outer book. FILTER lets one P&L row carry matched, original-only, and reforecast-only dollars without mixing their meanings.`,
      `Matched revision is reforecast minus original only where both exist. Total artifact delta uses COALESCE to zero only after presence has been classified.`,
      CHANGE_BRIDGE_SQL,
    ],
    sayIt: `"Opex did not simply rise $5.01 million. Comparable keys fell $977 thousand, while $5.98 million of Data & Analytics coverage entered the reforecast. I kept repricing and scope change separate."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm132',
    part: 21,
    title: 'Measure outcome without cancellation',
    from: 'elena',
    ask: `Actuals are now complete for April through December 2025. At account-month grain, compare each file with actuals and sum absolute error before rolling to P&L line. Also keep net signed error as a separate diagnostic. A positive signed error means actual loaded amount exceeded reforecast; whether that is favorable depends on the line.`,
    deliverable: `Three rows ordered Revenue, COGS, Opex: pl_line, comparison_points, original_abs_error_usd, reforecast_abs_error_usd, error_reduction_usd, net_signed_error_usd, and outcome (Closer, Farther, or Same). Round dollars to 2.`,
    tables: ['fct_gl_transactions', 'fct_budget', 'dim_department', 'dim_account'],
    canonical: ACCOUNT_MONTH_OUTCOME_SQL,
    solutionSql: ACCOUNT_MONTH_OUTCOME_SQL,
    solutionNote: `At account-month grain the reforecast is closer for COGS and Opex, but farther for Revenue. Absolute error prevents positive and negative misses from canceling; signed error remains visible separately.`,
    ordered: true,
    orderedNote: 'Revenue, COGS, then Opex',
    fingerprintSQL: SIGNED_ERROR_OUTCOME_SQL,
    fingerprintMessage: `Signed misses canceled before you measured error, making offsetting rows look accurate. Sum ABS(actual − artifact) at account-month grain; keep the signed total only in its own diagnostic column.`,
    hints: [
      `Aggregate actual, original, and reforecast to account-month first. Then error is SUM(ABS(actual - artifact)); error reduction is original error minus reforecast error.`,
      `Star67 stores Revenue, COGS, and Opex as positive natural amounts. Do not label signed error favorable or unfavorable without interpreting the P&L line.`,
      ACCOUNT_MONTH_OUTCOME_SQL,
    ],
    sayIt: `"At account-month grain the reforecast reduced COGS error by $246 thousand and Opex error by $5.84 million, but increased Revenue error by $1.12 million. Signed error is diagnostic, not a universal favorable variance."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm133',
    part: 21,
    title: 'Test whether the conclusion survives the population',
    from: 'priya',
    ask: `Before this reaches the afternoon review, stress-test it. Score the outcome three ways: the full month-account-department book, only department keys matched across both files, and a rolled account-month view. Keep the population label beside every result.`,
    deliverable: `Nine rows: population, pl_line, original_abs_error_usd, reforecast_abs_error_usd, error_reduction_usd, and outcome. Order Full department-key book, Matched department keys, Rolled account-month; within each, Revenue, COGS, Opex. Round dollars to 2.`,
    tables: ['fct_gl_transactions', 'fct_budget', 'dim_department', 'dim_account'],
    canonical: POPULATION_SENSITIVITY_SQL,
    solutionSql: POPULATION_SENSITIVITY_SQL,
    solutionNote: `Revenue and COGS are stable across the three views. Opex is not: the full book and rolled account-month say Closer, while matched department keys say Farther by $1.39 million. The population is part of the conclusion.`,
    ordered: true,
    orderedNote: 'population order, then Revenue, COGS, Opex',
    fingerprintSQL: MATCHED_ONLY_SENSITIVITY_SQL,
    fingerprintMessage: `The “full book” row is identical to matched keys because Data & Analytics was filtered out before scoring. Preserve the full union in the first population; the contrast is the lesson.`,
    hints: [
      `Build three clearly labeled score tables with UNION ALL. Only one should filter to keys present in both artifacts; only one should roll departments into account-month.`,
      `Use the same error formula in every branch. Changing both the formula and the population would make the sensitivity read uninterpretable.`,
      POPULATION_SENSITIVITY_SQL,
    ],
    sayIt: `"The Opex headline is population-sensitive: Closer on the full loaded book, Farther on matched department keys. I would report that reversal, not choose the denominator that tells the nicer story."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm134',
    part: 21,
    title: 'Trace when the operating gap moved',
    from: 'priya',
    ask: `Trace the nine-month path using operating result = Revenue − COGS − Opex. Show original plan, reforecast, and actual operating result each month, the reforecast artifact change, the actual-versus-reforecast miss, and its running cumulative total. This is an ex-post outcome path, not a new outlook.`,
    deliverable: `Nine monthly rows, April through December: fiscal_month, original_operating_result_usd, reforecast_operating_result_usd, actual_operating_result_usd, artifact_change_usd, actual_vs_reforecast_usd, and cumulative_actual_vs_reforecast_usd. Round dollars to 2.`,
    tables: ['fct_gl_transactions', 'fct_budget', 'dim_department', 'dim_account'],
    canonical: MONTHLY_TRAJECTORY_SQL,
    solutionSql: MONTHLY_TRAJECTORY_SQL,
    solutionNote: `Actual operating result finished below the loaded reforecast in every month. The cumulative April–December miss is $2,018,604.68; it is a historical outcome, not a forecast beyond December.`,
    ordered: true,
    orderedNote: 'April through December 2025',
    fingerprintSQL: NON_CUMULATIVE_TRAJECTORY_SQL,
    fingerprintMessage: `The cumulative column repeats each monthly miss, so December does not carry the nine-month total. Use an ordered running SUM from the first comparison month through the current row.`,
    hints: [
      `Reduce the full book to one row per month. Stored expense amounts are positive, so operating result subtracts both COGS and Opex from Revenue.`,
      `Keep the monthly miss and SUM(monthly miss) OVER (ORDER BY fiscal_month ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) side by side.`,
      MONTHLY_TRAJECTORY_SQL,
    ],
    sayIt: `"Actual operating result ran below the reforecast in all nine loaded months, ending $2.02 million lower cumulatively. That is an ex-post result for this artifact window, not evidence about a future outlook."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm135',
    part: 21,
    title: 'Route the Opex rows that got worse',
    from: 'elena',
    ask: `Build the follow-up queue at Opex account × department grain. Keep only groups whose reforecast absolute error exceeded the original plan's, rank the ten largest increases, attach the loaded department leader, and show each row's share of total worsening across every worsened Opex group.`,
    deliverable: `Ten rows: review_rank, account_id, account_name, dept_name, leader_name, actual_usd, original_usd, reforecast_usd, original_abs_error_usd, reforecast_abs_error_usd, error_worsening_usd, and worsening_share_pct. Round dollars to 2 and percent to 1; order rank 1 through 10.`,
    tables: ['fct_gl_transactions', 'fct_budget', 'dim_department', 'dim_account'],
    canonical: WORSE_OPEX_QUEUE_SQL,
    solutionSql: WORSE_OPEX_QUEUE_SQL,
    solutionNote: `Office & Facilities for Workplace is the largest worsening at $1.07 million and 37.2% of total worsened-group error. The queue routes review; it does not assign blame or claim causal drivers.`,
    ordered: true,
    orderedNote: 'review rank 1 through 10',
    fingerprintSQL: ACCOUNT_DENOMINATOR_QUEUE_SQL,
    fingerprintMessage: `Each percentage uses an account-only denominator, so the rows no longer share one review-population total. Divide every worsened group's error increase by total worsening across the complete Opex queue.`,
    hints: [
      `Aggregate the nine months to account × department first. Keep only positive reforecast-error minus original-error differences, then rank with deterministic account and department tie-breakers.`,
      `Calculate total_worsening_usd before LIMIT 10. The denominator is every worsened Opex group, not only the displayed ten and not each account separately.`,
      WORSE_OPEX_QUEUE_SQL,
    ],
    sayIt: `"Workplace Office & Facilities and Engineering salaries make up 60.0% of the worsened-group error. I routed the largest account-department rows with a complete denominator; the queue is review priority, not blame."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm136',
    part: 21,
    title: 'Package the reforecast outcome review',
    from: 'priya',
    ask: `Give me one controlled handoff for the afternoon review. Preserve the nine-month comparison, original and reforecast key counts, added coverage, matched and total artifact change, account-month outcome by P&L line, the matched-key Opex sensitivity, cumulative operating-result miss, and the top routed Opex item with its denominator.`,
    deliverable: `Exactly one row: comparison_months, original_keys, reforecast_keys, reforecast_only_keys, reforecast_only_usd, matched_revision_usd, total_artifact_delta_usd, revenue_error_reduction_usd, cogs_error_reduction_usd, opex_error_reduction_usd, matched_opex_error_reduction_usd, actual_vs_reforecast_operating_result_usd, worsened_opex_groups, total_worsening_usd, top_review_account_id, top_review_department, top_review_leader, top_error_worsening_usd, and top_worsening_share_pct. Round dollars to 2 and percent to 1.`,
    tables: ['fct_gl_transactions', 'fct_budget', 'dim_department', 'dim_account'],
    canonical: OUTCOME_HANDOFF_SQL,
    solutionSql: OUTCOME_HANDOFF_SQL,
    solutionNote: `The packet keeps the central caveat visible: Opex improved by $5.84 million at account-month but worsened by $1.39 million on matched department keys. It is an ex-post comparison of loaded artifacts, not proof of process quality, causality, or a future outlook.`,
    ordered: false,
    fingerprintSQL: MATCHED_ONLY_HANDOFF_SQL,
    fingerprintMessage: `The handoff erased all 45 reforecast-only keys and changed the Opex outcome by restricting the book to matched artifact rows. Restore the full population, then keep matched-key sensitivity as its own explicit metric.`,
    hints: [
      `Treat coverage, P&L outcomes, operating result, and the top route as separate one-row controls. CROSS JOIN only after each has exactly one row and its denominator is explicit.`,
      `Do not add Revenue, COGS, and Opex natural amounts into one meaningless total. Report error reduction by line and transform only operating result as Revenue minus COGS minus Opex.`,
      OUTCOME_HANDOFF_SQL,
    ],
    sayIt: `"Across April through December, the reforecast added 45 Data & Analytics keys and $5.98 million outside original-plan coverage. It was closer for COGS and rolled Opex, farther for Revenue, and Opex reverses on matched department keys. Actual operating result finished $2.02 million below it; Workplace Office & Facilities leads the 33-group follow-up queue. This compares loaded artifacts—it does not prove forecast-process quality or causality."`,
    jdCompanies: ['Figma'],
  },
]
