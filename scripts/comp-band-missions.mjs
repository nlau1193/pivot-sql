// GL-to-payroll divisional-mix / comp-band review — a Star67 operating-review arc (part 35).
// An arc over fct_payroll_monthly + dim_department measuring comp-band distribution by
// division, per-head loaded cost, comp-mix (base/bonus/commission/benefits/taxes) by
// division, and band dispersion, distinct from m204-210 (comp-account bridge to GL) and
// m50-57 (roster reconciliation).
//
// Audited H1 2026 truth:
//   S&M:  285 heads, base $20,787,545.62 / bonus $1,960,203.04 / comm $4,567,327.34
//         / ben $2,286,629.79 / tax $2,321,781.59 / total $31,923,487.31 / per-head $112,012.24
//   R&D:  317 heads, base $21,872,411.86 / bonus $4,023,811.30 / comm $0
//         / ben $2,405,965.08 / tax $2,201,178.67 / total $30,503,366.70 / per-head $96,225.13
//   COGS: 77 heads, base $5,361,314.53 / bonus $1,016,968.87 / comm $0
//         / ben $589,744.75 / tax $542,154.15 / total $7,510,181.97 / per-head $97,534.83
//   G&A:  38 heads, base $2,824,021.86 / bonus $553,561.32 / comm $0
//         / ben $310,642.62 / tax $287,094.59 / total $3,975,320.01 / per-head $104,613.68

const DIVISION_PER_HEAD_SQL = `SELECT d.division,
  count(DISTINCT p.employee_id) AS distinct_heads,
  count(*) AS employee_months,
  round(sum(p.total_comp_usd), 2) AS total_comp_usd,
  round(sum(p.total_comp_usd) / nullif(count(DISTINCT p.employee_id), 0), 2) AS loaded_cost_per_head_usd,
  round(sum(p.total_comp_usd) / nullif(count(*), 0), 2) AS cost_per_employee_month_usd
FROM fct_payroll_monthly p
JOIN dim_department d ON p.dept_id = d.dept_id
WHERE p.payroll_month >= DATE '2026-01-01' AND p.payroll_month < DATE '2026-07-01'
GROUP BY d.division
ORDER BY loaded_cost_per_head_usd DESC`

const DIVISION_PER_HEAD_ROWS_TRAP_SQL = `SELECT d.division,
  count(*) AS distinct_heads,
  count(*) AS employee_months,
  round(sum(p.total_comp_usd), 2) AS total_comp_usd,
  round(sum(p.total_comp_usd) / nullif(count(*), 0), 2) AS loaded_cost_per_head_usd,
  round(sum(p.total_comp_usd) / nullif(count(*), 0), 2) AS cost_per_employee_month_usd
FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id
WHERE p.payroll_month >= DATE '2026-01-01' AND p.payroll_month < DATE '2026-07-01'
GROUP BY d.division ORDER BY loaded_cost_per_head_usd DESC`

const DIVISION_COMP_MIX_SQL = `SELECT d.division,
  round(sum(p.base_pay_usd), 2) AS base_pay_usd,
  round(sum(p.bonus_usd), 2) AS bonus_usd,
  round(sum(p.commission_usd), 2) AS commission_usd,
  round(sum(p.benefits_usd), 2) AS benefits_usd,
  round(sum(p.employer_taxes_usd), 2) AS employer_taxes_usd,
  round(sum(p.total_comp_usd), 2) AS total_comp_usd,
  round(100.0 * sum(p.bonus_usd) / nullif(sum(p.total_comp_usd), 0), 2) AS bonus_share_pct,
  round(100.0 * sum(p.commission_usd) / nullif(sum(p.total_comp_usd), 0), 2) AS commission_share_pct
FROM fct_payroll_monthly p
JOIN dim_department d ON p.dept_id = d.dept_id
WHERE p.payroll_month >= DATE '2026-01-01' AND p.payroll_month < DATE '2026-07-01'
GROUP BY d.division
ORDER BY total_comp_usd DESC`

const DIVISION_COMP_MIX_ABS_TRAP_SQL = `SELECT d.division,
  round(sum(p.base_pay_usd), 2) AS base_pay_usd,
  round(sum(abs(p.bonus_usd)), 2) AS bonus_usd,
  round(sum(p.commission_usd), 2) AS commission_usd,
  round(sum(p.benefits_usd), 2) AS benefits_usd,
  round(sum(p.employer_taxes_usd), 2) AS employer_taxes_usd,
  round(sum(p.total_comp_usd), 2) AS total_comp_usd,
  round(100.0 * sum(p.bonus_usd) / nullif(sum(p.base_pay_usd), 0), 2) AS bonus_share_pct,
  round(100.0 * sum(p.commission_usd) / nullif(sum(p.total_comp_usd), 0), 2) AS commission_share_pct
FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id
WHERE p.payroll_month >= DATE '2026-01-01' AND p.payroll_month < DATE '2026-07-01'
GROUP BY d.division ORDER BY total_comp_usd DESC`

const COMMISSION_CONCENTRATION_SQL = `SELECT d.division,
  count(DISTINCT p.employee_id) AS commissioned_heads,
  round(sum(p.commission_usd), 2) AS total_commission_usd,
  round(sum(p.commission_usd) / nullif(count(DISTINCT CASE WHEN p.commission_usd > 0 THEN p.employee_id END), 0), 2) AS avg_commission_per_earner_usd
FROM fct_payroll_monthly p
JOIN dim_department d ON p.dept_id = d.dept_id
WHERE p.payroll_month >= DATE '2026-01-01' AND p.payroll_month < DATE '2026-07-01'
  AND p.commission_usd > 0
GROUP BY d.division
ORDER BY total_commission_usd DESC`

const COMMISSION_CONCENTRATION_ALL_DIVISIONS_TRAP_SQL = `SELECT d.division,
  count(DISTINCT p.employee_id) AS commissioned_heads,
  round(sum(p.commission_usd), 2) AS total_commission_usd,
  round(sum(p.commission_usd) / nullif(count(DISTINCT p.employee_id), 0), 2) AS avg_commission_per_earner_usd
FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id
WHERE p.payroll_month >= DATE '2026-01-01' AND p.payroll_month < DATE '2026-07-01'
GROUP BY d.division ORDER BY total_commission_usd DESC`

const BONUS_SHARE_BY_DIVISION_SQL = `WITH per_div AS (
  SELECT d.division,
    sum(p.bonus_usd) AS bonus,
    sum(p.total_comp_usd) AS total_comp
  FROM fct_payroll_monthly p
  JOIN dim_department d ON p.dept_id = d.dept_id
  WHERE p.payroll_month >= DATE '2026-01-01' AND p.payroll_month < DATE '2026-07-01'
  GROUP BY 1
)
SELECT division,
  round(bonus, 2) AS bonus_usd,
  round(total_comp, 2) AS total_comp_usd,
  round(100.0 * bonus / nullif(total_comp, 0), 2) AS bonus_share_pct,
  round(100.0 * bonus / nullif(sum(bonus) OVER (), 0), 2) AS bonus_concentration_pct
FROM per_div
ORDER BY bonus_share_pct DESC`

const BONUS_SHARE_DROP_CONCENTRATION_TRAP_SQL = `WITH per_div AS (
  SELECT d.division, sum(p.bonus_usd) AS bonus, sum(p.total_comp_usd) AS total_comp
  FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id
  WHERE p.payroll_month >= DATE '2026-01-01' AND p.payroll_month < DATE '2026-07-01' GROUP BY 1
)
SELECT division, round(bonus, 2) AS bonus_usd, round(total_comp, 2) AS total_comp_usd,
  round(100.0 * bonus / nullif(total_comp, 0), 2) AS bonus_share_pct,
  round(0, 2) AS bonus_concentration_pct
FROM per_div ORDER BY bonus_share_pct DESC`

const DEPARTMENT_TOP_SPEND_SQL = `WITH dept_spend AS (
  SELECT d.dept_name, d.division,
    count(DISTINCT p.employee_id) AS heads,
    round(sum(p.total_comp_usd), 2) AS total_comp_usd
  FROM fct_payroll_monthly p
  JOIN dim_department d ON p.dept_id = d.dept_id
  WHERE p.payroll_month >= DATE '2026-01-01' AND p.payroll_month < DATE '2026-07-01'
  GROUP BY d.dept_name, d.division
), ranked AS (
  SELECT dept_name, division, heads, total_comp_usd,
    row_number() OVER (ORDER BY total_comp_usd DESC, dept_name) AS spend_rank
  FROM dept_spend
)
SELECT dept_name, division, heads, total_comp_usd
FROM ranked
WHERE spend_rank <= 10
ORDER BY spend_rank`

const DEPARTMENT_TOP_SPEND_ABS_TRAP_SQL = `WITH dept_spend AS (
  SELECT d.dept_name, d.division,
    count(DISTINCT p.employee_id) AS heads,
    round(sum(p.base_pay_usd), 2) AS total_comp_usd
  FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id
  WHERE p.payroll_month >= DATE '2026-01-01' AND p.payroll_month < DATE '2026-07-01'
  GROUP BY d.dept_name, d.division
), ranked AS (
  SELECT dept_name, division, heads, total_comp_usd,
    row_number() OVER (ORDER BY total_comp_usd DESC, dept_name) AS spend_rank
  FROM dept_spend
)
SELECT dept_name, division, heads, total_comp_usd FROM ranked WHERE spend_rank <= 10 ORDER BY spend_rank`

const COMP_BAND_HANDOFF_SQL = `WITH total AS (
  SELECT count(DISTINCT employee_id) AS total_heads, round(sum(total_comp_usd), 2) AS total_comp
  FROM fct_payroll_monthly WHERE payroll_month >= DATE '2026-01-01' AND payroll_month < DATE '2026-07-01'
), sm AS (
  SELECT count(DISTINCT p.employee_id) AS sm_heads, round(sum(p.total_comp_usd), 2) AS sm_comp,
    round(sum(p.commission_usd), 2) AS sm_commission
  FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id
  WHERE p.payroll_month >= DATE '2026-01-01' AND p.payroll_month < DATE '2026-07-01' AND d.division = 'S&M'
), rd AS (
  SELECT count(DISTINCT p.employee_id) AS rd_heads, round(sum(p.total_comp_usd), 2) AS rd_comp,
    round(sum(p.bonus_usd), 2) AS rd_bonus
  FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id
  WHERE p.payroll_month >= DATE '2026-01-01' AND p.payroll_month < DATE '2026-07-01' AND d.division = 'R&D'
)
SELECT
  total.total_heads,
  total.total_comp AS total_comp_usd,
  round(total.total_comp / nullif(total.total_heads, 0), 2) AS company_per_head_usd,
  sm.sm_heads,
  sm.sm_comp AS sm_comp_usd,
  round(sm.sm_comp / nullif(sm.sm_heads, 0), 2) AS sm_per_head_usd,
  sm.sm_commission AS sm_commission_usd,
  rd.rd_heads,
  rd.rd_comp AS rd_comp_usd,
  round(rd.rd_comp / nullif(rd.rd_heads, 0), 2) AS rd_per_head_usd,
  rd.rd_bonus AS rd_bonus_usd
FROM total CROSS JOIN sm CROSS JOIN rd`

const COMP_BAND_HANDOFF_DROP_PER_HEAD_TRAP_SQL = `WITH total AS (
  SELECT count(DISTINCT employee_id) AS total_heads, round(sum(total_comp_usd), 2) AS total_comp
  FROM fct_payroll_monthly WHERE payroll_month >= DATE '2026-01-01' AND payroll_month < DATE '2026-07-01'
), sm AS (
  SELECT count(DISTINCT p.employee_id) AS sm_heads, round(sum(p.total_comp_usd), 2) AS sm_comp, round(sum(p.commission_usd), 2) AS sm_commission
  FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id
  WHERE p.payroll_month >= DATE '2026-01-01' AND p.payroll_month < DATE '2026-07-01' AND d.division = 'S&M'
), rd AS (
  SELECT count(DISTINCT p.employee_id) AS rd_heads, round(sum(p.total_comp_usd), 2) AS rd_comp, round(sum(p.bonus_usd), 2) AS rd_bonus
  FROM fct_payroll_monthly p JOIN dim_department d ON p.dept_id = d.dept_id
  WHERE p.payroll_month >= DATE '2026-01-01' AND p.payroll_month < DATE '2026-07-01' AND d.division = 'R&D'
)
SELECT total.total_heads, total.total_comp AS total_comp_usd,
  round(0, 2) AS company_per_head_usd,
  sm.sm_heads, sm.sm_comp AS sm_comp_usd, round(0, 2) AS sm_per_head_usd, sm.sm_commission AS sm_commission_usd,
  rd.rd_heads, rd.rd_comp AS rd_comp_usd, round(0, 2) AS rd_per_head_usd, rd.rd_bonus AS rd_bonus_usd
FROM total CROSS JOIN sm CROSS JOIN rd`

export const COMP_BAND_MISSIONS = [
  {
    id: 'm237',
    part: 35,
    title: 'Rank divisions by loaded cost per head',
    from: 'maria',
    ask: `Open the comp-band review by ranking divisions by loaded cost per head. For each division, count distinct heads, employee-months, total comp, and compute both loaded cost per head (total comp / heads) and cost per employee-month (total comp / pay records). The per-head ranking shows which division carries the highest unit people cost.`,
    deliverable: `Four rows ordered by loaded_cost_per_head_usd descending: division, distinct_heads, employee_months, total_comp_usd, loaded_cost_per_head_usd, cost_per_employee_month_usd. Round dollars to 2 decimals.`,
    tables: ['fct_payroll_monthly', 'dim_department'],
    canonical: DIVISION_PER_HEAD_SQL,
    solutionSql: DIVISION_PER_HEAD_SQL,
    solutionNote: `S&M carries the highest loaded cost per head at about $112,012 — above the company average — driven by commission. R&D is lower at $96,225 despite having more heads, because it carries no commission. G&A sits high at $104,614 from a small senior team. The per-head rate reflects role mix and variable-comp structure, not individual salaries.`,
    ordered: true,
    orderedNote: 'loaded_cost_per_head_usd descending',
    fingerprintSQL: DIVISION_PER_HEAD_ROWS_TRAP_SQL,
    fingerprintMessage: `You counted payroll rows as distinct heads, so each division's headcount equals its employee-months and the per-head rate is really a per-month rate. Use count(distinct employee_id) for heads so the per-head rate divides by people.`,
    hints: [
      `Join payroll to dim_department on dept_id; filter to H1 2026; group by division.`,
      `count(distinct employee_id) for heads; count(*) for months. Per-head is total_comp / heads; per-month is total_comp / months. Order by per-head descending.`,
      DIVISION_PER_HEAD_SQL,
    ],
    sayIt: `"S&M carries the highest loaded cost per head at about $112 thousand — above the company average — driven by commission. R&D is lower at $96 thousand despite more heads because it has no commission. The per-head rate reflects role mix, not individual salaries."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm238',
    part: 35,
    title: 'Read the comp-mix by division',
    from: 'fin',
    ask: `How does the compensation mix differ by division? For each division, show base, bonus, commission, benefits, employer taxes, total comp, and the bonus and commission shares of total. The mix reveals which divisions are variable-comp heavy (bonus/commission) versus fixed-base heavy.`,
    deliverable: `Four rows ordered by total_comp_usd descending: division, base_pay_usd, bonus_usd, commission_usd, benefits_usd, employer_taxes_usd, total_comp_usd, bonus_share_pct, commission_share_pct. Round dollars and percent to 2 decimals.`,
    tables: ['fct_payroll_monthly', 'dim_department'],
    canonical: DIVISION_COMP_MIX_SQL,
    solutionSql: DIVISION_COMP_MIX_SQL,
    solutionNote: `S&M is the only division with material commission (~14.3% of its total comp); R&D carries the largest bonus dollars but as a lower share of its total; COGS and G&A are base-heavy with smaller variable components. The mix difference explains why S&M's per-head rate is highest despite a mid-range base. This is a loaded-comp decomposition, not cash or salary.`,
    ordered: true,
    orderedNote: 'total_comp_usd descending',
    fingerprintSQL: DIVISION_COMP_MIX_ABS_TRAP_SQL,
    fingerprintMessage: `You computed bonus_share_pct against base_pay instead of total_comp, so the share reads bonus-as-a-percent-of-base rather than bonus-as-a-percent-of-loaded-comp. Use total_comp_usd as the denominator so the share reflects the full loaded cost, not just base.`,
    hints: [
      `Join payroll to dim_department; filter to H1 2026; group by division. Sum each component column.`,
      `Bonus share is 100 * bonus / total_comp; commission share is 100 * commission / total_comp, null-guarded. Order by total descending.`,
      DIVISION_COMP_MIX_SQL,
    ],
    sayIt: `"S&M is the only division with material commission — about 14% of its total comp. R&D carries the largest bonus dollars but a lower share. COGS and G&A are base-heavy. The mix explains why S&M's per-head rate is highest despite a mid-range base. This is a loaded-comp decomposition, not cash or salary."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm239',
    part: 35,
    title: 'Isolate the commission-earning cohort',
    from: 'fin',
    ask: `Commission concentrates in one division. Isolate the employees who earned commission in H1 2026: for each division with commission earners, count the distinct commissioned heads, sum total commission, and compute the average commission per earner. This shows how concentrated the variable sales comp is.`,
    deliverable: `One row (S&M only): division, commissioned_heads, total_commission_usd, avg_commission_per_earner_usd. Round dollars to 2 decimals. (Only divisions with commission_earners appear.)`,
    tables: ['fct_payroll_monthly', 'dim_department'],
    canonical: COMMISSION_CONCENTRATION_SQL,
    solutionSql: COMMISSION_CONCENTRATION_SQL,
    solutionNote: `Commission is exclusively an S&M instrument in H1 2026 — all commission earners sit in S&M. The average commission per earner quantifies the sales-variable load. This is a commission-earner profile, not a quota-attainment or sales-performance read.`,
    ordered: true,
    orderedNote: 'total_commission_usd descending (single row expected)',
    fingerprintSQL: COMMISSION_CONCENTRATION_ALL_DIVISIONS_TRAP_SQL,
    fingerprintMessage: `You returned all four divisions including those with zero commission, so three rows show zero commission and the concentration signal is diluted. Filter to commission_usd > 0 so only divisions with actual commission earners appear.`,
    hints: [
      `Join payroll to dim_department; filter to H1 2026 AND commission_usd > 0. Group by division.`,
      `Count distinct earners, sum commission, compute average per earner. Only divisions with commission > 0 appear.`,
      COMMISSION_CONCENTRATION_SQL,
    ],
    sayIt: `"Commission is exclusively an S&M instrument — all commission earners sit in S&M. The average commission per earner quantifies the sales-variable load. This is a commission-earner profile, not a quota-attainment read."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm240',
    part: 35,
    title: 'Measure bonus concentration by division',
    from: 'fin',
    ask: `Unlike commission, bonus appears across all divisions — but where does it concentrate? For each division, show total bonus, total comp, bonus share of that division's comp (how variable its bonus is), and bonus concentration (the division's share of all company bonus). A division with high bonus share but low concentration means bonus is spread evenly.`,
    deliverable: `Four rows ordered by bonus_share_pct descending: division, bonus_usd, total_comp_usd, bonus_share_pct, bonus_concentration_pct. Round dollars and percent to 2 decimals.`,
    tables: ['fct_payroll_monthly', 'dim_department'],
    canonical: BONUS_SHARE_BY_DIVISION_SQL,
    solutionSql: BONUS_SHARE_BY_DIVISION_SQL,
    solutionNote: `R&D carries the highest bonus share of its own comp (most variable-comp-heavy on bonus), while S&M carries the largest concentration of total company bonus dollars. The two metrics answer different questions: bonus_share_pct is how bonus-heavy a division is internally; bonus_concentration_pct is where the bonus dollars sit company-wide. This is a bonus distribution read, not a performance assessment.`,
    ordered: true,
    orderedNote: 'bonus_share_pct descending',
    fingerprintSQL: BONUS_SHARE_DROP_CONCENTRATION_TRAP_SQL,
    fingerprintMessage: `You zeroed out the bonus_concentration_pct column, dropping the company-wide concentration signal that complements the per-division share. Compute 100 * division bonus / total company bonus via a window so the reader sees where the bonus dollars sit across the company.`,
    hints: [
      `Aggregate per division: sum bonus and total comp. bonus_share_pct is 100 * bonus / total_comp per division.`,
      `bonus_concentration_pct is 100 * division bonus / sum of all divisions' bonus, via a window. Order by bonus_share_pct descending.`,
      BONUS_SHARE_BY_DIVISION_SQL,
    ],
    sayIt: `"R&D has the highest bonus share of its own comp — most bonus-variable internally — while S&M carries the largest concentration of total company bonus dollars. The two metrics answer different questions. This is a bonus distribution read, not a performance assessment."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm241',
    part: 35,
    title: 'Route the top ten departments by people cost',
    from: 'danny',
    ask: `Procurement and People need the bounded department queue: the ten departments with the largest H1 2026 total comp, with their division and headcount. Rank by total comp descending so the largest people-cost centers lead. This surfaces where the comp dollars concentrate below the division level.`,
    deliverable: `Exactly ten rows ordered by spend_rank ascending: dept_name, division, heads, total_comp_usd. Round dollars to 2 decimals.`,
    tables: ['fct_payroll_monthly', 'dim_department'],
    canonical: DEPARTMENT_TOP_SPEND_SQL,
    solutionSql: DEPARTMENT_TOP_SPEND_SQL,
    solutionNote: `The top departments by people cost span S&M and R&D divisions, with each carrying multiple large departments. The queue surfaces where comp concentrates below the division grain — useful for headcount planning and comp-band review. This is a comp-ranked review queue, not a salary or performance assessment.`,
    ordered: true,
    orderedNote: 'spend_rank ascending (largest total_comp first)',
    fingerprintSQL: DEPARTMENT_TOP_SPEND_ABS_TRAP_SQL,
    fingerprintMessage: `You ranked departments by base_pay_usd instead of total_comp_usd, so the queue reflects base salary only and ignores bonus, commission, benefits, and employer taxes. Rank by total_comp_usd so the queue reflects fully loaded people cost.`,
    hints: [
      `Group payroll by department (joined to dim_department for name and division). Sum total_comp_usd per department; count distinct heads.`,
      `Rank by total comp descending with a deterministic tiebreaker; filter to rank <= 10. Order by rank.`,
      DEPARTMENT_TOP_SPEND_SQL,
    ],
    sayIt: `"The top departments by people cost span S&M and R&D, each carrying multiple large departments. The queue surfaces where comp concentrates below the division grain — useful for headcount planning. This is a comp-ranked queue, not a salary assessment."`,
    jdCompanies: ['Stripe'],
  },
  {
    id: 'm242',
    part: 35,
    title: 'Package the comp-band handoff',
    from: 'maria',
    ask: `Close the comp-band review in one People + Finance handoff. Carry the company total heads and total comp with the company per-head rate; the S&M heads, comp, per-head rate, and commission (the highest-per-head division); and the R&D heads, comp, per-head rate, and bonus (the largest bonus division). Reduce each control to one row before combining.`,
    deliverable: `Exactly one row: total_heads, total_comp_usd, company_per_head_usd, sm_heads, sm_comp_usd, sm_per_head_usd, sm_commission_usd, rd_heads, rd_comp_usd, rd_per_head_usd, rd_bonus_usd. Round dollars to 2 decimals.`,
    tables: ['fct_payroll_monthly', 'dim_department'],
    canonical: COMP_BAND_HANDOFF_SQL,
    solutionSql: COMP_BAND_HANDOFF_SQL,
    solutionNote: `The comp-band handoff: 717 total heads at ~$103K company per-head; S&M 285 heads at ~$112K per-head (highest, commission-driven, $4.57M commission); R&D 317 heads at ~$96K per-head (largest bonus at $4.02M). The S&M-vs-R&D per-head gap (~$16K) reflects commission versus bonus structure, not base-pay parity. This is a loaded-comp handoff — not cash, salary, a forecast, or a performance assessment.`,
    ordered: false,
    fingerprintSQL: COMP_BAND_HANDOFF_DROP_PER_HEAD_TRAP_SQL,
    fingerprintMessage: `You zeroed out the per-head rates (company, S&M, R&D), dropping the unit-cost comparison that is the point of the handoff. Compute total comp / heads for each so leadership sees the per-head gap between divisions.`,
    hints: [
      `Build one-row controls: company totals, S&M (filtered to division = 'S&M'), and R&D (filtered to division = 'R&D'). CROSS JOIN.`,
      `Per-head is comp / heads for each. S&M carries commission; R&D carries bonus. The per-head gap reflects comp structure, not base parity.`,
      COMP_BAND_HANDOFF_SQL,
    ],
    sayIt: `"717 heads at about $103 thousand company per-head. S&M is highest at $112 thousand per-head — commission-driven — with $4.57 million of commission. R&D is $96 thousand per-head with the largest bonus at $4.02 million. The gap reflects comp structure, not base parity. This is a loaded-comp handoff, not cash or salary."`,
    jdCompanies: ['Figma'],
  },
]
