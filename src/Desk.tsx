import { useEffect, useMemo, useRef, useState } from 'react'
import { DATA, PEOPLE, nextMission, nextSimVariant, simByQuestionId, simIsComplete, type CompiledMission } from './missions'
import { exportProgress, importProgress, type ProgressV2 } from './progress-store'
import { CareerDossier } from './CareerDossier'
import { PathChooser } from './PathChooser'
import { WorkplaceTools } from './WorkplaceTools'
import type { PathId } from './kit/path-registry'
import { PARKLINE_SCENARIOS, scenarioProgress } from './packs/parkline-fpa/scenarios'
import { screenUnlockMissionId } from './packs/active'

interface Props {
  progress: ProgressV2
  currentId: string | null
  activeScenarioId: string | null
  onClose: () => void
  onNavigate: (id: string | null, sim?: boolean, newSimAttempt?: boolean, scenarioId?: string | null) => void
  onAcknowledgeBadge: (badgeId: string) => void
}

type Tab = 'queue' | 'dossier' | 'pulls'
type QueueView = 'directions' | 'scenarios'

export function Desk({ progress, currentId, activeScenarioId, onClose, onNavigate, onAcknowledgeBadge }: Props) {
  const [tab, setTab] = useState<Tab>('queue')
  const [queueView, setQueueView] = useState<QueueView>('directions')
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const completed = progress.pulls
  const completedCount = Object.keys(completed).length
  const unlockId = screenUnlockMissionId()
  const capstoneDone = unlockId ? !!completed[unlockId] : false
  const completedSimCount = DATA.sims.filter((sim) => simIsComplete(sim, progress)).length
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
      const sim = nextSimVariant(progress) ?? DATA.sims[0]
      const firstQ = sim?.questions[0]?.id ?? null
      if (firstQ) onNavigate(firstQ, true, true)
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
          <button className={tab === 'queue' ? 'tab active' : 'tab'} onClick={() => setTab('queue')}>The queue</button>
          <button className={tab === 'dossier' ? 'tab active' : 'tab'} onClick={() => setTab('dossier')}>Career dossier</button>
          <button className={tab === 'pulls' ? 'tab active' : 'tab'} onClick={() => setTab('pulls')}>Your pulls ({completedCount})</button>
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
            ) : (
              <>
                <PathChooser screensUnlocked={capstoneDone} onChoose={choosePath} />
                {DATA.parts.map((part) => {
                  const missions = DATA.missions.filter((m) => m.part === part.id)
                  if (!missions.length) return null
                  return (
                    <div key={part.id} className="queue-part">
                      <div className="queue-part-name">{part.name}</div>
                      {missions.map((m) => <QueueRow key={m.id} m={m} done={!!completed[m.id]} current={m.id === currentId} unlocked={isUnlocked(m, completed)} onGo={() => onNavigate(m.id)} />)}
                    </div>
                  )
                })}
                <div className="queue-part">
                  <div className="queue-part-name">Company auditions</div>
                  <p className="ready-intro">{capstoneDone
                    ? `${completedSimCount} of ${DATA.sims.length} distinct auditions complete. Each new attempt starts blank and keeps its own evidence.`
                    : `Auditions unlock after the ARR bridge capstone. They use ${DATA.company} data and do not claim to reproduce a company interview.`}</p>
                  {DATA.sims.map((sim) => {
                    const done = simIsComplete(sim, progress)
                    const active = activeSim?.id === sim.id
                    return (
                      <div key={sim.id} className={`queue-row ${!capstoneDone ? 'queue-dim' : ''} ${done ? 'queue-done' : ''} ${active ? 'queue-current' : ''}`}>
                        <div>
                          <div className="queue-row-title">{done ? '✓ ' : ''}{sim.company} audition</div>
                          <div className="queue-row-sub">{active ? 'Attempt in progress · restart begins blank' : sim.title}</div>
                        </div>
                        {capstoneDone && <button className={done || active ? 'btn-ghost btn-small' : 'btn-primary btn-small'} onClick={() => onNavigate(sim.questions[0]?.id ?? null, true, true)} aria-label={`${active ? 'Restart' : done ? 'Retake' : 'Start'} ${sim.company} audition`}>{active ? 'Restart' : done ? 'Retake' : 'Start'}</button>}
                      </div>
                    )
                  })}
                </div>
                <div className="desk-footnote">
                  <WorkplaceTools />
                  <ProgressPorter progress={progress} />
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'dossier' && (
          <CareerDossier progress={progress} onNavigate={onNavigate} onAcknowledgeBadge={onAcknowledgeBadge} />
        )}

        {tab === 'pulls' && (
          <div className="pulls">
            {completedCount === 0 && <p className="ready-intro">Every ask you deliver gets saved here — a growing query library you can pattern-match from at your actual job.</p>}
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
        <div className="scenario-library-era">Star67 · the 2026 casebook</div>
        <h2 ref={titleRef} id="scenario-library-title" tabIndex={-1}>The Star67 operating story</h2>
        <p>
          Every workday is a chapter in the same company: growth outruns controls, unit economics
          get strange, and Finance has to turn conflicting systems into one decision. Pick the
          pressure you want to solve; correct pulls carry across the whole casebook.
        </p>
        <div className="scenario-library-tools">
          <label>
            <span className="sr-only">Find a workday</span>
            <input type="search" value={query} placeholder="Find a workday" onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label>
            <span className="sr-only">Filter workdays</span>
            <select aria-label="Filter workdays" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
              <option value="all">All workdays</option>
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
            <div className="scenario-copy"><div className="scenario-kicker">{state.total} parts · {state.completed} delivered{active ? ' · Active workday' : ''}</div><h3>{scenario.title}</h3><p>{scenario.brief}</p></div>
            {target && <button className="btn-ghost btn-small" type="button" onClick={() => onOpen(scenario.id, target.id)}>{!state.next ? 'Revisit' : state.completed ? 'Continue' : 'Start'}</button>}
          </article>
        })}
        {scenarios.length === 0 && <p className="scenario-library-empty">No workdays match that view.</p>}
      </div>
    </section>
  )
}

/** Missions unlock in order: a mission is open when everything before it is done
 * (with a 2-ahead grace so one stubborn ask never walls the queue). */
function isUnlocked(m: CompiledMission, completed: Record<string, unknown>): boolean {
  const idx = DATA.missions.findIndex((x) => x.id === m.id)
  const doneBefore = DATA.missions.slice(0, idx).filter((x) => completed[x.id]).length
  return idx - doneBefore <= 2
}

function QueueRow({ m, done, current, unlocked, onGo }: { m: CompiledMission; done: boolean; current: boolean; unlocked: boolean; onGo: () => void }) {
  return (
    <div className={`queue-row ${done ? 'queue-done' : ''} ${!unlocked && !done ? 'queue-dim' : ''} ${current ? 'queue-current' : ''}`}>
      <div>
        <div className="queue-row-title">{done ? '✓ ' : ''}{m.title}</div>
        <div className="queue-row-sub">from {PEOPLE[m.from].name}{current ? ' · on your screen now' : ''}</div>
      </div>
      {(unlocked || done) && !current && <button className="btn-ghost btn-small" onClick={onGo}>{done ? 'Revisit' : 'Open'}</button>}
    </div>
  )
}

function ProgressPorter({ progress }: { progress: ProgressV2 }) {
  const [msg, setMsg] = useState('')
  const copyProgress = async () => {
    try {
      await navigator.clipboard.writeText(exportProgress(progress))
      setMsg('Copied a v2 progress envelope.')
    } catch {
      setMsg('Copy failed. Your browser may block clipboard access.')
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
          if (!result.ok) { setMsg(`That code didn't parse — double-check the copy.`); return }
          location.reload()
        }}>Paste a progress code</button>
        <span className="porter-msg">{msg}</span>
      </div>
    </details>
  )
}
