import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCreateRecord } from 'lemma-sdk/react'
import { CalendarClock, CircleDashed, FileText, Loader2, MessageCircleMore, Repeat, Zap } from 'lucide-react'
import { lemmaClient } from './lemma-client'
import { useCommitments } from './useCommitments'
import { CommitmentItem } from './CommitmentItem'
import { AiBriefing } from './AiBriefing'
import { KpiCard, type KpiTone } from './components/KpiCard'
import { CATEGORY_NAV, type Category } from './types'

const KPI_META: Record<Exclude<Category, 'document'>, { icon: typeof CircleDashed; tone: KpiTone; sublabel: string }> = {
  loop: { icon: CircleDashed, tone: 'red', sublabel: 'Unresolved commitments' },
  deadline: { icon: CalendarClock, tone: 'amber', sublabel: 'Next 30 days' },
  recurring: { icon: Repeat, tone: 'gold', sublabel: 'Active cycles' },
  followup: { icon: MessageCircleMore, tone: 'blue', sublabel: 'Waiting on others' },
}
// Document isn't a KPI tile in the mockup (it's a sidebar section, not a top-line metric) — 4 tiles, not 5.
const KPI_CATEGORIES: Exclude<Category, 'document'>[] = ['loop', 'deadline', 'recurring', 'followup']

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function QuickAdd() {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<Category>('loop')
  const { create, isSubmitting } = useCreateRecord({ client: lemmaClient, tableName: 'commitments' })

  function submit() {
    const trimmed = title.trim()
    if (!trimmed) return
    void create({
      title: trimmed,
      category,
      source_app: 'manual',
      status: category === 'deadline' ? 'open' : 'open',
      priority: 'normal',
      detected_at: new Date().toISOString(),
    }).then(() => setTitle(''))
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <Zap size={16} className="shrink-0 text-teal-500" />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder='Try: "Renew passport" or "Follow up with Rahul about the repo"'
        className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-teal-600"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as Category)}
        className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-2 text-xs text-zinc-300 outline-none"
      >
        {CATEGORY_NAV.map(({ category: c, label }) => (
          <option key={c} value={c}>
            {label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={submit}
        disabled={isSubmitting || !title.trim()}
        className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
        Add
      </button>
    </div>
  )
}

function CategoryPreview({ category, label, path }: { category: Category; label: string; path: string }) {
  const { records } = useCommitments({ category })
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <span className="text-sm font-semibold text-zinc-200">{label}</span>
        <Link to={path} className="text-xs text-zinc-500 hover:text-teal-400">
          View all
        </Link>
      </div>
      <div className="px-5 py-2">
        {records.length === 0 ? (
          <p className="py-3 text-xs text-zinc-600">Nothing here yet.</p>
        ) : (
          records.slice(0, 3).map((c) => <CommitmentItem key={c.id} commitment={c} mode="compact" />)
        )}
      </div>
    </div>
  )
}

export function Dashboard() {
  const { records: openLoops } = useCommitments({ category: 'loop' })
  const { records: deadlines } = useCommitments({ category: 'deadline' })
  const { records: recurring } = useCommitments({ category: 'recurring' })
  const { records: followups } = useCommitments({ category: 'followup' })
  const today = todayISO()
  const overdueLoops = openLoops.filter((c) => c.due_date && c.due_date < today).length
  const dueToday = deadlines.filter((c) => c.due_date === today).length

  const counts: Record<Category, number> = {
    loop: openLoops.length,
    deadline: deadlines.length,
    recurring: recurring.length,
    followup: followups.length,
    document: 0,
  }
  const badges: Record<Category, string> = {
    loop: overdueLoops > 0 ? `${overdueLoops} overdue` : 'On track',
    deadline: dueToday > 0 ? `${dueToday} today` : 'Upcoming',
    recurring: 'Active',
    followup: followups.length > 0 ? 'Waiting' : 'Clear',
    document: '',
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>

      <AiBriefing />

      <QuickAdd />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {CATEGORY_NAV.map(({ category, label, path }) => (
          <CategoryPreview key={category} category={category} label={label} path={path} />
        ))}
      </div>
    </div>
  )
}
