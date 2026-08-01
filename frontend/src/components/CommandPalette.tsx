import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { Box } from '@mui/material'
import { DRAWERS, type DrawerDef } from '@/shell/drawerRegistry'
import { useQuickLinks } from '@/shell/useQuickLinks'
import { safeHttpUrl } from '@/lib/url'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenDrawer: (id: DrawerDef['id']) => void
  onRefresh: () => void
}

const itemStyle: React.CSSProperties = {
  padding: '8px 8px', borderRadius: '4px', cursor: 'pointer',
  color: 'var(--mui-palette-text-primary)', transition: 'background-color 200ms',
}
const hoverOn = (e: React.MouseEvent<HTMLElement>) => (e.currentTarget.style.backgroundColor = 'var(--mui-palette-action-hover)')
const hoverOff = (e: React.MouseEvent<HTMLElement>) => (e.currentTarget.style.backgroundColor = 'transparent')

export function CommandPalette({ open, onOpenChange, onOpenDrawer, onRefresh }: CommandPaletteProps) {
  const [value, setValue] = useState('')
  const { links } = useQuickLinks()

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false) }
    if (open) {
      document.addEventListener('keydown', down)
      return () => document.removeEventListener('keydown', down)
    }
  }, [open, onOpenChange])

  if (!open) return null

  const close = () => { onOpenChange(false); setValue('') }
  const q = value.trim().toLowerCase()
  const matches = (label: string) => !q || label.toLowerCase().includes(q)
  const filteredDrawers = DRAWERS.filter((d) => matches(d.label))
  const filteredLinks = links.filter((l) => matches(l.name))

  const openLink = (url: string) => {
    const safe = safeHttpUrl(url)
    if (safe) window.open(safe, '_blank', 'noopener')
    close()
  }

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
          {filteredDrawers.length === 0 && filteredLinks.length === 0 && q !== '' && (
            <Box sx={{ px: 2, py: 1.5, fontSize: 13, color: 'text.secondary' }}>No matches for “{value.trim()}”.</Box>
          )}

          {filteredDrawers.length > 0 && (
            <Command.Group heading="Go to" style={{ padding: '8px 16px' }}>
              {filteredDrawers.map((d) => (
                <Command.Item
                  key={d.id}
                  value={`drawer-${d.id}`}
                  style={itemStyle}
                  onMouseEnter={hoverOn}
                  onMouseLeave={hoverOff}
                  onSelect={() => { onOpenDrawer(d.id); close() }}
                >
                  {d.label}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {filteredLinks.length > 0 && (
            <Command.Group heading="Quick Links" style={{ padding: '8px 16px' }}>
              {filteredLinks.map((l) => (
                <Command.Item
                  key={l.name}
                  value={`link-${l.name}`}
                  style={itemStyle}
                  onMouseEnter={hoverOn}
                  onMouseLeave={hoverOff}
                  onSelect={() => openLink(l.url)}
                >
                  {l.name}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {q === '' && (
            <Command.Group heading="Quick Actions" style={{ padding: '8px 16px' }}>
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
