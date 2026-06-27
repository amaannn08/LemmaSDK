import { useLiveRecords } from 'lemma-sdk/react'
import { lemmaClient } from './lemma-client'
import type { Category, Commitment } from './types'

export type UseCommitmentsOptions = {
  category?: Category
  status?: Commitment['status']
}

// Thin wrapper around useLiveRecords so every view/category page shares one
// fetch+filter+sort convention instead of five copies of the same options.
export function useCommitments({ category, status = 'open' }: UseCommitmentsOptions = {}) {
  return useLiveRecords<Commitment>({
    client: lemmaClient,
    tableName: 'commitments',
    filters: [
      { field: 'status', op: 'eq', value: status },
      ...(category ? [{ field: 'category', op: 'eq', value: category }] : []),
    ],
    sort: [{ field: 'due_date', direction: 'asc' }],
  })
}
