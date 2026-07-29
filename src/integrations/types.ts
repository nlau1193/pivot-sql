/**
 * Workplace integration adapters — design seams for live GitHub/Slack immersion.
 * Default state is disconnected. Do not invent fake messages, PRs, or channels.
 * Public integration boundary for optional hosts.
 */

export type IntegrationId = 'github' | 'slack'

export type ConnectionState = 'disconnected' | 'sandbox' | 'live'

export interface IntegrationStatus {
  id: IntegrationId
  label: string
  state: ConnectionState
  /** Honest empty-state copy for UI — never claim live data when disconnected */
  detail: string
}

export function defaultIntegrationStatuses(): IntegrationStatus[] {
  return [
    {
      id: 'github',
      label: 'GitHub',
      state: 'disconnected',
      detail: 'Not connected. Connect GitHub to bring work items and code reviews into this workspace.',
    },
    {
      id: 'slack',
      label: 'Slack',
      state: 'disconnected',
      detail: 'Not connected. Connect Slack to bring channels and mentions into this workspace.',
    },
  ]
}

export function isLive(status: IntegrationStatus): boolean {
  return status.state === 'live'
}
