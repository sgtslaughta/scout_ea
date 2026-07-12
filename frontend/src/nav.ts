import { Grid3x3, CheckSquare, Calendar, Newspaper, Users, Zap, Cog } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavGroupId = 'work' | 'knowledge' | 'system'

export interface NavItem {
  id: string
  path: string
  label: string
  icon: LucideIcon
  group: NavGroupId
}

export const NAV_GROUPS: { id: NavGroupId; label: string }[] = [
  { id: 'work', label: 'Work' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'system', label: 'System' },
]

export const NAV: NavItem[] = [
  { id: 'home', path: '/', label: 'Home', icon: Grid3x3, group: 'work' },
  { id: 'tasks', path: '/tasks', label: 'Tasks', icon: CheckSquare, group: 'work' },
  { id: 'schedule', path: '/schedule', label: 'Schedule', icon: Calendar, group: 'work' },
  { id: 'feed', path: '/feed', label: 'Data Feed', icon: Newspaper, group: 'knowledge' },
  { id: 'people', path: '/people', label: 'People', icon: Users, group: 'knowledge' },
  { id: 'automations', path: '/automations', label: 'Automations', icon: Zap, group: 'system' },
  { id: 'settings', path: '/settings', label: 'Settings', icon: Cog, group: 'system' },
]
