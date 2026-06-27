import { NavLink, Outlet } from 'react-router-dom'
import { Boxes, LayoutDashboard, Plug } from 'lucide-react'

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-amber-100 text-amber-900' : 'text-zinc-600 hover:bg-zinc-100'
  }`

export function Layout() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Boxes className="text-amber-600" size={22} />
          <p className="text-lg font-semibold text-zinc-900">Life Command Centre</p>
        </div>
        <nav className="flex items-center gap-1">
          <NavLink to="/" className={navItemClass} end>
            <Plug size={16} />
            Connections
          </NavLink>
          <NavLink to="/dashboard" className={navItemClass}>
            <LayoutDashboard size={16} />
            Dashboard
          </NavLink>
        </nav>
      </header>

      <Outlet />
    </div>
  )
}
