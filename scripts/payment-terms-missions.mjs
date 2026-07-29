// Vendor payment-terms working-capital exposure review — a Star67 operating-review arc (part 33).
// An arc over dim_vendor + fct_gl_transactions measuring payment-terms concentration,
// weighted-average days, and the working-capital implication, distinct from m30-36
// vendor-review (category spend + identity) and m163-170 T&E. Seven decisions: payment-terms
// boundary, weighted-average payment days, top-vendor concentration, the working-capital
// exposure (spend x days), slowest-paying vendor cohort, terms-mix vs vendor-count, and a handoff.
//
// Audited H1 2026 truth:
//   payment_terms: Net 30 (79 vendors, $36,374,175.88) / Net 45 (43, $19,454,971.38)
//     / Due on receipt (32, $14,987,346.41) / Net 15 (28, $12,129,744.29)
//   weighted-average payment days (spend-weighted): 25.9
//   total vendor-tagged spend: $82,946,237.96 across 182 vendors
//   top vendors: Google Cloud $1,859,981.78 (Net 30), Bowery Associates $1,848,421.28 (Net 30),
//     LinkedIn Corp $1,843,969.23 (Due on receipt), Cedar Advisory $1,679,158.71 (Net 15)

const PAYMENT_TERMS_BOUNDARY_SQL = `SELECT v.payment_terms,
  count(DISTINCT v.vendor_id) AS vendors,
  round(sum(g.amount), 2) AS h1_spend_usd,
  round(100.0 * sum(g.amount) / sum(sum(g.amount)) OVER (), 2) AS spend_share_pct
FROM fct_gl_transactions g
JOIN dim_vendor v ON g.vendor_id = v.vendor_id
WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
GROUP BY v.payment_terms
ORDER BY h1_spend_usd DESC`

const PAYMENT_TERMS_BOUNDARY_VENDOR_COUNT_TRAP_SQL = `SELECT v.payment_terms,
  count(DISTINCT v.vendor_id) AS vendors,
  round(sum(g.amount), 2) AS h1_spend_usd,
  round(100.0 * count(DISTINCT v.vendor_id) / sum(count(DISTINCT v.vendor_id)) OVER (), 2) AS spend_share_pct
FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id
WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
GROUP BY v.payment_terms ORDER BY h1_spend_usd DESC`

const WEIGHTED_AVG_PAYMENT_DAYS_SQL = `WITH spend AS (
  SELECT v.payment_terms, sum(g.amount) AS spend
  FROM fct_gl_transactions g
  JOIN dim_vendor v ON g.vendor_id = v.vendor_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
  GROUP BY 1
), days AS (
  SELECT payment_terms,
    CASE
      WHEN payment_terms = 'Due on receipt' THEN 0
      WHEN payment_terms = 'Net 15' THEN 15
      WHEN payment_terms = 'Net 30' THEN 30
      WHEN payment_terms = 'Net 45' THEN 45
    END AS terms_days
  FROM spend
)
SELECT round(sum(s.spend * d.terms_days) / nullif(sum(s.spend), 0), 2) AS weighted_avg_payment_days,
  round(sum(s.spend), 2) AS total_spend_usd
FROM spend s JOIN days d ON s.payment_terms = d.payment_terms`

const WEIGHTED_AVG_PAYMENT_DAYS_UNWEIGHTED_TRAP_SQL = `WITH days AS (
  SELECT DISTINCT v.payment_terms,
    CASE WHEN v.payment_terms = 'Due on receipt' THEN 0 WHEN v.payment_terms = 'Net 15' THEN 15 WHEN v.payment_terms = 'Net 30' THEN 30 WHEN v.payment_terms = 'Net 45' THEN 45 END AS terms_days
  FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
)
SELECT round(avg(terms_days), 2) AS weighted_avg_payment_days,
  round(0, 2) AS total_spend_usd
FROM days`

const TOP_VENDORS_BY_SPEND_SQL = `WITH vendor_spend AS (
  SELECT v.vendor_id, v.vendor_name, v.payment_terms,
    round(sum(g.amount), 2) AS h1_spend_usd
  FROM fct_gl_transactions g
  JOIN dim_vendor v ON g.vendor_id = v.vendor_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
  GROUP BY v.vendor_id, v.vendor_name, v.payment_terms
), ranked AS (
  SELECT vendor_id, vendor_name, payment_terms, h1_spend_usd,
    row_number() OVER (ORDER BY h1_spend_usd DESC, vendor_id) AS spend_rank
  FROM vendor_spend
)
SELECT vendor_id, vendor_name, payment_terms, h1_spend_usd
FROM ranked
WHERE spend_rank <= 10
ORDER BY spend_rank`

const TOP_VENDORS_ABS_TRAP_SQL = `WITH vendor_spend AS (
  SELECT v.vendor_id, v.vendor_name, v.payment_terms,
    round(sum(abs(g.amount)), 2) AS h1_spend_usd
  FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
  GROUP BY v.vendor_id, v.vendor_name, v.payment_terms
), ranked AS (
  SELECT vendor_id, vendor_name, payment_terms, h1_spend_usd,
    row_number() OVER (ORDER BY h1_spend_usd DESC, vendor_id) AS spend_rank
  FROM vendor_spend
)
SELECT vendor_id, vendor_name, payment_terms, h1_spend_usd FROM ranked WHERE spend_rank <= 10 ORDER BY spend_rank`

const WORKING_CAPITAL_EXPOSURE_SQL = `WITH spend AS (
  SELECT v.payment_terms, sum(g.amount) AS spend
  FROM fct_gl_transactions g
  JOIN dim_vendor v ON g.vendor_id = v.vendor_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
  GROUP BY 1
), days AS (
  SELECT payment_terms,
    CASE
      WHEN payment_terms = 'Due on receipt' THEN 0
      WHEN payment_terms = 'Net 15' THEN 15
      WHEN payment_terms = 'Net 30' THEN 30
      WHEN payment_terms = 'Net 45' THEN 45
    END AS terms_days
  FROM spend
)
SELECT s.payment_terms,
  d.terms_days,
  round(s.spend, 2) AS h1_spend_usd,
  round(s.spend * d.terms_days, 2) AS spend_days_exposure,
  round(100.0 * s.spend * d.terms_days / sum(s.spend * d.terms_days) OVER (), 2) AS exposure_share_pct
FROM spend s JOIN days d ON s.payment_terms = d.payment_terms
ORDER BY spend_days_exposure DESC`

const WORKING_CAPITAL_EXPOSURE_DROP_DAYS_TRAP_SQL = `WITH spend AS (
  SELECT v.payment_terms, sum(g.amount) AS spend
  FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1
), days AS (
  SELECT payment_terms, CASE WHEN payment_terms = 'Due on receipt' THEN 0 WHEN payment_terms = 'Net 15' THEN 15 WHEN payment_terms = 'Net 30' THEN 30 WHEN payment_terms = 'Net 45' THEN 45 END AS terms_days FROM spend
)
SELECT s.payment_terms, d.terms_days, round(s.spend, 2) AS h1_spend_usd,
  round(s.spend, 2) AS spend_days_exposure,
  round(100.0 * s.spend / sum(s.spend) OVER (), 2) AS exposure_share_pct
FROM spend s JOIN days d ON s.payment_terms = d.payment_terms ORDER BY spend_days_exposure DESC`

const SLOWEST_PAYING_COHORT_SQL = `WITH vendor_spend AS (
  SELECT v.vendor_id, v.vendor_name, v.payment_terms,
    round(sum(g.amount), 2) AS h1_spend_usd
  FROM fct_gl_transactions g
  JOIN dim_vendor v ON g.vendor_id = v.vendor_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
  GROUP BY v.vendor_id, v.vendor_name, v.payment_terms
)
SELECT payment_terms,
  count(*) AS vendors,
  round(sum(h1_spend_usd), 2) AS total_spend_usd,
  round(sum(h1_spend_usd) / nullif(count(*), 0), 2) AS avg_spend_per_vendor_usd
FROM vendor_spend
WHERE payment_terms = 'Net 45'
GROUP BY payment_terms
ORDER BY total_spend_usd DESC`

const SLOWEST_PAYING_ALL_TERMS_TRAP_SQL = `WITH vendor_spend AS (
  SELECT v.vendor_id, v.vendor_name, v.payment_terms,
    round(sum(g.amount), 2) AS h1_spend_usd
  FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
  GROUP BY v.vendor_id, v.vendor_name, v.payment_terms
)
SELECT payment_terms, count(*) AS vendors,
  round(sum(h1_spend_usd), 2) AS total_spend_usd,
  round(sum(h1_spend_usd) / nullif(count(*), 0), 2) AS avg_spend_per_vendor_usd
FROM vendor_spend GROUP BY payment_terms ORDER BY total_spend_usd DESC`

const TERMS_MIX_VS_VENDOR_COUNT_SQL = `WITH spend AS (
  SELECT v.payment_terms,
    count(DISTINCT v.vendor_id) AS vendors,
    round(sum(g.amount), 2) AS h1_spend_usd
  FROM fct_gl_transactions g
  JOIN dim_vendor v ON g.vendor_id = v.vendor_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
  GROUP BY 1
)
SELECT payment_terms,
  vendors,
  round(100.0 * vendors / sum(vendors) OVER (), 2) AS vendor_share_pct,
  round(100.0 * h1_spend_usd / sum(h1_spend_usd) OVER (), 2) AS spend_share_pct,
  round(h1_spend_usd / nullif(vendors, 0), 2) AS avg_spend_per_vendor_usd
FROM spend
ORDER BY h1_spend_usd DESC`

const TERMS_MIX_VS_VENDOR_COUNT_DROP_AVG_TRAP_SQL = `WITH spend AS (
  SELECT v.payment_terms, count(DISTINCT v.vendor_id) AS vendors, round(sum(g.amount), 2) AS h1_spend_usd
  FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01' GROUP BY 1
)
SELECT payment_terms, vendors,
  round(100.0 * vendors / sum(vendors) OVER (), 2) AS vendor_share_pct,
  round(100.0 * h1_spend_usd / sum(h1_spend_usd) OVER (), 2) AS spend_share_pct,
  round(0, 2) AS avg_spend_per_vendor_usd
FROM spend ORDER BY h1_spend_usd DESC`

const PAYMENT_TERMS_HANDOFF_SQL = `WITH terms AS (
  SELECT v.payment_terms,
    count(DISTINCT v.vendor_id) AS vendors,
    round(sum(g.amount), 2) AS h1_spend_usd
  FROM fct_gl_transactions g
  JOIN dim_vendor v ON g.vendor_id = v.vendor_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
  GROUP BY 1
), wad AS (
  SELECT round(sum(CASE WHEN t.payment_terms = 'Due on receipt' THEN t.h1_spend_usd * 0 WHEN t.payment_terms = 'Net 15' THEN t.h1_spend_usd * 15 WHEN t.payment_terms = 'Net 30' THEN t.h1_spend_usd * 30 WHEN t.payment_terms = 'Net 45' THEN t.h1_spend_usd * 45 END) / nullif(sum(t.h1_spend_usd), 0), 2) AS weighted_avg_days
  FROM terms t
), net45 AS (
  SELECT round(sum(t.h1_spend_usd), 2) AS net45_spend_usd
  FROM terms t WHERE t.payment_terms = 'Net 45'
), top_vendor AS (
  SELECT v.vendor_name, round(sum(g.amount), 2) AS h1_spend_usd
  FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
  GROUP BY v.vendor_name ORDER BY h1_spend_usd DESC LIMIT 1
)
SELECT
  (SELECT count(DISTINCT v.vendor_id) FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01') AS total_vendors,
  (SELECT round(sum(g.amount), 2) FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01') AS total_spend_usd,
  wad.weighted_avg_days AS weighted_avg_payment_days,
  net45.net45_spend_usd,
  round(100.0 * net45.net45_spend_usd / nullif((SELECT sum(g.amount) FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'), 0), 2) AS net45_share_pct,
  top_vendor.vendor_name AS largest_vendor_name,
  top_vendor.h1_spend_usd AS largest_vendor_spend_usd
FROM wad CROSS JOIN net45 CROSS JOIN top_vendor`

const PAYMENT_TERMS_HANDOFF_DROP_WAD_TRAP_SQL = `WITH net45 AS (
  SELECT round(0, 2) AS net45_spend_usd
), top_vendor AS (
  SELECT v.vendor_name, round(sum(g.amount), 2) AS h1_spend_usd
  FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id
  WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01'
  GROUP BY v.vendor_name ORDER BY h1_spend_usd DESC LIMIT 1
)
SELECT
  (SELECT count(DISTINCT v.vendor_id) FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01') AS total_vendors,
  (SELECT round(sum(g.amount), 2) FROM fct_gl_transactions g JOIN dim_vendor v ON g.vendor_id = v.vendor_id WHERE g.txn_date >= DATE '2026-01-01' AND g.txn_date < DATE '2026-07-01') AS total_spend_usd,
  round(0, 2) AS weighted_avg_payment_days,
  net45.net45_spend_usd,
  round(0, 2) AS net45_share_pct,
  top_vendor.vendor_name AS largest_vendor_name,
  top_vendor.h1_spend_usd AS largest_vendor_spend_usd
FROM net45 CROSS JOIN top_vendor`

export const PAYMENT_TERMS_MISSIONS = [
  {
    id: 'm224',
    part: 33,
    title: 'Set the payment-terms spend boundary',
    from: 'maria',
    ask: `Open the working-capital review by setting the payment-terms boundary: for each payment_terms value in dim_vendor, count distinct vendors and sum H1 2026 GL spend, with each bucket's share of total spend. This shows where the vendor dollars sit by payment terms — the foundation for the working-capital read.`,
    deliverable: `Four rows ordered by h1_spend_usd descending: payment_terms, vendors, h1_spend_usd, spend_share_pct. Round dollars and percent to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_vendor'],
    canonical: PAYMENT_TERMS_BOUNDARY_SQL,
    solutionSql: PAYMENT_TERMS_BOUNDARY_SQL,
    solutionNote: `H1 2026 vendor-tagged spend is ~$82.95M across four payment-terms buckets: Net 30 ($36.37M, ~43.9%), Net 45 ($19.45M, ~23.5%), Due on receipt ($14.99M, ~18.1%), and Net 15 ($12.13M, ~14.6%). Net 30 carries the most spend but Net 45 is the slower-paying material bucket. This is recognized spend, not cash paid.`,
    ordered: true,
    orderedNote: 'h1_spend_usd descending',
    fingerprintSQL: PAYMENT_TERMS_BOUNDARY_VENDOR_COUNT_TRAP_SQL,
    fingerprintMessage: `You weighted the spend share by vendor count instead of spend dollars, so a terms bucket with many small vendors overstates its spend share. Weight by sum(g.amount) so the share reflects where the dollars actually sit.`,
    hints: [
      `Join GL to dim_vendor on vendor_id; filter to H1 2026. Group by payment_terms.`,
      `Count distinct vendor_id; sum amount. Share is 100 * bucket spend / total spend via a window. Order by spend descending.`,
      PAYMENT_TERMS_BOUNDARY_SQL,
    ],
    sayIt: `"H1 vendor spend is about $83 million across four payment-terms buckets: Net 30 carries the most at $36 million, but Net 45 is the slower-paying material bucket at $19 million. This is recognized spend, not cash paid."`,
    jdCompanies: ['Datadog'],
  },
  {
    id: 'm225',
    part: 33,
    title: 'Compute the spend-weighted average payment days',
    from: 'maria',
    ask: `Convert the terms mix into a single working-capital signal: the spend-weighted average payment days. For each terms bucket, multiply spend by the terms days (Due on receipt = 0, Net 15 = 15, Net 30 = 30, Net 45 = 45), sum, and divide by total spend. This is the average days to pay a dollar of vendor spend, weighted by where the money sits.`,
    deliverable: `Exactly one row: weighted_avg_payment_days, total_spend_usd. Round to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_vendor'],
    canonical: WEIGHTED_AVG_PAYMENT_DAYS_SQL,
    solutionSql: WEIGHTED_AVG_PAYMENT_DAYS_SQL,
    solutionNote: `The spend-weighted average payment days is about 25.9 — each dollar of H1 vendor spend is, on average, paid roughly 26 days after recognition. This is a working-capital signal: lower days means cash leaves faster; higher days means the company holds cash longer. It is not a cash-basis DPO or an accrual assertion.`,
    ordered: false,
    fingerprintSQL: WEIGHTED_AVG_PAYMENT_DAYS_UNWEIGHTED_TRAP_SQL,
    fingerprintMessage: `You took a simple average of the terms days (0+15+30+45)/4 = 22.5, ignoring that spend is not evenly distributed across terms. Weight by spend — multiply each bucket's spend by its days, sum, and divide by total spend — so the average reflects where the dollars actually sit.`,
    hints: [
      `Sum spend per terms bucket, then map each payment_terms string to its numeric days with a CASE expression.`,
      `Multiply each bucket's spend by its days, sum across buckets, and divide by total spend. One row out: the weighted average plus total spend.`,
      WEIGHTED_AVG_PAYMENT_DAYS_SQL,
    ],
    sayIt: `"The spend-weighted average payment days is about 26 — each dollar of H1 vendor spend is paid roughly 26 days after recognition, weighted by where the money sits. This is a working-capital signal, not a cash-basis DPO."`,
    jdCompanies: ['Hightouch'],
  },
  {
    id: 'm226',
    part: 33,
    title: 'Route the top ten vendors by spend',
    from: 'danny',
    ask: `Procurement needs the bounded top-vendor queue: the ten vendors with the largest H1 2026 spend, with their payment terms. Rank by spend descending so the largest dollars-at-risk lead. The payment terms on each row show whether the biggest vendors are fast or slow payers — different renegotiation conversations.`,
    deliverable: `Exactly ten rows ordered by spend_rank ascending: vendor_id, vendor_name, payment_terms, h1_spend_usd. Round dollars to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_vendor'],
    canonical: TOP_VENDORS_BY_SPEND_SQL,
    solutionSql: TOP_VENDORS_BY_SPEND_SQL,
    solutionNote: `The top vendors by H1 spend include Google Cloud, Bowery Associates, LinkedIn, and Cedar Advisory — each carrying $1.6M-$1.9M. Their payment terms vary (Net 30, Due on receipt, Net 15), so the largest vendors are not uniformly slow or fast payers. This is a spend-ranked review queue, not a payment-history or vendor-risk assessment.`,
    ordered: true,
    orderedNote: 'spend_rank ascending (largest spend first)',
    fingerprintSQL: TOP_VENDORS_ABS_TRAP_SQL,
    fingerprintMessage: `You summed abs(g.amount) per vendor, which would flip any reversing entries positive and corrupt the spend ranking. Preserve the signed amount so credits reduce a vendor's net spend.`,
    hints: [
      `Group GL by vendor (joined to dim_vendor for name and terms); sum amount per vendor. Rank by spend descending with a deterministic tiebreaker.`,
      `Filter to rank <= 10. Order by the rank so the largest spend leads.`,
      TOP_VENDORS_BY_SPEND_SQL,
    ],
    sayIt: `"The top vendors by H1 spend include Google Cloud, Bowery, LinkedIn, and Cedar — each at $1.6-1.9 million, with mixed payment terms. The largest vendors are not uniformly slow or fast payers. This is a spend-ranked queue, not a payment-history assessment."`,
    jdCompanies: ['1Password'],
  },
  {
    id: 'm227',
    part: 33,
    title: 'Measure the working-capital exposure by terms bucket',
    from: 'maria',
    ask: `Which terms bucket ties up the most working capital? Compute the spend-days exposure for each bucket: spend multiplied by terms days. Then rank the buckets by exposure and compute each one's share of total exposure. A bucket with high spend AND long terms dominates the exposure even if its spend share alone looks moderate.`,
    deliverable: `Four rows ordered by spend_days_exposure descending: payment_terms, terms_days, h1_spend_usd, spend_days_exposure, exposure_share_pct. Round dollars and percent to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_vendor'],
    canonical: WORKING_CAPITAL_EXPOSURE_SQL,
    solutionSql: WORKING_CAPITAL_EXPOSURE_SQL,
    solutionNote: `Net 30 carries the largest spend-days exposure because it combines high spend ($36.37M) with moderate terms (30 days); Net 45 follows with high terms on lower spend; Due on receipt has zero exposure because its terms days are zero. The exposure ranking differs from the raw spend ranking because it weights spend by how long the cash is deferred. This is a working-capital exposure read, not a cash or DPO assertion.`,
    ordered: true,
    orderedNote: 'spend_days_exposure descending',
    fingerprintSQL: WORKING_CAPITAL_EXPOSURE_DROP_DAYS_TRAP_SQL,
    fingerprintMessage: `You dropped the terms-days multiplier, so spend_days_exposure equals raw spend and the exposure ranking is just the spend ranking again. Multiply each bucket's spend by its terms days so the exposure reflects both volume and deferral length.`,
    hints: [
      `Sum spend per terms bucket and map each to its numeric days. Multiply spend by days for the exposure.`,
      `Exposure share is 100 * bucket exposure / total exposure via a window. Order by exposure descending — it differs from raw spend because it weights by days.`,
      WORKING_CAPITAL_EXPOSURE_SQL,
    ],
    sayIt: `"Net 30 carries the largest spend-days exposure — high spend times moderate days. Net 45 follows with long terms on lower spend. Due on receipt has zero exposure because its days are zero. The exposure ranking differs from raw spend because it weights by deferral length. This is a working-capital read, not a DPO assertion."`,
    jdCompanies: ['Affirm'],
  },
  {
    id: 'm228',
    part: 33,
    title: 'Profile the slowest-paying vendor cohort',
    from: 'danny',
    ask: `Net 45 is the slowest standard terms bucket. Profile it: how many vendors sit on Net 45, what is their total H1 spend, and the average spend per Net 45 vendor? This shows whether the slow-paying cohort is concentrated in a few large vendors or spread across many small ones — different consolidation conversations.`,
    deliverable: `Exactly one row: payment_terms, vendors, total_spend_usd, avg_spend_per_vendor_usd. Round dollars to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_vendor'],
    canonical: SLOWEST_PAYING_COHORT_SQL,
    solutionSql: SLOWEST_PAYING_COHORT_SQL,
    solutionNote: `The Net 45 cohort has 43 vendors carrying $19.45M of H1 spend, averaging about $452K per vendor. The slow-paying cohort is neither a single dominant vendor nor an even spread — it's a mid-sized group of moderate vendors. This is a cohort profile, not a payment-performance or vendor-risk assessment.`,
    ordered: false,
    fingerprintSQL: SLOWEST_PAYING_ALL_TERMS_TRAP_SQL,
    fingerprintMessage: `You returned all four terms buckets instead of profiling just the Net 45 cohort. The slowest-paying-cohort read isolates Net 45 to show its vendor count, total spend, and average per vendor on their own.`,
    hints: [
      `Aggregate GL spend per vendor (joined to dim_vendor for terms), then filter to payment_terms = 'Net 45' and aggregate the cohort.`,
      `Count vendors, sum spend, and compute average spend per vendor. One row out for the Net 45 cohort.`,
      SLOWEST_PAYING_COHORT_SQL,
    ],
    sayIt: `"The Net 45 cohort has 43 vendors carrying $19.45 million of H1 spend — about $452 thousand each on average. It's a mid-sized group of moderate vendors, not a single dominant account. This is a cohort profile, not a payment-performance assessment."`,
    jdCompanies: ['Stripe'],
  },
  {
    id: 'm229',
    part: 33,
    title: 'Compare terms mix by vendor count versus spend',
    from: 'fin',
    ask: `Does the vendor-count mix match the spend mix? For each terms bucket, show the vendor count, vendor share, spend share, and average spend per vendor. A bucket with many vendors but low spend share has small vendors; a bucket with few vendors but high spend share has large ones. The gap between the two shares is the concentration signal.`,
    deliverable: `Four rows ordered by h1_spend_usd descending: payment_terms, vendors, vendor_share_pct, spend_share_pct, avg_spend_per_vendor_usd. Round dollars and percent to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_vendor'],
    canonical: TERMS_MIX_VS_VENDOR_COUNT_SQL,
    solutionSql: TERMS_MIX_VS_VENDOR_COUNT_SQL,
    solutionNote: `The vendor-count share and spend share diverge meaningfully across terms buckets — some buckets carry many small vendors while others have fewer but larger ones. The average spend per vendor quantifies that concentration per bucket. This is a mix comparison, not a payment-performance or risk read.`,
    ordered: true,
    orderedNote: 'h1_spend_usd descending',
    fingerprintSQL: TERMS_MIX_VS_VENDOR_COUNT_DROP_AVG_TRAP_SQL,
    fingerprintMessage: `You zeroed out the avg_spend_per_vendor_usd column, dropping the per-vendor concentration signal that is the point of the comparison. Compute spend / vendors per bucket so the reader sees whether each terms bucket holds small or large vendors.`,
    hints: [
      `Aggregate per terms bucket: count distinct vendors and sum spend. Compute both shares via windows over the grouped result.`,
      `Average spend per vendor is spend / vendors, null-guarded. Order by spend descending.`,
      TERMS_MIX_VS_VENDOR_COUNT_SQL,
    ],
    sayIt: `"The vendor-count share and spend share diverge across terms — some buckets hold many small vendors, others fewer but larger. The average spend per vendor quantifies the concentration per bucket. This is a mix comparison, not a payment-performance read."`,
    jdCompanies: ['Figma'],
  },
  {
    id: 'm230',
    part: 33,
    title: 'Package the payment-terms working-capital handoff',
    from: 'maria',
    ask: `Close the working-capital review in one Procurement + Finance handoff. Carry the total distinct vendors, total spend, the spend-weighted average payment days, the Net 45 spend and its share (the slow-paying material bucket), and the largest single vendor with its spend. Reduce each control to one row before combining.`,
    deliverable: `Exactly one row: total_vendors, total_spend_usd, weighted_avg_payment_days, net45_spend_usd, net45_share_pct, largest_vendor_name, largest_vendor_spend_usd. Round dollars and percent to 2 decimals.`,
    tables: ['fct_gl_transactions', 'dim_vendor'],
    canonical: PAYMENT_TERMS_HANDOFF_SQL,
    solutionSql: PAYMENT_TERMS_HANDOFF_SQL,
    solutionNote: `The payment-terms handoff: 182 distinct vendors, ~$82.95M H1 spend, ~25.9 weighted-average payment days, Net 45 carries ~$19.45M (~23.5% of spend), and the largest single vendor (Google Cloud) carries ~$1.86M. This is a recognized-spend working-capital handoff — not cash paid, DPO, vendor risk, or a payment-performance assertion.`,
    ordered: false,
    fingerprintSQL: PAYMENT_TERMS_HANDOFF_DROP_WAD_TRAP_SQL,
    fingerprintMessage: `You zeroed out the weighted-average payment days and the Net 45 spend/share, dropping the two working-capital signals that are the point of the handoff. Carry the real weighted-average days and the Net 45 material-bucket figures so leadership sees the deferral profile.`,
    hints: [
      `Build one-row controls: total vendors + spend (scalar subqueries), weighted-average days (CASE-weighted sum / total), Net 45 spend + share, and the largest vendor (LIMIT 1). CROSS JOIN.`,
      `Weighted-average days multiplies each bucket's spend by its CASE days, sums, and divides by total spend. Net 45 share is 100 * Net 45 spend / total.`,
      PAYMENT_TERMS_HANDOFF_SQL,
    ],
    sayIt: `"182 vendors, $83 million H1 spend, about 26 weighted-average payment days. Net 45 carries $19.45 million — 24% of spend — and Google Cloud is the largest single vendor at $1.86 million. This is a recognized-spend working-capital handoff, not cash, DPO, or vendor risk."`,
    jdCompanies: ['Datadog'],
  },
]
