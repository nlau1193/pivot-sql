export type DeskCrewId = 'riff' | 'rex' | 'coco' | 'zi' | 'fin' | 'frosty'
export type MissionSenderId = 'priya' | 'elena' | 'maria' | 'danny' | 'fin'

export interface DeskCrewCharacter {
  id: DeskCrewId
  name: string
  species: string
  role: string
  assistRole: string
  origin: 'Animina'
  portraitSrc: string
}

export const DESK_CREW: Record<DeskCrewId, DeskCrewCharacter> = {
  riff: {
    id: 'riff',
    name: 'Riff',
    species: 'giraffe',
    role: 'CFO',
    assistRole: 'Structure, schemas, and relationships',
    origin: 'Animina',
    portraitSrc: '/characters/desk-crew/base/riff-giraffe.png',
  },
  rex: {
    id: 'rex',
    name: 'Rex',
    species: 'rhino',
    role: 'Controller',
    assistRole: 'Controls, joins, duplicates, and NULLs',
    origin: 'Animina',
    portraitSrc: '/characters/desk-crew/base/rex-rhino.png',
  },
  coco: {
    id: 'coco',
    name: 'Coco',
    species: 'dog',
    role: 'People Partner',
    assistRole: 'Partner narration and verbal rehearsal',
    origin: 'Animina',
    portraitSrc: '/characters/desk-crew/base/coco-dog.png',
  },
  zi: {
    id: 'zi',
    name: 'Zi',
    species: 'penguin',
    role: 'CEO',
    assistRole: 'Execution state, outcomes, and next moves',
    origin: 'Animina',
    portraitSrc: '/characters/desk-crew/base/zi-penguin.png',
  },
  fin: {
    id: 'fin',
    name: 'Fin',
    species: 'shark',
    role: 'Data Lead',
    assistRole: 'SQL correctness, grain, and query invariants',
    origin: 'Animina',
    portraitSrc: '/characters/desk-crew/base/fin-shark.png',
  },
  frosty: {
    id: 'frosty',
    name: 'Frosty',
    species: 'koala',
    role: 'Recovery Coach',
    assistRole: 'Calm hints and error recovery',
    origin: 'Animina',
    portraitSrc: '/characters/desk-crew/base/frosty-koala.png',
  },
}

export const DESK_CREW_ORDER: readonly DeskCrewId[] = ['riff', 'rex', 'coco', 'zi', 'fin', 'frosty']

// Sender keys are persisted in mission content and old solve receipts. Keep
// those keys stable while the visible Star67 cast evolves independently.
export const MISSION_SENDERS: Record<MissionSenderId, DeskCrewCharacter> = {
  priya: DESK_CREW.riff,
  elena: DESK_CREW.rex,
  maria: DESK_CREW.coco,
  danny: DESK_CREW.zi,
  fin: DESK_CREW.fin,
}

export function deskCrewAlt(character: DeskCrewCharacter): string {
  return `${character.name}, the ${character.species} ${character.role} at Star67`
}
