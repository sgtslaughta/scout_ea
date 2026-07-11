# SP-A: Outgoing Actions — Design

**Date:** 2026-07-11
**Status:** Approved (brainstorm), pending spec review
**Program:** Outgoing Actions (SP-A of the Actions + Alerts initiative; SP-B = Reminders/Alerts, later)

## Goal

Give Scout the ability to *act* on the user's behalf — draft/send email, Teams
messages, calendar invites, set status, and do self-directed cowork (generate a
doc, gather data) — surfaced at **every** touchpoint in the app, not just the
Quickdraw drawer. Actions are **draft-first, human-approved** by default;
self-directed work auto-runs and logs its result.

## Principles / decisions

- **Host = MS Copilot Scout (desktop).** It schedules + runs the skills and bridges
  M365 + the local machine. This repo is the brain/data/UI. (See §C.)
- **Draft-first, human approves.** Outbound-to-humans (email/Teams/invite) stages
  a draft; nothing leaves until the user clicks **Go**. Self-directed work
  (`cowork_*`, `status_set`) runs automatically (`mode=auto`).
- **App-wide, not Quickdraw-bound.** A shared action layer (registry + one
  reusable menu component) attaches actions to any entity in any view.
- **Skills are the only execution path — no `m365` calls from the web server.**
  `scout_actions` is the *brain*: it scans and drafts, but does **not** execute.
  A small set of **parallel executor skills**, partitioned by weight, poll for
  approved actions and run them, writing results back via MCP. Heavy, slow work
  (cowork doc/gather) runs in its own loop so it never blocks light outbound sends.
- **Follow existing patterns.** sqlite + thin MCP tools (like `add_task`), typed
  fetchers in `api.ts`, MUI Dialog + `sonner` toasts, SKILL.md with a `schedule`
  frontmatter tracked by `skill_health.py`.

## A. Data model — `actions` table (sqlite)

One row per action, whoever created it.

| column        | type    | notes |
|---------------|---------|-------|
| `id`          | int pk  | |
| `entity_type` | text    | `email`\|`signal`\|`person`\|`task`\|`deadline`\|`news`\|null |
| `entity_id`   | int     | powers inline badges; null for entity-less actions |
| `action_type` | text    | see taxonomy below |
| `mode`        | text    | `review` \| `auto` |
| `status`      | text    | `drafted`\|`approved`\|`executing`\|`completed`\|`failed`\|`dismissed` |
| `payload`     | json    | type-specific draft (to/subject/body, invitees, status text, prompt…) |
| `rationale`   | text    | why the skill drafted it (shown in queue) |
| `created_by`  | text    | `skill` \| `user` |
| `approved_at` | text    | ISO ts when human clicked Go |
| `executed_at` | text    | ISO ts when skill ran it |
| `result`      | json    | `{ok, detail, access_url?}` on success |
| `error`       | text    | message on failure |
| `created_at`  | text    | ISO ts |

### Lifecycle

```
mode=review:  drafted → approved → executing → completed | failed
mode=auto:              (skip)   → executing → completed | failed
either:       drafted → dismissed          (human rejects)
```

### Action taxonomy (v1)

| action_type       | default mode | executor skill | m365 / handler | entities |
|-------------------|--------------|----------------|----------------|----------|
| `email_reply`     | review | `run_comms`   | Graph sendMail (reply) | email |
| `email_forward`   | review | `run_comms`   | Graph sendMail (forward) | email |
| `email_new`       | review | `run_comms`   | Graph sendMail | signal, news, person, task, deadline |
| `teams_dm`        | review | `run_teams`   | Graph chat create+message | person |
| `teams_group`     | review | `run_teams`   | Graph group chat + message | person(s) |
| `teams_post`      | review | `run_teams`   | Graph channel message | signal, news |
| `status_set`      | auto   | `run_comms`   | Graph presence/status | — |
| `calendar_invite` | review | `run_calendar`| Graph event + attendees (reuses create_events) | person, calendar |
| `cowork_doc`      | auto   | `run_cowork`  | generate doc → `access_url` | any |
| `cowork_gather`   | auto   | `run_cowork`  | query dataverse → `access_url`/result detail | any |

Each `action_type` maps to exactly one executor skill. Modes are defaults; a
table-driven map in the skill + registry, tunable later.

## B. MCP tools + web API

**MCP (skill-facing, thin — same pattern as `add_task` in `mcp_server/`):**
- `add_action(entity_type, entity_id, action_type, mode, payload, rationale) -> id`
- `list_actions(status=None, mode=None) -> rows` — skill polls `status=approved`
  and its own `mode=auto` drafts to execute.
- `update_action(id, status, result=None, error=None) -> int` — result write-back.
- `add_guidance(scope, text) -> id`, `list_guidance(scope=None) -> rows` (see §E).

**Web API (UI-facing, `web/app.py`) — status flips only, never sends:**
- `GET  /actions?status=` — queue + badges
- `POST /actions` — user-initiated draft (`created_by=user`; `status=drafted` or
  `approved` if "Approve & send")
- `POST /actions/{id}/approve` — `drafted → approved`
- `POST /actions/{id}/dismiss` — `→ dismissed`
- `GET/POST/DELETE /guidance`

## C. Skills — one brain + parallel executors

### C.1 `scout_actions` — the brain (5-minute heartbeat)

New `skills/scout_actions/SKILL.md`, `schedule: heartbeat 5m`. **Drafts only, no
execution.** Each tick:

1. **Scan** — read recent signals/emails/deadlines/people + relevant
   **guidance** (§E); reason about what warrants an action; `add_action(...)`
   drafts (`review` for outbound, `auto` for cowork/status).
2. **Report** — `log_skill_run(skill, items_created, status, detail)` so existing
   skill-health/observability picks it up.

**Idempotency:** before drafting, skip if the same `entity_id + action_type` has
an open (`drafted`/`approved`/`executing`) or recently-completed action — dedup
guard prevents re-drafting every tick.

### C.2 Executor skills (parallel, partitioned by weight)

Each runs its own independent loop, polls only its slice, executes, writes back.
Running in parallel means slow cowork never blocks fast sends.

| skill          | schedule     | owns action_types | why separate |
|----------------|--------------|-------------------|--------------|
| `run_comms`    | heartbeat 5m | email_*, status_set | light email sends + presence |
| `run_teams`    | heartbeat 5m | teams_*           | Teams chat/group/channel; own loop |
| `run_calendar` | heartbeat 5m | calendar_invite   | reuses create_events logic |
| `run_cowork`   | heartbeat 10m| cowork_doc, cowork_gather | heavy/slow; isolated so it can't stall sends |

Each executor tick:
1. **Claim** — poll its `action_type`s for runnable rows: `status=approved`
   (`mode=review`) **or** `status=drafted, mode=auto`. Atomically flip
   `→ executing` (single `UPDATE … WHERE status IN (...) AND id=?`, check rowcount)
   before running so no double-execution.
2. **Run** — `m365.call(action, params)` or the doc/gather handler. Auto cowork
   sets `result.access_url` (or opens the doc).
3. **Write back** — `update_action(status=completed|failed, result=…, error=…)`,
   then `log_skill_run(...)`.

**Adding a heavier action later** = add its type to the taxonomy and give it (or a
new) executor skill; the brain, model, MCP, and UI are unchanged.

**Runtime = MS Copilot Scout (desktop host).** Copilot Scout is the scheduler: it
runs the scheduled SKILL.md files on their cadence and provides the connections to
Microsoft products **and the user's local machine** — so executors can send via
Graph, generate/open documents locally, and gather local/dataverse data on the
user's behalf. This repo is the brain/data/UI: it defines skills, holds the
`actions` DB, exposes MCP tools, and renders the queue. `m365.call(action, params)`
is the Graph bridge Copilot Scout backs. No in-repo dispatcher needed.

## D. Frontend shared action layer

- **`lib/actions.ts` — registry** (single source of truth):
  - `entity_type → available action_types`
  - `action_type → {label, icon, mode, payloadFields}`
  Every touchpoint reads this; no per-view action logic.
- **`<ActionMenu entity={{type,id}} />`** — reusable icon-button → MUI Menu listing
  the entity's registry actions; opens compose. Drop into any row/card.
- **`ActionComposeModal`** (generalize existing Quickdraw stub) — type-aware
  fields per §A taxonomy. Buttons: **Save draft** (`drafted`) / **Approve & send**
  (`approved`). Submits `POST /actions`.
- **`api.ts`** — `Action` interface + `listActions/createAction/approveAction/
  dismissAction`.

## E. Review queue, badges, guidance UI

- **`views/Actions.tsx`** — source-of-truth queue. Sections: *Pending review*
  (`status=drafted, mode=review` — auto drafts don't appear here, they just run),
  *Running* (executing), *Recent results* (completed/failed + `access_url`
  "Open document"). Row: preview + **Go** / Edit / Dismiss.
- **Quickdraw** — compact "Pending Actions" section mirroring the queue.
- **Inline badges** — entity rows with an open action show a chip
  (`◔ draft ready` / `⏳ running` / `✓ done`) linking to it; computed from
  `listActions` grouped by entity.
- **Sidebar** — new **Actions** nav item with pending-count badge.
- **Guidance** — note-icon on topics/people/feed items → popover →
  `POST /guidance{scope,text}`. **Settings → Guidance** panel lists/edits/deletes
  all notes. Skills read via `list_guidance(scope)`.

## F. Touchpoint wiring (drop-in `<ActionMenu>`)

Inbox rows · FeedDetail/overview items · People cards · Calendar (new invite) ·
Deadlines/Tasks (nudge) · **CommandPalette** ("New action…" global entry with
entity picker) · Quickdraw needs-response. All the same component.

## G. Testing

- **FE (vitest):** registry mapping; `ActionMenu` renders correct actions per
  entity; compose validation per type; queue approve/dismiss call API; badge
  states.
- **BE (pytest):** actions CRUD + status transitions; **atomic claim**
  (`approved → executing` won't double-claim); MCP `add/list/update_action`;
  web endpoints; dedup guard; guidance CRUD.

## H. Phasing (for the implementation plan)

1. Backend: `actions` table + MCP tools (incl. atomic claim) + web API + guidance.
2. `scout_actions` brain skill (scan / draft / report + dedup).
3. Executor skills: `run_comms`, `run_teams`, `run_calendar`, `run_cowork` (claim / run / write back).
4. FE shared layer: registry + `ActionMenu` + compose + `api.ts`.
5. `views/Actions.tsx` queue + badges + Quickdraw section + sidebar.
6. Touchpoint wiring + CommandPalette entry.
7. Guidance UI (note-icon popover + Settings panel).

## Out of scope (SP-A)

- SP-B Reminders/Alerts (sound, browser notifications, stopwatch/timer, alarm
  modal, multi-interval reminders). Completed actions surface via in-app toast +
  the Actions queue for now; SP-B plugs in later.
- Immediate server-side send (rejected — skills are the only execution path).
