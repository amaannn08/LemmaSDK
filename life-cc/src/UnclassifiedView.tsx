import { useState } from 'react'
import { AlertCircle, Inbox, Loader2, X } from 'lucide-react'
import { useAllCommitments } from './CommitmentsContext'
import { classifyCommitments } from './pod-functions'
import { lemmaClient } from './lemma-client'

function asErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function UnclassifiedView() {
  const { unclassifiedRecords } = useAllCommitments()
  const [isClassifying, setIsClassifying] = useState(false)
  const [classifyError, setClassifyError] = useState<string | null>(null)
  const [dismissingId, setDismissingId] = useState<string | null>(null)
  const [dismissError, setDismissError] = useState<string | null>(null)

  async function classifyAll() {
    if (isClassifying) return
    setIsClassifying(true)
    setClassifyError(null)
    try {
      await classifyCommitments({ limit: 30 })
    } catch (error) {
      setClassifyError(asErrorMessage(error))
    } finally {
      setIsClassifying(false)
    }
  }

  async function dismissOne(id: string) {
    if (dismissingId) return
    setDismissingId(id)
    setDismissError(null)
    try {
      // Not a real delete — just moves it out of the unclassified bucket.
      // The row itself stays in `commitments` for history/audit.
      await lemmaClient.records.update('commitments', id, { classify_status: 'not_actionable' })
    } catch (error) {
      setDismissError(asErrorMessage(error))
    } finally {
      setDismissingId(null)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="life-page-header">
        <div>
          <h1 className="life-page-header__title">Unclassified Inbox</h1>
          <p className="life-page-header__subtitle">
            Captured but not yet run through AI classification — classify what's worth keeping, dismiss what isn't.
          </p>
        </div>
        {unclassifiedRecords.length > 0 ? (
          <button
            type="button"
            onClick={classifyAll}
            disabled={isClassifying}
            className="life-action-primary inline-flex items-center gap-2 disabled:opacity-60"
          >
            {isClassifying ? <Loader2 size={14} className="animate-spin" /> : null}
            Classify with AI
          </button>
        ) : null}
      </div>

      {classifyError ? (
        <div className="life-inline-status life-inline-status--danger">
          <AlertCircle size={16} />
          {classifyError}
        </div>
      ) : null}
      {dismissError ? (
        <div className="life-inline-status life-inline-status--danger">
          <AlertCircle size={16} />
          {dismissError}
        </div>
      ) : null}

      {unclassifiedRecords.length === 0 ? (
        <div className="life-empty">
          <Inbox className="life-empty__icon" size={28} />
          <p className="life-empty__title">Nothing here</p>
          <p className="life-empty__text">Everything captured so far has been classified.</p>
        </div>
      ) : (
        <div className="life-card flex flex-col gap-2">
          {unclassifiedRecords.map((commitment) => (
            <div key={commitment.id} className="life-row items-start">
              <span className="life-row__dot" />
              <div className="life-row__info">
                <p className="life-row__title">{commitment.title}</p>
                {commitment.raw_snippet ? <p className="life-row__sub">{commitment.raw_snippet}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => void dismissOne(commitment.id)}
                disabled={dismissingId === commitment.id}
                title="Dismiss — moves it out of unclassified without deleting it"
                aria-label="Dismiss without classifying"
                className="life-action-chip inline-flex items-center gap-1.5 shrink-0 disabled:opacity-60"
              >
                {dismissingId === commitment.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
