import { defaultIntegrationStatuses, type IntegrationStatus } from './types'

/** Slack adapter seam — the local workspace stays disconnected until OAuth is configured. */
export function slackStatus(): IntegrationStatus {
  return defaultIntegrationStatuses().find((s) => s.id === 'slack')!
}
