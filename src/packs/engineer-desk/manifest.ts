import type { PackManifest } from '../../kit/pack-manifest'

/**
 * Engineer day-in-the-life stub — registered, not active.
 * Future vertical: GitHub issues/PRs as quests over the immersion kernel.
 * Expectations stay at zero until authored content ships.
 */
export const engineerDeskManifest: PackManifest = {
  id: 'engineer-desk',
  place: 'Generic eng desk',
  role: 'engineer',
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

export default engineerDeskManifest
