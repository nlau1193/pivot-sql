// Error translation: DuckDB's engine errors, rewritten the way a warm colleague
// would say them — Excel frame first, raw engine text available under a disclosure.
// Never show a bare Binder Error.

export interface FriendlyError {
  headline: string
  detail: string
  raw: string
}

export function translateError(rawIn: string, userSQL: string): FriendlyError {
  // scrub wrapper internals she never wrote, and re-point line numbers at HER sql
  // (the display wrapper adds one line above her query)
  const raw = rawIn
    .replace(/^Error:\s*/i, '')
    .replace(/\)\s*__display LIMIT \d+/g, '')
    .replace(/LINE (\d+)/g, (_, n) => `LINE ${Math.max(1, Number(n) - 1)}`)
  const r = raw

  if (/__readonly__/.test(r)) {
    return {
      headline: `This warehouse is read-only — same as the one you'll have at work.`,
      detail: `FP&A always gets read-only data access: you can look at everything and change nothing, by design, so nobody can break the books. SELECT is the whole job — and everything the tasks teach fits inside it.`,
      raw: 'Write statements (CREATE, DROP, INSERT, UPDATE, SET…) are disabled in Star67.',
    }
  }
  if (/__multistatement__/.test(r)) {
    return {
      headline: `One query at a time, please.`,
      detail: `There's a second statement after a semicolon in your editor. Warehouses run one query per Run — delete the extra statement (or the stray semicolon in the middle) and go again.`,
      raw: 'Multiple SQL statements per run are disabled in Star67.',
    }
  }
  if (/__smartquotes__/.test(r)) {
    return {
      headline: `Those are curly quotes from Notes or Docs — SQL needs straight quotes.`,
      detail: `Retype the quote marks in Star67: use 'straight single quotes' around text values and "straight double quotes" only around column names. Your words can stay exactly as they are.`,
      raw: 'Curly quote marks (‘ ’ “ ”) cannot act as SQL quote delimiters.',
    }
  }
  if (/detached|postMessage.*Worker/i.test(r)) {
    return {
      headline: `The warehouse needs a fresh start — reload the page and it comes back exactly as it was.`,
      detail: `Your progress and completed queries are stored safely in the browser; reloading just restarts the engine. (This is a rare engine hiccup, not something you did.)`,
      raw,
    }
  }

  // DuckDB usually offers a useful nearest function name; surface that instead
  // of making a one-letter typo feel like an opaque engine failure.
  let m = r.match(/(?:Scalar|Aggregate) Function with name ([^\s(]+) does not exist[^]*?Did you mean\s+["']([^"']+)["']/i)
  if (m) {
    return {
      headline: `The warehouse can't find a function called ${m[1]}().`,
      detail: `Did you mean ${m[2]}()? Function names are exact in SQL, so a one-letter typo is enough to stop the query. Fix the name and run the same query again.`,
      raw,
    }
  }

  if (/at least one window function must appear in the SELECT column or QUALIFY clause/i.test(r)) {
    return {
      headline: `QUALIFY needs a window function to filter.`,
      detail: `QUALIFY is the after-the-window filter: use it with ROW_NUMBER(), LAG(), or another calculation that has OVER (…). If you're filtering ordinary table rows, use WHERE instead.`,
      raw,
    }
  }

  if (/WHERE clause cannot contain window functions/i.test(r)) {
    return {
      headline: `Window functions can't go inside WHERE.`,
      detail: `WHERE runs before ROW_NUMBER(), LAG(), and other OVER (…) calculations exist. Move that condition to QUALIFY, or calculate the window column in a CTE/subquery and filter it in the outer query.`,
      raw,
    }
  }

  // the #1 Excel-habit trap: double quotes around a text VALUE
  m = r.match(/Referenced column "([^"]+)" not found/i)
  const candidateLine = r.match(/Candidate bindings?:\s*([^\n]*)/i)?.[1] ?? ''
  const nearestCandidate = (candidateLine.match(/"([^"]+)"/) || [])[1]
  const looksLikeIdentifierTypo = nearestCandidate
    ? editDistance(m?.[1].toLowerCase() ?? '', nearestCandidate.toLowerCase()) <= 2
    : false
  if (m && !looksLikeIdentifierTypo && (userSQL.includes(`"${m[1]}"`) || /^\d+(\.\d+)?$/.test(m[1]))) {
    return {
      headline: `SQL read "${m[1]}" as a COLUMN name, not a text value — quote style is the trap here.`,
      detail: `In Excel, text takes double quotes. SQL flips it: 'single quotes' for text values, "double quotes" only for column names. Change "${m[1]}" to '${m[1]}' and run again.`,
      raw,
    }
  }

  m = r.match(/Referenced column "([^"]+)" not found[^]*?Candidate bindings?:\s*(.*)/i) || r.match(/column "([^"]+)" (?:referenced|not found)[^]*?Candidate bindings?:\s*(.*)/i)
  if (m) {
    const near = (m[2].match(/"([^"]+)"/) || [])[1]
    return {
      headline: `The warehouse can't find a column called ${code(m[1])}.`,
      detail: `SQL is literal — unlike XLOOKUP there's no fuzzy matching, so the name has to be exact.${near ? ` Did you mean ${code(near)}? (That's the closest real column.)` : ''} Click a table in the left rail to see its exact column names — clicking a column drops it into your query.`,
      raw,
    }
  }

  m = r.match(/Table with name ([^\s]+) does not exist/i) || r.match(/Referenced table "([^"]+)" not found/i)
  if (m) {
    return {
      headline: `There's no table called ${code(m[1].replaceAll('"', ''))} in this warehouse.`,
      detail: `The 12 real tables are listed in the left rail with their exact names — warehouse names are usually prefixed like fct_ (facts: the big transactional tables) or dim_ (dimensions: the small lookup tables).`,
      raw,
    }
  }

  m = r.match(/column "([^"]+)" must appear in the GROUP BY clause/i)
  if (m) {
    return {
      headline: `${code(m[1])} needs to be in your GROUP BY.`,
      detail: /over\s*\(/i.test(userSQL)
        ? `One wrinkle when window functions (OVER …) meet GROUP BY: the expression inside OVER (ORDER BY …) has to exactly match what you grouped by — including any ::DATE cast. Make the two expressions character-for-character identical and this goes away.`
        : `Think of GROUP BY as the Rows area of a pivot table: every column you SELECT has to either be in the Rows area (GROUP BY) or be a Values calculation (SUM, COUNT, AVG…). ${code(m[1])} is currently neither — add it to GROUP BY, or wrap it in an aggregate.`,
      raw,
    }
  }

  m = r.match(/Ambiguous reference to column name "([^"]+)"/i)
  if (m) {
    return {
      headline: `Both tables in your join have a column called ${code(m[1])} — the engine doesn't know which one you mean.`,
      detail: `Prefix it with the table (or the table's nickname if you aliased it): for example g.${m[1]} or d.${m[1]}. This only comes up after a JOIN — it's the SQL version of two workbooks having a tab with the same name.`,
      raw,
    }
  }

  if (/Parser Error|syntax error at or near/i.test(r) && looksLikeProsePaste(userSQL)) {
    return {
      headline: `That looks like the explanation, not a SQL query.`,
      detail: `Star67 used to put explanation text where a runnable example belonged. Start with the editor's runnable query, or ask Frosty for one next step. If you pasted this unchanged from Star67, this is our example bug — not your comma.`,
      raw,
    }
  }

  m = r.match(/syntax error at or near "([^"]+)"/i)
  if (m) {
    const token = m[1]
    const line = findTokenLine(userSQL, token)
    return {
      headline: `The parser stopped at ${code(token)}${line ? ` (line ${line})` : ''}.`,
      detail: `The actual typo may be immediately before that token. Check the commas, clause order (SELECT → FROM → WHERE → GROUP BY → ORDER BY), and any stray characters. If you pasted this unchanged from Star67, that points to a Star67 example bug — not something you should guess around.`,
      raw,
    }
  }

  if (/unterminated quoted string|unterminated quote/i.test(r)) {
    return {
      headline: `A quote got opened but never closed.`,
      detail: `Every 'text value' needs both quotes. Scan your query for a lonely ' — text values use single quotes in SQL; double quotes are for column names.`,
      raw,
    }
  }

  m = r.match(/Could not convert string ['"]([^'"]*)['"] to (DATE|TIMESTAMP|[A-Z']+)/i)
  if (m) {
    return {
      headline: `${code(`'${m[1]}'`)} isn't a date the engine can read.`,
      detail: `Dates here are written 'YYYY-MM-DD' — so June 30, 2026 is '2026-06-30'. (The engine is stricter than Excel, which quietly guesses at dates. This one never guesses.)`,
      raw,
    }
  }

  if (/Conversion Error|Could not convert/i.test(r)) {
    return {
      headline: `A value couldn't be converted to the type the engine expected.`,
      detail: `This is like a #VALUE! error — usually text being compared to a number or a date written in a format it can't read. Dates are 'YYYY-MM-DD'; text needs 'single quotes'; numbers need no quotes at all.`,
      raw,
    }
  }

  if (/Binder Error.*aggregate|aggregate.*not allowed in WHERE/i.test(r)) {
    return {
      headline: `SUM/COUNT/AVG can't go inside WHERE.`,
      detail: `WHERE filters individual rows before any math happens. To filter on a calculated total, use HAVING after your GROUP BY — HAVING is WHERE's sibling that runs after the pivot.`,
      raw,
    }
  }

  m = r.match(/Referenced column "([^"]+)" not found/i)
  if (m) {
    return {
      headline: `The warehouse can't find a column called ${code(m[1])}.`,
      detail: `Column names have to be exact. Click the table in the left rail to see its real columns.`,
      raw,
    }
  }

  if (/Out of Memory Error|failed to allocate/i.test(r)) {
    return {
      headline: `That query was too big for the browser warehouse — nothing broke, and you're fine.`,
      detail: `This usually means a join multiplied out: two big tables joined without an ON condition try to produce trillions of rows. Check that every JOIN has an ON clause connecting the right keys, then run again — the engine is ready when you are.`,
      raw,
    }
  }

  if (/__timeout__/.test(r)) {
    return {
      headline: `That query was too big for the warehouse, so I restarted it — you're fine.`,
      detail: `This usually means a join multiplied out (two big tables joined without an ON condition can produce trillions of rows). Nothing broke and nothing was lost. Check each JOIN has an ON, then run again.`,
      raw: 'Query exceeded the 30-second safety limit; the engine was restarted.',
    }
  }
  if (/__cancelled__/.test(r)) {
    return {
      headline: `Cancelled — the warehouse restarted and it's ready when you are.`,
      detail: `Nothing was lost.`,
      raw: 'Cancelled by you.',
    }
  }

  return {
    headline: `The engine hit something it couldn't run.`,
    detail: `The technical message is below — these read hostile but they're always literal, and the first line usually names exactly what confused it. Reading them calmly is a real analyst skill (and gets easier fast).`,
    raw,
  }
}

function code(s: string) { return s }

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const above = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = above
    }
  }
  return row[b.length]
}

function findTokenLine(sql: string, token: string): number | null {
  const lines = sql.split('\n')
  for (let i = 0; i < lines.length; i++) if (lines[i].includes(token)) return i + 1
  return null
}

function looksLikeProsePaste(sql: string): boolean {
  const text = sql.trim()
  if (!text) return false

  const looksNatural = (candidate: string) => {
    const words = candidate.match(/\b[A-Za-z0-9][A-Za-z0-9'’-]*\b/g) ?? []
    return words.length >= 8 && (/[.!?](?:\s|$)/.test(candidate) || candidate.length >= 60)
  }

  if (/^(SELECT|WITH)\b/i.test(text)) {
    const blocks = text.split(/\n\s*\n/)
    if (blocks.length < 2) return false
    const tail = blocks.slice(1).join('\n\n').trim()
    if (/^(?:SELECT|WITH|FROM|WHERE|JOIN|GROUP\s+BY|ORDER\s+BY|QUALIFY|HAVING|LIMIT|UNION|INTERSECT|EXCEPT)\b/i.test(tail)
      || /^(?:--|\/\*|[,)]\s*)/.test(tail)) return false
    return looksNatural(tail)
  }

  // Keep ordinary SQL typos in the parser path; prose can legitimately name
  // SELECT or WHERE while explaining them, so keyword presence alone is not a
  // reason to call a paragraph SQL.
  if (/^(?:SELEC|SELCT|WITHH)\b[\s\S]*\bFROM\b/i.test(text)) return false

  return looksNatural(text)
}
