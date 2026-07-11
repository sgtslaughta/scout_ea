import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { Box } from '@mui/material'

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
  { id: 'skills', label: 'Skills' },
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
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        pt: 20,
      }}
      onClick={() => onOpenChange(false)}
    >
      <Command
        style={{
          width: '400px',
          background: 'var(--mui-palette-background-paper)',
          border: '1px solid var(--mui-palette-divider)',
          borderRadius: 'var(--mui-shape-borderRadius)',
          boxShadow: '0 9px 9px -5px rgba(0,0,0,0.2),0 15px 22px 2px rgba(0,0,0,0.14),0 6px 28px 5px rgba(0,0,0,0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 2, py: 1.5 }}>
          <input
            placeholder="Search..."
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 'inherit',
              color: 'inherit',
            }}
            autoFocus
          />
        </Box>

        <Command.List style={{ maxHeight: 300, overflow: 'auto' }}>
          <Command.Group heading="Navigation" style={{ padding: '8px 16px' }}>
            {VIEWS.map((view) => (
              <Command.Item
                key={view.id}
                value={view.id}
                style={{
                  padding: '8px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: value.toLowerCase() === view.id || value === '' ? 'var(--mui-palette-primary-main)' : 'var(--mui-palette-text-primary)',
                  transition: 'background-color 200ms',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--mui-palette-action-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
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

          <Command.Group heading="Quick Actions" style={{ padding: '8px 16px' }}>
            <Command.Item
              value="add-deadline"
              style={{
                padding: '8px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                color: 'var(--mui-palette-text-primary)',
                transition: 'background-color 200ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--mui-palette-action-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
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
              style={{
                padding: '8px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                color: 'var(--mui-palette-text-primary)',
                transition: 'background-color 200ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--mui-palette-action-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
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
    </Box>
  )
}
