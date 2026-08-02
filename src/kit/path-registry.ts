/**
 * Immersion-kernel path registry — pack-agnostic direction ids for open-world
 * first-session clarity. Parkline FP&A is the only pack today; Eng/Design packs
 * will register additional paths without rewriting Desk.
 *
 * This registry is the public contract for learning paths.
 */

export type PathId =
  | 'mission-ladder'
  | 'free-explore'
  | 'career-dossier'
  | 'screen-practice'
  | 'scenario-library'

export interface DeskPath {
  id: PathId
  title: string
  summary: string
  /** Adult casebook CTA — never game-HUD language */
  actionLabel: string
  /** When true, path is visible but not startable yet */
  lockedReason?: string
}

/** Default FP&A directions. Packs may filter or extend later. */
export function parklineDeskPaths(opts: { screensUnlocked: boolean; place?: string }): DeskPath[] {
  const place = opts.place ?? 'Star67'
  return [
    {
      id: 'mission-ladder',
      title: 'Next guided task',
      summary: `Continue with the next ${place} request. Best if you want one clear step.`,
      actionLabel: 'Start next task',
    },
    {
      id: 'scenario-library',
      title: 'Finance projects',
      summary: `Choose a realistic ${place} project, from planning and retention to workforce and close.`,
      actionLabel: 'Browse projects',
    },
    {
      id: 'free-explore',
      title: 'Explore company data',
      summary: 'Browse the tables and try your own SQL without a task selected.',
      actionLabel: 'Explore data',
    },
    {
      id: 'career-dossier',
      title: 'Progress',
      summary: 'See completed tasks, earned skills, and the next skill you are working toward.',
      actionLabel: 'View progress',
    },
    {
      id: 'screen-practice',
      title: 'Interview practice',
      summary: 'Optional timed SQL practice based on common FP&A hiring exercises.',
      actionLabel: opts.screensUnlocked ? 'Start practice' : 'Locked for now',
      lockedReason: opts.screensUnlocked
        ? undefined
        : 'Unlocks after the ARR bridge task. Until then, choose a guided task or explore.',
    },
  ]
}
