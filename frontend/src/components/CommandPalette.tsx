import { useEffect, useState } from 'react'
import { Command } from 'cmdk'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onViewChange: (view: string) => void
  onRefresh: () => void
}

const VIEWS = [
  { id: 'today', label: 'Today' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'trending', label: 'Trending' },
  { id: 'deadlines', label: 'Deadlines' },
  { id: 'docs', label: 'Docs' },
  { id: 'settings', label: 'Settings' },
]

export function CommandPalette({ open, onOpenChange, onViewChange, onRefresh }: CommandPaletteProps) {
  const [value, setValue] = useState('')

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }

    if (open) {
      document.addEventListener('keydown', down)
      return () => document.removeEventListener('keydown', down)
    }
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-20"
      onClick={() => onOpenChange(false)}
    >
      <Command
        className="w-[400px] bg-surface border border-border rounded-lg shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-4 py-3">
          <input
            placeholder="Search..."
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            className="w-full bg-transparent text-text placeholder-muted focus:outline-none"
            autoFocus
          />
        </div>

        <Command.List className="max-h-[300px] overflow-y-auto">
          <Command.Group heading="Navigation" className="px-4 py-2">
            {VIEWS.map((view) => (
              <Command.Item
                key={view.id}
                value={view.id}
                className={`px-2 py-2 rounded cursor-pointer transition-colors ${
                  value.toLowerCase() === view.id || value === ''
                    ? 'text-accent'
                    : 'text-text hover:bg-surface-2'
                }`}
                onSelect={() => {
                  onViewChange(view.id)
                  onOpenChange(false)
                  setValue('')
                }}
              >
                {view.label}
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading="Quick Actions" className="px-4 py-2">
            <Command.Item
              value="add-deadline"
              className="px-2 py-2 rounded cursor-pointer transition-colors text-text hover:bg-surface-2"
              onSelect={() => {
                onViewChange('deadlines')
                onOpenChange(false)
                setValue('')
              }}
            >
              Add deadline
            </Command.Item>
            <Command.Item
              value="refresh"
              className="px-2 py-2 rounded cursor-pointer transition-colors text-text hover:bg-surface-2"
              onSelect={() => {
                onRefresh()
                onOpenChange(false)
                setValue('')
              }}
            >
              Refresh data
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  )
}
