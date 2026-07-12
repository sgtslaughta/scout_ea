import { lazy } from 'react'
import { TabbedView } from '@/components/TabbedView'

const DeadlinesView = lazy(() => import('./Deadlines').then((m) => ({ default: m.DeadlinesView })))
const CalendarView = lazy(() => import('./Calendar').then((m) => ({ default: m.CalendarView })))

export function ScheduleView() {
  return (
    <TabbedView
      ariaLabel="Schedule sections"
      tabs={[
        { id: 'deadlines', label: 'Deadlines', element: <DeadlinesView /> },
        { id: 'calendar', label: 'Calendar', element: <CalendarView /> },
      ]}
    />
  )
}
