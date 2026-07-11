# Outgoing Actions — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface outgoing actions app-wide: a shared action registry + reusable `<ActionMenu>` + generalized compose modal, an Actions review queue with inline badges, touchpoint wiring, and guidance UI. Consumes the backend from `2026-07-11-outgoing-actions-backend.md`.

**Architecture:** A single registry (`lib/actions.ts`) maps entity types → available action types and describes each type's compose fields. `<ActionMenu entity>` reads it and opens `ActionComposeModal`, which POSTs to `/api/actions`. Scout's heartbeat drafts land in `views/Actions.tsx` (source of truth) mirrored in Quickdraw, with inline `<ActionBadge>` on entity rows. Guidance is a small popover + a Settings panel.

**Tech Stack:** React + TypeScript, MUI v7, @tanstack/react-query, react-router, lucide-react, sonner, vitest + @testing-library/react.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-11-outgoing-actions-design.md`. Backend plan must be merged first (endpoints live).
- API helpers already in `src/api.ts`: `fetchJson`, `postJson`, `patchJson`, `del`. Reuse them.
- Action types (v1): `email_reply|email_forward|email_new|teams_dm|teams_group|teams_post|status_set|calendar_invite|cowork_doc|cowork_gather`.
- Draft-first: modal offers **Save draft** (`approve:false`) and **Approve & send** (`approve:true`).
- MUI theme + `sonner` toasts already global. Icons from `lucide-react`.
- Tests: wrap components using react-query in `QueryClientProvider`; wrap MUI in `<ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">` (see existing `*.test.tsx`).
- Run FE tests from `frontend/` with `npm test -- <path>` (vitest). Lint: `npm run lint`.

---

## File Structure

- `src/api.ts` — `Action`/`Guidance` interfaces + fetchers.
- `src/lib/actions.ts` — registry (entity→types, type→spec).
- `src/components/actions/ActionComposeModal.tsx` — generalized compose (replaces the Quickdraw stub's job).
- `src/components/actions/ActionMenu.tsx` — reusable affordance.
- `src/components/actions/ActionBadge.tsx` + `useEntityActions.ts` — inline status chip + hook.
- `src/views/Actions.tsx` — review queue.
- `src/components/actions/GuidancePopover.tsx` — note-icon popover.
- `src/views/Settings.tsx` — add Guidance panel.
- Wiring: `src/App.tsx`, `src/components/Sidebar.tsx`, `src/views/Inbox.tsx`, `src/views/People.tsx`, `src/components/feed/FeedDetail.tsx`, `src/components/CommandPalette.tsx`, `src/components/quickdraw/Quickdraw.tsx`.

---

## Task 1: API layer — `Action`/`Guidance` types + fetchers

**Files:**
- Modify: `src/api.ts`
- Test: `src/api.actions.test.ts`

**Interfaces:**
- Produces:
  - `interface Action { id; entity_type?; entity_id?; action_type; mode; status; payload?: Record<string,unknown>; rationale?; result?: Record<string,unknown>; error?; created_at }`
  - `interface Guidance { id; scope; text; created_at }`
  - `listActions(status?) → Promise<Action[]>`
  - `createAction(body) → Promise<{id:number}>` where `body: {action_type; entity_type?; entity_id?; mode?; payload?; rationale?; approve?}`
  - `approveAction(id) → Promise<{updated:number}>`; `dismissAction(id) → Promise<{updated:number}>`
  - `getGuidance(scope?) → Promise<Guidance[]>`; `addGuidance(scope, text) → Promise<{id:number}>`; `deleteGuidance(id) → Promise<{deleted:number}>`

- [ ] **Step 1: Write the failing test**

```ts
// src/api.actions.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createAction, approveAction, listActions } from './api'

afterEach(() => vi.restoreAllMocks())

it('createAction POSTs to /api/actions with body', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 5 }) })
  vi.stubGlobal('fetch', fetchMock)
  const r = await createAction({ action_type: 'email_new', payload: { to: 'a@b.com' } })
  expect(r.id).toBe(5)
  expect(fetchMock).toHaveBeenCalledWith('/api/actions', expect.objectContaining({ method: 'POST' }))
})

it('listActions builds status query', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
  vi.stubGlobal('fetch', fetchMock)
  await listActions('drafted')
  expect(fetchMock).toHaveBeenCalledWith('/api/actions?status=drafted')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- src/api.actions.test.ts`
Expected: FAIL (`createAction` is not exported).

- [ ] **Step 3: Implement in `src/api.ts`** (append near the other fetchers)

```ts
export interface Action {
  id: number
  entity_type?: string
  entity_id?: number
  action_type: string
  mode: string
  status: string
  payload?: Record<string, unknown>
  rationale?: string
  result?: Record<string, unknown>
  error?: string
  created_at: string
}
export interface Guidance { id: number; scope: string; text: string; created_at: string }

export interface ActionCreate {
  action_type: string
  entity_type?: string
  entity_id?: number
  mode?: string
  payload?: Record<string, unknown>
  rationale?: string
  approve?: boolean
}

export const listActions = (status?: string) =>
  fetchJson<Action[]>(`/api/actions${status ? `?status=${encodeURIComponent(status)}` : ''}`)
export const createAction = (body: ActionCreate) =>
  postJson<{ id: number }>('/api/actions', body as Record<string, unknown>)
export const approveAction = (id: number) =>
  postJson<{ updated: number }>(`/api/actions/${id}/approve`, {})
export const dismissAction = (id: number) =>
  postJson<{ updated: number }>(`/api/actions/${id}/dismiss`, {})

export const getGuidance = (scope?: string) =>
  fetchJson<Guidance[]>(`/api/guidance${scope ? `?scope=${encodeURIComponent(scope)}` : ''}`)
export const addGuidance = (scope: string, text: string) =>
  postJson<{ id: number }>('/api/guidance', { scope, text })
export const deleteGuidance = (id: number) =>
  del<{ deleted: number }>(`/api/guidance/${id}`)
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npm test -- src/api.actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.ts frontend/src/api.actions.test.ts
git commit -m "feat(actions): FE api types + fetchers"
```

---

## Task 2: Action registry (`lib/actions.ts`)

**Files:**
- Create: `src/lib/actions.ts`
- Test: `src/lib/actions.test.ts`

**Interfaces:**
- Produces:
  - `type EntityType = 'email'|'signal'|'news'|'person'|'task'|'deadline'`
  - `interface ActionField { key: string; label: string; type: 'text'|'textarea'; required?: boolean }`
  - `interface ActionSpec { type: string; label: string; mode: 'review'|'auto'; fields: ActionField[] }`
  - `ACTION_SPECS: Record<string, ActionSpec>`
  - `actionsForEntity(entity: EntityType): ActionSpec[]`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/actions.test.ts
import { describe, it, expect } from 'vitest'
import { actionsForEntity, ACTION_SPECS } from './actions'

it('email entity offers reply/forward/new', () => {
  const types = actionsForEntity('email').map((s) => s.type)
  expect(types).toEqual(expect.arrayContaining(['email_reply', 'email_forward', 'email_new']))
})
it('person entity offers teams + email + invite', () => {
  const types = actionsForEntity('person').map((s) => s.type)
  expect(types).toEqual(expect.arrayContaining(['teams_dm', 'teams_group', 'email_new', 'calendar_invite']))
})
it('every spec has at least one field and a mode', () => {
  for (const s of Object.values(ACTION_SPECS)) {
    expect(s.fields.length).toBeGreaterThan(0)
    expect(['review', 'auto']).toContain(s.mode)
  }
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- src/lib/actions.test.ts`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Implement `src/lib/actions.ts`**

```ts
export type EntityType = 'email' | 'signal' | 'news' | 'person' | 'task' | 'deadline'
export interface ActionField { key: string; label: string; type: 'text' | 'textarea'; required?: boolean }
export interface ActionSpec { type: string; label: string; mode: 'review' | 'auto'; fields: ActionField[] }

const emailFields: ActionField[] = [
  { key: 'to', label: 'To', type: 'text', required: true },
  { key: 'subject', label: 'Subject', type: 'text', required: true },
  { key: 'body', label: 'Body', type: 'textarea', required: true },
]
const teamsFields: ActionField[] = [
  { key: 'recipients', label: 'Recipients (comma-sep)', type: 'text', required: true },
  { key: 'message', label: 'Message', type: 'textarea', required: true },
]

export const ACTION_SPECS: Record<string, ActionSpec> = {
  email_reply: { type: 'email_reply', label: 'Reply', mode: 'review', fields: emailFields },
  email_forward: { type: 'email_forward', label: 'Forward', mode: 'review', fields: emailFields },
  email_new: { type: 'email_new', label: 'Email', mode: 'review', fields: emailFields },
  teams_dm: { type: 'teams_dm', label: 'Teams DM', mode: 'review', fields: teamsFields },
  teams_group: { type: 'teams_group', label: 'Group chat', mode: 'review', fields: teamsFields },
  teams_post: { type: 'teams_post', label: 'Teams post', mode: 'review', fields: teamsFields },
  status_set: { type: 'status_set', label: 'Set status', mode: 'auto',
    fields: [{ key: 'text', label: 'Status', type: 'text', required: true }] },
  calendar_invite: { type: 'calendar_invite', label: 'Calendar invite', mode: 'review',
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'attendees', label: 'Attendees (comma-sep)', type: 'text', required: true },
      { key: 'body', label: 'Notes', type: 'textarea' },
    ] },
  cowork_doc: { type: 'cowork_doc', label: 'Draft a doc', mode: 'auto',
    fields: [{ key: 'prompt', label: 'What to draft', type: 'textarea', required: true }] },
  cowork_gather: { type: 'cowork_gather', label: 'Gather info', mode: 'auto',
    fields: [{ key: 'prompt', label: 'What to look up', type: 'textarea', required: true }] },
}

const ENTITY_ACTIONS: Record<EntityType, string[]> = {
  email: ['email_reply', 'email_forward', 'email_new'],
  signal: ['email_new', 'teams_post', 'cowork_gather'],
  news: ['email_new', 'teams_post', 'cowork_gather'],
  person: ['teams_dm', 'teams_group', 'email_new', 'calendar_invite'],
  task: ['email_new', 'cowork_doc'],
  deadline: ['email_new', 'teams_dm'],
}

export function actionsForEntity(entity: EntityType): ActionSpec[] {
  return (ENTITY_ACTIONS[entity] ?? []).map((t) => ACTION_SPECS[t])
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npm test -- src/lib/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/actions.ts frontend/src/lib/actions.test.ts
git commit -m "feat(actions): FE action registry"
```

---

## Task 3: `ActionComposeModal` (generalized)

**Files:**
- Create: `src/components/actions/ActionComposeModal.tsx`
- Test: `src/components/actions/ActionComposeModal.test.tsx`

**Interfaces:**
- Consumes: `ACTION_SPECS` (Task 2), `createAction` (Task 1).
- Produces: `ActionComposeModal({ open, spec, entity?, onClose, onDone? })` where `spec: ActionSpec`, `entity?: {type: EntityType; id: number}`. Renders one field per `spec.fields`; buttons **Save draft** / **Approve & send** (the latter hidden when `spec.mode === 'auto'` — auto runs unattended, so only "Queue" shows). Submits via `createAction`; toasts; calls `onDone`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/actions/ActionComposeModal.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../../theme'
import { ACTION_SPECS } from '../../lib/actions'
import * as api from '../../api'
import { ActionComposeModal } from './ActionComposeModal'

afterEach(() => vi.restoreAllMocks())
const wrap = (ui: React.ReactNode) =>
  render(<ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">{ui}</ThemeProvider>)

it('submits an email draft with entered fields', async () => {
  const spy = vi.spyOn(api, 'createAction').mockResolvedValue({ id: 1 })
  wrap(<ActionComposeModal open spec={ACTION_SPECS.email_new}
        entity={{ type: 'signal', id: 9 }} onClose={vi.fn()} />)
  fireEvent.change(screen.getByLabelText('To'), { target: { value: 'a@b.com' } })
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Hi' } })
  fireEvent.change(screen.getByLabelText('Body'), { target: { value: 'Hello' } })
  fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
  await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({
    action_type: 'email_new', entity_type: 'signal', entity_id: 9, approve: false,
    payload: { to: 'a@b.com', subject: 'Hi', body: 'Hello' },
  })))
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- src/components/actions/ActionComposeModal.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/components/actions/ActionComposeModal.tsx`**

```tsx
import { useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from '@mui/material'
import { toast } from 'sonner'
import { createAction } from '../../api'
import type { ActionSpec, EntityType } from '../../lib/actions'

export function ActionComposeModal({ open, spec, entity, onClose, onDone }: {
  open: boolean
  spec: ActionSpec
  entity?: { type: EntityType; id: number }
  onClose: () => void
  onDone?: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const missing = spec.fields.some((f) => f.required && !values[f.key]?.trim())

  const submit = async (approve: boolean) => {
    await createAction({
      action_type: spec.type,
      entity_type: entity?.type,
      entity_id: entity?.id,
      mode: spec.mode,
      payload: values,
      approve,
    })
    toast.success(approve ? 'Approved — Scout will send it' : 'Saved to your Actions queue')
    setValues({})
    onDone?.()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontFamily: '"JetBrains Mono", monospace' }}>{spec.label}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
        {spec.fields.map((f) => (
          <TextField key={f.key} label={f.label} value={values[f.key] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            multiline={f.type === 'textarea'} rows={f.type === 'textarea' ? 4 : undefined}
            fullWidth required={f.required} />
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => submit(false)} disabled={missing}>Save draft</Button>
        {spec.mode === 'review' && (
          <Button variant="contained" onClick={() => submit(true)} disabled={missing}>Approve &amp; send</Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npm test -- src/components/actions/ActionComposeModal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/actions/ActionComposeModal.tsx frontend/src/components/actions/ActionComposeModal.test.tsx
git commit -m "feat(actions): generalized ActionComposeModal"
```

---

## Task 4: `ActionMenu` affordance

**Files:**
- Create: `src/components/actions/ActionMenu.tsx`
- Test: `src/components/actions/ActionMenu.test.tsx`

**Interfaces:**
- Consumes: `actionsForEntity` (Task 2), `ActionComposeModal` (Task 3).
- Produces: `ActionMenu({ entity, onDone? })` where `entity: {type: EntityType; id: number}`. Renders an icon-button (lucide `Zap`) → MUI `Menu` of the entity's actions; selecting one opens the compose modal for that spec.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/actions/ActionMenu.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../../theme'
import { ActionMenu } from './ActionMenu'

const wrap = (ui: React.ReactNode) =>
  render(<ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">{ui}</ThemeProvider>)

it('opens a menu listing the entity actions', () => {
  wrap(<ActionMenu entity={{ type: 'email', id: 1 }} />)
  fireEvent.click(screen.getByRole('button', { name: /actions/i }))
  expect(screen.getByRole('menuitem', { name: 'Reply' })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: 'Forward' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- src/components/actions/ActionMenu.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/components/actions/ActionMenu.tsx`**

```tsx
import { useState } from 'react'
import { IconButton, Menu, MenuItem, Tooltip } from '@mui/material'
import { Zap } from 'lucide-react'
import { actionsForEntity, type ActionSpec, type EntityType } from '../../lib/actions'
import { ActionComposeModal } from './ActionComposeModal'

export function ActionMenu({ entity, onDone }: {
  entity: { type: EntityType; id: number }
  onDone?: () => void
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null)
  const [spec, setSpec] = useState<ActionSpec | null>(null)
  const specs = actionsForEntity(entity.type)
  if (specs.length === 0) return null

  return (
    <>
      <Tooltip title="Actions">
        <IconButton size="small" aria-label="Actions" onClick={(e) => setAnchor(e.currentTarget)}>
          <Zap size={16} />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {specs.map((s) => (
          <MenuItem key={s.type} onClick={() => { setSpec(s); setAnchor(null) }}>{s.label}</MenuItem>
        ))}
      </Menu>
      {spec && (
        <ActionComposeModal open spec={spec} entity={entity}
          onClose={() => setSpec(null)} onDone={onDone} />
      )}
    </>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npm test -- src/components/actions/ActionMenu.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/actions/ActionMenu.tsx frontend/src/components/actions/ActionMenu.test.tsx
git commit -m "feat(actions): reusable ActionMenu affordance"
```

---

## Task 5: Actions review queue view + route + sidebar

**Files:**
- Create: `src/views/Actions.tsx`
- Test: `src/views/Actions.test.tsx`
- Modify: `src/App.tsx` (lazy import + route), `src/components/Sidebar.tsx` (nav item)

**Interfaces:**
- Consumes: `listActions`, `approveAction`, `dismissAction` (Task 1).
- Produces: `ActionsView` (named export). Three sections — **Pending review** (`status==='drafted' && mode==='review'`), **Running** (`status==='executing'`), **Recent results** (`status` in `completed`/`failed`, showing `result.access_url` as an "Open" link). Each pending row: rationale/preview + **Go** (approve) / Dismiss.

- [ ] **Step 1: Write the failing test**

```tsx
// src/views/Actions.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import * as api from '../api'
import { ActionsView } from './Actions'

afterEach(() => vi.restoreAllMocks())
const wrap = (ui: React.ReactNode) => render(
  <QueryClientProvider client={new QueryClient()}>
    <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">{ui}</ThemeProvider>
  </QueryClientProvider>)

it('renders a pending-review draft with a Go button', async () => {
  vi.spyOn(api, 'listActions').mockResolvedValue([
    { id: 1, action_type: 'email_new', mode: 'review', status: 'drafted',
      rationale: 'follow up', created_at: '2026-07-11T00:00:00Z' } as api.Action,
  ])
  wrap(<ActionsView />)
  await waitFor(() => expect(screen.getByText('follow up')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: /go/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- src/views/Actions.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 3a: Implement `src/views/Actions.tsx`**

```tsx
import { Box, Typography, Button, Stack, Chip, Link } from '@mui/material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { listActions, approveAction, dismissAction, type Action } from '../api'

const preview = (a: Action) =>
  a.rationale || (a.payload?.subject as string) || (a.payload?.message as string) || a.action_type

export function ActionsView() {
  const qc = useQueryClient()
  const { data: actions = [] } = useQuery({
    queryKey: ['actions'], queryFn: () => listActions(), refetchInterval: 10000,
  })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['actions'] })
  const go = useMutation({ mutationFn: approveAction,
    onSuccess: () => { toast.success('Approved'); invalidate() } })
  const drop = useMutation({ mutationFn: dismissAction,
    onSuccess: () => { toast('Dismissed'); invalidate() } })

  const pending = actions.filter((a) => a.status === 'drafted' && a.mode === 'review')
  const running = actions.filter((a) => a.status === 'executing')
  const recent = actions.filter((a) => a.status === 'completed' || a.status === 'failed').slice(0, 20)

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h5">Actions</Typography>

      <section>
        <Typography variant="subtitle2" gutterBottom>Pending review ({pending.length})</Typography>
        <Stack spacing={1}>
          {pending.map((a) => (
            <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', gap: 1,
                 border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
              <Chip size="small" label={a.action_type} />
              <Typography sx={{ flex: 1 }}>{preview(a)}</Typography>
              <Button size="small" variant="contained" onClick={() => go.mutate(a.id)}>Go</Button>
              <Button size="small" onClick={() => drop.mutate(a.id)}>Dismiss</Button>
            </Box>
          ))}
          {pending.length === 0 && <Typography variant="caption" color="text.secondary">Nothing waiting.</Typography>}
        </Stack>
      </section>

      <section>
        <Typography variant="subtitle2" gutterBottom>Running ({running.length})</Typography>
        <Stack spacing={1}>
          {running.map((a) => (
            <Typography key={a.id} variant="body2">⏳ {a.action_type} — {preview(a)}</Typography>
          ))}
        </Stack>
      </section>

      <section>
        <Typography variant="subtitle2" gutterBottom>Recent results</Typography>
        <Stack spacing={1}>
          {recent.map((a) => (
            <Typography key={a.id} variant="body2"
              color={a.status === 'failed' ? 'error' : 'text.primary'}>
              {a.status === 'failed' ? '✗' : '✓'} {a.action_type} — {preview(a)}{' '}
              {a.result?.access_url ? (
                <Link href={String(a.result.access_url)} target="_blank" rel="noreferrer">Open</Link>
              ) : null}
            </Typography>
          ))}
        </Stack>
      </section>
    </Box>
  )
}
```

- [ ] **Step 3b: Wire route in `src/App.tsx`**

Add lazy import beside the others:
```tsx
const ActionsView = lazy(() => import('@/views/Actions').then(m => ({ default: m.ActionsView })))
```
Add route inside `<Routes>` (near `/tasks`):
```tsx
                    <Route path="/actions" element={<ActionsView />} />
```

- [ ] **Step 3c: Add nav item in `src/components/Sidebar.tsx`**

Add `Zap` to the `lucide-react` import, and a NAV entry after `tasks`:
```tsx
  { id: 'actions', route: '/actions', icon: Zap, label: 'Actions' },
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npm test -- src/views/Actions.test.tsx && npm run lint`
Expected: PASS + lint clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Actions.tsx frontend/src/views/Actions.test.tsx frontend/src/App.tsx frontend/src/components/Sidebar.tsx
git commit -m "feat(actions): Actions review queue view + route + nav"
```

---

## Task 6: Inline `ActionBadge` + `useEntityActions`

**Files:**
- Create: `src/components/actions/useEntityActions.ts`, `src/components/actions/ActionBadge.tsx`
- Test: `src/components/actions/ActionBadge.test.tsx`

**Interfaces:**
- Consumes: `listActions` (Task 1).
- Produces:
  - `useEntityActions(): (type: string, id: number) => Action | undefined` — returns the most-relevant open action for an entity (drafted/approved/executing), from a single cached `listActions()` query.
  - `ActionBadge({ entityType, entityId })` — renders a small `Chip` (`draft ready` / `running` / nothing) linking to `/actions`; renders nothing when no open action.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/actions/ActionBadge.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../../theme'
import * as api from '../../api'
import { ActionBadge } from './ActionBadge'

afterEach(() => vi.restoreAllMocks())
const wrap = (ui: React.ReactNode) => render(
  <QueryClientProvider client={new QueryClient()}><MemoryRouter>
    <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">{ui}</ThemeProvider>
  </MemoryRouter></QueryClientProvider>)

it('shows "draft ready" when the entity has a drafted action', async () => {
  vi.spyOn(api, 'listActions').mockResolvedValue([
    { id: 1, entity_type: 'email', entity_id: 5, action_type: 'email_reply',
      mode: 'review', status: 'drafted', created_at: 'x' } as api.Action,
  ])
  wrap(<ActionBadge entityType="email" entityId={5} />)
  await waitFor(() => expect(screen.getByText(/draft ready/i)).toBeInTheDocument())
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- src/components/actions/ActionBadge.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 3a: Implement `src/components/actions/useEntityActions.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { listActions, type Action } from '../../api'

const OPEN = new Set(['drafted', 'approved', 'executing'])

export function useEntityActions() {
  const { data: actions = [] } = useQuery({
    queryKey: ['actions'], queryFn: () => listActions(), refetchInterval: 10000,
  })
  return (type: string, id: number): Action | undefined =>
    actions.find((a) => a.entity_type === type && a.entity_id === id && OPEN.has(a.status))
}
```

- [ ] **Step 3b: Implement `src/components/actions/ActionBadge.tsx`**

```tsx
import { Chip } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useEntityActions } from './useEntityActions'

const LABEL: Record<string, string> = {
  drafted: 'draft ready', approved: 'queued', executing: 'running',
}

export function ActionBadge({ entityType, entityId }: { entityType: string; entityId: number }) {
  const lookup = useEntityActions()
  const navigate = useNavigate()
  const a = lookup(entityType, entityId)
  if (!a) return null
  return (
    <Chip size="small" variant="outlined" color={a.status === 'executing' ? 'warning' : 'primary'}
      label={LABEL[a.status] ?? a.status} onClick={() => navigate('/actions')} />
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npm test -- src/components/actions/ActionBadge.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/actions/useEntityActions.ts frontend/src/components/actions/ActionBadge.tsx frontend/src/components/actions/ActionBadge.test.tsx
git commit -m "feat(actions): inline ActionBadge + useEntityActions hook"
```

---

## Task 7: Touchpoint wiring

**Files:**
- Modify: `src/views/Inbox.tsx`, `src/views/People.tsx`, `src/components/feed/FeedDetail.tsx`, `src/components/quickdraw/Quickdraw.tsx`
- Test: `src/views/Inbox.actions.test.tsx`

**Interfaces:**
- Consumes: `ActionMenu` (Task 4), `ActionBadge` (Task 6).

**Wiring per file** (add to each entity row/header; entity id = that row's `id`):
- **Inbox** signal row: `<ActionBadge entityType="email" entityId={s.id} /><ActionMenu entity={{ type: 'email', id: s.id }} />`.
- **People** card: `<ActionMenu entity={{ type: 'person', id: p.id }} />`.
- **FeedDetail** header: `<ActionMenu entity={{ type: 'news', id: item.id }} />` (use `'signal'` if the item is a signal — pick per the detail's `category`).
- **Quickdraw** "Pending Actions": import `listActions`, render `status==='drafted' && mode==='review'` count + a "Review in Actions" link to `/actions` (keep it compact; the full queue is the view).

- [ ] **Step 1: Write the failing test** (Inbox row shows the action menu)

```tsx
// src/views/Inbox.actions.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import * as api from '../api'
import { InboxView } from './Inbox'

afterEach(() => vi.restoreAllMocks())
const wrap = (ui: React.ReactNode) => render(
  <QueryClientProvider client={new QueryClient()}><MemoryRouter>
    <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">{ui}</ThemeProvider>
  </MemoryRouter></QueryClientProvider>)

it('each inbox signal exposes an Actions menu', async () => {
  vi.spyOn(api, 'getSignals').mockResolvedValue([
    { id: 42, type: 'email', source: 'x', title: 'Budget?', status: 'new' } as api.Signal,
  ])
  vi.spyOn(api, 'listActions').mockResolvedValue([])
  wrap(<InboxView />)
  await waitFor(() => expect(screen.getByText('Budget?')).toBeInTheDocument())
  expect(screen.getAllByRole('button', { name: /actions/i }).length).toBeGreaterThan(0)
})
```

*(Adjust the `getSignals` mock shape and any required providers to match `Inbox.tsx`'s real data hook — read the view first.)*

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- src/views/Inbox.actions.test.tsx`
Expected: FAIL (no Actions button yet).

- [ ] **Step 3: Add `<ActionMenu>`/`<ActionBadge>`** to each file listed above. Import from `@/components/actions/ActionMenu` and `@/components/actions/ActionBadge`. Place in the existing row action area (match each view's current layout — do not restructure).

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npm test -- src/views/Inbox.actions.test.tsx && npm run lint`
Expected: PASS + lint clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Inbox.tsx frontend/src/views/People.tsx frontend/src/components/feed/FeedDetail.tsx frontend/src/components/quickdraw/Quickdraw.tsx frontend/src/views/Inbox.actions.test.tsx
git commit -m "feat(actions): wire ActionMenu/Badge into Inbox, People, Feed, Quickdraw"
```

---

## Task 8: CommandPalette global entry

**Files:**
- Modify: `src/components/CommandPalette.tsx`
- Test: `src/components/CommandPalette.actions.test.tsx`

**Interfaces:**
- Consumes: router navigation already in the palette (`onViewChange` / route).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/CommandPalette.actions.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../theme'
import { CommandPalette } from './CommandPalette'

const wrap = (ui: React.ReactNode) =>
  render(<ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">{ui}</ThemeProvider>)

it('offers a "Go to Actions" quick command', () => {
  wrap(<CommandPalette open onOpenChange={vi.fn()} onViewChange={vi.fn()} onRefresh={vi.fn()} />)
  expect(screen.getByText(/actions/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- src/components/CommandPalette.actions.test.tsx`
Expected: FAIL (no Actions command).

- [ ] **Step 3: Add a quick-action item** in the "quick actions" `CommandGroup` (near the existing `onViewChange('deadlines')` item):

```tsx
              <Command.Item onSelect={() => { onViewChange('actions'); close() }}>
                Go to Actions
              </Command.Item>
```

*(Match the exact `Command.Item` / styling props the neighbouring items use.)*

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npm test -- src/components/CommandPalette.actions.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CommandPalette.tsx frontend/src/components/CommandPalette.actions.test.tsx
git commit -m "feat(actions): CommandPalette entry for Actions"
```

---

## Task 9: Guidance UI — popover + Settings panel

**Files:**
- Create: `src/components/actions/GuidancePopover.tsx`
- Test: `src/components/actions/GuidancePopover.test.tsx`
- Modify: `src/views/Settings.tsx` (Guidance panel)

**Interfaces:**
- Consumes: `getGuidance`, `addGuidance`, `deleteGuidance` (Task 1).
- Produces:
  - `GuidancePopover({ scope })` — a note icon-button opening a popover with existing notes for `scope` + a text field to add one.
  - Settings **Guidance** section listing all guidance (`getGuidance()`), each deletable.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/actions/GuidancePopover.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '../../theme'
import * as api from '../../api'
import { GuidancePopover } from './GuidancePopover'

afterEach(() => vi.restoreAllMocks())
const wrap = (ui: React.ReactNode) => render(
  <QueryClientProvider client={new QueryClient()}>
    <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="ea-theme">{ui}</ThemeProvider>
  </QueryClientProvider>)

it('adds a guidance note for the scope', async () => {
  vi.spyOn(api, 'getGuidance').mockResolvedValue([])
  const add = vi.spyOn(api, 'addGuidance').mockResolvedValue({ id: 1 })
  wrap(<GuidancePopover scope="topic:AI" />)
  fireEvent.click(screen.getByRole('button', { name: /guidance/i }))
  fireEvent.change(screen.getByLabelText(/note/i), { target: { value: 'ignore vendor spam' } })
  fireEvent.click(screen.getByRole('button', { name: /add/i }))
  await waitFor(() => expect(add).toHaveBeenCalledWith('topic:AI', 'ignore vendor spam'))
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npm test -- src/components/actions/GuidancePopover.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 3a: Implement `src/components/actions/GuidancePopover.tsx`**

```tsx
import { useState } from 'react'
import { IconButton, Popover, Box, Typography, TextField, Button, Stack, Tooltip } from '@mui/material'
import { StickyNote } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getGuidance, addGuidance } from '../../api'

export function GuidancePopover({ scope }: { scope: string }) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null)
  const [text, setText] = useState('')
  const qc = useQueryClient()
  const { data: notes = [] } = useQuery({
    queryKey: ['guidance', scope], queryFn: () => getGuidance(scope), enabled: !!anchor,
  })
  const add = useMutation({
    mutationFn: () => addGuidance(scope, text),
    onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['guidance', scope] }) },
  })

  return (
    <>
      <Tooltip title="Guidance">
        <IconButton size="small" aria-label="Guidance" onClick={(e) => setAnchor(e.currentTarget)}>
          <StickyNote size={16} />
        </IconButton>
      </Tooltip>
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)}>
        <Box sx={{ p: 2, width: 300, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">Notes Scout will honor for {scope}</Typography>
          <Stack spacing={0.5}>
            {notes.map((n) => <Typography key={n.id} variant="body2">• {n.text}</Typography>)}
          </Stack>
          <TextField label="New note" value={text} onChange={(e) => setText(e.target.value)}
            size="small" multiline rows={2} fullWidth />
          <Button size="small" variant="contained" disabled={!text.trim()} onClick={() => add.mutate()}>Add</Button>
        </Box>
      </Popover>
    </>
  )
}
```

- [ ] **Step 3b: Add a Guidance panel to `src/views/Settings.tsx`**

Add a section that lists all guidance and lets the user delete entries:
```tsx
// inside Settings, using useQuery(['guidance'], () => getGuidance()) and deleteGuidance
// Render each row: `{g.scope}: {g.text}` with a delete IconButton (Trash2) that calls
// deleteGuidance(g.id) then invalidates ['guidance'].
```
Follow the existing Settings section layout (Box + Typography headers). Import `getGuidance`, `deleteGuidance` from `@/api`.

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && npm test -- src/components/actions/GuidancePopover.test.tsx && npm run lint`
Expected: PASS + lint clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/actions/GuidancePopover.tsx frontend/src/components/actions/GuidancePopover.test.tsx frontend/src/views/Settings.tsx
git commit -m "feat(actions): guidance popover + Settings panel"
```

---

## Task 10: Full frontend suite + build green

- [ ] **Step 1: Run tests, lint, build**

Run: `cd frontend && npm test && npm run lint && npm run build`
Expected: all pass; build succeeds.

- [ ] **Step 2: Fix any regression** (do not weaken existing tests to pass).

- [ ] **Step 3: Commit fixups**

```bash
git add -A && git commit -m "test(actions): frontend suite + build green"
```

---

## Self-Review (completed by author)

- **Spec coverage:** §D registry/menu/compose/api → T1-4; §E queue/badges → T5-6, guidance UI → T9; §F touchpoints → T7, CommandPalette → T8; sidebar/route → T5. ✓
- **Placeholders:** code steps carry full code. Three "match the real view/props" notes (T7 Inbox mock, T8 Command.Item props, T9 Settings layout) are integration cues requiring the engineer to read the target file first — not missing logic.
- **Type consistency:** `EntityType`/`ActionSpec`/`ACTION_SPECS` defined T2, consumed unchanged T3-4; `Action` interface defined T1, consumed T5-6; `createAction` body shape identical T1↔T3; `listActions` query key `['actions']` shared by T5/T6 (one cache).

## Out of scope (this plan)

- Backend (`2026-07-11-outgoing-actions-backend.md`) — must land first.
- SP-B Reminders/Alerts (sound, browser notifications, timers). Completed actions surface via toast + the queue for now.
