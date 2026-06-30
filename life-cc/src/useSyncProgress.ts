import { useLiveRecords } from 'lemma-sdk/react'
import { lemmaClient } from './lemma-client'
import type { SyncProgress } from './types'

// Scoped to one sync run, used only by SyncButton — a shared context (like
// CommitmentsContext) isn't needed since there's exactly one consumer.
export function useSyncProgress(runId: string | null) {
  const { records } = useLiveRecords<SyncProgress>({
    client: lemmaClient,
    tableName: 'sync_progress',
    filters: runId ? [{ field: 'sync_run_id', op: 'eq', value: runId }] : [{ field: 'sync_run_id', op: 'eq', value: '__none__' }],
    sort: [{ field: 'updated_at', direction: 'asc' }],
  })
  return runId ? records : []
}
