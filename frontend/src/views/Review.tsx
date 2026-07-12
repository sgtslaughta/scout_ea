import { lazy } from 'react'
import { TabbedView } from '@/components/TabbedView'

const InboxView = lazy(() => import('./Inbox').then((m) => ({ default: m.InboxView })))
const ActionsView = lazy(() => import('./Actions').then((m) => ({ default: m.ActionsView })))

export function ReviewView() {
  return (
    <TabbedView
      ariaLabel="Review sections"
      tabs={[
        { id: 'inbox', label: 'Inbox', element: <InboxView /> },
        { id: 'actions', label: 'Actions', element: <ActionsView /> },
      ]}
    />
  )
}
