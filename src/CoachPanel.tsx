import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DESK_CREW, deskCrewAlt } from './characters/desk-crew'
import { configuredCoachTransport, requestCoach } from './coaching-client'
import {
  COACHING_CONTRACT_VERSION,
  type AttemptReviewAssessment,
  type CoachMode,
  type CoachRequestV1,
  type CoachResponseV1,
  type CoachVerdictV1,
  type ReviewAttemptInputV1,
} from './kit/coaching-contract'
import { chooseCoachRoute, type CoachRouteMoment } from './kit/coaching-routing'
import {
  createStar67CoachContext,
  type Star67CoachMission,
} from './packs/parkline-fpa/coach-context'

export type CoachMoment =
  | { kind: 'idle' }
  | { kind: 'engine-error'; engineError: string }
  | { kind: 'verdict'; verdict: CoachVerdictV1 }

interface CoachPanelProps {
  mission: Star67CoachMission
  query: string
  moment: CoachMoment
  attempt?: ReviewAttemptInputV1['attempt'] | null
  attemptIsCurrent?: boolean
  onGuidanceUsed: () => void
}

const ATTEMPT_ASSESSMENT_LABELS: Readonly<Record<AttemptReviewAssessment, string>> = {
  on_track: 'On track',
  needs_revision: 'Needs revision',
  uncertain: 'Uncertain',
}

function coachRequest(
  mode: CoachMode,
  requestId: string,
  mission: Star67CoachMission,
  query: string,
  moment: CoachMoment,
  attempt: ReviewAttemptInputV1['attempt'] | null,
): CoachRequestV1 {
  const context = createStar67CoachContext(mission)
  const base = { version: COACHING_CONTRACT_VERSION, requestId, context }

  switch (mode) {
    case 'nudge':
      return { ...base, mode, input: { query } }
    case 'explain_error':
      return {
        ...base,
        mode,
        input: {
          query,
          engineError: moment.kind === 'engine-error'
            ? moment.engineError
            : 'No engine error is active. Give a general recovery plan.',
        },
      }
    case 'explain_verdict':
      return {
        ...base,
        mode,
        input: {
          query,
          verdict: moment.kind === 'verdict'
            ? moment.verdict
            : {
                status: 'incorrect',
                headline: 'No deterministic verdict is active',
                detail: 'Review the current query against the deliverable.',
              },
        },
      }
    case 'schema':
      return { ...base, mode, input: { table: context.schema[0]?.name } }
    case 'relationship': {
      const relationship = context.relationships[0]
      return {
        ...base,
        mode,
        input: {
          leftTable: relationship?.left.table,
          rightTable: relationship?.right.table,
        },
      }
    }
    case 'rehearse':
      return { ...base, mode, input: {} }
    case 'review_attempt': {
      if (!attempt) throw new Error('A current attempt is required for review')
      return {
        ...base,
        mode,
        input: {
          query,
          attempt,
        },
      }
    }
  }
}

function requestId(sequence: number): string {
  return `frosty:${Date.now().toString(36)}:${sequence.toString(36)}`
}

export function CoachPanel({ mission, query, moment, attempt = null, attemptIsCurrent = false, onGuidanceUsed }: CoachPanelProps) {
  const [response, setResponse] = useState<CoachResponseV1 | null>(null)
  const [failure, setFailure] = useState('')
  const [pendingMode, setPendingMode] = useState<CoachMode | null>(null)
  const sequenceRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const actionRef = useRef<HTMLButtonElement>(null)
  const restoreActionFocusRef = useRef(false)
  const frosty = DESK_CREW.frosty
  const optionalTransport = configuredCoachTransport()
  const providerLabel = optionalTransport?.id?.trim() || 'optional AI'
  const currentAttempt = attempt !== null && attemptIsCurrent
  // A result belongs to the query that produced it. Once the learner edits
  // the draft, the old verdict/error is still visible for context but cannot
  // drive guidance for a different query. Route back to a nudge until the
  // learner runs the draft again.
  const routeMoment: CoachRouteMoment = !attemptIsCurrent && moment.kind !== 'idle'
    ? { kind: 'idle' }
    : moment.kind === 'engine-error'
      ? { kind: 'engine-error' }
      : moment.kind === 'verdict'
        ? { kind: 'verdict', status: moment.verdict.status }
        : { kind: 'idle' }
  const route = chooseCoachRoute(routeMoment, currentAttempt)
  const visibleResponse = response?.mode === 'review_attempt' && !currentAttempt ? null : response
  const assessment = visibleResponse?.mode === 'review_attempt' && 'assessment' in visibleResponse
    ? visibleResponse.assessment as AttemptReviewAssessment
    : null
  const contextSignature = JSON.stringify({
    missionId: mission.id,
    query,
    moment,
    attempt,
    attemptIsCurrent,
  })

  useEffect(() => () => abortRef.current?.abort(), [])
  useLayoutEffect(() => {
    if (pendingMode !== null || !restoreActionFocusRef.current) return
    restoreActionFocusRef.current = false
    // The action is temporarily disabled while local guidance is computed;
    // browsers blur disabled controls. Restore the learner's keyboard place
    // when the response arrives instead of dropping focus onto the document.
    actionRef.current?.focus({ preventScroll: true })
  }, [pendingMode])
  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null
    sequenceRef.current += 1
    setPendingMode(null)
    setResponse(null)
    setFailure('')
  }, [contextSignature])

  const askFrosty = async (mode: CoachMode) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const sequence = ++sequenceRef.current
    setPendingMode(mode)
    setFailure('')
    try {
      const request = coachRequest(
        mode,
        requestId(sequence),
        mission,
        query,
        moment,
        attempt,
      )
      const next = await requestCoach(request, { signal: controller.signal, transport: optionalTransport ?? undefined })
      if (!controller.signal.aborted && sequenceRef.current === sequence) setResponse(next)
    } catch {
      if (!controller.signal.aborted && sequenceRef.current === sequence) {
        setResponse(null)
        setFailure('Guidance is unavailable for this mission. Your SQL and progress were not changed.')
      }
    } finally {
      if (sequenceRef.current === sequence) {
        setPendingMode(null)
        abortRef.current = null
      }
    }
  }

  return (
    <section className="coach-panel" aria-labelledby="frosty-coach-title" aria-busy={pendingMode !== null}>
      <div className="coach-panel__header">
        <span className="coach-panel__portrait">
          <img src={frosty.portraitSrc} alt={deskCrewAlt(frosty)} />
        </span>
        <div className="coach-panel__identity">
          <div className="coach-panel__eyebrow">Optional coaching</div>
          <div className="coach-panel__title-row">
            <h2 id="frosty-coach-title">Ask Frosty</h2>
            <span className="coach-panel__source">
              {visibleResponse?.source === 'remote'
                ? `Optional AI · ${providerLabel}`
                : optionalTransport ? 'Built-in first · optional AI' : 'Built-in · private'}
            </span>
          </div>
          <p>One next step, based on your ask and current work. The warehouse checker remains the judge.</p>
        </div>
      </div>

      <div className="coach-panel__actions" aria-label="Get the next coaching step">
        <button
          ref={actionRef}
          type="button"
          className="btn-ghost btn-small coach-panel__action"
          disabled={pendingMode !== null}
          onClick={() => {
            if (pendingMode !== null) return
            restoreActionFocusRef.current = true
            onGuidanceUsed()
            void askFrosty(route.mode)
          }}
        >
          {pendingMode !== null ? 'Thinking…' : 'Give me the next step'}
        </button>
      </div>

      <p className="coach-panel__route">
        Frosty is looking at {route.reason}. {optionalTransport
          ? 'Optional AI is off until you choose this action; the built-in fallback stays available.'
          : 'Guidance stays in this browser.'}
      </p>

      <details className="coach-panel__privacy">
        <summary>How coaching uses your work</summary>
        <p>{optionalTransport
          ? `This build has an optional ${providerLabel} bridge. Nothing is sent until you choose this action; the bridge receives only this query, a small visible result sample, and authored schema. It never receives the answer key or progress. Frosty cannot run SQL, insert an answer, or mark work complete.`
          : 'Frosty runs only when you choose an action. Guidance is authored into Star67 and stays in this browser. Optional AI coaching is off in this build. Frosty cannot run SQL, insert an answer, or mark work complete.'}</p>
      </details>

      <div className="coach-panel__live" aria-live="polite" aria-atomic="true">
        {failure && <p className="coach-panel__failure" role="alert">{failure}</p>}
        {visibleResponse && (
          <article className="coach-response">
            <div className="coach-response__eyebrow">
              {visibleResponse.source === 'remote' ? `Frosty · optional ${providerLabel} guidance` : 'Frosty · built-in, private guidance'}
            </div>
            {assessment && (
              <div className="coach-response__assessment">
                <span>Frosty’s read</span>
                <strong>{ATTEMPT_ASSESSMENT_LABELS[assessment]}</strong>
                <em>Advisory</em>
              </div>
            )}
            <h3>{visibleResponse.message.headline}</h3>
            <p>{visibleResponse.message.body}</p>
            <ol>
              {visibleResponse.message.nextMoves.map((move) => <li key={move}>{move}</li>)}
            </ol>
            {visibleResponse.message.reflectionQuestion && (
              <p className="coach-response__reflection">
                <strong>Think it through:</strong> {visibleResponse.message.reflectionQuestion}
              </p>
            )}
            {visibleResponse.message.references.length > 0 && (
              <p className="coach-response__references">
                <strong>Look at:</strong> {visibleResponse.message.references.map((reference) => reference.label).join(' · ')}
              </p>
            )}
          </article>
        )}
      </div>
    </section>
  )
}
