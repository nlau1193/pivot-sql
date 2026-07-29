// Plain-English notes for the warehouse rail. The grain line answers the ritual
// question — "what is one row here?" — and every column gets a one-liner a
// finance person would write, not a DBA.

export interface TableNote {
  grain: string
  blurb: string
  columns: Record<string, string>
}

export interface JoinEndpoint {
  relation: string
  column: string
}

export interface CommonJoin {
  from: JoinEndpoint
  to: JoinEndpoint
}

export const TABLE_GROUPS = [
  { id: 'facts', label: 'Facts', prefix: 'fct_' },
  { id: 'dimensions', label: 'Dimensions', prefix: 'dim_' },
  { id: 'staging', label: 'Staging', prefix: 'stg_' },
] as const

// These are mapped relationships that the learner will actually use in Star67. They are
// deliberately narrower than every same-shaped field in the fixture.
export const COMMON_JOINS: CommonJoin[] = [
  { from: { relation: 'fct_gl_transactions', column: 'account_id' }, to: { relation: 'dim_account', column: 'account_id' } },
  { from: { relation: 'fct_gl_transactions', column: 'dept_id' }, to: { relation: 'dim_department', column: 'dept_id' } },
  { from: { relation: 'fct_gl_transactions', column: 'vendor_id' }, to: { relation: 'dim_vendor', column: 'vendor_id' } },
  { from: { relation: 'fct_gl_transactions', column: 'customer_id' }, to: { relation: 'dim_customer', column: 'customer_id' } },
  { from: { relation: 'fct_subscription_snapshot_monthly', column: 'customer_id' }, to: { relation: 'dim_customer', column: 'customer_id' } },
  { from: { relation: 'fct_arr_movements', column: 'customer_id' }, to: { relation: 'dim_customer', column: 'customer_id' } },
  { from: { relation: 'fct_budget', column: 'account_id' }, to: { relation: 'dim_account', column: 'account_id' } },
  { from: { relation: 'fct_payroll_monthly', column: 'employee_id' }, to: { relation: 'dim_employee', column: 'employee_id' } },
  { from: { relation: 'fct_payroll_monthly', column: 'dept_id' }, to: { relation: 'dim_department', column: 'dept_id' } },
  { from: { relation: 'stg_customer_csm_assignments', column: 'customer_id' }, to: { relation: 'dim_customer', column: 'customer_id' } },
  { from: { relation: 'dim_employee', column: 'dept_id' }, to: { relation: 'dim_department', column: 'dept_id' } },
]

export const TABLE_NOTES: Record<string, TableNote> = {
  fct_gl_transactions: {
    grain: 'one row = one GL line',
    blurb: `The general ledger — every dollar that moved, 42 months of it. The biggest table in the warehouse and the backbone of the P&L.`,
    columns: {
      txn_id: 'unique id for this line',
      je_id: 'journal entry this line belongs to (one entry can have many lines)',
      txn_date: 'accounting date',
      posted_at: 'when this line reached the warehouse — it can be later than the accounting date',
      account_id: `which account — joins to dim_account. Revenue is the 4000s, COGS the 5000s, opex the 6000–7000s`,
      dept_id: 'which department (empty on revenue lines) — joins to dim_department',
      vendor_id: 'who we paid, for AP lines — joins to dim_vendor',
      customer_id: 'who paid us, on revenue lines — joins to dim_customer',
      memo: 'the human note on the line',
      amount: 'dollars — P&L-natural sign, so summing revenue gives positive revenue',
      source_system: 'where the line came from: Stripe, NetSuite, Payroll, Expensify, ManualJE',
    },
  },
  fct_subscription_snapshot_monthly: {
    grain: 'one row = one customer in one month (active customers only)',
    blurb: `Month-end ARR photograph. If a customer has no row in a month, they weren't a customer that month.`,
    columns: {
      month_start: 'the month (first of month)',
      customer_id: 'joins to dim_customer',
      plan_name: 'Starter, Growth, or Enterprise',
      seats: 'licensed seats that month',
      arr_usd: 'annual recurring revenue at month-end',
    },
  },
  fct_arr_movements: {
    grain: 'one row = one ARR event',
    blurb: `The event log behind the snapshots: every new deal, expansion, contraction, churn, and reactivation — with signed dollar deltas.`,
    columns: {
      movement_id: 'unique event id',
      event_date: 'when it happened',
      customer_id: 'joins to dim_customer',
      plan_name: 'plan at the time',
      movement_type: `'new', 'expansion', 'contraction', 'churn', or 'reactivation'`,
      arr_delta_usd: 'signed change in ARR (churn and contraction are negative)',
      arr_before_usd: 'ARR just before the event',
      arr_after_usd: 'ARR just after',
    },
  },
  fct_budget: {
    grain: 'one row = one plan version × month × account × department',
    blurb: `The operating plan, as uploaded from Excel — which is why the department here is free-text, not an id. (One version came back from department heads with… creative spellings.)`,
    columns: {
      budget_id: 'row id',
      version_name: `'FY2024 Plan', 'FY2025 Plan', 'FY2025 Q2 Reforecast', or 'FY2026 Plan'`,
      fiscal_month: 'the month (first of month)',
      account_id: 'joins to dim_account',
      dept_name_raw: 'department NAME as typed in the upload — may need TRIM/UPPER to join cleanly',
      amount_usd: 'planned dollars',
    },
  },
  fct_payroll_monthly: {
    grain: 'one row = one employee paid in one month',
    blurb: `Who was actually on payroll, month by month. Counting rows per month IS point-in-time headcount — payroll can't forget the way a roster field can.`,
    columns: {
      payroll_month: 'the month (first of month)',
      employee_id: 'joins to dim_employee',
      dept_id: 'joins to dim_department',
      base_pay_usd: 'monthly base',
      bonus_usd: 'bonus paid this month (annual bonuses land in March)',
      commission_usd: 'sales commission',
      benefits_usd: 'employer benefits cost',
      employer_taxes_usd: 'employer payroll taxes',
      total_comp_usd: 'all-in cost of this person this month',
    },
  },
  stg_customer_csm_assignments: {
    grain: 'one row = one CSM assignment event (a customer can have MANY)',
    blurb: `Success-manager assignment starts, straight from the CS tool ("stg_" = staging, barely cleaned). The source has names instead of durable employee IDs and no end dates. In this fixture every used name has exactly one employee match, but that is an invariant to test — not identity proof. A latest-row or LEAD-based interval is an analytical reconstruction at a stated cutoff, never source truth.`,
    columns: {
      customer_id: 'joins to dim_customer',
      csm_name: 'source owner label; exact-name mapping is fixture-specific, not a durable key',
      assigned_on: 'when this assignment started; the source supplies no matching end date',
      assignment_reason: 'source-entered change label; useful for consistency checks, not causal evidence',
    },
  },
  dim_customer: {
    grain: 'one row = one customer, ever',
    blurb: `Every company that ever bought Star67. Current-state only — segment is today's segment, with no history kept.`,
    columns: {
      customer_id: 'the key',
      customer_name: 'company name',
      segment: `'SMB', 'Mid-Market', or 'Enterprise' — as of today`,
      industry: 'their industry',
      region: 'AMER, EMEA, or APAC',
      billing_country: 'billing country',
      first_contract_date: 'when they first signed',
      crm_account_id: 'their id in the CRM',
    },
  },
  dim_department: {
    grain: 'one row = one department',
    blurb: `The org chart's spending units, with the division rollup the P&L uses.`,
    columns: {
      dept_id: 'the key the GL and payroll use',
      dept_name: 'the human name',
      cost_center_code: 'accounting cost center',
      division: `P&L rollup: 'R&D', 'S&M', 'G&A', or 'COGS'`,
      leader_name: 'who runs it',
    },
  },
  dim_account: {
    grain: 'one row = one GL account',
    blurb: `The chart of accounts — what kind of money each account is.`,
    columns: {
      account_id: 'the key (also readable: 4000s revenue, 5000s COGS, 6–7000s opex)',
      account_name: 'the human name',
      account_type: `'Revenue', 'COGS', 'Opex', 'Asset', 'Liability', 'Equity'`,
      pl_line: 'P&L rollup line (empty for balance-sheet accounts)',
      is_pl: 'true when the account belongs on the P&L',
    },
  },
  dim_vendor: {
    grain: 'one row = one vendor, as loaded from AP',
    blurb: `Everyone we pay. Loaded as-is from AP — including the duplicate spellings real vendor masters always have.`,
    columns: {
      vendor_id: 'the key',
      vendor_name: `the name as AP typed it — the same company can appear under several`,
      category: 'what kind of spend',
      payment_terms: 'Net 30 and friends',
    },
  },
  dim_employee: {
    grain: 'one row = one employee, ever hired',
    blurb: `The roster. termination_date is empty for current employees — mostly.`,
    columns: {
      employee_id: 'the key',
      full_name: 'name',
      title: 'job title',
      level: 'IC1–IC5, M1/M2, D1, VP',
      dept_id: 'joins to dim_department',
      location: 'office or remote',
      employment_type: 'FTE or Contractor',
      hire_date: 'start date',
      termination_date: 'end date — NULL means still here (when HR remembered to fill it in)',
      manager_employee_id: 'their manager',
    },
  },
  dim_date: {
    grain: 'one row = one calendar day',
    blurb: `A calendar you can join to — handy for month bucketing and weekday logic.`,
    columns: {
      date_day: 'the day',
      year: 'calendar year',
      quarter: `like '2025-Q2'`,
      month_start: 'first of the month',
      month_name: 'January…',
      day_of_week: 'Monday…',
      is_weekend: 'Saturday/Sunday',
      is_month_end: 'last day of its month',
    },
  },
}

/** Rail display order: the tables she'll use most, first. */
export const TABLE_ORDER = [
  'fct_gl_transactions',
  'fct_subscription_snapshot_monthly',
  'fct_arr_movements',
  'fct_budget',
  'fct_payroll_monthly',
  'stg_customer_csm_assignments',
  'dim_customer',
  'dim_department',
  'dim_account',
  'dim_vendor',
  'dim_employee',
  'dim_date',
]
