import { useEffect, useId, useRef, useState } from 'react'
import { DESK_CREW, deskCrewAlt } from './characters/desk-crew'
import { requestCoach } from './coaching-client'
import {
  COACHING_CONTRACT_VERSION,
  type AttemptReviewAssessment,
  type CoachMode,
  type CoachRequestV1,
  type CoachResponseV1,
  type CoachVerdictV1,
  type ReviewAttemptInputV1,
} from './kit/coaching-contract'
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
}

interface CoachAction {
  mode: CoachMode
  label: string
}

const QUICK_ACTIONS: readonly CoachAction[] = [
  { mode: 'nudge', label: 'Nudge' },
  { mode: 'schema', label: 'Schema' },
  { mode: 'relationship', label: 'Relationships' },
  { mode: 'rehearse', label: 'Rehearse' },
]

const ATTEMPT_ASSESSMENT_LABELS: Readonly<Record<AttemptReviewAssessment, string>> = {
  on_track: 'On track',
  needs_revision: 'Needs revision',
  uncertain: 'Uncertain',
}

const REVIEW_QUESTION_LIMIT = 240

function suggestedAction(moment: CoachMoment): CoachAction {
  if (moment.kind === 'engine-error') return { mode: 'explain_error', label: 'Explain this error' }
  if (moment.kind === 'verdict' && moment.verdict.status !== 'correct') {
    return { mode: 'explain_verdict', label: 'Help me debug the result' }
  }
  if (moment.kind === 'verdict') return { mode: 'rehearse', label: 'Rehearse' }
  return { mode: 'nudge', label: 'Nudge' }
}

function coachRequest(
  mode: CoachMode,
  requestId: string,
  mission: Star67CoachMission,
  query: string,
  moment: CoachMoment,
  attempt: ReviewAttemptInputV1['attempt'] | null,
  reviewQuestion: string,
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
      const question = reviewQuestion.trim()
      return {
        ...base,
        mode,
        input: {
          query,
          attempt,
          ...(question ? { question } : {}),
        },
      }
    }
  }
}

function requestId(sequence: number): string {
  return `frosty:${Date.now().toString(36)}:${sequence.toString(36)}`
}

export function CoachPanel({ mission, query, moment, attempt = null, attemptIsCurrent = false }: CoachPanelProps) {
  const [response, setResponse] = useState<CoachResponseV1 | null>(null)
  const [failure, setFailure] = useState('')
  const [pendingMode, setPendingMode] = useState<CoachMode | null>(null)
  const [reviewQuestion, setReviewQuestion] = useState('')
  const sequenceRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const reviewButtonRef = useRef<HTMLButtonElement | null>(null)
  const restoreReviewFocusRef = useRef(false)
  const reviewQuestionId = useId()
  const reviewStatusId = useId()
  const suggested = suggestedAction(moment)
  const quickActions = suggested.mode === 'explain_error' || suggested.mode === 'explain_verdict'
    ? [suggested, ...QUICK_ACTIONS]
    : QUICK_ACTIONS
  const frosty = DESK_CREW.frosty
  const canReviewAttempt = attempt !== null && attemptIsCurrent
  const visibleResponse = response?.mode === 'review_attempt' && !canReviewAttempt ? null : response
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
  useEffect(() => {
    if (pendingMode !== null || !restoreReviewFocusRef.current) return
    restoreReviewFocusRef.current = false
    if (canReviewAttempt) reviewButtonRef.current?.focus()
  }, [canReviewAttempt, pendingMode])
  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null
    sequenceRef.current += 1
    setPendingMode(null)
    setResponse(null)
    setFailure('')
    setReviewQuestion('')
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
        reviewQuestion,
      )
      const next = await requestCoach(request, { signal: controller.signal })
      if (!controller.signal.aborted && sequenceRef.current === sequence) setResponse(next)
    } catch {
      if (!controller.signal.aborted && sequenceRef.current === sequence) {
        setResponse(null)
        setFailure('Guidance is unavailable for this mission. Your SQL and progress were not changed.')
      }
    } finally {
      if (sequenceRef.current === sequence) {
        if (mode === 'review_attempt') restoreReviewFocusRef.current = true
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
          <div className="coach-panel__title-row">
            <h2 id="frosty-coach-title">Ask Frosty</h2>
            {visibleResponse && (
              <span className="coach-panel__source">
                Built-in guidance
              </span>
            )}
          </div>
          <p>Coaching, not grading. Frosty can help you reason; the warehouse checker remains the judge.</p>
        </div>
      </div>

      {attempt && (
        <div className="coach-panel__review">
          <label htmlFor={reviewQuestionId}>
            What should Frosty focus on? <span>Optional</span>
          </label>
          <div className="coach-panel__review-controls">
            <input
              id={reviewQuestionId}
              type="text"
              value={reviewQuestion}
              maxLength={REVIEW_QUESTION_LIMIT}
              placeholder="For example: Is my join grain safe?"
              autoComplete="off"
              disabled={pendingMode !== null}
              aria-describedby={reviewStatusId}
              onChange={(event) => {
                setReviewQuestion(event.currentTarget.value)
                if (response?.mode === 'review_attempt') setResponse(null)
              }}
            />
            <button
              ref={reviewButtonRef}
              type="button"
              className="btn-primary btn-small coach-panel__review-action"
              aria-pressed={visibleResponse?.mode === 'review_attempt'}
              aria-describedby={reviewStatusId}
              disabled={!canReviewAttempt || pendingMode !== null}
              onClick={(event) => {
                event.currentTarget.focus()
                if (canReviewAttempt && pendingMode === null) void askFrosty('review_attempt')
              }}
            >
              {pendingMode === 'review_attempt' ? 'Reviewing…' : 'Review my attempt'}
            </button>
          </div>
          <p id={reviewStatusId} className="coach-panel__review-status">
            {canReviewAttempt
              ? 'Frosty reads this result alongside your SQL. The warehouse checker still decides correctness.'
              : 'Run this draft to refresh the review.'}
          </p>
        </div>
      )}

      <div className="coach-panel__actions" aria-label="Choose coaching help">
        {quickActions.map((action) => {
          const isSuggested = !attempt && action.mode === suggested.mode
          return (
            <button
              key={action.mode}
              type="button"
              className={`${isSuggested ? 'btn-primary' : 'btn-ghost'} btn-small coach-panel__action`}
              aria-pressed={visibleResponse?.mode === action.mode}
              aria-disabled={pendingMode === action.mode}
              disabled={pendingMode !== null && pendingMode !== action.mode}
              onClick={(event) => {
                event.currentTarget.focus()
                if (pendingMode === null) void askFrosty(action.mode)
              }}
            >
              {pendingMode === action.mode ? 'Thinking…' : action.label}
            </button>
          )
        })}
      </div>

      <details className="coach-panel__privacy">
        <summary>How coaching uses your work</summary>
        <p>Frosty runs only when you choose an action. Guidance is authored into Pivot and stays in this browser. Frosty cannot run SQL, insert an answer, or mark work complete.</p>
      </details>

      <div className="coach-panel__live" aria-live="polite" aria-atomic="true">
        {failure && <p className="coach-panel__failure" role="alert">{failure}</p>}
        {visibleResponse && (
          <article className="coach-response">
            <div className="coach-response__eyebrow">
              Frosty · built-in guidance
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
