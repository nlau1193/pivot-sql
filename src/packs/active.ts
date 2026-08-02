import { ACTIVE_PACK_ID, type PackManifest } from '../kit/pack-manifest'
import { parklineDeskPaths, type DeskPath } from '../kit/path-registry'
import parklineFpaManifest from '../packs/parkline-fpa/manifest'
import engineerDeskManifest from '../packs/engineer-desk/manifest'
import designerDeskManifest from '../packs/designer-desk/manifest'

/** All registered packs — only ACTIVE_PACK_ID is playable today. */
const PACKS: Record<string, PackManifest> = {
  [parklineFpaManifest.id]: parklineFpaManifest,
  [engineerDeskManifest.id]: engineerDeskManifest,
  [designerDeskManifest.id]: designerDeskManifest,
}

export function registeredPacks(): PackManifest[] {
  return Object.values(PACKS)
}

/** Active content pack — Parkline FP&A until multi-pack install exists. */
export function activePack(): PackManifest {
  const pack = PACKS[ACTIVE_PACK_ID]
  if (!pack) throw new Error(`Active pack ${ACTIVE_PACK_ID} is not registered`)
  return pack
}

/** Packs that are playable in this build (kernel seam for future install UI). */
export function installedPacks(): PackManifest[] {
  return registeredPacks().filter((pack) => pack.id === ACTIVE_PACK_ID)
}

/** Packs registered for a future install seam; no learner-facing cards imply they exist. */
export function notInstalledPacks(): PackManifest[] {
  const installed = new Set(installedPacks().map((pack) => pack.id))
  return registeredPacks().filter((pack) => !installed.has(pack.id))
}

export function deskPathsForActivePack(opts: { screensUnlocked: boolean }): DeskPath[] {
  const pack = activePack()
  const allowed = new Set(pack.pathIds)
  return parklineDeskPaths({ ...opts, place: pack.place }).filter((path) => allowed.has(path.id))
}

export function screenUnlockMissionId(): string | null {
  return activePack().screenUnlockMissionId
}
