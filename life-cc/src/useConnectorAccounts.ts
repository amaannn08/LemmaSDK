import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { lemmaClient } from './lemma-client'

export type ConnectorAccountInfo = {
  id: string
  status: string
}

export function useConnectorAccounts() {
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({})

  const podId = lemmaClient.podId
  const podQuery = useQuery({
    queryKey: ['pod', podId],
    queryFn: () => lemmaClient.pods.get(podId!),
    enabled: Boolean(podId),
  })
  const organizationId = podQuery.data?.organization_id ?? null

  const accountsQuery = useQuery({
    queryKey: ['connector-accounts', organizationId],
    queryFn: () => lemmaClient.connectors.accounts.list(organizationId!),
    enabled: Boolean(organizationId),
  })

  const accountBySlug = useMemo(() => {
    const map = new Map<string, ConnectorAccountInfo>()
    for (const account of accountsQuery.data?.items ?? []) {
      map.set(account.connector_id, { id: account.id, status: account.status })
    }
    return map
  }, [accountsQuery.data])

  const connectMutation = useMutation({
    mutationFn: async (slug: string) => {
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
      window.location.href = authorizationUrl
    },
    onError: (error, slug) => setActionErrors((prev) => ({ ...prev, [slug]: error instanceof Error ? error.message : String(error) })),
  })

  const disconnectMutation = useMutation({
    mutationFn: async ({ slug, accountId }: { slug: string; accountId: string }) => {
      if (!organizationId) throw new Error('No organization loaded yet')
      await lemmaClient.connectors.accounts.delete(organizationId, accountId)
      return slug
    },
    onMutate: ({ slug }) => setActionErrors((prev) => ({ ...prev, [slug]: '' })),
    onSuccess: () => {
      void accountsQuery.refetch()
    },
    onError: (error, { slug }) => setActionErrors((prev) => ({ ...prev, [slug]: error instanceof Error ? error.message : String(error) })),
  })

  const pendingSlug = connectMutation.isPending
    ? connectMutation.variables
    : disconnectMutation.isPending
      ? disconnectMutation.variables?.slug
      : undefined

  return {
    organizationId,
    podQuery,
    accountsQuery,
    accountBySlug,
    actionErrors,
    setActionErrors,
    pendingSlug,
    connectConnector: (slug: string) => connectMutation.mutate(slug),
    disconnectConnector: (slug: string, accountId: string) => disconnectMutation.mutate({ slug, accountId }),
    refreshAccounts: () => void accountsQuery.refetch(),
  }
}
