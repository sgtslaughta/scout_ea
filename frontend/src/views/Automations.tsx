import { lazy } from 'react'
import { TabbedView } from '@/components/TabbedView'

const SetupWizard = lazy(() => import('./SetupWizard').then((m) => ({ default: m.SetupWizard })))
const SkillsView = lazy(() => import('./Skills').then((m) => ({ default: m.SkillsView })))
const ActivityView = lazy(() => import('./Activity').then((m) => ({ default: m.ActivityView })))

export function AutomationsView() {
  return (
    <TabbedView
      ariaLabel="Automations sections"
      tabs={[
        { id: 'setup', label: 'Setup', element: <SetupWizard /> },
        { id: 'skills', label: 'Skills', element: <SkillsView /> },
        { id: 'activity', label: 'Activity', element: <ActivityView /> },
      ]}
    />
  )
}
