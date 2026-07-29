import { DATA, type BadgeRule, type CompanyCardRule, type StageRule } from './missions'
import { exactAuditionCompletion, type ProgressV2 } from './progress-store'

export interface BadgeEvidence {
  rule: BadgeRule
  earned: boolean
  missionReceipts: string[]
  completedAuditionIds: string[]
  missingMissionIds: string[]
  missingAuditionIds: string[]
}

export interface CompanyReadiness {
  card: CompanyCardRule
  status: 'Building evidence' | 'Evidence ready' | 'Audition ready' | 'Practice complete'
  completedMissionIds: string[]
  missingMissionIds: string[]
  auditionComplete: boolean
}

type AuditionEvidence = Pick<ProgressV2, 'auditionAttempts' | 'solveReceipts'>
type ProgressionEvidence = Pick<ProgressV2, 'pulls' | 'auditionAttempts' | 'solveReceipts'>

export function completedAuditionIds(progress: AuditionEvidence): string[] {
  return DATA.progression.auditions
    .filter((policy) => Object.values(progress.auditionAttempts).some((attempt) =>
      exactAuditionCompletion(attempt, progress.solveReceipts, {
        auditionId: policy.id,
        questionIds: policy.questionIds,
      })))
    .map((policy) => policy.id)
}

export function deriveBadges(progress: ProgressionEvidence): BadgeEvidence[] {
  const completedAuditions = new Set(completedAuditionIds(progress))
  return DATA.progression.badges.map((rule) => {
    const missionReceipts = rule.missionIds.filter((id) => !!progress.pulls[id])
    const auditionIds = rule.auditionIds.filter((id) => completedAuditions.has(id))
    const missingMissionIds = rule.missionIds.filter((id) => !progress.pulls[id])
    const missingAuditionIds = rule.auditionIds.filter((id) => !completedAuditions.has(id))
    return {
      rule,
      earned: missingMissionIds.length === 0 && missingAuditionIds.length === 0,
      missionReceipts,
      completedAuditionIds: auditionIds,
      missingMissionIds,
      missingAuditionIds,
    }
  })
}

export function deriveStage(progress: ProgressionEvidence): StageRule {
  const earned = new Set(deriveBadges(progress).filter((badge) => badge.earned).map((badge) => badge.rule.id))
  const auditions = new Set(completedAuditionIds(progress))
  return [...DATA.progression.stages].reverse().find((stage) =>
    stage.requiredBadgeIds.every((id) => earned.has(id))
      && stage.requiredAuditionIds.every((id) => auditions.has(id))) ?? DATA.progression.stages[0]
}

export function deriveCompanyReadiness(progress: ProgressionEvidence): CompanyReadiness[] {
  const auditions = new Set(completedAuditionIds(progress))
  return DATA.progression.companyCards.map((card) => {
    const completedMissionIds = card.evidenceMissionIds.filter((id) => !!progress.pulls[id])
    const missingMissionIds = card.evidenceMissionIds.filter((id) => !progress.pulls[id])
    const auditionComplete = !!card.auditionId && auditions.has(card.auditionId)
    const status = auditionComplete
      ? 'Practice complete'
      : missingMissionIds.length > 0
        ? 'Building evidence'
        : card.auditionId
          ? 'Audition ready'
          : 'Evidence ready'
    return { card, status, completedMissionIds, missingMissionIds, auditionComplete }
  })
}

export function newlyEarnedBadgeIds(progress: Pick<ProgressV2, 'pulls' | 'auditionAttempts' | 'solveReceipts' | 'seenBadgeIds'>): string[] {
  const seen = new Set(progress.seenBadgeIds)
  return deriveBadges(progress).filter((badge) => badge.earned && !seen.has(badge.rule.id)).map((badge) => badge.rule.id)
}
