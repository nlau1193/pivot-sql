import { useMemo, useState } from 'react'
import { ACTIVE_PACK_ID } from './kit/pack-manifest'
import { deskPathsForActivePack } from './packs/active'
import type { DeskPath, PathId } from './kit/path-registry'
import { loadPathSession, pathTitle, savePathSession } from './kit/path-session'

interface PathChooserProps {
  screensUnlocked: boolean
  guidedTasksComplete: boolean
  onChoose: (id: PathId) => void
}

export function PathChooser({ screensUnlocked, guidedTasksComplete, onChoose }: PathChooserProps) {
  const paths = deskPathsForActivePack({ screensUnlocked })
    .filter((path) => path.id !== 'career-dossier')
    .map((path) => guidedTasksComplete && path.id === 'mission-ladder'
      ? {
          ...path,
          title: 'Guided tasks complete',
          summary: 'You finished the guided tasks. Reopen a saved query or explore the data.',
          actionLabel: 'Explore data',
        }
      : path)
  const [session, setSession] = useState(() => loadPathSession(ACTIVE_PACK_ID))
  const lastPath = useMemo(() => {
    if (!session) return null
    if (guidedTasksComplete && session.lastPathId === 'mission-ladder') return null
    return paths.find((path) => path.id === session.lastPathId) ?? null
  }, [guidedTasksComplete, paths, session])

  const choose = (id: PathId) => {
    setSession(savePathSession(id, ACTIVE_PACK_ID))
    onChoose(id)
  }

  return (
    <section className="path-chooser" aria-labelledby="path-chooser-title">
      <div className="path-chooser-head">
        <h2 id="path-chooser-title">What would you like to do?</h2>
        <p>
          Start with the next guided task, choose a practice project, or explore the data.
          You can switch anytime, and your work stays saved.
        </p>
      </div>
      {lastPath && !lastPath.lockedReason && (
        <div className="path-continue" data-last-path={lastPath.id}>
          <div className="path-continue-copy">
            <div className="path-continue-label">Continue where you left off</div>
            <p className="path-continue-summary">{pathTitle(lastPath.id)} · your work is saved.</p>
          </div>
          <button
            type="button"
            className="btn-primary btn-small"
            aria-label={`Continue: ${lastPath.title}`}
            onClick={() => choose(lastPath.id)}
          >
            Continue
          </button>
        </div>
      )}
      <ul className="path-chooser-list">
        {paths.map((path) => (
          <PathCard
            key={path.id}
            path={path}
            current={session?.lastPathId === path.id}
            onChoose={choose}
          />
        ))}
      </ul>
    </section>
  )
}

function PathCard({
  path,
  current,
  onChoose,
}: {
  path: DeskPath
  current: boolean
  onChoose: (id: PathId) => void
}) {
  const locked = !!path.lockedReason
  return (
    <li
      className={`path-card${locked ? ' path-card--locked' : ''}${current ? ' path-card--current' : ''}`}
      data-path-id={path.id}
      data-current={current ? 'true' : 'false'}
    >
      <div className="path-card-copy">
        <div className="path-card-title">
          {path.title}
          {current && !locked ? <span className="path-card-current-badge"> Last direction</span> : null}
        </div>
        <p className="path-card-summary">{path.summary}</p>
        {locked && <p className="path-card-lock">{path.lockedReason}</p>}
      </div>
      <button
        type="button"
        className={locked ? 'btn-ghost btn-small' : 'btn-primary btn-small'}
        disabled={locked}
        aria-label={`${path.actionLabel}: ${path.title}`}
        onClick={() => onChoose(path.id)}
      >
        {path.actionLabel}
      </button>
    </li>
  )
}
