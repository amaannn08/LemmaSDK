import { useLiveRecords, useUpdateRecord } from 'lemma-sdk/react'
import { AlertCircle, Calendar, CheckCircle2, Clock, ExternalLink, Loader2 } from 'lucide-react'
import { lemmaClient } from './lemma-client'

type Commitment = {
  id: string
  title: string
  description: string | null
  source_app: string
  source_ref: string | null
  due_date: string | null
  status: 'open' | 'done' | 'snoozed'
  priority: 'low' | 'normal' | 'high'
  detected_at: string
}

const PRIORITY_STYLE: Record<Commitment['priority'], string> = {
  high: 'text-red-600 bg-red-50 border-red-200',
  normal: 'text-amber-600 bg-amber-50 border-amber-200',
  low: 'text-zinc-500 bg-zinc-50 border-zinc-200',
}

function asErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function CommitmentRow({ commitment }: { commitment: Commitment }) {
  const { update, isSubmitting } = useUpdateRecord({
    client: lemmaClient,
    tableName: 'commitments',
    recordId: commitment.id,
  })

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-zinc-900">{commitment.title}</p>
          {commitment.description ? (
            <p className="text-xs text-zinc-500">{commitment.description}</p>
          ) : null}
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <span className="capitalize">{commitment.source_app.replace('_', ' ')}</span>
            {commitment.due_date ? (
              <span className="inline-flex items-center gap-1">
                <Calendar size={12} />
                {commitment.due_date}
              </span>
            ) : null}
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 capitalize ${PRIORITY_STYLE[commitment.priority]}`}
            >
              {commitment.priority}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isSubmitting ? (
            <Loader2 size={16} className="animate-spin text-zinc-400" />
          ) : (
            <>
              <button
                type="button"
                aria-label="Snooze"
                title="Snooze"
                onClick={() => void update({ status: 'snoozed' })}
                className="rounded-lg border border-zinc-200 p-1.5 text-zinc-500 hover:bg-zinc-50"
              >
                <Clock size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Mark done"
                title="Mark done"
                onClick={() => void update({ status: 'done' })}
                className="rounded-lg border border-zinc-200 p-1.5 text-emerald-600 hover:bg-emerald-50"
              >
                <CheckCircle2 size={14} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function Dashboard() {
  const { records, isLoading, error, liveStatus } = useLiveRecords<Commitment>({
    client: lemmaClient,
    tableName: 'commitments',
    filters: [{ field: 'status', op: 'eq', value: 'open' }],
    sort: [{ field: 'due_date', direction: 'asc' }],
  })

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-medium text-zinc-500">Dashboard</h2>
        <span className="text-xs text-zinc-400">{liveStatus === 'open' ? 'Live' : liveStatus}</span>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle size={16} />
          {asErrorMessage(error)}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : records.length === 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-6">
          <p className="text-sm text-zinc-600">
            Nothing open right now. The extraction agent sweeps your connected services every 30
            minutes — deadlines and follow-ups it finds will show up here.
          </p>
        </div>
      ) : (
        records.map((commitment) => <CommitmentRow key={commitment.id} commitment={commitment} />)
      )}

      <a
        href="/"
        className="inline-flex items-center gap-1 self-start text-xs text-zinc-400 hover:text-zinc-600"
      >
        Manage connections <ExternalLink size={12} />
      </a>
    </section>
  )
}
