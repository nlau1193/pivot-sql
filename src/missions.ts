import compiled from './missions.compiled.json'
import { exactAuditionCompletion, type ProgressV2 } from './progress-store'
import { MISSION_SENDERS, type DeskCrewId, type MissionSenderId } from './characters/desk-crew'

export interface ExpectedResult {
  columnCount: number
  columns: string[]
  rowCount: number
  rows: string[]
}
export interface Fingerprint {
  rowCount: number
  rows: string[]
  message: string
}
export interface CompiledMission {
  id: string
  part: number
  title: string
  from: MissionSenderId
  ask: string
  deliverable: string
  tables: string[]
  prefill: string | null
  hints: string[]
  sayIt: string
  successNote: string | null
  ordered: boolean
  orderedNote: string | null
  jdCompanies: string[]
  solution: string
  solutionNote: string | null
  requireRegex: string | null
  requireMessage: string | null
  expected: ExpectedResult
  fingerprints: Fingerprint[]
}
export interface SimQuestion {
  id: string
  ask: string
  deliverable: string
  tables: string[]
  ordered: boolean
  orderedNote: string | null
  narration: string
  requireRegex: string | null
  requireMessage: string | null
  expected: ExpectedResult
  fingerprints: Fingerprint[]
}
export interface CompiledSim {
  id: string
  company: string
  title: string
  intro: string
  questions: SimQuestion[]
}
export interface CompetencyRule {
  id: string
  label: string
  missionIds: string[]
  auditionIds?: string[]
}
export interface BadgeRule {
  id: string
  title: string
  competencyId: string
  guideId: DeskCrewId
  description: string
  missionIds: string[]
  auditionIds: string[]
}
export interface StageRule {
  id: string
  title: string
  requiredBadgeIds: string[]
  requiredAuditionIds: string[]
}
export interface CompanyCardRule {
  company: string
  title: string
  quote: string
  evidenceMissionIds: string[]
  auditionId: string | null
}
export interface AuditionMetadata {
  id: string
  company: string
  title: string
  questionIds: string[]
}
export interface ProgressionManifest {
  competencies: CompetencyRule[]
  badges: BadgeRule[]
  stages: StageRule[]
  companyCards: CompanyCardRule[]
  auditions: AuditionMetadata[]
}
export interface CompiledData {
  builtAt: string
  company: string
  totalRows: number
  tableRows: Record<string, number>
  parts: { id: number; name: string }[]
  missions: CompiledMission[]
  sims: CompiledSim[]
  interviewReady: { company: string; title: string; quote: string; missionIds: string[] }[]
  progression: ProgressionManifest
}

export const DATA = compiled as unknown as CompiledData

export const PEOPLE = MISSION_SENDERS

/** The next incomplete mission in queue order. */
export function nextMission(p: { pulls: Record<string, unknown> }): CompiledMission | null {
  for (const m of DATA.missions) if (!p.pulls[m.id]) return m
  return null
}
export function missionById(id: string): CompiledMission | undefined {
  return DATA.missions.find((m) => m.id === id)
}

export function simByQuestionId(id: string): CompiledSim | undefined {
  return DATA.sims.find((sim) => sim.questions.some((q) => q.id === id))
}

type SimCompletionProgress = Pick<ProgressV2, 'auditionAttempts' | 'solveReceipts'>

export function simIsComplete(sim: CompiledSim, progress: SimCompletionProgress): boolean {
  const policy = { auditionId: sim.id, questionIds: sim.questions.map((question) => question.id) }
  return Object.values(progress.auditionAttempts).some((attempt) => (
    exactAuditionCompletion(attempt, progress.solveReceipts, policy) !== null
  ))
}

/** Start the first unfinished set. Once every set is complete, choose the one
 * completed least recently so Retake does not immediately repeat the last set. */
export function nextSimVariant(progress: SimCompletionProgress): CompiledSim | null {
  const incomplete = DATA.sims.find((sim) => !simIsComplete(sim, progress))
  if (incomplete) return incomplete
  if (!DATA.sims.length) return null
  return [...DATA.sims].sort((a, b) => {
    // A retake rewrites question records as the user advances. Only the last
    // question proves the whole set was completed again; using the newest row
    // would make an abandoned partial retake look like a fresh completion.
    const completedAt = (sim: CompiledSim) => {
      const policy = { auditionId: sim.id, questionIds: sim.questions.map((question) => question.id) }
      const completedAttempts = Object.values(progress.auditionAttempts)
        .map((attempt) => exactAuditionCompletion(attempt, progress.solveReceipts, policy))
        .filter((completion) => completion !== null)
        .map((completion) => completion.completedAt)
        .sort()
      if (completedAttempts.length) return completedAttempts.at(-1) ?? ''
      return ''
    }
    return completedAt(a).localeCompare(completedAt(b)) || a.id.localeCompare(b.id)
  })[0]
}
