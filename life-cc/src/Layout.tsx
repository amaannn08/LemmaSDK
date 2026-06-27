import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  CalendarClock,
  CircleDashed,
  FileText,
  LayoutDashboard,
  MessageCircleMore,
  Plug,
  Repeat,
  Sparkles,
  Triangle,
} from 'lucide-react'
import { useCommitments } from './useCommitments'
import { SyncButton } from './SyncButton'
import { CATEGORY_NAV } from './types'

const ICONS = {
  loop: CircleDashed,
  deadline: CalendarClock,
  recurring: Repeat,
  document: FileText,
  followup: MessageCircleMore,
}

const PAGE_TITLE: Record<string, string> = {
  '/': 'Connections',
  '/dashboard': 'Dashboard',
  '/loops': 'Open Loops',
  '/deadlines': 'Deadlines',
  '/recurring': 'Recurring',
  '/documents': 'Documents',
  '/followups': 'Follow-ups',
  '/ai': 'AI Briefing',
}

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive ? 'bg-teal-950 text-teal-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
  }`

export function Layout() {
  const { records } = useCommitments()
  const counts = Object.fromEntries(
    CATEGORY_NAV.map(({ category }) => [category, records.filter((r) => r.category === category).length]),
  )
  const location = useLocation()
  const title = PAGE_TITLE[location.pathname] ?? 'Life Command Centre'

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <aside className="flex w-60 flex-col border-r border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-600">
            <Triangle size={14} className="fill-white text-white" />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">LifeOps</div>
            <div className="text-xs text-zinc-500">Command Centre</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <div className="mb-4">
            <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-600">Overview</div>
            <NavLink to="/" className={navItemClass} end>
              <Plug size={16} />
              Connections
            </NavLink>
            <NavLink to="/dashboard" className={navItemClass}>
              <LayoutDashboard size={16} />
              Dashboard
            </NavLink>
          </div>

          <div className="mb-4">
            <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-600">Life Ops</div>
            {CATEGORY_NAV.map(({ category, label, path }) => {
              const Icon = ICONS[category]
              return (
                <NavLink key={path} to={path} className={navItemClass}>
                  <Icon size={16} />
                  <span className="flex-1">{label}</span>
                  {counts[category] > 0 ? (
                    <span className="min-w-5 rounded-full bg-zinc-800 px-1.5 text-center text-xs font-semibold text-zinc-400">
                      {counts[category]}
                    </span>
                  ) : null}
                </NavLink>
              )
            })}
          </div>

          <div>
            <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-600">Intelligence</div>
            <NavLink to="/ai" className={navItemClass}>
              <Sparkles size={16} />
              AI Briefing
            </NavLink>
          </div>
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-zinc-800 px-6">
          <span className="flex-1 text-base font-semibold">{title}</span>
          <SyncButton />
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
