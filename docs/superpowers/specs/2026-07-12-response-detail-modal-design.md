# Response Detail Modal (F1) — Design

**Date:** 2026-07-12
**Status:** Approved (design), pending spec review → plan
**Type:** Single feature, two implementation phases (backend field → frontend modal)
**Scope:** Backend (one column + plumbing) + frontend (new modal + wiring).

## Problem

Quickdraw "Needs Response" items (signals + alerts) currently do nothing rich on click — `QuickdrawItem.onOpen` just `window.open(url)`. The "Reply" action opens a toast-only stub (`quickdraw/ActionComposeModal`) that takes no real action. The user cannot see an item's full context (the 5 W's, the AI's reasoning for surfacing it) or take real actions without leaving the rail.

## Goal

Click a response item → a Dialog showing the **entire context** (5 W's + AI reasoning) and offering **every real action**, so the user understands and acts without hunting.

## Decisions (locked)

- **Surface:** centered MUI `Dialog` (house style: `HelpDialog` / `actions/ActionComposeModal`), not a slide-in panel — Quickdraw is already the right rail.
- **"LLM logic":** add a real backend `reasoning` field (signals store no such column today). Modal degrades gracefully when absent.
- **Reasoning on signals only.** Alerts stay thin (system alerts, not LLM-triaged).
- **Actions:** wire the real actions infrastructure (`actions/ActionMenu` + `actions/ActionComposeModal` + `createAction`) — specs `email_new`, `teams_post`, `cowork_gather` for signals — plus Silence / Dismiss / Open-URL.
- **Retire** the toast-only `quickdraw/ActionComposeModal` stub (only `NeedsResponseSection` references it).

## Architecture

### Phase 1 — backend `reasoning` field

- **Migration:** add `reasoning TEXT` to `signals`. Follow the existing additive-column migration pattern (ref: loud-alerting `repeat_count`, commit `3b32547`), and add the column to `backend/ea/schema.sql` (`signals` table, ~line 40).
- **Write paths accept it (optional):**
  - MCP `add_signal` (`backend/mcp_server/server.py` ~line 18) gains `reasoning: str | None = None`, passed through to the DB insert.
  - Web signal-create path (if any) mirrors it.
  - `backend/ea/db.py` signal insert whitelist includes `reasoning`.
- **Read path:** `signals` is returned via `SELECT *`, so `reasoning` flows to the API with no change. Add `reasoning?: string` to the frontend `Signal` type (`frontend/src/api.ts` ~line 53).
- Existing rows have `NULL` reasoning → modal shows a graceful fallback.

### Phase 2 — frontend modal

**New:** `frontend/src/components/quickdraw/ResponseDetailModal.tsx`

Props: `{ open: boolean; item: Signal | Alert | null; kind: 'signal' | 'alert'; onClose: () => void; onStatus: (value: string) => void }`

**Signal layout:**
- Header: title · type/source · `source_skill` badge · status chip
- **5 W's grid:** `who` · `what` · `when_rel` · `why` (each missing → dimmed "—")
- Summary (`summary`)
- **AI Reasoning block:** `reasoning` if present; else fallback line "Flagged by {source_skill}" + `why`; else "No reasoning recorded yet."
- Meta row: `priority` + `triage_rank` (AI urgency), `created_at` / `occurred_at`
- URL as a link (if present)
- **Actions:** `ActionMenu entity={{ type: 'signal', id }}` (real specs → `createAction`) + Silence + Dismiss + Open URL

**Alert layout:** title, `body`, `severity`, source (`source_table`/`source_id`), timestamps, status, URL, + Silence / Dismiss. No 5W / reasoning.

**Wiring in `NeedsResponseSection.tsx`:**
- It already holds full `signalsQ.data` / `alertsQ.data`.
- Replace per-item `onOpen={window.open(url)}` with `onOpen={() => openDetail(r)}`.
- `openDetail(r)` looks up the full object by `r.id` from the matching query array, sets `{ kind, item }` state, opens `ResponseDetailModal`.
- Status/Silence/Dismiss reuse the existing `status.mutate(...)` mutation.
- Remove the `reply` state + stub `ActionComposeModal` import/usage.
- Delete `quickdraw/ActionComposeModal.tsx` and its references.

## Data flow

```
QuickdrawItem (click) → NeedsResponseSection.openDetail(r)
  → find full Signal/Alert by id in already-fetched query data
  → ResponseDetailModal(open, item, kind)
     → status actions: status.mutate → invalidate ['signals']/['alerts']
     → real actions: ActionMenu → actions/ActionComposeModal → createAction → /api/actions
     → Open URL: window.open(item.url)
```

## Components / boundaries

| Unit | Responsibility | Depends on |
|---|---|---|
| `ResponseDetailModal` | Presents one signal/alert fully; hosts actions | `Signal`/`Alert` types, `ActionMenu`, MUI Dialog |
| `NeedsResponseSection` (mod) | Owns detail-modal state; supplies full object; status mutations | `ResponseDetailModal`, `getSignals`/`getAlerts` |
| backend `reasoning` col | Stores AI rationale per signal | migration, `add_signal`, `db.py` whitelist |

## Error / edge handling

- Missing 5W / summary / reasoning / url → dimmed "—" or fallback copy; never blank crash.
- Alert with no `body` → "No detail." Actions limited to Silence/Dismiss (no signal action specs).
- `ActionMenu` already handles no-open-actions state.
- Modal closes on backdrop/Escape (MUI Dialog default) and after a destructive status action.

## Testing

**Frontend (`ResponseDetailModal.test.tsx`):**
- Signal: renders all 5 W's; a missing W renders dimmed "—".
- Reasoning: shows `reasoning` when present; shows fallback when null.
- Silence/Dismiss buttons call `onStatus` with `'read'` / `'dismissed'`.
- Alert variant: hides the 5W grid and reasoning block.
- `NeedsResponseSection`: clicking an item opens the modal with the correct full object (not just ResponseItem).

**Backend:**
- Migration adds `reasoning` column (idempotent).
- `add_signal(reasoning=...)` round-trips: insert then read returns the value.

## Success criteria

- Clicking any Needs-Response item opens the detail modal (no more bare `window.open`).
- Signal modal shows 5 W's + an AI-reasoning block + all real actions + status ops.
- Alert modal shows its available fields + status ops.
- `reasoning` persists end-to-end (skill/MCP write → API → modal).
- Stub `quickdraw/ActionComposeModal` removed; no dead references.
- All existing timer/quickdraw tests stay green.

## Non-goals

- No reasoning on alerts.
- No new signal/alert read endpoint (reuse fetched arrays).
- Not backfilling reasoning for old signals (NULL → graceful fallback).
- Not changing which actions exist (`email_new`/`teams_post`/`cowork_gather` are as-defined in `lib/actions.ts`).
