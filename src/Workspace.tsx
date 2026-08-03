import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { sql as sqlLang } from '@codemirror/lang-sql'
import { EditorView } from '@codemirror/view'
import { engine, type QueryResult } from './db'
import { translateError, type FriendlyError } from './errors'
import { gradeMission, type Verdict } from './grading'
import { DATA, PEOPLE, knownCampaignPulls, nextMission, type CompiledMission, type CompiledSim, type SimQuestion } from './missions'
import { COMMON_JOINS, TABLE_NOTES, TABLE_ORDER } from './schema-notes'
import { formatCell, fmtInt, fmtMs } from './format'
import { draftEntityId, type HintEvidence, type ProgressV2 } from './progress-store'
import { scenarioById, scenarioProgress } from './packs/parkline-fpa/scenarios'
import type { PivotSyncStatus } from './App'
import { TableSheet } from './TableSheet'
import { deskCrewAlt } from './characters/desk-crew'
import { CoachPanel, type CoachMoment } from './CoachPanel'
import { createAttemptReviewEvidence } from './kit/attempt-review'
import type { AttemptDeterministicVerdictV1, CoachVerdictV1 } from './kit/coaching-contract'
import type { Star67CoachMission } from './packs/parkline-fpa/coach-context'
import { DataWorkbook, type DataWorkbookHandle } from './workbook/DataWorkbook'
import { practiceCopy } from './kit/practice-copy'

interface Props {
  mission: CompiledMission | null
  simQuestion: SimQuestion | null
  simVariant: CompiledSim | null
  simStartedAt: number | null
  attemptId: string | null
  progress: ProgressV2
  runtimeLabel: string
  syncMode: 'local' | 'lan'
  syncStatus: PivotSyncStatus
  activeScenarioId: string | null
  onSolved: (id: string, sql: string, title: string, isSim: boolean, hintLevel: HintEvidence) => boolean
  onDraftChange: (questionId: string, attemptId: string | null, sql: string) => boolean
  onOpenDesk: () => void
  onNavigate: (id: string | null, sim?: boolean, newSimAttempt?: boolean, scenarioId?: string | null) => void
}

type RunState =
  | { kind: 'idle' }
  | { kind: 'running'; query: string }
  | { kind: 'done'; query: string; result: QueryResult; verdict: Verdict | null }
  | { kind: 'error'; query: string; error: FriendlyError }

interface RunEvidence {
  query: string
  isCurrent: boolean
}

interface NavigatorColumn {
  name: string
  type: string
}

interface NavigatorRelation {
  name: string
  objectType: string
  columns: NavigatorColumn[]
}

type NavigatorCatalogState =
  | { kind: 'loading' }
  | { kind: 'ready'; database: string; schema: string; relations: NavigatorRelation[] }
  | { kind: 'error'; message: string }

interface NavigatorPreviewResult {
  columns: string[]
  types: string[]
  rows: unknown[][]
}

interface WorkbenchResizeState {
  pointerId: number
  startY: number
  startHeight: number
}

type NavigatorPreviewState =
  | { kind: 'loading' }
  | { kind: 'ready'; result: NavigatorPreviewResult }
  | { kind: 'error' }

const NAVIGATOR_HELPER = 'One warehouse, 12 tables. Open a table to inspect its columns and sample rows.'
const NAVIGATOR_RUNTIME_DETAIL = 'The warehouse runs here and stays on this device.'
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
const NAVIGATOR_WIDTH_KEY = 'pivot.navigatorWidth.v1'
const NAVIGATOR_MIN_WIDTH = 270
const NAVIGATOR_MAX_WIDTH = 560
const SHEET_ROW_LIMIT = 200
const WAREHOUSE_SHEET_HEIGHT_KEY = 'pivot.warehouseWorkbenchSheetHeight.v1'
const WAREHOUSE_SHEET_DEFAULT_HEIGHT = 420
const WAREHOUSE_SHEET_MIN_HEIGHT = 380
const WAREHOUSE_SHEET_MAX_HEIGHT = 720
// The task pane already scrolls internally. Preserve enough of it to keep the
// ask/editor reachable while giving the workbook a genuinely usable canvas on
// a 1280×720 laptop instead of collapsing the relationship viewport to zero.
const WAREHOUSE_TASK_MIN_HEIGHT = 180
const WAREHOUSE_RESIZER_HEIGHT = 12

const EXPLORE_CHIPS = [
  { label: 'Our 5 biggest vendors by lifetime spend', sql: `SELECT v.vendor_name, round(sum(g.amount), 2) AS lifetime_spend\nFROM fct_gl_transactions g\nJOIN dim_vendor v ON g.vendor_id = v.vendor_id\nGROUP BY v.vendor_name\nORDER BY lifetime_spend DESC\nLIMIT 5;` },
  { label: 'Headcount over time', sql: `SELECT payroll_month, count(*) AS headcount\nFROM fct_payroll_monthly\nGROUP BY payroll_month\nORDER BY payroll_month;` },
  { label: `Which industries buy ${DATA.company}?`, sql: `SELECT industry, count(*) AS customers\nFROM dim_customer\nGROUP BY industry\nORDER BY customers DESC;` },
]

export function Workspace({ mission, simQuestion, simVariant, simStartedAt, attemptId, progress, runtimeLabel, syncMode, syncStatus, activeScenarioId, onSolved, onDraftChange, onOpenDesk, onNavigate }: Props) {
  const active = mission ?? simQuestion
  const isSim = !!simQuestion
  const draftQuestionId = active?.id ?? 'explore'
  const draftAttemptId = isSim ? attemptId : null
  const draftId = draftEntityId(draftQuestionId, draftAttemptId)
  const [code, setCode] = useState('')
  const [run, setRun] = useState<RunState>({ kind: 'idle' })
  const [hintLevel, setHintLevel] = useState(0)
  const [solvedThis, setSolvedThis] = useState(false)
  const [navigatorOpenRelation, setNavigatorOpenRelation] = useState<string | null>(null)
  const [navigatorFilter, setNavigatorFilter] = useState('')
  const [navigatorDrawerOpen, setNavigatorDrawerOpen] = useState(false)
  const [navigatorCatalog, setNavigatorCatalog] = useState<NavigatorCatalogState>({ kind: 'loading' })
  const [navigatorPreviews, setNavigatorPreviews] = useState<Record<string, NavigatorPreviewState>>({})
  const [navigatorWidth, setNavigatorWidth] = useState(() => {
    try {
      const stored = localStorage.getItem(NAVIGATOR_WIDTH_KEY)
      const saved = stored === null ? Number.NaN : Number(stored)
      return Number.isFinite(saved) ? Math.min(NAVIGATOR_MAX_WIDTH, Math.max(NAVIGATOR_MIN_WIDTH, saved)) : 330
    } catch {
      return 330
    }
  })
  const [workbookOpen, setWorkbookOpen] = useState(false)
  const [workbookFocusMode, setWorkbookFocusMode] = useState(false)
  const [warehouseSheetPreferredHeight, setWarehouseSheetPreferredHeight] = useState(() => readWarehouseSheetHeight())
  const [warehouseSheetMaxHeight, setWarehouseSheetMaxHeight] = useState(WAREHOUSE_SHEET_MAX_HEIGHT)
  const warehouseSheetHeight = clampWarehouseSheetHeight(warehouseSheetPreferredHeight, warehouseSheetMaxHeight)
  const [simNow, setSimNow] = useState(Date.now)
  const cmRef = useRef<ReactCodeMirrorRef>(null)
  const deskButtonRef = useRef<HTMLButtonElement>(null)
  const navigatorButtonRef = useRef<HTMLButtonElement>(null)
  const navigatorPanelRef = useRef<HTMLElement>(null)
  const navigatorCloseRef = useRef<HTMLButtonElement>(null)
  const warehouseMapButtonRef = useRef<HTMLButtonElement>(null)
  const workbookRef = useRef<DataWorkbookHandle>(null)
  const runButtonRef = useRef<HTMLButtonElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const editorExitArmedRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const runSeqRef = useRef(0)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingDraftRef = useRef<{ questionId: string; attemptId: string | null; sql: string } | null>(null)
  const navigatorCatalogSeqRef = useRef(0)
  const navigatorPreviewSeqRef = useRef<Record<string, number>>({})
  const workbookOpenerRef = useRef<HTMLElement | null>(null)
  const workbenchRef = useRef<HTMLDivElement>(null)
  const workbenchTaskRef = useRef<HTMLDivElement>(null)
  const workbenchResizeRef = useRef<WorkbenchResizeState | null>(null)
  const runningRef = useRef(false)
  const runPhaseRef = useRef<'idle' | 'display' | 'grading'>('idle')
  const [draftStorageAvailable, setDraftStorageAvailable] = useState(true)
  const displayedRuntimeLabel = progress.storageAvailable && draftStorageAvailable
    ? runtimeLabel
    : 'Not saved across reloads'

  const loadNavigatorCatalog = useCallback(async () => {
    const request = ++navigatorCatalogSeqRef.current
    setNavigatorCatalog({ kind: 'loading' })
    try {
      const identity = await engine.runRaw(`
        SELECT current_database()::VARCHAR AS database_name,
               current_schema()::VARCHAR AS schema_name
      `)
      const relationResult = await engine.runRaw(`
        SELECT table_name::VARCHAR, table_type::VARCHAR
        FROM information_schema.tables
        WHERE table_catalog = current_database()
          AND table_schema = current_schema()
        ORDER BY table_name
      `)
      const columnResult = await engine.runRaw(`
        SELECT table_name::VARCHAR, column_name::VARCHAR, data_type::VARCHAR
        FROM information_schema.columns
        WHERE table_catalog = current_database()
          AND table_schema = current_schema()
        ORDER BY table_name, ordinal_position
      `)
      if (request !== navigatorCatalogSeqRef.current) return

      const database = String(identity.rows[0]?.[0] ?? '')
      const schema = String(identity.rows[0]?.[1] ?? '')
      if (!database || !schema) throw new Error('DuckDB did not return its catalog identity')

      const liveRelations = new Map<string, string>()
      for (const row of relationResult.rows) liveRelations.set(String(row[0]), String(row[1]).toUpperCase())
      const columns = new Map<string, NavigatorColumn[]>()
      for (const row of columnResult.rows) {
        const table = String(row[0])
        const list = columns.get(table) ?? []
        list.push({ name: String(row[1]), type: String(row[2]) })
        columns.set(table, list)
      }

      const relations = TABLE_ORDER.map((name) => {
        const objectType = liveRelations.get(name)
        if (!objectType) throw new Error(`DuckDB is missing ${name}`)
        if (objectType !== 'VIEW') throw new Error(`${name} is ${objectType}, not a read-only view`)
        const relationColumns = columns.get(name) ?? []
        if (relationColumns.length === 0) throw new Error(`DuckDB returned no columns for ${name}`)
        return { name, objectType, columns: relationColumns }
      })
      if (liveRelations.size !== 12) throw new Error(`Expected 12 live relations, found ${liveRelations.size}`)
      if (relations.length !== 12) throw new Error(`Expected 12 training views, found ${relations.length}`)
      setNavigatorCatalog({ kind: 'ready', database, schema, relations })
    } catch (error) {
      if (request !== navigatorCatalogSeqRef.current) return
      setNavigatorCatalog({
        kind: 'error',
        message: `Database objects are unavailable. ${String((error as Error).message ?? error)}`,
      })
    }
  }, [])

  useEffect(() => {
    void loadNavigatorCatalog()
    return () => { navigatorCatalogSeqRef.current += 1 }
  }, [loadNavigatorCatalog])

  const closeNavigatorDrawer = useCallback((restoreOpener = true) => {
    setNavigatorDrawerOpen(false)
    if (restoreOpener) requestAnimationFrame(() => navigatorButtonRef.current?.focus())
  }, [])

  useEffect(() => {
    if (!navigatorDrawerOpen) return
    const panel = navigatorPanelRef.current
    if (!panel) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => navigatorCloseRef.current?.focus())

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeNavigatorDrawer()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((element) => element.getClientRects().length > 0
          && !(element.tagName !== 'SUMMARY' && element.closest('details:not([open])')))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    panel.addEventListener('keydown', onKeyDown)
    return () => {
      panel.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [closeNavigatorDrawer, navigatorDrawerOpen])

  const focusAfterEditor = useCallback(() => {
    if (runButtonRef.current && !runButtonRef.current.disabled) {
      runButtonRef.current.focus()
    } else if (cancelButtonRef.current && !cancelButtonRef.current.disabled) {
      cancelButtonRef.current.focus()
    } else {
      // Blank SQL has no enabled action after the editor. Wrap to the stable
      // workspace control instead of swallowing Tab on a disabled Run button.
      deskButtonRef.current?.focus()
    }
  }, [])

  // WebKit releases focus to the document as soon as Escape leaves CodeMirror,
  // so the following Tab no longer reaches the editor's own keymap. Capture that
  // one armed Tab at the document boundary and land on the visible Run control.
  useEffect(() => {
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (!editorExitArmedRef.current) return
      if (event.key === 'Tab') {
        event.preventDefault()
        event.stopPropagation()
        editorExitArmedRef.current = false
        focusAfterEditor()
      } else if (event.key !== 'Escape') {
        editorExitArmedRef.current = false
      }
    }
    const disarm = () => { editorExitArmedRef.current = false }
    document.addEventListener('keydown', onDocumentKeyDown, true)
    document.addEventListener('pointerdown', disarm, true)
    return () => {
      document.removeEventListener('keydown', onDocumentKeyDown, true)
      document.removeEventListener('pointerdown', disarm, true)
    }
  }, [focusAfterEditor])

  const completedPulls = useMemo(() => knownCampaignPulls(progress.pulls), [progress.pulls])
  const alreadyDelivered = !!active && (isSim ? !!progress.simDone[active.id] : !!completedPulls[active.id])
  // A completed set can be retaken. Historical progress should keep the set in
  // the Desk history, but a fresh blank attempt is not delivered until this
  // attempt's query passes again.
  const showDelivered = isSim ? solvedThis : alreadyDelivered
  // Attempt identity belongs in the key: Retake can start while q1 is already
  // mounted, and question ID alone would leave its in-memory answer intact.
  const activeKey = active
    ? (isSim ? `sim:${active.id}:attempt:${attemptId ?? 'none'}` : `mission:${active.id}`)
    : 'explore'
  const activeKeyRef = useRef(activeKey)
  // Invalidate an older async closure during the render that changes focus;
  // waiting for an effect leaves a small window where the old mission can paint.
  if (activeKeyRef.current !== activeKey) {
    abortRef.current?.abort()
    abortRef.current = null
    activeKeyRef.current = activeKey
    runSeqRef.current += 1
    runningRef.current = false
    runPhaseRef.current = 'idle'
  }

  // load draft / prefill when the focus changes
  useEffect(() => {
    const saved = progress.drafts[draftId]?.sql ?? null
    const prefill = mission?.prefill ?? null
    setCode(saved ?? prefill ?? '')
    setRun({ kind: 'idle' })
    setHintLevel(0)
    // A completed screen opened via “Retake” is a new timed attempt. Completed
    // learning asks remain reference views when reopened from Your Pulls.
    setSolvedThis(isSim ? false : alreadyDelivered)
  }, [activeKey])

  // One count-up clock spans the entire audition attempt. Deriving elapsed
  // time from the attempt timestamp also stays truthful when a background tab
  // throttles interval callbacks.
  useEffect(() => {
    if (!isSim || simStartedAt === null) return
    setSimNow(Date.now())
    const t = setInterval(() => setSimNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [isSim, simStartedAt])

  const simSeconds = simStartedAt === null ? 0 : Math.max(0, Math.floor((simNow - simStartedAt) / 1000))

  const flushDraft = useCallback(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = null
    const pending = pendingDraftRef.current
    pendingDraftRef.current = null
    if (!pending) return
    if (!onDraftChange(pending.questionId, pending.attemptId, pending.sql)) setDraftStorageAvailable(false)
  }, [onDraftChange])

  const persistDraft = useCallback((v: string) => {
    setCode(v)
    pendingDraftRef.current = { questionId: draftQuestionId, attemptId: draftAttemptId, sql: v }
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(flushDraft, 400)
  }, [draftAttemptId, draftQuestionId, flushDraft])

  useEffect(() => () => {
    abortRef.current?.abort()
    flushDraft()
  }, [activeKey, flushDraft])

  useEffect(() => {
    const onPageHide = () => flushDraft()
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [flushDraft])

  const doRun = useCallback(async () => {
    const sql = code.trim()
    if (!sql || runningRef.current) return
    runningRef.current = true
    runPhaseRef.current = 'display'
    const runSeq = ++runSeqRef.current
    const runKey = activeKeyRef.current
    const controller = new AbortController()
    const belongsToCurrentAsk = () => runSeq === runSeqRef.current && runKey === activeKeyRef.current
    const canCommit = () => belongsToCurrentAsk() && !controller.signal.aborted
    setRun({ kind: 'running', query: sql })
    abortRef.current = controller
    try {
      const result = await engine.runDisplay(sql, controller.signal)
      if (!canCommit()) return
      let verdict: Verdict | null = null
      if (active && !solvedThis) {
        runPhaseRef.current = 'grading'
        try {
          verdict = await gradeMission(sql, active as CompiledMission)
        } catch {
          verdict = {
            kind: 'unavailable',
            message: `Your query ran and the result is below, but Star67 couldn't check it this time. Run it once more; if this repeats, reload the page — your draft is saved.`,
          }
        }
        if (!canCommit()) return
        if (verdict?.kind === 'correct') {
          const recorded = onSolved(
            active.id,
            sql,
            (active as CompiledMission).title ?? (active as SimQuestion).ask,
            isSim,
            isSim ? 0 : hintLevel,
          )
          if (recorded) {
            setSolvedThis(true)
          } else {
            verdict = {
              kind: 'unavailable',
              message: 'Your query is correct, but Star67 could not save it to this practice attempt. Return to Your desk and start the practice again; your draft is still here.',
            }
          }
        }
      }
      if (canCommit()) setRun({ kind: 'done', query: sql, result, verdict })
    } catch (e) {
      if (belongsToCurrentAsk()) {
        setRun({ kind: 'error', query: sql, error: translateError(String((e as Error).message ?? e), sql) })
      }
    } finally {
      if (belongsToCurrentAsk()) {
        runningRef.current = false
        runPhaseRef.current = 'idle'
        if (abortRef.current === controller) abortRef.current = null
      }
    }
  }, [code, active, solvedThis, isSim, hintLevel, onSolved])

  const cancel = useCallback(() => {
    const controller = abortRef.current
    if (!controller || run.kind !== 'running') return
    controller.abort()
    // Display cancellation waits for the engine's safe restart. Grading cannot
    // be interrupted inside DuckDB, so invalidate it immediately and let its
    // isolated temp tables finish harmlessly in the background.
    if (runPhaseRef.current === 'grading') {
      runningRef.current = false
      runPhaseRef.current = 'idle'
      setRun({ kind: 'error', query: run.query, error: translateError('__cancelled__', run.query) })
    }
  }, [run])

  const insertAtCursor = useCallback((text: string) => {
    const view = cmRef.current?.view
    if (!view) return
    const { from, to } = view.state.selection.main
    const before = from > 0 ? view.state.doc.sliceString(from - 1, from) : ''
    const after = to < view.state.doc.length ? view.state.doc.sliceString(to, to + 1) : ''
    const prefix = before && !/[\s(,.]/.test(before) ? ' ' : ''
    const suffix = after && !/[\s),.;]/.test(after) ? ' ' : ''
    const insertion = `${prefix}${text}${suffix}`
    view.dispatch({
      changes: { from, to, insert: insertion },
      selection: { anchor: from + insertion.length },
    })
    view.focus()
  }, [])

  const loadNavigatorPreview = useCallback(async (name: string) => {
    if (!TABLE_ORDER.some((table) => table === name)) return
    const request = (navigatorPreviewSeqRef.current[name] ?? 0) + 1
    navigatorPreviewSeqRef.current[name] = request
    setNavigatorPreviews((current) => ({ ...current, [name]: { kind: 'loading' } }))
    try {
      const quotedName = `"${name.replaceAll('"', '""')}"`
      const result = await engine.runRaw(`SELECT * FROM ${quotedName} LIMIT 3`)
      if (navigatorPreviewSeqRef.current[name] !== request) return
      setNavigatorPreviews((current) => ({ ...current, [name]: { kind: 'ready', result } }))
    } catch {
      if (navigatorPreviewSeqRef.current[name] !== request) return
      setNavigatorPreviews((current) => ({ ...current, [name]: { kind: 'error' } }))
    }
  }, [])

  const rememberWorkbookOpener = useCallback(() => {
    workbookOpenerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  }, [])

  const openWarehouseWorkbook = useCallback(() => {
    rememberWorkbookOpener()
    setNavigatorDrawerOpen(false)
    setWorkbookOpen(true)
    workbookRef.current?.openRelationships()
  }, [rememberWorkbookOpener])

  const openWorkbookRelation = useCallback((relation: NavigatorRelation) => {
    rememberWorkbookOpener()
    setNavigatorDrawerOpen(false)
    setWorkbookOpen(true)
    workbookRef.current?.openRelation(relation.name)
  }, [rememberWorkbookOpener])

  const closeWorkbook = useCallback(() => {
    setWorkbookFocusMode(false)
    setWorkbookOpen(false)
    const opener = workbookOpenerRef.current
    workbookOpenerRef.current = null
    requestAnimationFrame(() => {
      if (opener?.isConnected && opener.getClientRects().length > 0) opener.focus()
      else {
        const workbookButton = warehouseMapButtonRef.current
        if (workbookButton && workbookButton.getClientRects().length > 0) workbookButton.focus()
        else navigatorButtonRef.current?.focus()
      }
    })
  }, [])

  const loadWorkbookRelation = useCallback(async (relationId: string) => {
    if (!TABLE_ORDER.some((name) => name === relationId)) throw new Error('Unknown warehouse relation')
    const quotedName = `"${relationId.replaceAll('"', '""')}"`
    return engine.runRaw(`SELECT * FROM ${quotedName} LIMIT ${SHEET_ROW_LIMIT}`)
  }, [])

  const resizeWarehouseSheet = useCallback((height: number, maximum = warehouseSheetMaxHeight) => {
    const next = clampWarehouseSheetHeight(height, maximum)
    setWarehouseSheetPreferredHeight(next)
    try { localStorage.setItem(WAREHOUSE_SHEET_HEIGHT_KEY, String(next)) } catch { /* resizing still works for this tab */ }
  }, [warehouseSheetMaxHeight])

  useEffect(() => {
    const workbench = workbenchRef.current
    if (!workbench) return

    const reclamp = () => {
      const availableHeight = Math.floor(workbench.getBoundingClientRect().height)
      if (availableHeight <= 0) return
      const maximum = Math.max(
        WAREHOUSE_SHEET_MIN_HEIGHT,
        Math.min(
          WAREHOUSE_SHEET_MAX_HEIGHT,
          availableHeight - WAREHOUSE_TASK_MIN_HEIGHT - WAREHOUSE_RESIZER_HEIGHT,
        ),
      )
      setWarehouseSheetMaxHeight(maximum)
    }

    reclamp()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reclamp)
    observer?.observe(workbench)
    window.addEventListener('resize', reclamp)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', reclamp)
    }
  }, [])

  useEffect(() => () => {
    document.body.classList.remove('is-resizing-warehouse-sheet')
  }, [])

  useEffect(() => {
    const task = workbenchTaskRef.current
    if (!task) return
    if (workbookFocusMode) task.setAttribute('inert', '')
    else task.removeAttribute('inert')
  }, [workbookFocusMode])

  const startWarehouseSheetResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    workbenchResizeRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: warehouseSheetHeight,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    document.body.classList.add('is-resizing-warehouse-sheet')
  }, [warehouseSheetHeight])

  const moveWarehouseSheetResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const resize = workbenchResizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    resizeWarehouseSheet(resize.startHeight + resize.startY - event.clientY)
  }, [resizeWarehouseSheet])

  const finishWarehouseSheetResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (workbenchResizeRef.current?.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    workbenchResizeRef.current = null
    document.body.classList.remove('is-resizing-warehouse-sheet')
  }, [])

  const resizeWarehouseSheetWithKeyboard = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 40 : 10
    if (event.key === 'ArrowUp') resizeWarehouseSheet(warehouseSheetHeight + step)
    else if (event.key === 'ArrowDown') resizeWarehouseSheet(warehouseSheetHeight - step)
    else if (event.key === 'Home') resizeWarehouseSheet(WAREHOUSE_SHEET_MIN_HEIGHT)
    else if (event.key === 'End') resizeWarehouseSheet(warehouseSheetMaxHeight)
    else if (event.key === 'Enter' || event.key === ' ') resizeWarehouseSheet(WAREHOUSE_SHEET_DEFAULT_HEIGHT)
    else return
    event.preventDefault()
    event.stopPropagation()
  }, [resizeWarehouseSheet, warehouseSheetHeight, warehouseSheetMaxHeight])

  const resizeNavigator = useCallback((width: number) => {
    const clamped = Math.min(NAVIGATOR_MAX_WIDTH, Math.max(NAVIGATOR_MIN_WIDTH, Math.round(width)))
    setNavigatorWidth(clamped)
    try { localStorage.setItem(NAVIGATOR_WIDTH_KEY, String(clamped)) } catch { /* resizing still works for this tab */ }
  }, [])

  const startNavigatorResize = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const startWidth = navigatorWidth
    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)
    const move = (moveEvent: PointerEvent) => resizeNavigator(startWidth + moveEvent.clientX - startX)
    const stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      document.body.classList.remove('is-resizing-navigator')
    }
    document.body.classList.add('is-resizing-navigator')
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop, { once: true })
    window.addEventListener('pointercancel', stop, { once: true })
  }, [navigatorWidth, resizeNavigator])

  const insertFromNavigator = useCallback((text: string) => {
    insertAtCursor(text)
    // In the narrow drawer, the editor is now the intentional focus target.
    // Close without restoring the Data opener over CodeMirror's cursor.
    setNavigatorDrawerOpen(false)
  }, [insertAtCursor])

  // keyboard: cmd/ctrl+enter runs
  const runKeymap = useMemo(() => EditorView.domEventHandlers({
    keydown: (e) => {
      if (e.key === 'Escape') {
        editorExitArmedRef.current = true
        return false
      }
      if (e.key === 'Tab' && editorExitArmedRef.current) {
        e.preventDefault()
        editorExitArmedRef.current = false
        focusAfterEditor()
        return true
      }
      editorExitArmedRef.current = false
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); doRun(); return true }
      return false
    },
  }), [doRun, focusAfterEditor])

  const completedCount = Object.keys(completedPulls).length
  const globalNext = nextMission({ pulls: completedPulls })
  // Scenario identity is explicit navigation state. Mission IDs overlap between
  // workdays, so never infer a scenario from the current mission alone.
  const selectedScenario = !isSim ? scenarioById(activeScenarioId) : undefined
  const selectedScenarioProgress = selectedScenario ? scenarioProgress(selectedScenario, progress) : null
  const selectedScenarioPart = mission
    ? selectedScenarioProgress?.parts.find((part) => part.mission.id === mission.id)
    : undefined
  const activeScenario = selectedScenarioPart ? selectedScenario : undefined
  const activeScenarioProgress = selectedScenarioPart ? selectedScenarioProgress : null
  // Before a correct run is recorded, scenarioProgress.next is the current
  // mission. Only a different mission is a continuation; after the solve lands,
  // progress recomputes it to the next incomplete part. solvedThis covers the
  // same-render handoff if the parent progress update has not painted yet.
  const scenarioNext = activeScenarioProgress?.next
  const nextScenarioMission = scenarioNext && scenarioNext.id !== mission?.id
    ? scenarioNext
    : solvedThis && selectedScenarioPart
      ? activeScenarioProgress?.parts.find((part) => part.part > selectedScenarioPart.part && part.status !== 'done')?.mission ?? null
      : null
  const person = mission ? PEOPLE[mission.from] : null
  const activeTables = active?.tables ?? []
  const workbookRelations = useMemo(() => navigatorCatalog.kind === 'ready'
    ? navigatorCatalog.relations.map((relation) => ({
        id: relation.name,
        label: relation.name,
        objectType: relation.objectType,
        columns: relation.columns,
        totalRowCount: DATA.tableRows[relation.name] ?? 0,
      }))
    : [], [navigatorCatalog])
  const coachMission: Star67CoachMission | null = mission ?? (simQuestion
    ? {
        id: simQuestion.id,
        title: simVariant?.title ?? 'Live SQL screen',
        ask: simQuestion.ask,
        deliverable: simQuestion.deliverable,
        tables: simQuestion.tables,
      }
    : null)
  // Results and coaching evidence belong to the immutable query snapshot that
  // produced them, never to the editor's mutable current text.
  const runEvidence: RunEvidence | null = run.kind === 'idle'
    ? null
    : {
        query: run.query,
        isCurrent: run.query === code.trim(),
      }
  const coachVerdict: CoachVerdictV1 | null = run.kind === 'done' && run.verdict?.kind === 'correct'
    ? {
        status: 'correct',
        headline: 'The result matches the deliverable',
        detail: run.verdict.coaching,
      }
    : run.kind === 'done' && run.verdict?.kind === 'shape'
      ? {
          status: 'close',
          headline: 'The result shape differs from the deliverable',
          detail: run.verdict.message,
        }
      : run.kind === 'done' && run.verdict?.kind === 'wrong'
        ? {
            status: 'incorrect',
            headline: 'The result differs from the deliverable',
            detail: run.verdict.message,
          }
        : null
  const coachMoment: CoachMoment = run.kind === 'error'
    ? { kind: 'engine-error', engineError: run.error.raw }
    : coachVerdict
      ? { kind: 'verdict', verdict: coachVerdict }
      : { kind: 'idle' }
  const reviewVerdict: AttemptDeterministicVerdictV1 | null = run.kind === 'done'
    && run.verdict?.kind === 'unavailable'
    ? {
        status: 'unavailable',
        headline: 'The warehouse checker was unavailable',
        detail: run.verdict.message,
      }
    : coachVerdict
  const coachAttempt = run.kind === 'done'
    ? createAttemptReviewEvidence(run.result, reviewVerdict)
    : null

  return (
    <div
      className="workspace"
      data-run-evidence-state={runEvidence === null ? 'none' : runEvidence.isCurrent ? 'current' : 'stale'}
    >
      <header className="topbar">
        <div className="topbar-left">
          <span className="wordmark small">Star67</span>
          <span className="topbar-sub">{DATA.company} practice workspace</span>
        </div>
        <div className="topbar-right">
          <button
            ref={navigatorButtonRef}
            className="btn-ghost database-navigator__mobile-open"
            aria-label="Open database objects"
            aria-haspopup="dialog"
            aria-controls="database-navigator"
            aria-expanded={navigatorDrawerOpen}
            onClick={() => setNavigatorDrawerOpen(true)}
          >
            Data
          </button>
          <span className="topbar-runtime">{displayedRuntimeLabel}</span>
          {syncMode === 'lan' && (syncStatus.pendingCount > 0 || syncStatus.error || syncStatus.conflictCount > 0) && (
            <span className={`topbar-sync ${syncStatus.conflictCount > 0 ? 'topbar-sync--conflict' : ''}`} role="status">
              {syncStatus.conflictCount > 0
                ? `${syncStatus.conflictCount} draft conflict${syncStatus.conflictCount === 1 ? '' : 's'} need review`
                : 'Saved on this device, waiting for hosted sync'}
            </span>
          )}
          <span className="topbar-progress">
            {activeScenarioProgress
              ? `${activeScenarioProgress.completed} of ${activeScenarioProgress.total} tasks in this project`
              : completedCount === 0
                ? 'Your first task is ready'
                : `${completedCount} guided task${completedCount === 1 ? '' : 's'} complete`}
          </span>
          <button ref={deskButtonRef} className="btn-ghost" onClick={(event) => { event.currentTarget.focus(); onOpenDesk() }}>Your desk</button>
        </div>
      </header>

      {(!progress.storageAvailable || !draftStorageAvailable) && (
        <div className="storage-warning" role="status">
          This tab still works, but your browser isn't saving changes across reloads. Keep it open and copy any SQL you need.
        </div>
      )}

      <div className="columns">
        {navigatorDrawerOpen && (
          <button
            className="database-navigator__backdrop"
            aria-label="Close database objects"
            tabIndex={-1}
            onClick={() => closeNavigatorDrawer()}
          />
        )}
        <DatabaseNavigator
          panelRef={navigatorPanelRef}
          closeButtonRef={navigatorCloseRef}
          warehouseMapButtonRef={warehouseMapButtonRef}
          catalog={navigatorCatalog}
          filter={navigatorFilter}
          openRelation={navigatorOpenRelation}
          drawerOpen={navigatorDrawerOpen}
          activeTables={activeTables}
          previews={navigatorPreviews}
          width={navigatorWidth}
          onFilter={setNavigatorFilter}
          onRetryCatalog={loadNavigatorCatalog}
          onCloseDrawer={() => closeNavigatorDrawer()}
          onToggleRelation={(name) => {
            const next = navigatorOpenRelation === name ? null : name
            setNavigatorOpenRelation(next)
            if (next && !navigatorPreviews[name]) void loadNavigatorPreview(name)
          }}
          onRetryPreview={loadNavigatorPreview}
          onInsert={insertFromNavigator}
          onOpenSheet={openWorkbookRelation}
          onOpenWarehouseMap={openWarehouseWorkbook}
          onResizeStart={startNavigatorResize}
          onResize={(width) => resizeNavigator(width)}
        />

        <main className={`main${workbookFocusMode ? ' main--workbook-focus' : ''}`}>
          <h1 className="sr-only">Star67 SQL practice workspace</h1>
          <div
            ref={workbenchRef}
            className={`warehouse-workbench${workbookFocusMode ? ' warehouse-workbench--focus' : ''}`}
            data-workbook-focus={workbookFocusMode ? 'true' : 'false'}
            style={{ '--warehouse-sheet-height': `${warehouseSheetHeight}px` } as CSSProperties}
          >
            <div
              ref={workbenchTaskRef}
              className="warehouse-workbench__task"
              data-task-workspace="true"
              aria-hidden={workbookFocusMode || undefined}
              hidden={workbookFocusMode}
            >
              {active ? (
            <div className="ask-card">
              <div className="ask-card__directive">{isSim ? 'Screen brief' : 'Start here · Riff’s task'}</div>
              {activeScenario && selectedScenarioPart && activeScenarioProgress && (
                <div className="scenario-context" data-scenario-context={activeScenario.id}>
                  <span className="scenario-context-title">{activeScenario.title}</span>
                  <span className="scenario-context-progress">Part {selectedScenarioPart.part} of {activeScenarioProgress.total}</span>
                </div>
              )}
              <div className={`ask-byline ${isSim ? '' : 'ask-byline--character'}`.trim()}>
                {isSim ? (
                  <>
                    <span className="byline-name">The screen</span>
                    <span className="sim-timer">{Math.floor(simSeconds / 60)}:{String(simSeconds % 60).padStart(2, '0')}</span>
                  </>
                ) : (
                  <>
                    <span className="ask-byline__portrait-frame">
                      <img src={person!.portraitSrc} alt={deskCrewAlt(person!)} />
                    </span>
                    <span className="ask-byline__identity">
                      <span className="byline-name">{person!.name}</span>
                      <span className="byline-role">{person!.role}</span>
                    </span>
                  </>
                )}
                {!isSim && <span className="ask-title">· {(active as CompiledMission).title}</span>}
                {showDelivered && <span className="delivered-chip">✓ delivered</span>}
              </div>
              {isSim && simVariant && active.id === simVariant.questions[0]?.id && (
                <div className="sim-intro">
                  <div className="sim-intro-title">{practiceCopy(simVariant).label}</div>
                  <p>{practiceCopy(simVariant).intro}</p>
                </div>
              )}
              <div className="ask-body">{(isSim ? (active as SimQuestion).ask : (active as CompiledMission).ask).split('\n\n').map((p, i) => <p key={i}>{renderInline(p)}</p>)}</div>
              <div className="deliverable">
                <span className="deliverable-label">Deliver</span> {active.deliverable}
              </div>
              <p className="grading-contract">Use any aliases you like. Star67 checks the values, column count, rows, and requested order—not the answer key's column names.</p>
            </div>
          ) : (
            <div className="ask-card explore-card">
              <div className="ask-byline"><span className="byline-name">Explore {DATA.company}</span></div>
              <div className="ask-body">
                <p>
                  No ask selected — the whole warehouse is yours to poke at. Same editor, same data,
                  nothing you run here can break anything. Your saved queries and skill progress stay put while
                  you explore; reopen Your desk anytime and continue the last direction.
                </p>
                <div className="chips">
                  {EXPLORE_CHIPS.map((c) => (
                    <button key={c.label} className="chip" onClick={() => persistDraft(c.sql)}>{c.label}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="editor-block" onKeyDownCapture={(event) => { if (event.key === 'Escape') editorExitArmedRef.current = true }}>
            <CodeMirror
              key={activeKey}
              ref={cmRef}
              value={code}
              onChange={persistDraft}
              aria-label="SQL editor"
              extensions={[
                sqlLang(),
                runKeymap,
                EditorView.lineWrapping,
                EditorView.contentAttributes.of({ 'aria-label': 'SQL editor' }),
              ]}
              placeholder={isSim ? 'Type your query here — say your plan out loud first.' : active ? 'Type your query here — or start from a hint.' : 'SELECT …'}
              basicSetup={{ lineNumbers: true, foldGutter: false, autocompletion: false, highlightActiveLine: false }}
              className="editor"
            />
            <div className="editor-actions">
              <span className="editor-keyboard-hint">Esc, then Tab leaves the editor</span>
              <div className="editor-buttons">
                <button ref={runButtonRef} className="btn-primary" onClick={(event) => { if (event.detail < 2) doRun() }} disabled={!code.trim() || run.kind === 'running'}>
                  {run.kind === 'running' ? 'Running…' : <>Run <span className="kbd">⌘⏎</span></>}
                </button>
                {run.kind === 'running' && <button ref={cancelButtonRef} className="btn-cancel" onClick={cancel}>Cancel</button>}
              </div>
            </div>
          </div>

          <ResultsPanel
            run={run}
            delivered={showDelivered}
            mission={mission}
            simQuestion={simQuestion}
            onNext={() => {
              flushDraft()
              if (isSim) {
                const idx = simVariant?.questions.findIndex((q) => q.id === active!.id) ?? -1
                const nq = simVariant?.questions[idx + 1]
                // Clear the controlled editor in the same event as navigation.
                // WebKit can otherwise deliver the outgoing CodeMirror value
                // after the next question mounts and briefly re-save q1 as q2.
                setCode('')
                onNavigate(nq ? nq.id : null, !!nq)
              } else {
                if (activeScenario) {
                  if (nextScenarioMission) onNavigate(nextScenarioMission.id, false, false, activeScenario.id)
                  else onOpenDesk()
                } else {
                  onNavigate(globalNext && globalNext.id !== active?.id ? globalNext.id : null)
                }
              }
            }}
            nextLabel={isSim
              ? ((simVariant?.questions.findIndex((q) => q.id === active?.id) ?? -1) < (simVariant?.questions.length ?? 0) - 1 ? 'Next question' : 'Finish the screen')
              : activeScenario
                ? nextScenarioMission ? 'Next part' : 'Finish workday'
              : globalNext && globalNext.id !== active?.id ? 'Next ask' : 'Explore the warehouse'}
          />

          {coachMission && (
            <CoachPanel
              key={`coach:${activeKey}`}
              mission={coachMission}
              query={runEvidence?.query ?? code}
              moment={coachMoment}
              attempt={coachAttempt}
              attemptIsCurrent={runEvidence?.isCurrent ?? false}
              onGuidanceUsed={() => setHintLevel(1)}
            />
          )}
            </div>

            {workbookOpen && !workbookFocusMode && (
                <div
                  className="warehouse-workbench__resizer"
                  role="separator"
                  aria-label="Resize warehouse workbook"
                  aria-orientation="horizontal"
                  aria-controls="warehouse-workbench-sheet"
                  aria-valuemin={WAREHOUSE_SHEET_MIN_HEIGHT}
                  aria-valuemax={warehouseSheetMaxHeight}
                  aria-valuenow={warehouseSheetHeight}
                  aria-valuetext={`${warehouseSheetHeight} pixels high`}
                  tabIndex={0}
                  onPointerDown={startWarehouseSheetResize}
                  onPointerMove={moveWarehouseSheetResize}
                  onPointerUp={finishWarehouseSheetResize}
                  onPointerCancel={finishWarehouseSheetResize}
                  onLostPointerCapture={() => {
                    workbenchResizeRef.current = null
                    document.body.classList.remove('is-resizing-warehouse-sheet')
                  }}
                  onKeyDown={resizeWarehouseSheetWithKeyboard}
                  onDoubleClick={() => resizeWarehouseSheet(WAREHOUSE_SHEET_DEFAULT_HEIGHT)}
                >
                  <span aria-hidden="true" />
                </div>
            )}
            <div
              id="warehouse-workbench-sheet"
              className="warehouse-workbench__sheet"
              data-warehouse-workbench-sheet="true"
              hidden={!workbookOpen}
            >
              {workbookRelations.length > 0 && (
                <DataWorkbook
                  ref={workbookRef}
                  relations={workbookRelations}
                  tableNotes={TABLE_NOTES}
                  joins={COMMON_JOINS}
                  tableOrder={TABLE_ORDER}
                  loadRelation={loadWorkbookRelation}
                  formatCell={formatWarehouseSheetCell}
                  persistenceKey="pivot.parkline-fpa.workbook.v1"
                  title={`${DATA.company} workbook`}
                  focusMode={workbookFocusMode}
                  onFocusModeChange={setWorkbookFocusMode}
                  onDismiss={closeWorkbook}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function DatabaseNavigator({
  panelRef,
  closeButtonRef,
  warehouseMapButtonRef,
  catalog,
  filter,
  openRelation,
  drawerOpen,
  activeTables,
  previews,
  width,
  onFilter,
  onRetryCatalog,
  onCloseDrawer,
  onToggleRelation,
  onRetryPreview,
  onInsert,
  onOpenSheet,
  onOpenWarehouseMap,
  onResizeStart,
  onResize,
}: {
  panelRef: RefObject<HTMLElement>
  closeButtonRef: RefObject<HTMLButtonElement>
  warehouseMapButtonRef: RefObject<HTMLButtonElement>
  catalog: NavigatorCatalogState
  filter: string
  openRelation: string | null
  drawerOpen: boolean
  activeTables: string[]
  previews: Record<string, NavigatorPreviewState>
  width: number
  onFilter: (value: string) => void
  onRetryCatalog: () => void | Promise<void>
  onCloseDrawer: () => void
  onToggleRelation: (name: string) => void
  onRetryPreview: (name: string) => void | Promise<void>
  onInsert: (text: string) => void
  onOpenSheet: (relation: NavigatorRelation) => void
  onOpenWarehouseMap: () => void
  onResizeStart: (event: React.PointerEvent<HTMLButtonElement>) => void
  onResize: (width: number) => void
}) {
  const normalizedFilter = filter.trim().toLowerCase()
  const relations = catalog.kind === 'ready'
    ? catalog.relations.filter((relation) => relation.name.toLowerCase().includes(normalizedFilter)
      || relation.columns.some((column) => column.name.toLowerCase().includes(normalizedFilter)))
    : []
  const schema = catalog.kind === 'ready' ? catalog.schema : 'main'
  const catalogIdentity = catalog.kind === 'ready'
    ? `${catalog.database}.${catalog.schema}`
    : catalog.kind === 'loading' ? 'loading…' : 'unavailable'

  return (
    <>
    <aside
      id="database-navigator"
      ref={panelRef}
      className="database-navigator"
      data-drawer-open={drawerOpen ? 'true' : 'false'}
      role={drawerOpen ? 'dialog' : undefined}
      aria-modal={drawerOpen ? true : undefined}
      aria-labelledby="database-navigator-title"
      style={{ width, flexBasis: width }}
    >
      <div className="database-navigator__head">
        <div>
          <h2 id="database-navigator-title">Database objects</h2>
          <p>{fmtInt(DATA.totalRows)} rows available for practice</p>
        </div>
        <button ref={closeButtonRef} className="database-navigator__close" onClick={onCloseDrawer}>Close</button>
      </div>

      <div className="database-navigator__compute" aria-label="Warehouse status">
        <span>Warehouse status</span>
        <strong>Ready on this device</strong>
      </div>
      <nav className="database-navigator__breadcrumb" aria-label="Database hierarchy">
        <span>{DATA.company}</span><span aria-hidden="true">/</span>
        <span>Practice warehouse</span><span aria-hidden="true">/</span>
        <strong>{schema}</strong>
      </nav>
      <p className="database-navigator__technical">Local catalog · {catalogIdentity}</p>
      <p className="database-navigator__helper">{NAVIGATOR_HELPER}</p>

      {catalog.kind === 'loading' && <p className="database-navigator__state" role="status">Loading database objects…</p>}
      {catalog.kind === 'error' && (
        <div className="database-navigator__state database-navigator__state--error" role="alert">
          <p>{catalog.message}</p>
          <button onClick={() => { void onRetryCatalog() }}>Retry catalog</button>
        </div>
      )}
      {catalog.kind === 'ready' && (
        <>
          <div className="database-navigator__collection-head">
            <h3>Tables ({catalog.relations.length})</h3>
            <button
              ref={warehouseMapButtonRef}
              onClick={(event) => {
                event.currentTarget.focus()
                onOpenWarehouseMap()
              }}
            >
              See all fields
            </button>
          </div>
          <p className="database-navigator__view-count">{catalog.relations.length} tables · read only</p>
          <p className="database-navigator__runtime">{NAVIGATOR_RUNTIME_DETAIL}</p>
          <div className="database-filter">
            <label htmlFor="database-filter-input">Filter tables or columns</label>
            <div className="database-filter__control">
              <input
                id="database-filter-input"
                type="search"
                value={filter}
                placeholder="Table or column name"
                onChange={(event) => onFilter(event.target.value)}
              />
              {filter && <button aria-label="Clear database filter" onClick={() => onFilter('')}>Clear</button>}
            </div>
            <p aria-live="polite">{relations.length} of {catalog.relations.length} tables shown</p>
          </div>

          {relations.length === 0 ? (
            <p className="database-navigator__empty">No tables or columns match “{filter.trim()}”.</p>
          ) : (
            <ul className="database-relations">
              {relations.map((relation) => (
                <DatabaseRelation
                  key={relation.name}
                  relation={relation}
                  rows={DATA.tableRows[relation.name] ?? 0}
                  open={openRelation === relation.name}
                  usedInAsk={activeTables.includes(relation.name)}
                  filter={normalizedFilter}
                  preview={previews[relation.name]}
                  onToggle={() => onToggleRelation(relation.name)}
                  onRetryPreview={() => { void onRetryPreview(relation.name) }}
                  onInsert={onInsert}
                  onOpenSheet={() => onOpenSheet(relation)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </aside>
    <button
      className="database-navigator__resizer"
      role="separator"
      aria-label="Resize database objects panel"
      aria-orientation="vertical"
      aria-valuemin={NAVIGATOR_MIN_WIDTH}
      aria-valuemax={NAVIGATOR_MAX_WIDTH}
      aria-valuenow={width}
      title="Drag to resize · double-click to reset"
      onPointerDown={onResizeStart}
      onDoubleClick={() => onResize(330)}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 40 : 10
        if (event.key === 'ArrowLeft') { event.preventDefault(); onResize(width - step) }
        if (event.key === 'ArrowRight') { event.preventDefault(); onResize(width + step) }
        if (event.key === 'Home') { event.preventDefault(); onResize(NAVIGATOR_MIN_WIDTH) }
        if (event.key === 'End') { event.preventDefault(); onResize(NAVIGATOR_MAX_WIDTH) }
      }}
    />
    </>
  )
}

function DatabaseRelation({ relation, rows, open, usedInAsk, filter, preview, onToggle, onRetryPreview, onInsert, onOpenSheet }: {
  relation: NavigatorRelation
  rows: number
  open: boolean
  usedInAsk: boolean
  filter: string
  preview: NavigatorPreviewState | undefined
  onToggle: () => void
  onRetryPreview: () => void
  onInsert: (text: string) => void
  onOpenSheet: () => void
}) {
  const detailId = `database-relation-${relation.name}`
  const note = TABLE_NOTES[relation.name]
  const matchingColumns = filter && !relation.name.toLowerCase().includes(filter)
    ? relation.columns.filter((column) => column.name.toLowerCase().includes(filter)).map((column) => column.name)
    : []

  return (
    <li
      className={`database-relation ${open ? 'database-relation--open' : ''} ${usedInAsk ? 'database-relation--used' : ''}`}
      data-relation-name={relation.name}
      data-used-in-ask={usedInAsk ? 'true' : 'false'}
    >
      <button
        className="database-relation__toggle"
        data-relation-toggle
        aria-expanded={open}
        aria-controls={detailId}
        onClick={onToggle}
      >
        <span className="database-relation__identity">
          <span className="database-relation__type">View</span>
          <span className="database-relation__name">{relation.name}</span>
        </span>
        <span className="database-relation__meta">
          <span>{fmtInt(rows)} rows</span>
          {usedInAsk && <strong>Used in this ask</strong>}
        </span>
      </button>
      {matchingColumns.length > 0 && (
        <p className="database-relation__match">Matches column: {matchingColumns.join(', ')}</p>
      )}

      {open && (
        <div id={detailId} className="database-profile">
          <div className="database-profile__head">
            <h4>Table details</h4>
            <div className="database-profile__actions">
              <button
                className="database-profile__open-sheet"
                onClick={(event) => {
                  event.currentTarget.focus()
                  onOpenSheet()
                }}
              >
                Open sheet
              </button>
              <button aria-label={`Use table ${relation.name} in the editor`} onClick={() => onInsert(relation.name)}>Use table</button>
            </div>
          </div>
          <dl className="database-profile__facts">
            <div><dt>Object type</dt><dd>View</dd></div>
            <div><dt>Grain</dt><dd>{note?.grain ?? 'One warehouse record'}</dd></div>
          </dl>
          {note?.blurb && <p className="database-profile__blurb">{note.blurb}</p>}

          <section aria-labelledby={`${detailId}-columns`}>
            <h4 id={`${detailId}-columns`}>Columns ({relation.columns.length})</h4>
            <ul className="database-columns">
              {relation.columns.map((column) => {
                const description = note?.columns[column.name]
                return (
                  <li key={column.name}>
                    <button
                      aria-label={`Use column ${column.name} in the editor`}
                      title={description ? `${description} — use in the editor` : 'Use in the editor'}
                      onClick={() => onInsert(column.name)}
                    >
                      <span className="database-column__identity">
                        <span className="database-column__name">{column.name}</span>
                        <span className="database-column__type">{column.type}</span>
                      </span>
                      {description && <span className="database-column__description">{description}</span>}
                      <span className="database-column__action" aria-hidden="true">Use column</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="database-samples" aria-labelledby={`${detailId}-samples`}>
            <h4 id={`${detailId}-samples`}>Sample rows</h4>
            {(!preview || preview.kind === 'loading') && <p role="status">Loading sample rows…</p>}
            {preview?.kind === 'error' && (
              <div className="database-samples__error" role="alert">
                <p>Sample rows unavailable.</p>
                <button onClick={onRetryPreview}>Retry</button>
              </div>
            )}
            {preview?.kind === 'ready' && preview.result.rows.length === 0 && <p>No sample rows in this view.</p>}
            {preview?.kind === 'ready' && preview.result.rows.length > 0 && (
              <div className="sample-scroll">
                <table>
                  <thead><tr>{preview.result.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
                  <tbody>
                    {preview.result.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>{row.map((value, columnIndex) => (
                        <td key={columnIndex}>{(value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '—')).slice(0, 24)}</td>
                      ))}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </li>
  )
}

function formatWarehouseSheetCell(value: unknown) {
  if (value === null || value === undefined) return { text: 'NULL' }
  if (value instanceof Date) return { text: value.toISOString().slice(0, 10) }
  if (typeof value === 'number') return {
    text: Number.isInteger(value) ? String(value) : value.toLocaleString(undefined, { maximumFractionDigits: 4 }),
    num: true,
    neg: value < 0,
  }
  if (typeof value === 'bigint') return { text: value.toString(), num: true, neg: value < 0n }
  return { text: String(value) }
}

function readWarehouseSheetHeight(): number {
  try {
    const stored = localStorage.getItem(WAREHOUSE_SHEET_HEIGHT_KEY)
    const saved = stored === null ? Number.NaN : Number(stored)
    if (Number.isFinite(saved)) return clampWarehouseSheetHeight(saved, WAREHOUSE_SHEET_MAX_HEIGHT)
  } catch { /* use the explicit default */ }
  return WAREHOUSE_SHEET_DEFAULT_HEIGHT
}

function clampWarehouseSheetHeight(height: number, maximum: number): number {
  return Math.min(
    Math.max(WAREHOUSE_SHEET_MIN_HEIGHT, Math.round(maximum)),
    Math.max(WAREHOUSE_SHEET_MIN_HEIGHT, Math.round(height)),
  )
}

function ResultsPanel({ run, delivered, mission, simQuestion, onNext, nextLabel }: {
  run: RunState; delivered: boolean
  mission: CompiledMission | null; simQuestion: SimQuestion | null
  onNext: () => void; nextLabel: string
}) {
  const [showRaw, setShowRaw] = useState(false)
  if (run.kind === 'idle') {
    return <div className="results results-empty"><p>Results land here. {mission ? 'Read the ask, then Run.' : ''}</p></div>
  }
  if (run.kind === 'running') {
    return <div className="results results-empty"><p className="running-msg">Scanning the warehouse…</p></div>
  }
  if (run.kind === 'error') {
    const e = run.error
    return (
      <div className="results">
        <div className="verdict verdict-error">
          <div className="verdict-head">{e.headline}</div>
          <p>{e.detail}</p>
          <button
            className="disclosure"
            aria-expanded={showRaw}
            aria-controls="raw-engine-error"
            onClick={() => setShowRaw(!showRaw)}
          >{showRaw ? 'Hide' : 'What the engine actually said'}</button>
          <pre id="raw-engine-error" className="rawerror" hidden={!showRaw}>{e.raw}</pre>
        </div>
        {delivered && (mission || simQuestion) && (
          <div className="delivered-bar">
            <span>✓ Delivered — run anything you like here.</span>
            <button className="btn-primary btn-small" onClick={onNext}>{nextLabel} →</button>
          </div>
        )}
      </div>
    )
  }

  const { result, verdict } = run
  const active = mission ?? simQuestion
  return (
    <div className="results">
      {verdict?.kind === 'correct' && (
        <div className="verdict verdict-correct">
          <div className="verdict-head">✓ Your result matches the deliverable{mission ? ` — delivered to ${PEOPLE[mission.from].name.split(' ')[0]}` : ''}.</div>
          {mission?.successNote && <p>{mission.successNote}</p>}
          {verdict.coaching && <p className="coaching-note"><strong>One production guard:</strong> {verdict.coaching}</p>}
          {simQuestion && <p className="narration"><strong>How you'd say it in the room:</strong> {simQuestion.narration}</p>}
          {mission && <p className="sayit"><strong>Say it like an analyst:</strong> {mission.sayIt}</p>}
          {mission && <p className="saved-note">Query saved.</p>}
          <button className="btn-primary" onClick={onNext}>{nextLabel} →</button>
        </div>
      )}
      {delivered && (!verdict || verdict.kind !== 'correct') && (mission || simQuestion) && (
        <div className="delivered-bar">
          <span>✓ Delivered — run anything you like here.</span>
          <button className="btn-primary btn-small" onClick={onNext}>{nextLabel} →</button>
        </div>
      )}
      {verdict?.kind === 'unavailable' && !delivered && (
        <div className="verdict verdict-error">
          <div className="verdict-head">The answer checker hiccupped — this is Star67, not your SQL.</div>
          <p>{verdict.message}</p>
        </div>
      )}
      {verdict && verdict.kind !== 'correct' && verdict.kind !== 'unavailable' && !delivered && (
        <div className="verdict verdict-wrong">
          <div className="verdict-head">Not it yet — but you ran clean SQL, and here's the trail:</div>
          <p>{verdict.message}</p>
        </div>
      )}
      <TableSheet
        result={result}
        title={mission ? `${mission.title} result` : simQuestion ? 'Practice result' : 'Query result'}
        variant="embedded"
        formatCell={formatCell}
        emptyMessage="Zero rows — not an error, just nothing matched. Check the date range for the table you queried; text filters match exactly, including capitalization."
      />
    </div>
  )
}

/** minimal inline renderer: `code spans` in ask copy */
function renderInline(text: string) {
  const parts = text.split(/(SELECT[^;]*;|`[^`]+`)/g)
  return parts.map((p, i) => {
    if (p.startsWith('SELECT') && p.endsWith(';') && p.includes('\n')) return <pre key={i} className="ask-code">{p}</pre>
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>
    return <span key={i}>{p}</span>
  })
}
