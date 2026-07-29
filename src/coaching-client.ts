/** Deterministic, browser-local coaching. No request leaves the device. */

import {
  parseCoachRequestV1,
  type CoachRequestV1,
  type CoachResponseV1,
} from './kit/coaching-contract'
import { createLocalCoachResponse } from './kit/local-coach'

export interface RequestCoachOptions {
  /** Lets an in-flight UI action stop cleanly; no network request is created. */
  signal?: AbortSignal
}

/**
 * Ask Frosty for authored local guidance. This never grades, edits SQL, mutates
 * progress, or uses the network.
 */
export async function requestCoach(
  requestValue: CoachRequestV1 | unknown,
  options: RequestCoachOptions = {},
): Promise<CoachResponseV1> {
  const request = parseCoachRequestV1(requestValue)
  if (options.signal?.aborted) throw options.signal.reason
  return createLocalCoachResponse(request)
}
