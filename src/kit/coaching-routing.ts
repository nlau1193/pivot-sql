import type { CoachMode } from './coaching-contract'

export type CoachRouteMoment =
  | { kind: 'idle' }
  | { kind: 'engine-error' }
  | { kind: 'verdict'; status: 'incorrect' | 'close' | 'correct' }

export interface CoachRoute {
  mode: CoachMode
  /** A short, truthful reason used for the supporting copy—not a second action. */
  reason: string
}

/**
 * Select one next coaching step from the evidence already visible in the
 * workspace. This is intentionally deterministic: it is the product's local
 * fallback and the policy a future remote provider must preserve.
 */
export function chooseCoachRoute(moment: CoachRouteMoment, hasCurrentAttempt: boolean): CoachRoute {
  if (moment.kind === 'engine-error') {
    return { mode: 'explain_error', reason: 'the last run returned an engine error' }
  }
  if (hasCurrentAttempt) {
    return { mode: 'review_attempt', reason: 'the current result and deterministic verdict are available' }
  }
  if (moment.kind === 'verdict' && moment.status === 'correct') {
    return { mode: 'rehearse', reason: 'the deterministic checker accepted the current result' }
  }
  if (moment.kind === 'verdict') {
    return { mode: 'explain_verdict', reason: 'the deterministic checker returned a result to debug' }
  }
  return { mode: 'nudge', reason: 'the draft has not produced a current result yet' }
}
