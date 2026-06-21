import { useState } from 'react'
import {
  Calendar,
  CheckSquare,
  Cog,
  Inbox,
  Menu,
  TrendingUp,
  AlertCircle,
  FileText,
  Sun,
} from 'lucide-react'

const SIDEBAR_ITEMS = [
  { id: 'today', icon: Sun, label: 'Today', active: true },
  { id: 'inbox', icon: Inbox, label: 'Inbox' },
  { id: 'tasks', icon: CheckSquare, label: 'Tasks' },
  { id: 'calendar', icon: Calendar, label: 'Calendar' },
  { id: 'trending', icon: TrendingUp, label: 'Trending' },
  { id: 'deadlines', icon: AlertCircle, label: 'Deadlines' },
  { id: 'docs', icon: FileText, label: 'Docs' },
  { id: 'settings', icon: Cog, label: 'Settings' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: (collapsed: boolean) => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [activeItem, setActiveItem] = useState('today')

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
          <button
            key={item.id}
            onClick={() => setActiveItem(item.id)}
            className={`h-11 w-11 flex items-center justify-center rounded-md transition-all relative group ${
              activeItem === item.id
                ? 'text-accent'
                : 'text-muted hover:bg-surface-2 hover:text-text'
            }`}
            title={item.label}
            aria-label={item.label}
            aria-current={activeItem === item.id ? 'page' : undefined}
          >
            <item.icon size={20} />
            {activeItem === item.id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-accent rounded-r" />
            )}

            {/* Tooltip on hover */}
            <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2 py-1.5 bg-surface-2 border border-border rounded text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-md font-mono">
              {item.label}
            </div>
          </button>
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
