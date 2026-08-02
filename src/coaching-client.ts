/**
 * Browser-local coaching with an optional, explicitly injected provider.
 *
 * The local path remains the default. A host can opt into a same-origin
 * provider (for example a local Luna-high bridge) without putting a key or a
 * model call in the public bundle. Every provider reply is treated as
 * untrusted text and must pass the same request-bound contract as the local
 * coach before it reaches the UI.
 */

import {
  parseCoachRequestV1,
  parseCoachResponseForRequestV1,
  type CoachRequestV1,
  type CoachResponseV1,
} from './kit/coaching-contract.ts'
import { createLocalCoachResponse } from './kit/local-coach.ts'

const COACH_TIMEOUT_MS = 9_000

export interface CoachTransport {
  readonly id: string
  ask(request: CoachRequestV1, options: { signal?: AbortSignal }): Promise<unknown>
}

export interface RequestCoachOptions {
  /** Lets an in-flight UI action stop cleanly. */
  signal?: AbortSignal
  /** Optional host-owned provider. Omit it for the private local default. */
  transport?: CoachTransport
}

function configuredEndpoint(): string {
  const env = (import.meta as ImportMeta & { env?: ImportMetaEnv }).env
  const endpoint = env?.VITE_STAR67_COACH_ENDPOINT
  return typeof endpoint === 'string' ? endpoint.trim() : ''
}

/**
 * Build the opt-in HTTP transport. It is intentionally not selected unless a
 * host supplies VITE_STAR67_COACH_ENDPOINT at build time.
 */
export function createHttpCoachTransport(endpoint: string, id = 'luna-high'): CoachTransport {
  const target = endpoint.trim()
  if (!target) throw new Error('A coaching endpoint is required')
  let parsed: URL
  try {
    parsed = new URL(target, typeof location === 'undefined' ? 'http://localhost/' : location.href)
  } catch {
    throw new Error('The coaching endpoint must be a valid same-origin URL')
  }
  const browserOrigin = typeof location === 'undefined' ? null : location.origin
  // The coach receives the learner's visible SQL and schema. Keep the public
  // seam same-origin by construction; a host can still proxy to any provider
  // behind its own consent, credentials, retention, and rate-limit policy.
  if ((browserOrigin && parsed.origin !== browserOrigin)
      || (!browserOrigin && /^(?:https?:)?\/\//i.test(target))) {
    throw new Error('The coaching endpoint must be same-origin')
  }
  return {
    id,
    async ask(request, options) {
      const response = await fetch(parsed.href, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
        signal: options.signal,
      })
      if (!response.ok) throw new Error(`Coach provider returned HTTP ${response.status}`)
      return response.json()
    },
  }
}

/**
 * Return the optional host transport, or null for the no-network default.
 *
 * Endpoint configuration is host-owned input. A typo or an endpoint that
 * violates the same-origin boundary must not make the learner app fail during
 * render; the built-in Frosty path remains the safe fallback.
 */
export function configuredCoachTransport(endpoint = configuredEndpoint()): CoachTransport | null {
  if (!endpoint) return null
  try {
    return createHttpCoachTransport(endpoint)
  } catch {
    return null
  }
}

function withTimeout(signal: AbortSignal | undefined): {
  signal: AbortSignal
  timedOut: () => boolean
  aborted: Promise<never>
  dispose: () => void
} {
  const controller = new AbortController()
  let timedOut = false
  let rejectAbort!: (reason?: unknown) => void
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = reject
  })
  const onAbort = () => controller.abort(signal?.reason)
  const onControllerAbort = () => {
    rejectAbort(controller.signal.reason ?? new Error('Coach provider aborted'))
  }
  signal?.addEventListener('abort', onAbort, { once: true })
  controller.signal.addEventListener('abort', onControllerAbort, { once: true })
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort(new Error('Coach provider timed out'))
  }, COACH_TIMEOUT_MS)
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    aborted,
    dispose: () => {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)
      controller.signal.removeEventListener('abort', onControllerAbort)
    },
  }
}

/**
 * Ask Frosty for advisory guidance. Without an injected transport this never
 * grades, edits SQL, mutates progress, or uses the network. If a provider is
 * injected, its reply is validated and any failure falls back to the same
 * authored local guidance.
 */
export async function requestCoach(
  requestValue: CoachRequestV1 | unknown,
  options: RequestCoachOptions = {},
): Promise<CoachResponseV1> {
  const request = parseCoachRequestV1(requestValue)
  if (options.signal?.aborted) throw options.signal.reason
  const transport = options.transport ?? configuredCoachTransport()
  if (!transport) return createLocalCoachResponse(request)

  const timed = withTimeout(options.signal)
  try {
    // Aborting a signal cannot force a host-owned transport to settle. Race
    // the provider promise as well, so a non-cooperative adapter cannot leave
    // the learner in a permanent "Thinking…" state.
    const raw = await Promise.race([
      transport.ask(request, { signal: timed.signal }),
      timed.aborted,
    ])
    if (options.signal?.aborted) throw options.signal.reason
    if (timed.timedOut()) return createLocalCoachResponse(request)
    const candidate = raw && typeof raw === 'object'
      ? { ...(raw as Record<string, unknown>), source: 'remote' as const }
      : raw
    return parseCoachResponseForRequestV1(request, candidate)
  } catch (error) {
    // A learner changing missions or pressing a new action must be able to
    // cancel without a late local response replacing the new screen.
    if (options.signal?.aborted && !timed.timedOut()) throw error
    return createLocalCoachResponse(request)
  } finally {
    timed.dispose()
  }
}
