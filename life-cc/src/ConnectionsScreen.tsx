import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { CONNECTORS } from './connectors'
import { useConnectorAccounts } from './useConnectorAccounts'

function asErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function ConnectionsScreen() {
  const { organizationId, accountsQuery, accountBySlug, actionErrors, connectConnector, disconnectConnector, pendingSlug } = useConnectorAccounts()

  return (
    <section className="flex flex-col gap-3">
      <div className="life-page-header">
        <div>
          <h1 className="life-page-header__title">Connections</h1>
          <p className="life-page-header__subtitle">Connected services stay visible here, with reconnect state surfaced inline.</p>
        </div>
        <button
          type="button"
          onClick={() => void accountsQuery.refetch()}
          disabled={accountsQuery.isFetching}
          className="life-action-chip inline-flex items-center gap-2 px-3 py-2 text-sm disabled:opacity-60"
        >
          <RefreshCw size={16} className={accountsQuery.isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {accountsQuery.error ? (
        <div className="life-inline-status life-inline-status--danger">
          <AlertCircle size={16} />
          {asErrorMessage(accountsQuery.error)}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {CONNECTORS.map((connector) => {
          const account = accountBySlug.get(connector.slug)
          const isConnected = account?.status === 'CONNECTED' || connector.alwaysConnected
          const needsReconnect = account?.status === 'REAUTH_REQUIRED'
          const isBusy = pendingSlug === connector.slug
          const Icon = connector.icon
          const error = actionErrors[connector.slug]

          return (
            <div
              key={connector.slug}
              className="life-card flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3eee7]">
                    <Icon size={20} className="text-[#6d6257]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#2c261f]">{connector.label}</p>
                    <p className="text-xs text-[#8d8274]">{connector.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isConnected ? (
                    <span className="life-inline-status life-inline-status--success">
                      <CheckCircle2 size={14} />
                      Connected
                    </span>
                  ) : needsReconnect ? (
                    <span className="life-inline-status life-inline-status--warning">
                      <AlertCircle size={14} />
                      Needs reconnect
                    </span>
                  ) : connector.comingSoon ? (
                    <span className="life-muted-note">Coming soon</span>
                  ) : null}

                  {connector.note ? (
                    <span className="life-muted-note">{connector.note}</span>
                  ) : isConnected ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => account && disconnectConnector(connector.slug, account.id)}
                      className="life-action-chip disabled:opacity-60"
                    >
                      {isBusy ? <Loader2 size={14} className="animate-spin" /> : 'Disconnect'}
                    </button>
                  ) : connector.comingSoon ? (
                    <button
                      type="button"
                      disabled
                      title="Not set up yet"
                      className="life-action-chip opacity-60"
                    >
                      Connect
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy || !organizationId}
                      onClick={() => connectConnector(connector.slug)}
                      className="life-action-primary inline-flex items-center gap-2 disabled:opacity-60"
                    >
                      {isBusy ? <Loader2 size={14} className="animate-spin" /> : null}
                      {needsReconnect ? 'Reconnect' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>

              {error ? (
                <p className="text-xs text-[#e05c5c]">{error}</p>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
