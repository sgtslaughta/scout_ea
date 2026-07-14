# Scout Setup Wizard — Design

Date: 2026-07-14
Status: Approved (design), ready for implementation plan

## Problem

The Skills area was built around per-skill schedules driven by a Scout
"heartbeat". Two things changed after wiring the app to Scout (the MS Copilot
host):

1. **Heartbeat is a singleton and unusable** — we stop relying on it. Timing
   no longer lives in skills.
2. **MCP setup in Scout is UI-driven and clean** — add a server in Scout's MCP
   dialog by pointing it at `http://host:port/mcp` and pasting an auth token;
   Scout then sees all tools by name.

We now separate two concepts:

- **Skill** = instructions for *how* to do a task (pure, no schedule).
- **Automation** = *when* + *what* ("Every weekday at 2:00 PM" → "Run the
  'triage_email' skill"), created in Scout's UI.

Beginners need to be walked through connecting the MCP, adding skills, and
adding automations, in that order, with near-zero friction: explain each step,
make everything click-to-copy, hide long skill text unless asked, and let them
prove the connection works.

## Goal

Replace today's Skills DataGrid with a 3-step **Setup Wizard** that guides a
non-technical user through:

1. Connect the MCP (name it, copy URL + token into Scout, validate).
2. Add skills (copy skill instructions into Scout).
3. Add automations (pick a frequency, copy "Run the 'X' skill" into Scout).

Full skill bodies remain reachable via a deep-inspect view. Run
observability (last-run/status) folds into the existing Activity tab.

## Non-goals

- The wizard does **not** drive or automate Scout. Scout is an external UI app;
  the wizard produces copy-paste payloads and validates the result. The human
  clicks in Scout.
- No rewrite of skill execution, the MCP tools, or the scheduler.
- No editing of skill *task logic* — only removing schedule/heartbeat language
  from bodies and inserting the `{{mcp_name}}` token where the server is named.

## Decisions (locked)

| Topic | Decision |
|-------|----------|
| Heartbeat | Ignore it. Timing lives in Scout automations only. |
| Skill/automation split | Skills = pure instructions; automations = when+what. |
| MCP name reuse | **Persist + template**: save chosen name to config; render `{{mcp_name}}` live before copy. |
| Old grid | Wizard is primary; deep-inspect view retained for full bodies. |
| Validation | **Passive last-seen poll** — no new MCP tool. |
| Frequency format | **Natural-language presets** ("Every weekday at 2:00 PM"). |
| Wizard structure | MUI `Stepper`, single view, revisitable (Approach A). |

## Architecture

Two processes share one SQLite DB (`eadata` volume): the **web API**
(`backend/web/app.py`, port 8765) and the **MCP server**
(`backend/mcp_server`, port 8766). The wizard is a frontend view talking to the
web API; validation works because the MCP middleware writes a timestamp the web
API reads from the shared `config` table.

```
Scout (external UI)
   │  paste URL+token in MCP dialog
   ▼
MCP server :8766  ──(each authed request)──►  config['mcp_last_seen'] = iso ts
   ▲                                                    │ (shared SQLite)
   │ tools/list, tool calls                             ▼
Frontend SetupWizard ──GET /api/mcp/config──► web API :8765
                     ──GET /api/mcp/status──►  (reads mcp_last_seen)
                     ──GET /api/config, POST /api/config/mcp_name──►
                     ──GET /api/skills──► (bodies with {{mcp_name}} token)
```

## Backend changes (minimal)

### 1. Persist MCP name + wizard state
- Add `mcp_name` (default `scout-ea`) and `wizard_done` (default `""`) to the
  **writable-config whitelist** used by `db.set_config` /
  `POST /api/config/{key}`. Reuses existing `GET /api/config`.
- No new table — the `config` kv already exists.

### 2. Expose MCP connection details — `GET /api/mcp/config`
- Returns `{ "url": "http://localhost:8766/mcp", "token": "<EA_MCP_TOKEN>" }`.
- `url` built from `EA_MCP_HOST`/`EA_MCP_PORT` (host portion editable in the UI
  for LAN/remote Scout); path always `/mcp`.
- **Deliberate secret exposure:** the token is shown to the authenticated local
  dashboard user because they must paste it into Scout. This is a single-user
  local EA; the token already lives in their `.env`. Mark with a
  `# ponytail:` comment noting it's intentional and localhost-scoped.

### 3. Validation last-seen
- In `BearerAuthMiddleware` (`backend/mcp_server/auth.py`), on each
  **successful** auth, write `config['mcp_last_seen'] = <iso8601 utc>`
  (single-row upsert; best-effort, must never break the request).
- New `GET /api/mcp/status` → `{ "last_seen": "<iso|null>" }`.
- Wizard captures a "step-open" timestamp, polls `/api/mcp/status`, and shows a
  green check once `last_seen > step_open`.

## Skill templating

- Skill bodies use a `{{mcp_name}}` token wherever they name the server.
- Frontend substitutes `{{mcp_name}}` with the persisted name at render/copy
  time. `GET /api/skills` is unchanged (still returns raw `body`).
- Skill bodies are edited to be **pure instructions**: remove
  schedule/heartbeat phrasing; insert `{{mcp_name}}` where relevant. Existing
  `schedule:` frontmatter may stay as an informational default but is no longer
  the source of truth for timing.

## Frontend — `SetupWizard.tsx`

MUI `Stepper`, single view, Back/Next, steps revisitable. Each step opens with
a dense plain-English "what you're doing and why" explainer. Everything is
click-to-copy.

### Step 1 · Connect the MCP
- Explainer: what an MCP connection is and why Scout needs it.
- **Name field** — user names the connection (default `scout-ea`); saved via
  `POST /api/config/mcp_name`. This name is reused in Steps 2–3.
- **Copy URL** and **Copy token** rows (from `GET /api/mcp/config`); host in the
  URL is editable.
- Numbered "in Scout" instructions: open the MCP dialog → paste URL → paste
  token → save.
- **Validate** panel: a copy-me prompt ("Ask Scout: *List your available
  tools*"), then a live status indicator that flips to ✓ "Scout reached your
  MCP" when `/api/mcp/status` advances past the moment the panel opened.

### Step 2 · Add Skills
- Explainer: a skill = reusable instructions Scout follows.
- Compact cards, one per skill: **name** + one-line description + **Copy**
  button. Body **hidden** by default.
- **View** opens the deep-inspect drawer (full body).
- Copy payload = skill body with `{{mcp_name}}` rendered to the saved name.
- Instruction: "In Scout, create a Skill and paste this."

### Step 3 · Add Automations
- Explainer: an automation = when + what.
- Per skill, a row with:
  - **Frequency** preset picker (NL): "Every weekday at 2:00 PM",
    "Every 30 minutes", "Every hour", "Every day at 7:00 AM", … + a custom
    free-text field. Copyable.
  - **Action** text, auto-generated: `Run the '<skill>' skill`. Copyable.
- Instruction: "In Scout, create an Automation, set the schedule, paste the
  action."
- **Finish** sets `wizard_done`.

### Deep-inspect (retained)
- Full skill bodies shown in a drawer/modal reachable from Step 2 **View** and
  from a secondary "All skills" affordance. Reuses today's detail-modal code
  from `Skills.tsx`.
- Route: Skills area (`/automations` skills tab) renders the wizard; the old
  DataGrid is removed. Activity tab keeps last-run/status observability.

## Error handling

- `GET /api/mcp/config`: if `EA_MCP_TOKEN` unset, return the URL with an empty
  token and a `configured: false` flag; UI shows "token not set on server".
- `mcp_last_seen` write is best-effort; failure never blocks an MCP request.
- `/api/mcp/status` returns `last_seen: null` before any call — UI shows a
  neutral "waiting for Scout" state, never an error.
- Copy actions surface the existing toast on success.

## Testing

**Backend**
- `mcp_name` and `wizard_done` are writable via `POST /api/config/{key}`;
  non-whitelisted keys still rejected.
- `GET /api/mcp/config` returns url + token; empty-token path sets
  `configured: false`.
- `BearerAuthMiddleware` stamps `mcp_last_seen` on authed request; unauth
  request does not stamp.
- `GET /api/mcp/status` reflects the stamped value; `null` before first call.

**Frontend**
- Stepper renders the 3 steps and navigates Back/Next.
- Name field persists (POST fired) and the chosen name substitutes into a
  copied skill body (`{{mcp_name}}` → name).
- Copy buttons write the rendered payload to the clipboard.
- Validation indicator flips to ✓ when polled `last_seen` advances past
  step-open.
- Skill body hidden until **View**.

## Files touched (anticipated)

- `backend/ea/db.py` — add `mcp_name`, `wizard_done` to writable-config set.
- `backend/web/app.py` — `GET /api/mcp/config`, `GET /api/mcp/status`.
- `backend/mcp_server/auth.py` — stamp `mcp_last_seen`.
- `frontend/src/views/SetupWizard.tsx` — new wizard.
- `frontend/src/views/Automations.tsx` — render wizard instead of grid.
- `frontend/src/views/Skills.tsx` — reduce to deep-inspect drawer (reuse modal).
- `frontend/src/api.ts` — `getMcpConfig`, `getMcpStatus`, config helpers.
- `skills/*/SKILL.md` — insert `{{mcp_name}}`, strip heartbeat/schedule prose.
- Tests alongside each.
