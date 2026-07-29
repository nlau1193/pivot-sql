import { BadgeReveal } from './BadgeReveal'
import { CasebookPath, type CasebookChapter } from './CasebookPath'
import { DeskCrew } from './characters/DeskCrew'
import { DESK_CREW } from './characters/desk-crew'
import { DATA, missionById, simIsComplete } from './missions'
import type { ProgressV2 } from './progress-store'
import { deriveBadges, deriveCompanyReadiness, deriveStage, newlyEarnedBadgeIds } from './progression'

interface CareerDossierProps {
  progress: ProgressV2
  onNavigate: (id: string | null, sim?: boolean, newSimAttempt?: boolean) => void
  onAcknowledgeBadge: (badgeId: string) => void
}

export function CareerDossier({ progress, onNavigate, onAcknowledgeBadge }: CareerDossierProps) {
  const badges = deriveBadges(progress)
  const stage = deriveStage(progress)
  const readiness = deriveCompanyReadiness(progress)
  const stageIndex = DATA.progression.stages.findIndex((candidate) => candidate.id === stage.id)
  const earnedCount = badges.filter((badge) => badge.earned).length
  const revealBadgeId = newlyEarnedBadgeIds(progress)[0] ?? null
  const chapters: CasebookChapter[] = DATA.progression.stages.map((candidate, index) => ({
    id: candidate.id,
    label: candidate.title,
    state: index < stageIndex ? 'complete' : index === stageIndex ? 'current' : 'locked',
  }))

  return (
    <div className="career-dossier" data-stage={stage.id}>
      <section className="dossier-hero" aria-labelledby="dossier-title">
        <div>
          <p className="dossier-kicker">{DATA.company} Career Casebook</p>
          <h2 id="dossier-title">{stage.title}</h2>
          <p>{earnedCount} evidence {earnedCount === 1 ? 'seal' : 'seals'} earned from graded SQL.</p>
        </div>
        <DeskCrew />
      </section>

      <CasebookPath
        chapters={chapters}
        animateChapterId={revealBadgeId ? stage.id : null}
        label="Capability stages"
      />

      <section className="dossier-section" aria-labelledby="skill-badges-title">
        <div className="dossier-section-head">
          <h2 id="skill-badges-title">Evidence seals</h2>
          <p>Every authored work arc has a seal. Each one is derived from exact saved pulls and completed auditions—never points or attendance.</p>
        </div>
        <div className="evidence-seal-grid">
          {badges.map((badge) => {
            const evidenceLabels = [
              ...badge.missionReceipts.map((id) => progress.pulls[id]?.title ?? missionById(id)?.title ?? id),
              ...badge.completedAuditionIds.map((id) => DATA.sims.find((sim) => sim.id === id)?.title ?? id),
            ]
            const nextMissionId = badge.missingMissionIds[0]
            const nextAuditionId = badge.missingAuditionIds[0]
            const nextEvidenceLabel = nextMissionId
              ? missionById(nextMissionId)?.title ?? nextMissionId
              : nextAuditionId
                ? DATA.sims.find((sim) => sim.id === nextAuditionId)?.title ?? nextAuditionId
                : undefined
            const deliveredCount = badge.missionReceipts.length + badge.completedAuditionIds.length
            const requiredCount = badge.rule.missionIds.length + badge.rule.auditionIds.length
            const guide = DESK_CREW[badge.rule.guideId]
            return (
              <BadgeReveal
                key={badge.rule.id}
                id={badge.rule.id}
                title={badge.rule.title}
                description={badge.rule.description}
                guideName={guide.name}
                progressLabel={`${deliveredCount} of ${requiredCount} evidence ${requiredCount === 1 ? 'item' : 'items'} delivered`}
                nextEvidenceLabel={nextEvidenceLabel}
                earned={badge.earned}
                acknowledged={progress.seenBadgeIds.includes(badge.rule.id)}
                animateReveal={badge.rule.id === revealBadgeId}
                evidenceLabels={evidenceLabels}
                onAcknowledge={onAcknowledgeBadge}
              />
            )
          })}
        </div>
      </section>

      <section className="dossier-section" aria-labelledby="company-readiness-title">
        <div className="dossier-section-head">
          <h2 id="company-readiness-title">Target-company readiness</h2>
          <p>Verified job language, {DATA.company} evidence, and only genuinely distinct auditions.</p>
        </div>
        <div className="company-card-grid">
          {readiness.map(({ card, status, completedMissionIds, missingMissionIds, auditionComplete }) => {
            const audition = card.auditionId ? DATA.sims.find((sim) => sim.id === card.auditionId) : null
            const canPractice = !!audition && missingMissionIds.length === 0
            return (
              <article key={card.company} className="company-card" data-readiness={status.toLowerCase().replaceAll(' ', '-')}>
                <div className="company-card-head">
                  <div>
                    <h3>{card.company}</h3>
                    <p>{card.title}</p>
                  </div>
                  <span className="company-status">{status}</span>
                </div>
                <blockquote>“{card.quote}”</blockquote>
                <p className="company-evidence">
                  {completedMissionIds.length} of {card.evidenceMissionIds.length} supporting saved pulls delivered
                </p>
                {audition ? (
                  <div className="company-audition">
                    <strong>{audition.title}</strong>
                    <p>{`${audition.questions.length} authored ${audition.questions.length === 1 ? 'question' : 'questions'} over ${DATA.company} data — a distinct practice screen for this evidence map.`}</p>
                    {canPractice && (
                      <button className={auditionComplete ? 'btn-ghost btn-small' : 'btn-primary btn-small'} onClick={() => onNavigate(audition.questions[0]?.id ?? null, true, true)}>
                        {auditionComplete ? 'Retake audition' : 'Start audition'}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="company-evidence-only">Evidence map only — distinct questions have not been authored yet.</p>
                )}
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
