import { useEffect, useMemo, useRef, useState } from 'react'
import { DATA, nextMission, simByQuestionId, simIsComplete } from './missions'
import { exportProgress, importProgress, type ProgressV2 } from './progress-store'
import { CareerDossier } from './CareerDossier'
import { PathChooser } from './PathChooser'
import type { PathId } from './kit/path-registry'
import { PARKLINE_SCENARIOS, scenarioProgress } from './packs/parkline-fpa/scenarios'
import { screenUnlockMissionId } from './packs/active'
import { practiceCopy } from './kit/practice-copy'

interface Props {
  progress: ProgressV2
  currentId: string | null
  activeScenarioId: string | null
  onClose: () => void
  onNavigate: (id: string | null, sim?: boolean, newSimAttempt?: boolean, scenarioId?: string | null) => void
  onAcknowledgeBadge: (badgeId: string) => void
}

type Tab = 'queue' | 'dossier' | 'pulls'
type QueueView = 'directions' | 'scenarios' | 'practice'

export function Desk({ progress, currentId, activeScenarioId, onClose, onNavigate, onAcknowledgeBadge }: Props) {
  const [tab, setTab] = useState<Tab>('queue')
  const [queueView, setQueueView] = useState<QueueView>('directions')
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const completed = progress.pulls
  const completedCount = Object.keys(completed).length
  const unlockId = screenUnlockMissionId()
  const capstoneDone = unlockId ? !!completed[unlockId] : false
  const activeSim = currentId ? simByQuestionId(currentId) : undefined
  const lastPull = useMemo(() => {
    const all = Object.values(completed).sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    return all[0] ?? null
  }, [completed])

  const choosePath = (id: PathId) => {
    if (id === 'mission-ladder') {
      const next = nextMission(progress)
      if (next) onNavigate(next.id)
      return
    }
    if (id === 'scenario-library') {
      setQueueView('scenarios')
      return
    }
    if (id === 'free-explore') {
      onNavigate(null)
      return
    }
    if (id === 'career-dossier') {
      setTab('dossier')
      return
    }
    if (id === 'screen-practice') {
      if (!capstoneDone) return
      setQueueView('practice')
    }
  }

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    closeRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialog) return

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getClientRects().length > 0
        && !(element.tagName !== 'SUMMARY' && element.closest('details:not([open])')))
      if (!focusable.length) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      opener?.focus()
    }
  }, [])

  return (
    <div className="desk-overlay" onClick={onClose}>
      <div ref={dialogRef} className="desk" role="dialog" aria-modal="true" aria-labelledby="desk-title" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="desk-head">
          <div className="desk-title" id="desk-title">Your desk</div>
          <button ref={closeRef} className="btn-ghost" onClick={onClose}>Close</button>
        </div>

        {lastPull && completedCount < DATA.missions.length && (
          <div className="recap">
            <span className="recap-label">Previously at {DATA.company}</span> you delivered “{lastPull.title}”.
            {' '}No streaks here — life happens, the warehouse waits.
          </div>
        )}

        <div className="desk-tabs">
          <button className={tab === 'queue' ? 'tab active' : 'tab'} onClick={() => setTab('queue')}>My work</button>
          <button className={tab === 'dossier' ? 'tab active' : 'tab'} onClick={() => setTab('dossier')}>Progress</button>
          <button className={tab === 'pulls' ? 'tab active' : 'tab'} onClick={() => setTab('pulls')}>Saved queries ({completedCount})</button>
        </div>

        {tab === 'queue' && (
          <div className="queue">
            {queueView === 'scenarios' ? (
              <ScenarioLibrary
                progress={progress}
                activeScenarioId={activeScenarioId}
                onBack={() => setQueueView('directions')}
                onOpen={(scenarioId, missionId) => onNavigate(missionId, false, false, scenarioId)}
              />
            ) : queueView === 'practice' ? (
              <PracticeLibrary
                progress={progress}
                activeSimId={activeSim?.id ?? null}
                onBack={() => setQueueView('directions')}
                onOpen={(questionId) => onNavigate(questionId, true, true)}
              />
            ) : (
              <>
                <PathChooser screensUnlocked={capstoneDone} onChoose={choosePath} />
                <div className="desk-footnote">
                  <ProgressPorter progress={progress} />
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'dossier' && (
          <CareerDossier progress={progress} onAcknowledgeBadge={onAcknowledgeBadge} />
        )}

        {tab === 'pulls' && (
          <div className="pulls">
            {completedCount === 0 && <p className="ready-intro">Every task you complete saves its final query here. Reuse one as a starting point at work.</p>}
            {Object.values(completed).sort((a, b) => b.completedAt.localeCompare(a.completedAt)).map((p) => (
              <div key={p.missionId} className="pull-item">
                <div className="pull-head">
                  <span className="pull-title">{p.title}</span>
                  <span className="pull-date">{p.completedAt.slice(0, 10)}</span>
                </div>
                <pre className="pull-sql">{p.sql}</pre>
                <button className="btn-ghost btn-small" onClick={() => onNavigate(p.missionId)}>Reopen this ask</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PracticeLibrary({
  progress,
  activeSimId,
  onBack,
  onOpen,
}: {
  progress: ProgressV2
  activeSimId: string | null
  onBack: () => void
  onOpen: (questionId: string) => void
}) {
  const completed = DATA.sims.filter((sim) => simIsComplete(sim, progress)).length

  return (
    <section className="scenario-library" aria-labelledby="practice-library-title">
      <div className="scenario-library-head">
        <button className="scenario-library-back" type="button" onClick={onBack}>← All directions</button>
        <div className="scenario-library-era">Optional practice</div>
        <h2 id="practice-library-title">Choose a practice set</h2>
        <p>
          {completed} of {DATA.sims.length} complete. Each set uses fictional Star67 data and
          keeps the focus on the SQL skill—not a company’s interview process.
        </p>
      </div>
      <div className="scenario-list">
        {DATA.sims.map((sim, index) => {
          const done = simIsComplete(sim, progress)
          const active = activeSimId === sim.id
          const action = active ? 'Restart' : done ? 'Retake' : 'Start'
          const copy = practiceCopy(sim)
          return (
            <article className={`scenario-row${active ? ' scenario-row-active' : ''}`} key={sim.id}>
              <div className="scenario-copy">
                <div className="scenario-kicker">{sim.questions.length} questions · {done ? 'Complete' : active ? 'In progress' : 'Not started'}</div>
                <h3>Practice set {index + 1}: {copy.label}</h3>
                <p>{copy.summary}</p>
              </div>
              <button
                className={done || active ? 'btn-ghost btn-small' : 'btn-primary btn-small'}
                type="button"
                aria-label={`${action} practice set ${index + 1}`}
                onClick={() => onOpen(sim.questions[0]?.id ?? '')}
              >
                {action}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function ScenarioLibrary({
  progress,
  activeScenarioId,
  onBack,
  onOpen,
}: {
  progress: ProgressV2
  activeScenarioId: string | null
  onBack: () => void
  onOpen: (scenarioId: string, missionId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'in-progress' | 'not-started' | 'complete'>('all')
  const titleRef = useRef<HTMLHeadingElement>(null)
  const scenarios = useMemo(() => PARKLINE_SCENARIOS
    .map((scenario, index) => ({ scenario, index, state: scenarioProgress(scenario, progress) }))
    .filter(({ scenario, state }) => {
      const matchesQuery = `${scenario.title} ${scenario.brief}`.toLowerCase().includes(query.trim().toLowerCase())
      const status = state.completed === state.total ? 'complete' : state.completed > 0 ? 'in-progress' : 'not-started'
      return matchesQuery && (filter === 'all' || filter === status)
    })
    .sort((left, right) => {
      const rank = ({ scenario, state }: typeof left) => scenario.id === activeScenarioId
        ? 0
        : state.completed > 0 && state.completed < state.total
          ? 1
          : state.completed === 0 ? 2 : 3
      return rank(left) - rank(right) || right.index - left.index
    }), [activeScenarioId, filter, progress, query])

  useEffect(() => {
    requestAnimationFrame(() => titleRef.current?.focus())
  }, [])

  return (
    <section className="scenario-library" aria-labelledby="scenario-library-title">
      <div className="scenario-library-head">
        <button className="scenario-library-back" type="button" onClick={onBack}>← All directions</button>
        <div className="scenario-library-era">Star67 · practice projects</div>
        <h2 ref={titleRef} id="scenario-library-title" tabIndex={-1}>Choose a practice project</h2>
        <p>
          Every project happens inside the same company: growth outruns controls, unit economics
          get strange, and Finance has to turn conflicting systems into one decision. Pick the
          pressure you want to solve; completed tasks carry across every project.
        </p>
        <div className="scenario-library-tools">
          <label>
            <span className="sr-only">Find a project</span>
            <input type="search" value={query} placeholder="Find a project" onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label>
            <span className="sr-only">Filter projects</span>
            <select aria-label="Filter projects" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
              <option value="all">All projects</option>
              <option value="in-progress">In progress</option>
              <option value="not-started">Not started</option>
              <option value="complete">Completed</option>
            </select>
          </label>
          <output>{scenarios.length} shown</output>
        </div>
      </div>
      <div className="scenario-list">
        {scenarios.map(({ scenario, state }) => {
          const target = state.next ?? state.parts[state.parts.length - 1]?.mission
          const active = scenario.id === activeScenarioId
          const status = state.completed === state.total ? 'complete' : state.completed > 0 ? 'in-progress' : 'not-started'
          return <article className={`scenario-row${active ? ' scenario-row-active' : ''}`} key={scenario.id} data-scenario={scenario.id} data-parts={state.total} data-active={active} data-status={status}>
            <div className="scenario-copy"><div className="scenario-kicker">{state.completed} of {state.total} tasks complete{active ? ' · Current project' : ''}</div><h3>{scenario.title}</h3><p>{scenario.brief}</p></div>
            {target && <button className="btn-ghost btn-small" type="button" onClick={() => onOpen(scenario.id, target.id)}>{!state.next ? 'Revisit' : state.completed ? 'Continue' : 'Start'}</button>}
          </article>
        })}
        {scenarios.length === 0 && <p className="scenario-library-empty">No projects match that view.</p>}
      </div>
    </section>
  )
}

function ProgressPorter({ progress }: { progress: ProgressV2 }) {
  const [msg, setMsg] = useState('')
  const writeProgressClipboard = async (value: string) => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value)
        return
      } catch {
        // Some embedded and non-secure contexts expose the API but reject writes.
      }
    }
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    if (!copied) throw new Error('Clipboard unavailable')
  }
  const copyProgress = async () => {
    try {
      await writeProgressClipboard(exportProgress(progress))
      setMsg('Progress code copied.')
    } catch {
      setMsg('Copy failed. Select the code from your browser tools and try again.')
    }
  }
  return (
    <details className="porter">
      <summary>Moving to another computer?</summary>
      <p>Your progress lives in this browser. To carry it over: copy the code below, then paste it on the other machine.</p>
      <div className="porter-row">
        <button className="btn-ghost btn-small" onClick={() => { void copyProgress() }}>Copy my progress code</button>
        <button className="btn-ghost btn-small" onClick={async () => {
          const s = prompt('Paste your progress code:')
          if (!s) return
          const result = importProgress(s)
          if (!result.ok) {
            setMsg(result.error === 'storage_unavailable'
              ? `This browser couldn't save the imported progress. Keep this tab open and try again with more storage.`
              : `That code didn't parse — double-check the copy.`)
            return
          }
          location.reload()
        }}>Paste a progress code</button>
        <span className="porter-msg">{msg}</span>
      </div>
    </details>
  )
}
