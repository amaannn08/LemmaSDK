import type { Category } from '../types'

export type CategoryCounts = Record<Category, number>

export type UseCategoryCountsResult = {
  counts: CategoryCounts
  isLoading: boolean
}

// STUB — implementation lands separately (counts of OPEN commitments per
// category, live). Signature is the contract other files build against.
export function useCategoryCounts(): UseCategoryCountsResult {
  return {
    counts: { loop: 0, deadline: 0, recurring: 0, document: 0, followup: 0 },
    isLoading: true,
  }
}
