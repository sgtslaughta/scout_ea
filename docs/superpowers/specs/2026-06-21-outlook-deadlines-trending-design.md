# Scout EA — Daily Outlook, Critical Deadlines & Trending — Design Spec

**Date:** 2026-06-21
**Status:** Approved design, ready for implementation plan
**Augments:** `2026-06-20-scout-ea-design.md` (the base EA_DB + dashboard + skills system)
**Deployment note:** Project is moving to **container-based deployment**. The base spec's
stdlib-only / no-pip constraint is therefore **relaxed** for this work — pip deps are allowed
where they earn their keep (embeddings, vector search). Core features must still degrade
gracefully when optional deps are absent.

---

## 0. Scope

Three additions to the existing Scout EA system:

1. **Daily Outlook** — a daily snapshot of what matters *today*: calendar events, items
   due today, critical-deadline countdowns, top trends, news headlines, and LLM-generated
   **proactive suggestions** ("Julie mentioned her anniversary — send a card?").
2. **Critical Deadlines** — a new table + dedicated parsing skill that extracts hard
   deadlines from email/chat/manual entry, with **global and per-deadline visibility toggles**.
3. **Trending** — a skill that reviews all data sources to surface trending topics/keywords,
   a per-topic web "trending search", a dedicated `/trending` UI, and an **optional vector
   layer** for semantic dedup and related-item lookup.

All three reuse the existing architecture: SQLite `EA_DB`, stdlib (or FastAPI) server,
HTMX+SSE dashboard, Scout skills with the established cross-cutting rules
(lookback via `skill_runs`, dedup via `external_ref`, no-op valid, alert on priority ≤ 2).

---

## 1. Schema additions

Conventions unchanged from base spec: ISO-8601 UTC timestamps, `created_at`/`updated_at`
on every table, `updated_at` touch trigger per table, `UNIQUE external_ref` for dedup,
`PRAGMA foreign_keys = ON`, WAL mode.

### 1.1 `critical_deadlines`

```sql
CREATE TABLE critical_deadlines (
    id           INTEGER PRIMARY KEY,
    title        TEXT NOT NULL,
    detail       TEXT,
    due_at       TEXT NOT NULL,                 -- the hard deadline (UTC ISO-8601)
    source       TEXT NOT NULL,                 -- 'email' | 'teams' | 'manual'
    external_ref TEXT UNIQUE,                    -- message-id / chat-id / manual:<uuid>  (DEDUP KEY)
    person_id    INTEGER REFERENCES people(id),
    signal_id    INTEGER REFERENCES signals(id),-- provenance, if parsed from a signal
    priority     INTEGER NOT NULL DEFAULT 2,     -- 1=critical .. 5=info
    visible      INTEGER NOT NULL DEFAULT 1,     -- per-deadline visibility toggle
    status       TEXT NOT NULL DEFAULT 'active', -- active | met | missed | dismissed
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_deadlines_due ON critical_deadlines(status, visible, due_at);
```

**Visibility logic:** a deadline shows iff `config.deadlines_visible_global = 1` **AND** the
row's `visible = 1`. The global toggle is a single `config` row; the per-row toggle is the
`visible` column. UI exposes both.

### 1.2 `trends`

```sql
CREATE TABLE trends (
    id           INTEGER PRIMARY KEY,
    term         TEXT NOT NULL,                  -- normalized keyword / topic / entity
    kind         TEXT NOT NULL,                  -- 'keyword' | 'topic' | 'entity'
    score        REAL NOT NULL DEFAULT 0,        -- recency-weighted frequency
    count        INTEGER NOT NULL DEFAULT 0,     -- raw occurrence count this window
    delta        TEXT,                           -- 'rising' | 'flat' | 'falling' (vs prior window)
    sources      TEXT,                           -- JSON: which tables/item ids fed this term
    window_start TEXT NOT NULL,
    window_end   TEXT NOT NULL,
    first_seen   TEXT,                           -- earliest occurrence ever
    last_seen    TEXT,
    embedding    BLOB,                           -- nullable; float32 term embedding
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(term, window_start)                   -- one row per term per window
);
CREATE INDEX idx_trends_rank ON trends(window_start, score);
```

A companion **sqlite-vec virtual table** mirrors embeddings for ANN search:

```sql
-- Created only when the sqlite-vec extension loads; absence is non-fatal.
CREATE VIRTUAL TABLE vec_trends USING vec0(
    trend_id INTEGER PRIMARY KEY,
    embedding FLOAT[384]                         -- all-MiniLM-L6-v2 dimension
);
```

### 1.3 `trend_findings` (separate trending-only store)

```sql
CREATE TABLE trend_findings (
    id           INTEGER PRIMARY KEY,
    trend_id     INTEGER REFERENCES trends(id),
    topic_id     INTEGER REFERENCES topics(id),
    title        TEXT NOT NULL,
    synopsis     TEXT,
    url          TEXT,
    source       TEXT,                           -- 'web' | 'news'
    external_ref TEXT UNIQUE,                     -- url  (DEDUP KEY)
    relevance    INTEGER,                         -- 1..5, 1=most relevant
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Kept separate from `learning` by design decision — trending findings surface only on
`/trending`, never mixed into the research/learning queues.

### 1.4 Reuse: proactive suggestions

Proactive suggestions are **not** a new table. `daily_outlook` writes them into the
existing `signals` table with `type='proactive'`, `source='outlook'`, populating the 5 W's
(`who`/`what`/`when_rel`/`why`). The existing inbox UI and control loop
(`new` → `actioned`/`dismissed`) handle them with no new plumbing. An "accept" action can
promote one to a `task` via the existing task-create path.

### 1.5 New `config` rows

```
deadlines_visible_global = 1
outlook_send_time        = 07:00
trend_window_days        = 7
embed_model              = all-MiniLM-L6-v2
```

---

## 2. New skills

All follow base-spec cross-cutting rules: lookback anchored on the last `skill_runs.ran_at`
for the skill; dedup before insert; write a `skill_runs` row every run (including no-op);
raise `alerts` for priority ≤ 2.

### 2.1 `parse_deadlines` — Heartbeat, 30 min, workdays 07:00–18:00

Scan `signals` created since last run (plus any newly flagged email/chat the triage skills
produced) for **hard dates / deadlines** ("due", "by EOD Friday", "submit before", dates).
For each, upsert a `critical_deadlines` row: `due_at` (resolved to absolute UTC), `source`,
`external_ref` (message/chat id), `signal_id`, `person_id` if resolvable, `priority`.
Manual entries arrive via the `/deadlines` add form with `source='manual'`,
`external_ref='manual:<uuid>'`. Dedup on `external_ref`. No new hard dates → log run, exit.

### 2.2 `daily_outlook` — Automation, daily at `config.outlook_send_time`, workdays

Assemble today's snapshot (does **not** itself store the snapshot; the `/outlook` page renders
live from source tables). Its one write side-effect: generate **proactive suggestions**.

Steps:
1. Gather: today's `events` (chosen_time within today), `signals`/`tasks` with `due_at`/
   relevance to today, visible `critical_deadlines` (countdown), top `trends` by score,
   recent `learning`/`trend_findings` headlines.
2. LLM pass over the last ~24h of `signals` (email/teams) to generate proactive suggestions
   — interpersonal cues ("anniversary → card"), opportunity cues ("RVP meeting → ask to be
   invited"). Write each as `signals(type='proactive', source='outlook', ...5 W's...)`,
   dedup on a synthesized `external_ref`.
3. Fire **one** BurntToast summary (counts + top 2–3 items), owned by the morning run.
No suggestions and nothing due → still log run + fire a minimal "clear day" toast (optional).

### 2.3 `compute_trends` — Automation, daily

1. Pull items in `[now - trend_window_days, now]` from `signals` (+ `learning`).
2. LLM extract keywords / topics / entities per item.
3. Aggregate: raw `count` + **recency-weighted `score`** (newer items weigh more).
4. Compute `delta` vs the prior window's row for the same term.
5. **Vector enrich (optional):** embed each term with `config.embed_model`; before insert,
   ANN-search `vec_trends` and **merge near-duplicate terms** above a cosine threshold so
   "AI agents" and "agentic AI" collapse to one trend. Store `embedding` + mirror into
   `vec_trends`.
6. Upsert `trends` (UNIQUE `term, window_start`). Log run.

**Degrade rule (`ponytail:`):** if the embed model or sqlite-vec is unavailable,
skip steps 5's merge/embedding and produce valid count-based trends. Never fail the run on a
missing optional dep.

### 2.4 `trending_search` — Automation, weekly

For each `active` topic in `topics`: web/news search for what is trending *now* in that area.
Write `trend_findings` (`source='web'|'news'`, `synopsis`, `url`, `relevance`,
`trend_id` if it maps to an existing trend, `topic_id`). Dedup on URL. Respect a per-run cap
(reuse `topics.max_suggest` semantics). Log run.

---

## 3. Dashboard additions

Reuse the existing SSE + `PRAGMA data_version` mechanism — any insert/update bumps
`data_version`, the server emits `db-changed`, HTMX swaps the affected panel. No new plumbing.

### 3.1 New pages / routes

| Route | Page | Content |
|---|---|---|
| `/outlook` | **Daily Outlook** | Assembled-on-load: today's events · due-today · **deadline countdowns** · top trends · headlines · **proactive suggestions** (each with *Accept → task* / *Dismiss*). |
| `/deadlines` | **Critical Deadlines** | Countdown list sorted by `due_at`; per-row **visibility toggle**; status controls (met/missed/dismissed); **add-manual** form. |
| `/trending` | **Trending** | Rising/falling term list (by `score`, `delta` arrow); click a term → its `trend_findings`; per-topic "run trending search" trigger. |

### 3.2 Main dashboard (`/`) additions

- An **Outlook summary strip** at the top (today's event count, items due, nearest visible
  deadline countdown, top 1–2 rising trends) — links into `/outlook`.

### 3.3 Settings (`/settings`) additions

- **Global deadline visibility** toggle (`deadlines_visible_global`).
- **Outlook send-time** (`outlook_send_time`).
- **Trending window length** (`trend_window_days`).

### 3.4 Control-loop additions

| Button | Writes | Reacts |
|---|---|---|
| Toggle deadline visibility | `critical_deadlines.visible` | UI filter only |
| Toggle global deadlines | `config.deadlines_visible_global` | UI filter only |
| Accept proactive suggestion | new `tasks` row + `signals.status='actioned'` | task queue |
| Dismiss suggestion | `signals.status='dismissed'` | — |
| Add manual deadline | new `critical_deadlines` row (`source='manual'`) | shows on `/outlook` + `/deadlines` |
| Run trending search (topic) | flags topic for `trending_search` | `trending_search` skill |

---

## 4. Vector layer (containerized, additive)

- **Embeddings:** local `sentence-transformers/all-MiniLM-L6-v2` (384-dim) inside the
  container — no external API key, free, ~80 MB. Model name in `config.embed_model`.
- **Storage / search:** `sqlite-vec` loadable extension; `vec_trends` virtual table; cosine ANN.
- **Used for:** (a) merging near-duplicate trend terms in `compute_trends`, (b) "related to
  this trend" lookups on `/trending`.
- **Hard rule:** entirely additive. With the model or extension absent, `compute_trends`
  still produces valid keyword-count trends and `/trending` still renders. Mark the
  degrade path with a `ponytail:` comment naming the upgrade.

---

## 5. File layout additions

```
skills/
  parse_deadlines/SKILL.md
  daily_outlook/SKILL.md
  compute_trends/SKILL.md
  trending_search/SKILL.md
templates/
  outlook.html
  deadlines.html
  trending.html
lib/
  embeddings.py          # load model, embed(term) -> float32; no-op if model absent
  trends.py              # extraction aggregation, recency weighting, delta, vec merge
migrations/
  002_outlook_deadlines_trending.sql   # §1 DDL + config rows + triggers
```

---

## 6. Build order (for the implementation plan)

1. **Migration** `002_*.sql`: 3 tables + config rows + `updated_at` triggers (+ `vec_trends`
   guarded behind extension load).
2. **`parse_deadlines`** skill + `/deadlines` page + per-row & global visibility toggles +
   manual-add form.
3. **`daily_outlook`** skill + `/outlook` page + main-page summary strip + morning BurntToast.
4. **`compute_trends`** (counts only first) + `/trending` page + main-page rising-trend chip.
5. **Vector layer**: `lib/embeddings.py` + sqlite-vec `vec_trends` + term-merge in
   `compute_trends` + "related" lookup. Additive; gated on dep availability.
6. **`trending_search`** + `trend_findings` drill-down + per-topic run trigger.

---

## 7. Self-check (definition of done)

- Migration applies clean; new tables/indexes/triggers present; `vec_trends` created when
  extension loads, skipped cleanly when not.
- Manual deadline added via `/deadlines` → appears with live countdown on `/outlook`;
  toggling its `visible` (or the global toggle) hides/shows it in real time via SSE.
- `parse_deadlines` extracts a dated email into `critical_deadlines` once (re-run = no dup).
- `daily_outlook` writes ≥1 `signals(type='proactive')` from a seeded cue and fires exactly
  one toast; Accept promotes it to a `task`.
- `compute_trends` produces ranked trends from seeded signals **with the embed model absent**
  (degrade path), and **merges near-duplicate terms when present** (vector path).
- `trending_search` writes `trend_findings` for an active topic; re-run dedups on URL.

---

## 8. Out of scope (YAGNI — add when needed)

- Generic `tags`/`item_tags` system.
- Real-time / streaming trend computation (daily batch is enough).
- Multi-model or remote-API embedding configuration (one local model suffices).
- Historical trend charting beyond `delta` rising/flat/falling.
