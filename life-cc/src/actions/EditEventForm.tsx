import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CalendarCog, CheckCircle2, Loader2, X } from 'lucide-react'
import { editCalendarEvent } from '../pod-functions'
import type { Commitment } from '../types'

type EditEventFields = {
  title: string
  due_date: string
  start_time: string
  end_time: string
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
    start_time: '',
    end_time: '',
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
        start_time: fields.start_time || undefined,
        end_time: fields.end_time || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
        className="rounded-md p-1.5 text-[#8d8274] hover:bg-[#f3eee7] hover:text-[#2c261f]"
      >
        <CalendarCog size={14} />
      </button>

      {open ? (
        <div className="life-overlay">
          <div className="life-modal life-modal--wide text-sm">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="life-modal__close"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <p className="life-modal__title">Edit event</p>

            {error ? (
              <p className="mb-2 text-[#e05c5c]">{error instanceof Error ? error.message : String(error)}</p>
            ) : done ? (
              <p className="mb-3 flex items-center gap-2 text-[#4caf50]">
                <CheckCircle2 size={14} /> Event updated.
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <input
                value={fields.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="Title"
                className="life-field"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={fields.due_date}
                  onChange={(e) => update('due_date', e.target.value)}
                  className="life-field flex-1"
                />
                <input
                  type="time"
                  value={fields.start_time}
                  onChange={(e) => update('start_time', e.target.value)}
                  className="life-field"
                />
                <input
                  type="time"
                  value={fields.end_time}
                  onChange={(e) => update('end_time', e.target.value)}
                  className="life-field"
                />
              </div>
              <input
                value={fields.location}
                onChange={(e) => update('location', e.target.value)}
                placeholder="Location"
                className="life-field"
              />
              <textarea
                value={fields.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Description"
                rows={3}
                className="life-field life-field--textarea"
              />
              <input
                value={fields.attendees}
                onChange={(e) => update('attendees', e.target.value)}
                placeholder="Attendees (comma-separated emails)"
                className="life-field"
              />
            </div>

            <button
              type="button"
              onClick={save}
              disabled={saveMutation.isPending}
              className="life-action-primary mt-3 inline-flex items-center gap-2 text-xs disabled:opacity-50"
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
