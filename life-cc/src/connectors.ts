import { Mail, Calendar, HardDrive, FileText, Table2, Ticket, Hash, type LucideIcon } from 'lucide-react'

export type ConnectorSlug =
  | 'gmail'
  | 'google_calendar'
  | 'google_drive'
  | 'google_docs'
  | 'google_sheets'
  | 'jira'
  | 'slack'

export type ConnectorDef = {
  slug: ConnectorSlug
  label: string
  description: string
  icon: LucideIcon
  // No server-side auth-config yet (no credentials set up for this connector) —
  // render as disabled instead of a live Connect button that would error.
  comingSoon?: boolean
}

// The full native LEMMA connector catalog this pod uses — no Composio anywhere.
// Order here is the priority order from the plan: Gmail/Calendar/Drive/Docs serve
// the original goal directly; Sheets/Jira/Slack are included because they're
// free to wire up, not because they're required.
export const CONNECTORS: ConnectorDef[] = [
  { slug: 'gmail', label: 'Gmail', description: 'Deadlines and follow-ups from email', icon: Mail },
  { slug: 'google_calendar', label: 'Google Calendar', description: 'Events and reminders', icon: Calendar },
  { slug: 'google_drive', label: 'Google Drive', description: 'Documents', icon: HardDrive },
  { slug: 'google_docs', label: 'Google Docs', description: 'Notes and docs', icon: FileText },
  { slug: 'google_sheets', label: 'Google Sheets', description: 'Tracking sheets', icon: Table2 },
  { slug: 'jira', label: 'Jira', description: 'Tickets and tasks', icon: Ticket, comingSoon: true },
  { slug: 'slack', label: 'Slack', description: 'Messages and follow-ups', icon: Hash, comingSoon: true },
]
