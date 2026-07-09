import { NavLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import {
  Calendar, CheckSquare, Cog, Inbox, Menu, TrendingUp,
  AlertCircle, FileText, Grid3x3, Users, Hash,
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
    <Box
      component="nav"
      aria-label="Main navigation"
      sx={{
        width: 56,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
      }}
    >
      <Box sx={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <IconButton onClick={() => onToggle(!collapsed)} aria-label="Toggle sidebar" color="primary">
          <Menu size={20} />
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, py: 1.5 }}>
        {SIDEBAR_ITEMS.map((item) => (
          <Tooltip key={item.id} title={item.label} placement="right">
            <NavLink to={item.route} end={item.route === '/'} aria-label={item.label} style={{ position: 'relative' }}>
              {({ isActive }) => (
                <>
                  <IconButton component="span" color={isActive ? 'primary' : 'default'} aria-hidden>
                    <item.icon size={20} />
                  </IconButton>
                  {isActive && (
                    <Box
                      sx={{
                        position: 'absolute', right: '100%', top: '50%', transform: 'translateY(-50%)',
                        width: 3, height: 24, bgcolor: 'primary.main', borderRadius: '0 3px 3px 0',
                      }}
                    />
                  )}
                </>
              )}
            </NavLink>
          </Tooltip>
        ))}
      </Box>
      <Box sx={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', borderTop: 1, borderColor: 'divider' }}>
        <Tooltip title="Help" placement="right">
          <IconButton aria-label="Help" size="small">?</IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
}
