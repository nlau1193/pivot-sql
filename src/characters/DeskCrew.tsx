import { DESK_CREW, DESK_CREW_ORDER, deskCrewAlt, type DeskCrewId } from './desk-crew'

export function DeskCrew({ ids = DESK_CREW_ORDER }: { ids?: readonly DeskCrewId[] }) {
  return (
    <div className="desk-crew" aria-label="Meet the Star67 desk crew">
      {ids.map((id) => {
        const character = DESK_CREW[id]
        return (
          <figure className={`desk-crew__member desk-crew__member--${id}`} key={id}>
            <div className="desk-crew__portrait-frame">
              <img src={character.portraitSrc} alt={deskCrewAlt(character)} />
            </div>
            <figcaption>
              <strong>{character.name}</strong>
              <span>{character.assistRole}</span>
            </figcaption>
          </figure>
        )
      })}
    </div>
  )
}
