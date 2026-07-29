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
      title: 'Mission ladder',
      summary: `Guided ${place} asks from the finance team — start here if you want a clear next pull.`,
      actionLabel: 'Open next ask',
    },
    {
      id: 'scenario-library',
      title: 'Scenario library',
      summary: `Choose a cohesive ${place} work arc. Scenarios vary in depth and reuse your saved evidence.`,
      actionLabel: 'Browse scenarios',
    },
    {
      id: 'free-explore',
      title: 'Explore the warehouse',
      summary: 'Open the data navigator and free SQL — poke at tables with no ask selected.',
      actionLabel: 'Explore freely',
    },
    {
      id: 'career-dossier',
      title: 'Career dossier',
      summary: 'Capability stages, evidence seals, and company tracks — see where your pulls lead.',
      actionLabel: 'Open dossier',
    },
    {
      id: 'screen-practice',
      title: 'Screen practice',
      summary: 'Timed company audition overlays — one practice gym inside the broader desk, not the whole product.',
      actionLabel: opts.screensUnlocked ? 'Start a screen' : 'Locked for now',
      lockedReason: opts.screensUnlocked
        ? undefined
        : 'Unlocks after the ARR bridge capstone (mission 17). Until then, use the ladder or explore.',
    },
  ]
}
