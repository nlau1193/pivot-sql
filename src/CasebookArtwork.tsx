import { useId } from 'react'

export interface CasebookArtworkProps {
  className?: string
  compact?: boolean
  place: string
}

/**
 * Token-colorable casebook art: six connected work artifacts, kept decorative
 * enough for a quiet desk while retaining an accessible description.
 */
export function CasebookArtwork({ className = '', compact = false, place }: CasebookArtworkProps) {
  const id = useId()
  const titleId = `${id}-title`
  const descriptionId = `${id}-description`

  return (
    <svg
      className={`casebook-artwork ${compact ? 'casebook-artwork--compact' : ''} ${className}`.trim()}
      viewBox="0 0 720 320"
      role="img"
      aria-labelledby={`${titleId} ${descriptionId}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <title id={titleId}>The {place} casebook</title>
      <desc id={descriptionId}>Six connected finance work artifacts: a general ledger, trend report, joined report, close calendar, retention bridge, and interview notepad.</desc>

      <path className="casebook-artwork__path" d="M86 98 C154 37 214 159 286 108 S411 45 461 120 558 207 645 137" />

      <g className="casebook-artwork__paper casebook-artwork__ledger" transform="translate(30 52) rotate(-3 72 54)">
        <rect width="144" height="108" rx="8" />
        <path d="M18 24h72M18 40h108M18 56h108M18 72h108M18 88h108M94 20v72" />
        <circle className="casebook-artwork__pin" cx="124" cy="18" r="5" />
      </g>

      <g className="casebook-artwork__paper casebook-artwork__trend" transform="translate(191 112) rotate(2 65 47)">
        <rect width="130" height="94" rx="8" />
        <path d="M18 72V20M18 72h94" />
        <path className="casebook-artwork__accent" d="m25 64 22-18 20 8 21-27 24 8" />
        <circle cx="47" cy="46" r="3" /><circle cx="67" cy="54" r="3" /><circle cx="88" cy="27" r="3" />
      </g>

      <g className="casebook-artwork__joined" transform="translate(308 38) rotate(-2 74 51)">
        <rect className="casebook-artwork__paper" x="12" y="0" width="136" height="92" rx="8" />
        <rect className="casebook-artwork__paper casebook-artwork__paper--under" x="0" y="12" width="136" height="92" rx="8" />
        <path d="M20 34h93M20 50h93M20 66h93M70 26v49" />
        <path className="casebook-artwork__join-mark" d="M112 83c10-10 20-10 30 0M127 68v30" />
      </g>

      <g className="casebook-artwork__calendar" transform="translate(445 139) rotate(3 60 50)">
        <rect className="casebook-artwork__paper" width="120" height="100" rx="8" />
        <path className="casebook-artwork__calendar-head" d="M0 25h120" />
        <path d="M20 42h18v15H20zM51 42h18v15H51zM82 42h18v15H82zM20 67h18v15H20zM51 67h18v15H51z" />
        <path className="casebook-artwork__late-note" d="m80 71 34-17 12 25-34 17z" />
      </g>

      <g className="casebook-artwork__paper casebook-artwork__bridge" transform="translate(557 42) rotate(2 66 51)">
        <rect width="132" height="102" rx="8" />
        <path d="M16 82h100" />
        <path className="casebook-artwork__bar casebook-artwork__bar--green" d="M20 34h23v48H20z" />
        <path className="casebook-artwork__bar casebook-artwork__bar--amber" d="M46 48h23v34H46z" />
        <path className="casebook-artwork__bar casebook-artwork__bar--clay" d="M72 61h18v21H72z" />
        <path className="casebook-artwork__bar casebook-artwork__bar--green" d="M93 28h23v54H93z" />
      </g>

      <g className="casebook-artwork__notepad" transform="translate(562 197) rotate(-3 64 48)">
        <rect className="casebook-artwork__paper" width="128" height="96" rx="8" />
        <path d="M22 26h72M22 42h82M22 58h62M22 74h74" />
        <path className="casebook-artwork__margin" d="M14 12v72" />
        <path className="casebook-artwork__pencil" d="m92 82 30-30 7 7-30 30-10 3z" />
      </g>
    </svg>
  )
}
