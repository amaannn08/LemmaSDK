import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  CalendarClock,
  CircleDashed,
  FileText,
  Inbox,
  LayoutDashboard,
  MessageCircleMore,
  Plug,
  Repeat,
  Sparkles,
  TimerReset,
  Triangle,
  ChevronDown,
} from 'lucide-react'
import { useCurrentUser } from 'lemma-sdk/react'
import { useAllCommitments, useCommitments } from './CommitmentsContext'
import { lemmaClient } from './lemma-client'
import { SyncButton } from './SyncButton'
import { CATEGORY_NAV } from './types'
import { getUserDisplayName, getUserInitial, getUserSecondaryLabel } from './user-profile'

const ICONS = {
  loop: CircleDashed,
  deadline: CalendarClock,
  recurring: Repeat,
  document: FileText,
  followup: MessageCircleMore,
}

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `life-nav-link ${isActive ? 'life-nav-link--active' : ''}`

export function Layout() {
  const { records } = useCommitments()
  const { records: snoozedRecords } = useCommitments({ status: 'snoozed' })
  const { isOpenPartial, openLimit, unclassifiedRecords } = useAllCommitments()
  const { user } = useCurrentUser({ client: lemmaClient })
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const location = useLocation()
  const counts = Object.fromEntries(
    CATEGORY_NAV.map(({ category }) => [category, records.filter((r) => r.category === category).length]),
  )
  const withSearch = (path: string) => ({ pathname: path, search: location.search })

  const isDashboard = location.pathname === '/dashboard' || location.pathname === '/'

  const displayName = getUserDisplayName(user)
  const userInitial = getUserInitial(user)
  const userSubtitle = getUserSecondaryLabel(user)

  async function handleLogout() {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await lemmaClient.auth.redirectToFederatedLogout({ redirectUri: window.location.origin })
    } catch {
      await lemmaClient.auth.signOut()
      window.location.assign('/')
    }
  }

  return (
    <div className="life-shell flex flex-col lg:flex-row">
      <aside className="life-sidebar">
        <div className="life-sidebar__logo">
          <div className="life-logo-icon">
            <Triangle size={14} className="fill-white text-white" />
          </div>
          <div className="life-logo-copy">
            <strong>LifeOps</strong>
            <span>Command Centre</span>
          </div>
        </div>

        <nav className="life-nav flex-1 overflow-y-auto py-3">
          <div className="mb-4">
            <div className="life-nav-section-title">Overview</div>
            <NavLink to={withSearch('/connections')} className={navItemClass}>
              <Plug size={16} />
              Connections
            </NavLink>
            <NavLink to={withSearch('/dashboard')} className={navItemClass}>
              <LayoutDashboard size={16} />
              Dashboard
            </NavLink>
          </div>

          <div className="mb-4">
            <div className="life-nav-section-title">Life Ops</div>
            {isOpenPartial ? <p className="px-5 pb-2 text-[11px] text-[#b37a24]">Showing first {openLimit} open items.</p> : null}
            {CATEGORY_NAV.map(({ category, label, path }) => {
              const Icon = ICONS[category]
              return (
                <NavLink key={path} to={withSearch(path)} className={navItemClass}>
                  <Icon size={16} />
                  <span className="flex-1">{label}</span>
                  {counts[category] > 0 ? <span className="life-nav-count">{isOpenPartial ? `${counts[category]}+` : counts[category]}</span> : null}
                </NavLink>
              )
            })}
            <NavLink to={withSearch('/snoozed')} className={navItemClass}>
              <TimerReset size={16} />
              <span className="flex-1">Snoozed</span>
              {snoozedRecords.length > 0 ? <span className="life-nav-count">{snoozedRecords.length}</span> : null}
            </NavLink>
            <NavLink to={withSearch('/unclassified')} className={navItemClass}>
              <Inbox size={16} />
              <span className="flex-1">Unclassified</span>
              {unclassifiedRecords.length > 0 ? <span className="life-nav-count">{unclassifiedRecords.length}</span> : null}
            </NavLink>
          </div>

          <div>
            <div className="life-nav-section-title">Intelligence</div>
            <NavLink to={withSearch('/ai')} className={navItemClass}>
              <Sparkles size={16} />
              AI Briefing
            </NavLink>
          </div>
        </nav>

        <div className="life-sidebar__footer">
          <details className="life-account">
            <summary className="life-user" aria-label="Account menu">
              <div className="life-avatar" aria-hidden="true">
                {userInitial}
              </div>
              <span className="life-user__copy">
                <span className="life-user__name">{displayName}</span>
                <span className="life-user__meta">{userSubtitle}</span>
              </span>
              <span className="life-user__chevron" aria-hidden="true">
                <ChevronDown size={14} />
              </span>
            </summary>
            <div className="life-account__menu">
              <Link to={withSearch('/connections')} className="life-account__menu-item">
                Manage connections
              </Link>
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
                className="life-account__menu-item life-account__menu-item--danger disabled:opacity-60"
              >
                {isLoggingOut ? 'Logging out…' : 'Logout'}
              </button>
            </div>
          </details>
        </div>
      </aside>

      <div className="life-main">
        {!isDashboard ? (
          <header className="life-topbar life-topbar--compact">
            <div className="life-topbar__side" />
            <div className="life-topbar__side life-topbar__side--right">
              <SyncButton />
            </div>
          </header>
        ) : null}

        <main className="life-page">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
