import { createContext, useContext, type ReactNode } from 'react'
import { useLiveRecords } from 'lemma-sdk/react'
import { lemmaClient } from './lemma-client'
import type { Category, Commitment, CommitmentViewStatus } from './types'

const OPEN_COMMITMENT_LIMIT = 500
const SNOOZED_COMMITMENT_LIMIT = 200

type CommitmentsContextValue = {
  openRecords: Commitment[]
  snoozedRecords: Commitment[]
  isOpenPartial: boolean
  openLimit: number
  isLoading: boolean
  error: Error | null
}

const CommitmentsContext = createContext<CommitmentsContextValue | null>(null)

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
  const openRecords = openState.records
  const snoozedRecords = snoozedState.records
  const isLoading = openState.isLoading || snoozedState.isLoading
  const error = openState.error ?? snoozedState.error
  const isOpenPartial = openRecords.length >= OPEN_COMMITMENT_LIMIT

  return (
    <CommitmentsContext.Provider
      value={{ openRecords, snoozedRecords, isOpenPartial, openLimit: OPEN_COMMITMENT_LIMIT, isLoading, error }}
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
  const allRecords = [...openRecords, ...snoozedRecords]
  const scopedRecords =
    status === 'all' ? allRecords : status === 'snoozed' ? snoozedRecords : openRecords

  return {
    records: category ? scopedRecords.filter((r) => r.category === category) : scopedRecords,
    isLoading,
    error,
  }
}
