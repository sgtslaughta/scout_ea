# Scout EA — Design Spec

**Date:** 2026-06-20
**Status:** Approved design, ready for implementation
**Target:** Windows 11 (Copilot+ PC), Microsoft Scout autopilot agent, local SQLite, local web dashboard
**Supersedes (augments):** `SCOUT_EA.md` (kept as source-of-intent reference)

---

## 0. Purpose & Context

An **Executive Agent (EA)** built on **Microsoft Scout**. Scout runs **Heartbeat** scans (15–120 min) and **Automations** (time/trigger), executes **custom Skills** (`SKILL.md` files), and has local **file + shell + browser** access under a tiered permission model.

This system gives Scout:
1. A shared **SQLite database (`EA_DB`)** = single source of truth for personnel, topics, inbound signals, tasks, alerts, calendar events, and learning items.
2. A set of **Skills** (rewrites of the 6 SCOUT_EA.md sections) that read/write `EA_DB` idempotently.
3. A **local web dashboard** (Python stdlib server) that visualizes `EA_DB` reactively and acts as a **control surface** — user actions write status back, Scout's next heartbeat reacts.

```
   ┌─────────────┐   reads/writes   ┌──────────┐   reads (SSE+HTMX)   ┌───────────┐
   │ Scout Skills│ ───────────────► │  EA_DB   │ ◄────────────────── │ Dashboard │
   │ (heartbeat) │ ◄─────────────── │ (sqlite) │   writes status     │  (browser)│
   └─────────────┘   status loop    └──────────┘   back ───────────► └───────────┘
```

---

## 1. Stack Decision (portability-first)

Target machine's install permissions are **unknown**, so the primary stack uses **Python standard library only** — guaranteed to run wherever Python itself exists.

| Layer | Choice | Why |
|---|---|---|
| Server | `http.server.ThreadingHTTPServer` (stdlib) | Zero install. Threading enables long-lived SSE connections. |
| DB | `sqlite3` (stdlib) | Zero install. File-based, single-user, perfect fit. |
| Templating | f-strings / `string.Template` (stdlib) | No Jinja dependency. |
| Reactivity | **HTMX** (vendored `htmx.min.js`, ~14KB) + SSE extension | No npm, no build, no CDN reliance. Served from local `/static`. |
| Styling | One hand-written `app.css` (vendored) | No Tailwind build. Optional: vendored Tailwind standalone CLI output if desired. |
| Toast | PowerShell **BurntToast** module, shelled from server | Native Windows notifications. |

### Fallback ladder (document all, implement #1)
1. **Python stdlib (primary).** If Python absent → Scout installs Python (covers everything, no pip needed).
2. **FastAPI + uvicorn (optional upgrade)** *only if pip is available* — same schema, same endpoints, async SSE. Swappable without touching DB or frontend.
3. Never required: Node, React, any bundler.

### Why HTMX + SSE over a SPA
- Reactive, data-dense UI with **zero build step** and one language end-to-end.
- **`PRAGMA data_version`** (stdlib SQLite counter) increments on *any* external write to the DB. The server polls it (~1 s); on change it emits an SSE event; HTMX swaps only the affected panels. No file watchers, no write-coordination code, no message bus.

---

## 2. SQLite Schema (`EA_DB`)

**File:** `ea_db.sqlite` (path in `config`). **Conventions:** enums stored as `TEXT`; every row has `created_at`/`updated_at` (ISO-8601 UTC); dedup via `UNIQUE external_ref`; `PRAGMA foreign_keys = ON`; `PRAGMA journal_mode = WAL` (concurrent dashboard reads while Scout writes).

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- 1. KEY PERSONNEL (unifies KEY_EMAIL_PPL + KEY_TEAMS_PPL) -------------------
CREATE TABLE people (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    role        TEXT,
    org         TEXT,
    importance  INTEGER NOT NULL DEFAULT 3,   -- 1=highest .. 5=lowest
    notes       TEXT,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. CONTACT HANDLES (extensible channels per person) -----------------------
CREATE TABLE person_handles (
    id         INTEGER PRIMARY KEY,
    person_id  INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    channel    TEXT NOT NULL,                 -- 'email' | 'teams' | 'phone' | ...
    handle     TEXT NOT NULL,                 -- address / id / number
    UNIQUE(channel, handle)
);
CREATE INDEX idx_handles_lookup ON person_handles(channel, handle);

-- 3. RESEARCH & LEARNING TOPICS (RL_TOPICS) ---------------------------------
CREATE TABLE topics (
    id            INTEGER PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE,
    description   TEXT,
    priority      INTEGER NOT NULL DEFAULT 3,
    max_suggest   INTEGER NOT NULL DEFAULT 5, -- per-topic weekly cap
    active        INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. SIGNALS — unified inbound triage feed ----------------------------------
--    email triage, teams triage, research-email, training-email all land here
CREATE TABLE signals (
    id            INTEGER PRIMARY KEY,
    type          TEXT NOT NULL,              -- 'email' | 'teams' | 'research' | 'training'
    source        TEXT NOT NULL,              -- 'outlook' | 'teams' | ...
    external_ref  TEXT UNIQUE,                -- message-id / chat-id / url  (DEDUP KEY)
    title         TEXT NOT NULL,
    summary       TEXT,                       -- short synopsis
    who           TEXT, what TEXT, when_rel TEXT, why TEXT,  -- 5 W's
    url           TEXT,
    person_id     INTEGER REFERENCES people(id),
    topic_id      INTEGER REFERENCES topics(id),
    priority      INTEGER NOT NULL DEFAULT 3, -- 1=critical .. 5=low
    triage_rank   INTEGER,                    -- explicit ordering within a batch
    status        TEXT NOT NULL DEFAULT 'new',-- new|triaged|actioned|dismissed
    occurred_at   TEXT,                       -- when the source event happened
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_signals_feed ON signals(status, priority, occurred_at);

-- 5. TASKS — actionable items ----------------------------------------------
CREATE TABLE tasks (
    id               INTEGER PRIMARY KEY,
    title            TEXT NOT NULL,
    detail           TEXT,
    due_at           TEXT,
    priority         INTEGER NOT NULL DEFAULT 3,
    status           TEXT NOT NULL DEFAULT 'open', -- open|in_progress|done|dismissed
    person_id        INTEGER REFERENCES people(id),
    source_signal_id INTEGER REFERENCES signals(id),
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. ALERTS — surfaced notifications (dashboard + toast) --------------------
CREATE TABLE alerts (
    id             INTEGER PRIMARY KEY,
    severity       TEXT NOT NULL DEFAULT 'info', -- critical|warning|info
    title          TEXT NOT NULL,
    body           TEXT,
    url            TEXT,                          -- deep-link into dashboard
    source_table   TEXT, source_id INTEGER,       -- polymorphic origin
    status         TEXT NOT NULL DEFAULT 'unread',-- unread|ack|dismissed
    notified_toast INTEGER NOT NULL DEFAULT 0,    -- 0 until OS toast fired
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_alerts_open ON alerts(status, severity, created_at);

-- 7. EVENTS — calendar suggestions → drafts → created -----------------------
CREATE TABLE events (
    id               INTEGER PRIMARY KEY,
    title            TEXT NOT NULL,
    body             TEXT,
    proposed_times   TEXT,                    -- JSON array of ISO datetimes (>=3)
    chosen_time      TEXT,
    attendees        TEXT,                    -- JSON array of person_id / emails
    status           TEXT NOT NULL DEFAULT 'suggested',
                                              -- suggested|approved|drafted|created|rejected
    source_signal_id INTEGER REFERENCES signals(id),
    external_ref     TEXT UNIQUE,             -- calendar event id once created
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_events_status ON events(status, created_at);

-- 8. LEARNING — unified web reads + training opportunities ------------------
CREATE TABLE learning (
    id            INTEGER PRIMARY KEY,
    kind          TEXT NOT NULL,             -- read|webinar|video|course|f2f
    source        TEXT NOT NULL,             -- 'web' | 'email'
    title         TEXT NOT NULL,
    synopsis      TEXT,
    url           TEXT,
    external_ref  TEXT UNIQUE,               -- url / message-id  (DEDUP KEY)
    provider      TEXT,
    event_at      TEXT,                      -- when training occurs, if scheduled
    topic_id      INTEGER REFERENCES topics(id),
    relevance     INTEGER,                   -- 1..5, 1=most relevant
    status        TEXT NOT NULL DEFAULT 'suggested', -- suggested|saved|consumed|dismissed
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 9. CONFIG — key/value settings, limits, windows ---------------------------
CREATE TABLE config (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 10. SKILL_RUNS — per-skill audit + lookback anchor ------------------------
CREATE TABLE skill_runs (
    id             INTEGER PRIMARY KEY,
    skill          TEXT NOT NULL,            -- 'triage_email' | 'triage_teams' | ...
    ran_at         TEXT NOT NULL DEFAULT (datetime('now')),
    window_start   TEXT,                     -- lookback start used this run
    window_end     TEXT,
    items_created  INTEGER NOT NULL DEFAULT 0,
    status         TEXT NOT NULL DEFAULT 'ok', -- ok|error
    note           TEXT
);
CREATE INDEX idx_runs_skill ON skill_runs(skill, ran_at);
```

### Seed `config` rows
```
db_path             = C:\ScoutEA\ea_db.sqlite
tz                  = America/New_York
work_hours          = 07:00-18:00
work_days           = Mon,Tue,Wed,Thu,Fri
heartbeat_minutes   = 30
priority_scale      = 1=critical,2=high,3=normal,4=low,5=info
global_max_suggest  = 25
dashboard_port      = 8765
```

### `updated_at` maintenance
Each table gets a trigger (omitted here for brevity; generate one per table):
```sql
CREATE TRIGGER trg_signals_touch AFTER UPDATE ON signals
BEGIN UPDATE signals SET updated_at = datetime('now') WHERE id = NEW.id; END;
```

### Extension points (forward-looking, build later — YAGNI now)
- `tags` + `item_tags` (polymorphic) when free-form categorization is needed.
- `attachments(source_table, source_id, path/url)` if file capture is needed.
- New `signals.type` / `learning.kind` values require **no migration** (TEXT enums).
- New contact channels = new `person_handles.channel` value, no schema change.

---

## 3. Skills (7 skills across the 4 SCOUT_EA.md functional areas)

### Cross-cutting rules (apply to ALL skills)
1. **Lookback by `skill_runs`, not fixed clock.** On start, read last `skill_runs.ran_at` for this skill; use it as `window_start` (fallback: now − `heartbeat_minutes`). Prevents dropped items when a heartbeat is late or skipped. Always write a `skill_runs` row at the end.
2. **Dedup before insert.** Compute `external_ref` (message-id, chat-id, or URL). `INSERT ... ON CONFLICT(external_ref) DO NOTHING`. Never create duplicates across overlapping windows.
3. **Shared priority scale** (`config.priority_scale`): 1 critical → 5 info.
4. **All timestamps** stored UTC ISO-8601; display tz from `config.tz`.
5. **No-op is valid.** If nothing new, write a `skill_runs` row with `items_created=0` and exit.
6. **Raise alerts** for priority ≤ 2 items by inserting an `alerts` row.

---

### 3.1 Skill: `triage_email`  *(Heartbeat, 30 min, workdays 07:00–18:00 EST)*
Review email since last run (`skill_runs`). Flag: (a) critical/time-sensitive actions on me, (b) new events/invites/meeting requests, (c) direct replies where I'm primary target, (d) anything from a `people` row (match sender via `person_handles.channel='email'`). For each, **upsert** a `signals` row (`type='email'`) with 5 W's, `priority`, `triage_rank` (order by time sensitivity), `external_ref=message-id`, `person_id` if matched. Priority ≤ 2 → also insert `alerts`. No new email → log run, exit.

### 3.2 Skill: `triage_teams`  *(Heartbeat, 30 min, workdays 07:00–18:00 EST)*
Review active Teams chats since last run. Flag: (a) critical/time-sensitive actions on me, (b) newly created chats, (c) direct replies where I'm primary target, (d) anything from a `people` row or watched group (match via `person_handles.channel='teams'`). Upsert `signals` (`type='teams'`, `external_ref=chat/message-id`, 5 W's, `priority`, `triage_rank`, `person_id`, `url`=chat deep-link). Priority ≤ 2 → insert `alerts`. No new messages → log run, exit.

### 3.3 Skill: `extract_research_training_email`  *(Heartbeat, 30 min, same window)*
Review email since last run. Flag: new training opportunities (webinar/video/online/F2F) and announcements of new products/resources/tech/breakthroughs. Classify `kind`, write 5 W's synopsis. Upsert a `learning` row (`source='email'`, `external_ref=message-id`, `kind`, `synopsis`, `provider`, `event_at`, `topic_id` if it maps to a topic). No matches → log run, exit.

### 3.4 Skill: `suggest_events`  *(Heartbeat, 30 min)*
Read `signals` created since last run where a meeting is implied. For each, extract attendees (resolve to `people`), check my calendar free/busy, propose **≥3** available datetimes within `work_hours`/`work_days`. Insert an `events` row (`status='suggested'`, `proposed_times` JSON, `attendees` JSON, `source_signal_id`). Dedup on `source_signal_id`. No candidates → log run, exit.

### 3.5 Skill: `create_events`  *(Heartbeat, 30 min)*
Read `events` where `status='approved'` (set by the **dashboard** — see §4 control loop). For each: draft a calendar event at `chosen_time` with body + attendee invites, **open it for my review**, set `status='drafted'`, store `external_ref`. (When I send it, a later run or webhook sets `status='created'`.) No approvals → log run, exit.

### 3.6 Skill: `research_topics`  *(Automation, weekly Friday)*
Timeframe: last 7 days. For each `active` topic in `topics`, web+news search for developments. **Deconflict** against existing `learning` rows (`external_ref`/URL). Respect caps: per-topic `topics.max_suggest`, global `config.global_max_suggest`. Insert `learning` rows (`source='web'`, `kind='read'`, `synopsis`, `url`, `relevance`, `topic_id`). Related-but-inexact findings allowed (lower `relevance`). Log run.

### 3.7 Skill: `compile_learning_email`  *(Automation, weekly Friday)*
Timeframe: last 7 days. Take `learning` rows with `source='email'` flagged this week, deconflict duplicates, enrich with relevant details (provider, `event_at`, `topic_id`), set `status='suggested'`. Log run.

---

## 4. Dashboard Spec

### 4.1 Run model
- Single Python file `server.py` (+ `/static`, `/templates`). Launch: `python server.py` (Scout can start it as an Automation on login).
- Binds **`127.0.0.1:<dashboard_port>`** only. **No auth** (local single user). Never expose externally.
- Reads `EA_DB` via `sqlite3`; WAL mode lets it read while Scout writes.

### 4.2 Reactivity (SSE + HTMX)
- Endpoint `GET /events` = SSE stream. A background thread polls `PRAGMA data_version` every ~1 s; on change, push `event: db-changed`.
- Each panel: `<div hx-trigger="sse:db-changed" hx-get="/panel/<name>" hx-swap="innerHTML">`. Only changed panels re-fetch.
- Panels render server-side HTML fragments — no client JSON wiring.

### 4.3 Notifications
- **In-dashboard:** persistent top alert bar (counts by severity) + transient toast banner on new `alerts` (rendered when SSE fires).
- **Windows native toast:** server thread scans `alerts WHERE notified_toast=0`; for each, shell PowerShell **BurntToast** (`New-BurntToastNotification -Text title, body`), then set `notified_toast=1`. **Server is the single owner** of OS toasts (skills do not fire them) → no double-fire. Toast click deep-links to `alerts.url`.

### 4.4 Pages & routes
| Route | Page | Content |
|---|---|---|
| `/` | **Main dashboard** | alert bar → triaged signal feed → status cards (below) |
| `/inbox` | Signals | full `signals` table, filter by type/status/priority/person |
| `/tasks` | Tasks | open/in-progress/done; inline complete/dismiss |
| `/calendar` | Events | suggestions w/ proposed times; **Approve** button → `status='approved'` |
| `/research` | Learning(web) | suggested reads w/ synopsis + URL; save/dismiss |
| `/learning` | Learning(training) | training opps; save/dismiss |
| `/people` | People | key personnel + handles CRUD |
| `/topics` | Topics | research topics + limits CRUD |
| `/settings` | Config | `config` key/value editor; per-skill last-sync from `skill_runs` |

### 4.5 Main dashboard layout
```
┌────────────────────────────────────────────────────────────────────┐
│ SCOUT EA            ● 2 critical  ● 5 warning   [last sync 14:32]    │  alert bar
├───────────────────────────────┬────────────────────────────────────┤
│ TRIAGED SIGNALS (priority×age) │  TODAY'S TASKS                      │
│  🔴 P1 Mtg request — Dr. Vance │   ▢ Reply to budget thread  (due 3p)│
│  🟠 P2 Reply needed — Project X│   ▢ Review Q3 deck                  │
│  🟡 P3 FYI webinar invite      │  ────────────────────────────────── │
│  ...                           │  PENDING EVENT APPROVALS    [Approve]│
│                                │   Sync w/ Vance — 3 times proposed  │
│                                │  ────────────────────────────────── │
│                                │  NEW RESEARCH (3)  ·  LEARNING (2)   │
│                                │  KEY-PEOPLE ACTIVITY  ·  LAST SYNC   │
└───────────────────────────────┴────────────────────────────────────┘
```

### 4.6 Control loop (dashboard writes → Scout reacts)
The dashboard is **not read-only**. Action buttons `POST` status changes back to `EA_DB`; Scout's next heartbeat reads them:
| Button | Writes | Skill that reacts |
|---|---|---|
| Approve event | `events.status='approved'` | `create_events` (3.4) |
| Mark task done | `tasks.status='done'` | — |
| Ack / dismiss alert | `alerts.status` | — |
| Triage / dismiss signal | `signals.status` | feeds reporting |
| Save / dismiss learning | `learning.status` | — |
Each POST mutates one row → `PRAGMA data_version` bumps → SSE → all clients refresh.

### 4.7 Aesthetic
Clean, professional, **data-dense**. Neutral slate base (`#0f172a`/`#1e293b` dark or `#f8fafc` light), **one accent** (indigo `#4f46e5`). Severity chips: critical `#dc2626`, warning `#d97706`, info `#0284c7`. Tight tables, 13px UI font, **monospace timestamps** (tabular alignment), generous use of compact rows over cards where density matters. System font stack (no web-font fetch). Keyboard: `g i` inbox, `g t` tasks, etc. (progressive enhancement, optional).

---

## 5. File Layout (implementation target)
```
C:\ScoutEA\
  ea_db.sqlite            # the database
  schema.sql              # §2 DDL + triggers + seed config
  server.py               # stdlib dashboard server (<500 lines; split if larger)
  static\
    htmx.min.js           # vendored
    sse.js                # htmx SSE extension, vendored
    app.css               # hand-written styles
  templates\              # HTML fragments per panel/page
  skills\                 # one SKILL.md per §3 skill
    triage_email\SKILL.md
    triage_teams\SKILL.md
    extract_research_training_email\SKILL.md
    suggest_events\SKILL.md
    create_events\SKILL.md
    research_topics\SKILL.md
    compile_learning_email\SKILL.md
  tools\
    notify.ps1            # BurntToast wrapper
```

## 6. Build Order (for the implementation plan)
1. `schema.sql` → init DB, seed `config`, seed a few `people`/`topics`.
2. `server.py` read-only: routes, panels, main dashboard, SSE via `data_version`.
3. Control-loop POST endpoints + status writes.
4. Toast owner thread + `notify.ps1`.
5. SKILL.md files (§3), wired to read/write `EA_DB` with the cross-cutting rules.
6. Scout Automation to launch `server.py` on login; Heartbeats per skill schedule.

## 7. Self-Check (definition of done)
- `schema.sql` applies clean; `PRAGMA foreign_keys` + WAL on.
- Insert a fake critical `alerts` row → OS toast fires once, dashboard bar updates live via SSE.
- Click **Approve** on a suggested event → `events.status='approved'` in DB → panel refreshes.
- Late/skipped heartbeat simulated → no dropped or duplicated `signals` (lookback + `external_ref` dedup verified).
- Dashboard reachable only on `127.0.0.1`.
```
```

---

### Open question deferred to implementation
How Scout reads email/Teams/calendar — via M365 APIs it already has, or Graph. Skills assume Scout's native connectors. If unavailable, add a thin Graph helper in `tools\`. Not blocking the DB/dashboard build.
