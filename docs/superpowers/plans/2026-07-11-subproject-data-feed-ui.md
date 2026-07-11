# SP3 — Data Feed Newsroom UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single reactive `/feed` newsroom page — category rail + context-transforming body + slide-in detail + always-on context bar / headline wire / key-people carousel — consolidating Trending, News, Learning, Topics.

**Architecture:** Bottom-up React 19 + MUI v7 components under `src/components/feed/`, composed by a viewport-filling `views/DataFeed.tsx` shell that owns one `{view, selected}` state. Reuses SP1 `TagChips`/`TagEditor`/`tagColors` and SP2 `getFeed`/`getNews`/`getLearning` fetchers. Final task swaps routing/sidebar and re-houses the existing Trending/Topics views.

**Tech Stack:** React 19, TypeScript, MUI v7 (`sx` only), MUI X DataGrid, TanStack Query, react-router v7, lucide-react, vitest + @testing-library/react.

## Global Constraints

- MUI v7: **`sx` only, no system props** (no `flexWrap`/`gap`/`direction` props on Box/Stack — put them in `sx`).
- Viewport-fill: `/feed` root is `height: calc(100vh - 48px)`, `overflow:hidden`; panes scroll internally via `minHeight:0`/`minWidth:0` on flex children. No whole-page scroll on desktop.
- Reuse SP1 `TagChips`/`TagEditor` (from `@/components/TagChips`/`TagEditor`) + SP2 api fetchers/types — no parallel data/association path.
- Theme-aware (all 5 themes, light+dark) via MUI tokens / CSS vars; chips via SP1 palette keys.
- Single `/feed` route + internal state; `/trending`→`/feed?view=trending`, `/topics`→`/feed?view=topics`; sidebar shows one **Data Feed** entry (remove Trending + Topics entries).
- `prefers-reduced-motion` respected on NewsWire, KeyPeopleCarousel, and FeedDetail transition.
- Run all FE commands from `cd frontend`. Gate every task on `npx tsc --noEmit` (vitest does NOT typecheck) + the task's vitest file. Final task also runs `npm run build`.
- Semantic commits; executes on branch `feat/data-feed-ui`.

## Shared conventions (used across tasks)

Category→refType (for SP1 tag/link reuse) and link routes:
- `refTypeOf('news')='news'`, `refTypeOf('learning')='learning'`, `refTypeOf('trending')='trend_finding'`.
- Link nav: `person`→`/people`, `topic`→`/feed?view=topics`.

`FeedView = 'overview'|'trending'|'news'|'learning'|'topics'`.
`FeedSelection = { category: string; id: number; item: FeedRecent | NewsItem | LearningItem }`.

---

### Task 1: Shared types + `FeedItemCard`

**Files:**
- Create: `frontend/src/components/feed/types.ts`
- Create: `frontend/src/components/feed/FeedItemCard.tsx`
- Test: `frontend/src/components/feed/FeedItemCard.test.tsx`

**Interfaces:**
- Consumes: SP1 `TagChips`, `@/api` `FeedRecent`/`NewsItem`/`LearningItem`/`ContentTag`/`ContentLink`; `useFriendlyTime` from `@/lib/timePrefs`.
- Produces: `FeedView`, `FeedSelection`, `refTypeOf(category)`, `LINK_ROUTE`; `<FeedItemCard item onSelect />`.

- [ ] **Step 1: Create `types.ts`**

```ts
import type { FeedRecent, NewsItem, LearningItem } from '@/api'

export type FeedView = 'overview' | 'trending' | 'news' | 'learning' | 'topics'
export type FeedItem = FeedRecent | NewsItem | LearningItem
export interface FeedSelection { category: string; id: number; item: FeedItem }

/** Category → SP1 ref_type for tag/link reuse. */
export const refTypeOf = (category: string): string =>
  category === 'trending' ? 'trend_finding' : category

/** content_link target_type → app route. */
export const LINK_ROUTE: Record<string, string> = { person: '/people', topic: '/feed?view=topics' }
```

- [ ] **Step 2: Write the failing test** — `FeedItemCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@/theme'
import { FeedItemCard } from './FeedItemCard'

const item = { category: 'news', id: 7, title: 'Agent framework 1.0', when: '2026-07-10T13:00:00',
  url: 'http://x', status: 'new', tags: [{ tag_id: 1, name: 'external', color: 'blue' }], links: [] }

function renderCard(onSelect = vi.fn()) {
  render(<ThemeProvider theme={theme} defaultMode="dark"><FeedItemCard item={item} onSelect={onSelect} /></ThemeProvider>)
  return onSelect
}

describe('FeedItemCard', () => {
  it('shows title + tag chip', () => {
    renderCard()
    expect(screen.getByText('Agent framework 1.0')).toBeInTheDocument()
    expect(screen.getByText('external')).toBeInTheDocument()
  })
  it('fires onSelect with the item on click', () => {
    const onSelect = renderCard()
    fireEvent.click(screen.getByText('Agent framework 1.0'))
    expect(onSelect).toHaveBeenCalledWith(item)
  })
})
```

- [ ] **Step 3: Run — expect failure** — `cd frontend && npx vitest run src/components/feed/FeedItemCard.test.tsx` → FAIL (module missing).

- [ ] **Step 4: Implement `FeedItemCard.tsx`**

```tsx
import { Box, Typography } from '@mui/material'
import { TagChips } from '@/components/TagChips'
import { useFriendlyTime } from '@/lib/timePrefs'
import type { FeedItem } from './types'

interface Props { item: FeedItem; onSelect: (item: FeedItem) => void }

/** Shared feed row: title + source/time + SP1 tag/link chips. Click → onSelect (opens detail). */
export function FeedItemCard({ item, onSelect }: Props) {
  const friendly = useFriendlyTime()
  const when = (item as { when?: string; event_at?: string }).when ?? (item as { event_at?: string }).event_at
  return (
    <Box
      role="button" tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(item) } }}
      sx={{
        display: 'flex', flexDirection: 'column', gap: 0.5, p: 1, borderRadius: 1, cursor: 'pointer',
        borderBottom: '1px solid', borderColor: 'divider',
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': { outline: '2px solid var(--color-accent)', outlineOffset: -2 },
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.title}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        {when && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: '"JetBrains Mono", monospace', flexShrink: 0 }}>
            {friendly(when)}
          </Typography>
        )}
        <TagChips tags={item.tags ?? []} links={item.links ?? []} />
      </Box>
    </Box>
  )
}
```

- [ ] **Step 5: Run — expect pass** — `npx tsc --noEmit && npx vitest run src/components/feed/FeedItemCard.test.tsx` → tsc clean, 2 passed.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/feed/types.ts frontend/src/components/feed/FeedItemCard.tsx frontend/src/components/feed/FeedItemCard.test.tsx
git commit -m "feat(feed): shared feed types + FeedItemCard"
```

---

### Task 2: `NewsWire` (headline ticker)

**Files:**
- Create: `frontend/src/components/feed/NewsWire.tsx`
- Test: `frontend/src/components/feed/NewsWire.test.tsx`

**Interfaces:**
- Consumes: `FeedRecent` list (headlines), `onSelect(item)`.
- Produces: `<NewsWire items onSelect />`.

- [ ] **Step 1: Write the failing test** — `NewsWire.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@/theme'
import { NewsWire } from './NewsWire'

const items = [
  { category: 'news', id: 1, title: 'Headline A', when: '2026-07-10T00:00:00', status: 'new', tags: [], links: [] },
  { category: 'trending', id: 2, title: 'Headline B', when: '2026-07-09T00:00:00', status: '', tags: [], links: [] },
]

describe('NewsWire', () => {
  it('renders headlines and fires onSelect', () => {
    const onSelect = vi.fn()
    render(<ThemeProvider theme={theme} defaultMode="dark"><NewsWire items={items} onSelect={onSelect} /></ThemeProvider>)
    fireEvent.click(screen.getByText('Headline A'))
    expect(onSelect).toHaveBeenCalledWith(items[0])
  })
  it('renders nothing when empty', () => {
    const { container } = render(<ThemeProvider theme={theme} defaultMode="dark"><NewsWire items={[]} onSelect={() => {}} /></ThemeProvider>)
    expect(container.textContent).toContain('No headlines')
  })
})
```

- [ ] **Step 2: Run — expect failure** — `npx vitest run src/components/feed/NewsWire.test.tsx` → FAIL.

- [ ] **Step 3: Implement `NewsWire.tsx`**

```tsx
import { Box, Typography } from '@mui/material'
import { Radio } from 'lucide-react'
import type { FeedRecent } from '@/api'

interface Props { items: FeedRecent[]; onSelect: (item: FeedRecent) => void }

/** Slim always-on headline ticker. Marquee on wide screens (pause on hover);
 *  reduced-motion → a static horizontally-scrollable strip. Click → detail. */
export function NewsWire({ items, onSelect }: Props) {
  return (
    <Box sx={{
      height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1, px: 1.5,
      borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden',
      '@keyframes wire': { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
    }}>
      <Radio size={14} style={{ flexShrink: 0, color: 'var(--color-accent)' }} />
      <Typography variant="caption" sx={{ flexShrink: 0, fontWeight: 700, letterSpacing: 0.5, color: 'text.secondary' }}>WIRE</Typography>
      <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', position: 'relative' }}>
        {items.length === 0 ? (
          <Typography variant="caption" color="text.secondary">No headlines yet.</Typography>
        ) : (
          <Box sx={{
            display: 'flex', gap: 3, whiteSpace: 'nowrap', width: 'max-content',
            '@media (prefers-reduced-motion: no-preference)': {
              animation: 'wire 40s linear infinite', '&:hover': { animationPlayState: 'paused' },
            },
            '@media (prefers-reduced-motion: reduce)': { overflowX: 'auto' },
          }}>
            {[...items, ...items].map((it, i) => (
              <Typography
                key={`${it.category}${it.id}-${i}`} component="span" variant="caption" role="button" tabIndex={0}
                onClick={() => onSelect(it)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSelect(it) }}
                sx={{ cursor: 'pointer', fontFamily: '"JetBrains Mono", monospace', '&:hover': { color: 'var(--color-accent)' } }}
              >
                ▪ {it.title}
              </Typography>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}
```

- [ ] **Step 4: Run — expect pass** — `npx tsc --noEmit && npx vitest run src/components/feed/NewsWire.test.tsx` → clean, 2 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/feed/NewsWire.tsx frontend/src/components/feed/NewsWire.test.tsx
git commit -m "feat(feed): NewsWire headline ticker"
```

---

### Task 3: `KeyPeopleCarousel`

**Files:**
- Create: `frontend/src/components/feed/KeyPeopleCarousel.tsx`
- Test: `frontend/src/components/feed/KeyPeopleCarousel.test.tsx`

**Interfaces:**
- Consumes: `FeedRecent[]` (recent items whose `links` include a person), `onSelect(item)`.
- Produces: `<KeyPeopleCarousel items onSelect />`. Internally derives one card per person from the items' person links.

- [ ] **Step 1: Write the failing test** — `KeyPeopleCarousel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@/theme'
import { KeyPeopleCarousel } from './KeyPeopleCarousel'

const items = [
  { category: 'news', id: 1, title: 'Ada shipped it', when: '2026-07-10T00:00:00', status: 'new',
    tags: [], links: [{ id: 9, target_type: 'person', target_id: 3, label: 'Ada' }] },
  { category: 'news', id: 2, title: 'no person here', when: '2026-07-09T00:00:00', status: 'new', tags: [], links: [] },
]

describe('KeyPeopleCarousel', () => {
  it('shows a card per person with their latest item; click fires onSelect', () => {
    const onSelect = vi.fn()
    render(<ThemeProvider theme={theme} defaultMode="dark"><KeyPeopleCarousel items={items} onSelect={onSelect} /></ThemeProvider>)
    expect(screen.getByText('Ada')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Ada shipped it'))
    expect(onSelect).toHaveBeenCalledWith(items[0])
  })
  it('renders empty-state when no person-linked items', () => {
    render(<ThemeProvider theme={theme} defaultMode="dark"><KeyPeopleCarousel items={[items[1]]} onSelect={() => {}} /></ThemeProvider>)
    expect(screen.getByText(/No key-people activity/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect failure** — FAIL (missing module).

- [ ] **Step 3: Implement `KeyPeopleCarousel.tsx`**

```tsx
import { Box, Typography, Avatar } from '@mui/material'
import type { FeedRecent } from '@/api'

interface Props { items: FeedRecent[]; onSelect: (item: FeedRecent) => void }

interface PersonCard { name: string; item: FeedRecent }

/** Latest feed item per linked person, as a horizontally-scrollable card row (no autoplay). */
export function KeyPeopleCarousel({ items, onSelect }: Props) {
  const byPerson = new Map<number, PersonCard>()
  for (const it of items) {
    for (const l of it.links ?? []) {
      if (l.target_type === 'person' && !byPerson.has(l.target_id)) {
        byPerson.set(l.target_id, { name: l.label, item: it })
      }
    }
  }
  const cards = [...byPerson.values()]
  if (cards.length === 0) {
    return <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>No key-people activity yet.</Typography>
  }
  return (
    <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { height: 6 } }}>
      {cards.map((c) => (
        <Box
          key={c.name} role="button" tabIndex={0}
          onClick={() => onSelect(c.item)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSelect(c.item) }}
          sx={{
            flexShrink: 0, width: 220, p: 1, borderRadius: 1, cursor: 'pointer',
            border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
            '&:hover': { borderColor: 'var(--color-accent)' },
            '&:focus-visible': { outline: '2px solid var(--color-accent)' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Avatar sx={{ width: 22, height: 22, fontSize: 11, bgcolor: 'var(--color-accent)' }}>{c.name.charAt(0)}</Avatar>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>{c.name}</Typography>
          </Box>
          <Typography variant="caption" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.item.title}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}
```

- [ ] **Step 4: Run — expect pass** — clean, 2 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/feed/KeyPeopleCarousel.tsx frontend/src/components/feed/KeyPeopleCarousel.test.tsx
git commit -m "feat(feed): KeyPeopleCarousel"
```

---

### Task 4: `FeedDetail` (slide-in panel)

**Files:**
- Create: `frontend/src/components/feed/FeedDetail.tsx`
- Test: `frontend/src/components/feed/FeedDetail.test.tsx`

**Interfaces:**
- Consumes: `FeedSelection` + `refTypeOf` (Task 1); SP1 `TagEditor`; SP2 `setNewsStatus`/`setLearningStatus`; TanStack `useQueryClient`.
- Produces: `<FeedDetail selection onClose />` (renders null when `selection` is null).

- [ ] **Step 1: Write the failing test** — `FeedDetail.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { theme } from '@/theme'
import { FeedDetail } from './FeedDetail'
import * as api from '@/api'

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ThemeProvider theme={theme} defaultMode="dark">{ui}</ThemeProvider></QueryClientProvider>)
}

describe('FeedDetail', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getContentRefs').mockResolvedValue({ tags: [], links: [] })
    vi.spyOn(api, 'getTags').mockResolvedValue([])
    vi.spyOn(api, 'getPeople').mockResolvedValue([])
    vi.spyOn(api, 'getTopics').mockResolvedValue([])
  })
  it('renders null with no selection', () => {
    const { container } = wrap(<FeedDetail selection={null} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
  })
  it('shows title + a status action for news; hides status for trending', () => {
    const setNews = vi.spyOn(api, 'setNewsStatus').mockResolvedValue({ updated: 1 })
    wrap(<FeedDetail selection={{ category: 'news', id: 5, item: { id: 5, title: 'N', status: 'new' } as api.NewsItem }} onClose={() => {}} />)
    expect(screen.getByText('N')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /mark read/i }))
    expect(setNews).toHaveBeenCalledWith(5, 'read')
  })
  it('no status actions for a trending item', () => {
    wrap(<FeedDetail selection={{ category: 'trending', id: 8, item: { category: 'trending', id: 8, title: 'T', when: '', status: '' } as api.FeedRecent }} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: /mark read/i })).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect failure** — FAIL.

- [ ] **Step 3: Implement `FeedDetail.tsx`**

```tsx
import { useQueryClient } from '@tanstack/react-query'
import { Box, Typography, Button, IconButton } from '@mui/material'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { setNewsStatus, setLearningStatus } from '@/api'
import { TagEditor } from '@/components/TagEditor'
import { useFriendlyTime } from '@/lib/timePrefs'
import { refTypeOf, type FeedSelection } from './types'

interface Props { selection: FeedSelection | null; onClose: () => void }

/** Slide-in detail: synopsis + SP1 TagEditor + status actions (news/learning only). */
export function FeedDetail({ selection, onClose }: Props) {
  const qc = useQueryClient()
  const friendly = useFriendlyTime()
  const open = selection !== null
  const category = selection?.category ?? ''
  const item = (selection?.item ?? {}) as Record<string, unknown>
  const canStatus = category === 'news' || category === 'learning'

  const setStatus = (status: string) => {
    if (!selection) return
    const fn = category === 'news' ? setNewsStatus : setLearningStatus
    fn(selection.id, status).then(() => {
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: [category] })
      toast.success(`Marked ${status}`)
      onClose()
    }).catch(() => toast.error('Failed to update'))
  }

  const when = (item.when as string) ?? (item.event_at as string) ?? ''

  return (
    <Box
      aria-hidden={!open}
      sx={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 360, zIndex: 5,
        bgcolor: 'background.paper', borderLeft: '1px solid', borderColor: 'divider',
        boxShadow: open ? '-8px 0 24px rgba(0,0,0,0.25)' : 'none',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 200ms ease',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >
      {selection && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{item.title as string}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: '"JetBrains Mono", monospace' }}>
                {category}{when ? ` · ${friendly(when)}` : ''}
              </Typography>
            </Box>
            <IconButton size="small" onClick={onClose} aria-label="Close detail"><X size={16} /></IconButton>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2 }}>
            {(item.synopsis as string) && <Typography variant="body2" sx={{ mb: 2 }}>{item.synopsis as string}</Typography>}
            <TagEditor refType={refTypeOf(category)} refId={selection.id} />
          </Box>
          {canStatus && (
            <Box sx={{ display: 'flex', gap: 1, p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              <Button size="small" variant="outlined" onClick={() => setStatus('read')}>Mark read</Button>
              <Button size="small" variant="outlined" onClick={() => setStatus(category === 'news' ? 'archived' : 'dismissed')}>
                {category === 'news' ? 'Archive' : 'Dismiss'}
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  )
}
```

- [ ] **Step 4: Run — expect pass** — clean, tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/feed/FeedDetail.tsx frontend/src/components/feed/FeedDetail.test.tsx
git commit -m "feat(feed): FeedDetail slide-in panel"
```

---

### Task 5: `FeedOverview` (KPI tiles + carousel + stream)

**Files:**
- Create: `frontend/src/components/feed/FeedOverview.tsx`
- Test: `frontend/src/components/feed/FeedOverview.test.tsx`

**Interfaces:**
- Consumes: SP2 `getFeed`/`FeedOverview`; Task 1 `FeedItemCard`; Task 3 `KeyPeopleCarousel`; `onSelect`.
- Produces: `<FeedOverview onSelect />` (fetches `getFeed` itself via `['feed']`).

- [ ] **Step 1: Write the failing test** — `FeedOverview.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { theme } from '@/theme'
import { FeedOverview } from './FeedOverview'
import * as api from '@/api'

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ThemeProvider theme={theme} defaultMode="dark"><FeedOverview onSelect={() => {}} /></ThemeProvider></QueryClientProvider>)
}

describe('FeedOverview', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getFeed').mockResolvedValue({
      counts: { trending: 3, news: 2, learning: 1, topics: 4 },
      recent: [{ category: 'news', id: 1, title: 'Recent one', when: '2026-07-10T00:00:00', status: 'new', tags: [], links: [] }],
    })
  })
  it('renders KPI counts and the recent stream', async () => {
    wrap()
    expect(await screen.findByText('Recent one')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()   // news count tile
  })
})
```

- [ ] **Step 2: Run — expect failure** — FAIL.

- [ ] **Step 3: Implement `FeedOverview.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { Box, Typography } from '@mui/material'
import { getFeed, type FeedRecent } from '@/api'
import { FeedItemCard } from './FeedItemCard'
import { KeyPeopleCarousel } from './KeyPeopleCarousel'

const CATS = ['trending', 'news', 'learning', 'topics'] as const

/** Front page: KPI tiles (fixed) + key-people carousel (fixed) + recent stream (scrolls). */
export function FeedOverview({ onSelect }: { onSelect: (item: FeedRecent) => void }) {
  const { data } = useQuery({ queryKey: ['feed'], queryFn: getFeed, refetchInterval: 15000 })
  const counts = data?.counts ?? {}
  const recent = data?.recent ?? []
  return (
    <Box sx={{ display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 1.5, height: '100%', minHeight: 0, p: 1.5 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
        {CATS.map((c) => (
          <Box key={c} sx={{ p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Typography sx={{ fontSize: 26, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {counts[c] ?? 0}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>{c}</Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="overline" color="text.secondary">Key people</Typography>
        <KeyPeopleCarousel items={recent} onSelect={onSelect} />
      </Box>
      <Box sx={{ minHeight: 0, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ px: 1, pt: 0.5, display: 'block' }}>Recent</Typography>
        {recent.length === 0
          ? <Typography variant="caption" color="text.secondary" sx={{ p: 1 }}>Nothing recent yet.</Typography>
          : recent.map((it) => <FeedItemCard key={`${it.category}${it.id}`} item={it} onSelect={() => onSelect(it)} />)}
      </Box>
    </Box>
  )
}
```

- [ ] **Step 4: Run — expect pass** — clean, test passes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/feed/FeedOverview.tsx frontend/src/components/feed/FeedOverview.test.tsx
git commit -m "feat(feed): FeedOverview KPI tiles + carousel + recent stream"
```

---

### Task 6: `FeedList` (news / learning category list + filters)

**Files:**
- Create: `frontend/src/components/feed/FeedList.tsx`
- Test: `frontend/src/components/feed/FeedList.test.tsx`

**Interfaces:**
- Consumes: SP2 `getNews`/`getLearning`/`FeedFilters`; Task 1 `FeedItemCard`; `onSelect`.
- Produces: `<FeedList kind="news"|"learning" onSelect />`.

- [ ] **Step 1: Write the failing test** — `FeedList.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { theme } from '@/theme'
import { FeedList } from './FeedList'
import * as api from '@/api'

function wrap(kind: 'news' | 'learning') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ThemeProvider theme={theme} defaultMode="dark"><FeedList kind={kind} onSelect={() => {}} /></ThemeProvider></QueryClientProvider>)
}

describe('FeedList', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getNews').mockResolvedValue([
      { id: 1, title: 'News row', status: 'new', tags: [], links: [] },
    ])
  })
  it('lists news rows and toggles the external origin filter', async () => {
    wrap('news')
    expect(await screen.findByText('News row')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /external/i }))
    // filter chip toggles a refetch; getNews called again with origin
    expect(api.getNews).toHaveBeenCalledWith(expect.objectContaining({ origin: 'external' }))
  })
})
```

- [ ] **Step 2: Run — expect failure** — FAIL.

- [ ] **Step 3: Implement `FeedList.tsx`**

```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Box, Chip, Typography } from '@mui/material'
import { getNews, getLearning, type FeedFilters, type NewsItem, type LearningItem } from '@/api'
import { FeedItemCard } from './FeedItemCard'
import type { FeedItem } from './types'

interface Props { kind: 'news' | 'learning'; onSelect: (item: FeedItem) => void }

const ORIGINS = ['internal', 'external'] as const

/** Category list for news/learning with origin filter chips. */
export function FeedList({ kind, onSelect }: Props) {
  const [origin, setOrigin] = useState<string | undefined>(undefined)
  const filters: FeedFilters = origin ? { origin } : {}
  const { data = [] } = useQuery({
    queryKey: [kind, filters],
    queryFn: () => (kind === 'news' ? getNews(filters) : getLearning(filters)),
    refetchInterval: 15000,
  })
  const rows = data as (NewsItem | LearningItem)[]
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ display: 'flex', gap: 0.5, p: 1, flexShrink: 0 }}>
        {ORIGINS.map((o) => (
          <Chip
            key={o} label={o} size="small" variant={origin === o ? 'filled' : 'outlined'}
            onClick={() => setOrigin(origin === o ? undefined : o)}
          />
        ))}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 0.5 }}>
        {rows.length === 0
          ? <Typography variant="caption" color="text.secondary" sx={{ p: 1 }}>Nothing here yet.</Typography>
          : rows.map((r) => <FeedItemCard key={r.id} item={r} onSelect={() => onSelect(r)} />)}
      </Box>
    </Box>
  )
}
```

- [ ] **Step 4: Run — expect pass** — clean, test passes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/feed/FeedList.tsx frontend/src/components/feed/FeedList.test.tsx
git commit -m "feat(feed): FeedList news/learning list with origin filter"
```

---

### Task 7: Re-house Trending + Topics as feed sub-views

**Files:**
- Create: `frontend/src/components/feed/FeedTrending.tsx` (moves the `views/Trending.tsx` grid body)
- Create: `frontend/src/components/feed/FeedTopics.tsx` (moves the `views/Topics.tsx` CRUD body)
- Test: `frontend/src/components/feed/FeedTrending.test.tsx`, `FeedTopics.test.tsx`

**Interfaces:**
- Produces: `<FeedTrending />`, `<FeedTopics />` — self-contained (own queries), no props. Same data/logic as the current views, minus the outer page chrome (they now fill a pane: root `Box` `height:100%, minHeight:0, overflow:auto`, no `maxWidth`/`p:6` centering).

- [ ] **Step 1: Write the failing tests** — `FeedTrending.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { theme } from '@/theme'
import { FeedTrending } from './FeedTrending'
import * as api from '@/api'

describe('FeedTrending', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getTrends').mockResolvedValue([
      { id: 1, term: 'agents', kind: 'topic', window_start: 'w', window_end: 'w', score: 2.5 },
    ])
  })
  it('renders the trend term', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><ThemeProvider theme={theme} defaultMode="dark"><MemoryRouter><FeedTrending /></MemoryRouter></ThemeProvider></QueryClientProvider>)
    expect(await screen.findByText('agents')).toBeInTheDocument()
  })
})
```

`FeedTopics.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { theme } from '@/theme'
import { FeedTopics } from './FeedTopics'
import * as api from '@/api'

describe('FeedTopics', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getTopics').mockResolvedValue([
      { id: 1, name: 'AI agents', priority: 2, max_suggest: 5, active: 1 },
    ])
  })
  it('renders a topic and an Add control', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><ThemeProvider theme={theme} defaultMode="dark"><MemoryRouter><FeedTopics /></MemoryRouter></ThemeProvider></QueryClientProvider>)
    expect(await screen.findByText('AI agents')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add topic/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect failure** — FAIL (modules missing).

- [ ] **Step 3: Create the sub-views** — copy the body of `views/Trending.tsx` into `FeedTrending.tsx` and `views/Topics.tsx` into `FeedTopics.tsx`, renaming the exported function to `FeedTrending`/`FeedTopics` and changing the outer container so it fills a pane instead of centering a page. Replace the outer `<Box component="main" sx={{ flex:1, overflowY:'auto', p:6, ... }}><Box sx={{ maxWidth:'1080px', mx:'auto', ... }}>` wrapper with a single pane container:

```tsx
// FeedTrending.tsx / FeedTopics.tsx outer container
<Box sx={{ height: '100%', minHeight: 0, overflowY: 'auto', p: 2 }}>
  {/* ...existing header + chips + DataGrid / dialogs, unchanged... */}
</Box>
```

Keep every query, mutation, column, dialog, and the `useSearchParams`-driven filter chips exactly as in the originals — only the outer chrome changes and the function name. (The DataGrid, Topics add/edit/delete dialogs, toasts, and error/empty states are preserved verbatim.)

- [ ] **Step 4: Run — expect pass** — `npx tsc --noEmit && npx vitest run src/components/feed/FeedTrending.test.tsx src/components/feed/FeedTopics.test.tsx` → clean, both pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/feed/FeedTrending.tsx frontend/src/components/feed/FeedTopics.tsx frontend/src/components/feed/FeedTrending.test.tsx frontend/src/components/feed/FeedTopics.test.tsx
git commit -m "feat(feed): re-house Trending grid + Topics CRUD as feed sub-views"
```

---

### Task 8: `FeedRail` + `FeedContextBar`

**Files:**
- Create: `frontend/src/components/feed/FeedRail.tsx`
- Create: `frontend/src/components/feed/FeedContextBar.tsx`
- Test: `frontend/src/components/feed/FeedRail.test.tsx`

**Interfaces:**
- Consumes: Task 1 `FeedView`.
- Produces: `<FeedRail view onView />`, `<FeedContextBar view onRefresh />`.

- [ ] **Step 1: Write the failing test** — `FeedRail.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@/theme'
import { FeedRail } from './FeedRail'

describe('FeedRail', () => {
  it('lists the five views and reports clicks', () => {
    const onView = vi.fn()
    render(<ThemeProvider theme={theme} defaultMode="dark"><FeedRail view="overview" onView={onView} /></ThemeProvider>)
    fireEvent.click(screen.getByRole('button', { name: /news/i }))
    expect(onView).toHaveBeenCalledWith('news')
  })
})
```

- [ ] **Step 2: Run — expect failure** — FAIL.

- [ ] **Step 3: Implement `FeedRail.tsx`**

```tsx
import { Box, Typography } from '@mui/material'
import { LayoutGrid, TrendingUp, Newspaper, GraduationCap, Hash } from 'lucide-react'
import type { FeedView } from './types'

const ITEMS: { id: FeedView; label: string; Icon: typeof Hash }[] = [
  { id: 'overview', label: 'Overview', Icon: LayoutGrid },
  { id: 'trending', label: 'Trending', Icon: TrendingUp },
  { id: 'news', label: 'News', Icon: Newspaper },
  { id: 'learning', label: 'Learning', Icon: GraduationCap },
  { id: 'topics', label: 'Topics', Icon: Hash },
]

export function FeedRail({ view, onView }: { view: FeedView; onView: (v: FeedView) => void }) {
  return (
    <Box component="nav" aria-label="Data feed sections" sx={{ width: 150, flexShrink: 0, borderRight: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', py: 1, bgcolor: 'background.paper' }}>
      {ITEMS.map(({ id, label, Icon }) => {
        const active = view === id
        return (
          <Box
            key={id} role="button" tabIndex={0} aria-current={active} aria-label={label}
            onClick={() => onView(id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView(id) } }}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, cursor: 'pointer',
              color: active ? 'var(--color-accent)' : 'text.primary',
              borderLeft: '2px solid', borderColor: active ? 'var(--color-accent)' : 'transparent',
              bgcolor: active ? 'action.selected' : 'transparent',
              '&:hover': { bgcolor: 'action.hover' },
              '&:focus-visible': { outline: '2px solid var(--color-accent)', outlineOffset: -2 },
            }}
          >
            <Icon size={16} />
            <Typography variant="body2" sx={{ fontWeight: active ? 700 : 400 }}>{label}</Typography>
          </Box>
        )
      })}
    </Box>
  )
}
```

- [ ] **Step 4: Implement `FeedContextBar.tsx`**

```tsx
import { Box, Typography, Button } from '@mui/material'
import { RefreshCw } from 'lucide-react'
import type { FeedView } from './types'

const TITLE: Record<FeedView, string> = {
  overview: 'Overview', trending: 'Trending', news: 'News', learning: 'Learning', topics: 'Topics',
}

/** Thin masthead: current view title + a context refresh. (View-specific actions live in
 *  each body; this bar carries the always-present refresh + title.) */
export function FeedContextBar({ view, onRefresh }: { view: FeedView; onRefresh: () => void }) {
  return (
    <Box sx={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1, px: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{TITLE[view]}</Typography>
      <Box sx={{ flex: 1 }} />
      <Button size="small" variant="outlined" startIcon={<RefreshCw size={14} />} onClick={onRefresh} aria-label="Refresh feed">
        Refresh
      </Button>
    </Box>
  )
}
```

- [ ] **Step 5: Run — expect pass** — `npx tsc --noEmit && npx vitest run src/components/feed/FeedRail.test.tsx` → clean, passes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/feed/FeedRail.tsx frontend/src/components/feed/FeedContextBar.tsx frontend/src/components/feed/FeedRail.test.tsx
git commit -m "feat(feed): FeedRail + FeedContextBar"
```

---

### Task 9: `DataFeed` shell (viewport-fill, state, ?view=)

**Files:**
- Create: `frontend/src/views/DataFeed.tsx`
- Test: `frontend/src/views/DataFeed.test.tsx`

**Interfaces:**
- Consumes: all Tasks 1–8 components; `getFeed` (for the Wire headlines); `useSearchParams`; `useQueryClient`.
- Produces: `export function DataFeedView()`.

- [ ] **Step 1: Write the failing test** — `DataFeed.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { theme } from '@/theme'
import { DataFeedView } from './DataFeed'
import * as api from '@/api'

function wrap(initialEntry = '/feed') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}><ThemeProvider theme={theme} defaultMode="dark">
      <MemoryRouter initialEntries={[initialEntry]}><DataFeedView /></MemoryRouter>
    </ThemeProvider></QueryClientProvider>,
  )
}

describe('DataFeed shell', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getFeed').mockResolvedValue({ counts: { trending: 0, news: 0, learning: 0, topics: 0 }, recent: [] })
    vi.spyOn(api, 'getNews').mockResolvedValue([])
    vi.spyOn(api, 'getLearning').mockResolvedValue([])
    vi.spyOn(api, 'getTrends').mockResolvedValue([])
    vi.spyOn(api, 'getTopics').mockResolvedValue([])
  })
  it('starts on overview and switches view via the rail', async () => {
    wrap()
    expect(await screen.findByText('Overview')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^news$/i }))
    // context bar title updates to News
    expect(screen.getAllByText('News').length).toBeGreaterThan(0)
  })
  it('honours ?view=trending on mount', async () => {
    wrap('/feed?view=trending')
    // rail marks Trending active (aria-current)
    expect(screen.getByRole('button', { name: /trending/i })).toHaveAttribute('aria-current', 'true')
  })
})
```

- [ ] **Step 2: Run — expect failure** — FAIL.

- [ ] **Step 3: Implement `DataFeed.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Box } from '@mui/material'
import { getFeed } from '@/api'
import { FeedContextBar } from '@/components/feed/FeedContextBar'
import { NewsWire } from '@/components/feed/NewsWire'
import { FeedRail } from '@/components/feed/FeedRail'
import { FeedOverview } from '@/components/feed/FeedOverview'
import { FeedList } from '@/components/feed/FeedList'
import { FeedTrending } from '@/components/feed/FeedTrending'
import { FeedTopics } from '@/components/feed/FeedTopics'
import { FeedDetail } from '@/components/feed/FeedDetail'
import type { FeedView, FeedItem, FeedSelection } from '@/components/feed/types'

const VIEWS: FeedView[] = ['overview', 'trending', 'news', 'learning', 'topics']

export function DataFeedView() {
  const [params] = useSearchParams()
  const qc = useQueryClient()
  const initial = (params.get('view') as FeedView) ?? 'overview'
  const [view, setView] = useState<FeedView>(VIEWS.includes(initial) ? initial : 'overview')
  const [selection, setSelection] = useState<FeedSelection | null>(null)

  const { data: feed } = useQuery({ queryKey: ['feed'], queryFn: getFeed, refetchInterval: 15000 })
  const headlines = useMemo(
    () => (feed?.recent ?? []).filter((r) => r.category === 'news' || r.category === 'trending'),
    [feed],
  )

  const select = (category: string) => (item: FeedItem) =>
    setSelection({ category, id: (item as { id: number }).id, item })

  const refresh = () => qc.invalidateQueries({ queryKey: ['feed'] })

  return (
    <Box sx={{ height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <FeedContextBar view={view} onRefresh={refresh} />
      <NewsWire items={headlines} onSelect={(it) => setSelection({ category: it.category, id: it.id, item: it })} />
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative' }}>
        <FeedRail view={view} onView={(v) => { setView(v); setSelection(null) }} />
        <Box sx={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
          {view === 'overview' && <FeedOverview onSelect={select('news')} />}
          {view === 'news' && <FeedList kind="news" onSelect={select('news')} />}
          {view === 'learning' && <FeedList kind="learning" onSelect={select('learning')} />}
          {view === 'trending' && <FeedTrending />}
          {view === 'topics' && <FeedTopics />}
          <FeedDetail selection={selection} onClose={() => setSelection(null)} />
        </Box>
      </Box>
    </Box>
  )
}
```

Note: overview/news/learning items open the detail; trending/topics render their own grids (their rows don't open the slide detail — they keep their existing in-grid interactions). `select(category)` stamps the correct category so `FeedDetail` uses the right `refType` + status actions.

- [ ] **Step 4: Run — expect pass** — `npx tsc --noEmit && npx vitest run src/views/DataFeed.test.tsx` → clean, passes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/DataFeed.tsx frontend/src/views/DataFeed.test.tsx
git commit -m "feat(feed): DataFeed shell — viewport-fill, view state, ?view= seed"
```

---

### Task 10: Routing + sidebar fold-in cutover

**Files:**
- Modify: `frontend/src/App.tsx` (lazy import + `/feed` route + redirects; remove `/trending`,`/topics` view routes)
- Modify: `frontend/src/components/Sidebar.tsx` (swap Trending+Topics for Data Feed)
- Modify: `frontend/src/components/CommandPalette.tsx` (`KIND_VIEW` trend/topic → feed)
- Delete: `frontend/src/views/Trending.tsx`, `frontend/src/views/Topics.tsx` and their test files (logic now lives in feed sub-views)
- Modify: any test asserting the old Trending/Topics routes or sidebar entries

**Interfaces:** Consumes Task 9 `DataFeedView`. This is the cutover — do it as one task so nav is never half-swapped.

- [ ] **Step 1: Update `App.tsx`** — replace the Trending/Topics lazy imports + routes:

Add the lazy import (with the others):
```tsx
const DataFeedView = lazy(() => import('@/views/DataFeed').then(m => ({ default: m.DataFeedView })))
```
Remove the `TrendingView` and `TopicsView` lazy imports. Replace the two routes and add redirects:
```tsx
                    <Route path="/feed" element={<DataFeedView />} />
                    <Route path="/trending" element={<Navigate to="/feed?view=trending" replace />} />
                    <Route path="/topics" element={<Navigate to="/feed?view=topics" replace />} />
```
(Delete the old `<Route path="/trending" element={<TrendingView />} />` and `<Route path="/topics" element={<TopicsView />} />` lines.)

- [ ] **Step 2: Update `Sidebar.tsx`** — in `SIDEBAR_ITEMS`, remove the `trending` and `topics` entries and add one Data Feed entry; import `Newspaper` from lucide-react (drop now-unused `TrendingUp`/`Hash` only if no longer referenced elsewhere in the file):
```tsx
  { id: 'feed', route: '/feed', icon: Newspaper, label: 'Data Feed' },
```
Place it where Trending was (after Calendar).

- [ ] **Step 3: Update `CommandPalette.tsx`** — change the `KIND_VIEW` map so trend/topic land in the feed (the App `onViewChange` prepends `/`, so the value must be `feed?view=…`):
```tsx
const KIND_VIEW: Record<string, string> = {
  task: 'tasks', signal: 'inbox', deadline: 'deadlines', event: 'calendar',
  person: 'people', topic: 'feed?view=topics', trend: 'feed?view=trending',
}
```

- [ ] **Step 4: Delete the old view files**

```bash
git rm frontend/src/views/Trending.tsx frontend/src/views/Topics.tsx frontend/src/views/Trending.test.tsx frontend/src/views/Topics.test.tsx
```

- [ ] **Step 5: Fix affected tests** — update `App.routes.test` (or equivalent) and `Sidebar.test` so they:
  - expect a **Data Feed** nav entry and NOT Trending/Topics entries,
  - expect `/trending` and `/topics` to redirect into `/feed` (assert the feed renders, e.g. the rail's Overview button appears). If a routing test enumerates routes, replace `/trending`/`/topics` with `/feed`.

Run the full FE suite to find every breakage: `npx vitest run` and fix each assertion that referenced the removed views/routes/sidebar items (do not weaken assertions — update them to the new nav).

- [ ] **Step 6: Full verify**

Run: `cd frontend && npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean, all tests pass, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A frontend/src
git commit -m "refactor(feed): route /feed + redirects, sidebar Data Feed, retire Trending/Topics views"
```

---

## Self-Review

**Spec coverage:** viewport-fill shell (T9, root `overflow:hidden` + `min-height:0`) ✓; 5 zones — ContextBar (T8), NewsWire (T2), FeedRail (T8), body Overview/List/Trending/Topics (T5/T6/T7), FeedDetail (T4) ✓; KeyPeopleCarousel (T3) ✓; FeedItemCard shared card (T1) ✓; single `/feed` route + `?view=` seed (T9) + redirects (T10) ✓; sidebar one Data Feed entry (T10) ✓; Topics full CRUD inline (T7) ✓; detail read+status+TagEditor, status gated to news/learning (T4) ✓; SP1 TagChips/TagEditor + SP2 fetchers reuse (T1/T4/T5/T6) ✓; reduced-motion on Wire/carousel/detail (T2/T3/T4) ✓; theme-aware via tokens/palette keys ✓; test matrix per task + full-suite cutover (T10) ✓. Deferred items (per-person threads, manual create) correctly out.

**Placeholder scan:** every code step carries full component code; T7 re-house references the exact originals to copy with the one container change spelled out; no "add styling"/TBD. Clean.

**Type consistency:** `FeedView`/`FeedSelection`/`refTypeOf`/`FeedItem` defined in T1 `types.ts`, imported unchanged by T4/T5/T6/T8/T9. `onSelect(item)` signature consistent across FeedItemCard/NewsWire/Carousel/List → shell's `select(category)`. `FeedDetail` props `{selection, onClose}` match T9's usage. `getFeed`/`getNews`/`getLearning`/`setNewsStatus`/`setLearningStatus`/`FeedFilters`/`FeedOverview`/`NewsItem`/`LearningItem`/`FeedRecent` all from SP2 api.ts (shipped). `KIND_VIEW` value `feed?view=…` composes with App's `'/' + id` → `/feed?view=…`. Consistent.
