import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { engine } from './db'
import { DATA, nextMission, missionById, simByQuestionId, type CompiledMission, type SimQuestion } from './missions'
import {
  acknowledgeBadge,
  draftEntityId,
  loadProgress,
  mergeProgress,
  mergeSaveProgress,
  putDraft,
  recordAuditionSolve,
  recordCampaignSolve,
  removeDraft,
  startAuditionAttempt,
  subscribeToProgress,
  type AuditionAttempt,
  type HintEvidence,
  type ProgressV2,
} from './progress-store'
import { Workspace } from './Workspace'
import { Desk } from './Desk'
import { fmtInt } from './format'
import { ACTIVE_PACK_ID } from './kit/pack-manifest'
import { loadPathSession, savePathSession } from './kit/path-session'
import { scenarioById, scenarioProgress } from './packs/parkline-fpa/scenarios'
import { STAR67_STORY } from './star67-story'
import { DeskCrew } from './characters/DeskCrew'

type Phase = 'intro' | 'loading' | 'ready' | 'error'
type LoadBytes = { loaded: number; total: number } | null
type ActiveAudition = Pick<AuditionAttempt, 'attemptId' | 'auditionId' | 'startedAt'>
export type PivotSyncStatus = {
  pendingCount: number
  conflictCount: number
  error: string | null
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [loadMsg, setLoadMsg] = useState('')
  const [loadFrac, setLoadFrac] = useState(0)
  const [loadBytes, setLoadBytes] = useState<LoadBytes>(null)
  const [bootError, setBootError] = useState<string | null>(null)
  const [progress, setProgress] = useState(loadProgress)
  const progressRef = useRef(progress)
  const [deskOpen, setDeskOpen] = useState(false)
  // current focus: a mission, a sim question, or null (explore mode)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null)
  const [simMode, setSimMode] = useState(false)
  const [activeAudition, setActiveAudition] = useState<ActiveAudition | null>(null)
  const activeAuditionRef = useRef<ActiveAudition | null>(null)
  const syncStatus: PivotSyncStatus = { pendingCount: 0, conflictCount: 0, error: null }
  const errorHeadingRef = useRef<HTMLHeadingElement>(null)
  const returning = useMemo(() => Object.keys(progress.pulls).length > 0, [progress.pulls])

  useEffect(() => {
    if (phase === 'error') errorHeadingRef.current?.focus()
  }, [phase])

  const applyProgress = useCallback((next: ProgressV2) => {
    progressRef.current = next
    setProgress(next)
  }, [])

  useEffect(() => subscribeToProgress((incoming) => {
    // A storage event means another tab has already replaced the shared value.
    // Persist the union back immediately or a reload can lose this tab's
    // immutable receipts even though the in-memory UI briefly showed both.
    applyProgress(mergeSaveProgress(mergeProgress(progressRef.current, incoming)))
  }), [applyProgress])

  const begin = useCallback(async () => {
    setBootError(null)
    setLoadMsg('Waking the warehouse engine…')
    setLoadFrac(0)
    setLoadBytes(null)
    setPhase('loading')
    try {
      await engine.boot((msg, frac, loaded, total) => {
        setLoadMsg(msg)
        setLoadFrac(frac)
        setLoadBytes(loaded !== undefined && total !== undefined ? { loaded, total } : null)
      })
      const p = loadProgress()
      applyProgress(p)
      const pathSession = loadPathSession(ACTIVE_PACK_ID)
      const savedScenario = pathSession?.lastPathId === 'scenario-library' ? scenarioById(pathSession.lastScenarioId) : undefined
      const savedScenarioNext = savedScenario ? scenarioProgress(savedScenario, p).next : null
      const next = savedScenarioNext ?? nextMission(p)
      setActiveScenarioId(savedScenarioNext ? savedScenario?.id ?? null : null)
      setCurrentId(next ? next.id : null)
      setPhase('ready')
    } catch (e) {
      setBootError(String(e))
      setPhase('error')
    }
  }, [applyProgress])

  const markSolved = useCallback((missionId: string, sql: string, title: string, isSim: boolean, hintLevel: HintEvidence): boolean => {
    const input = { missionId, sql, title, contentRevision: String(DATA.builtAt), hintLevel }
    try {
      if (!isSim) {
        const recorded = recordCampaignSolve(progressRef.current, input)
        applyProgress(mergeSaveProgress(recorded.progress))
        return true
      }

      const variant = simByQuestionId(missionId)
      const activeAttempt = activeAuditionRef.current
      if (!variant || !activeAttempt || activeAttempt.auditionId !== variant.id) return false
      const recorded = recordAuditionSolve(
        progressRef.current,
        input,
        activeAttempt.attemptId,
        { auditionId: variant.id, questionIds: variant.questions.map((question) => question.id) },
      )
      applyProgress(mergeSaveProgress(recorded.progress))
      return true
    } catch {
      return false
    }
  }, [applyProgress])

  const goToMission = useCallback((id: string | null, sim = false, newSimAttempt = false, scenarioId?: string | null) => {
    const requestedScenario = !sim && scenarioId !== undefined ? scenarioById(scenarioId) : undefined
    if (!sim && scenarioId !== undefined && (!requestedScenario || !id || !requestedScenario.missionIds.includes(id))) return

    if (sim && newSimAttempt) {
      const selected = id ? simByQuestionId(id) : undefined
      if (!selected) return
      const started = startAuditionAttempt(progressRef.current, selected.id)
      applyProgress(mergeSaveProgress(started.progress))
      const attempt = started.progress.auditionAttempts[started.attemptId]
      const active = { attemptId: attempt.attemptId, auditionId: attempt.auditionId, startedAt: attempt.startedAt }
      activeAuditionRef.current = active
      setActiveAudition(active)
    } else if (!sim) {
      activeAuditionRef.current = null
      setActiveAudition(null)
    }
    if (sim) {
      if (activeScenarioId) savePathSession('screen-practice', ACTIVE_PACK_ID)
      setActiveScenarioId(null)
    } else if (scenarioId !== undefined) {
      setActiveScenarioId(requestedScenario!.id)
      savePathSession('scenario-library', ACTIVE_PACK_ID, requestedScenario!.id)
    } else {
      if (activeScenarioId) savePathSession(id === null ? 'free-explore' : 'mission-ladder', ACTIVE_PACK_ID)
      setActiveScenarioId(null)
    }
    setSimMode(sim)
    setCurrentId(id)
    setDeskOpen(false)
  }, [activeScenarioId, applyProgress])

  const handleDraftChange = useCallback((questionId: string, attemptId: string | null, sql: string): boolean => {
    try {
      if (attemptId && activeAuditionRef.current?.attemptId !== attemptId) return false
      if (sql.length > 0) {
        const saved = putDraft(progressRef.current, questionId, attemptId, sql)
        const next = mergeSaveProgress(saved.progress)
        applyProgress(next)
        return next.storageAvailable
      }
      const entityId = draftEntityId(questionId, attemptId)
      if (!progressRef.current.drafts[entityId]) return progressRef.current.storageAvailable
      const removed = removeDraft(progressRef.current, questionId, attemptId)
      const next = mergeSaveProgress(removed.progress)
      applyProgress(next)
      return next.storageAvailable
    } catch {
      return false
    }
  }, [applyProgress])

  const handleAcknowledgeBadge = useCallback((badgeId: string) => {
    if (progressRef.current.seenBadgeIds.includes(badgeId)) return
    applyProgress(mergeSaveProgress(acknowledgeBadge(progressRef.current, badgeId)))
  }, [applyProgress])

  if (phase === 'intro') return <Intro returning={returning} onBegin={begin} />
  if (phase === 'loading') return <Loading msg={loadMsg} frac={loadFrac} bytes={loadBytes} />
  if (phase === 'error') {
    const interrupted = bootError?.includes('__datafetch__')
    return (
      <main className="fullpage-card">
        <div className="card intro-card error-card">
          <h1 ref={errorHeadingRef} tabIndex={-1}>{interrupted ? 'The warehouse download was interrupted.' : "Hm — the warehouse didn't wake up."}</h1>
          <p role="alert">{interrupted
            ? 'The warehouse download stopped before it finished. Your completed queries are safe. Check your connection, then try again.'
            : "The warehouse didn't finish waking up. Try again. If it keeps happening, open the technical details and include them in a GitHub issue."}</p>
          <button className="btn-primary btn-large" onClick={begin}>Try again</button>
          {bootError && (
            <details className="technical-details">
              <summary>Technical details</summary>
              <pre className="rawerror">{bootError}</pre>
            </details>
          )}
        </div>
      </main>
    )
  }

  const mission: CompiledMission | undefined = !simMode && currentId ? missionById(currentId) : undefined
  const simVariant = simMode && currentId ? simByQuestionId(currentId) : undefined
  const simQ: SimQuestion | undefined = simVariant?.questions.find((q) => q.id === currentId)

  return (
    <>
      <Workspace
        mission={mission ?? null}
        simQuestion={simQ ?? null}
        simVariant={simVariant ?? null}
        simStartedAt={activeAudition ? Date.parse(activeAudition.startedAt) : null}
        attemptId={activeAudition?.attemptId ?? null}
        progress={progress}
        runtimeLabel="Saved on this device"
        syncMode="local"
        syncStatus={syncStatus}
        activeScenarioId={activeScenarioId}
        onSolved={markSolved}
        onDraftChange={handleDraftChange}
        onOpenDesk={() => setDeskOpen(true)}
        onNavigate={goToMission}
      />
      {deskOpen && (
          <Desk
            progress={progress}
            currentId={currentId}
            activeScenarioId={activeScenarioId}
          onClose={() => setDeskOpen(false)}
          onNavigate={goToMission}
          onAcknowledgeBadge={handleAcknowledgeBadge}
        />
      )}
    </>
  )
}

function Intro({ returning, onBegin }: { returning: boolean; onBegin: () => void }) {
  return (
    <main className="fullpage-card">
      <div className="card intro-card intro-card--crew">
        <div className="wordmark">Star67</div>
        <p className="tagline">from spreadsheets to company data</p>
        {returning ? (
          <>
            <h1>Welcome back to {DATA.company}.</h1>
            <p>
              Your completed queries are saved, and your next finance task is ready.
            </p>
          </>
        ) : (
          <>
            <p className="story-year">Fictional practice desk · SQL practice · {STAR67_STORY.year}</p>
            <h1>Learn SQL one clear question at a time.</h1>
            <p>
              Practice on fictional company data. Start with one guided task, run the query,
              and get clear feedback.
            </p>
          </>
        )}
        <button className="btn-primary btn-large" onClick={onBegin}>
          {returning ? 'Back to my desk' : 'Open my desk'}
        </button>
        {!returning && (
          <details className="intro-story">
            <summary>About Star67 and the guides</summary>
            <div className="intro-story__body">
              <p>
                {DATA.company} helps companies track the cost and results of work done by AI agents.
                Every action has an owner, a cost, and a business outcome.
              </p>
              <p>
                Riff, the CFO, is waiting. She opens the <strong>{fmtInt(DATA.totalRows)}-row finance
                database frozen on June 30, 2026</strong>. Usage exploded, ARR and revenue stopped
                agreeing, and Finance needs one trusted answer. You will rebuild those controls
                with SQL before touching the live 2030 plan.
              </p>
              <section className="intro-crew" aria-labelledby="intro-crew-title">
                <div className="intro-crew__copy">
                  <h2 id="intro-crew-title">Meet the crew at your desk.</h2>
                  <p>Six guides, six kinds of judgment, one finance team. They help you reason—not collect points.</p>
                </div>
                <DeskCrew presentation="welcome" />
              </section>
            </div>
          </details>
        )}
        {!returning && (
          <p className="fineprint intro-privacy">
            No account or sign-in. Start takes care of the local setup, and your queries and
            built-in coaching stay in your browser.
          </p>
        )}
      </div>
    </main>
  )
}

function Loading({ msg, frac, bytes }: { msg: string; frac: number; bytes: LoadBytes }) {
  const percent = Math.round(Math.min(1, Math.max(0, frac)) * 1000) / 10
  const byteText = bytes && bytes.total > 0
    ? `${formatDownloadBytes(bytes.loaded)} of ${formatDownloadBytes(bytes.total)}`
    : null
  return (
    <main className="fullpage-card" aria-busy="true">
      <div className="card intro-card">
        <div className="wordmark">Star67</div>
        <h1 id="warehouse-loading-title">Setting up your desk…</h1>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="Warehouse download"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={byteText ? `${byteText} downloaded` : msg}
        >
          <div className="progress-fill" style={{ transform: `scaleX(${percent / 100})` }} />
        </div>
        <div className="loading-status">
          <p id="warehouse-loading-status" className="loading-msg" aria-live="polite" aria-atomic="true">{msg}</p>
          <span className="loading-measure" aria-hidden="true">{byteText ?? `${Math.round(percent)}%`}</span>
        </div>
        <p className="fineprint loading-note">
          You're downloading an entire company's finance warehouse — millions of rows — into this
          tab. The database, queries, and coaching stay on your machine.
        </p>
      </div>
    </main>
  )
}

function formatDownloadBytes(bytes: number): string {
  return `${(Math.max(0, bytes) / (1024 * 1024)).toFixed(1)} MB`
}
