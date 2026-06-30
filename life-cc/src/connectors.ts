import { Mail, Calendar, HardDrive, FileText, Table2, Ticket, Hash, CheckSquare, Send, type LucideIcon } from 'lucide-react'

export type ConnectorSlug =
  | 'gmail'
  | 'google_calendar'
  | 'google_drive'
  | 'google_docs'
  | 'google_sheets'
  | 'google_tasks'
  | 'jira'
  | 'slack'
  | 'telegram'

export type ConnectorDef = {
  slug: ConnectorSlug
  label: string
  description: string
  icon: LucideIcon
  // No server-side auth-config yet (no credentials set up for this connector) —
  // render as disabled instead of a live Connect button that would error.
  comingSoon?: boolean
}

// Connector catalog. Gmail / Calendar / Drive are the live ingestion sources.
// Docs and Sheets are read-only preview connectors. Telegram is a chat surface,
// but it stays disabled during the hardening rollout. Google Tasks / Jira / Slack are roadmap sources,
// included so the screen reflects the plan, not because they're required.
export const CONNECTORS: ConnectorDef[] = [
  { slug: 'gmail', label: 'Gmail', description: 'Deadlines and follow-ups from email', icon: Mail },
  { slug: 'google_calendar', label: 'Google Calendar', description: 'Events and reminders', icon: Calendar },
  { slug: 'google_drive', label: 'Google Drive', description: 'Documents', icon: HardDrive },
  { slug: 'google_docs', label: 'Google Docs', description: 'Notes and docs', icon: FileText },
  { slug: 'google_sheets', label: 'Google Sheets', description: 'Tracking sheets', icon: Table2 },
  { slug: 'telegram', label: 'Telegram', description: 'Temporarily disabled during the hardening rollout', icon: Send, comingSoon: true },
  { slug: 'google_tasks', label: 'Google Tasks', description: 'To-dos and reminders', icon: CheckSquare, comingSoon: true },
  { slug: 'jira', label: 'Jira', description: 'Tickets and tasks', icon: Ticket, comingSoon: true },
  { slug: 'slack', label: 'Slack', description: 'Messages and follow-ups', icon: Hash, comingSoon: true },
]
