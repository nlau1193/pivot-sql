export type DeskCrewId = 'riff' | 'rex' | 'coco' | 'zi' | 'fin' | 'frosty'
export type MissionSenderId = 'priya' | 'elena' | 'maria' | 'danny' | 'fin'

export interface DeskCrewCharacter {
  id: DeskCrewId
  name: string
  species: string
  role: string
  assistRole: string
  portraitSrc: string
}

function publicPortrait(emoji: string, background: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="38" fill="${background}"/><text x="80" y="106" text-anchor="middle" font-size="88">${emoji}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export const DESK_CREW: Record<DeskCrewId, DeskCrewCharacter> = {
  riff: {
    id: 'riff',
    name: 'Riff',
    species: 'giraffe',
    role: 'CFO',
    assistRole: 'Structure, schemas, and relationships',
    portraitSrc: publicPortrait('🦒', '#f3dfaa'),
  },
  rex: {
    id: 'rex',
    name: 'Rex',
    species: 'rhino',
    role: 'Controller',
    assistRole: 'Controls, joins, duplicates, and NULLs',
    portraitSrc: publicPortrait('🦏', '#d8d9d4'),
  },
  coco: {
    id: 'coco',
    name: 'Coco',
    species: 'dog',
    role: 'People Partner',
    assistRole: 'Partner narration and verbal rehearsal',
    portraitSrc: publicPortrait('🐶', '#e9c8a6'),
  },
  zi: {
    id: 'zi',
    name: 'Zi',
    species: 'penguin',
    role: 'CEO',
    assistRole: 'Execution state, outcomes, and next moves',
    portraitSrc: publicPortrait('🐧', '#c8dce4'),
  },
  fin: {
    id: 'fin',
    name: 'Fin',
    species: 'shark',
    role: 'Data Lead',
    assistRole: 'SQL correctness, grain, and query invariants',
    portraitSrc: publicPortrait('🦈', '#bcd6d6'),
  },
  frosty: {
    id: 'frosty',
    name: 'Frosty',
    species: 'koala',
    role: 'Recovery Coach',
    assistRole: 'Calm hints and error recovery',
    portraitSrc: publicPortrait('🐨', '#d8d2c8'),
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
