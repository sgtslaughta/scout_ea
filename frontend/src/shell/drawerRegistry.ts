import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'
import { Cog, Users, Zap, Sparkles, Tags } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface DrawerDef {
  id: 'settings' | 'people' | 'topics' | 'automations' | 'wizard'
  label: string
  icon: LucideIcon
  component: LazyExoticComponent<ComponentType>
  kind: 'drawer' | 'dialog'
}

// People/Topics/Automations host MUI DataGrids and need a full-size modal;
// Settings is a plain form and reads fine in the side drawer.
export const DRAWERS: DrawerDef[] = [
  {
    id: 'settings',
    label: 'Settings',
    icon: Cog,
    component: lazy(() => import('@/views/Settings').then(m => ({ default: m.SettingsView }))),
    kind: 'drawer',
  },
  {
    id: 'people',
    label: 'People',
    icon: Users,
    component: lazy(() => import('@/views/People').then(m => ({ default: m.PeopleView }))),
    kind: 'dialog',
  },
  {
    id: 'topics',
    label: 'Topics',
    icon: Tags,
    component: lazy(() => import('@/components/feed/FeedTopics').then(m => ({ default: m.FeedTopics }))),
    kind: 'dialog',
  },
  {
    id: 'automations',
    label: 'Automations',
    icon: Zap,
    component: lazy(() => import('@/views/Automations').then(m => ({ default: m.AutomationsView }))),
    kind: 'dialog',
  },
  {
    id: 'wizard',
    label: 'Setup Wizard',
    icon: Sparkles,
    component: lazy(() => import('@/views/SetupWizard').then(m => ({ default: m.SetupWizard }))),
    kind: 'dialog',
  },
]
