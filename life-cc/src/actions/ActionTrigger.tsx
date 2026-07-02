import { ReplyPanel } from './ReplyPanel'
import { EmailViewer } from './EmailViewer'
import { EditEventForm } from './EditEventForm'
import { DocViewer } from './DocViewer'
import type { Commitment } from '../types'

// Picks the typed function-backed action(s) available for a commitment's source.
export function ActionTrigger({ commitment }: { commitment: Commitment }) {
  switch (commitment.source_app) {
    case 'gmail':
      return (
        <>
          <EmailViewer commitment={commitment} />
          <ReplyPanel commitment={commitment} />
        </>
      )
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
