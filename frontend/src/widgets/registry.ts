import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'

export type WidgetSize = 'sm' | 'md' | 'lg'

export interface WidgetDef {
  key: string
  title: string
  /** grid span: sm=4, md=6, lg=12 of 12 columns */
  size: WidgetSize
  component: LazyExoticComponent<ComponentType>
  /** route the "open view" action navigates to; omit for expand-only widgets */
  drillDown?: string
  /** TanStack Query keys the refresh action invalidates */
  queryKeys: string[][]
}

// Adding a data source = create one widget file + append one entry here.
export const WIDGETS: WidgetDef[] = [
  {
    key: 'kpi',
    title: 'Key Metrics',
    size: 'lg',
    component: lazy(() => import('./KpiStrip')),
    queryKeys: [['outlook'], ['deadlines'], ['trends'], ['signals'], ['activity']],
  },
  {
    key: 'deadlines',
    title: 'Deadlines',
    size: 'md',
    component: lazy(() => import('./DeadlinesWidget')),
    drillDown: '/deadlines',
    queryKeys: [['deadlines']],
  },
  {
    key: 'signals',
    title: 'Signals',
    size: 'md',
    component: lazy(() => import('./SignalsWidget')),
    drillDown: '/inbox?status=new',
    queryKeys: [['signals']],
  },
  {
    key: 'trending',
    title: 'Trending',
    size: 'md',
    component: lazy(() => import('./TrendingWidget')),
    drillDown: '/trending?dir=rising',
    queryKeys: [['trends']],
  },
  {
    key: 'activity',
    title: 'Skill Activity',
    size: 'md',
    component: lazy(() => import('./ActivityWidget')),
    queryKeys: [['activity']],
  },
]
