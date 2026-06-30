import { useMutation } from '@tanstack/react-query'
import { Calendar, CheckCircle2, Clock, Loader2, RotateCcw } from 'lucide-react'
import { ActionTrigger } from './actions/ActionTrigger'
import { updateCommitmentStatus } from './pod-functions'
import type { Commitment } from './types'

const PRIORITY_STYLE: Record<Commitment['priority'], string> = {
  high: 'text-red-400 bg-red-950 border-red-900',
  normal: 'text-amber-400 bg-amber-950 border-amber-900',
  low: 'text-zinc-400 bg-zinc-800 border-zinc-700',
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
      className={`group flex items-start gap-3 ${mode === 'full' ? 'rounded-xl border border-zinc-800 bg-zinc-900 p-4' : 'py-2'}`}
    >
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${overdue ? 'bg-red-500' : commitment.status === 'done' ? 'bg-emerald-500' : 'bg-zinc-500'}`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-100">{commitment.title}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
          <span className="capitalize">{commitment.source_app.replace('_', ' ')}</span>
          {commitment.due_date ? (
            <span className="inline-flex items-center gap-1">
              <Calendar size={11} />
              {commitment.due_date}
            </span>
          ) : null}
          {commitment.category === 'recurring' ? <span className="font-medium text-blue-400">Recurring</span> : null}
          {overdue ? <span className="font-medium text-red-500">Overdue</span> : null}
          {commitment.status === 'snoozed' ? <span className="font-medium text-amber-500">Snoozed</span> : null}
        </div>
        {mode === 'full' && commitment.description ? (
          <p className="mt-1 text-xs text-zinc-400">{commitment.description}</p>
        ) : null}
        {mode === 'full' && statusMutation.error ? (
          <p className="mt-2 text-xs text-red-400">
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
            <Loader2 size={14} className="animate-spin text-zinc-500" />
          ) : (
            <>
              <ActionTrigger commitment={commitment} />
              <button
                type="button"
                aria-label={commitment.status === 'snoozed' ? 'Unsnooze' : 'Snooze'}
                title={commitment.status === 'snoozed' ? 'Unsnooze' : 'Snooze'}
                onClick={() => statusMutation.mutate(commitment.status === 'snoozed' ? 'open' : 'snoozed')}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                {commitment.status === 'snoozed' ? <RotateCcw size={14} /> : <Clock size={14} />}
              </button>
              <button
                type="button"
                aria-label="Mark done"
                title="Mark done"
                onClick={() => statusMutation.mutate('done')}
                className="rounded-md p-1.5 text-emerald-500 hover:bg-emerald-950"
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
