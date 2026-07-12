# F1 Response Detail Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a Quickdraw "Needs Response" item opens a Dialog showing the item's full context (5 W's + AI reasoning) and every real action.

**Architecture:** Phase 1 adds a `reasoning` column to the `signals` table (schema + idempotent migration + write whitelist + MCP param). Phase 2 adds a props-driven `ResponseDetailModal` (MUI Dialog) and wires `NeedsResponseSection` to open it with the full Signal/Alert object it already holds, reusing the real actions infra (`ActionMenu` → `createAction`). The toast-only stub modal is deleted.

**Tech Stack:** Python 3 + SQLite (stdlib `sqlite3`) backend, pytest; React 19 + MUI 9 + TanStack Query frontend, Vitest + Testing Library.

## Global Constraints

- Backend change is additive only: one nullable `TEXT` column, no data migration, no backfill.
- Reasoning is on **signals only**; alerts stay thin.
- Frontend actions use the existing infra verbatim: `actions/ActionMenu` + `actions/ActionComposeModal` + `createAction`; signal specs are `email_new`/`teams_post`/`cowork_gather` as defined in `lib/actions.ts` (do not add specs).
- Modal is a centered MUI `Dialog` (house style: `HelpDialog`), `maxWidth="sm" fullWidth`.
- Backend tests: `cd backend && python -m pytest -q`. Frontend: `cd frontend && npx vitest run <file>`.
- Migration pattern: idempotent `PRAGMA table_info` check + `ALTER TABLE` inside `db._migrate` (mirror the `alerts.repeat_count` block at `backend/ea/db.py:94-97`).

---

### Task 1: Backend `reasoning` column (schema + migration + whitelist + MCP param)

**Files:**
- Modify: `backend/ea/schema.sql` (signals table, ~line 40-58)
- Modify: `backend/ea/db.py` (`_SIGNAL_COLS` ~line 105-107; `_migrate` ~line 94-98)
- Modify: `backend/mcp_server/server.py` (`add_signal` ~line 18-28)
- Test: `backend/tests/test_signal_reasoning.py` (create)

**Interfaces:**
- Produces: `signals.reasoning TEXT` column; `db.upsert_signal(..., reasoning=...)` accepted; MCP `add_signal(..., reasoning: str | None = None)`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_signal_reasoning.py
from ea import db


def _conn(tmp_path):
    return db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)


def test_upsert_signal_accepts_reasoning(tmp_path):
    conn = _conn(tmp_path)
    assert db.upsert_signal(
        conn, external_ref="r1", type="email", source="inbox",
        title="Budget review", reasoning="Flagged: mentions Q3 budget + exec sender.",
    ) == 1
    rows = db.list_signals(conn)
    assert rows[0]["reasoning"] == "Flagged: mentions Q3 budget + exec sender."


def test_migration_adds_reasoning_to_existing_db(tmp_path):
    conn = _conn(tmp_path)
    # Simulate a pre-existing DB missing the column, then re-run migrations.
    conn.execute("ALTER TABLE signals DROP COLUMN reasoning")
    conn.commit()
    db._migrate(conn)
    cols = [r[1] for r in conn.execute("PRAGMA table_info(signals)").fetchall()]
    assert "reasoning" in cols
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_signal_reasoning.py -q`
Expected: FAIL — `unknown signal columns: {'reasoning'}` (whitelist rejects it).

- [ ] **Step 3: Add column to schema, whitelist, migration, MCP param**

In `backend/ea/schema.sql`, add `reasoning` to the `signals` table (after the `why` / `url` lines):

```sql
    who TEXT, what TEXT, when_rel TEXT, why TEXT,
    reasoning     TEXT,                         -- AI rationale for surfacing (F1)
    url           TEXT,
```

In `backend/ea/db.py`, add `"reasoning"` to `_SIGNAL_COLS`:

```python
_SIGNAL_COLS = {"type", "source", "source_skill", "external_ref", "title", "summary",
                "who", "what", "when_rel", "why", "reasoning", "url", "person_id", "topic_id",
                "priority", "triage_rank", "status", "occurred_at"}
```

In `backend/ea/db.py` `_migrate`, append after the `alerts.repeat_count` block (~line 97):

```python
    # Add signals.reasoning for pre-existing DBs (fresh DBs get it from schema.sql).
    signals_pragma = conn.execute("PRAGMA table_info(signals)").fetchall()
    if not any(r[1] == "reasoning" for r in signals_pragma):
        conn.execute("ALTER TABLE signals ADD COLUMN reasoning TEXT")
        conn.commit()
```

In `backend/mcp_server/server.py`, extend `add_signal` to accept and pass `reasoning`:

```python
    @mcp.tool()
    def add_signal(type: str, source: str, title: str, external_ref: str,
                   status: str = "new", source_skill: str | None = None,
                   summary: str | None = None, priority: int = 3,
                   reasoning: str | None = None) -> int:
        """Add an inbound signal (email/teams/etc). Returns rowcount (1 new, 0 duplicate)."""
        conn = _conn()
        try:
            return tools.add_signal(conn, type=type, source=source, title=title,
                                    external_ref=external_ref, status=status,
                                    source_skill=source_skill, summary=summary,
                                    priority=priority, reasoning=reasoning)
        finally:
            conn.close()
```

Note: `tools.add_signal(conn, **fields)` already forwards `**fields` to `db.upsert_signal`, so no change there. `upsert_signal` filters to `_SIGNAL_COLS`, so passing `reasoning=None` inserts NULL — fine.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_signal_reasoning.py -q`
Expected: PASS (2 tests). (If `ALTER TABLE ... DROP COLUMN` is unsupported on the installed SQLite, replace the first line of `test_migration_adds_reasoning_to_existing_db` with a fresh table lacking the column; see fallback below.)

Fallback for `test_migration_adds_reasoning_to_existing_db` if `DROP COLUMN` errors (SQLite < 3.35):

```python
def test_migration_adds_reasoning_to_existing_db(tmp_path):
    conn = _conn(tmp_path)
    cols = [r[1] for r in conn.execute("PRAGMA table_info(signals)").fetchall()]
    assert "reasoning" in cols  # fresh DB already has it via schema.sql + migration
    db._migrate(conn)  # idempotent: safe to re-run
    cols2 = [r[1] for r in conn.execute("PRAGMA table_info(signals)").fetchall()]
    assert cols2.count("reasoning") == 1
```

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && python -m pytest -q`
Expected: all pass (no regression from the new column / whitelist entry).

- [ ] **Step 6: Commit**

```bash
git add backend/ea/schema.sql backend/ea/db.py backend/mcp_server/server.py backend/tests/test_signal_reasoning.py
git commit -m "feat(signals): reasoning column + migration + add_signal param

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `ResponseDetailModal` component + `Signal.reasoning` type

**Files:**
- Modify: `frontend/src/api.ts` (`Signal` interface ~line 53-71)
- Create: `frontend/src/components/quickdraw/ResponseDetailModal.tsx`
- Test: `frontend/src/components/quickdraw/ResponseDetailModal.test.tsx`

**Interfaces:**
- Consumes: `Signal`, `Alert` (`@/api`); `ActionMenu` (`@/components/actions/ActionMenu`); `formatFriendly`, `DEFAULT_TIME_PREFS` (`@/lib/datetime`).
- Produces: `ResponseDetailModal({ open, kind, item, onClose, onStatus })` where `onStatus: (value: 'read' | 'dismissed') => void`.

- [ ] **Step 1: Add `reasoning` to the `Signal` type**

In `frontend/src/api.ts`, inside `interface Signal`, add after `why?: string`:

```ts
  why?: string
  reasoning?: string
  url?: string
```

- [ ] **Step 2: Write the failing test**

```tsx
// frontend/src/components/quickdraw/ResponseDetailModal.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResponseDetailModal } from './ResponseDetailModal'
import type { Signal, Alert } from '@/api'

const signal: Signal = {
  id: 1, type: 'email', source: 'inbox', source_skill: 'triage_teams',
  title: 'Budget review', status: 'new', priority: 1, created_at: '2026-07-12T09:00:00Z',
  who: 'Mike', what: 'wants RVP in launch review', when_rel: 'today', why: 'exec ask',
  reasoning: 'Flagged: exec sender + deadline language.',
}

function renderSignal(overrides: Partial<Signal> = {}, onStatus = vi.fn()) {
  return render(
    <ResponseDetailModal open kind="signal" item={{ ...signal, ...overrides }}
      onClose={() => {}} onStatus={onStatus} />,
  )
}

describe('ResponseDetailModal', () => {
  it('renders all five W values for a signal', () => {
    renderSignal()
    expect(screen.getByText('Mike')).toBeInTheDocument()
    expect(screen.getByText('wants RVP in launch review')).toBeInTheDocument()
    expect(screen.getByText('today')).toBeInTheDocument()
    expect(screen.getByText('exec ask')).toBeInTheDocument()
  })

  it('shows the stored reasoning', () => {
    renderSignal()
    expect(screen.getByText(/Flagged: exec sender/)).toBeInTheDocument()
  })

  it('falls back to source_skill/why when reasoning is absent', () => {
    renderSignal({ reasoning: undefined })
    expect(screen.getByText(/Flagged by triage_teams/)).toBeInTheDocument()
  })

  it('dims a missing W field', () => {
    renderSignal({ who: undefined })
    // the WHO cell renders an em-dash placeholder
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('Silence and Dismiss call onStatus', () => {
    const onStatus = vi.fn()
    renderSignal({}, onStatus)
    fireEvent.click(screen.getByRole('button', { name: /silence/i }))
    expect(onStatus).toHaveBeenCalledWith('read')
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onStatus).toHaveBeenCalledWith('dismissed')
  })

  it('alert variant hides the 5W grid', () => {
    const alert: Alert = {
      id: 2, severity: 'warning', title: 'Disk almost full', body: '92% used',
      status: 'unread', created_at: '2026-07-12T09:00:00Z',
    }
    render(<ResponseDetailModal open kind="alert" item={alert} onClose={() => {}} onStatus={vi.fn()} />)
    expect(screen.getByText('92% used')).toBeInTheDocument()
    expect(screen.queryByText('WHO')).toBeNull()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/quickdraw/ResponseDetailModal.test.tsx`
Expected: FAIL — cannot resolve `./ResponseDetailModal`.

- [ ] **Step 4: Write the component**

```tsx
// frontend/src/components/quickdraw/ResponseDetailModal.tsx
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Chip, Link,
} from '@mui/material'
import { BellOff, Trash2, ExternalLink } from 'lucide-react'
import type { Signal, Alert } from '@/api'
import { ActionMenu } from '@/components/actions/ActionMenu'
import { formatFriendly, DEFAULT_TIME_PREFS } from '@/lib/datetime'

const DASH = '—'

function reasoningText(s: Signal): string {
  if (s.reasoning) return s.reasoning
  if (s.source_skill) return `Flagged by ${s.source_skill}${s.why ? ` — ${s.why}` : ''}`
  return s.why || 'No reasoning recorded yet.'
}

function WCell({ label, value }: { label: string; value?: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1 }}>{label}</Typography>
      <Typography variant="body2" sx={{ color: value ? 'text.primary' : 'text.disabled' }}>
        {value || DASH}
      </Typography>
    </Box>
  )
}

export function ResponseDetailModal({ open, kind, item, onClose, onStatus }: {
  open: boolean
  kind: 'signal' | 'alert'
  item: Signal | Alert | null
  onClose: () => void
  onStatus: (value: 'read' | 'dismissed') => void
}) {
  if (!item) return null
  const isSignal = kind === 'signal'
  const s = item as Signal
  const a = item as Alert
  const url = item.url

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 0 }}>{item.title}</span>
        {isSignal && s.source_skill && <Chip size="small" label={s.source_skill} />}
        <Chip size="small" variant="outlined" label={item.status} />
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {isSignal ? (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <WCell label="WHO" value={s.who} />
              <WCell label="WHAT" value={s.what} />
              <WCell label="WHEN" value={s.when_rel} />
              <WCell label="WHY" value={s.why} />
            </Box>
            {s.summary && <Typography variant="body2">{s.summary}</Typography>}
            <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
              <Typography variant="overline" color="text.secondary">AI Reasoning</Typography>
              <Typography variant="body2">{reasoningText(s)}</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {s.type} · {s.source} · priority {s.priority} · {formatFriendly(s.created_at, DEFAULT_TIME_PREFS)}
            </Typography>
          </>
        ) : (
          <>
            <Typography variant="body2">{a.body || 'No detail.'}</Typography>
            <Typography variant="caption" color="text.secondary">
              severity {a.severity} · {formatFriendly(a.created_at, DEFAULT_TIME_PREFS)}
            </Typography>
          </>
        )}
        {url && (
          <Link href={url} target="_blank" rel="noopener noreferrer"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <ExternalLink size={14} /> Open source
          </Link>
        )}
      </DialogContent>
      <DialogActions sx={{ gap: 0.5 }}>
        {isSignal && <ActionMenu entity={{ type: 'signal', id: item.id }} />}
        <Box sx={{ flex: 1 }} />
        <Button startIcon={<BellOff size={14} />} onClick={() => onStatus('read')}>Silence</Button>
        <Button color="error" startIcon={<Trash2 size={14} />} onClick={() => onStatus('dismissed')}>Dismiss</Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/quickdraw/ResponseDetailModal.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api.ts frontend/src/components/quickdraw/ResponseDetailModal.tsx frontend/src/components/quickdraw/ResponseDetailModal.test.tsx
git commit -m "feat(quickdraw): ResponseDetailModal — 5 W's + AI reasoning + real actions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wire `NeedsResponseSection` to the modal; delete the stub

**Files:**
- Modify: `frontend/src/components/quickdraw/NeedsResponseSection.tsx`
- Delete: `frontend/src/components/quickdraw/ActionComposeModal.tsx`
- Test: `frontend/src/components/quickdraw/NeedsResponseSection.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `ResponseDetailModal` (Task 2); existing `getSignals`, `getAlerts`, `setSignalStatus`, `buildNeedsResponse`.

- [ ] **Step 1: Confirm no other references to the stub**

Run: `cd frontend && grep -rn "quickdraw/ActionComposeModal\|from './ActionComposeModal'" src`
Expected: only `NeedsResponseSection.tsx` imports it. (If anything else references it, stop and report — do not delete.)

- [ ] **Step 2: Write the failing test**

```tsx
// frontend/src/components/quickdraw/NeedsResponseSection.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NeedsResponseSection } from './NeedsResponseSection'
import * as api from '@/api'

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <NeedsResponseSection expanded collapsed={false} onToggle={() => {}} />
    </QueryClientProvider>,
  )
}

describe('NeedsResponseSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'getSignals').mockResolvedValue([
      { id: 7, type: 'email', source: 'inbox', title: 'Budget review', status: 'new',
        priority: 1, created_at: '2026-07-12T09:00:00Z', who: 'Mike', why: 'exec ask' },
    ])
    vi.spyOn(api, 'getAlerts').mockResolvedValue([])
  })

  it('opens the detail modal on item click with the full signal', async () => {
    wrap()
    const item = await screen.findByRole('button', { name: 'Budget review' })
    fireEvent.click(item)
    // "AI Reasoning" heading is rendered ONLY by the modal, never by the list row
    await waitFor(() => expect(screen.getByText('AI Reasoning')).toBeInTheDocument())
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/quickdraw/NeedsResponseSection.test.tsx`
Expected: FAIL — clicking opens nothing (current `onOpen` calls `window.open`), no "AI Reasoning".

- [ ] **Step 4: Rewrite `NeedsResponseSection.tsx`**

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Stack } from '@mui/material'
import { Mail, Megaphone, BellOff, Trash2 } from 'lucide-react'
import { getSignals, getAlerts, setSignalStatus, type Signal, type Alert } from '@/api'
import { buildNeedsResponse, type ResponseItem } from './quickdrawData'
import { QuickdrawSection } from './QuickdrawSection'
import { QuickdrawItem, type QuickdrawAction } from './QuickdrawItem'
import { ResponseDetailModal } from './ResponseDetailModal'

type Detail = { kind: 'signal'; item: Signal } | { kind: 'alert'; item: Alert }

export function NeedsResponseSection({ expanded, collapsed, onToggle }: { expanded: boolean; collapsed: boolean; onToggle: (id: string) => void }) {
  const qc = useQueryClient()
  const [detail, setDetail] = useState<Detail | null>(null)
  const signalsQ = useQuery({ queryKey: ['signals', 'new'], queryFn: () => getSignals('new'), refetchInterval: 15000 })
  const alertsQ = useQuery({ queryKey: ['alerts'], queryFn: getAlerts, refetchInterval: 15000 })

  const status = useMutation({
    mutationFn: ({ table, id, value }: { table: string; id: number; value: string }) => setSignalStatus(table, id, value),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['signals'] }); qc.invalidateQueries({ queryKey: ['alerts'] }) },
  })

  const unreadAlerts = (alertsQ.data ?? []).filter((a) => a.status === 'unread')
  const rows = buildNeedsResponse(signalsQ.data ?? [], unreadAlerts)
  const tableOf = (r: { kind: 'signal' | 'alert' }) => r.kind === 'signal' ? 'signals' : 'alerts'

  const openDetail = (r: ResponseItem) => {
    if (r.kind === 'signal') {
      const s = (signalsQ.data ?? []).find((x) => x.id === r.id)
      if (s) setDetail({ kind: 'signal', item: s })
    } else {
      const a = unreadAlerts.find((x) => x.id === r.id)
      if (a) setDetail({ kind: 'alert', item: a })
    }
  }

  const actionsFor = (r: ResponseItem): QuickdrawAction[] => [
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
            onOpen={() => openDetail(r)}
          />
        ))}
      </Stack>
      <ResponseDetailModal
        open={!!detail}
        kind={detail?.kind ?? 'signal'}
        item={detail?.item ?? null}
        onClose={() => setDetail(null)}
        onStatus={(value) => {
          if (detail) { status.mutate({ table: tableOf(detail), id: detail.item.id, value }); setDetail(null) }
        }}
      />
    </QuickdrawSection>
  )
}
```

- [ ] **Step 5: Delete the stub file**

```bash
git rm frontend/src/components/quickdraw/ActionComposeModal.tsx
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/quickdraw/NeedsResponseSection.test.tsx`
Expected: PASS.

- [ ] **Step 7: Full frontend suite + build**

Run: `cd frontend && npx vitest run && npm run build`
Expected: all green; build succeeds. (Confirms no dangling import of the deleted stub.)

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/quickdraw/NeedsResponseSection.tsx frontend/src/components/quickdraw/NeedsResponseSection.test.tsx
git commit -m "feat(quickdraw): open ResponseDetailModal on item click; remove stub reply modal

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** reasoning field backend (Task 1 ✓); `Signal.reasoning` type (Task 2 ✓); Dialog with 5W grid + reasoning block + fallback + meta + URL (Task 2 ✓); real actions via `ActionMenu` + Silence/Dismiss (Task 2 ✓); alert thin variant (Task 2 ✓); click-to-open wiring reusing fetched arrays (Task 3 ✓); stub deletion (Task 3 ✓); signals-only reasoning, no new endpoint, no backfill (Global Constraints ✓).
- **Placeholder scan:** none — every step has concrete code/commands.
- **Type consistency:** `reasoning` added to both `_SIGNAL_COLS` (Task 1) and `Signal` (Task 2); `onStatus: (value: 'read' | 'dismissed')` defined in Task 2, called with `'read'`/`'dismissed'` in Task 3; `ResponseDetailModal` prop names (`open/kind/item/onClose/onStatus`) match between Task 2 definition and Task 3 usage; `ActionMenu entity={{ type: 'signal', id }}` matches its real signature.
- **Note:** Task 3 removes the `Reply` inline action and `reply` state entirely; full compose now lives in the modal via `ActionMenu`. Silence/Dismiss remain as quick inline actions AND in the modal.
