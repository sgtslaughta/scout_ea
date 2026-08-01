import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'
import {
  Mail, MessageSquare, TrendingUp, GitBranch, Newspaper,
  CalendarDays, MessageCircle, Map, Lightbulb,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getConfig } from '@/api'
import { safeHttpUrl } from '@/lib/url'

export type WidgetSize = 'sm' | 'lg'

export interface WidgetDef {
  key: string
  title: string
  /** grid span in the 2-column dashboard: sm=1 column, lg=full width */
  size: WidgetSize
  component: LazyExoticComponent<ComponentType>
  /** route the "open view" action navigates to, or a callback (e.g. opens a drawer/modal); omit for expand-only widgets */
  drillDown?: string | (() => void)
  /** TanStack Query keys the refresh action invalidates */
  queryKeys: string[][]
  /** icon + message shown centred in the tile in place of children when its count is 0 */
  emptyState?: { icon?: LucideIcon; message: string }
  /** optional per-tile settings panel, opened from a gear icon in the header */
  settings?: LazyExoticComponent<ComponentType>
}

// Adding a dashboard = build the tile component, then swap it in for
// PlaceholderTile on the matching entry below. Nothing else in the shell
// changes: the grid, drag ordering, and card chrome all read from here.
const Placeholder = lazy(() => import('./PlaceholderTile'))
const EmailTile = lazy(() => import('./EmailTile'))
const ChatTile = lazy(() => import('./ChatTile'))
const PipelineTile = lazy(() => import('./PipelineTile'))
const IndustryFeedTile = lazy(() => import('./IndustryFeedTile'))
const EbcTile = lazy(() => import('./EbcTile'))
const OuFeedbackTile = lazy(() => import('./OuFeedbackTile'))
const QuarterlyEventsTile = lazy(() => import('./QuarterlyEventsTile'))
const TerritoryTile = lazy(() => import('./TerritoryTile'))

// The GRACE-built MSX dashboard has no fixed URL — it lives in config
// (same pattern as quick_links), so fetch it fresh on click rather than
// hardcoding a guessed address.
async function openMsxDashboard() {
  const cfg = await getConfig()
  const url = safeHttpUrl(cfg.msx_dashboard_url)
  if (url) window.open(url, '_blank', 'noopener')
}

export const WIDGETS: WidgetDef[] = [
  {
    key: 'email',
    title: 'Email',
    size: 'sm',
    component: EmailTile,
    queryKeys: [['records', 'email']],
    emptyState: { icon: Mail, message: 'Nothing from your key people yet.' },
  },
  {
    key: 'chat',
    title: 'Teams chat',
    size: 'sm',
    component: ChatTile,
    queryKeys: [['records', 'chat']],
    emptyState: { icon: MessageSquare, message: 'No chats from your key people yet.' },
  },
  {
    key: 'revops',
    title: 'RevOps',
    size: 'sm',
    component: Placeholder,
    queryKeys: [['records', 'revops']],
    emptyState: { icon: TrendingUp, message: 'No revenue numbers yet. Scout will pull these from MSX.' },
  },
  {
    key: 'pipeline',
    title: 'Pipeline',
    size: 'sm',
    component: PipelineTile,
    drillDown: openMsxDashboard,
    queryKeys: [['records', 'pipeline']],
    emptyState: { icon: GitBranch, message: 'No opportunities tracked yet. Add a TPID or opportunity ID and Scout fills in the rest.' },
  },
  {
    key: 'industryFeed',
    title: 'Industry feed',
    size: 'sm',
    component: IndustryFeedTile,
    queryKeys: [['news'], ['topics']],
    emptyState: { icon: Newspaper, message: 'Nothing new in the industry yet. Scout watches email, Teams communities, and the web.' },
  },
  {
    key: 'qtrEvent',
    title: 'Quarterly events',
    size: 'sm',
    component: QuarterlyEventsTile,
    queryKeys: [['records', 'qtr_event']],
    emptyState: { icon: CalendarDays, message: 'No events on the list yet. Add your first CXO engagement.' },
  },
  {
    key: 'ouFeedback',
    title: 'OU feedback',
    size: 'sm',
    component: OuFeedbackTile,
    queryKeys: [['records', 'ou_feedback']],
    emptyState: { icon: MessageCircle, message: 'No feedback captured yet. Ask Scout to gather some when you need it.' },
  },
  {
    key: 'territory',
    title: 'Territory reviews',
    size: 'sm',
    component: TerritoryTile,
    queryKeys: [['records', 'territory']],
    emptyState: { icon: Map, message: 'No reviews on the schedule yet.' },
  },
  {
    key: 'ebc',
    title: 'EBC & Innovation Hub',
    size: 'sm',
    component: EbcTile,
    queryKeys: [['records', 'ebc']],
    emptyState: { icon: Lightbulb, message: 'No sessions booked yet. Scout will pull these from MSXI.' },
  },
]
