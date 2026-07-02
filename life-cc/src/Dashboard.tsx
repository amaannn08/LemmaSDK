import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useCurrentUser } from 'lemma-sdk/react'
import { ArrowLeft, ArrowRight, CalendarClock, CircleDashed, FileText, Loader2, MessageCircleMore, Repeat, Zap } from 'lucide-react'
import { useAllCommitments, useCommitments } from './CommitmentsContext'
import { CommitmentItem } from './CommitmentItem'
import { DocViewer } from './actions/DocViewer'
import { AddEventForm } from './actions/AddEventForm'
import { AiBriefing } from './AiBriefing'
import { KpiCard, type KpiTone } from './components/KpiCard'
import { formatDayLabel, getLocalISODate, isISODate, shiftLocalISODate } from './date-utils'
import { lemmaClient } from './lemma-client'
import { SyncButton } from './SyncButton'
import { classifyCommitments, createManualCommitment } from './pod-functions'
import { CATEGORY_NAV, type Category } from './types'
import { getUserDisplayName } from './user-profile'

const KPI_META: Record<Exclude<Category, 'document'>, { icon: typeof CircleDashed; tone: KpiTone; sublabel: string }> = {
  loop: { icon: CircleDashed, tone: 'red', sublabel: 'Unresolved commitments' },
  deadline: { icon: CalendarClock, tone: 'amber', sublabel: 'Next 30 days' },
  recurring: { icon: Repeat, tone: 'gold', sublabel: 'Active cycles' },
  followup: { icon: MessageCircleMore, tone: 'blue', sublabel: 'Waiting on others' },
}
// Document isn't a KPI tile in the mockup (it's a sidebar section, not a top-line metric) — 4 tiles, not 5.
const KPI_CATEGORIES: Exclude<Category, 'document'>[] = ['loop', 'deadline', 'recurring', 'followup']
const AGENDA_LABELS = ['Now', 'Late morning', 'Afternoon', 'Evening']

function categoryAccent(category: Category) {
  switch (category) {
    case 'loop':
      return { dot: 'life-row__dot--rose', pill: 'life-pill--rose', label: 'Open Loop' }
    case 'deadline':
      return { dot: 'life-row__dot--blue', pill: 'life-pill--blue', label: 'Deadline' }
    case 'recurring':
      return { dot: 'life-row__dot--green', pill: 'life-pill--green', label: 'Recurring' }
    case 'document':
      return { dot: 'life-row__dot--gold', pill: 'life-pill--gold', label: 'Document' }
    case 'followup':
      return { dot: 'life-row__dot--gold', pill: 'life-pill--gold', label: 'Follow-up' }
    default:
      return { dot: 'life-row__dot--gold', pill: 'life-pill--muted', label: 'Item' }
  }
}

function todayISO() {
  return getLocalISODate()
}

function QuickAdd() {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<Category>('loop')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function submit() {
    const trimmed = title.trim()
    if (!trimmed || isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await createManualCommitment({
        title: trimmed,
        category,
        priority: 'normal',
      })
      setTitle('')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="life-quick-capture flex flex-col gap-3">
      <div className="life-card__header mb-0">
        <span className="life-card__title">Quick Capture</span>
        <span className="text-sm text-[#b7ab9a]">⠿</span>
      </div>
      <div className="flex items-center gap-3">
        <Zap size={16} className="shrink-0 text-[#3d4a3e]" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder='Add a task, note, or reminder...'
          className="life-quick-capture__input flex-1"
        />
        <button
          type="button"
          onClick={submit}
          disabled={isSubmitting || !title.trim()}
          className="life-action-primary inline-flex items-center gap-2"
        >
          {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
          Add
        </button>
      </div>
      <div className="life-action-row">
        {CATEGORY_NAV.map(({ category: c, label }) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`life-action-chip ${category === c ? 'life-action-chip--active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="text-xs text-[#b09078]">
        {category === 'loop' ? 'Open loop' : category === 'deadline' ? 'Deadline' : category === 'recurring' ? 'Recurring' : category === 'document' ? 'Document' : 'Follow-up'} capture
      </div>
      {submitError ? <p className="text-xs text-[#e05c5c]">{submitError}</p> : null}
    </div>
  )
}

function UnclassifiedStrip() {
  const { unclassifiedRecords } = useAllCommitments()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function submit() {
    if (isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await classifyCommitments({ limit: 30 })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (unclassifiedRecords.length === 0) return null

  return (
    <section className="life-card">
      <div className="life-card__header">
        <span className="life-card__title">Unclassified Inbox ({unclassifiedRecords.length})</span>
        <div className="flex items-center gap-3">
          <Link to="/unclassified" className="life-card__link">
            View all
          </Link>
          <button
            type="button"
            onClick={submit}
            disabled={isSubmitting}
            className="life-action-primary inline-flex items-center gap-2"
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
            Classify with AI
          </button>
        </div>
      </div>
      <div className="life-row-list">
        {unclassifiedRecords.slice(0, 5).map((commitment) => (
          <div key={commitment.id} className="life-row text-[#9f9384]">
            <span className="life-row__dot" />
            <div className="life-row__info">
              <p className="life-row__title text-[#9f9384]">{commitment.title}</p>
            </div>
          </div>
        ))}
      </div>
      {submitError ? <p className="text-xs text-[#e05c5c]">{submitError}</p> : null}
    </section>
  )
}

export function Dashboard() {
  const { isOpenPartial, openLimit } = useAllCommitments()
  const { user } = useCurrentUser({ client: lemmaClient })
  const [searchParams, setSearchParams] = useSearchParams()
  const { records: openLoops } = useCommitments({ category: 'loop' })
  const { records: deadlines } = useCommitments({ category: 'deadline' })
  const { records: recurring } = useCommitments({ category: 'recurring' })
  const { records: documents } = useCommitments({ category: 'document' })
  const { records: followups } = useCommitments({ category: 'followup' })
  const displayName = getUserDisplayName(user)
  const today = todayISO()
  const selectedDay = isISODate(searchParams.get('day')) ? searchParams.get('day')! : today
  const selectedDayLabel = formatDayLabel(selectedDay)
  const selectedDayAgenda = [...deadlines, ...openLoops, ...followups].filter((commitment) => commitment.due_date === selectedDay)
  const selectedDayDeadlines = deadlines.filter((c) => c.due_date === selectedDay)
  const overdueLoops = openLoops.filter((c) => c.due_date && c.due_date < selectedDay).length
  const dueToday = selectedDayDeadlines.length
  const queryString = searchParams.toString()
  const withSearch = (path: string) => ({ pathname: path, search: queryString ? `?${queryString}` : '' })

  function shiftDay(delta: number) {
    const next = shiftLocalISODate(selectedDay, delta)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('day', next)
    setSearchParams(nextParams, { replace: true })
  }

  const counts: Record<Category, number> = {
    loop: openLoops.length,
    deadline: deadlines.length,
    recurring: recurring.length,
    followup: followups.length,
    document: 0,
  }
  const badges: Record<Category, string> = {
    loop: overdueLoops > 0 ? `${overdueLoops} overdue${isOpenPartial ? ' · partial' : ''}` : isOpenPartial ? 'On track · partial' : 'On track',
    deadline: dueToday > 0 ? `${dueToday} today${isOpenPartial ? ' · partial' : ''}` : isOpenPartial ? 'Upcoming · partial' : 'Upcoming',
    recurring: isOpenPartial ? 'Active · partial' : 'Active',
    followup: followups.length > 0 ? `Waiting${isOpenPartial ? ' · partial' : ''}` : isOpenPartial ? 'Clear · partial' : 'Clear',
    document: '',
  }

  return (
    <div className="life-dashboard">
      <div className="life-dashboard-grid">
        <section className="life-page-header life-dashboard__header life-grid-header">
          <div>
            <h1 className="life-page-header__title">Good morning, {displayName} 👋</h1>
            <p className="life-page-header__subtitle">Here's what's on your plate for {selectedDayLabel}.</p>
          </div>
        </section>

        <div className="life-dashboard__actions life-grid-checknow flex items-center gap-2">
          <AddEventForm />
          <SyncButton />
        </div>

        <div className="life-dashboard__actions life-grid-datenav">
          <div className="life-date-nav">
            <button type="button" className="life-date-nav__button" aria-label="Previous day" onClick={() => shiftDay(-1)}>
              <ArrowLeft size={13} />
            </button>
            <span className="life-date-nav__label">{selectedDayLabel}</span>
            <button type="button" className="life-date-nav__button" aria-label="Next day" onClick={() => shiftDay(1)}>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

      <section className="life-kpi-grid life-dashboard__kpis life-grid-kpis">
        {KPI_CATEGORIES.map((category) => {
          const meta = KPI_META[category]
          const navItem = CATEGORY_NAV.find((n) => n.category === category)!
          return (
            <KpiCard
              key={category}
              icon={meta.icon}
              tone={meta.tone}
              value={counts[category]}
              label={navItem.label}
              sublabel={meta.sublabel}
              badgeText={badges[category]}
              progressPercent={Math.min(100, counts[category] * 20)}
            />
          )
        })}
      </section>

      <div className="life-dashboard__grid life-grid-main">
        <UnclassifiedStrip />

        <div className="life-main-grid">
        <div className="life-column">
          <section className="life-card">
            <div className="life-card__header">
              <span className="life-card__title">{selectedDayLabel === formatDayLabel(today) ? "Today's Agenda" : `${selectedDayLabel} Agenda`}</span>
              <Link to={withSearch('/loops')} className="life-card__link">
                View full queue
              </Link>
            </div>

            <div className="life-row-list">
              {selectedDayAgenda.length === 0 ? (
                <p className="py-3 text-xs text-[#9f9384]">No agenda items due on this day yet.</p>
              ) : (
                selectedDayAgenda.slice(0, 4).map((commitment, index) => {
                  const accent = categoryAccent(commitment.category ?? 'followup')
                  return (
                    <div key={commitment.id} className="life-row">
                      <span className="life-row__time">{AGENDA_LABELS[index] ?? 'Later'}</span>
                      <span className={`life-row__dot ${accent.dot}`} />
                      <div className="life-row__info">
                        <p className="life-row__title">{commitment.title}</p>
                        <p className="life-row__sub">{accent.label}</p>
                      </div>
                      <span className="life-row__date">{commitment.due_date ?? '—'}</span>
                    </div>
                  )
                })
              )}
            </div>
          </section>

          <section className="life-card">
            <div className="life-card__header">
              <span className="life-card__title">Upcoming Deadlines</span>
              <Link to={withSearch('/deadlines')} className="life-card__link">
                View all
              </Link>
            </div>

            <div className="life-row-list">
              {selectedDayDeadlines.length === 0 ? (
                <p className="py-3 text-xs text-[#9f9384]">Nothing due on this day yet.</p>
              ) : (
                selectedDayDeadlines.slice(0, 4).map((deadline) => {
                  const accent = categoryAccent('deadline')
                  return (
                    <div key={deadline.id} className="life-row">
                      <span className={`life-row__dot ${accent.dot}`} />
                      <div className="life-row__info">
                        <p className="life-row__title">{deadline.title}</p>
                        <p className="life-row__sub">{deadline.category ? categoryAccent(deadline.category).label : 'Deadline'}</p>
                      </div>
                      <span className="life-row__date">{deadline.due_date ?? '—'}</span>
                    </div>
                  )
                })
              )}
            </div>
          </section>
        </div>

        <div className="life-column">
          <section className="life-card">
            <div className="life-card__header">
              <span className="life-card__title">Open Loops</span>
              <Link to={withSearch('/loops')} className="life-card__link">
                View all
              </Link>
            </div>
            <div className="life-row-list">
              {openLoops.length === 0 ? (
                <p className="py-3 text-xs text-[#9f9384]">Nothing here yet.</p>
              ) : (
                openLoops.slice(0, 5).map((commitment) => (
                  <CommitmentItem key={commitment.id} commitment={commitment} mode="compact" />
                ))
              )}
            </div>
          </section>

          <section className="life-card">
            <div className="life-card__header">
              <span className="life-card__title">Recent Documents</span>
              <Link to={withSearch('/documents')} className="life-card__link">
                View all
              </Link>
            </div>
            <div className="life-row-list">
              {documents.length === 0 ? (
                <p className="py-3 text-xs text-[#9f9384]">Nothing here yet.</p>
              ) : (
                documents.slice(0, 4).map((document) => {
                  const accent = categoryAccent('document')
                  return (
                    <div key={document.id} className="life-row">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e5f5ea]">
                        <FileText size={16} className="text-[#4caf50]" />
                      </div>
                      <div className="life-row__info">
                        <p className="life-row__title">{document.title}</p>
                        <p className="life-row__sub">{document.source_app.replace('_', ' ')}</p>
                      </div>
                      <span className={`life-pill ${accent.pill}`}>{document.status}</span>
                      <DocViewer commitment={document} />
                    </div>
                  )
                })
              )}
            </div>
          </section>
        </div>
        </div>
      </div>

      <div className="life-column life-grid-sidebar">
        <AiBriefing />

        <QuickAdd />

        <section className="life-quote-card">
          <div className="life-quote-card__background" aria-hidden="true">
            <svg className="life-quote-card__illustration" viewBox="0 0 90 130" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <line x1="45" y1="70" x2="30" y2="20" stroke="#8a7060" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="45" y1="70" x2="50" y2="15" stroke="#8a7060" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="45" y1="70" x2="65" y2="25" stroke="#8a7060" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="45" y1="70" x2="20" y2="35" stroke="#8a7060" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="45" y1="70" x2="70" y2="40" stroke="#8a7060" strokeWidth="1.2" strokeLinecap="round" />
              <ellipse cx="30" cy="18" rx="6" ry="9" fill="#c8b090" opacity="0.8" />
              <ellipse cx="50" cy="13" rx="5" ry="8" fill="#b8a080" opacity="0.7" />
              <ellipse cx="65" cy="23" rx="5" ry="8" fill="#c0a888" opacity="0.75" />
              <ellipse cx="20" cy="33" rx="4" ry="7" fill="#b09878" opacity="0.6" />
              <ellipse cx="70" cy="38" rx="4" ry="7" fill="#c8b090" opacity="0.65" />
              <path d="M30,70 Q20,80 22,100 Q24,118 45,120 Q66,118 68,100 Q70,80 60,70 Z" fill="#d4b896" opacity="0.9" />
              <rect x="34" y="65" width="22" height="8" rx="3" fill="#c8a882" opacity="0.9" />
              <ellipse cx="35" cy="90" rx="4" ry="12" fill="white" opacity="0.15" />
            </svg>
          </div>
          <div className="life-quote-card__content">
            <span className="life-quote-card__mark">"</span>
            <p className="life-quote-card__text">The secret of getting ahead is getting started.</p>
            <p className="life-quote-card__author">- Mark Twain</p>
          </div>
        </section>

        <section className="life-card">
          <div className="life-card__header">
            <span className="life-card__title">Follow-ups</span>
            <Link to={withSearch('/followups')} className="life-card__link">
              View all
            </Link>
          </div>
          <div className="life-row-list">
            {followups.length === 0 ? (
              <p className="py-3 text-xs text-[#9f9384]">No follow-ups yet.</p>
            ) : (
              followups.slice(0, 4).map((followup) => (
                <div key={followup.id} className="life-row">
                  <span className="life-row__dot life-row__dot--gold" />
                  <div className="life-row__info">
                    <p className="life-row__title">{followup.title}</p>
                    <p className="life-row__sub">{followup.source_app.replace('_', ' ')}</p>
                  </div>
                  <span className="life-row__date">{followup.due_date ?? 'Waiting'}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
      </div>

      {isOpenPartial ? (
        <div className="life-dashboard__notice life-card border-[#e2c48e] bg-[#fff7e6] text-sm text-[#b27a1d]">
          Showing first {openLimit} open items. Sidebar badges and dashboard counts are partial until the cap is raised or the queue shrinks.
        </div>
      ) : null}
    </div>
  )
}
