# Quickdraw Action Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the read-only right drawer (`RightDrawer.tsx`) into **Quickdraw** — a desktop-only action panel with 3 collapsible sections (Needs Response / Approaching / Recent Activity), inline quick-actions, a horizontally-expandable morph, and a restrained gunslinger identity. Frontend-only.

**Architecture:** A thin shell (`Quickdraw.tsx`) renders three section components, each owning its own TanStack query and mapping domain rows to a shared `QuickdrawItem`. Pure data-shaping lives in `quickdrawData.ts`; persisted UI prefs (expanded width, collapsed sections) in `useQuickdrawPrefs.ts`. Actions ride existing endpoints: status changes via `setSignalStatus(table,id,status)`; "take action" via `?focus=id` deep-links; reply/take-action compose is a UI stub (`ActionComposeModal`, toast only). No new backend.

**Tech Stack:** React 19, TypeScript, MUI v7 (`sx` only), TanStack Query, react-router v7, lucide-react, sonner (toast), vitest + @testing-library/react.

## Global Constraints

- MUI v7: **`sx` only, NO system props** (no `flexWrap`/`gap`/`direction` props on Box/Stack). lucide-react icons take `style`/`size`, never `sx`.
- Theme-aware across all 5 themes (light+dark) via existing tokens: `var(--color-accent)`, `"JetBrains Mono", monospace`, palette `*-mainChannel` CSS vars.
- Reuse existing endpoints/fetchers, `lib/horizon.ts` urgency helpers, `TimelineTypeChip`, and `?focus=id` deep-links. No new backend, no parallel data paths.
- Quickdraw is desktop-only: it mounts inside `App.tsx`'s `Box sx={{ display: { xs: 'none', lg: 'flex' } }}` — unchanged.
- Status values: **silence → `'read'`**, **dismiss/remove → `'dismissed'`** (via generic `POST /api/{table}/{id}/status`, table-whitelisted: signals, tasks, alerts, events).
- Gunslinger nod stays restrained: title `QUICKDRAW` + `Crosshair` glyph + empty-state micro-copy only. No audio, no gimmick animation.
- Each new file under ~200 lines. `prefers-reduced-motion` respected on expand/collapse.
- `npx tsc --noEmit`, `npx vitest run`, `npx vite build` green before each commit. Semantic commits. Branch → verify → merge (no-ff). Verify served bundle on `:8765`.
- All frontend commands run from `/home/user/code/Scout_EA/frontend`.

---

### Task 1: API types & alerts fetcher

**Files:**
- Modify: `frontend/src/api.ts` (extend `Signal` interface ~line 53; add `Alert` interface + `getAlerts` fetcher near `getSignals` ~line 163)
- Test: `frontend/src/api.quickdraw.test.ts` (create)

**Interfaces:**
- Produces:
  - `interface Alert { id: number; severity: string; title: string; body?: string; url?: string; source_table?: string; source_id?: number; status: string; created_at: string }`
  - `getAlerts: () => Promise<Alert[]>` — GET `/api/alerts`
  - `Signal` gains optional detail fields: `summary?: string; who?: string; what?: string; when_rel?: string; why?: string; url?: string; person_id?: number`
  - Reused existing (do NOT redefine): `getSignals(status?: string) => Promise<Signal[]>`, `setSignalStatus(table: string, id: number, status: string) => Promise<{updated:number}>`, `getActivity(limit?: number) => Promise<Activity[]>`, `getDeadlines(includeHidden?: boolean) => Promise<Deadline[]>`, `getTasks() => Promise<Task[]>`, `getEvents() => Promise<EventItem[]>`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/api.quickdraw.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { getAlerts } from './api'

afterEach(() => vi.restoreAllMocks())

describe('getAlerts', () => {
  it('GETs /api/alerts and returns the rows', async () => {
    const rows = [{ id: 1, severity: 'critical', title: 'Disk full', status: 'unread', created_at: '2026-07-11T10:00:00Z' }]
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    const out = await getAlerts()
    expect(spy).toHaveBeenCalledWith('/api/alerts', expect.anything())
    expect(out[0].title).toBe('Disk full')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/api.quickdraw.test.ts`
Expected: FAIL — `getAlerts` is not exported.

- [ ] **Step 3: Implement**

In `frontend/src/api.ts`, extend the existing `Signal` interface (add the optional fields to its body):

```ts
export interface Signal {
  id: number
  type: string
  source: string
  source_skill?: string
  title: string
  status: string
  priority: number
  created_at: string
  external_ref?: string
  // detail (present from SELECT *; used by Quickdraw expanded rows)
  summary?: string
  who?: string
  what?: string
  when_rel?: string
  why?: string
  url?: string
  person_id?: number
}
```

Add near `getSignals` (the fetcher uses the same `fetchJson` helper the file already defines):

```ts
export interface Alert {
  id: number
  severity: string
  title: string
  body?: string
  url?: string
  source_table?: string
  source_id?: number
  status: string
  created_at: string
}

export const getAlerts = () => fetchJson<Alert[]>('/api/alerts')
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/api.quickdraw.test.ts` → PASS
Run: `npx tsc --noEmit` → clean

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.ts frontend/src/api.quickdraw.test.ts
git commit -m "feat(quickdraw): Alert type + getAlerts fetcher; extend Signal detail fields"
```

---

### Task 2: `useQuickdrawPrefs` — persisted expand + collapse state

**Files:**
- Create: `frontend/src/components/quickdraw/useQuickdrawPrefs.ts`
- Test: `frontend/src/components/quickdraw/useQuickdrawPrefs.test.tsx`

**Interfaces:**
- Produces:
  - `useQuickdrawPrefs(): { expanded: boolean; toggleExpanded: () => void; isCollapsed: (id: string) => boolean; toggleSection: (id: string) => void }`
  - localStorage keys: `ea-quickdraw-expanded` (`"1"`/`"0"`), `ea-quickdraw-collapsed` (JSON string array of section ids).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/quickdraw/useQuickdrawPrefs.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useQuickdrawPrefs } from './useQuickdrawPrefs'

beforeEach(() => localStorage.clear())

describe('useQuickdrawPrefs', () => {
  it('defaults: not expanded, no section collapsed', () => {
    const { result } = renderHook(() => useQuickdrawPrefs())
    expect(result.current.expanded).toBe(false)
    expect(result.current.isCollapsed('needs')).toBe(false)
  })

  it('persists expanded across remounts', () => {
    const first = renderHook(() => useQuickdrawPrefs())
    act(() => first.result.current.toggleExpanded())
    expect(first.result.current.expanded).toBe(true)
    const second = renderHook(() => useQuickdrawPrefs())
    expect(second.result.current.expanded).toBe(true)
  })

  it('persists collapsed section set', () => {
    const first = renderHook(() => useQuickdrawPrefs())
    act(() => first.result.current.toggleSection('recent'))
    expect(first.result.current.isCollapsed('recent')).toBe(true)
    const second = renderHook(() => useQuickdrawPrefs())
    expect(second.result.current.isCollapsed('recent')).toBe(true)
    expect(second.result.current.isCollapsed('needs')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/quickdraw/useQuickdrawPrefs.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// frontend/src/components/quickdraw/useQuickdrawPrefs.ts
import { useState, useCallback } from 'react'

const EXPANDED_KEY = 'ea-quickdraw-expanded'
const COLLAPSED_KEY = 'ea-quickdraw-collapsed'

function readCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch { return new Set() }
}

export function useQuickdrawPrefs() {
  const [expanded, setExpanded] = useState(() => localStorage.getItem(EXPANDED_KEY) === '1')
  const [collapsed, setCollapsed] = useState<Set<string>>(readCollapsed)

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev
      localStorage.setItem(EXPANDED_KEY, next ? '1' : '0')
      return next
    })
  }, [])

  const toggleSection = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])

  const isCollapsed = useCallback((id: string) => collapsed.has(id), [collapsed])

  return { expanded, toggleExpanded, isCollapsed, toggleSection }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/quickdraw/useQuickdrawPrefs.test.tsx` → PASS
Run: `npx tsc --noEmit` → clean

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/quickdraw/useQuickdrawPrefs.ts frontend/src/components/quickdraw/useQuickdrawPrefs.test.tsx
git commit -m "feat(quickdraw): persisted expand + section-collapse prefs hook"
```

---

### Task 3: `quickdrawData` — pure data shaping

**Files:**
- Create: `frontend/src/components/quickdraw/quickdrawData.ts`
- Test: `frontend/src/components/quickdraw/quickdrawData.test.ts`

**Interfaces:**
- Consumes: `Signal`, `Alert`, `Deadline`, `Task`, `EventItem` from `@/api`; `Urgency`, `urgencyOf` from `@/lib/horizon`.
- Produces:
  - `type ApproachItem = { key: string; id: number; title: string; when: string; type: 'deadline' | 'task' | 'event'; seconds: number; urgency: Urgency }`
  - `type ResponseItem = { key: string; kind: 'signal' | 'alert'; id: number; title: string; detail: string; url?: string; rank: number }`
  - `formatCountdown(seconds: number): string` — `<=0` → `'now'`; else `'2h 5m'` / `'45m'`.
  - `URGENCY_CHIP: Record<Urgency, 'error' | 'warning' | 'info' | 'default'>`
  - `buildApproaching(deadlines: Deadline[], tasks: Task[], events: EventItem[], now: Date): ApproachItem[]` — items due within 24h (`seconds <= 86400`, includes overdue negatives), sorted ascending by `seconds` (most overdue / soonest first). Tasks excluded when `status` is `'done'`/`'dismissed'`; events require `chosen_time`.
  - `buildNeedsResponse(signals: Signal[], alerts: Alert[]): ResponseItem[]` — signals mapped with `rank = priority` (lower = higher priority; treat missing as 3), alerts mapped with `rank = severity==='critical' ? 0 : severity==='warning' ? 1 : 2`. Sorted ascending by `rank`, then original order. `detail` = signal `summary`/`what`/`why` (first non-empty) or `''`; alert `body ?? ''`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/components/quickdraw/quickdrawData.test.ts
import { describe, it, expect } from 'vitest'
import { buildApproaching, buildNeedsResponse, formatCountdown, URGENCY_CHIP } from './quickdrawData'
import type { Deadline, Task, EventItem, Signal, Alert } from '@/api'

const now = new Date('2026-07-11T12:00:00Z')
const iso = (ms: number) => new Date(now.getTime() + ms).toISOString()

function dl(p: Partial<Deadline>): Deadline {
  return { id: 1, title: 'D', due_at: iso(3600_000), countdown_seconds: 3600, detail: '', source: 'manual', status: 'open', visible: 1, ...p }
}

describe('formatCountdown', () => {
  it('overdue → now', () => expect(formatCountdown(0)).toBe('now'))
  it('mins only', () => expect(formatCountdown(45 * 60)).toBe('45m'))
  it('hours + mins', () => expect(formatCountdown(2 * 3600 + 5 * 60)).toBe('2h 5m'))
})

describe('buildApproaching', () => {
  it('keeps items within 24h, sorts soonest first, drops done tasks and far items', () => {
    const deadlines = [dl({ id: 1, countdown_seconds: 7200, due_at: iso(7200_000) }), dl({ id: 2, countdown_seconds: 200000, due_at: iso(200000_000) })]
    const tasks: Task[] = [
      { id: 5, title: 'soon task', due_at: iso(1800_000), priority: 2, status: 'open' },
      { id: 6, title: 'done task', due_at: iso(600_000), priority: 2, status: 'done' },
    ]
    const events: EventItem[] = [{ id: 9, title: 'mtg', chosen_time: iso(3600_000), status: 'confirmed' }]
    const out = buildApproaching(deadlines, tasks, events, now)
    expect(out.map((i) => i.key)).toEqual(['t5', 'e9', 'd1']) // 1800s, 3600s, 7200s
    expect(out.find((i) => i.id === 2)).toBeUndefined() // >24h dropped
    expect(out.find((i) => i.title === 'done task')).toBeUndefined()
  })
})

describe('buildNeedsResponse', () => {
  it('merges signals + alerts ranked by priority/severity', () => {
    const signals: Signal[] = [{ id: 1, type: 'email', source: 'inbox', title: 'lo', status: 'new', priority: 5, created_at: '', summary: 'sum' }]
    const alerts: Alert[] = [{ id: 2, severity: 'critical', title: 'hi', status: 'unread', created_at: '', body: 'boom' }]
    const out = buildNeedsResponse(signals, alerts)
    expect(out[0].kind).toBe('alert') // rank 0 < 5
    expect(out[0].detail).toBe('boom')
    expect(out[1].detail).toBe('sum')
  })
})

describe('URGENCY_CHIP', () => {
  it('maps every urgency tier', () => {
    expect(URGENCY_CHIP.critical).toBe('error')
    expect(URGENCY_CHIP.normal).toBe('default')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/quickdraw/quickdrawData.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// frontend/src/components/quickdraw/quickdrawData.ts
import type { Deadline, Task, EventItem, Signal, Alert } from '@/api'
import { urgencyOf, type Urgency } from '@/lib/horizon'

export interface ApproachItem {
  key: string; id: number; title: string; when: string
  type: 'deadline' | 'task' | 'event'; seconds: number; urgency: Urgency
}

export interface ResponseItem {
  key: string; kind: 'signal' | 'alert'; id: number
  title: string; detail: string; url?: string; rank: number
}

export const URGENCY_CHIP: Record<Urgency, 'error' | 'warning' | 'info' | 'default'> = {
  critical: 'error', urgent: 'error', soon: 'warning', normal: 'default',
}

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'now'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const HORIZON = 86400 // 24h window for "approaching"

export function buildApproaching(deadlines: Deadline[], tasks: Task[], events: EventItem[], now: Date): ApproachItem[] {
  const nowMs = now.getTime()
  const secs = (iso: string) => Math.floor((new Date(iso).getTime() - nowMs) / 1000)
  const out: ApproachItem[] = []
  for (const d of deadlines) {
    out.push({ key: `d${d.id}`, id: d.id, title: d.title, when: d.due_at, type: 'deadline', seconds: d.countdown_seconds, urgency: urgencyOf(d.countdown_seconds) })
  }
  for (const t of tasks) {
    if (!t.due_at || t.status === 'done' || t.status === 'dismissed') continue
    const s = secs(t.due_at)
    out.push({ key: `t${t.id}`, id: t.id, title: t.title, when: t.due_at, type: 'task', seconds: s, urgency: urgencyOf(s) })
  }
  for (const e of events) {
    if (!e.chosen_time) continue
    const s = secs(e.chosen_time)
    out.push({ key: `e${e.id}`, id: e.id, title: e.title, when: e.chosen_time, type: 'event', seconds: s, urgency: urgencyOf(s) })
  }
  return out.filter((i) => i.seconds <= HORIZON).sort((a, b) => a.seconds - b.seconds)
}

const alertRank = (severity: string) => severity === 'critical' ? 0 : severity === 'warning' ? 1 : 2

export function buildNeedsResponse(signals: Signal[], alerts: Alert[]): ResponseItem[] {
  const out: ResponseItem[] = []
  for (const s of signals) {
    out.push({
      key: `s${s.id}`, kind: 'signal', id: s.id, title: s.title,
      detail: s.summary || s.what || s.why || '', url: s.url, rank: s.priority ?? 3,
    })
  }
  for (const a of alerts) {
    out.push({ key: `a${a.id}`, kind: 'alert', id: a.id, title: a.title, detail: a.body ?? '', url: a.url, rank: alertRank(a.severity) })
  }
  return out.sort((x, y) => x.rank - y.rank)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/quickdraw/quickdrawData.test.ts` → PASS
Run: `npx tsc --noEmit` → clean

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/quickdraw/quickdrawData.ts frontend/src/components/quickdraw/quickdrawData.test.ts
git commit -m "feat(quickdraw): pure data shaping (approaching + needs-response + countdown)"
```

---

### Task 4: `ActionComposeModal` — stub gist composer

**Files:**
- Create: `frontend/src/components/quickdraw/ActionComposeModal.tsx`
- Test: `frontend/src/components/quickdraw/ActionComposeModal.test.tsx`

**Interfaces:**
- Consumes: `sonner` `toast`.
- Produces: `ActionComposeModal({ open, title, onClose }: { open: boolean; title: string; onClose: () => void })`. On submit: fire `toast.success('Queued for the response skill — coming soon')`, call `onClose()`, make **no** network call. `title` names the item being acted on (shown in the dialog).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/quickdraw/ActionComposeModal.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../../theme'
import { ActionComposeModal } from './ActionComposeModal'

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))
import { toast } from 'sonner'

afterEach(() => vi.clearAllMocks())

function renderModal(onClose = vi.fn()) {
  render(
    <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">
      <ActionComposeModal open title="Reply to: Budget question" onClose={onClose} />
    </ThemeProvider>,
  )
  return onClose
}

describe('ActionComposeModal', () => {
  it('submit fires a toast, closes, makes no network call', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const onClose = renderModal()
    fireEvent.change(screen.getByLabelText(/what should happen/i), { target: { value: 'draft a polite decline' } })
    fireEvent.click(screen.getByRole('button', { name: /queue/i }))
    expect(toast.success).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/quickdraw/ActionComposeModal.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// frontend/src/components/quickdraw/ActionComposeModal.tsx
import { useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Typography } from '@mui/material'
import { toast } from 'sonner'

// ponytail: FE stub. When the response-actions skill lands, POST this gist to the
// future /api/action-requests table instead of only toasting.
export function ActionComposeModal({ open, title, onClose }: { open: boolean; title: string; onClose: () => void }) {
  const [gist, setGist] = useState('')
  const submit = () => {
    toast.success('Queued for the response skill — coming soon')
    setGist('')
    onClose()
  }
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontFamily: '"JetBrains Mono", monospace' }}>{title}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Describe what you want done. An upcoming skill will pick this up and draft it.
        </Typography>
        <TextField
          label="What should happen?" value={gist} onChange={(e) => setGist(e.target.value)}
          autoFocus multiline rows={4} fullWidth
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!gist.trim()}>Queue it</Button>
      </DialogActions>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/quickdraw/ActionComposeModal.test.tsx` → PASS
Run: `npx tsc --noEmit` → clean

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/quickdraw/ActionComposeModal.tsx frontend/src/components/quickdraw/ActionComposeModal.test.tsx
git commit -m "feat(quickdraw): stub action-compose modal (toast, no backend yet)"
```

---

### Task 5: `QuickdrawItem` — row with inline/menu actions + confirm

**Files:**
- Create: `frontend/src/components/quickdraw/QuickdrawItem.tsx`
- Test: `frontend/src/components/quickdraw/QuickdrawItem.test.tsx`

**Interfaces:**
- Consumes: MUI, lucide-react.
- Produces:
  - `interface QuickdrawAction { label: string; icon: ReactNode; onClick: () => void; destructive?: boolean }`
  - `QuickdrawItem({ glyph, title, meta, detail, metaColor, actions, expanded, onOpen }: { glyph: ReactNode; title: string; meta?: string; detail?: string; metaColor?: string; actions: QuickdrawAction[]; expanded: boolean; onOpen?: () => void })`
  - Behavior: row shows `glyph` + `title` + optional `meta` (right, mono). When `expanded && detail` → detail line below title (secondary). When `expanded` → action buttons render inline (IconButtons with Tooltip); else a single `⋯` (MoreHorizontal) opens a Menu of the same actions. A `destructive` action shows an inline confirm Dialog before firing `onClick`. Clicking the row body (not an action) calls `onOpen`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/quickdraw/QuickdrawItem.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { Bell } from 'lucide-react'
import { theme } from '../../theme'
import { QuickdrawItem } from './QuickdrawItem'

function renderItem(props: Partial<Parameters<typeof QuickdrawItem>[0]> = {}) {
  const actions = props.actions ?? [{ label: 'Silence', icon: <Bell size={14} />, onClick: vi.fn() }]
  render(
    <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">
      <QuickdrawItem glyph={<Bell size={14} />} title="Budget question" meta="45m" actions={actions} expanded={false} {...props} />
    </ThemeProvider>,
  )
  return actions
}

describe('QuickdrawItem', () => {
  it('collapsed: actions hidden behind a ⋯ menu', () => {
    const actions = renderItem({ expanded: false })
    expect(screen.queryByRole('button', { name: 'Silence' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Silence' }))
    expect(actions[0].onClick).toHaveBeenCalledOnce()
  })

  it('expanded: action buttons render inline', () => {
    const actions = renderItem({ expanded: true })
    fireEvent.click(screen.getByRole('button', { name: 'Silence' }))
    expect(actions[0].onClick).toHaveBeenCalledOnce()
  })

  it('destructive action asks for confirmation before firing', () => {
    const onClick = vi.fn()
    renderItem({ expanded: true, actions: [{ label: 'Dismiss', icon: <Bell size={14} />, onClick, destructive: true }] })
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onClick).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('row body click calls onOpen', () => {
    const onOpen = vi.fn()
    renderItem({ onOpen })
    fireEvent.click(screen.getByText('Budget question'))
    expect(onOpen).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/quickdraw/QuickdrawItem.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// frontend/src/components/quickdraw/QuickdrawItem.tsx
import { useState, type ReactNode } from 'react'
import {
  Box, Typography, IconButton, Tooltip, Menu, MenuItem, ListItemIcon,
  Dialog, DialogTitle, DialogActions, Button,
} from '@mui/material'
import { MoreHorizontal } from 'lucide-react'

export interface QuickdrawAction { label: string; icon: ReactNode; onClick: () => void; destructive?: boolean }

interface QuickdrawItemProps {
  glyph: ReactNode
  title: string
  meta?: string
  detail?: string
  metaColor?: string
  actions: QuickdrawAction[]
  expanded: boolean
  onOpen?: () => void
}

export function QuickdrawItem({ glyph, title, meta, detail, metaColor, actions, expanded, onOpen }: QuickdrawItemProps) {
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null)
  const [confirm, setConfirm] = useState<QuickdrawAction | null>(null)

  const fire = (a: QuickdrawAction) => {
    setMenuEl(null)
    if (a.destructive) setConfirm(a)
    else a.onClick()
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, px: 1, py: 0.6, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
      <Box sx={{ mt: 0.25, flexShrink: 0, display: 'flex' }}>{glyph}</Box>
      <Box
        role="button" tabIndex={0} aria-label={title}
        onClick={onOpen}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.() } }}
        sx={{ flex: 1, minWidth: 0, cursor: onOpen ? 'pointer' : 'default', '&:focus-visible': { outline: '2px solid var(--color-accent)' } }}
      >
        <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>{title}</Typography>
        {expanded && detail && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{detail}</Typography>
        )}
      </Box>
      {meta && (
        <Typography variant="caption" sx={{ flexShrink: 0, fontFamily: '"JetBrains Mono", monospace', color: metaColor ?? 'text.secondary', mt: 0.25 }}>{meta}</Typography>
      )}
      {actions.length > 0 && (expanded ? (
        <Box sx={{ display: 'flex', flexShrink: 0 }}>
          {actions.map((a) => (
            <Tooltip key={a.label} title={a.label}>
              <IconButton size="small" aria-label={a.label} onClick={() => fire(a)}>{a.icon}</IconButton>
            </Tooltip>
          ))}
        </Box>
      ) : (
        <>
          <IconButton size="small" aria-label="more actions" onClick={(e) => setMenuEl(e.currentTarget)}><MoreHorizontal size={16} /></IconButton>
          <Menu open={!!menuEl} anchorEl={menuEl} onClose={() => setMenuEl(null)}>
            {actions.map((a) => (
              <MenuItem key={a.label} onClick={() => fire(a)}>
                <ListItemIcon>{a.icon}</ListItemIcon>{a.label}
              </MenuItem>
            ))}
          </Menu>
        </>
      ))}
      <Dialog open={!!confirm} onClose={() => setConfirm(null)}>
        <DialogTitle>{confirm?.label} “{title}”?</DialogTitle>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => { confirm?.onClick(); setConfirm(null) }}>Confirm</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/quickdraw/QuickdrawItem.test.tsx` → PASS
Run: `npx tsc --noEmit` → clean

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/quickdraw/QuickdrawItem.tsx frontend/src/components/quickdraw/QuickdrawItem.test.tsx
git commit -m "feat(quickdraw): item row with inline/menu actions + destructive confirm"
```

---

### Task 6: `QuickdrawSection` — collapsible chrome

**Files:**
- Create: `frontend/src/components/quickdraw/QuickdrawSection.tsx`
- Test: `frontend/src/components/quickdraw/QuickdrawSection.test.tsx`

**Interfaces:**
- Consumes: MUI, lucide-react.
- Produces: `QuickdrawSection({ id, label, count, collapsed, onToggle, loading, error, empty, children }: { id: string; label: string; count: number; collapsed: boolean; onToggle: (id: string) => void; loading?: boolean; error?: boolean; empty: string; children: ReactNode })`. Header = label + count chip + chevron; clicking header calls `onToggle(id)`. When not collapsed: show `loading` ("Loading…"), `error` ("Couldn't load"), else `count === 0` → the `empty` micro-copy, else `children`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/quickdraw/QuickdrawSection.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../../theme'
import { QuickdrawSection } from './QuickdrawSection'

function renderSection(props: Partial<Parameters<typeof QuickdrawSection>[0]> = {}) {
  const onToggle = props.onToggle ?? vi.fn()
  render(
    <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">
      <QuickdrawSection id="needs" label="Needs Response" count={0} collapsed={false} onToggle={onToggle} empty="Holstered — nothing to draw." {...props}>
        <div>child-row</div>
      </QuickdrawSection>
    </ThemeProvider>,
  )
  return onToggle
}

describe('QuickdrawSection', () => {
  it('shows empty micro-copy when count is 0', () => {
    renderSection({ count: 0 })
    expect(screen.getByText('Holstered — nothing to draw.')).toBeInTheDocument()
    expect(screen.queryByText('child-row')).toBeNull()
  })

  it('renders children when count > 0', () => {
    renderSection({ count: 2 })
    expect(screen.getByText('child-row')).toBeInTheDocument()
  })

  it('header click toggles', () => {
    const onToggle = renderSection()
    fireEvent.click(screen.getByRole('button', { name: /needs response/i }))
    expect(onToggle).toHaveBeenCalledWith('needs')
  })

  it('collapsed hides body', () => {
    renderSection({ collapsed: true, count: 2 })
    expect(screen.queryByText('child-row')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/quickdraw/QuickdrawSection.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// frontend/src/components/quickdraw/QuickdrawSection.tsx
import { type ReactNode } from 'react'
import { Box, Typography, Chip, Collapse } from '@mui/material'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface QuickdrawSectionProps {
  id: string
  label: string
  count: number
  collapsed: boolean
  onToggle: (id: string) => void
  loading?: boolean
  error?: boolean
  empty: string
  children: ReactNode
}

export function QuickdrawSection({ id, label, count, collapsed, onToggle, loading, error, empty, children }: QuickdrawSectionProps) {
  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Box
        role="button" tabIndex={0} aria-expanded={!collapsed} aria-label={label}
        onClick={() => onToggle(id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(id) } }}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, '&:focus-visible': { outline: '2px solid var(--color-accent)' } }}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        <Typography variant="overline" sx={{ flex: 1, lineHeight: 1.6 }}>{label}</Typography>
        <Chip size="small" label={count} sx={{ height: 18, fontFamily: '"JetBrains Mono", monospace' }} />
      </Box>
      <Collapse in={!collapsed}>
        <Box sx={{ pb: 1 }}>
          {loading ? <Typography variant="caption" color="text.secondary" sx={{ px: 1.5 }}>Loading…</Typography>
            : error ? <Typography variant="caption" color="error" sx={{ px: 1.5 }}>Couldn't load</Typography>
            : count === 0 ? <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, fontStyle: 'italic' }}>{empty}</Typography>
            : children}
        </Box>
      </Collapse>
    </Box>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/quickdraw/QuickdrawSection.test.tsx` → PASS
Run: `npx tsc --noEmit` → clean

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/quickdraw/QuickdrawSection.tsx frontend/src/components/quickdraw/QuickdrawSection.test.tsx
git commit -m "feat(quickdraw): collapsible section chrome w/ count + empty micro-copy"
```

---

### Task 7: `NeedsResponseSection` — signals + alerts with actions

**Files:**
- Create: `frontend/src/components/quickdraw/NeedsResponseSection.tsx`
- Test: `frontend/src/components/quickdraw/NeedsResponseSection.test.tsx`

**Interfaces:**
- Consumes: `getSignals`, `getAlerts`, `setSignalStatus` from `@/api`; `buildNeedsResponse`, `ResponseItem`; `QuickdrawSection`, `QuickdrawItem`, `QuickdrawAction`, `ActionComposeModal`; TanStack `useQuery`/`useMutation`/`useQueryClient`; lucide `Mail`, `Megaphone`, `Reply`, `BellOff`, `Trash2`.
- Produces: `NeedsResponseSection({ expanded, collapsed, onToggle }: { expanded: boolean; collapsed: boolean; onToggle: (id: string) => void })`. Queries `['signals','new']` (`getSignals('new')`) + `['alerts']` (`getAlerts`, filtered client-side to `status==='unread'`). Builds rows via `buildNeedsResponse`. Per row actions:
  - **Reply** (icon `Reply`) → open `ActionComposeModal` titled `Reply to: {title}`.
  - **Silence** (icon `BellOff`) → `setSignalStatus(table, id, 'read')` then invalidate.
  - **Dismiss** (icon `Trash2`, destructive) → `setSignalStatus(table, id, 'dismissed')` then invalidate.
  - `table` = `signals` for `kind==='signal'`, `alerts` for `kind==='alert'`. `onOpen` → if `url` present `window.open(url, '_blank')`.
- Section `id="needs"`, label `"Needs Response"`, empty `"Holstered — nothing to draw."`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/quickdraw/NeedsResponseSection.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { theme } from '../../theme'
import { NeedsResponseSection } from './NeedsResponseSection'
import * as api from '@/api'

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">{ui}</ThemeProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.spyOn(api, 'getSignals').mockResolvedValue([{ id: 1, type: 'email', source: 'inbox', title: 'Budget question', status: 'new', priority: 2, created_at: '', summary: 'needs a reply' }])
  vi.spyOn(api, 'getAlerts').mockResolvedValue([{ id: 9, severity: 'info', title: 'read one', status: 'read', created_at: '' }])
})

describe('NeedsResponseSection', () => {
  it('lists new signals + unread alerts and silences via status endpoint', async () => {
    const setStatus = vi.spyOn(api, 'setSignalStatus').mockResolvedValue({ updated: 1 })
    wrap(<NeedsResponseSection expanded collapsed={false} onToggle={vi.fn()} />)
    await screen.findByText('Budget question')
    expect(screen.queryByText('read one')).toBeNull() // alert filtered out (status read)
    fireEvent.click(screen.getByRole('button', { name: 'Silence' }))
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith('signals', 1, 'read'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/quickdraw/NeedsResponseSection.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// frontend/src/components/quickdraw/NeedsResponseSection.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Stack } from '@mui/material'
import { Mail, Megaphone, Reply, BellOff, Trash2 } from 'lucide-react'
import { getSignals, getAlerts, setSignalStatus } from '@/api'
import { buildNeedsResponse, type ResponseItem } from './quickdrawData'
import { QuickdrawSection } from './QuickdrawSection'
import { QuickdrawItem, type QuickdrawAction } from './QuickdrawItem'
import { ActionComposeModal } from './ActionComposeModal'

export function NeedsResponseSection({ expanded, collapsed, onToggle }: { expanded: boolean; collapsed: boolean; onToggle: (id: string) => void }) {
  const qc = useQueryClient()
  const [reply, setReply] = useState<ResponseItem | null>(null)
  const signalsQ = useQuery({ queryKey: ['signals', 'new'], queryFn: () => getSignals('new'), refetchInterval: 15000 })
  const alertsQ = useQuery({ queryKey: ['alerts'], queryFn: getAlerts, refetchInterval: 15000 })

  const status = useMutation({
    mutationFn: ({ table, id, value }: { table: string; id: number; value: string }) => setSignalStatus(table, id, value),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['signals'] }); qc.invalidateQueries({ queryKey: ['alerts'] }) },
  })

  const unreadAlerts = (alertsQ.data ?? []).filter((a) => a.status === 'unread')
  const rows = buildNeedsResponse(signalsQ.data ?? [], unreadAlerts)
  const tableOf = (r: ResponseItem) => r.kind === 'signal' ? 'signals' : 'alerts'

  const actionsFor = (r: ResponseItem): QuickdrawAction[] => [
    { label: 'Reply', icon: <Reply size={14} />, onClick: () => setReply(r) },
    { label: 'Silence', icon: <BellOff size={14} />, onClick: () => status.mutate({ table: tableOf(r), id: r.id, value: 'read' }) },
    { label: 'Dismiss', icon: <Trash2 size={14} />, destructive: true, onClick: () => status.mutate({ table: tableOf(r), id: r.id, value: 'dismissed' }) },
  ]

  return (
    <QuickdrawSection
      id="needs" label="Needs Response" count={rows.length} collapsed={collapsed} onToggle={onToggle}
      loading={signalsQ.isLoading || alertsQ.isLoading} error={!!signalsQ.error || !!alertsQ.error}
      empty="Holstered — nothing to draw."
    >
      <Stack spacing={0.25} sx={{ px: 0.5 }}>
        {rows.map((r) => (
          <QuickdrawItem
            key={r.key}
            glyph={r.kind === 'signal' ? <Mail size={14} /> : <Megaphone size={14} />}
            title={r.title} detail={r.detail} expanded={expanded} actions={actionsFor(r)}
            onOpen={r.url ? () => window.open(r.url, '_blank', 'noopener') : undefined}
          />
        ))}
      </Stack>
      <ActionComposeModal open={!!reply} title={reply ? `Reply to: ${reply.title}` : ''} onClose={() => setReply(null)} />
    </QuickdrawSection>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/quickdraw/NeedsResponseSection.test.tsx` → PASS
Run: `npx tsc --noEmit` → clean

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/quickdraw/NeedsResponseSection.tsx frontend/src/components/quickdraw/NeedsResponseSection.test.tsx
git commit -m "feat(quickdraw): Needs Response section (signals+alerts, reply/silence/dismiss)"
```

---

### Task 8: `ApproachingSection` + `RecentActivitySection`

**Files:**
- Create: `frontend/src/components/quickdraw/ApproachingSection.tsx`
- Create: `frontend/src/components/quickdraw/RecentActivitySection.tsx`
- Test: `frontend/src/components/quickdraw/ApproachingSection.test.tsx`
- Test: `frontend/src/components/quickdraw/RecentActivitySection.test.tsx`

**Interfaces:**
- `ApproachingSection({ expanded, collapsed, onToggle })` — queries `['deadlines']` (`getDeadlines`), `['tasks']` (`getTasks`), `['events']` (`getEvents`); `buildApproaching(..., new Date())`; each row uses `TimelineTypeChip type={type}` as glyph, `meta = formatCountdown(seconds)` with `metaColor` from `URGENCY_CHIP[urgency]` mapped to a palette main (`error.main`/`warning.main`/`info.main`/`text.secondary`); action **Take action** (`ArrowRight`) → `navigate(`${route}?focus=${id}`)` with `route` = `/deadlines`|`/tasks`|`/calendar`; `onOpen` = same nav. `id="approaching"`, label `"Approaching"`, empty `"All quiet on the range."`.
- `RecentActivitySection({ collapsed, onToggle })` — queries `['activity','recent']` (`getActivity(10)`); each row glyph = `CheckCircle2` (ok) or `AlertCircle` (error) by `status`; title = `skill`; meta = relative time via `useFriendlyTime()`; **no actions**, `expanded` not needed (always compact). `id="recent"`, label `"Recent Activity"`, empty `"No tracks yet."`.
- Consumes: `useNavigate`; `useFriendlyTime` from `@/lib/timePrefs`; `TimelineTypeChip` from `@/components/TimelineTypeChip`; `formatCountdown`, `URGENCY_CHIP`, `buildApproaching` from `./quickdrawData`.

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/src/components/quickdraw/ApproachingSection.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { theme } from '../../theme'
import { ApproachingSection } from './ApproachingSection'
import * as api from '@/api'

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">
        <MemoryRouter>{ui}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  const soon = new Date(Date.now() + 3600_000).toISOString()
  vi.spyOn(api, 'getDeadlines').mockResolvedValue([{ id: 1, title: 'Ship it', due_at: soon, countdown_seconds: 3600, detail: '', source: 'manual', status: 'open', visible: 1 }])
  vi.spyOn(api, 'getTasks').mockResolvedValue([])
  vi.spyOn(api, 'getEvents').mockResolvedValue([])
})

describe('ApproachingSection', () => {
  it('lists an approaching deadline with a countdown', async () => {
    wrap(<ApproachingSection expanded collapsed={false} onToggle={vi.fn()} />)
    expect(await screen.findByText('Ship it')).toBeInTheDocument()
  })
})
```

```tsx
// frontend/src/components/quickdraw/RecentActivitySection.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TimePrefsProvider } from '@/lib/timePrefs'
import { theme } from '../../theme'
import { RecentActivitySection } from './RecentActivitySection'
import * as api from '@/api'

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">
        <TimePrefsProvider>{ui}</TimePrefsProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.spyOn(api, 'getActivity').mockResolvedValue([{ id: 1, skill: 'news_search', ran_at: new Date().toISOString(), items_created: 3, status: 'ok' }])
})

describe('RecentActivitySection', () => {
  it('lists a recent skill run', async () => {
    wrap(<RecentActivitySection collapsed={false} onToggle={vi.fn()} />)
    expect(await screen.findByText('news_search')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/quickdraw/ApproachingSection.test.tsx src/components/quickdraw/RecentActivitySection.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

```tsx
// frontend/src/components/quickdraw/ApproachingSection.tsx
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Stack } from '@mui/material'
import { ArrowRight } from 'lucide-react'
import { getDeadlines, getTasks, getEvents } from '@/api'
import { TimelineTypeChip } from '@/components/TimelineTypeChip'
import { buildApproaching, formatCountdown, URGENCY_CHIP, type ApproachItem } from './quickdrawData'
import { QuickdrawSection } from './QuickdrawSection'
import { QuickdrawItem, type QuickdrawAction } from './QuickdrawItem'

const ROUTE: Record<ApproachItem['type'], string> = { deadline: '/deadlines', task: '/tasks', event: '/calendar' }
const CHIP_COLOR: Record<'error' | 'warning' | 'info' | 'default', string> = {
  error: 'error.main', warning: 'warning.main', info: 'info.main', default: 'text.secondary',
}

export function ApproachingSection({ expanded, collapsed, onToggle }: { expanded: boolean; collapsed: boolean; onToggle: (id: string) => void }) {
  const navigate = useNavigate()
  const deadlinesQ = useQuery({ queryKey: ['deadlines'], queryFn: () => getDeadlines(), refetchInterval: 15000 })
  const tasksQ = useQuery({ queryKey: ['tasks'], queryFn: getTasks, refetchInterval: 15000 })
  const eventsQ = useQuery({ queryKey: ['events'], queryFn: getEvents, refetchInterval: 15000 })

  const rows = buildApproaching(deadlinesQ.data ?? [], tasksQ.data ?? [], eventsQ.data ?? [], new Date())
  const open = (r: ApproachItem) => navigate(`${ROUTE[r.type]}?focus=${r.id}`)
  const actionsFor = (r: ApproachItem): QuickdrawAction[] => [
    { label: 'Take action', icon: <ArrowRight size={14} />, onClick: () => open(r) },
  ]

  return (
    <QuickdrawSection
      id="approaching" label="Approaching" count={rows.length} collapsed={collapsed} onToggle={onToggle}
      loading={deadlinesQ.isLoading || tasksQ.isLoading || eventsQ.isLoading}
      error={!!deadlinesQ.error || !!tasksQ.error || !!eventsQ.error}
      empty="All quiet on the range."
    >
      <Stack spacing={0.25} sx={{ px: 0.5 }}>
        {rows.map((r) => (
          <QuickdrawItem
            key={r.key}
            glyph={<TimelineTypeChip type={r.type} dense />}
            title={r.title} meta={formatCountdown(r.seconds)} metaColor={CHIP_COLOR[URGENCY_CHIP[r.urgency]]}
            expanded={expanded} actions={actionsFor(r)} onOpen={() => open(r)}
          />
        ))}
      </Stack>
    </QuickdrawSection>
  )
}
```

```tsx
// frontend/src/components/quickdraw/RecentActivitySection.tsx
import { useQuery } from '@tanstack/react-query'
import { Stack } from '@mui/material'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { getActivity } from '@/api'
import { useFriendlyTime } from '@/lib/timePrefs'
import { QuickdrawSection } from './QuickdrawSection'
import { QuickdrawItem } from './QuickdrawItem'

export function RecentActivitySection({ collapsed, onToggle }: { collapsed: boolean; onToggle: (id: string) => void }) {
  const friendly = useFriendlyTime()
  const activityQ = useQuery({ queryKey: ['activity', 'recent'], queryFn: () => getActivity(10), refetchInterval: 15000 })
  const rows = activityQ.data ?? []

  return (
    <QuickdrawSection
      id="recent" label="Recent Activity" count={rows.length} collapsed={collapsed} onToggle={onToggle}
      loading={activityQ.isLoading} error={!!activityQ.error} empty="No tracks yet."
    >
      <Stack spacing={0.25} sx={{ px: 0.5 }}>
        {rows.map((a) => (
          <QuickdrawItem
            key={a.id}
            glyph={a.status === 'ok' ? <CheckCircle2 size={14} color="var(--mui-palette-success-main)" /> : <AlertCircle size={14} color="var(--mui-palette-error-main)" />}
            title={a.skill} meta={friendly(a.ran_at)} expanded={false} actions={[]}
          />
        ))}
      </Stack>
    </QuickdrawSection>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/quickdraw/ApproachingSection.test.tsx src/components/quickdraw/RecentActivitySection.test.tsx` → PASS
Run: `npx tsc --noEmit` → clean

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/quickdraw/ApproachingSection.tsx frontend/src/components/quickdraw/RecentActivitySection.tsx frontend/src/components/quickdraw/ApproachingSection.test.tsx frontend/src/components/quickdraw/RecentActivitySection.test.tsx
git commit -m "feat(quickdraw): Approaching + Recent Activity sections"
```

---

### Task 9: `Quickdraw` shell + App cutover + retire RightDrawer

**Files:**
- Create: `frontend/src/components/quickdraw/Quickdraw.tsx`
- Create: `frontend/src/components/quickdraw/Quickdraw.test.tsx`
- Modify: `frontend/src/App.tsx` (line 10 import; line ~113 `<RightDrawer />`)
- Delete: `frontend/src/components/RightDrawer.tsx`, `frontend/src/components/RightDrawer.test.tsx`

**Interfaces:**
- Consumes: `useQuickdrawPrefs`, the three section components.
- Produces: `Quickdraw()` — the drawer shell. Masthead: `QUICKDRAW` (mono, letter-spaced) + `Crosshair` glyph (`var(--color-accent)`) + an expand toggle IconButton (`PanelLeftOpen`/`PanelRightOpen`, `aria-label="Expand Quickdraw"`/`"Collapse Quickdraw"`). Root `Box` width `expanded ? 560 : 300`, `borderLeft:1`, `flexDirection:column`, `overflow:hidden`, `bgcolor:'background.default'`. Sections in a `flex:1; overflowY:auto` region: `NeedsResponseSection` + `ApproachingSection` (both get `expanded`), `RecentActivitySection`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/quickdraw/Quickdraw.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { TimePrefsProvider } from '@/lib/timePrefs'
import { theme } from '../../theme'
import { Quickdraw } from './Quickdraw'
import * as api from '@/api'

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">
        <TimePrefsProvider><MemoryRouter><Quickdraw /></MemoryRouter></TimePrefsProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(api, 'getSignals').mockResolvedValue([])
  vi.spyOn(api, 'getAlerts').mockResolvedValue([])
  vi.spyOn(api, 'getDeadlines').mockResolvedValue([])
  vi.spyOn(api, 'getTasks').mockResolvedValue([])
  vi.spyOn(api, 'getEvents').mockResolvedValue([])
  vi.spyOn(api, 'getActivity').mockResolvedValue([])
})

describe('Quickdraw', () => {
  it('renders masthead + the three sections', async () => {
    wrap()
    expect(screen.getByText('QUICKDRAW')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /needs response/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /approaching/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /recent activity/i })).toBeInTheDocument()
  })

  it('expand toggle persists', () => {
    wrap()
    fireEvent.click(screen.getByRole('button', { name: /expand quickdraw/i }))
    expect(localStorage.getItem('ea-quickdraw-expanded')).toBe('1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/quickdraw/Quickdraw.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the shell**

```tsx
// frontend/src/components/quickdraw/Quickdraw.tsx
import { Box, Typography, IconButton, Tooltip } from '@mui/material'
import { Crosshair, PanelRightOpen, PanelRightClose } from 'lucide-react'
import { useQuickdrawPrefs } from './useQuickdrawPrefs'
import { NeedsResponseSection } from './NeedsResponseSection'
import { ApproachingSection } from './ApproachingSection'
import { RecentActivitySection } from './RecentActivitySection'

export function Quickdraw() {
  const { expanded, toggleExpanded, isCollapsed, toggleSection } = useQuickdrawPrefs()
  return (
    <Box sx={{ width: expanded ? 560 : 300, borderLeft: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'background.default', transition: 'width 0.15s ease' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Crosshair size={16} style={{ color: 'var(--color-accent)' }} />
        <Typography sx={{ flex: 1, fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, letterSpacing: 1, fontSize: 13 }}>QUICKDRAW</Typography>
        <Tooltip title={expanded ? 'Collapse Quickdraw' : 'Expand Quickdraw'}>
          <IconButton size="small" aria-label={expanded ? 'Collapse Quickdraw' : 'Expand Quickdraw'} onClick={toggleExpanded}>
            {expanded ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <NeedsResponseSection expanded={expanded} collapsed={isCollapsed('needs')} onToggle={toggleSection} />
        <ApproachingSection expanded={expanded} collapsed={isCollapsed('approaching')} onToggle={toggleSection} />
        <RecentActivitySection collapsed={isCollapsed('recent')} onToggle={toggleSection} />
      </Box>
    </Box>
  )
}
```

- [ ] **Step 4: Cutover `App.tsx` + delete RightDrawer**

In `frontend/src/App.tsx`:
- Line 10: replace `import { RightDrawer } from '@/components/RightDrawer'` with `import { Quickdraw } from '@/components/quickdraw/Quickdraw'`.
- Line ~113: replace `<RightDrawer />` with `<Quickdraw />` (leave the surrounding `Box sx={{ display: { xs: 'none', lg: 'flex' } }}` unchanged).

Delete the retired files:

```bash
git rm frontend/src/components/RightDrawer.tsx frontend/src/components/RightDrawer.test.tsx
```

- [ ] **Step 5: Run the full gate**

Run: `npx vitest run` → all pass (RightDrawer tests gone; Quickdraw tests present)
Run: `npx tsc --noEmit` → clean
Run: `npx vite build` → succeeds

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/quickdraw/Quickdraw.tsx frontend/src/components/quickdraw/Quickdraw.test.tsx frontend/src/App.tsx
git commit -m "feat(quickdraw): shell + masthead + expand toggle; cut App over from RightDrawer"
```

---

## Self-Review

**Spec coverage:**
- 3 collapsible sections (Needs Response / Approaching / Recent Activity) → Tasks 6–9. ✓
- Horizontal expand→detail+inline-actions, persisted → Tasks 2 (prefs), 5 (item inline vs menu), 9 (shell width). ✓
- Quick actions silence/dismiss (status endpoint, confirm on destructive) + reply/take-action stub → Tasks 4, 5, 7, 8. ✓
- Reuse `?focus=id`, `TimelineTypeChip`, urgency helpers, existing fetchers → Tasks 3, 8. ✓
- Gunslinger title + `Crosshair` glyph + empty micro-copy → Tasks 6 (empty copy), 9 (masthead). ✓
- FE-only, no new backend; `action_requests` deferred → stub comment in Task 4. ✓
- Desktop-only mount unchanged → Task 9 keeps the `lg` wrapper. ✓
- Retire RightDrawer + migrate its test → Task 9. ✓

**Placeholder scan:** none — every code step is complete.

**Type consistency:** `QuickdrawAction` (Task 5) consumed by Tasks 7–8; `ResponseItem`/`ApproachItem`/`buildNeedsResponse`/`buildApproaching`/`formatCountdown`/`URGENCY_CHIP` (Task 3) consumed by 7–8; `Alert`/`getAlerts` (Task 1) consumed by 7; `useQuickdrawPrefs` signature (Task 2) consumed by 9. Section props `{ expanded?, collapsed, onToggle }` consistent (RecentActivity omits `expanded` by design). ✓

**Notes for the executor:**
- Lint (`react-hooks/purity` on `new Date()` / `Date.now()`) is NOT in CI; the codebase already ships such usage (SignatureBar). `buildApproaching(..., new Date())` in Task 8 mirrors that — acceptable.
- Confirm the `theme` import path in tests is `../../theme` from `src/components/quickdraw/` (matches existing test convention `import { theme } from '../theme'` one level up).
