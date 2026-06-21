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
      className={`flex flex-col bg-surface border-r border-border transition-all duration-200 ${
        collapsed ? 'w-14' : 'w-14'
      }`}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Menu toggle */}
      <div className="p-2">
        <button
          onClick={() => onToggle(!collapsed)}
          className="w-10 h-10 flex items-center justify-center rounded hover:bg-surface-2 transition-colors"
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
        >
          <Menu size={18} className="text-accent" />
        </button>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 flex flex-col gap-2 p-2">
        {SIDEBAR_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveItem(item.id)}
            className={`w-10 h-10 flex items-center justify-center rounded transition-colors relative group ${
              activeItem === item.id
                ? 'bg-surface-2'
                : 'hover:bg-surface-2'
            }`}
            title={item.label}
            aria-label={item.label}
            aria-current={activeItem === item.id ? 'page' : undefined}
          >
            <item.icon size={18} className={activeItem === item.id ? 'text-accent' : 'text-muted'} />
            {activeItem === item.id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-accent rounded-r" />
            )}

            {/* Tooltip on hover */}
            <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2 py-1 bg-surface-2 border border-border rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
              {item.label}
            </div>
          </button>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="p-2 border-t border-border">
        <button
          className="w-10 h-10 flex items-center justify-center rounded hover:bg-surface-2 transition-colors"
          title="Help"
          aria-label="Help"
        >
          <span className="text-xs text-muted font-mono">?</span>
        </button>
      </div>
    </div>
  )
}
