import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { Box } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { search } from '@/api'
import { NAV } from '@/nav'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onViewChange: (view: string) => void
  onRefresh: () => void
}

// nav destinations, derived from the single route registry
const VIEWS = NAV.map((n) => ({ path: n.path, label: n.label }))

// Result entity kind -> section heading + the PATH to navigate to.
const KIND_ORDER = ['task', 'signal', 'deadline', 'event', 'person', 'topic', 'trend'] as const
const KIND_LABEL: Record<string, string> = {
  task: 'Tasks', signal: 'Signals', deadline: 'Deadlines', event: 'Events',
  person: 'People', topic: 'Topics', trend: 'Trends',
}
const KIND_VIEW: Record<string, string> = {
  task: '/tasks', signal: '/feed?view=inbox', deadline: '/schedule', event: '/schedule?tab=calendar',
  person: '/people', topic: '/feed?view=topics', trend: '/feed?view=trending',
}

const itemStyle: React.CSSProperties = {
  padding: '8px 8px', borderRadius: '4px', cursor: 'pointer',
  color: 'var(--mui-palette-text-primary)', transition: 'background-color 200ms',
}
const hoverOn = (e: React.MouseEvent<HTMLElement>) => (e.currentTarget.style.backgroundColor = 'var(--mui-palette-action-hover)')
const hoverOff = (e: React.MouseEvent<HTMLElement>) => (e.currentTarget.style.backgroundColor = 'transparent')

export function CommandPalette({ open, onOpenChange, onViewChange, onRefresh }: CommandPaletteProps) {
  const [value, setValue] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(value.trim()), 250)
    return () => clearTimeout(t)
  }, [value])

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false) }
    if (open) {
      document.addEventListener('keydown', down)
      return () => document.removeEventListener('keydown', down)
    }
  }, [open, onOpenChange])

  const { data: results = [] } = useQuery({
    queryKey: ['search', debouncedQ],
    queryFn: () => search(debouncedQ),
    enabled: open && debouncedQ.length >= 2,
  })

  if (!open) return null

  const close = () => { onOpenChange(false); setValue(''); setDebouncedQ('') }
  const q = value.trim().toLowerCase()
  const navMatch = (label: string) => !q || label.toLowerCase().includes(q)
  const filteredViews = VIEWS.filter((v) => navMatch(v.label))
  const grouped = KIND_ORDER
    .map((k) => [k, results.filter((r) => r.kind === k)] as const)
    .filter(([, rs]) => rs.length > 0)

  return (
    <Box
      sx={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', pt: 20 }}
      onClick={close}
    >
      <Command
        shouldFilter={false}
        style={{
          width: '440px', background: 'var(--mui-palette-background-paper)',
          border: '1px solid var(--mui-palette-divider)', borderRadius: 'var(--mui-shape-borderRadius)',
          boxShadow: '0 9px 9px -5px rgba(0,0,0,0.2),0 15px 22px 2px rgba(0,0,0,0.14),0 6px 28px 5px rgba(0,0,0,0.12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 2, py: 1.5 }}>
          <input
            placeholder="Search everything…"
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 'inherit', color: 'inherit' }}
            autoFocus
          />
        </Box>

        <Command.List style={{ maxHeight: 360, overflow: 'auto' }}>
          {/* live entity results (grouped by kind) */}
          {grouped.map(([kind, rs]) => (
            <Command.Group key={kind} heading={KIND_LABEL[kind]} style={{ padding: '8px 16px' }}>
              {rs.map((r) => (
                <Command.Item
                  key={`${kind}-${r.ref_id}`}
                  value={`${kind}-${r.ref_id}`}
                  style={itemStyle}
                  onMouseEnter={hoverOn}
                  onMouseLeave={hoverOff}
                  onSelect={() => { onViewChange(KIND_VIEW[kind]); close() }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <span>{r.title}</span>
                    {r.snippet && (
                      <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{r.snippet}</Box>
                    )}
                  </Box>
                </Command.Item>
              ))}
            </Command.Group>
          ))}

          {debouncedQ.length >= 2 && grouped.length === 0 && (
            <Box sx={{ px: 2, py: 1.5, fontSize: 13, color: 'text.secondary' }}>No matches for “{debouncedQ}”.</Box>
          )}

          {/* navigation (filtered by typed text) */}
          {filteredViews.length > 0 && (
            <Command.Group heading="Navigation" style={{ padding: '8px 16px' }}>
              {filteredViews.map((view) => (
                <Command.Item
                  key={view.path}
                  value={`nav-${view.path}`}
                  style={itemStyle}
                  onMouseEnter={hoverOn}
                  onMouseLeave={hoverOff}
                  onSelect={() => { onViewChange(view.path); close() }}
                >
                  {view.label}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* quick actions (only when not actively searching) */}
          {q === '' && (
            <Command.Group heading="Quick Actions" style={{ padding: '8px 16px' }}>
              <Command.Item value="add-deadline" style={itemStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}
                onSelect={() => { onViewChange('/schedule'); close() }}>
                Add deadline
              </Command.Item>
              <Command.Item value="go-to-inbox" style={itemStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}
                onSelect={() => { onViewChange('/feed?view=inbox'); close() }}>
                Go to Inbox
              </Command.Item>
              <Command.Item value="refresh" style={itemStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}
                onSelect={() => { onRefresh(); close() }}>
                Refresh data
              </Command.Item>
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </Box>
  )
}
