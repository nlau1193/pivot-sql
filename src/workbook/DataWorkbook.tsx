import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import {
  TableSheet,
  type TableSheetCellFormatter,
  type TableSheetData,
} from '../TableSheet'
import {
  RelationshipCanvas,
  type RelationshipCanvasJoin,
  type RelationshipCanvasTableNote,
} from './RelationshipCanvas'
import { useWorkbook } from './useWorkbook'
import type { WorkbookTab } from './model'
import './data-workbook.css'

export interface DataWorkbookColumn {
  readonly name: string
  readonly type: string
}

export interface DataWorkbookRelation {
  readonly id: string
  readonly label?: string
  readonly objectType?: string
  readonly columns: readonly DataWorkbookColumn[]
  readonly totalRowCount?: number
}

export interface DataWorkbookHandle {
  openRelationships: () => void
  openRelation: (relationId: string) => void
}

export interface DataWorkbookProps {
  readonly relations: readonly DataWorkbookRelation[]
  readonly tableNotes: Readonly<Record<string, RelationshipCanvasTableNote>>
  readonly joins: readonly RelationshipCanvasJoin[]
  readonly tableOrder?: readonly string[]
  readonly loadRelation: (relationId: string) => Promise<TableSheetData>
  readonly formatCell?: TableSheetCellFormatter
  readonly persistenceKey?: string
  readonly title?: string
  readonly eyebrow?: string
  readonly className?: string
  readonly focusMode?: boolean
  readonly onFocusModeChange?: (focusMode: boolean) => void
  readonly onDismiss?: () => void
}

type TableLoadState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly result: TableSheetData }
  | { readonly kind: 'error' }

const IDLE_TABLE: TableLoadState = Object.freeze({ kind: 'idle' })

/**
 * Reusable, read-only workbook chrome for a catalog of analytical relations.
 *
 * The pinned relationship canvas and every open table panel stay mounted while
 * the workbook is mounted. This preserves local canvas, filter, selection,
 * sort, and column-width state as the learner moves between tabs.
 */
export const DataWorkbook = forwardRef<DataWorkbookHandle, DataWorkbookProps>(function DataWorkbook({
  relations,
  tableNotes,
  joins,
  tableOrder,
  loadRelation,
  formatCell,
  persistenceKey,
  title = 'Warehouse workbook',
  eyebrow = 'Analysis workbook',
  className = '',
  focusMode = false,
  onFocusModeChange,
  onDismiss,
}, ref) {
  const relationIds = useMemo(() => relations.map((relation) => relation.id), [relations])
  const relationById = useMemo(
    () => new Map(relations.map((relation) => [relation.id, relation])),
    [relations],
  )
  const workbook = useWorkbook({
    relationIds,
    persistence: persistenceKey ? { key: persistenceKey } : undefined,
  })
  const [loadStates, setLoadStates] = useState<Readonly<Record<string, TableLoadState>>>({})
  const loadStatesRef = useRef<Readonly<Record<string, TableLoadState>>>({})
  const requestByRelationRef = useRef<Record<string, number>>({})
  const rootRef = useRef<HTMLElement>(null)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const canvasNotes = useMemo<Readonly<Record<string, RelationshipCanvasTableNote>>>(() => {
    const available: Record<string, RelationshipCanvasTableNote> = {}
    for (const relation of relations) {
      const authored = tableNotes[relation.id]
      const columns: Record<string, string> = {}
      const columnTypes: Record<string, string> = {}
      for (const column of relation.columns) {
        columns[column.name] = authored?.columns[column.name] ?? 'Warehouse field'
        columnTypes[column.name] = column.type
      }
      available[relation.id] = {
        grain: authored?.grain ?? 'one row = one warehouse record',
        blurb: authored?.blurb ?? 'A read-only relation in this analytical warehouse.',
        columns,
        columnTypes,
      }
    }
    return available
  }, [relations, tableNotes])

  const visibleJoins = useMemo(() => {
    const available = new Set(relationIds)
    return joins.filter((join) => available.has(join.from.relation) && available.has(join.to.relation))
  }, [joins, relationIds])

  const fieldCount = useMemo(
    () => relations.reduce((total, relation) => total + relation.columns.length, 0),
    [relations],
  )

  const setRelationLoadState = useCallback((relationId: string, state: TableLoadState) => {
    setLoadStates((current) => {
      const next = { ...current, [relationId]: state }
      loadStatesRef.current = next
      return next
    })
  }, [])

  const ensureLoaded = useCallback(async (relationId: string, force = false) => {
    if (!relationById.has(relationId)) return
    const current = loadStatesRef.current[relationId]
    if (!force && (current?.kind === 'loading' || current?.kind === 'ready')) return

    const request = (requestByRelationRef.current[relationId] ?? 0) + 1
    requestByRelationRef.current[relationId] = request
    setRelationLoadState(relationId, { kind: 'loading' })
    try {
      const result = await loadRelation(relationId)
      if (requestByRelationRef.current[relationId] !== request) return
      setRelationLoadState(relationId, { kind: 'ready', result })
    } catch {
      if (requestByRelationRef.current[relationId] !== request) return
      setRelationLoadState(relationId, { kind: 'error' })
    }
  }, [loadRelation, relationById, setRelationLoadState])

  const focusTab = useCallback((tabId: string) => {
    requestAnimationFrame(() => requestAnimationFrame(() => tabRefs.current[tabId]?.focus()))
  }, [])

  const openRelationships = useCallback(() => {
    workbook.activateRelationships()
    focusTab('relationships')
  }, [focusTab, workbook.activateRelationships])

  const openRelation = useCallback((relationId: string) => {
    if (!relationById.has(relationId)) return
    workbook.openRelation(relationId)
    void ensureLoaded(relationId)
    focusTab(`table:${relationId}`)
  }, [ensureLoaded, focusTab, relationById, workbook.openRelation])

  useImperativeHandle(ref, () => ({ openRelationships, openRelation }), [openRelation, openRelationships])

  useEffect(() => {
    const activeRelation = workbook.activeRelationId
    if (activeRelation) void ensureLoaded(activeRelation)
  }, [ensureLoaded, workbook.activeRelationId])

  useEffect(() => {
    const available = new Set(relationIds)
    setLoadStates((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([relationId]) => available.has(relationId)))
      loadStatesRef.current = next
      return next
    })
    for (const relationId of Object.keys(requestByRelationRef.current)) {
      if (!available.has(relationId)) delete requestByRelationRef.current[relationId]
    }
  }, [relationIds])

  const focusActiveTab = useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      rootRef.current?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus()
    }))
  }, [])

  const closeRelation = useCallback((relationId: string) => {
    workbook.closeRelation(relationId)
    focusActiveTab()
  }, [focusActiveTab, workbook.closeRelation])

  const activateTab = useCallback((tab: WorkbookTab<string>) => {
    if (tab.kind === 'relationships') workbook.activateRelationships()
    else {
      workbook.activateTab({ kind: 'table', relationId: tab.relationId })
      void ensureLoaded(tab.relationId)
    }
  }, [ensureLoaded, workbook.activateRelationships, workbook.activateTab])

  const handleTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    tab: WorkbookTab<string>,
    index: number,
  ) => {
    if ((event.key === 'Delete' || event.key === 'Backspace') && tab.kind === 'table') {
      event.preventDefault()
      closeRelation(tab.relationId)
      return
    }

    let nextIndex = index
    if (event.key === 'ArrowLeft') nextIndex = index === 0 ? workbook.tabs.length - 1 : index - 1
    else if (event.key === 'ArrowRight') nextIndex = index === workbook.tabs.length - 1 ? 0 : index + 1
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = workbook.tabs.length - 1
    else return

    event.preventDefault()
    const next = workbook.tabs[nextIndex]
    activateTab(next)
    focusTab(next.id)
  }

  const rootClassName = ['data-workbook', className].filter(Boolean).join(' ')

  return (
    <section
      ref={rootRef}
      className={rootClassName}
      data-data-workbook="true"
      data-focus-mode={focusMode ? 'true' : 'false'}
      aria-label={title}
      onKeyDownCapture={(event) => {
        if (event.key !== 'Escape' || !focusMode || !onFocusModeChange) return
        event.preventDefault()
        event.stopPropagation()
        onFocusModeChange(false)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !workbook.isRelationshipsActive || !onDismiss) return
        event.preventDefault()
        event.stopPropagation()
        onDismiss()
      }}
    >
      <header className="data-workbook__header">
        <div className="data-workbook__heading">
          <span>{eyebrow}</span>
          <div>
            <h2>{title}</h2>
            <p>{relations.length} tables · {fieldCount} fields · {visibleJoins.length} relationships</p>
          </div>
        </div>
        <div className="data-workbook__header-actions">
          {onFocusModeChange && (
            <button
              type="button"
              className="data-workbook__focus-toggle"
              aria-pressed={focusMode}
              aria-label={focusMode ? 'Show task beside workbook' : 'Focus on workbook'}
              onClick={(event) => {
                event.currentTarget.focus()
                onFocusModeChange(!focusMode)
              }}
            >
              {focusMode ? 'Show task' : 'Focus on workbook'}
            </button>
          )}
          {onDismiss && (
            <button type="button" className="data-workbook__dismiss" onClick={onDismiss}>
              Hide workbook
            </button>
          )}
        </div>
      </header>

      <div className="data-workbook__tab-strip">
        <div className="data-workbook__tabs" role="tablist" aria-label="Workbook sheets">
          {workbook.tabs.map((tab, index) => {
            const active = workbook.activeTab.id === tab.id
            const relation = tab.kind === 'table' ? relationById.get(tab.relationId) : null
            const label = tab.kind === 'relationships' ? 'Relationships' : relation?.label ?? tab.relationId
            const panelId = panelDomId(tab.id)
            const tabId = tabDomId(tab.id)
            return (
              <div
                key={tab.id}
                className={`data-workbook__tab-shell${active ? ' data-workbook__tab-shell--active' : ''}`}
                data-workbook-tab={tab.id}
              >
                <button
                  ref={(node) => { tabRefs.current[tab.id] = node }}
                  id={tabId}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={panelId}
                  tabIndex={active ? 0 : -1}
                  className="data-workbook__tab"
                  onClick={() => activateTab(tab)}
                  onKeyDown={(event) => handleTabKeyDown(event, tab, index)}
                >
                  {tab.kind === 'relationships' && <span aria-hidden="true">↔</span>}
                  <span>{label}</span>
                </button>
                {tab.kind === 'table' && (
                  <button
                    type="button"
                    className="data-workbook__tab-close"
                    aria-label={`Close ${label} table tab`}
                    onClick={() => closeRelation(tab.relationId)}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div
        id={panelDomId('relationships')}
        role="tabpanel"
        aria-labelledby={tabDomId('relationships')}
        hidden={!workbook.isRelationshipsActive}
        className="data-workbook__panel data-workbook__panel--relationships"
        data-workbook-panel="relationships"
      >
        <RelationshipCanvas
          className="data-workbook__relationship-canvas"
          tableNotes={canvasNotes}
          joins={visibleJoins}
          tableOrder={tableOrder}
          onOpenTable={openRelation}
          title="Relationships"
          eyebrow="All warehouse fields"
          ariaLabel={`${title} relationships. ${relations.length} tables and ${visibleJoins.length} mapped relationships.`}
        />
      </div>

      {workbook.state.openRelationIds.map((relationId) => {
        const relation = relationById.get(relationId)
        if (!relation) return null
        const active = workbook.activeRelationId === relationId
        const state = loadStates[relationId] ?? IDLE_TABLE
        const label = relation.label ?? relation.id
        return (
          <div
            key={relationId}
            id={panelDomId(`table:${relationId}`)}
            role="tabpanel"
            aria-labelledby={tabDomId(`table:${relationId}`)}
            hidden={!active}
            className="data-workbook__panel data-workbook__panel--table"
            data-workbook-panel={`table:${relationId}`}
            data-workbook-relation={relationId}
            data-load-state={state.kind}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return
              event.preventDefault()
              event.stopPropagation()
              closeRelation(relationId)
            }}
          >
            {state.kind === 'ready' ? (
              <ReadyWorkbookTable
                relation={relation}
                result={state.result}
                formatCell={formatCell}
                onClose={closeRelation}
              />
            ) : (
              <WorkbookTableState
                relation={relation}
                state={state}
                onRetry={() => { void ensureLoaded(relationId, true) }}
                onClose={() => closeRelation(relationId)}
              />
            )}
          </div>
        )
      })}
    </section>
  )
})

function ReadyWorkbookTable({ relation, result, formatCell, onClose }: {
  relation: DataWorkbookRelation
  result: TableSheetData
  formatCell?: TableSheetCellFormatter
  onClose: (relationId: string) => void
}) {
  const label = relation.label ?? relation.id
  const stableResult = useMemo<TableSheetData>(() => ({
    ...result,
    rowCount: result.rows.length,
    totalRowCount: relation.totalRowCount,
    truncated: relation.totalRowCount !== undefined && relation.totalRowCount > result.rows.length,
  }), [relation.totalRowCount, result])
  const closeTable = useCallback(() => onClose(relation.id), [onClose, relation.id])

  return (
    <TableSheet
      result={stableResult}
      title={label}
      eyebrow={relation.objectType ?? 'Warehouse view'}
      ariaLabel={`${label} data sheet`}
      className="warehouse-workbench__table-sheet data-workbook__table-sheet"
      variant="embedded"
      formatCell={formatCell}
      onClose={closeTable}
      closeLabel={`Close ${label} table tab`}
    />
  )
}

function WorkbookTableState({ relation, state, onRetry, onClose }: {
  relation: DataWorkbookRelation
  state: Exclude<TableLoadState, { kind: 'ready' }>
  onRetry: () => void
  onClose: () => void
}) {
  const label = relation.label ?? relation.id
  return (
    <section className="data-workbook__table-state" aria-label={`${label} table status`}>
      <header>
        <div>
          <span>{relation.objectType ?? 'Warehouse view'}</span>
          <h2>{label}</h2>
          <p>{formatInteger(relation.totalRowCount ?? 0)} rows · {relation.columns.length} columns</p>
        </div>
        <button type="button" onClick={onClose}>Close table</button>
      </header>
      <div className={`data-workbook__table-message${state.kind === 'error' ? ' data-workbook__table-message--error' : ''}`}>
        {state.kind === 'error' ? (
          <p>
            This table could not load from the browser warehouse.
            {' '}<button type="button" onClick={onRetry}>Retry</button>
          </p>
        ) : (
          <p role="status">Loading rows into the workbook…</p>
        )}
      </div>
    </section>
  )
}

function tabDomId(tabId: string): string {
  return `data-workbook-tab-${safeId(tabId)}`
}

function panelDomId(tabId: string): string {
  return `data-workbook-panel-${safeId(tabId)}`
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}
