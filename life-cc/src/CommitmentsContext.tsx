import { createContext, useContext, type ReactNode } from 'react'
import { useLiveRecords } from 'lemma-sdk/react'
import { lemmaClient } from './lemma-client'
import type { Category, Commitment } from './types'

type CommitmentsContextValue = {
  records: Commitment[]
  isLoading: boolean
  error: Error | null
}

const CommitmentsContext = createContext<CommitmentsContextValue | null>(null)

// One live subscription for the whole app, mounted once at the root (so it
// survives route changes instead of every page re-subscribing). Every view
// previously called useLiveRecords itself — Layout's sidebar badges, each of
// Dashboard's 4 KPI cards, each of its 5 category previews, and every
// CategoryView — meaning up to a dozen redundant websocket subscriptions to
// the same table at once, which is both wasteful and the likely cause of the
// sidebar badge lagging behind real data.
export function CommitmentsProvider({ children }: { children: ReactNode }) {
  const { records, isLoading, error } = useLiveRecords<Commitment>({
    client: lemmaClient,
    tableName: 'commitments',
    filters: [{ field: 'status', op: 'eq', value: 'open' }],
    sort: [{ field: 'due_date', direction: 'asc' }],
  })

  return <CommitmentsContext.Provider value={{ records, isLoading, error }}>{children}</CommitmentsContext.Provider>
}

export function useAllCommitments(): CommitmentsContextValue {
  const ctx = useContext(CommitmentsContext)
  if (!ctx) throw new Error('useAllCommitments must be used within CommitmentsProvider')
  return ctx
}

// Drop-in replacement for the old per-component useLiveRecords call: same
// shape, but filters the one shared list instead of opening a new subscription.
export function useCommitments({ category }: { category?: Category } = {}) {
  const { records, isLoading, error } = useAllCommitments()
  return {
    records: category ? records.filter((r) => r.category === category) : records,
    isLoading,
    error,
  }
}
