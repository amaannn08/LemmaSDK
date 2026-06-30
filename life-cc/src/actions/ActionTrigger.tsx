import { ReplyPanel } from './ReplyPanel'
import { EditEventForm } from './EditEventForm'
import { DocViewer } from './DocViewer'
import type { Commitment } from '../types'

// Picks the one typed function-backed action available for a commitment's
// source. Each row exposes at most one connector action.
export function ActionTrigger({ commitment }: { commitment: Commitment }) {
  switch (commitment.source_app) {
    case 'gmail':
      return <ReplyPanel commitment={commitment} />
    case 'google_calendar':
      return <EditEventForm commitment={commitment} />
    case 'google_drive':
    case 'google_docs':
    case 'google_sheets':
      return <DocViewer commitment={commitment} />
    default:
      return null
  }
}
