// Shared across the app — every view/component imports this, not its own copy.

export type Category = 'loop' | 'deadline' | 'recurring' | 'document' | 'followup'

export type CommitmentStatus = 'open' | 'done' | 'snoozed'

export type Priority = 'low' | 'normal' | 'high'

export type ClassifyStatus = 'unclassified' | 'classified' | 'not_actionable'

export type SourceApp =
  | 'gmail'
  | 'google_calendar'
  | 'google_drive'
  | 'google_docs'
  | 'google_sheets'
  | 'manual'

export type Commitment = {
  id: string
  title: string
  description: string | null
  source_app: SourceApp
  source_ref: string | null
  due_date: string | null
  status: CommitmentStatus
  priority: Priority
  category: Category | null
  detected_at: string
  classify_status: ClassifyStatus
  raw_snippet: string | null
}

export const CATEGORY_LABEL: Record<Category, string> = {
  loop: 'Open Loop',
  deadline: 'Deadline',
  recurring: 'Recurring Task',
  document: 'Document',
  followup: 'Follow-up',
}

export const SOURCE_APP_LABEL: Record<Exclude<SourceApp, 'manual'>, string> = {
  gmail: 'Gmail',
  google_calendar: 'Calendar',
  google_drive: 'Drive',
  google_docs: 'Docs',
  google_sheets: 'Sheets',
}

export type CommitmentViewStatus = 'open' | 'snoozed' | 'all'

export type SyncProgress = {
  id: string
  sync_run_id: string
  source_app: Exclude<SourceApp, 'manual'>
  status: SyncProgressStatus
  items_seen: number
  items_written: number
  category_summary: string | null
  error_message?: string | null
  updated_at: string
}

export type SyncProgressStatus = 'pending' | 'running' | 'done' | 'skipped' | 'failed'

export const CATEGORY_NAV: { category: Category; label: string; path: string }[] = [
  { category: 'loop', label: 'Open Loops', path: '/loops' },
  { category: 'deadline', label: 'Deadlines', path: '/deadlines' },
  { category: 'recurring', label: 'Recurring', path: '/recurring' },
  { category: 'document', label: 'Documents', path: '/documents' },
  { category: 'followup', label: 'Follow-ups', path: '/followups' },
]
