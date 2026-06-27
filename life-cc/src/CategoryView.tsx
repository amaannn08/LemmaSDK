import { AlertCircle, Inbox } from 'lucide-react'
import { CommitmentItem } from './CommitmentItem'
import { useCommitments } from './useCommitments'
import type { Category } from './types'

function asErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function CategoryView({ category, title }: { category: Category; title: string }) {
  const { records, isLoading, error } = useCommitments({ category })

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-zinc-400">{title}</h2>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-400">
          <AlertCircle size={16} />
          {asErrorMessage(error)}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-10 text-center">
          <Inbox className="text-zinc-600" size={28} />
          <p className="text-sm font-medium text-zinc-200">Nothing here</p>
          <p className="max-w-[28ch] text-xs text-zinc-500">
            Items will show up here once the extraction agent finds something in this category.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {records.map((commitment) => (
            <CommitmentItem key={commitment.id} commitment={commitment} mode="full" />
          ))}
        </div>
      )}
    </section>
  )
}
