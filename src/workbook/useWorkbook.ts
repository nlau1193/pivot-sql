import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  activateWorkbookTab,
  activeWorkbookTab,
  closeWorkbookRelation,
  createWorkbookState,
  deserializeWorkbookState,
  normalizeRelationIds,
  openWorkbookRelation,
  reconcileWorkbookState,
  serializeWorkbookState,
  workbookStatesEqual,
  workbookTabs,
  type WorkbookState,
  type WorkbookTab,
  type WorkbookTabSelection,
} from './model'

/** Minimal Storage surface keeps tests and non-browser hosts easy to inject. */
export interface WorkbookStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface WorkbookPersistence {
  /** Scope this per pack/workspace in the caller. */
  readonly key: string
  /** Defaults to localStorage when it is safely available. */
  readonly storage?: WorkbookStorage
}

export interface UseWorkbookOptions<RelationId extends string> {
  readonly relationIds: readonly RelationId[]
  readonly initialOpenRelationIds?: readonly RelationId[]
  readonly initialActiveTab?: WorkbookTabSelection<RelationId>
  /** Persistence is opt-in; only safe tab identity/order state is stored. */
  readonly persistence?: WorkbookPersistence
}

export interface UseWorkbookResult<RelationId extends string> {
  readonly state: WorkbookState<RelationId>
  readonly tabs: readonly WorkbookTab<RelationId>[]
  readonly activeTab: WorkbookTab<RelationId>
  readonly activeRelationId: RelationId | null
  readonly isRelationshipsActive: boolean
  readonly openRelation: (relationId: RelationId) => void
  readonly closeRelation: (relationId: RelationId) => void
  readonly activateTab: (tab: WorkbookTabSelection<RelationId>) => void
  readonly activateRelationships: () => void
  readonly isRelationOpen: (relationId: RelationId) => boolean
  readonly resetWorkbook: () => void
}

/**
 * Owns workbook tab navigation without importing any pack schema or UI.
 * Relation metadata, table rows, canvas positions, and labels remain with the
 * caller so this hook can be reused by future day-in-the-life products.
 */
export function useWorkbook<RelationId extends string>({
  relationIds,
  initialOpenRelationIds = [],
  initialActiveTab = { kind: 'relationships' },
  persistence,
}: UseWorkbookOptions<RelationId>): UseWorkbookResult<RelationId> {
  const relationSignature = JSON.stringify(relationIds)
  const initialOpenSignature = JSON.stringify(initialOpenRelationIds)
  const initialActiveSignature = initialActiveTab.kind === 'table'
    ? `table:${initialActiveTab.relationId}`
    : 'relationships'

  const availableRelationIds = useMemo(
    () => normalizeRelationIds(relationIds),
    // The value signature avoids needless resets when an adapter recreates its array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [relationSignature],
  )
  const fallbackState = useMemo(
    () => createWorkbookState(availableRelationIds, {
      openRelationIds: initialOpenRelationIds,
      activeTab: initialActiveTab,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [relationSignature, initialOpenSignature, initialActiveSignature],
  )
  const storage = persistence?.storage ?? safeBrowserStorage()
  const persistenceKey = persistence?.key

  const [state, setState] = useState<WorkbookState<RelationId>>(() => (
    readPersistedState(persistenceKey, storage, availableRelationIds, fallbackState)
  ))
  const persistenceIdentityRef = useRef({ key: persistenceKey, storage })
  const skipNextPersistRef = useRef(false)

  useEffect(() => {
    setState((current) => reconcileWorkbookState(current, availableRelationIds))
  }, [availableRelationIds])

  // A caller can reuse one mounted workbook for another pack/storage scope.
  // Rehydrate that scope without first writing the previous scope into it.
  useEffect(() => {
    const prior = persistenceIdentityRef.current
    if (prior.key === persistenceKey && prior.storage === storage) return
    persistenceIdentityRef.current = { key: persistenceKey, storage }
    skipNextPersistRef.current = true
    setState(readPersistedState(persistenceKey, storage, availableRelationIds, fallbackState))
  }, [availableRelationIds, fallbackState, persistenceKey, storage])

  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false
      return
    }
    if (!persistenceKey || !storage) return
    try {
      storage.setItem(persistenceKey, serializeWorkbookState(state))
    } catch {
      // Private mode/quota failures cannot make the workbook unusable.
    }
  }, [persistenceKey, state, storage])

  const tabs = useMemo(() => workbookTabs(state), [state])
  const activeTab = useMemo(() => activeWorkbookTab(state), [state])

  const openRelation = useCallback((relationId: RelationId) => {
    setState((current) => openWorkbookRelation(current, relationId, availableRelationIds))
  }, [availableRelationIds])

  const closeRelation = useCallback((relationId: RelationId) => {
    setState((current) => closeWorkbookRelation(current, relationId))
  }, [])

  const activateTab = useCallback((tab: WorkbookTabSelection<RelationId>) => {
    setState((current) => activateWorkbookTab(current, tab, availableRelationIds))
  }, [availableRelationIds])

  const activateRelationships = useCallback(() => {
    setState((current) => activateWorkbookTab(
      current,
      { kind: 'relationships' },
      availableRelationIds,
    ))
  }, [availableRelationIds])

  const isRelationOpen = useCallback(
    (relationId: RelationId) => state.openRelationIds.includes(relationId),
    [state.openRelationIds],
  )

  const resetWorkbook = useCallback(() => {
    setState((current) => workbookStatesEqual(current, fallbackState) ? current : fallbackState)
  }, [fallbackState])

  return {
    state,
    tabs,
    activeTab,
    activeRelationId: state.activeTab.kind === 'table' ? state.activeTab.relationId : null,
    isRelationshipsActive: state.activeTab.kind === 'relationships',
    openRelation,
    closeRelation,
    activateTab,
    activateRelationships,
    isRelationOpen,
    resetWorkbook,
  }
}

function readPersistedState<RelationId extends string>(
  key: string | undefined,
  storage: WorkbookStorage | null,
  availableRelationIds: readonly RelationId[],
  fallback: WorkbookState<RelationId>,
): WorkbookState<RelationId> {
  if (!key || !storage) return fallback
  try {
    return deserializeWorkbookState(storage.getItem(key), availableRelationIds, fallback)
  } catch {
    return fallback
  }
}

function safeBrowserStorage(): WorkbookStorage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}
