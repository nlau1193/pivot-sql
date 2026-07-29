import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import './table-sheet.css'

export interface TableSheetData {
  columns: readonly string[]
  types?: readonly string[]
  rows: readonly (readonly unknown[])[]
  rowCount?: number
  totalRowCount?: number | null
  elapsedMs?: number
  truncated?: boolean
}

export interface TableSheetFormattedCell {
  text: string
  num?: boolean
  neg?: boolean
}

export type TableSheetCellFormatter = (
  value: unknown,
  columnName: string,
  columnType: string,
) => string | TableSheetFormattedCell

export interface TableSheetProps {
  result: TableSheetData
  title?: string
  eyebrow?: string
  ariaLabel?: string
  emptyMessage?: string
  className?: string
  variant?: 'standalone' | 'embedded'
  formatCell?: TableSheetCellFormatter
  defaultColumnWidth?: number
  minColumnWidth?: number
  maxColumnWidth?: number
  autoFocus?: boolean
  onClose?: () => void
  closeLabel?: string
  initialFocus?: 'grid' | 'close'
}

type SortState = { column: number; direction: 'asc' | 'desc' } | null
type Selection = { sourceIndex: number; column: number }
type CopyState = 'idle' | 'copied' | 'error'

interface DisplayRow {
  sourceIndex: number
  row: readonly unknown[]
}

interface ResizeState {
  column: number
  pointerId: number
  startX: number
  startWidth: number
}

const FALLBACK_COLUMN_WIDTH = 176
const FALLBACK_MIN_COLUMN_WIDTH = 96
const FALLBACK_MAX_COLUMN_WIDTH = 420
const PAGE_STEP = 10
const NUMBER_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 })

/**
 * An interactive, read-only projection of a query result.
 *
 * Filtering, sorting, selection, and column sizing are local display state.
 * `result.rows` is never mutated or reordered, so the result passed to grading
 * remains the authoritative query output.
 */
export function TableSheet({
  result,
  title = 'Query result',
  eyebrow = 'Read-only result sheet',
  ariaLabel,
  emptyMessage = 'This query returned no rows.',
  className = '',
  variant = 'standalone',
  formatCell = defaultFormatCell,
  defaultColumnWidth = FALLBACK_COLUMN_WIDTH,
  minColumnWidth = FALLBACK_MIN_COLUMN_WIDTH,
  maxColumnWidth = FALLBACK_MAX_COLUMN_WIDTH,
  autoFocus = false,
  onClose,
  closeLabel = 'Close sheet',
  initialFocus,
}: TableSheetProps) {
  const instanceId = useId()
  const titleId = `${instanceId}-title`
  const helpId = `${instanceId}-help`
  const statusId = `${instanceId}-copy-status`
  const gridRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const resizeRef = useRef<ResizeState | null>(null)
  const copyTimerRef = useRef<number | null>(null)
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<SortState>(null)
  const [selection, setSelection] = useState<Selection>({ sourceIndex: 0, column: 0 })
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({})
  const [copyState, setCopyState] = useState<CopyState>('idle')

  const safeMinWidth = Math.max(56, Math.min(minColumnWidth, maxColumnWidth))
  const safeMaxWidth = Math.max(safeMinWidth, maxColumnWidth)
  const baseColumnWidth = clamp(defaultColumnWidth, safeMinWidth, safeMaxWidth)
  const columns = result.columns

  const formattedRows = useMemo(() => result.rows.map((row, sourceIndex) => ({
    sourceIndex,
    row,
    searchableText: columns.flatMap((column, columnIndex) => searchableCellText(
      normalizeFormattedCell(
        formatCell(row[columnIndex], column, result.types?.[columnIndex] ?? ''),
        row[columnIndex],
        result.types?.[columnIndex] ?? '',
      ).text,
      row[columnIndex],
    )),
  })), [columns, formatCell, result.rows, result.types])

  const displayRows = useMemo<DisplayRow[]>(() => {
    const needle = filter.trim().toLocaleLowerCase()
    const projected = formattedRows
      .filter((entry) => !needle || entry.searchableText.some((text) => text.includes(needle)))
      .map(({ sourceIndex, row }) => ({ sourceIndex, row }))

    if (!sort) return projected
    return projected.sort((left, right) => {
      const comparison = compareValues(left.row[sort.column], right.row[sort.column], formatCell, columns[sort.column], result.types?.[sort.column] ?? '')
      if (comparison !== 0) return sort.direction === 'asc' ? comparison : -comparison
      return left.sourceIndex - right.sourceIndex
    })
  }, [columns, filter, formatCell, formattedRows, result.types, sort])

  const selectedDisplayRow = displayRows.findIndex((entry) => entry.sourceIndex === selection.sourceIndex)
  const effectiveDisplayRow = selectedDisplayRow >= 0 ? selectedDisplayRow : 0
  const effectiveEntry = displayRows[effectiveDisplayRow]
  const effectiveColumn = columns.length === 0 ? 0 : clamp(selection.column, 0, columns.length - 1)
  const activeValue = effectiveEntry?.row[effectiveColumn]
  const activeColumn = columns[effectiveColumn] ?? ''
  const activeType = result.types?.[effectiveColumn] ?? ''
  const activeFormatted = effectiveEntry
    ? normalizeFormattedCell(formatCell(activeValue, activeColumn, activeType), activeValue, activeType)
    : null
  const activeCoordinate = effectiveEntry ? `${spreadsheetColumnName(effectiveColumn)}${effectiveDisplayRow + 1}` : '—'
  const activeCellId = effectiveEntry ? cellId(instanceId, effectiveEntry.sourceIndex, effectiveColumn) : undefined
  const loadedCount = result.rows.length
  const reportedCount = result.rowCount ?? loadedCount
  const sheetLabel = ariaLabel ?? `${title} data sheet`

  useEffect(() => {
    setFilter('')
    setSort(null)
    setSelection({ sourceIndex: 0, column: 0 })
    setColumnWidths({})
    setCopyState('idle')
    if (initialFocus === 'close' && onClose) requestAnimationFrame(() => closeButtonRef.current?.focus())
    else if (initialFocus === 'grid' || autoFocus) requestAnimationFrame(() => gridRef.current?.focus())
  }, [autoFocus, initialFocus, onClose, result])

  useEffect(() => () => {
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
  }, [])

  const widthFor = useCallback((column: number) => (
    clamp(columnWidths[column] ?? baseColumnWidth, safeMinWidth, safeMaxWidth)
  ), [baseColumnWidth, columnWidths, safeMaxWidth, safeMinWidth])

  const updateColumnWidth = useCallback((column: number, width: number) => {
    setColumnWidths((current) => ({
      ...current,
      [column]: clamp(width, safeMinWidth, safeMaxWidth),
    }))
  }, [safeMaxWidth, safeMinWidth])

  const selectCell = useCallback((entry: DisplayRow, column: number, focusGrid = true) => {
    const boundedColumn = columns.length === 0 ? 0 : clamp(column, 0, columns.length - 1)
    setSelection({ sourceIndex: entry.sourceIndex, column: boundedColumn })
    if (focusGrid) gridRef.current?.focus({ preventScroll: true })
    requestAnimationFrame(() => {
      const cell = document.getElementById(cellId(instanceId, entry.sourceIndex, boundedColumn))
      cell?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
  }, [columns.length, instanceId])

  const announceCopy = useCallback((state: CopyState) => {
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
    setCopyState(state)
    copyTimerRef.current = window.setTimeout(() => setCopyState('idle'), 1600)
  }, [])

  const copyActiveCell = useCallback(async () => {
    if (!activeFormatted) return
    try {
      await writeClipboard(activeFormatted.text)
      announceCopy('copied')
    } catch {
      announceCopy('error')
    }
  }, [activeFormatted, announceCopy])

  const cycleSort = (column: number) => {
    setSort((current) => {
      if (!current || current.column !== column) return { column, direction: 'asc' }
      if (current.direction === 'asc') return { column, direction: 'desc' }
      return null
    })
  }

  const handleGridKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !effectiveEntry || columns.length === 0) return

    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'c') {
      event.preventDefault()
      void copyActiveCell()
      return
    }

    let nextRow = effectiveDisplayRow
    let nextColumn = effectiveColumn
    if (event.key === 'ArrowUp') nextRow -= 1
    else if (event.key === 'ArrowDown') nextRow += 1
    else if (event.key === 'ArrowLeft') nextColumn -= 1
    else if (event.key === 'ArrowRight') nextColumn += 1
    else if (event.key === 'PageUp') nextRow -= PAGE_STEP
    else if (event.key === 'PageDown') nextRow += PAGE_STEP
    else if (event.key === 'Home') {
      nextColumn = 0
      if (event.metaKey || event.ctrlKey) nextRow = 0
    } else if (event.key === 'End') {
      nextColumn = columns.length - 1
      if (event.metaKey || event.ctrlKey) nextRow = displayRows.length - 1
    } else return

    event.preventDefault()
    nextRow = clamp(nextRow, 0, displayRows.length - 1)
    nextColumn = clamp(nextColumn, 0, columns.length - 1)
    selectCell(displayRows[nextRow], nextColumn)
  }

  const startResize = (event: ReactPointerEvent<HTMLSpanElement>, column: number) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    resizeRef.current = {
      column,
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: widthFor(column),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const resize = resizeRef.current
    if (!resize || resize.pointerId !== event.pointerId) return
    updateColumnWidth(resize.column, resize.startWidth + event.clientX - resize.startX)
  }

  const finishResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (resizeRef.current?.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    resizeRef.current = null
  }

  const resizeWithKeyboard = (event: ReactKeyboardEvent<HTMLSpanElement>, column: number) => {
    const step = event.shiftKey ? 32 : 8
    if (event.key === 'ArrowLeft') updateColumnWidth(column, widthFor(column) - step)
    else if (event.key === 'ArrowRight') updateColumnWidth(column, widthFor(column) + step)
    else if (event.key === 'Home') updateColumnWidth(column, safeMinWidth)
    else if (event.key === 'End') updateColumnWidth(column, safeMaxWidth)
    else return
    event.preventDefault()
    event.stopPropagation()
  }

  const rootClassName = [
    'table-sheet',
    variant === 'embedded' ? 'table-sheet--embedded' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <section
      className={rootClassName}
      data-table-sheet="true"
      aria-labelledby={titleId}
      onKeyDown={onClose ? (event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        event.stopPropagation()
        onClose()
      } : undefined}
    >
      <header className="table-sheet__header">
        <div className="table-sheet__heading">
          <div className="table-sheet__eyebrow">{eyebrow}</div>
          <h2 id={titleId}>{title}</h2>
          <p>
            {formatInteger(reportedCount)} row{reportedCount === 1 ? '' : 's'} returned
            {' · '}{columns.length} column{columns.length === 1 ? '' : 's'}
            {result.elapsedMs === undefined ? '' : ` · ${formatElapsed(result.elapsedMs)}`}
          </p>
        </div>
        <div className="table-sheet__header-actions">
          <span className="table-sheet__readonly" aria-label="This sheet is read only">Read only</span>
          {onClose && (
            <button
              ref={closeButtonRef}
              type="button"
              className="table-sheet__close"
              aria-label={closeLabel}
              onClick={onClose}
            >
              Close table
            </button>
          )}
        </div>
      </header>

      <div className="table-sheet__toolbar">
        <div className="table-sheet__formula" aria-label="Selected cell value">
          <span aria-label={`Selected cell ${activeCoordinate}`}>{activeCoordinate}</span>
          <output>{activeFormatted?.text ?? 'Select a cell'}</output>
        </div>
        <label className="table-sheet__search">
          <span className="table-sheet__sr">Filter the {formatInteger(loadedCount)} loaded result rows</span>
          <input
            type="search"
            value={filter}
            placeholder="Filter loaded rows"
            onChange={(event) => setFilter(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="table-sheet__copy"
          onClick={() => { void copyActiveCell() }}
          disabled={!activeFormatted}
          aria-describedby={statusId}
        >
          {copyState === 'copied' ? 'Copied' : 'Copy cell'}
        </button>
        <span id={statusId} className="table-sheet__sr" aria-live="polite">
          {copyState === 'copied' ? `${activeCoordinate} copied to the clipboard.` : ''}
          {copyState === 'error' ? 'Clipboard access is unavailable. Select and copy the value from the formula bar.' : ''}
        </span>
      </div>

      <p id={helpId} className="table-sheet__sr">
        Read-only spreadsheet. Use arrow keys to move between cells, Command or Control C to copy, column headers to sort, and the resize handles to change display widths. Sorting and filtering do not change the graded query result.
      </p>

      <div
        ref={gridRef}
        className="table-sheet__grid"
        role="grid"
        aria-label={sheetLabel}
        aria-describedby={helpId}
        aria-readonly="true"
        aria-rowcount={displayRows.length + 1}
        aria-colcount={columns.length + 1}
        aria-activedescendant={activeCellId}
        tabIndex={displayRows.length > 0 && columns.length > 0 ? 0 : -1}
        onKeyDown={handleGridKeyDown}
      >
        <table role="presentation">
          <colgroup>
            <col className="table-sheet__row-number-col" />
            {columns.map((column, columnIndex) => (
              <col key={`${column}-${columnIndex}`} style={{ width: widthFor(columnIndex) }} />
            ))}
          </colgroup>
          <thead>
            <tr role="row">
              <th className="table-sheet__corner" role="columnheader" aria-label="Row numbers" />
              {columns.map((column, columnIndex) => {
                const activeSort = sort?.column === columnIndex ? sort.direction : null
                const nextSort = activeSort === null ? 'ascending' : activeSort === 'asc' ? 'descending' : 'original order'
                const width = widthFor(columnIndex)
                return (
                  <th
                    key={`${column}-${columnIndex}`}
                    role="columnheader"
                    scope="col"
                    aria-sort={activeSort === 'asc' ? 'ascending' : activeSort === 'desc' ? 'descending' : 'none'}
                  >
                    <button
                      type="button"
                      className="table-sheet__sort"
                      onClick={() => cycleSort(columnIndex)}
                      aria-label={`Sort ${column} in ${nextSort}`}
                    >
                      <span className="table-sheet__column-letter" aria-hidden="true">{spreadsheetColumnName(columnIndex)}</span>
                      <span className="table-sheet__column-name">{column}</span>
                      <span className="table-sheet__sort-mark" aria-hidden="true">{activeSort === 'asc' ? '↑' : activeSort === 'desc' ? '↓' : ''}</span>
                    </button>
                    <span
                      className="table-sheet__column-resizer"
                      role="separator"
                      aria-label={`Resize ${column} column`}
                      aria-orientation="vertical"
                      aria-valuemin={safeMinWidth}
                      aria-valuemax={safeMaxWidth}
                      aria-valuenow={width}
                      aria-valuetext={`${width} pixels wide`}
                      tabIndex={0}
                      onPointerDown={(event) => startResize(event, columnIndex)}
                      onPointerMove={moveResize}
                      onPointerUp={finishResize}
                      onPointerCancel={finishResize}
                      onLostPointerCapture={() => { resizeRef.current = null }}
                      onKeyDown={(event) => resizeWithKeyboard(event, columnIndex)}
                      onDoubleClick={() => updateColumnWidth(columnIndex, baseColumnWidth)}
                    />
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((entry, displayRowIndex) => (
              <tr key={entry.sourceIndex} role="row">
                <th className="table-sheet__row-number" role="rowheader" scope="row">{displayRowIndex + 1}</th>
                {columns.map((column, columnIndex) => {
                  const value = entry.row[columnIndex]
                  const type = result.types?.[columnIndex] ?? ''
                  const formatted = normalizeFormattedCell(formatCell(value, column, type), value, type)
                  const isSelected = entry.sourceIndex === effectiveEntry?.sourceIndex && columnIndex === effectiveColumn
                  return (
                    <td
                      id={cellId(instanceId, entry.sourceIndex, columnIndex)}
                      key={columnIndex}
                      role="gridcell"
                      aria-selected={isSelected}
                      aria-readonly="true"
                      data-selected={isSelected ? 'true' : 'false'}
                      data-source-row={entry.sourceIndex}
                      data-column={columnIndex}
                      className={[
                        formatted.num ? 'table-sheet__number' : '',
                        formatted.neg ? 'table-sheet__negative' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => selectCell(entry, columnIndex)}
                      title={formatted.text}
                    >
                      {formatted.text}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {displayRows.length === 0 && (
          <div className="table-sheet__empty" role="status">
            {filter ? `No loaded rows match “${filter}”.` : emptyMessage}
          </div>
        )}
      </div>

      <footer className="table-sheet__footer">
        <span>{formatInteger(displayRows.length)} visible · {formatInteger(loadedCount)} loaded</span>
        {result.truncated && (
          <span className="table-sheet__truncated">
            {result.totalRowCount !== null && result.totalRowCount !== undefined
              ? `Showing ${formatInteger(loadedCount)} of ${formatInteger(result.totalRowCount)} total rows`
              : 'Showing the first loaded rows'}
          </span>
        )}
        <span>Arrow keys move · ⌘/Ctrl+C copies</span>
      </footer>
    </section>
  )
}

function defaultFormatCell(value: unknown, _columnName: string, columnType: string): TableSheetFormattedCell {
  if (value === null || value === undefined) return { text: '—', num: isNumericType(columnType) }
  if (value instanceof Date) return { text: value.toISOString().slice(0, 10) }
  if (typeof value === 'number') return { text: NUMBER_FORMAT.format(value), num: true, neg: value < 0 }
  if (typeof value === 'bigint') return { text: value.toLocaleString('en-US'), num: true, neg: value < 0n }
  if (typeof value === 'boolean') return { text: value ? 'true' : 'false' }
  if (typeof value === 'object') {
    try { return { text: JSON.stringify(value) } } catch { return { text: String(value) } }
  }
  return { text: String(value) }
}

function normalizeFormattedCell(
  formatted: string | TableSheetFormattedCell,
  value: unknown,
  columnType: string,
): TableSheetFormattedCell {
  if (typeof formatted !== 'string') return formatted
  const numeric = typeof value === 'number' || typeof value === 'bigint' || isNumericType(columnType)
  return {
    text: formatted,
    num: numeric,
    neg: (typeof value === 'number' && value < 0) || (typeof value === 'bigint' && value < 0n),
  }
}

function searchableCellText(formatted: string, value: unknown): string[] {
  const displayed = formatted.toLocaleLowerCase()
  let raw = ''
  if (value instanceof Date) raw = value.toISOString()
  else if (typeof value === 'object' && value !== null) {
    try { raw = JSON.stringify(value) } catch { raw = String(value) }
  } else if (value !== null && value !== undefined) raw = String(value)

  const normalizedRaw = raw.toLocaleLowerCase()
  return normalizedRaw && normalizedRaw !== displayed ? [displayed, normalizedRaw] : [displayed]
}

function compareValues(
  left: unknown,
  right: unknown,
  formatter: TableSheetCellFormatter,
  columnName: string,
  columnType: string,
): number {
  if (left === right) return 0
  if (left === null || left === undefined) return 1
  if (right === null || right === undefined) return -1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  if (typeof left === 'bigint' && typeof right === 'bigint') return left < right ? -1 : 1
  if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime()
  const leftText = normalizeFormattedCell(formatter(left, columnName, columnType), left, columnType).text
  const rightText = normalizeFormattedCell(formatter(right, columnName, columnType), right, columnType).text
  return leftText.localeCompare(rightText, undefined, { numeric: true, sensitivity: 'base' })
}

function spreadsheetColumnName(index: number): string {
  let value = index + 1
  let name = ''
  while (value > 0) {
    value -= 1
    name = String.fromCharCode(65 + (value % 26)) + name
    value = Math.floor(value / 26)
  }
  return name
}

function cellId(instanceId: string, sourceIndex: number, column: number): string {
  return `${instanceId}-cell-${sourceIndex}-${column}`
}

function isNumericType(type: string): boolean {
  return /(Float|Int|Decimal|Double|Numeric|Real|HugeInt)/i.test(type)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

function formatElapsed(milliseconds: number): string {
  return milliseconds < 1000 ? `${milliseconds.toFixed(0)}ms` : `${(milliseconds / 1000).toFixed(1)}s`
}

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Embedded and non-secure contexts can expose the API but reject writes.
      // Continue to the synchronous fallback while this user gesture is live.
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('Clipboard unavailable')
}
