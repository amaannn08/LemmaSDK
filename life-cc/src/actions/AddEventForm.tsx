import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CalendarPlus, CheckCircle2, Loader2, X } from 'lucide-react'
import { createCalendarEvent } from '../pod-functions'
import { getLocalISODate } from '../date-utils'

type AddEventFields = {
  title: string
  due_date: string
  start_time: string
  end_time: string
  description: string
  location: string
  attendees: string
}

function emptyFields(): AddEventFields {
  return {
    title: '',
    due_date: getLocalISODate(),
    start_time: '09:00',
    end_time: '10:00',
    description: '',
    location: '',
    attendees: '',
  }
}

export function AddEventForm() {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const [fields, setFields] = useState<AddEventFields>(emptyFields())
  const createMutation = useMutation({
    mutationFn: () =>
      createCalendarEvent({
        title: fields.title.trim(),
        due_date: fields.due_date,
        start_time: fields.start_time || undefined,
        end_time: fields.end_time || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        description: fields.description || undefined,
        location: fields.location || undefined,
        attendees: fields.attendees
          .split(',')
          .map((attendee) => attendee.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      setDone(true)
      setTimeout(() => setOpen(false), 900)
    },
  })
  const error = createMutation.error

  function update<K extends keyof AddEventFields>(key: K, value: AddEventFields[K]) {
    setFields((f) => ({ ...f, [key]: value }))
    setDone(false)
  }

  function openPanel() {
    setFields(emptyFields())
    setDone(false)
    createMutation.reset()
    setOpen(true)
  }

  function create() {
    if (!fields.title.trim() || !fields.due_date) return
    createMutation.mutate()
  }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className="life-action-primary inline-flex items-center gap-2"
      >
        <CalendarPlus size={14} />
        Add event
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
            <p className="life-modal__title">Add event</p>

            {error ? (
              <p className="mb-2 text-[#e05c5c]">{error instanceof Error ? error.message : String(error)}</p>
            ) : done ? (
              <p className="mb-3 flex items-center gap-2 text-[#4caf50]">
                <CheckCircle2 size={14} /> Event created.
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
              onClick={create}
              disabled={createMutation.isPending || !fields.title.trim() || !fields.due_date}
              className="life-action-primary mt-3 inline-flex items-center gap-2 text-xs disabled:opacity-50"
            >
              {createMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
              Create event
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
