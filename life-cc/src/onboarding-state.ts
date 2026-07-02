import { useMemo } from 'react'
import { useLiveRecords } from 'lemma-sdk/react'
import { useMutation } from '@tanstack/react-query'
import { lemmaClient } from './lemma-client'

export type OnboardingStatus = 'pending' | 'completed' | 'skipped'

export type OnboardingStateRow = {
  id: string
  user_id: string
  status: OnboardingStatus
  selected_connector_slugs: string | null
  completed_at: string | null
  skipped_at: string | null
  updated_at: string
}

function nowISO() {
  return new Date().toISOString()
}

function toConnectorSlugPayload(slugs: string[]) {
  return JSON.stringify([...new Set(slugs)].sort())
}

function parseConnectorSlugPayload(payload: string | null | undefined) {
  if (!payload) return [] as string[]
  try {
    const parsed = JSON.parse(payload)
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return payload
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  }
}

export function useOnboardingState() {
  const { records, isLoading, error } = useLiveRecords<OnboardingStateRow>({
    client: lemmaClient,
    tableName: 'onboarding_state',
    sort: [{ field: 'updated_at', direction: 'desc' }],
    limit: 1,
    reconcile: 'refetch',
  })

  const record = records[0] ?? null
  const onboardingStatus: OnboardingStatus = record?.status ?? 'pending'
  const selectedConnectorSlugs = useMemo(() => parseConnectorSlugPayload(record?.selected_connector_slugs), [record?.selected_connector_slugs])
  const isComplete = onboardingStatus === 'completed' || onboardingStatus === 'skipped'

  const saveMutation = useMutation({
    mutationFn: async (next: { status: Exclude<OnboardingStatus, 'pending'>; selectedConnectorSlugs: string[] }) => {
      const payload = {
        status: next.status,
        selected_connector_slugs: toConnectorSlugPayload(next.selectedConnectorSlugs),
        completed_at: next.status === 'completed' ? nowISO() : null,
        skipped_at: next.status === 'skipped' ? nowISO() : null,
      }

      const current = await lemmaClient.records.list('onboarding_state', {
        sort: [{ field: 'updated_at', direction: 'desc' }],
        limit: 1,
      })
      const currentRecord = current.items[0]

      if (currentRecord?.id) {
        return lemmaClient.records.update('onboarding_state', currentRecord.id, payload)
      }

      return lemmaClient.records.create('onboarding_state', payload)
    },
  })

  return {
    record,
    onboardingStatus,
    selectedConnectorSlugs,
    isComplete,
    isLoading,
    error,
    isSaving: saveMutation.isPending,
    saveCompleted: (selectedConnectorSlugs: string[]) => saveMutation.mutateAsync({ status: 'completed', selectedConnectorSlugs }),
    saveSkipped: (selectedConnectorSlugs: string[]) => saveMutation.mutateAsync({ status: 'skipped', selectedConnectorSlugs }),
  }
}
