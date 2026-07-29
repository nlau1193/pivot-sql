/**
 * Pack-agnostic evidence contracts — the immersion-kernel generalization of
 * Parkline's ProgressV2 receipt model. Today the FP&A pack keys evidence by
 * mission id; these contracts let a future Eng/Design pack key by pack + task
 * id without rewriting ProgressV2 or baking personal receipts into the kit.
 *
 * Hard rail: never persist "awarded" status — every seal,
 * stage, and readiness state is *derived* from evidence predicates. These
 * contracts describe derivable evidence only; they carry no mutation API.
 *
 * This module owns the public progress and evidence model.
 */

import type { PathId } from './path-registry'

/**
 * A graded work artifact. Today SolveReceipt (mode campaign|audition) is the
 * concrete form; generalized it is keyed by pack + task so an Eng "review this
 * PR" solve or a Design "critique this flow" solve can live in the same shape.
 */
export interface WorkReceipt {
  /** Stable pack id this evidence belongs to, e.g. parkline-fpa */
  packId: string
  /** Task id within the pack — mission id, sim question id, future PR/critique id */
  taskId: string
  /** When the graded solve was recorded (ISO). */
  completedAt: string
  /** The submitted artifact that was graded — SQL today, other forms later. */
  artifact: string
  /** Authority revision of the graded content, so stale receipts are detectable. */
  contentRevision: string
}

/**
 * A timed, multi-question practice surface — generalizes AuditionAttempt.
 * One ScreenAttempt holds its own solves and stays isolated from other
 * attempts (retake/abandon in place); the kernel never mixes attempt evidence.
 */
export interface ScreenAttempt {
  attemptId: string
  packId: string
  /** Screen/audition id within the pack. */
  screenId: string
  startedAt: string
  completedAt: string | null
  /** questionId -> graded artifact, blank until solved. */
  solves: Record<string, string>
}

/**
 * Evidence a pack needs to derive seals, stages, and place readiness. Packs
 * project their concrete receipts into this shape; selectors stay pack-agnostic.
 * This is a read projection — it never carries awarded/invented status.
 */
export interface PackEvidence {
  packId: string
  receipts: WorkReceipt[]
  attempts: ScreenAttempt[]
}

/**
 * A derived, never-persisted capability seal. `earned` is a pure predicate
 * over evidence; the UI may animate a reveal but must not store it.
 */
export interface DerivedSeal {
  sealId: string
  earned: boolean
  /** Receipts that satisfy the seal — empty when not yet earned. */
  satisfyingReceiptTaskIds: string[]
  /** Evidence still required — empty when earned. */
  missingTaskIds: string[]
}

/**
 * A derived capability tier in a pack's stage ladder. Stages compose from
 * seals; no stage is "awarded", only derivable.
 */
export interface DerivedStage {
  stageId: string
  reached: boolean
  requiredSealIds: string[]
}

/**
 * Readiness for a company place, derived from required receipts and (optionally)
 * a completed screen. Status is a pure function of evidence, never stored.
 */
export type PlaceReadinessStatus =
  | 'Building evidence'
  | 'Evidence ready'
  | 'Screen ready'
  | 'Practice complete'

export interface DerivedPlaceReadiness {
  placeId: string
  status: PlaceReadinessStatus
  completedTaskIds: string[]
  missingTaskIds: string[]
  screenComplete: boolean
}

/** Minimal predicate helpers shared across packs. */

export function hasReceipt(evidence: PackEvidence, taskId: string): boolean {
  return evidence.receipts.some((receipt) => receipt.taskId === taskId)
}

export function screenAttemptComplete(attempt: ScreenAttempt, questionIds: readonly string[]): boolean {
  if (attempt.completedAt === null) return false
  return questionIds.every((id) => typeof attempt.solves[id] === 'string' && attempt.solves[id].length > 0)
}

/**
 * Project a pack's concrete receipts into the kernel evidence shape. Packs
 * keep their own storage (ProgressV2 today); this is the read boundary the
 * shared selectors consume. Pack authors implement one projector per pack.
 */
export interface EvidenceProjector<PackProgress> {
  packId: string
  /** Open-world desk directions this pack's evidence unlocks. */
  pathIds: readonly PathId[]
  /** Read-only projection; never mutates the pack's concrete progress. */
  project(progress: PackProgress): PackEvidence
}
