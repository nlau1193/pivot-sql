import type { PackManifest } from '../../kit/pack-manifest'

/**
 * Designer day-in-the-life stub — registered, not active.
 * Future vertical: critique/spec quests; Figma adapter is horizon-only.
 * Expectations stay at zero until authored content ships.
 */
export const designerDeskManifest: PackManifest = {
  id: 'designer-desk',
  place: 'Generic design desk',
  role: 'designer',
  version: 1,
  pathIds: ['mission-ladder', 'free-explore', 'career-dossier'],
  screenUnlockMissionId: null,
  expectations: {
    minMissions: 0,
    minSims: 0,
    minStages: 0,
    minBadges: 0,
    minCompanyCards: 0,
  },
}

export default designerDeskManifest
