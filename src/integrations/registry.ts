import { githubStatus } from './github'
import { slackStatus } from './slack'
import type { IntegrationStatus } from './types'

/** Packs declare which integrations they want; registry returns honest statuses. */
export function listIntegrationStatuses(): IntegrationStatus[] {
  return [githubStatus(), slackStatus()]
}
