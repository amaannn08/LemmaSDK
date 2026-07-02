import { useMutation } from '@tanstack/react-query'
import { Calendar, CheckCircle2, Clock, Loader2, RotateCcw } from 'lucide-react'
import { ActionTrigger } from './actions/ActionTrigger'
import { updateCommitmentStatus } from './pod-functions'
import type { Commitment } from './types'

const PRIORITY_STYLE: Record<Commitment['priority'], string> = {
  high: 'text-[#e05c5c] bg-[#fde8e8] border-[#f3c7c7]',
  normal: 'text-[#b57712] bg-[#fff1d3] border-[#f5dfb0]',
  low: 'text-[#7b7064] bg-[#f3eee7] border-[#e0d7c9]',
}

function isOverdue(commitment: Commitment) {
  return Boolean(commitment.due_date) && commitment.due_date! < new Date().toISOString().slice(0, 10)
}

export function CommitmentItem({
  commitment,
  mode,
}: {
  commitment: Commitment
  mode: 'compact' | 'full'
}) {
  const statusMutation = useMutation({
    mutationFn: (status: Commitment['status']) => updateCommitmentStatus({ commitment_id: commitment.id, status }),
  })
  const busy = statusMutation.isPending
  const overdue = isOverdue(commitment)

  return (
    <div
      className={`group flex items-start gap-3 ${
        mode === 'full'
          ? 'rounded-xl border border-[#ece4d8] bg-[#faf7f2] p-4'
          : 'border-b border-[#f5efe6] py-3 last:border-b-0'
      }`}
    >
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${overdue ? 'bg-[#e05c5c]' : commitment.status === 'done' ? 'bg-[#4caf50]' : 'bg-[#b7ab9a]'}`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#2c261f]">{commitment.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#8d8274]">
          <span className="capitalize">{commitment.source_app.replace('_', ' ')}</span>
          {commitment.due_date ? (
            <span className="inline-flex items-center gap-1">
              <Calendar size={11} />
              {commitment.due_date}
            </span>
          ) : null}
          {commitment.category === 'recurring' ? <span className="font-medium text-[#4a90d9]">Recurring</span> : null}
          {overdue ? <span className="font-medium text-[#e05c5c]">Overdue</span> : null}
          {commitment.status === 'snoozed' ? <span className="font-medium text-[#b57712]">Snoozed</span> : null}
        </div>
        {mode === 'full' && commitment.description ? (
          <p className="mt-1 text-xs text-[#7f7366]">{commitment.description}</p>
        ) : null}
        {mode === 'full' && statusMutation.error ? (
          <p className="mt-2 text-xs text-[#e05c5c]">
            {statusMutation.error instanceof Error ? statusMutation.error.message : String(statusMutation.error)}
          </p>
        ) : null}
      </div>

      <span
        className={`shrink-0 rounded-full border px-2 py-0.5 text-xs capitalize ${PRIORITY_STYLE[commitment.priority]}`}
      >
        {commitment.priority}
      </span>

      {mode === 'full' ? (
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {busy ? (
            <Loader2 size={14} className="animate-spin text-[#8d8274]" />
          ) : (
            <>
              <ActionTrigger commitment={commitment} />
              <button
                type="button"
                aria-label={commitment.status === 'snoozed' ? 'Unsnooze' : 'Snooze'}
                title={commitment.status === 'snoozed' ? 'Unsnooze' : 'Snooze'}
                onClick={() => statusMutation.mutate(commitment.status === 'snoozed' ? 'open' : 'snoozed')}
                className="rounded-md p-1.5 text-[#8d8274] hover:bg-[#f3eee7] hover:text-[#2c261f]"
              >
                {commitment.status === 'snoozed' ? <RotateCcw size={14} /> : <Clock size={14} />}
              </button>
              <button
                type="button"
                aria-label="Mark done"
                title="Mark done"
                onClick={() => statusMutation.mutate('done')}
                className="rounded-md p-1.5 text-[#4caf50] hover:bg-[#e5f5ea]"
              >
                <CheckCircle2 size={14} />
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
