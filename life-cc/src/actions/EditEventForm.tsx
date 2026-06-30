import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CalendarCog, CheckCircle2, Loader2, X } from 'lucide-react'
import { editCalendarEvent } from '../pod-functions'
import type { Commitment } from '../types'

type EditEventFields = {
  title: string
  due_date: string
  description: string
  location: string
  attendees: string
}

export function EditEventForm({ commitment }: { commitment: Commitment }) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const [fields, setFields] = useState<EditEventFields>({
    title: commitment.title,
    due_date: commitment.due_date ?? '',
    description: commitment.description ?? '',
    location: '',
    attendees: '',
  })
  const saveMutation = useMutation({
    mutationFn: () =>
      editCalendarEvent({
        commitment_id: commitment.id,
        title: fields.title,
        due_date: fields.due_date,
        description: fields.description,
        location: fields.location,
        attendees: fields.attendees
          .split(',')
          .map((attendee) => attendee.trim())
          .filter(Boolean),
      }),
    onSuccess: () => setDone(true),
  })
  const error = saveMutation.error

  function update<K extends keyof EditEventFields>(key: K, value: EditEventFields[K]) {
    setFields((f) => ({ ...f, [key]: value }))
    setDone(false)
  }

  function save() {
    saveMutation.mutate()
  }

  return (
    <>
      <button
        type="button"
        aria-label="Edit event"
        title="Edit event"
        onClick={() => setOpen(true)}
        className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
      >
        <CalendarCog size={14} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-sm shadow-2xl shadow-black/40 ring-1 ring-white/5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <p className="mb-3 font-medium text-zinc-200">Edit event</p>

            {error ? (
              <p className="mb-2 text-red-400">{error instanceof Error ? error.message : String(error)}</p>
            ) : done ? (
              <p className="mb-3 flex items-center gap-2 text-emerald-400">
                <CheckCircle2 size={14} /> Event updated.
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <input
                value={fields.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="Title"
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 outline-none focus:border-teal-600"
              />
              <input
                type="date"
                value={fields.due_date}
                onChange={(e) => update('due_date', e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 outline-none focus:border-teal-600"
              />
              <input
                value={fields.location}
                onChange={(e) => update('location', e.target.value)}
                placeholder="Location"
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 outline-none focus:border-teal-600"
              />
              <textarea
                value={fields.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Description"
                rows={3}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 outline-none focus:border-teal-600"
              />
              <input
                value={fields.attendees}
                onChange={(e) => update('attendees', e.target.value)}
                placeholder="Attendees (comma-separated emails)"
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 outline-none focus:border-teal-600"
              />
            </div>

            <button
              type="button"
              onClick={save}
              disabled={saveMutation.isPending}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              {saveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
