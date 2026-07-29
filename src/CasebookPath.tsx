export type CasebookChapterState = 'complete' | 'current' | 'locked'

export interface CasebookChapter {
  id: string
  label: string
  state: CasebookChapterState
  detail?: string
}

export interface CasebookPathProps {
  chapters: readonly CasebookChapter[]
  animateChapterId?: string | null
  className?: string
  label?: string
}

/** A semantic stage map with a single, caller-gated connector advance. */
export function CasebookPath({
  chapters,
  animateChapterId = null,
  className = '',
  label = 'Career casebook path',
}: CasebookPathProps) {
  if (chapters.length === 0) return null

  return (
    <nav className={`casebook-path ${className}`.trim()} aria-label={label}>
      <ol
        className="casebook-path__list"
        style={{ gridTemplateColumns: `repeat(${chapters.length}, minmax(0, 1fr))` }}
      >
        {chapters.map((chapter, index) => {
          const advance = index > 0 && chapter.id === animateChapterId
          return (
            <li
              key={chapter.id}
              className="casebook-path__chapter"
              data-state={chapter.state}
              data-chapter-id={chapter.id}
              data-advance={advance ? 'true' : 'false'}
              aria-current={chapter.state === 'current' ? 'step' : undefined}
            >
              {index > 0 && (
                <svg className="casebook-path__connector" viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                  <path className="casebook-path__connector-bed" pathLength="1" d="M0 6 C25 2 75 10 100 6" />
                  <path className="casebook-path__connector-line" pathLength="1" d="M0 6 C25 2 75 10 100 6" />
                </svg>
              )}
              <span className="casebook-path__node" aria-hidden="true">
                {chapter.state === 'complete' ? '✓' : index + 1}
              </span>
              <span className="casebook-path__copy">
                <span className="casebook-path__label">{chapter.label}</span>
                {chapter.detail && <span className="casebook-path__detail">{chapter.detail}</span>}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
