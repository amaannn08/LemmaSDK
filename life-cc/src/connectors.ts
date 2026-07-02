import { Mail, Calendar, HardDrive, FileText, Table2, Send, type LucideIcon } from 'lucide-react'

export type ConnectorSlug =
  | 'gmail'
  | 'google_calendar'
  | 'google_drive'
  | 'google_docs'
  | 'google_sheets'
  | 'telegram'

export type ConnectorDef = {
  slug: ConnectorSlug
  label: string
  description: string
  icon: LucideIcon
  // No server-side auth-config yet (no credentials set up for this connector) —
  // render as disabled instead of a live Connect button that would error.
  comingSoon?: boolean
  // Credential-managed (bot token via the accounts API, not OAuth) — always show
  // Connected rather than a "Connect" button, since clicking Connect would try
  // the OAuth flow and error even though the bot is already live.
  alwaysConnected?: boolean
  // No user-facing connect/disconnect action at all — just an informational note.
  note?: string
}

// Connector catalog. Gmail / Calendar / Drive are the live ingestion sources.
// Docs and Sheets are read-only preview connectors. Telegram is the chat surface
// (bot + surface are live, managed via lemma.work rather than an in-app action).
export const CONNECTORS: ConnectorDef[] = [
  { slug: 'gmail', label: 'Gmail', description: 'Deadlines and follow-ups from email', icon: Mail },
  { slug: 'google_calendar', label: 'Google Calendar', description: 'Events and reminders', icon: Calendar },
  { slug: 'google_drive', label: 'Google Drive', description: 'Documents', icon: HardDrive },
  { slug: 'google_sheets', label: 'Google Sheets', description: 'Tracking sheets', icon: Table2 },
  { slug: 'google_docs', label: 'Google Docs', description: 'Notes and docs', icon: FileText },
  {
    slug: 'telegram',
    label: 'Telegram',
    description: 'Chat with your assistant on Telegram',
    icon: Send,
    alwaysConnected: true,
    note: 'Connects via lemma.work',
  },
]

export const RECOMMENDED_CONNECTOR_SLUGS: ConnectorSlug[] = [
  'gmail',
  'google_calendar',
  'google_drive',
  'google_sheets',
]
