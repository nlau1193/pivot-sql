// Finance-grade formatting: right-aligned handled in CSS; here we make numbers
// read the way an FP&A person expects — $, thousands separators, negatives in
// parentheses, dates as dates, never 4212800.000000013.

export function isMoneyColumn(name: string): boolean {
  const explicitQuantity = /(?:^|_)(?:rows?|counts?)(?:_|$)/i
  return /(amount|arr|revenue|budget|variance|spend|comp|pay|usd|cost|margin_usd|delta|book|reforecast|overstatement|total|opex|actual|expense|fee|salar|wage|bonus|commission|benefit)/i.test(name)
    && !/(?:^|_)(?:pct|percent|id)(?:_|$)/i.test(name)
    && !explicitQuantity.test(name)
}
export function isIntegerType(type: string): boolean {
  return /^U?(?:(?:Tiny|Small|Big|Huge)?Int\d*|Integer)$/i.test(type.trim())
}
export function isNumericType(type: string): boolean {
  return /(Float|Int|Decimal|Double)/i.test(type)
}

const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const two = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const flex = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

export function formatCell(v: unknown, colName: string, colType: string): { text: string; num: boolean; neg: boolean } {
  // NULL in a numeric column right-aligns with its neighbors
  if (v === null || v === undefined) return { text: '—', num: isNumericType(colType), neg: false }
  if (v instanceof Date) return { text: v.toISOString().slice(0, 10), num: false, neg: false }
  if (typeof v === 'number' || typeof v === 'bigint') {
    const n = Number(v)
    if (isMoneyColumn(colName) && !isIntegerType(colType)) {
      const abs = two.format(Math.abs(n))
      return { text: n < 0 ? `($${abs})` : `$${abs}`, num: true, neg: n < 0 }
    }
    if (Number.isInteger(n)) return { text: int.format(n), num: true, neg: n < 0 }
    // fixed 2dp keeps a column's decimals aligned instead of ragged
    return { text: two.format(n), num: true, neg: n < 0 }
  }
  if (typeof v === 'boolean') return { text: v ? 'true' : 'false', num: false, neg: false }
  // epoch-ms timestamps sometimes arrive as numbers-in-strings via arrow; leave strings alone
  return { text: String(v), num: false, neg: false }
}

export function fmtInt(n: number): string {
  return int.format(n)
}
export function fmtMs(ms: number): string {
  return ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(1)}s`
}
