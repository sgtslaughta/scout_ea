import type { FeedRecent, NewsItem, LearningItem } from '@/api'

export type FeedView = 'overview' | 'trending' | 'news' | 'learning' | 'topics'
export type FeedItem = FeedRecent | NewsItem | LearningItem
export interface FeedSelection { category: string; id: number; item: FeedItem }

/** Category → SP1 ref_type for tag/link reuse. */
export const refTypeOf = (category: string): string =>
  category === 'trending' ? 'trend_finding' : category

/** content_link target_type → app route. */
export const LINK_ROUTE: Record<string, string> = { person: '/people', topic: '/feed?view=topics' }
