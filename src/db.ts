// The warehouse engine: DuckDB-WASM with a crash-proof wrapper.
// - Parquet buffers are fetched once (with progress) and kept in JS so the
//   worker can be killed and rebuilt without re-downloading.
// - Display queries run LIMIT-capped; grading runs inside DuckDB (no JS materialization).
// - A watchdog restarts the worker if a query runs away (accidental cross joins).
import * as duckdb from '@duckdb/duckdb-wasm'
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: duckdb_wasm, mainWorker: mvp_worker },
  eh: { mainModule: duckdb_wasm_eh, mainWorker: eh_worker },
}

export const DISPLAY_LIMIT = 500
const QUERY_TIMEOUT_MS = 30_000
const DATA_REVISION = encodeURIComponent(__PIVOT_DATA_REVISION__)
const dataURL = (file: string) => `/data/${file}?v=${DATA_REVISION}`

export interface TableInfo {
  rows: number
  bytes: number
}
export interface Manifest {
  company: string
  tables: Record<string, TableInfo>
  total_rows: number
}

export interface QueryResult {
  columns: string[]
  types: string[]
  rows: unknown[][]
  rowCount: number // rows returned (display-capped)
  totalRowCount: number | null // full count when known
  elapsedMs: number
  truncated: boolean
}

interface RawQueryResult {
  columns: string[]
  types: string[]
  rows: unknown[][]
}

type Progress = (msg: string, frac: number, loadedBytes?: number, totalBytes?: number) => void

class Engine {
  private db: duckdb.AsyncDuckDB | null = null
  private conn: duckdb.AsyncDuckDBConnection | null = null
  private buffers = new Map<string, Uint8Array>()
  manifest: Manifest | null = null
  private booting: Promise<void> | null = null
  private restarting: Promise<void> | null = null

  async boot(onProgress: Progress): Promise<void> {
    if (this.booting) return this.booting
    const attempt = this._boot(onProgress).catch(async (error) => {
      await this.resetFailedBoot()
      if (this.booting === attempt) this.booting = null
      throw error
    })
    this.booting = attempt
    return attempt
  }

  private async _boot(onProgress: Progress) {
    onProgress('Waking the warehouse engine…', 0.02)
    let manifestResponse: Response
    try {
      manifestResponse = await fetch(dataURL('manifest.json'))
    } catch {
      throw new Error('__datafetch__:manifest:network')
    }
    if (!manifestResponse.ok) throw new Error(`__datafetch__:manifest:${manifestResponse.status}`)
    let manifest: Manifest
    try {
      manifest = await manifestResponse.json()
    } catch {
      throw new Error('__datafetch__:manifest:invalid')
    }
    this.manifest = manifest
    const tables = Object.keys(manifest.tables)
    const totalBytes = Object.values(manifest.tables).reduce((a, t) => a + t.bytes, 0)

    await this.startWorker()

    // GL first makes the long transfer legible; the remaining small tables keep
    // manifest order so the generated warehouse and its load trace agree.
    const ordered = ['fct_gl_transactions', ...tables.filter((t) => t !== 'fct_gl_transactions')]
    let done = 0
    for (const t of ordered) {
      const label = t === 'fct_gl_transactions'
        ? `Moving ${(manifest.tables[t].rows / 1e6).toFixed(1)} million GL lines into your browser…`
        : `Loading ${t.replace(/^(fct_|dim_|stg_)/, '').replaceAll('_', ' ')}…`
      onProgress(label, this.downloadFraction(done, totalBytes), done, totalBytes)
      let resp: Response
      try {
        resp = await fetch(dataURL(`${t}.parquet`))
      } catch {
        throw new Error(`__datafetch__:${t}:network`)
      }
      if (!resp.ok) throw new Error(`__datafetch__:${t}:${resp.status}`)
      let buf: Uint8Array
      try {
        buf = await this.readResponse(resp, manifest.tables[t].bytes, done, totalBytes, label, onProgress)
      } catch (error) {
        if (String(error).includes('__datafetch__')) throw error
        throw new Error(`__datafetch__:${t}:network`)
      }
      this.buffers.set(t, buf)
      await this.registerTable(t, buf)
      done += buf.byteLength
    }
    onProgress('Ready.', 1, done, totalBytes)
  }

  private downloadFraction(loadedBytes: number, totalBytes: number): number {
    return Math.min(0.95, 0.05 + 0.9 * (loadedBytes / Math.max(totalBytes, 1)))
  }

  private async readResponse(
    response: Response,
    expectedBytes: number,
    completedBytes: number,
    totalBytes: number,
    label: string,
    onProgress: Progress,
  ): Promise<Uint8Array> {
    if (!response.body) {
      const buffer = new Uint8Array(await response.arrayBuffer())
      if (expectedBytes > 0 && buffer.byteLength !== expectedBytes) throw new Error('__datafetch__:short-read')
      onProgress(label, this.downloadFraction(completedBytes + buffer.byteLength, totalBytes), completedBytes + buffer.byteLength, totalBytes)
      return buffer
    }

    const reader = response.body.getReader()
    let buffer = new Uint8Array(Math.max(0, expectedBytes))
    let received = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value?.byteLength) continue
      if (received + value.byteLength > buffer.byteLength) {
        const grown = new Uint8Array(Math.max(received + value.byteLength, Math.max(1024, buffer.byteLength * 2)))
        grown.set(buffer.subarray(0, received))
        buffer = grown
      }
      buffer.set(value, received)
      received += value.byteLength
      onProgress(label, this.downloadFraction(completedBytes + received, totalBytes), completedBytes + received, totalBytes)
    }
    if (expectedBytes > 0 && received !== expectedBytes) throw new Error('__datafetch__:short-read')
    return received === buffer.byteLength ? buffer : buffer.slice(0, received)
  }

  private async resetFailedBoot(): Promise<void> {
    const db = this.db
    this.db = null
    this.conn = null
    this.manifest = null
    this.buffers.clear()
    try { await db?.terminate() } catch { /* preserve the original boot error */ }
  }

  private async startWorker() {
    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES)
    const worker = new Worker(bundle.mainWorker!)
    const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker)
    // Own the worker before instantiate() so a rejected boot can always terminate it.
    this.db = db
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
    this.conn = await db.connect()
    // Parquet is a dynamic DuckDB-Wasm extension. Keep it first-party so a
    // blocked or unavailable public extension CDN cannot strand a cold start.
    const extensionRepository = `${location.origin}/duckdb-extensions`
    await this.conn.query(`SET custom_extension_repository = '${extensionRepository.replaceAll("'", "''")}'`)
    await this.conn.query(`SET autoinstall_extension_repository = '${extensionRepository.replaceAll("'", "''")}'`)
    await this.conn.query(`LOAD parquet`)
    try {
      await this.conn.query(`SET memory_limit = '1GB'`)
    } catch { /* best-effort in WASM */ }
  }

  private async registerTable(name: string, buf: Uint8Array) {
    // registerFileBuffer TRANSFERS the ArrayBuffer into the worker (detaching it),
    // so always hand over a copy — the cached original must stay usable for restart().
    await this.db!.registerFileBuffer(`${name}.parquet`, buf.slice())
    await this.conn!.query(`CREATE OR REPLACE VIEW ${name} AS SELECT * FROM parquet_scan('${name}.parquet')`)
  }

  /** Kill and rebuild the worker (runaway query recovery). Buffers re-register from memory. */
  async restart(): Promise<void> {
    if (this.restarting) return this.restarting
    this.restarting = this.performRestart()
    try {
      await this.restarting
    } finally {
      this.restarting = null
    }
  }

  private async performRestart(): Promise<void> {
    const db = this.db
    this.db = null
    this.conn = null
    try { await db?.terminate() } catch { /* already dead */ }
    await this.startWorker()
    for (const [name, buf] of this.buffers) await this.registerTable(name, buf)
  }

  /** Run a query for DISPLAY: capped rows, timeout watchdog, cancel support. */
  async runDisplay(sql: string, signal?: AbortSignal): Promise<QueryResult> {
    const hook = typeof window !== 'undefined' ? window.__pivotDisplayHook : undefined
    if (hook) return hook(sql, signal, () => this.runDisplayDirect(sql, signal))
    return this.runDisplayDirect(sql, signal)
  }

  private async runDisplayDirect(sql: string, signal?: AbortSignal): Promise<QueryResult> {
    if (signal?.aborted) throw new Error('__cancelled__')
    if (!this.conn) throw new Error('engine not ready')
    const conn = this.conn
    guardUserSQL(stripTrailingSemicolon(sql))
    const start = performance.now()
    const wrapped = `SELECT * FROM (\n${stripTrailingSemicolon(sql)}\n) __display LIMIT ${DISPLAY_LIMIT + 1}`

    let timedOut = false
    let aborted = false
    const exec = conn.query(wrapped)
    let timeout: ReturnType<typeof setTimeout> | null = null
    let onAbort: (() => void) | null = null
    let cleaned = false
    const cleanupWatchdog = () => {
      if (cleaned) return
      cleaned = true
      if (timeout !== null) {
        clearTimeout(timeout)
        timeout = null
      }
      if (signal && onAbort) {
        signal.removeEventListener('abort', onAbort)
        onAbort = null
      }
    }
    const watchdog = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => { timedOut = true; reject(new Error('__timeout__')) }, QUERY_TIMEOUT_MS)
      onAbort = () => {
        if (timeout !== null) clearTimeout(timeout)
        aborted = true
        reject(new Error('__cancelled__'))
      }
      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true })
        // An abort can happen between the early check above and listener
        // registration. Re-check after registration so a caller-retained
        // signal cannot leave this query running without cancellation.
        if (signal.aborted) onAbort()
      }
    })

    let table: Awaited<typeof exec>
    try {
      table = await Promise.race([exec, watchdog])
    } catch (e) {
      if (timedOut || aborted) {
        // Remove the caller's listener before recovery so a retained signal
        // cannot accumulate one closure per completed or cancelled query.
        cleanupWatchdog()
        // the friendly message must reach her even if the restart itself hiccups
        try { await this.restart() } catch { /* reload remains the last resort */ }
        throw new Error(timedOut ? '__timeout__' : '__cancelled__')
      }
      throw e
    } finally {
      cleanupWatchdog()
    }

    const elapsedMs = performance.now() - start
    const columns = table.schema.fields.map((f) => f.name)
    const types = table.schema.fields.map((f) => String(f.type))
    const rows: unknown[][] = []
    for (const batch of table.batches) {
      const cols = columns.map((_, i) => batch.getChildAt(i))
      for (let r = 0; r < batch.numRows; r++) {
        rows.push(cols.map((c, i) => cellToJS(c?.get(r), types[i])))
        if (rows.length > DISPLAY_LIMIT) break
      }
      if (rows.length > DISPLAY_LIMIT) break
    }
    const truncated = rows.length > DISPLAY_LIMIT
    if (truncated) rows.length = DISPLAY_LIMIT
    return { columns, types, rows, rowCount: rows.length, totalRowCount: null, elapsedMs, truncated }
  }

  /** Run a read-only raw query (catalog previews/counts) and return arrow-ish rows. */
  async runRaw(sql: string): Promise<RawQueryResult> {
    const hook = typeof window !== 'undefined' ? window.__pivotRawHook : undefined
    if (hook) return hook(sql, () => this.runRawDirect(sql))
    return this.runRawDirect(sql)
  }

  private async runRawDirect(sql: string): Promise<RawQueryResult> {
    guardUserSQL(stripTrailingSemicolon(sql))
    return this.runInternal(sql)
  }

  /** Internal grading lane; never expose this mutating capability on window.__engine. */
  async runInternal(sql: string): Promise<{ columns: string[]; types: string[]; rows: unknown[][] }> {
    if (!this.conn) throw new Error('engine not ready')
    const exec = this.conn.query(sql)
    let timedOut = false
    const watchdog = new Promise<never>((_, reject) => {
      const t = setTimeout(() => { timedOut = true; reject(new Error('__timeout__')) }, QUERY_TIMEOUT_MS)
      exec.catch(() => {}).finally(() => clearTimeout(t))
    })
    let table: Awaited<typeof exec>
    try {
      table = await Promise.race([exec, watchdog])
    } catch (e) {
      if (timedOut) {
        try { await this.restart() } catch { /* reload remains the last resort */ }
        throw new Error('__timeout__')
      }
      throw e
    }
    const columns = table.schema.fields.map((f) => f.name)
    const types = table.schema.fields.map((f) => String(f.type))
    const rows: unknown[][] = []
    for (const batch of table.batches) {
      const cols = columns.map((_, i) => batch.getChildAt(i))
      for (let r = 0; r < batch.numRows; r++) rows.push(cols.map((c, i) => cellToJS(c?.get(r), types[i])))
    }
    return { columns, types, rows }
  }

  /** A boolean-only diagnostic keeps tests honest without exposing DuckDB handles or buffers. */
  isCold(): boolean {
    return this.db === null && this.conn === null && this.manifest === null && this.buffers.size === 0 && this.booting === null
  }
}

export function stripTrailingSemicolon(sql: string): string {
  // Find the last real SQL character with a tiny lexer. Regex-only trimming
  // corrupts valid values such as 'abc--def' by mistaking text inside quotes
  // for a trailing analyst comment.
  let lastCodeEnd = 0
  let inS = false, inD = false, inDollar = false, inLine = false, inBlock = false
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i], n = sql[i + 1]
    if (inLine) {
      if (c === '\n') inLine = false
      continue
    }
    if (inBlock) {
      if (c === '*' && n === '/') { inBlock = false; i++ }
      continue
    }
    if (inDollar) {
      lastCodeEnd = i + 1
      if (c === '$' && n === '$') { lastCodeEnd = i + 2; inDollar = false; i++ }
      continue
    }
    if (inS) {
      lastCodeEnd = i + 1
      if (c === "'") {
        if (n === "'") { lastCodeEnd = i + 2; i++ } else inS = false
      }
      continue
    }
    if (inD) {
      lastCodeEnd = i + 1
      if (c === '"') {
        if (n === '"') { lastCodeEnd = i + 2; i++ } else inD = false
      }
      continue
    }
    if (c === "'") { inS = true; lastCodeEnd = i + 1; continue }
    if (c === '"') { inD = true; lastCodeEnd = i + 1; continue }
    if (c === '$' && n === '$') { inDollar = true; lastCodeEnd = i + 2; i++; continue }
    if (c === '-' && n === '-') { inLine = true; i++; continue }
    if (c === '/' && n === '*') { inBlock = true; i++; continue }
    if (!/\s/.test(c) && c !== ';') lastCodeEnd = i + 1
  }
  // An unterminated block comment is invalid SQL, not removable trailing trivia.
  if (inBlock) return sql.trimEnd()
  return sql.slice(0, lastCodeEnd)
}

/**
 * Safety gate for user SQL. Throws typed markers the error translator turns warm:
 * - '__multistatement__' when a top-level ';' would smuggle a second statement past
 *   the display/grading wrappers (the injection escape found in round-1 bug hunt)
 * - '__readonly__' for write/DDL/config statements — the warehouse is read-only,
 *   exactly like the one she'll have at work.
 * - '__smartquotes__' when Notes/Docs changed SQL delimiters into curly quotes.
 */
export function guardUserSQL(sql: string): void {
  // scan for a top-level ';' with real content after it (string/comment/$$-aware)
  let inS = false, inD = false, inLine = false, inBlock = false, inDollar = false
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i], n = sql[i + 1]
    if (inLine) { if (c === '\n') inLine = false; continue }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++ } continue }
    if (inDollar) { if (c === '$' && n === '$') { inDollar = false; i++ } continue }
    if (inS) { if (c === "'") { if (n === "'") i++; else inS = false } continue }
    if (inD) { if (c === '"') { if (n === '"') i++; else inD = false } continue }
    if (c === "'") { inS = true; continue }
    if (c === '"') { inD = true; continue }
    if (c === '$' && n === '$') { inDollar = true; i++; continue }
    if (c === '-' && n === '-') { inLine = true; i++; continue }
    if (c === '/' && n === '*') { inBlock = true; i++; continue }
    // Curly apostrophes are valid text *inside* a straight-quoted SQL string.
    // Outside strings/comments, though, they are almost certainly smart-quote
    // delimiters pasted from Notes/Docs and DuckDB's parser message is hostile.
    if (/[‘’“”]/.test(c)) throw new Error('__smartquotes__')
    if (c === ';') {
      // a trailing comment after the final ';' is normal analyst annotation, not a second statement
      const rest = sql.slice(i + 1)
        .replace(/--[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/[;\s]+/g, '')
      if (rest.length > 0) throw new Error('__multistatement__')
    }
  }
  // first meaningful token must be a read statement
  const stripped = sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim()
  if (/^(create|drop|insert|update|delete|alter|truncate|attach|detach|copy|export|import|install|load|set|reset|pragma|call|begin|commit|rollback|vacuum|checkpoint|use)\b/i.test(stripped)) {
    throw new Error('__readonly__')
  }
}

function cellToJS(v: unknown, type?: string): unknown {
  if (v === null || v === undefined) return null
  // Arrow hands temporal/decimal values back in raw physical form — convert by TYPE
  // (round-1 P0: epoch-ms dates; round-2 P1: unscaled decimals).
  if (type && /(Date|Timestamp)/i.test(type) && (typeof v === 'number' || typeof v === 'bigint')) {
    return new Date(Number(v))
  }
  if (type && /Decimal/i.test(type)) {
    // Arrow Decimal is an unscaled big number; the type string carries the scale,
    // e.g. "Decimal[18e+2]" → divide by 10^2 or "1.5 * 2" reads as 30.
    const m = type.match(/e([+-]?\d+)\]?\s*$/)
    const scale = m ? Number(m[1]) : 0
    const unscaled = typeof v === 'object' && v !== null ? Number((v as { toString(): string }).toString()) : Number(v)
    return unscaled / Math.pow(10, scale)
  }
  if (type && /^Time(32|64)/i.test(type) && (typeof v === 'number' || typeof v === 'bigint')) {
    // micros (Time64) / millis (Time32) since midnight → HH:MM:SS
    const totalSec = Math.floor(Number(v) / (/64/.test(type) ? 1e6 : 1e3))
    const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0')
    const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0')
    const ss = String(totalSec % 60).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  }
  if (type && /Interval/i.test(type)) {
    const arr = typeof v === 'object' && v !== null && 'toArray' in (v as object)
      ? Array.from((v as { toArray: () => number[] }).toArray())
      : Array.isArray(v) ? (v as number[])
        : ArrayBuffer.isView(v) ? Array.from(v as unknown as number[]) : null
    if (arr) {
      const [months = 0, days = 0] = arr.map(Number)
      const parts: string[] = []
      if (months) parts.push(`${months} month${months === 1 ? '' : 's'}`)
      if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`)
      return parts.join(' ') || '0 days'
    }
    return String(v)
  }
  if (typeof v === 'bigint') return Number.isSafeInteger(Number(v)) ? Number(v) : v.toString()
  if (v instanceof Date) return v
  if (typeof v === 'object' && v !== null && 'toArray' in (v as Record<string, unknown>)) {
    return Array.from((v as { toArray: () => unknown[] }).toArray())
  }
  return v
}

export const engine = new Engine()

// Test/diagnostic hook: expose only read-only query, display, and restart
// operations. Grading keeps its temporary-table capability on the module-owned
// engine and cannot be reached through the browser console surface.
interface EngineTestSurface {
  isCold: () => boolean
  runDisplay: (sql: string, signal?: AbortSignal) => Promise<QueryResult>
  runRaw: (sql: string) => Promise<{ columns: string[]; types: string[]; rows: unknown[][] }>
  restart: () => Promise<void>
}

declare global {
  interface Window {
    __engine?: EngineTestSurface
    /** Test-only fault seams; they can delay/fail read-only calls but cannot access DuckDB handles. */
    __pivotRawHook?: (sql: string, proceed: () => Promise<RawQueryResult>) => Promise<RawQueryResult>
    __pivotDisplayHook?: (sql: string, signal: AbortSignal | undefined, proceed: () => Promise<QueryResult>) => Promise<QueryResult>
  }
}
if (typeof window !== 'undefined') {
  window.__engine = {
    isCold: engine.isCold.bind(engine),
    runDisplay: engine.runDisplay.bind(engine),
    runRaw: engine.runRaw.bind(engine),
    restart: engine.restart.bind(engine),
  }
}
