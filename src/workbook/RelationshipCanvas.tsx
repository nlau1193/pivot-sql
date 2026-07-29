import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import './relationship-canvas.css'

export interface RelationshipCanvasTableNote {
  grain: string
  blurb: string
  columns: Readonly<Record<string, string>>
  columnTypes?: Readonly<Record<string, string>>
}

export interface RelationshipCanvasEndpoint {
  relation: string
  column: string
}

export interface RelationshipCanvasJoin {
  from: RelationshipCanvasEndpoint
  to: RelationshipCanvasEndpoint
}

export interface RelationshipCanvasPosition {
  x: number
  y: number
}

export interface RelationshipCanvasProps {
  /** The existing TABLE_NOTES object can be passed directly. */
  tableNotes: Readonly<Record<string, RelationshipCanvasTableNote>>
  /** The existing COMMON_JOINS array can be passed directly. */
  joins: readonly RelationshipCanvasJoin[]
  tableOrder?: readonly string[]
  initialPositions?: Readonly<Record<string, RelationshipCanvasPosition>>
  onOpenTable?: (relation: string) => void
  getTableLabel?: (relation: string) => string
  title?: string
  eyebrow?: string
  ariaLabel?: string
  className?: string
}

interface CanvasField {
  name: string
  note: string
  type?: string
}

interface CanvasTable {
  relation: string
  label: string
  grain: string
  blurb: string
  fields: readonly CanvasField[]
}

interface ResolvedEdge {
  key: string
  join: RelationshipCanvasJoin
  from: CanvasPoint
  to: CanvasPoint
  path: string
}

interface CanvasPoint {
  x: number
  y: number
}

interface FocusTarget {
  relation: string
  column?: string
}

interface SearchHit extends FocusTarget {
  label: string
}

interface DragState {
  relation: string
  pointerId: number
  clientX: number
  clientY: number
  origin: RelationshipCanvasPosition
}

const CARD_WIDTH = 296
const CARD_HEADER_HEIGHT = 76
const FIELD_ROW_HEIGHT = 35
const LAYOUT_PADDING = 72
const COLUMN_GAP = 152
const ROW_GAP = 54
const ZOOM_MIN = 0.35
const ZOOM_MAX = 1.6
const ZOOM_STEP = 0.15
const KEYBOARD_MOVE = 16

/**
 * A read-only map of useful analytical relationships.
 *
 * This component deliberately says nothing about database constraints,
 * cardinality, or primary/foreign keys. Callers provide the relationships
 * that belong in the workspace.
 */
export function RelationshipCanvas({
  tableNotes,
  joins,
  tableOrder,
  initialPositions,
  onOpenTable,
  getTableLabel = identity,
  title = 'Relationship canvas',
  eyebrow = 'Warehouse map',
  ariaLabel,
  className = '',
}: RelationshipCanvasProps) {
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const searchId = `${instanceId}-relationship-search`
  const searchResultsId = `${instanceId}-relationship-search-results`
  const viewportRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Record<string, HTMLElement | null>>({})
  const listRefs = useRef<Record<string, HTMLElement | null>>({})
  const dragRef = useRef<DragState | null>(null)
  const [query, setQuery] = useState('')
  const [searchResultsOpen, setSearchResultsOpen] = useState(false)
  const [zoom, setZoom] = useState(0.85)
  const [focused, setFocused] = useState<FocusTarget | null>(null)
  const [status, setStatus] = useState('')

  const tables = useMemo<readonly CanvasTable[]>(() => {
    const orderedRelations = orderedKeys(tableNotes, tableOrder)
    return orderedRelations.map((relation) => {
      const note = tableNotes[relation]
      return {
        relation,
        label: getTableLabel(relation),
        grain: note.grain,
        blurb: note.blurb,
        fields: Object.entries(note.columns).map(([name, columnNote]) => ({
          name,
          note: columnNote,
          type: note.columnTypes?.[name],
        })),
      }
    })
  }, [getTableLabel, tableNotes, tableOrder])

  const layoutSignature = useMemo(() => JSON.stringify({
    tables: tables.map((table) => [table.relation, ...table.fields.map((field) => field.name)]),
    initialPositions,
  }), [initialPositions, tables])

  const defaultPositions = useMemo(
    () => buildLayout(tables, initialPositions),
    // layoutSignature intentionally captures the structural inputs without
    // resetting moved cards when a caller recreates equivalent objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layoutSignature],
  )
  const [positions, setPositions] = useState<Readonly<Record<string, RelationshipCanvasPosition>>>(defaultPositions)

  useEffect(() => {
    setPositions(defaultPositions)
    setFocused(null)
  }, [defaultPositions])

  const tableByRelation = useMemo(
    () => new Map(tables.map((table) => [table.relation, table])),
    [tables],
  )

  const resolvedEdges = useMemo(() => joins.flatMap<ResolvedEdge>((join, index) => {
    const fromTable = tableByRelation.get(join.from.relation)
    const toTable = tableByRelation.get(join.to.relation)
    const fromPosition = positions[join.from.relation]
    const toPosition = positions[join.to.relation]
    const fromFieldIndex = fromTable?.fields.findIndex((field) => field.name === join.from.column) ?? -1
    const toFieldIndex = toTable?.fields.findIndex((field) => field.name === join.to.column) ?? -1
    if (!fromTable || !toTable || !fromPosition || !toPosition || fromFieldIndex < 0 || toFieldIndex < 0) return []

    const fromCenter = fromPosition.x + CARD_WIDTH / 2
    const toCenter = toPosition.x + CARD_WIDTH / 2
    const travelsRight = fromCenter <= toCenter
    const from = {
      x: fromPosition.x + (travelsRight ? CARD_WIDTH : 0),
      y: fieldCenterY(fromPosition, fromFieldIndex),
    }
    const to = {
      x: toPosition.x + (travelsRight ? 0 : CARD_WIDTH),
      y: fieldCenterY(toPosition, toFieldIndex),
    }

    return [{
      key: `${join.from.relation}.${join.from.column}-${join.to.relation}.${join.to.column}-${index}`,
      join,
      from,
      to,
      path: edgePath(from, to, travelsRight),
    }]
  }), [joins, positions, tableByRelation])

  const unresolvedJoinCount = joins.length - resolvedEdges.length
  const worldSize = useMemo(() => {
    const width = tables.reduce((max, table) => Math.max(
      max,
      (positions[table.relation]?.x ?? 0) + CARD_WIDTH + LAYOUT_PADDING,
    ), 900)
    const height = tables.reduce((max, table) => Math.max(
      max,
      (positions[table.relation]?.y ?? 0) + cardHeight(table) + LAYOUT_PADDING,
    ), 640)
    return { width, height }
  }, [positions, tables])

  const joinedFields = useMemo(() => {
    const set = new Set<string>()
    for (const join of joins) {
      set.add(endpointKey(join.from))
      set.add(endpointKey(join.to))
    }
    return set
  }, [joins])

  const searchHits = useMemo<readonly SearchHit[]>(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return []

    const hits: SearchHit[] = []
    for (const table of tables) {
      const tableMatches = [table.relation, table.label, table.grain, table.blurb]
        .some((value) => value.toLocaleLowerCase().includes(needle))
      if (tableMatches) hits.push({ relation: table.relation, label: table.label })
      for (const field of table.fields) {
        if ([field.name, field.note, field.type ?? ''].some((value) => value.toLocaleLowerCase().includes(needle))) {
          hits.push({
            relation: table.relation,
            column: field.name,
            label: `${table.label} · ${field.name}`,
          })
        }
      }
    }
    return hits.slice(0, 12)
  }, [query, tables])

  const focusTable = useCallback((target: FocusTarget) => {
    const position = positions[target.relation]
    if (!position) return
    setFocused(target)

    requestAnimationFrame(() => {
      const isNarrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches
      if (isNarrow) {
        const listTarget = listRefs.current[target.relation]
        listTarget?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        listTarget?.focus({ preventScroll: true })
        return
      }

      const viewport = viewportRef.current
      const card = cardRefs.current[target.relation]
      if (!viewport || !card) return
      const fieldIndex = target.column
        ? tableByRelation.get(target.relation)?.fields.findIndex((field) => field.name === target.column) ?? 0
        : 0
      const worldY = position.y + (target.column ? CARD_HEADER_HEIGHT + fieldIndex * FIELD_ROW_HEIGHT : 0)
      viewport.scrollTo({
        left: Math.max(0, (position.x + CARD_WIDTH / 2) * zoom - viewport.clientWidth / 2),
        top: Math.max(0, worldY * zoom - viewport.clientHeight / 2),
        behavior: 'smooth',
      })
      card.focus({ preventScroll: true })
    })
  }, [positions, tableByRelation, zoom])

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!searchHits[0]) return
    setSearchResultsOpen(false)
    focusTable(searchHits[0])
  }

  const updateZoom = useCallback((nextZoom: number) => {
    const boundedZoom = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX)
    const viewport = viewportRef.current
    if (!viewport) {
      setZoom(boundedZoom)
      return
    }

    const worldCenterX = (viewport.scrollLeft + viewport.clientWidth / 2) / zoom
    const worldCenterY = (viewport.scrollTop + viewport.clientHeight / 2) / zoom
    setZoom(boundedZoom)
    requestAnimationFrame(() => viewport.scrollTo({
      left: Math.max(0, worldCenterX * boundedZoom - viewport.clientWidth / 2),
      top: Math.max(0, worldCenterY * boundedZoom - viewport.clientHeight / 2),
    }))
  }, [zoom])

  const fitCanvas = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const horizontalFit = (viewport.clientWidth - 24) / worldSize.width
    const verticalFit = (viewport.clientHeight - 24) / worldSize.height
    const fittedZoom = clamp(Math.min(horizontalFit, verticalFit), ZOOM_MIN, 1)
    setZoom(fittedZoom)
    requestAnimationFrame(() => viewport.scrollTo({ left: 0, top: 0, behavior: 'smooth' }))
    setStatus(`Fit all tables at ${Math.round(fittedZoom * 100)} percent.`)
  }, [worldSize])

  const resetLayout = useCallback(() => {
    setPositions(defaultPositions)
    setFocused(null)
    setStatus('Restored the original table layout.')
  }, [defaultPositions])

  const moveTable = useCallback((relation: string, next: RelationshipCanvasPosition) => {
    setPositions((current) => ({
      ...current,
      [relation]: {
        x: Math.max(16, Math.round(next.x)),
        y: Math.max(16, Math.round(next.y)),
      },
    }))
  }, [])

  const startDrag = (event: ReactPointerEvent<HTMLElement>, relation: string) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
    const origin = positions[relation]
    if (!origin) return
    event.preventDefault()
    dragRef.current = {
      relation,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      origin,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    cardRefs.current[relation]?.focus({ preventScroll: true })
    setFocused({ relation })
  }

  const continueDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    moveTable(drag.relation, {
      x: drag.origin.x + (event.clientX - drag.clientX) / zoom,
      y: drag.origin.y + (event.clientY - drag.clientY) / zoom,
    })
  }

  const finishDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current = null
    const position = positions[drag.relation]
    setStatus(position
      ? `Moved ${getTableLabel(drag.relation)} to ${Math.round(position.x)}, ${Math.round(position.y)}.`
      : `Moved ${getTableLabel(drag.relation)}.`)
  }

  const moveWithKeyboard = (event: ReactKeyboardEvent<HTMLElement>, relation: string) => {
    if (event.target !== event.currentTarget || !positions[relation]) return
    const distance = event.shiftKey ? KEYBOARD_MOVE * 3 : KEYBOARD_MOVE
    let deltaX = 0
    let deltaY = 0
    if (event.key === 'ArrowLeft') deltaX = -distance
    else if (event.key === 'ArrowRight') deltaX = distance
    else if (event.key === 'ArrowUp') deltaY = -distance
    else if (event.key === 'ArrowDown') deltaY = distance
    else return

    event.preventDefault()
    const current = positions[relation]
    moveTable(relation, { x: current.x + deltaX, y: current.y + deltaY })
    setFocused({ relation })
    setStatus(`Moved ${getTableLabel(relation)} ${event.key.replace('Arrow', '').toLocaleLowerCase()} ${distance} pixels.`)
  }

  const rootClassName = `relationship-canvas${className ? ` ${className}` : ''}`
  const canvasLabel = ariaLabel ?? `${title}. ${tables.length} tables and ${resolvedEdges.length} mapped relationships.`

  return (
    <section className={rootClassName} aria-label={canvasLabel}>
      <header className="relationship-canvas__header">
        <div className="relationship-canvas__heading">
          <span>{eyebrow}</span>
          <h2>{title}</h2>
          <p>Explore mapped relationships. Lines are analysis guidance, not database-enforced keys or cardinality.</p>
        </div>
        <div className="relationship-canvas__summary" aria-label="Canvas summary">
          <strong>{tables.length}</strong> tables
          <span aria-hidden="true">·</span>
          <strong>{resolvedEdges.length}</strong> relationships
        </div>
      </header>

      <div className="relationship-canvas__toolbar">
        <form
          className="relationship-canvas__search"
          role="search"
          onSubmit={submitSearch}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSearchResultsOpen(false)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || !searchResultsOpen) return
            event.preventDefault()
            event.stopPropagation()
            setSearchResultsOpen(false)
          }}
        >
          <label htmlFor={searchId}>Find a table or field</label>
          <div>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setSearchResultsOpen(true)
              }}
              onFocus={() => {
                if (query.trim()) setSearchResultsOpen(true)
              }}
              placeholder="Try customer_id"
              autoComplete="off"
              aria-controls={searchResultsId}
              aria-expanded={Boolean(query.trim() && searchResultsOpen)}
            />
            <button type="submit" disabled={searchHits.length === 0}>Focus</button>
          </div>

          {query.trim() && searchResultsOpen && (
            <div id={searchResultsId} className="relationship-canvas__search-results" aria-label="Search results">
              {searchHits.length > 0 ? searchHits.map((hit) => (
                <button
                  key={`${hit.relation}.${hit.column ?? 'table'}`}
                  type="button"
                  onClick={() => {
                    setSearchResultsOpen(false)
                    focusTable(hit)
                  }}
                >
                  {hit.label}
                </button>
              )) : <p>No table or field matches “{query.trim()}”.</p>}
            </div>
          )}
        </form>

        <div className="relationship-canvas__zoom" aria-label="Canvas zoom controls">
          <button type="button" onClick={() => updateZoom(zoom - ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} aria-label="Zoom out">−</button>
          <output aria-live="polite">{Math.round(zoom * 100)}%</output>
          <button type="button" onClick={() => updateZoom(zoom + ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} aria-label="Zoom in">+</button>
          <button type="button" onClick={fitCanvas}>Fit</button>
          <button type="button" onClick={resetLayout}>Reset</button>
        </div>
      </div>

      {unresolvedJoinCount > 0 && (
        <p className="relationship-canvas__warning" role="status">
          {unresolvedJoinCount} mapped {unresolvedJoinCount === 1 ? 'relationship references' : 'relationships reference'} a table or field not present in this view.
        </p>
      )}

      <div
        ref={viewportRef}
        className="relationship-canvas__viewport"
        data-testid="relationship-canvas-viewport"
      >
        <div
          className="relationship-canvas__scaled-world"
          style={{ width: worldSize.width * zoom, height: worldSize.height * zoom }}
        >
          <div
            className="relationship-canvas__world"
            style={{
              width: worldSize.width,
              height: worldSize.height,
              transform: `scale(${zoom})`,
            }}
          >
            <svg
              className="relationship-canvas__edges"
              width={worldSize.width}
              height={worldSize.height}
              viewBox={`0 0 ${worldSize.width} ${worldSize.height}`}
              aria-hidden="true"
            >
              {resolvedEdges.map((edge) => (
                <g key={edge.key}>
                  <path d={edge.path} />
                  <circle cx={edge.from.x} cy={edge.from.y} r="4" />
                  <circle cx={edge.to.x} cy={edge.to.y} r="4" />
                </g>
              ))}
            </svg>

            {tables.map((table) => {
              const position = positions[table.relation] ?? { x: 0, y: 0 }
              const tableFocused = focused?.relation === table.relation
              return (
                <article
                  key={table.relation}
                  ref={(node) => { cardRefs.current[table.relation] = node }}
                  className={`relationship-canvas__card${tableFocused ? ' relationship-canvas__card--focused' : ''}`}
                  style={{ left: position.x, top: position.y, '--card-height': `${cardHeight(table)}px` } as CSSProperties}
                  tabIndex={0}
                  aria-label={`${table.label}. ${table.grain}. ${table.fields.length} fields. Use arrow keys to move this table.`}
                  onKeyDown={(event) => moveWithKeyboard(event, table.relation)}
                  onFocus={() => setFocused((current) => current?.relation === table.relation ? current : { relation: table.relation })}
                >
                  <header
                    className="relationship-canvas__card-header"
                    onPointerDown={(event) => startDrag(event, table.relation)}
                    onPointerMove={continueDrag}
                    onPointerUp={finishDrag}
                    onPointerCancel={finishDrag}
                  >
                    <div>
                      <h3>{table.label}</h3>
                      <p title={table.blurb}>{table.grain}</p>
                    </div>
                    {onOpenTable && (
                      <button
                        type="button"
                        onClick={() => onOpenTable(table.relation)}
                        aria-label={`Open ${table.label} as a table`}
                      >
                        Open
                      </button>
                    )}
                  </header>
                  <ol className="relationship-canvas__fields">
                    {table.fields.map((field) => {
                      const fieldKey = endpointKey({ relation: table.relation, column: field.name })
                      const fieldFocused = tableFocused && focused?.column === field.name
                      return (
                        <li
                          key={field.name}
                          className={`${joinedFields.has(fieldKey) ? 'relationship-canvas__field--joined' : ''}${fieldFocused ? ' relationship-canvas__field--focused' : ''}`}
                          title={field.note}
                        >
                          <code>{field.name}</code>
                          {field.type && <span>{field.type}</span>}
                          {joinedFields.has(fieldKey) && <i aria-label="Used in a mapped relationship" title="Used in a mapped relationship" />}
                        </li>
                      )
                    })}
                  </ol>
                </article>
              )
            })}
          </div>
        </div>
      </div>

      <div className="relationship-canvas__list" aria-label="Relationship list view">
        {tables.map((table) => (
          <article
            key={table.relation}
            ref={(node) => { listRefs.current[table.relation] = node }}
            className={focused?.relation === table.relation ? 'relationship-canvas__list-card--focused' : ''}
            tabIndex={-1}
          >
            <header>
              <div>
                <h3>{table.label}</h3>
                <p>{table.grain}</p>
              </div>
              {onOpenTable && <button type="button" onClick={() => onOpenTable(table.relation)}>Open table</button>}
            </header>
            <p>{table.blurb}</p>
            <dl>
              {table.fields.map((field) => (
                <div key={field.name} className={focused?.relation === table.relation && focused.column === field.name ? 'relationship-canvas__list-field--focused' : ''}>
                  <dt>{field.name}{field.type ? <small>{field.type}</small> : null}</dt>
                  <dd>{field.note}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}

        {resolvedEdges.length > 0 && (
          <section className="relationship-canvas__path-list">
            <h3>Mapped relationships</h3>
            <p>These are useful analysis routes, not claims about database constraints or cardinality.</p>
            <ul>
              {resolvedEdges.map((edge) => (
                <li key={edge.key}>
                  <code>{edge.join.from.relation}.{edge.join.from.column}</code>
                  <span aria-hidden="true">↔</span>
                  <code>{edge.join.to.relation}.{edge.join.to.column}</code>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <ol className="relationship-canvas__sr-only" aria-label="Mapped relationships">
        {resolvedEdges.map((edge) => (
          <li key={edge.key}>
            {edge.join.from.relation} dot {edge.join.from.column} connects to {edge.join.to.relation} dot {edge.join.to.column}.
          </li>
        ))}
      </ol>
      <p className="relationship-canvas__status" role="status" aria-live="polite">{status}</p>
      <footer className="relationship-canvas__footer">
        Drag a table header or focus a table and use arrow keys to rearrange. Scroll the canvas to pan.
      </footer>
    </section>
  )
}

function orderedKeys(
  notes: Readonly<Record<string, RelationshipCanvasTableNote>>,
  order?: readonly string[],
): string[] {
  const available = new Set(Object.keys(notes))
  const ordered = (order ?? []).filter((relation) => available.delete(relation))
  return [...ordered, ...Array.from(available).sort((left, right) => left.localeCompare(right))]
}

function buildLayout(
  tables: readonly CanvasTable[],
  initialPositions?: Readonly<Record<string, RelationshipCanvasPosition>>,
): Readonly<Record<string, RelationshipCanvasPosition>> {
  const columnCount = tables.length >= 8 ? 3 : tables.length >= 4 ? 2 : 1
  const columnHeights = Array.from({ length: columnCount }, () => LAYOUT_PADDING)
  const positions: Record<string, RelationshipCanvasPosition> = {}

  for (const table of tables) {
    const column = columnHeights.indexOf(Math.min(...columnHeights))
    positions[table.relation] = {
      x: LAYOUT_PADDING + column * (CARD_WIDTH + COLUMN_GAP),
      y: columnHeights[column],
    }
    columnHeights[column] += cardHeight(table) + ROW_GAP
  }
  for (const [relation, initial] of Object.entries(initialPositions ?? {})) {
    if (!positions[relation]) continue
    positions[relation] = { x: Math.max(16, initial.x), y: Math.max(16, initial.y) }
  }
  return positions
}

function cardHeight(table: CanvasTable): number {
  return CARD_HEADER_HEIGHT + table.fields.length * FIELD_ROW_HEIGHT
}

function fieldCenterY(position: RelationshipCanvasPosition, fieldIndex: number): number {
  return position.y + CARD_HEADER_HEIGHT + fieldIndex * FIELD_ROW_HEIGHT + FIELD_ROW_HEIGHT / 2
}

function edgePath(from: CanvasPoint, to: CanvasPoint, travelsRight: boolean): string {
  const horizontalDistance = Math.abs(to.x - from.x)
  const controlDistance = Math.max(64, horizontalDistance * 0.42)
  const direction = travelsRight ? 1 : -1
  return `M ${from.x} ${from.y} C ${from.x + controlDistance * direction} ${from.y}, ${to.x - controlDistance * direction} ${to.y}, ${to.x} ${to.y}`
}

function endpointKey(endpoint: RelationshipCanvasEndpoint): string {
  return `${endpoint.relation}.${endpoint.column}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function identity(value: string): string {
  return value
}
