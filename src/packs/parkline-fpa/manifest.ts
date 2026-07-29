import type { PackManifest } from '../../kit/pack-manifest'

/** Star67 FP&A — compatibility id remains parkline-fpa. Eng/Design packs plug in later. */
export const parklineFpaManifest: PackManifest = {
  id: 'parkline-fpa',
  place: 'Star67',
  role: 'fpa',
  version: 1,
  pathIds: ['mission-ladder', 'scenario-library', 'free-explore', 'career-dossier', 'screen-practice'],
  integrationIds: ['github', 'slack'],
  screenUnlockMissionId: 'm17',
  expectations: {
    minMissions: 179,
    minSims: 3,
    minStages: 6,
    minBadges: 8,
    minCompanyCards: 9,
  },
}

export default parklineFpaManifest
