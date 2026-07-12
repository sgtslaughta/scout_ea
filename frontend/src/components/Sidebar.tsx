import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { Menu } from 'lucide-react'
import { NAV, NAV_GROUPS } from '@/nav'
import { HelpDialog } from './HelpDialog'

interface SidebarProps {
  collapsed: boolean
  onToggle: (collapsed: boolean) => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [helpOpen, setHelpOpen] = useState(false)

  return (
    <Box
      component="nav"
      aria-label="Main navigation"
      sx={{
        width: collapsed ? 56 : 200,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        transition: 'width 0.2s',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', px: collapsed ? 0 : 1 }}>
        <IconButton onClick={() => onToggle(!collapsed)} aria-label="Toggle sidebar" color="primary">
          <Menu size={20} />
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0.5, py: 1.5, px: collapsed ? 0 : 1 }}>
        {NAV_GROUPS.map((group) => {
          const items = NAV.filter((n) => n.group === group.id)
          if (items.length === 0) return null
          return (
            <Box key={group.id} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
              {!collapsed && (
                <Typography variant="caption" color="text.disabled" sx={{ px: 1, pt: 1, textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 10 }}>
                  {group.label}
                </Typography>
              )}
              {items.map((item) => {
                const content = (
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    aria-label={item.label}
                    style={{ position: 'relative', textDecoration: 'none' }}
                  >
                    {({ isActive }) => (
                      <Box
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1.5,
                          justifyContent: collapsed ? 'center' : 'flex-start',
                          borderRadius: 1, px: collapsed ? 0 : 1, py: 0.5,
                          color: isActive ? 'primary.main' : 'text.secondary',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <IconButton component="span" color={isActive ? 'primary' : 'default'} aria-hidden sx={{ p: collapsed ? 1 : 0.5 }}>
                          <item.icon size={20} />
                        </IconButton>
                        {!collapsed && (
                          <Typography variant="body2" sx={{ fontWeight: isActive ? 600 : 400 }}>{item.label}</Typography>
                        )}
                        {isActive && (
                          <Box sx={{ position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)', width: 3, height: 24, bgcolor: 'primary.main', borderRadius: '0 3px 3px 0' }} />
                        )}
                      </Box>
                    )}
                  </NavLink>
                )
                return collapsed ? (
                  <Tooltip key={item.id} title={item.label} placement="right">{content}</Tooltip>
                ) : (
                  <Box key={item.id}>{content}</Box>
                )
              })}
            </Box>
          )
        })}
      </Box>
      <Box sx={{ minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', px: collapsed ? 0 : 1, borderTop: 1, borderColor: 'divider' }}>
        <Tooltip title="Help" placement="right">
          <IconButton aria-label="Help" size="small" onClick={() => setHelpOpen(true)}>?</IconButton>
        </Tooltip>
        {!collapsed && <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>Help</Typography>}
      </Box>
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </Box>
  )
}
