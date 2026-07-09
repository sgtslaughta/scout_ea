import { NavLink } from 'react-router-dom'
import {
  Calendar,
  CheckSquare,
  Cog,
  Inbox,
  Menu,
  TrendingUp,
  AlertCircle,
  FileText,
  Grid3x3,
  Users,
  Hash,
} from 'lucide-react'

const SIDEBAR_ITEMS = [
  { id: 'dashboard', route: '/', icon: Grid3x3, label: 'Dashboard' },
  { id: 'inbox', route: '/inbox', icon: Inbox, label: 'Inbox' },
  { id: 'tasks', route: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { id: 'calendar', route: '/calendar', icon: Calendar, label: 'Calendar' },
  { id: 'trending', route: '/trending', icon: TrendingUp, label: 'Trending' },
  { id: 'deadlines', route: '/deadlines', icon: AlertCircle, label: 'Deadlines' },
  { id: 'people', route: '/people', icon: Users, label: 'People' },
  { id: 'topics', route: '/topics', icon: Hash, label: 'Topics' },
  { id: 'docs', route: '/docs', icon: FileText, label: 'Docs' },
  { id: 'settings', route: '/settings', icon: Cog, label: 'Settings' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: (collapsed: boolean) => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {

  return (
    <div
      className="w-14 flex flex-col bg-surface border-r border-border"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Menu toggle */}
      <div className="h-14 flex items-center justify-center">
        <button
          onClick={() => onToggle(!collapsed)}
          className="h-11 w-11 flex items-center justify-center rounded-md hover:bg-surface-2 transition-colors text-accent"
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 flex flex-col gap-0 px-2 py-3">
        {SIDEBAR_ITEMS.map((item) => (
          <NavLink
            key={item.id}
            to={item.route}
            end={item.route === '/'}
            title={item.label}
            aria-label={item.label}
            className={({ isActive }) =>
              `h-11 w-11 flex items-center justify-center rounded-md transition-all relative ${
                isActive ? 'text-accent' : 'text-muted hover:bg-surface-2 hover:text-text'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={20} />
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-accent rounded-r" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="h-14 flex items-center justify-center border-t border-border">
        <button
          className="h-11 w-11 flex items-center justify-center rounded-md hover:bg-surface-2 text-muted hover:text-text transition-colors"
          title="Help"
          aria-label="Help"
        >
          <span className="text-xs font-mono">?</span>
        </button>
      </div>
    </div>
  )
}
