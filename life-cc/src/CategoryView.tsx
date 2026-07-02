import { AlertCircle, Inbox } from 'lucide-react'
import { CommitmentItem } from './CommitmentItem'
import { useAllCommitments, useCommitments } from './CommitmentsContext'
import type { Category, CommitmentViewStatus } from './types'

function asErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function CategoryView({
  category,
  title,
  status = 'open',
}: {
  category?: Category
  title: string
  status?: CommitmentViewStatus
}) {
  const { records, isLoading, error } = useCommitments({ category, status })
  const { isOpenPartial, openLimit } = useAllCommitments()
  const helperCopy =
    status === 'snoozed'
      ? 'Snoozed items stay visible here until you move them back into the active queue.'
      : 'Showing the active queue only. Snoozed items have their own separate view.'

  return (
    <section className="flex flex-col gap-3">
      <div className="life-page-header">
        <div>
          <h1 className="life-page-header__title">{title}</h1>
          <p className="life-page-header__subtitle">{helperCopy}</p>
        </div>
      </div>

      {status === 'open' && isOpenPartial ? (
        <p className="life-muted-note text-[#b37a24]">Showing the first {openLimit} open items in this shared feed.</p>
      ) : null}

      {error ? (
        <div className="life-inline-status life-inline-status--danger">
          <AlertCircle size={16} />
          {asErrorMessage(error)}
        </div>
      ) : null}

      {isLoading ? (
        <p className="life-muted-note">Loading…</p>
      ) : records.length === 0 ? (
        <div className="life-empty">
          <Inbox className="life-empty__icon" size={28} />
          <p className="life-empty__title">Nothing here</p>
          <p className="life-empty__text">
            {status === 'snoozed'
              ? 'Snoozed commitments will show up here once you move something out of the active queue.'
              : 'Items will show up here once the extraction run or a manual add creates something in this category.'}
          </p>
        </div>
      ) : (
        <div className="life-card flex flex-col gap-2">
          {records.map((commitment) => (
            <CommitmentItem key={commitment.id} commitment={commitment} mode="full" />
          ))}
        </div>
      )}
    </section>
  )
}
