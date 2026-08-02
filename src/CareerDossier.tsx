import { BadgeReveal } from './BadgeReveal'
import { DeskCrew } from './characters/DeskCrew'
import { DESK_CREW } from './characters/desk-crew'
import { DATA, missionById } from './missions'
import type { ProgressV2 } from './progress-store'
import { deriveBadges, newlyEarnedBadgeIds } from './progression'

interface CareerDossierProps {
  progress: ProgressV2
  onAcknowledgeBadge: (badgeId: string) => void
}

export function CareerDossier({ progress, onAcknowledgeBadge }: CareerDossierProps) {
  const badges = deriveBadges(progress)
  const completedTaskCount = Object.keys(progress.pulls).length
  const earnedBadges = badges.filter((badge) => badge.earned)
  const nextBadge = badges.find((badge) => !badge.earned) ?? null
  const laterBadges = nextBadge
    ? badges.slice(badges.findIndex((badge) => badge.rule.id === nextBadge.rule.id) + 1)
    : []
  const earnedCount = badges.filter((badge) => badge.earned).length
  const revealBadgeId = newlyEarnedBadgeIds(progress)[0] ?? null
  const badgeCard = (badge: (typeof badges)[number]) => {
    const learnerTitle = badge.rule.id === 'warehouse-navigator' ? 'SQL foundations' : badge.rule.title
    const completedTasks = badge.missionReceipts.map(
      (id) => progress.pulls[id]?.title ?? missionById(id)?.title ?? id,
    )
    const completedPractice = badge.completedAuditionIds.map(
      (id) => DATA.sims.find((sim) => sim.id === id)?.title ?? id,
    )
    const nextMissionId = badge.missingMissionIds[0]
    const nextPracticeId = badge.missingAuditionIds[0]
    const nextTaskLabel = nextMissionId
      ? missionById(nextMissionId)?.title ?? nextMissionId
      : nextPracticeId
        ? DATA.sims.find((sim) => sim.id === nextPracticeId)?.title ?? nextPracticeId
        : undefined
    const completedCount = completedTasks.length + completedPractice.length
    const requiredCount = badge.rule.missionIds.length + badge.rule.auditionIds.length
    const guide = DESK_CREW[badge.rule.guideId]

    return (
      <BadgeReveal
        key={badge.rule.id}
        id={badge.rule.id}
        title={learnerTitle}
        description={badge.rule.description}
        guideName={guide.name}
        progressLabel={`${completedCount} of ${requiredCount} tasks complete`}
        nextEvidenceLabel={nextTaskLabel}
        earned={badge.earned}
        acknowledged={progress.seenBadgeIds.includes(badge.rule.id)}
        animateReveal={badge.rule.id === revealBadgeId}
        evidenceLabels={[...completedTasks, ...completedPractice]}
        onAcknowledge={onAcknowledgeBadge}
      />
    )
  }

  return (
    <div className="career-dossier">
      <section className="dossier-hero" aria-labelledby="dossier-title">
        <div>
          <p className="dossier-kicker">Your SQL practice</p>
          <h2 id="dossier-title">Your progress</h2>
          <p>
            {completedTaskCount} {completedTaskCount === 1 ? 'task' : 'tasks'} complete ·{' '}
            {earnedCount} skill{earnedCount === 1 ? '' : 's'} earned
          </p>
        </div>
        <DeskCrew />
      </section>

      {nextBadge && (
        <section className="dossier-section" aria-labelledby="next-skill-title">
          <div className="dossier-section-head">
            <h2 id="next-skill-title">Your next skill to practice</h2>
            <p>Complete the listed tasks to add it to your progress. No points, streaks, or hidden scoring.</p>
          </div>
          <div className="evidence-seal-grid evidence-seal-grid--focus">
            {badgeCard(nextBadge)}
          </div>
        </section>
      )}

      {earnedBadges.length > 0 && (
        <section className="dossier-section" aria-labelledby="earned-skills-title">
          <div className="dossier-section-head">
            <h2 id="earned-skills-title">Skills you have earned</h2>
            <p>Each skill is backed by specific, checked SQL work.</p>
          </div>
          <div className="evidence-seal-grid">
            {earnedBadges.map(badgeCard)}
          </div>
        </section>
      )}

      {!nextBadge && (
        <section className="progress-complete" aria-labelledby="progress-complete-title">
          <h2 id="progress-complete-title">Every listed skill is complete</h2>
          <p>Your checked work and saved queries remain available whenever you want to revisit them.</p>
        </section>
      )}

      {laterBadges.length > 0 && (
        <details className="future-skills">
          <summary>See {laterBadges.length} more skill{laterBadges.length === 1 ? '' : 's'}</summary>
          <p>These unlock naturally as you finish more practice projects.</p>
          <div className="evidence-seal-grid">
            {laterBadges.map(badgeCard)}
          </div>
        </details>
      )}
    </div>
  )
}
