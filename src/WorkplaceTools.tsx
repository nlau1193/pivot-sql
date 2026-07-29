import { ACTIVE_PACK_ID, type PackManifest } from './kit/pack-manifest'
import { integrationsForActivePack, activePack, notInstalledPacks } from './packs/active'
import type { IntegrationStatus } from './integrations/types'

/** Honest workplace-tool strip — never invents live GitHub/Slack data. */
export function WorkplaceTools() {
  const pack = activePack()
  const statuses = integrationsForActivePack()
  const future = notInstalledPacks()
  return (
    <section className="workplace-tools" aria-labelledby="workplace-tools-title">
      <div className="workplace-tools-head">
        <h2 id="workplace-tools-title">Workplace tools</h2>
        <p>
          {pack.place} · {roleLabel(pack.role)} workspace. GitHub and Slack are optional and
          currently disconnected.
        </p>
      </div>
      <ul className="workplace-tools-list">
        {statuses.map((status) => (
          <ToolRow key={status.id} status={status} />
        ))}
      </ul>
      {future.length > 0 && (
        <div className="future-desks" aria-labelledby="future-desks-title">
          <h3 id="future-desks-title">Future desks</h3>
          <p>Additional role workspaces are available when their content is installed.</p>
          <ul className="future-desks-list">
            {future.map((candidate) => (
              <FutureDeskRow key={candidate.id} pack={candidate} />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function ToolRow({ status }: { status: IntegrationStatus }) {
  return (
    <li className="workplace-tool" data-integration={status.id} data-state={status.state}>
      <div>
        <div className="workplace-tool-label">{status.label}</div>
        <p className="workplace-tool-detail">{status.detail}</p>
      </div>
      <span className="workplace-tool-state">{stateLabel(status.state)}</span>
    </li>
  )
}

function FutureDeskRow({ pack }: { pack: PackManifest }) {
  return (
    <li className="future-desk" data-pack-id={pack.id} data-state="not-installed">
      <div>
        <div className="future-desk-label">{pack.place}</div>
        <p className="future-desk-detail">{roleLabel(pack.role)} workspace — content not installed.</p>
      </div>
      <span className="future-desk-state">Not installed</span>
    </li>
  )
}

function roleLabel(role: string): string {
  if (role === 'fpa') return 'FP&A'
  if (role === 'engineer') return 'Engineer'
  if (role === 'designer') return 'Designer'
  return role
}

function stateLabel(state: IntegrationStatus['state']): string {
  if (state === 'disconnected') return 'Not connected'
  if (state === 'sandbox') return 'Sandbox'
  return 'Live'
}
