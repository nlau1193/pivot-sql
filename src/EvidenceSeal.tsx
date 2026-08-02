export interface EvidenceSealProps {
  id: string
  title: string
  description?: string
  guideName?: string
  progressLabel?: string
  nextEvidenceLabel?: string
  evidenceLabels?: readonly string[]
  earned?: boolean
  animate?: boolean
  className?: string
  onRevealEnd?: () => void
}

/**
 * A badge-shaped proof summary. Award state is deliberately supplied by a
 * derived selector; this component never stores or infers progression.
 */
export function EvidenceSeal({
  id,
  title,
  description,
  guideName,
  progressLabel,
  nextEvidenceLabel,
  evidenceLabels = [],
  earned = false,
  animate = false,
  className = '',
  onRevealEnd,
}: EvidenceSealProps) {
  const reveal = earned && animate
  const status = earned ? 'Skill earned' : 'In progress'

  return (
    <article
      className={`evidence-seal ${earned ? 'evidence-seal--earned' : ''} ${reveal ? 'evidence-seal--reveal' : ''} ${className}`.trim()}
      data-badge-id={id}
      data-earned={earned ? 'true' : 'false'}
      data-reveal={reveal ? 'true' : 'false'}
      data-guide={guideName ?? undefined}
      aria-label={`${title}: ${status}`}
    >
      <div
        className="evidence-seal__mark"
        aria-hidden="true"
        onAnimationEnd={(event) => {
          if (event.animationName === 'casebook-seal-delivered') onRevealEnd?.()
        }}
      >
        <svg viewBox="0 0 64 64" focusable="false">
          <path className="evidence-seal__deckle" d="M32 3.8 38 7l6.8-.8 3.7 5.7 6.6 1.8.8 6.8 4.3 5.3-2.5 6.4 2.5 6.4-4.3 5.3-.8 6.8-6.6 1.8-3.7 5.7-6.8-.8-6 3.2-6-3.2-6.8.8-3.7-5.7-6.6-1.8-.8-6.8-4.3-5.3 2.5-6.4-2.5-6.4 4.3-5.3.8-6.8 6.6-1.8 3.7-5.7 6.8.8Z" />
          <circle className="evidence-seal__ring" cx="32" cy="32" r="19" />
          {earned ? (
            <path className="evidence-seal__check" d="m22.5 32.5 6.2 6.2 13.5-14" />
          ) : (
            <path className="evidence-seal__open" d="M23 27.5h18M23 32h14M23 36.5h10" />
          )}
        </svg>
      </div>

      <div className="evidence-seal__copy">
        <p className="evidence-seal__status">{status}</p>
        <h3 className="evidence-seal__title">{title}</h3>
        {guideName && <p className="evidence-seal__guide">With {guideName}</p>}
        {description && <p className="evidence-seal__description">{description}</p>}
        {progressLabel && <p className="evidence-seal__progress">{progressLabel}</p>}
        {evidenceLabels.length > 0 ? (
          <ul className="evidence-seal__evidence" aria-label={`${title} supporting evidence`}>
            {evidenceLabels.map((label, index) => (
              <li key={`${id}-${index}`}>{label}</li>
            ))}
          </ul>
        ) : (
          <p className="evidence-seal__empty">
            {earned ? 'The supporting work is saved with your progress.' : 'Supporting evidence will appear here.'}
          </p>
        )}
        {!earned && nextEvidenceLabel && (
          <p className="evidence-seal__next"><strong>Next:</strong> {nextEvidenceLabel}</p>
        )}
      </div>
    </article>
  )
}
