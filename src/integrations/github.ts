import { defaultIntegrationStatuses, type IntegrationStatus } from './types'

/** GitHub adapter seam — the local workspace stays disconnected until OAuth is configured. */
export function githubStatus(): IntegrationStatus {
  return defaultIntegrationStatuses().find((s) => s.id === 'github')!
}
