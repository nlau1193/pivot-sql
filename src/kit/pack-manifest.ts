/**
 * Content-pack manifest contract — role-agnostic immersion kernel boundary.
 * Packs declare identity, paths, integrations, and content pointers without
 * baking private user or machine state into the kit.
 *
 * This manifest is the public pack contract.
 */

import type { PathId } from './path-registry'
import type { IntegrationId } from '../integrations/types'

export type PackRole = 'fpa' | 'engineer' | 'designer'

export interface PackManifest {
  /** Stable pack id, e.g. parkline-fpa */
  id: string
  /** Human place name — fictional training warehouse or company place */
  place: string
  role: PackRole
  version: 1
  /** Open-world desk directions this pack exposes */
  pathIds: PathId[]
  /** Integrations the pack may request; the local workspace stays disconnected */
  integrationIds: IntegrationId[]
  /** Capstone mission id that unlocks screen practice, if any */
  screenUnlockMissionId: string | null
  /** Expected content floors (fail-closed at build) */
  expectations: {
    minMissions: number
    minSims: number
    minStages: number
    minBadges: number
    minCompanyCards: number
  }
}

export const ACTIVE_PACK_ID = 'parkline-fpa' as const
