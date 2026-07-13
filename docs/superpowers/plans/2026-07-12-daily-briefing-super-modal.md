# Daily Briefing Super-Modal (SP1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the small `TodayBriefing` dialog with a full-screen, interactive daily briefing fed by a new `daily_briefing` curation skill + a live `/api/briefing` endpoint.

**Architecture:** New `daily_briefing` skill (supersedes `daily_outlook`) writes polarity-classified proactive signals + a one-line day summary each morning. A pure `lib/briefing.assemble()` composes the briefing from live source rows; `/api/briefing` serves it; the rebuilt `TodayBriefing.tsx` renders a command-center grid with click-to-nav + hover-detail.

**Tech Stack:** Python (stdlib sqlite3 + FastAPI), pytest; React + TypeScript + MUI, React Query, react-router-dom, Vitest.

## Global Constraints

- Backend: stdlib `sqlite3`, no new deps. Migrations are idempotent PRAGMA-guarded `ALTER TABLE` (mirror `signals.reasoning` at `backend/ea/db.py:100-104`).
- Config writes go through `db.set_config` allowlist (`WRITABLE_CONFIG`, `backend/ea/db.py:429`). Signal columns validated by `_SIGNAL_COLS` (`backend/ea/db.py:111`).
- Assembler is pure: no I/O, no storage (matches `lib/outlook.assemble`). No stored briefing snapshot.
- `/api/outlook` behavior is UNCHANGED (KpiStrip depends on it).
- Keep files under 500 lines. Reuse existing theme tokens + Quickdraw patterns; no new UI deps.
- Run backend tests: `cd backend && python -m pytest <file> -q`. Frontend: `cd frontend && npx vitest run <file>`.

---

### Task 1: Migration — `signals.polarity` column + `daily_summary` config key

**Files:**
- Modify: `backend/ea/schema.sql:48` (add `polarity` to signals CREATE)
- Modify: `backend/ea/db.py:100-104` (idempotent migration), `:111-113` (`_SIGNAL_COLS`), `:429-431` (`WRITABLE_CONFIG`)
- Test: `backend/tests/test_briefing_migration.py` (create)

**Interfaces:**
- Produces: `signals.polarity` nullable TEXT column; `upsert_signal(..., polarity=...)` accepted; `set_config(conn, "daily_summary", <json str>)` accepted.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_briefing_migration.py
from ea import db


def test_signals_has_polarity_column(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    cols = [r[1] for r in conn.execute("PRAGMA table_info(signals)")]
    assert "polarity" in cols


def test_upsert_signal_accepts_polarity(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    n = db.upsert_signal(conn, type="proactive", source="briefing",
                         external_ref="r1", title="t", status="new",
                         polarity="risk")
    assert n == 1
    row = conn.execute("SELECT polarity FROM signals WHERE external_ref='r1'").fetchone()
    assert row["polarity"] == "risk"


def test_daily_summary_is_writable(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    db.set_config(conn, "daily_summary", '{"date":"2026-07-12","text":"hi"}')
    v = conn.execute("SELECT value FROM config WHERE key='daily_summary'").fetchone()
    assert '"text":"hi"' in v["value"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_briefing_migration.py -q`
Expected: FAIL (`polarity` not in cols / unknown signal columns / config key not writable).

- [ ] **Step 3: Implement**

In `backend/ea/schema.sql`, add `polarity` to the signals table (after line 48 `who ... why`):

```sql
    reasoning     TEXT,                         -- AI rationale for surfacing (F1)
    polarity      TEXT,                          -- 'risk' | 'opportunity' | NULL (briefing)
```

In `backend/ea/db.py`, after the `signals.reasoning` migration block (line 104), add:

```python
    # Add signals.polarity for pre-existing DBs (fresh DBs get it from schema.sql).
    if not any(r[1] == "polarity" for r in signals_pragma):
        conn.execute("ALTER TABLE signals ADD COLUMN polarity TEXT")
        conn.commit()
```

In `_SIGNAL_COLS` (line 111), add `"polarity"`:

```python
_SIGNAL_COLS = {"type", "source", "source_skill", "external_ref", "title", "summary",
                "who", "what", "when_rel", "why", "reasoning", "url", "person_id", "topic_id",
                "priority", "triage_rank", "status", "occurred_at", "polarity"}
```

In `WRITABLE_CONFIG` (line 429), add `"daily_summary"`:

```python
WRITABLE_CONFIG = {"deadlines_visible_global", "outlook_send_time", "trend_window_days",
                   "reminder_enabled", "reminder_lead_minutes",
                   "alert_loud_threshold", "alert_sound_enabled", "daily_summary"}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_briefing_migration.py -q`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/ea/schema.sql backend/ea/db.py backend/tests/test_briefing_migration.py
git commit -m "feat(briefing): signals.polarity column + daily_summary config key"
```

---

### Task 2: `lib/briefing.py` pure assembler

**Files:**
- Create: `backend/lib/briefing.py`
- Test: `backend/tests/test_lib_briefing.py` (create)

**Interfaces:**
- Consumes: `lib.deadlines.countdown(due_at, now)` (already used by `lib.outlook`).
- Produces:
  `assemble(now, deadlines, tasks, signals, news, learning, topics, people, people_signals, summary) -> dict`
  where args are lists of plain dicts (`people_signals` = dict `{person_id: [signal dicts]}`, `summary` = str|None), returning keys: `date, summary, critical, risks, opportunities, news_by_topic, people, weather, finance`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_lib_briefing.py
from lib import briefing

NOW = "2026-06-21T09:00:00+00:00"


def _base(**kw):
    args = dict(now=NOW, deadlines=[], tasks=[], signals=[], news=[], learning=[],
                topics=[], people=[], people_signals={}, summary=None)
    args.update(kw)
    return briefing.assemble(**args)


def test_shape_and_empty_safe():
    out = _base()
    assert out["date"] == "2026-06-21"
    assert out["summary"] is None
    for k in ("critical", "risks", "opportunities", "news_by_topic", "people"):
        assert out[k] == []
    assert out["weather"] is None and out["finance"] is None


def test_critical_ranks_deadline_then_task_then_signal():
    out = _base(
        deadlines=[{"id": 5, "title": "D", "due_at": "2026-06-21T17:00:00+00:00"}],
        tasks=[{"id": 7, "title": "T", "due_at": "2026-06-21T12:00:00+00:00", "priority": 1}],
        signals=[{"id": 9, "title": "S", "type": "email", "priority": 1, "status": "new"}],
    )
    kinds = [c["kind"] for c in out["critical"]]
    assert kinds == ["deadline", "task", "signal"]
    assert out["critical"][0]["nav"] == {"view": "/tasks", "id": 5}
    assert out["critical"][0]["countdown_seconds"] == 8 * 3600


def test_only_today_tasks_and_lowpri_signals_excluded():
    out = _base(
        tasks=[{"id": 1, "title": "tmrw", "due_at": "2026-06-22T12:00:00+00:00", "priority": 1}],
        signals=[{"id": 2, "title": "low", "type": "email", "priority": 3, "status": "new"}],
    )
    assert out["critical"] == []


def test_polarity_split():
    out = _base(signals=[
        {"id": 1, "title": "r", "type": "proactive", "status": "new", "polarity": "risk"},
        {"id": 2, "title": "o", "type": "proactive", "status": "new", "polarity": "opportunity"},
        {"id": 3, "title": "n", "type": "proactive", "status": "new", "polarity": None},
    ])
    assert [r["id"] for r in out["risks"]] == [1]
    assert [o["id"] for o in out["opportunities"]] == [2]


def test_news_grouped_by_topic_relevance_desc():
    out = _base(
        topics=[{"id": 10, "name": "AI", "priority": 1}],
        news=[{"id": 1, "title": "a", "topic_id": 10, "relevance": 0.2, "status": "new"},
              {"id": 2, "title": "b", "topic_id": 10, "relevance": 0.9, "status": "new"}],
        learning=[{"id": 3, "title": "c", "topic_id": 10, "relevance": 0.5, "status": "suggested"}],
    )
    grp = out["news_by_topic"][0]
    assert grp["topic_id"] == 10 and grp["topic_name"] == "AI"
    assert [i["id"] for i in grp["items"]] == [2, 3, 1]
    assert grp["items"][0]["category"] == "news"
    assert grp["items"][1]["category"] == "learning"


def test_people_ordered_by_importance_with_signals():
    out = _base(
        people=[{"id": 1, "name": "Lo", "importance": 1},
                {"id": 2, "name": "Hi", "importance": 5}],
        people_signals={2: [{"id": 8, "title": "s"}]},
    )
    assert [p["id"] for p in out["people"]] == [2, 1]
    assert out["people"][0]["signals"][0]["id"] == 8
    assert out["people"][1]["signals"] == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_lib_briefing.py -q`
Expected: FAIL (`ModuleNotFoundError: lib.briefing`).

- [ ] **Step 3: Implement**

```python
# backend/lib/briefing.py
"""Daily Briefing assembly — pure: takes fetched rows + now, returns the snapshot."""
from __future__ import annotations
from lib import deadlines as _deadlines

CRITICAL_CAP = 8
PEOPLE_SIGNAL_CAP = 3


def _date(iso: str) -> str:
    return iso[:10]


def _critical(now, today, deadlines, tasks, signals):
    items = []
    for d in deadlines:
        row = dict(d)
        row["kind"] = "deadline"
        row["countdown_seconds"] = _deadlines.countdown(d["due_at"], now)
        row["nav"] = {"view": "/tasks", "id": d["id"]}
        items.append(row)
    items.sort(key=lambda r: r["countdown_seconds"])

    tasks_today = sorted(
        (t for t in tasks if t.get("due_at") and _date(t["due_at"]) == today),
        key=lambda t: t.get("priority", 3),
    )
    task_rows = [{**t, "kind": "task", "nav": {"view": "/tasks", "id": t["id"]}}
                 for t in tasks_today]

    hot = [s for s in signals
           if s.get("type") != "proactive"
           and s.get("status") == "new" and s.get("priority", 3) <= 1]
    sig_rows = [{**s, "kind": "signal", "nav": {"view": "/feed", "id": s["id"]}}
                for s in hot]

    return (items + task_rows + sig_rows)[:CRITICAL_CAP]


def _news_by_topic(topics, news, learning):
    by_topic = {}
    for n in news:
        if n.get("status") in ("new", "suggested"):
            by_topic.setdefault(n.get("topic_id"), []).append({**n, "category": "news"})
    for l in learning:
        if l.get("status") in ("new", "suggested"):
            by_topic.setdefault(l.get("topic_id"), []).append({**l, "category": "learning"})

    tmap = {t["id"]: t for t in topics}
    groups = []
    for tid, items in by_topic.items():
        if tid not in tmap:
            continue
        items.sort(key=lambda i: i.get("relevance") or 0, reverse=True)
        groups.append({"topic_id": tid, "topic_name": tmap[tid]["name"],
                       "topic_priority": tmap[tid].get("priority", 3), "items": items})
    groups.sort(key=lambda g: g["topic_priority"])
    return groups


def assemble(now, deadlines, tasks, signals, news, learning, topics, people,
             people_signals, summary):
    today = _date(now)
    proactive = [s for s in signals if s.get("type") == "proactive"
                 and s.get("status") == "new"]
    people_out = []
    for p in sorted(people, key=lambda p: p.get("importance", 0), reverse=True):
        sigs = (people_signals.get(p["id"]) or [])[:PEOPLE_SIGNAL_CAP]
        people_out.append({**p, "signals": sigs})
    return {
        "date": today,
        "summary": summary,
        "critical": _critical(now, today, deadlines, tasks, signals),
        "risks": [dict(s) for s in proactive if s.get("polarity") == "risk"],
        "opportunities": [dict(s) for s in proactive if s.get("polarity") == "opportunity"],
        "news_by_topic": _news_by_topic(topics, news, learning),
        "people": people_out,
        "weather": None,   # SP2
        "finance": None,   # SP3
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_lib_briefing.py -q`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/lib/briefing.py backend/tests/test_lib_briefing.py
git commit -m "feat(briefing): pure lib.briefing.assemble composer"
```

---

### Task 3: `/api/briefing` endpoint

**Files:**
- Modify: `backend/web/app.py` (add endpoint after `get_outlook`, ~line 463; add `from lib import briefing as _briefing` near line 16)
- Test: `backend/tests/test_web_briefing.py` (create)

**Interfaces:**
- Consumes: `lib.briefing.assemble(...)` (Task 2); `db.list_deadlines`, `db.list_news`, `db.list_learning`, `db.list_people`, `db.list_topics`.
- Produces: `GET /api/briefing` → assembled JSON.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_web_briefing.py
from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    db.add_deadline(conn, title="D", due_at="2099-01-01T17:00:00+00:00",
                    source="email", external_ref="d1")
    db.upsert_signal(conn, type="proactive", source="briefing", external_ref="p1",
                     title="renewal risk", status="new", polarity="risk")
    db.set_config(conn, "daily_summary", '{"date":"2026-07-12","text":"busy day"}')
    conn.close()
    return TestClient(create_app(p))


def test_briefing_endpoint_shape(tmp_path):
    body = _client(tmp_path).get("/api/briefing").json()
    assert "date" in body
    assert any(r["title"] == "renewal risk" for r in body["risks"])
    assert body["weather"] is None and body["finance"] is None
    assert "busy day" in (body["summary"] or "")


def test_outlook_still_works(tmp_path):
    body = _client(tmp_path).get("/api/outlook").json()
    assert "deadlines" in body and "proactive" in body
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_web_briefing.py -q`
Expected: FAIL (404 on `/api/briefing`).

- [ ] **Step 3: Implement**

Add import near `backend/web/app.py:16` (beside `from lib import outlook as _outlook`):

```python
from lib import briefing as _briefing
```

Add endpoint immediately after `get_outlook` (after line 463):

```python
    @app.get("/api/briefing")
    def get_briefing(conn=Depends(get_db)):
        now = datetime.now(timezone.utc).isoformat()
        deadlines = [dict(r) for r in db.list_deadlines(conn)]
        tasks = [dict(r) for r in conn.execute(
            "SELECT * FROM tasks WHERE status IN ('open','in_progress')")]
        signals = [dict(r) for r in conn.execute(
            "SELECT * FROM signals WHERE status='new' ORDER BY created_at DESC")]
        news = [dict(r) for r in db.list_news(conn)]
        learning = [dict(r) for r in db.list_learning(conn)]
        topics = [dict(r) for r in db.list_topics(conn)]
        people = [dict(r) for r in db.list_people(conn)]
        people_signals = {}
        for s in signals:
            pid = s.get("person_id")
            if pid:
                people_signals.setdefault(pid, []).append(s)
        row = conn.execute("SELECT value FROM config WHERE key='daily_summary'").fetchone()
        summary = None
        if row:
            import json
            try:
                summary = json.loads(row["value"]).get("text")
            except (ValueError, TypeError):
                summary = None
        return _briefing.assemble(now, deadlines, tasks, signals, news, learning,
                                  topics, people, people_signals, summary)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_web_briefing.py tests/test_web_outlook.py -q`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/web/app.py backend/tests/test_web_briefing.py
git commit -m "feat(briefing): GET /api/briefing live-assembled endpoint"
```

---

### Task 4: New `daily_briefing` skill; retire `daily_outlook`

**Files:**
- Create: `skills/daily_briefing/SKILL.md`
- Delete: `skills/daily_outlook/SKILL.md`
- Modify: `backend/tests/test_skills_structure.py:10-22` (EXPECTED set)

**Interfaces:**
- Produces: proactive `signals` with `polarity`, `config.daily_summary` JSON, morning `alerts` info-row, `log_skill_run` for `daily_briefing`.

- [ ] **Step 1: Update the failing test**

In `backend/tests/test_skills_structure.py`, replace `"daily_outlook",` with `"daily_briefing",` in `EXPECTED`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_skills_structure.py -q`
Expected: FAIL (`Missing skills: {'daily_briefing'}`).

- [ ] **Step 3: Implement — write the skill, delete the old one**

Create `skills/daily_briefing/SKILL.md`:

```markdown
---
name: daily_briefing
description: Morning briefing curator — proactive risk/opportunity signals + one-line day summary; supersedes daily_outlook
schedule: automation, daily at config.outlook_send_time (default 07:00), workdays only
---

## Lookback window
Fixed 24h window `[now - 1 day, now]` for gathering recent context.

## Gather context
Assemble (LLM context only; do NOT store): today's events; tasks due today;
critical deadlines due today; top trends; recent learning headlines (last 7d).

## Generate proactive suggestions with polarity
LLM pass over last ~24h of `signals` (`type='email' OR type='teams'`) and manual
`learning` items. Prompt:

    "Analyze these recent emails/chat/data. Generate 2-5 brief proactive
     suggestions. For EACH, classify polarity:
       - 'risk': something slipping, unanswered, or threatening (missed reply,
         deadline pressure, at-risk renewal/relationship).
       - 'opportunity': something to capitalize on (follow-up opening, milestone,
         rising trend, training/hiring match).
     Format each: who, what, why, polarity."

For each suggestion, call `add_signal`:
- `type`: 'proactive'
- `source`: 'briefing'
- `external_ref`: hash of suggestion text + date (dedup)
- `title`: 2-3 word summary; `summary`: full text
- `who`, `what`, `why`: extracted; `when_rel`: 'today'
- `polarity`: 'risk' or 'opportunity'
- `priority`: 3 (normal) or 4 (low) by confidence

## Write the day summary
LLM produces ONE natural line summarizing the day (e.g. "3 deadlines — watch the
Acme renewal; Jane needs a reply"). Store via the config setter:
- key: `daily_summary`
- value: JSON `{"date": "YYYY-MM-DD", "text": "<summary>"}` (overwrites)

## Fire morning notification
Insert one low-priority `alerts` row (`severity='info'`) summarizing the
briefing. The server owns OS toasts — do NOT fire here.

## Call log_skill_run
Write to `skill_runs` via `log_skill_run`: skill='daily_briefing',
window = last 24h, items_created = suggestions count, status='ok',
note = '<events> events, <deadlines> deadlines, <suggestions> suggestions'.

Then exit.
```

Delete the old skill:

```bash
git rm skills/daily_outlook/SKILL.md
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_skills_structure.py -q`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add skills/daily_briefing/SKILL.md backend/tests/test_skills_structure.py
git commit -m "feat(briefing): daily_briefing skill supersedes daily_outlook"
```

---

### Task 5: Frontend API + `BriefingResponse` types

**Files:**
- Modify: `frontend/src/api.ts` (add types after `OutlookResponse` ~line 148; add `getBriefing` after `getOutlook` ~line 156)
- Test: `frontend/src/api.briefing.test.ts` (create)

**Interfaces:**
- Produces: `BriefingResponse` type; `getBriefing(): Promise<BriefingResponse>` hitting `/api/briefing`.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/api.briefing.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { getBriefing } from './api'

afterEach(() => vi.restoreAllMocks())

describe('getBriefing', () => {
  it('fetches /api/briefing', async () => {
    const payload = { date: '2026-07-12', summary: 'hi', critical: [], risks: [],
      opportunities: [], news_by_topic: [], people: [], weather: null, finance: null }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      { ok: true, json: () => Promise.resolve(payload) }))
    const out = await getBriefing()
    expect(out.summary).toBe('hi')
    expect(fetch).toHaveBeenCalledWith('/api/briefing')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/api.briefing.test.ts`
Expected: FAIL (`getBriefing` is not exported).

- [ ] **Step 3: Implement**

Add types after `OutlookResponse` in `frontend/src/api.ts`:

```typescript
export interface CriticalItem {
  id: number; title: string; kind: 'deadline' | 'task' | 'signal'
  nav: { view: string; id: number }
  countdown_seconds?: number; due_at?: string; priority?: number; summary?: string; why?: string
}
export interface BriefingTopicGroup {
  topic_id: number; topic_name: string; topic_priority: number
  items: (NewsItem | LearningItem)[] & { category: 'news' | 'learning' }[]
}
export interface BriefingPerson extends Person { signals: Signal[] }
export interface BriefingResponse {
  date: string
  summary: string | null
  critical: CriticalItem[]
  risks: Signal[]
  opportunities: Signal[]
  news_by_topic: BriefingTopicGroup[]
  people: BriefingPerson[]
  weather: null
  finance: null
}
```

Add fetch after `getOutlook`:

```typescript
export const getBriefing = () => fetchJson<BriefingResponse>('/api/briefing')
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/api.briefing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.ts frontend/src/api.briefing.test.ts
git commit -m "feat(briefing): getBriefing api + BriefingResponse types"
```

---

### Task 6: Rebuild `TodayBriefing` as full-screen command-center grid

**Files:**
- Rewrite: `frontend/src/components/TodayBriefing.tsx`
- Test: `frontend/src/components/TodayBriefing.test.tsx` (create or replace)

**Interfaces:**
- Consumes: `getBriefing` + `BriefingResponse` (Task 5). Keeps props `{ open: boolean; onClose: () => void }`.
- Produces: full-screen `Dialog` rendering summary headline, weather-band + finance placeholders, and 4 section cards (Critical, Risks & Opportunities, Topics News, Key People) with per-section empty states.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/components/TodayBriefing.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { TodayBriefing } from './TodayBriefing'
import * as api from '@/api'

const payload = {
  date: '2026-07-12', summary: 'busy day',
  critical: [{ id: 5, title: 'Ship it', kind: 'deadline', nav: { view: '/tasks', id: 5 },
    countdown_seconds: 3600 }],
  risks: [{ id: 1, type: 'proactive', source: 'briefing', title: 'Renewal risk',
    status: 'new', priority: 3, created_at: '', polarity: 'risk' }],
  opportunities: [],
  news_by_topic: [{ topic_id: 10, topic_name: 'AI', topic_priority: 1,
    items: [{ id: 2, title: 'Big model', status: 'new', category: 'news' }] }],
  people: [{ id: 3, name: 'Jane', importance: 5, active: 1, signals: [] }],
  weather: null, finance: null,
}

function renderModal() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><TodayBriefing open onClose={() => {}} /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TodayBriefing', () => {
  beforeEach(() => vi.spyOn(api, 'getBriefing').mockResolvedValue(payload as never))

  it('renders summary + all section headers + items', async () => {
    renderModal()
    expect(await screen.findByText('busy day')).toBeInTheDocument()
    expect(screen.getByText(/CRITICAL/i)).toBeInTheDocument()
    expect(screen.getByText(/RISKS/i)).toBeInTheDocument()
    expect(screen.getByText('Ship it')).toBeInTheDocument()
    expect(screen.getByText('Renewal risk')).toBeInTheDocument()
    expect(screen.getByText('Jane')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/TodayBriefing.test.tsx`
Expected: FAIL (old modal renders `getOutlook`, not these items).

- [ ] **Step 3: Implement**

Rewrite `frontend/src/components/TodayBriefing.tsx` as a `Dialog fullScreen`. Fetch `getBriefing` (enabled on open). Layout: weather-band placeholder `<Box>` (top), summary headline below it, a CSS-grid of 4 `Paper` section cards (`gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }`), finance-strip placeholder at bottom. Each section maps its array; when empty render muted copy ("No critical items — clear morning" / "Nothing flagged" / "No topics today" / "No key people"). Use `Skeleton` while `isLoading`. Keep the close `IconButton`. Keep monospace numeric accents + existing theme tokens (mirror the current file's styling). Weather/finance placeholders show a muted "Weather — coming soon" / "Markets — coming soon" label. (Row click-to-nav + hover-detail added in Task 7.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/TodayBriefing.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TodayBriefing.tsx frontend/src/components/TodayBriefing.test.tsx
git commit -m "feat(briefing): full-screen command-center TodayBriefing modal"
```

---

### Task 7: Click-to-nav + hover-detail interactivity

**Files:**
- Modify: `frontend/src/components/TodayBriefing.tsx`
- Modify: `frontend/src/components/TodayBriefing.test.tsx` (add nav test)

**Interfaces:**
- Consumes: `useNavigate` from `react-router-dom`; `onClose` prop; `nav` hints on critical items; `/feed`, `/people` for news/people rows.

- [ ] **Step 1: Write the failing test** (append to `TodayBriefing.test.tsx`)

```typescript
import userEvent from '@testing-library/user-event'
const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}))

it('click-to-nav closes modal and routes', async () => {
  const onClose = vi.fn()
  const qc = new QueryClient()
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><TodayBriefing open onClose={onClose} /></MemoryRouter>
    </QueryClientProvider>,
  )
  await userEvent.click(await screen.findByText('Ship it'))
  expect(navigateMock).toHaveBeenCalledWith('/tasks')
  expect(onClose).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/TodayBriefing.test.tsx`
Expected: FAIL (rows not clickable / navigate not called).

- [ ] **Step 3: Implement**

Add `const navigate = useNavigate()`. Factor a `go(view: string)` helper that calls `onClose()` then `navigate(view)`. Wire row `onClick`: critical → `item.nav.view`; risk/opp signal → `/feed`; news item → `/feed`; person → `/people`. Give rows `role="button"`, `tabIndex={0}`, `cursor: 'pointer'`, and `'&:hover'` background (reuse the existing hover token from the current file). For hover-detail, render each row's `summary`/`why`/`detail` in a MUI `Tooltip` (or expand-on-hover `Collapse`) — no navigation on hover.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/TodayBriefing.test.tsx`
Expected: PASS (2 passed).

- [ ] **Step 5: Full regression + commit**

```bash
cd backend && python -m pytest -q && cd ../frontend && npx vitest run
```
Expected: all green.

```bash
git add frontend/src/components/TodayBriefing.tsx frontend/src/components/TodayBriefing.test.tsx
git commit -m "feat(briefing): click-to-nav + hover-detail in briefing modal"
```

---

## Self-Review

**Spec coverage:**
- New `daily_briefing` skill (supersede, polarity, day-summary, toast) → Task 4. ✔
- `signals.polarity` migration → Task 1. ✔
- `daily_summary` config kv → Task 1 (allowlist) + Task 3 (read) + Task 4 (write). ✔
- `lib/briefing.py` assembler (critical rank, polarity split, news-by-topic, people) → Task 2. ✔
- `/api/briefing` live endpoint, `/api/outlook` untouched → Task 3. ✔
- Full-screen command-center modal, summary headline, 4 sections, weather/finance placeholders → Task 6. ✔
- Click-to-nav + hover-detail → Task 7. ✔
- Testing (assembler/endpoint/migration/frontend/skill) → Tasks 1-7. ✔
- Out of scope (live weather anim, real finance, new route) — not planned. ✔

**Placeholder scan:** No TBD/TODO; all code steps carry full code. Task 6's implementation is prose-described (a mechanical MUI layout) but constrains exact grid, sections, empty copy, placeholders — acceptable, matches existing `TodayBriefing` styling.

**Type consistency:** `assemble(...)` arg order identical in Task 2 def, Task 2 tests, Task 3 call. `BriefingResponse` keys (Task 5) match assembler output keys (Task 2) and modal test payload (Task 6). `nav: {view, id}` consistent across assembler, types, and Task 7 nav wiring. `source='briefing'` + `polarity` consistent across Task 1/3/4.
