/**
 * Open-world path session — remembers the last desk direction per pack so
 * reopening Your desk continues without punishing exploration.
 *
 * Kept outside ProgressV2 on purpose: path choice is session preference, not
 * graded evidence. Pack-scoped keys keep Eng/Design installs isolated later.
 *
 * This module is the public contract for path sessions.
 */

import type { PathId } from './path-registry'
import { ACTIVE_PACK_ID } from './pack-manifest'

const PATH_IDS: ReadonlySet<string> = new Set([
  'mission-ladder',
  'free-explore',
  'career-dossier',
  'screen-practice',
  'scenario-library',
])

function storageKey(packId: string): string {
  return `pivot.pathSession.v1.${packId}`
}

export interface PathSession {
  packId: string
  lastPathId: PathId
  lastScenarioId: string | null
  updatedAt: string
}

function isPathId(value: unknown): value is PathId {
  return typeof value === 'string' && PATH_IDS.has(value)
}

export function loadPathSession(packId: string = ACTIVE_PACK_ID): PathSession | null {
  try {
    const raw = localStorage.getItem(storageKey(packId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const record = parsed as Record<string, unknown>
    if (record.packId !== packId || !isPathId(record.lastPathId)) return null
    if (typeof record.updatedAt !== 'string') return null
    return {
      packId,
      lastPathId: record.lastPathId,
      lastScenarioId: typeof record.lastScenarioId === 'string' && record.lastScenarioId.length > 0 ? record.lastScenarioId : null,
      updatedAt: record.updatedAt,
    }
  } catch {
    return null
  }
}

export function savePathSession(pathId: PathId, packId: string = ACTIVE_PACK_ID, scenarioId?: string | null): PathSession {
  const priorScenarioId = loadPathSession(packId)?.lastScenarioId ?? null
  const session: PathSession = {
    packId,
    lastPathId: pathId,
    lastScenarioId: scenarioId === undefined ? priorScenarioId : scenarioId,
    updatedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(storageKey(packId), JSON.stringify(session))
  } catch {
    // Private mode / quota — preference is best-effort; never throw into Desk.
  }
  return session
}

export function pathTitle(pathId: PathId): string {
  switch (pathId) {
    case 'mission-ladder':
      return 'Next guided task'
    case 'free-explore':
      return 'Explore company data'
    case 'career-dossier':
      return 'Progress'
    case 'screen-practice':
      return 'Screen practice'
    case 'scenario-library':
      return 'Scenario library'
  }
}
