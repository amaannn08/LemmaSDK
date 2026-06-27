import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { lemmaClient } from './lemma-client'
import { CONNECTORS, type ConnectorSlug } from './connectors'

function asErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

type AccountInfo = { id: string; status: string }

export function ConnectionsScreen() {
  const queryClient = useQueryClient()
  // Per-connector action error, shown inline under that connector's row only —
  // a failed connect/disconnect on one service shouldn't block the others.
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({})

  const podId = lemmaClient.podId
  const podQuery = useQuery({
    queryKey: ['pod', podId],
    queryFn: () => lemmaClient.pods.get(podId!),
    enabled: Boolean(podId),
  })
  const organizationId = podQuery.data?.organization_id

  // Re-lists on every mount. This is a full-page-redirect OAuth flow, not a
  // popup, so the SPA reloads from scratch on return — mounting fresh and
  // re-listing here is what picks up a newly connected account. It also
  // doubles as the account-health check: a token revoked since last visit
  // shows up as REAUTH_REQUIRED next time this screen mounts, not just at
  // connect-time.
  const accountsQuery = useQuery({
    queryKey: ['connector-accounts', organizationId],
    queryFn: () => lemmaClient.connectors.accounts.list(organizationId!),
    enabled: Boolean(organizationId),
  })

  const accountBySlug = useMemo(() => {
    const map = new Map<ConnectorSlug, AccountInfo>()
    for (const account of accountsQuery.data?.items ?? []) {
      map.set(account.connector_id as ConnectorSlug, { id: account.id, status: account.status })
    }
    return map
  }, [accountsQuery.data])

  const connectMutation = useMutation({
    mutationFn: async (slug: ConnectorSlug) => {
      if (!organizationId) throw new Error('No organization loaded yet')
      const request = await lemmaClient.connectors.createConnectRequest(organizationId, {
        connector_id: slug,
      })
      if (!request.authorization_url) {
        throw new Error('No authorization URL returned for this connector')
      }
      return request.authorization_url
    },
    onMutate: (slug) => setActionErrors((prev) => ({ ...prev, [slug]: '' })),
    onSuccess: (authorizationUrl) => {
      window.location.href = authorizationUrl // full-page redirect — SPA reloads on return
    },
    onError: (error, slug) => setActionErrors((prev) => ({ ...prev, [slug]: asErrorMessage(error) })),
  })

  const disconnectMutation = useMutation({
    mutationFn: async ({ slug, accountId }: { slug: ConnectorSlug; accountId: string }) => {
      if (!organizationId) throw new Error('No organization loaded yet')
      await lemmaClient.connectors.accounts.delete(organizationId, accountId)
      return slug
    },
    onMutate: ({ slug }) => setActionErrors((prev) => ({ ...prev, [slug]: '' })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['connector-accounts', organizationId] })
    },
    onError: (error, { slug }) => setActionErrors((prev) => ({ ...prev, [slug]: asErrorMessage(error) })),
  })

  const pending = connectMutation.isPending ? connectMutation.variables : disconnectMutation.isPending ? disconnectMutation.variables?.slug : undefined

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-zinc-400">Connections</h2>
        <button
          type="button"
          onClick={() => void accountsQuery.refetch()}
          disabled={accountsQuery.isFetching}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 disabled:opacity-60"
        >
          <RefreshCw size={16} className={accountsQuery.isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {accountsQuery.error ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-400">
            <AlertCircle size={16} />
            {asErrorMessage(accountsQuery.error)}
          </div>
        ) : null}

        {CONNECTORS.map((connector) => {
          const account = accountBySlug.get(connector.slug)
          const isConnected = account?.status === 'CONNECTED'
          const needsReconnect = account?.status === 'REAUTH_REQUIRED'
          const isBusy = pending === connector.slug
          const Icon = connector.icon
          const error = actionErrors[connector.slug]

          return (
            <div
              key={connector.slug}
              className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Icon size={20} className="text-zinc-400" />
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{connector.label}</p>
                    <p className="text-xs text-zinc-500">{connector.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isConnected ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
                      <CheckCircle2 size={14} />
                      Connected
                    </span>
                  ) : needsReconnect ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-500">
                      <AlertCircle size={14} />
                      Needs reconnect
                    </span>
                  ) : connector.comingSoon ? (
                    <span className="text-xs font-medium text-zinc-500">Coming soon</span>
                  ) : null}

                  {connector.comingSoon ? (
                    <button
                      type="button"
                      disabled
                      title="Not set up yet"
                      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-500"
                    >
                      Connect
                    </button>
                  ) : isConnected ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => account && disconnectMutation.mutate({ slug: connector.slug, accountId: account.id })}
                      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 disabled:opacity-60"
                    >
                      {isBusy ? <Loader2 size={14} className="animate-spin" /> : 'Disconnect'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy || !organizationId}
                      onClick={() => connectMutation.mutate(connector.slug)}
                      className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {isBusy ? <Loader2 size={14} className="animate-spin" /> : null}
                      {needsReconnect ? 'Reconnect' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>

              {error ? (
                <p className="text-xs text-red-400">{error}</p>
              ) : null}
            </div>
          )
        })}
    </section>
  )
}
