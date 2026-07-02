import { createContext, useContext, type ReactNode } from 'react'
import { useLiveRecords } from 'lemma-sdk/react'
import { lemmaClient } from './lemma-client'
import type { Category, Commitment, CommitmentViewStatus } from './types'

const OPEN_COMMITMENT_LIMIT = 500
const SNOOZED_COMMITMENT_LIMIT = 200
const UNCLASSIFIED_COMMITMENT_LIMIT = 200

type CommitmentsContextValue = {
  openRecords: Commitment[]
  snoozedRecords: Commitment[]
  unclassifiedRecords: Commitment[]
  isOpenPartial: boolean
  openLimit: number
  isLoading: boolean
  error: Error | null
}

const CommitmentsContext = createContext<CommitmentsContextValue | null>(null)

function dedupeById(records: Commitment[]) {
  const seen = new Set<string>()
  const deduped: Commitment[] = []
  for (const record of records) {
    if (seen.has(record.id)) continue
    seen.add(record.id)
    deduped.push(record)
  }
  return deduped
}

export function CommitmentsProvider({ children }: { children: ReactNode }) {
  const openState = useLiveRecords<Commitment>({
    client: lemmaClient,
    tableName: 'commitments',
    filters: [{ field: 'status', op: 'eq', value: 'open' }],
    sort: [{ field: 'due_date', direction: 'asc' }],
    limit: OPEN_COMMITMENT_LIMIT,
    reconcile: 'refetch',
  })
  const snoozedState = useLiveRecords<Commitment>({
    client: lemmaClient,
    tableName: 'commitments',
    filters: [{ field: 'status', op: 'eq', value: 'snoozed' }],
    sort: [{ field: 'due_date', direction: 'asc' }],
    limit: SNOOZED_COMMITMENT_LIMIT,
    reconcile: 'refetch',
  })
  const unclassifiedState = useLiveRecords<Commitment>({
    client: lemmaClient,
    tableName: 'commitments',
    filters: [{ field: 'classify_status', op: 'eq', value: 'unclassified' }],
    sort: [{ field: 'detected_at', direction: 'desc' }],
    limit: UNCLASSIFIED_COMMITMENT_LIMIT,
    reconcile: 'refetch',
  })
  const openRecords = dedupeById(openState.records)
  const snoozedRecords = dedupeById(snoozedState.records)
  const unclassifiedRecords = dedupeById(unclassifiedState.records)
  const isLoading = openState.isLoading || snoozedState.isLoading
  const error = openState.error ?? snoozedState.error
  const isOpenPartial = openRecords.length >= OPEN_COMMITMENT_LIMIT

  return (
    <CommitmentsContext.Provider
      value={{ openRecords, snoozedRecords, unclassifiedRecords, isOpenPartial, openLimit: OPEN_COMMITMENT_LIMIT, isLoading, error }}
    >
      {children}
    </CommitmentsContext.Provider>
  )
}

export function useAllCommitments(): CommitmentsContextValue {
  const ctx = useContext(CommitmentsContext)
  if (!ctx) throw new Error('useAllCommitments must be used within CommitmentsProvider')
  return ctx
}

export function useCommitments({
  category,
  status = 'open',
}: {
  category?: Category
  status?: CommitmentViewStatus
} = {}) {
  const { openRecords, snoozedRecords, isLoading, error } = useAllCommitments()
  const allRecords = dedupeById([...openRecords, ...snoozedRecords])
  const scopedRecords =
    status === 'all' ? allRecords : status === 'snoozed' ? snoozedRecords : openRecords

  return {
    records: category ? scopedRecords.filter((r) => r.category === category) : scopedRecords,
    isLoading,
    error,
  }
}
