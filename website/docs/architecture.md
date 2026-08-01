# Architecture

Two surfaces over one SQLite database.

```mermaid
graph LR
  Scout["Microsoft Scout<br/>(24 skills)"] -->|bearer MCP :8766| MCP["MCP server<br/>(FastMCP, 33 tools)"]
  MCP --> DB[("SQLite<br/>ea.sqlite")]
  Web["Web API :8765<br/>(HTTP + SSE)"] --> DB
  UI["React dashboard"] -->|HTTP + SSE| Web
```

## Backend (`backend/`)

- **Web API** — FastAPI on `:8765`. Serves the dashboard's HTTP endpoints, streams
  live updates over SSE, and handles control-loop writes. No auth (loopback-bound by default).
- **MCP server** — FastMCP, bearer-gated, on `:8766`. Scout's skills call it to read and
  write the database. Constant-time token check; SQL-injection-hardened whitelists.

Both processes share the **same SQLite file** (WAL mode, FTS5 full-text index rebuilt on demand).

## Frontend (`frontend/`)

React + TypeScript + MUI, built to static assets and served by the API inside the
container. Talks to the API over HTTP and subscribes to SSE for live refresh.

The app is a single page — `App.tsx` renders `ShellLayout` and nothing else routes.
`ShellLayout` composes:

- **`TopBar`** — quick links, weather, a finance ticker, productivity timers, and
  icon buttons that open the Settings / People / Topics / Automations / Setup Wizard
  drawers (`shell/drawerRegistry.ts`).
- **`LeftRail`** — upcoming calendar events.
- **`CenterGrid`** — a drag-and-drop 2-column grid of the 9 dashboard tiles
  (`widgets/registry.ts`); layout and hidden tiles persist per browser.
- **`RightRail`** — the to-do list, with priority buckets, sort modes, and filters.
- **`DrawerHost`** — renders whichever drawer/modal is active.

Any row rendered inside a tile can be turned into a to-do via a hover-revealed button
(`components/RowTaskButton.tsx`), regardless of which tile it came from.

## Skills (`skills/`)

24 `SKILL.md` automations — heartbeat scans and daily/weekly tasks — installed into
Microsoft Scout by the **[Setup Wizard](setup-wizard.md)**, or pasted in by hand. They
are the only writers that create signals, deadlines, trends, news, dashboard records,
and outgoing actions. See **[Skills](skills.md)**.

## Dashboard records (`backend/ea/features.sql`, migration 008)

Most dashboard tiles don't have a bespoke table. Instead a generic `records` table
(`kind`, `external_ref`, a JSON `data` blob, `status`, `sort`) backs 8 of the 9 tiles —
Email, Teams chat, RevOps, Pipeline, Quarterly events, OU feedback, Territory reviews,
and EBC & Innovation Hub — each keyed by its own `kind`. Skills write to it with
`upsert_record` (dedup on `external_ref`); the frontend reads it with `list_records`.
Only the Industry feed tile is different — it reads the older `news_items` and
`topics` tables directly.

## Why two containers?

The web API and the MCP server run as **separate services** off one shared image and
one shared data volume. This isolates the bearer-gated MCP surface (which Scout reaches
over the network) from the loopback web dashboard, and lets each scale and restart
independently. See `docker-compose.yml`.

## Data flow

1. A skill fires on its schedule, reads its lookback window from `skill_runs`.
2. It scans email/Teams/calendar, dedupes by `external_ref`, and writes rows via MCP tools.
3. It ends by logging a `skill_runs` row (even on no-op) for observability.
4. The dashboard, polling `data_version` and listening on SSE, reflects the change live.
