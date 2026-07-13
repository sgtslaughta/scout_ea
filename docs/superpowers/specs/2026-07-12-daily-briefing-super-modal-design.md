# Daily Briefing Super-Modal — SP1 Design

**Date:** 2026-07-12
**Status:** Approved
**Program:** Skills-based Daily Briefing (SP1 of 3)

## Summary

Replace the small `TodayBriefing` dialog with a full-screen, data-dense,
interactive daily briefing ("super-modal"). A new `daily_briefing` skill
curates the judgment-heavy parts each morning; a new `/api/briefing` endpoint
assembles the rest live from source tables; the modal renders it with
click-to-nav and hover-for-detail patterns reused from Quickdraw.

This is SP1 of a 3-part program:

- **SP1 (this spec):** super-modal shell + curation skill, all internal data.
- **SP2 (later):** animated weather header (Open-Meteo, backend-proxied, keyless)
  with sun/moon arc by current time.
- **SP3 (later):** financial section (Stooq, backend-proxied, keyless CSV) with
  user-defined watchlist.

SP1 renders weather and finance zones as placeholders; SP2/SP3 fill them.

## Decisions (locked)

- **Placement:** the briefing *is* the existing modal, expanded — not a new
  route. Same `briefingOpen` trigger from `SignatureBar`.
- **External data (whole program):** real free APIs, backend-proxied + cached.
  Not used in SP1.
- **Risks/Opportunities:** the skill classifies both (LLM), not heuristics.
- **Layout:** command-center grid (see below).
- **New skill role:** `daily_briefing` **supersedes** `daily_outlook`. Retire
  `daily_outlook`. `/api/outlook` stays (KpiStrip consumes it), now fed by the
  new skill.
- **Day-summary storage:** a `config` kv row (`daily_summary`). No new table.

## Architecture

Three units, each independently testable:

1. **Skill** (`skills/daily_briefing/SKILL.md`) — morning automation. Produces
   the judgment-dependent data: polarity-classified proactive signals + a
   one-line day summary. Deterministic queries are NOT its job.
2. **Assembler** (`backend/lib/briefing.py`) — pure function: takes fetched
   rows + `now`, returns the briefing snapshot. No I/O, no storage.
3. **Endpoint** (`/api/briefing` in `backend/web/app.py`) — fetches rows, calls
   the assembler, returns JSON. Live every request (no stored snapshot, matching
   the `/api/outlook` precedent).
4. **UI** (`frontend/src/components/TodayBriefing.tsx`) — full-screen modal
   rendering the snapshot.

Data flow:

```
daily_briefing skill  ──writes──▶  signals.polarity, config.daily_summary, alerts
                                          │
GET /api/briefing  ──fetch rows──▶ lib/briefing.assemble()  ──JSON──▶  TodayBriefing modal
   (deadlines, tasks, signals, news, learning, topics, people, config)
```

## A. New skill — `skills/daily_briefing/SKILL.md`

Delete `skills/daily_outlook/SKILL.md`. The new skill absorbs its behavior and
adds two judgment tasks.

**Schedule:** automation, daily at `config.outlook_send_time` (default 07:00),
workdays only. Also safe to re-run on demand (idempotent via `external_ref`
dedup on proactive signals; summary overwrites for the day).

**Lookback window:** fixed 24h `[now - 1 day, now]`.

**Steps:**

1. **Gather context** (unchanged from `daily_outlook`): today's events, tasks
   due today, critical deadlines due today, top trends, recent learning
   headlines. Used only as LLM context; not stored.

2. **Proactive generation + polarity classification (NEW).** LLM pass over the
   last ~24h of `signals` (`type='email' OR type='teams'`) and manual `learning`
   items. Prompt generates 2–5 brief proactive suggestions, and for **each**
   classifies a `polarity`:
   - `risk` — something slipping, unanswered, or threatening (missed reply,
     deadline pressure, at-risk relationship/renewal).
   - `opportunity` — something to capitalize on (follow-up opening, milestone,
     rising trend, training/hiring match).

   For each suggestion: synthesize `external_ref` (hash of text + date for
   dedup), extract `who`/`what`/`why`, set `when_rel='today'`, set
   `priority` 3 or 4 by confidence. Call `add_signal` with `type='proactive'`,
   `source='briefing'`, and the new `polarity` field.

3. **Day summary (NEW).** LLM produces ONE natural-language line summarizing the
   day (e.g. "3 deadlines today — watch the Acme renewal; Jane needs a reply").
   Store via the config setter as key `daily_summary`, value JSON
   `{"date": "YYYY-MM-DD", "text": "..."}`. Overwrites any prior value.

4. **Morning notification (unchanged).** Insert a low-priority `alerts` row
   (`severity='info'`). The server owns OS toasts; the skill does not fire them.

5. **`log_skill_run`** with skill name `daily_briefing`, counts, and a note.

**Migration dependency:** step 2 requires `signals.polarity`. See section B.

## B. Backend — assembler + endpoint

### Migration

Add a nullable column: `ALTER TABLE signals ADD COLUMN polarity TEXT`. Values:
`'risk'`, `'opportunity'`, or `NULL` (non-proactive signals). Follow the repo's
existing migration mechanism (same place other signals columns like `reasoning`
were added).

### `backend/lib/briefing.py`

Pure `assemble(now, deadlines, tasks, signals, news, learning, topics, people, people_signals, summary)`
returning:

```
{
  "date": "YYYY-MM-DD",
  "summary": "<day summary text or null>",
  "critical": [ ... ],            # ranked: deadlines due today + tasks due today
                                  #   + priority<=1 'new' signals
  "risks": [ ... ],               # proactive signals WHERE polarity='risk'
  "opportunities": [ ... ],       # proactive signals WHERE polarity='opportunity'
  "news_by_topic": [              # grouped, ordered by relevance
    { "topic_id", "topic_name", "topic_priority",
      "items": [ {news/learning row, "category": "news"|"learning"} ] }
  ],
  "people": [                     # active, ordered by importance desc
    { ...person, "signals": [ recent linked signals via person_id ] }
  ],
  "weather": null,                # SP2 placeholder
  "finance": null                 # SP3 placeholder
}
```

Rules:

- **critical ranking:** deadlines by ascending `countdown_seconds`, then tasks
  due today by priority, then priority≤1 `new` signals. Each item carries a
  `kind` (`deadline`|`task`|`signal`) and a `nav` hint (target view + id) so the
  UI can route without re-deriving. Cap at a sane count (e.g. 8) — if truncated,
  the field is still honest (UI shows "+N more" linking to the full view).
- **risks/opportunities:** split the `type='proactive'`, `status='new'` signals
  by `polarity`. `NULL` polarity proactive signals fall into neither list (they
  are legacy/uncertain) — they still appear via the existing outlook path.
- **news_by_topic:** only `status IN ('suggested','new')`; drop dismissed/read.
  Topics with no items are omitted. Items ordered by `relevance` desc.
- **people:** `active=1`, `importance` desc. Each person's `signals` = recent
  signals with matching `person_id` (small cap, e.g. 3). People with zero recent
  signals still appear (they are "key people"), just with an empty signal list.
- **empty states:** every list may be empty; the assembler never errors on empty
  input and returns empty arrays / null summary.

### `/api/briefing` endpoint

`GET /api/briefing` in `backend/web/app.py`: fetch the rows the assembler needs,
call `briefing.assemble(...)`, return JSON. Live each call. Leave `/api/outlook`
untouched.

## C. Frontend — rebuild `TodayBriefing.tsx`

`Dialog` changes `maxWidth="sm"` → `fullScreen`. Keep the existing open/close
props and `SignatureBar` trigger. New data source: `getBriefing()` →
`/api/briefing` (add to `api.ts` with a `BriefingResponse` type).

### Layout (command-center grid)

```
┌──────────── WEATHER · sun/moon arc (SP2 placeholder) ────────────┐
│  <day summary headline — one line>                               │
├──────────────────┬───────────────────────────────────────────────┤
│ CRITICAL         │ RISKS & OPPORTUNITIES                          │
│ ▸ due today      │ ⚠ risk…                                        │
│ ▸ deadline 2h    │ ✦ opportunity…                                 │
├──────────────────┼───────────────────────────────────────────────┤
│ TOPICS NEWS      │ KEY PEOPLE                                     │
│ ▸ [AI] head… ↗   │ ● Jane · 2 signals ↗                          │
│ ▸ [Mkt] head… ↗  │ ● Raj  · mtg today ↗                          │
├──────────────────┴───────────────────────────────────────────────┤
│ FINANCE (SP3 placeholder)   SPY ▲   AAPL ▼   ^DJI ▲              │
└───────────────────────────────────────────────────────────────────┘
```

- **Weather band:** placeholder panel (fixed-height top band). SP2 fills it.
  Day-summary headline renders directly under it.
- **Four section cards** in a 2×2 responsive grid: Critical, Risks &
  Opportunities, Topics News, Key People. Collapse to single column on narrow
  widths.
- **Finance strip:** placeholder panel along the bottom. SP3 fills it.
- **Density & style:** monospace numeric accents, existing theme tokens, tight
  rows. Match the visual language of the current `TodayBriefing`/Quickdraw.

### Interactivity

- **Click-to-nav:** every row is a link. Clicking closes the modal and routes:
  - critical `deadline`/`task` → `/tasks` (or `/schedule` for events), `signal`
    → its Quickdraw/feed target
  - risks/opportunities → the linked signal's target
  - news item → `/feed`
  - person → `/people`
  - Use the `nav` hints from the payload where present.
- **Hover-for-detail:** reuse the Quickdraw expand pattern (`QuickdrawItem`) so
  hovering/expanding a row reveals `summary`/`why`/detail without navigating.
- **Loading/empty:** skeletons while fetching; per-section empty copy when a list
  is empty (e.g. "No critical items — clear morning").

## D. Testing

- **`lib/briefing.py`** (pure, primary coverage): critical ranking order;
  polarity split (risk/opp/NULL); news grouping by topic + relevance order;
  people ordered by importance with signal attach; empty-input safety;
  truncation caps.
- **Endpoint:** `/api/briefing` returns the assembled shape; `/api/outlook`
  unchanged (regression).
- **Migration:** `signals.polarity` exists and is nullable; existing rows
  unaffected.
- **Frontend:** modal renders each section from mock payload; click-to-nav
  closes + routes to the right path; hover/expand reveals detail; empty-state
  copy renders.
- **Skill:** proactive signals written with `polarity` set;
  `config.daily_summary` written as dated JSON. (Assert via the skill's DB
  effects, consistent with existing skill tests.)

## Out of scope (SP1)

- Live weather data + animation + sun/moon arc (SP2).
- Real finance data, watchlist config, market averages (SP3).
- Any change to `/api/outlook` behavior or KpiStrip.
- New navigation route (the briefing stays a modal).
