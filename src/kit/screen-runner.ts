/**
 * Pack-agnostic screen-runner state machine — the immersion-kernel boundary
 * for any timed, multi-question practice surface. Today Parkline's audition
 * runner (startAuditionAttempt / recordAuditionSolve) is the concrete form;
 * this interface lets an Eng/Design pack ship its own screen without the
 * kernel learning FP&A-specific audition ids.
 *
 * Public runner invariants:
 *   - Per-question evidence is immutable within an attempt; a retake starts a
 *     fresh blank attempt rather than overwriting a solved question.
 *   - An attempt is never "awarded" complete; completion is derived from
 *     having a graded solve for every question in the screen's policy.
 *   - Attempts stay isolated: solves from one never leak into another.
 *
 * This module owns the kernel *contract* only. Packs bind it to their concrete
 * progress store (ProgressV2 today); it performs no storage or IO itself.
 *
 * This module is the executable contract for screen and audition runs.
 */

import type { ScreenAttempt } from './progress-contracts'
import { screenAttemptComplete } from './progress-contracts'

/** A screen's question policy — the set of questions that compose one attempt. */
export interface ScreenPolicy {
  packId: string
  screenId: string
  questionIds: readonly string[]
}

/** Discriminated runner state — the UI drives exactly one at a time. */
export type ScreenRunnerState =
  | { status: 'idle' }
  | { status: 'running'; attempt: ScreenAttempt; policy: ScreenPolicy }
  | { status: 'completed'; attempt: ScreenAttempt; policy: ScreenPolicy }
  | { status: 'abandoned'; attempt: ScreenAttempt; policy: ScreenPolicy }

/**
 * Transition a screen attempt through its lifecycle. Pure: returns the next
 * attempt snapshot without mutating external storage.
 *
 * - start: create a fresh blank attempt (a retake is just another start).
 * - solve: record an immutable per-question graded artifact; refuses to
 *   overwrite a question that already has evidence in this attempt.
 * - complete: derived only — returns true when every policy question is solved.
 */
export function startScreenAttempt(
  policy: ScreenPolicy,
  now: string,
  makeAttemptId: (screenId: string) => string,
): ScreenAttempt {
  if (!policy.screenId) throw new Error('Screen id is required to start an attempt')
  if (!policy.questionIds.length) throw new Error(`Screen ${policy.screenId} has no questions`)
  return {
    attemptId: makeAttemptId(policy.screenId),
    packId: policy.packId,
    screenId: policy.screenId,
    startedAt: now,
    completedAt: null,
    solves: {},
  }
}

export function recordScreenSolve(
  attempt: ScreenAttempt,
  policy: ScreenPolicy,
  questionId: string,
  artifact: string,
): ScreenAttempt {
  if (attempt.screenId !== policy.screenId) {
    throw new Error(`Attempt ${attempt.attemptId} belongs to ${attempt.screenId}, not ${policy.screenId}`)
  }
  if (!policy.questionIds.includes(questionId)) {
    throw new Error(`${questionId} is not part of screen ${policy.screenId}`)
  }
  if (attempt.solves[questionId]) {
    throw new Error(`${questionId} already has immutable evidence in ${attempt.attemptId}; start a retake to solve it again`)
  }
  if (typeof artifact !== 'string' || artifact.length === 0) {
    throw new Error(`A graded artifact is required for ${questionId}`)
  }
  return { ...attempt, solves: { ...attempt.solves, [questionId]: artifact } }
}

/** Completion is derived, never stored on the attempt by the caller. */
export function screenComplete(attempt: ScreenAttempt, policy: ScreenPolicy): boolean {
  return screenAttemptComplete(attempt, policy.questionIds)
}

/**
 * Map a concrete attempt snapshot to the runner state the UI renders. Lets a
 * pack compute idle/running/completed/abandoned without the kernel knowing how
 * "abandoned" is persisted (timeouts, navigation, explicit give-up).
 */
export function runnerState(
  attempt: ScreenAttempt | null,
  policy: ScreenPolicy | null,
  opts: { abandoned?: boolean } = {},
): ScreenRunnerState {
  if (!attempt || !policy) return { status: 'idle' }
  if (opts.abandoned) return { status: 'abandoned', attempt, policy }
  if (screenComplete(attempt, policy)) return { status: 'completed', attempt, policy }
  return { status: 'running', attempt, policy }
}
