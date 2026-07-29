/**
 * Pack-agnostic workbook navigation state.
 *
 * The model deliberately stores relation identities rather than table data,
 * labels, or pack copy. A pack adapter owns those details; this module only
 * keeps the pinned Relationships tab and any open table tabs coherent.
 */

export const RELATIONSHIPS_TAB_ID = 'relationships' as const
export const WORKBOOK_STATE_VERSION = 1 as const

export interface RelationshipsWorkbookTab {
  readonly id: typeof RELATIONSHIPS_TAB_ID
  readonly kind: 'relationships'
  readonly pinned: true
  readonly closeable: false
}

export interface TableWorkbookTab<RelationId extends string = string> {
  readonly id: `table:${RelationId}`
  readonly kind: 'table'
  readonly relationId: RelationId
  readonly pinned: false
  readonly closeable: true
}

export type WorkbookTab<RelationId extends string = string> =
  | RelationshipsWorkbookTab
  | TableWorkbookTab<RelationId>

export type WorkbookTabSelection<RelationId extends string = string> =
  | { readonly kind: 'relationships' }
  | { readonly kind: 'table'; readonly relationId: RelationId }

export interface WorkbookState<RelationId extends string = string> {
  /** Ordered by when each table was first opened. */
  readonly openRelationIds: readonly RelationId[]
  /** Identity-based, so catalog reordering cannot silently switch the tab. */
  readonly activeTab: WorkbookTabSelection<RelationId>
}

export interface WorkbookInitialState<RelationId extends string = string> {
  readonly openRelationIds?: readonly RelationId[]
  readonly activeTab?: WorkbookTabSelection<RelationId>
}

interface PersistedWorkbookStateV1 {
  readonly version: typeof WORKBOOK_STATE_VERSION
  readonly openRelationIds: readonly string[]
  readonly activeTab:
    | { readonly kind: 'relationships' }
    | { readonly kind: 'table'; readonly relationId: string }
}

const RELATIONSHIPS_TAB: RelationshipsWorkbookTab = Object.freeze({
  id: RELATIONSHIPS_TAB_ID,
  kind: 'relationships',
  pinned: true,
  closeable: false,
})

const RELATIONSHIPS_SELECTION: WorkbookTabSelection<never> = Object.freeze({
  kind: 'relationships',
})

type UnknownRecord = Record<string, unknown>

/** Removes empty/duplicate runtime ids without imposing a catalog-size limit. */
export function normalizeRelationIds<RelationId extends string>(
  relationIds: readonly RelationId[],
): RelationId[] {
  const seen = new Set<string>()
  const normalized: RelationId[] = []

  for (const relationId of relationIds) {
    if (typeof relationId !== 'string' || relationId.length === 0 || seen.has(relationId)) continue
    seen.add(relationId)
    normalized.push(relationId)
  }

  return normalized
}

export function createWorkbookState<RelationId extends string>(
  availableRelationIds: readonly RelationId[],
  initial: WorkbookInitialState<RelationId> = {},
): WorkbookState<RelationId> {
  const available = normalizeRelationIds(availableRelationIds)
  const availableSet = new Set<string>(available)
  const openRelationIds = normalizeRelationIds(initial.openRelationIds ?? [])
    .filter((relationId) => availableSet.has(relationId))

  if (initial.activeTab?.kind === 'table' && availableSet.has(initial.activeTab.relationId)) {
    if (!openRelationIds.includes(initial.activeTab.relationId)) {
      openRelationIds.push(initial.activeTab.relationId)
    }
    return {
      openRelationIds,
      activeTab: { kind: 'table', relationId: initial.activeTab.relationId },
    }
  }

  return {
    openRelationIds,
    activeTab: relationshipsSelection(),
  }
}

/**
 * Reconciles state when a pack's live catalog changes. Existing tab order is
 * preserved. If the active relation disappeared, the next surviving tab to
 * its right wins, then the nearest tab to its left, then Relationships.
 */
export function reconcileWorkbookState<RelationId extends string>(
  state: WorkbookState<RelationId>,
  availableRelationIds: readonly RelationId[],
): WorkbookState<RelationId> {
  const availableSet = new Set<string>(normalizeRelationIds(availableRelationIds))
  const priorOpen = normalizeRelationIds(state.openRelationIds)
  const openRelationIds = priorOpen.filter((relationId) => availableSet.has(relationId))
  let activeTab: WorkbookTabSelection<RelationId> = relationshipsSelection()

  if (state.activeTab.kind === 'table') {
    if (openRelationIds.includes(state.activeTab.relationId)) {
      activeTab = state.activeTab
    } else {
      activeTab = neighboringSelection(priorOpen, openRelationIds, state.activeTab.relationId)
    }
  }

  const next: WorkbookState<RelationId> = { openRelationIds, activeTab }
  return workbookStatesEqual(state, next) ? state : next
}

/** Opens a relation once and always focuses its existing or newly appended tab. */
export function openWorkbookRelation<RelationId extends string>(
  state: WorkbookState<RelationId>,
  relationId: RelationId,
  availableRelationIds: readonly RelationId[],
): WorkbookState<RelationId> {
  if (!normalizeRelationIds(availableRelationIds).includes(relationId)) return state

  const alreadyOpen = state.openRelationIds.includes(relationId)
  if (alreadyOpen && state.activeTab.kind === 'table' && state.activeTab.relationId === relationId) {
    return state
  }

  return {
    openRelationIds: alreadyOpen ? state.openRelationIds : [...state.openRelationIds, relationId],
    activeTab: { kind: 'table', relationId },
  }
}

/**
 * Closes one table tab. Closing the active tab prefers the tab immediately to
 * its right, then the one to its left, then the pinned Relationships tab.
 */
export function closeWorkbookRelation<RelationId extends string>(
  state: WorkbookState<RelationId>,
  relationId: RelationId,
): WorkbookState<RelationId> {
  const closeIndex = state.openRelationIds.indexOf(relationId)
  if (closeIndex < 0) return state

  const openRelationIds = state.openRelationIds.filter((candidate) => candidate !== relationId)
  if (state.activeTab.kind !== 'table' || state.activeTab.relationId !== relationId) {
    return { openRelationIds, activeTab: state.activeTab }
  }

  return {
    openRelationIds,
    activeTab: neighboringSelection(state.openRelationIds, openRelationIds, relationId),
  }
}

export function activateWorkbookTab<RelationId extends string>(
  state: WorkbookState<RelationId>,
  tab: WorkbookTabSelection<RelationId>,
  availableRelationIds: readonly RelationId[],
): WorkbookState<RelationId> {
  if (tab.kind === 'relationships') {
    if (state.activeTab.kind === 'relationships') return state
    return { ...state, activeTab: relationshipsSelection() }
  }

  return openWorkbookRelation(state, tab.relationId, availableRelationIds)
}

/** Relationships is always first and can never be closed or displaced. */
export function workbookTabs<RelationId extends string>(
  state: WorkbookState<RelationId>,
): readonly WorkbookTab<RelationId>[] {
  return [
    RELATIONSHIPS_TAB,
    ...state.openRelationIds.map((relationId): TableWorkbookTab<RelationId> => ({
      id: tableTabId(relationId),
      kind: 'table',
      relationId,
      pinned: false,
      closeable: true,
    })),
  ]
}

export function activeWorkbookTab<RelationId extends string>(
  state: WorkbookState<RelationId>,
): WorkbookTab<RelationId> {
  if (state.activeTab.kind === 'relationships') return RELATIONSHIPS_TAB
  return {
    id: tableTabId(state.activeTab.relationId),
    kind: 'table',
    relationId: state.activeTab.relationId,
    pinned: false,
    closeable: true,
  }
}

/**
 * Serializes only safe navigation preference: relation ids, their tab order,
 * and the active identity. No rows, query text, labels, pack copy, or results.
 */
export function serializeWorkbookState<RelationId extends string>(
  state: WorkbookState<RelationId>,
): string {
  const payload: PersistedWorkbookStateV1 = {
    version: WORKBOOK_STATE_VERSION,
    openRelationIds: normalizeRelationIds(state.openRelationIds),
    activeTab: state.activeTab.kind === 'table'
      ? { kind: 'table', relationId: state.activeTab.relationId }
      : { kind: 'relationships' },
  }
  return JSON.stringify(payload)
}

/**
 * Parses a stored navigation preference defensively. Malformed envelopes use
 * the supplied fallback; well-formed envelopes are filtered against the live
 * pack catalog so removed relations cannot survive as ghost tabs.
 */
export function deserializeWorkbookState<RelationId extends string>(
  raw: string | null | undefined,
  availableRelationIds: readonly RelationId[],
  fallback: WorkbookState<RelationId> = createWorkbookState(availableRelationIds),
): WorkbookState<RelationId> {
  const safeFallback = reconcileWorkbookState(fallback, availableRelationIds)
  if (typeof raw !== 'string' || raw.length === 0) return safeFallback

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isPersistedWorkbookState(parsed)) return safeFallback

    const openRelationIds = normalizeRelationIds(parsed.openRelationIds)
    if (parsed.activeTab.kind === 'table' && !openRelationIds.includes(parsed.activeTab.relationId)) {
      return safeFallback
    }

    const hydrated: WorkbookState<RelationId> = {
      openRelationIds: openRelationIds as RelationId[],
      activeTab: parsed.activeTab.kind === 'table'
        ? { kind: 'table', relationId: parsed.activeTab.relationId as RelationId }
        : relationshipsSelection(),
    }
    return reconcileWorkbookState(hydrated, availableRelationIds)
  } catch {
    return safeFallback
  }
}

export function workbookStatesEqual<RelationId extends string>(
  left: WorkbookState<RelationId>,
  right: WorkbookState<RelationId>,
): boolean {
  if (left.activeTab.kind !== right.activeTab.kind) return false
  if (
    left.activeTab.kind === 'table'
    && right.activeTab.kind === 'table'
    && left.activeTab.relationId !== right.activeTab.relationId
  ) return false
  if (left.openRelationIds.length !== right.openRelationIds.length) return false
  return left.openRelationIds.every((relationId, index) => relationId === right.openRelationIds[index])
}

function neighboringSelection<RelationId extends string>(
  priorOpen: readonly RelationId[],
  remainingOpen: readonly RelationId[],
  removedRelationId: RelationId,
): WorkbookTabSelection<RelationId> {
  if (remainingOpen.length === 0) return relationshipsSelection()

  const removedIndex = priorOpen.indexOf(removedRelationId)
  if (removedIndex < 0) return relationshipsSelection()
  const remainingSet = new Set<string>(remainingOpen)

  for (let index = removedIndex + 1; index < priorOpen.length; index += 1) {
    if (remainingSet.has(priorOpen[index])) {
      return { kind: 'table', relationId: priorOpen[index] }
    }
  }
  for (let index = removedIndex - 1; index >= 0; index -= 1) {
    if (remainingSet.has(priorOpen[index])) {
      return { kind: 'table', relationId: priorOpen[index] }
    }
  }

  return relationshipsSelection()
}

function relationshipsSelection<RelationId extends string>(): WorkbookTabSelection<RelationId> {
  return RELATIONSHIPS_SELECTION
}

function tableTabId<RelationId extends string>(relationId: RelationId): `table:${RelationId}` {
  return `table:${relationId}`
}

function isPersistedWorkbookState(value: unknown): value is PersistedWorkbookStateV1 {
  if (!isRecord(value) || value.version !== WORKBOOK_STATE_VERSION) return false
  if (!Array.isArray(value.openRelationIds)) return false
  if (!value.openRelationIds.every((relationId) => typeof relationId === 'string' && relationId.length > 0)) {
    return false
  }
  if (!isRecord(value.activeTab)) return false
  if (value.activeTab.kind === 'relationships') return true
  return value.activeTab.kind === 'table'
    && typeof value.activeTab.relationId === 'string'
    && value.activeTab.relationId.length > 0
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
