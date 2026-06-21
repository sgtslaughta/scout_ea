# Feature Backend Implementation Plan (Migration 002 + Deadline/Trend Logic)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Add the feature data layer (critical_deadlines, trends, trend_findings + feature config) and the pure-Python logic for trend scoring and deadline normalization — the deterministic, fully-testable core of the Outlook/Deadlines/Trending features.

**Architecture:** A second SQL file `features.sql` (idempotent, `IF NOT EXISTS`) applied by `ea.db.init_db` after the base schema. New `ea.db` helpers for deadline/trend rows. Two dependency-free logic modules: `backend/lib/trends.py` (recency-weighted keyword aggregation + delta) and `backend/lib/deadlines.py` (due-date normalization + countdown). LLM extraction and vector embedding are OUT of scope here (external/optional) — this plan covers only what is deterministically testable.

**Tech Stack:** Python 3.11+, stdlib `sqlite3`/`datetime`/`math`, pytest.

## Global Constraints

- `features.sql` is idempotent (`CREATE ... IF NOT EXISTS`, `INSERT OR IGNORE`); safe to re-apply on every `init_db`.
- DB writes go through `ea.db` helpers; dedup via `INSERT ... ON CONFLICT DO NOTHING` / `DO UPDATE`.
- Deadline visibility = `config.deadlines_visible_global == '1'` AND row `visible == 1`.
- All datetimes UTC ISO-8601; logic functions take an explicit `now` (ISO string) for deterministic tests — never call `datetime.now()` inside logic.
- `lib/` modules have NO DB or LLM imports — pure functions.
- Files under 500 lines.

---

### Task 1: Feature migration (features.sql) applied by init_db

**Files:**
- Create: `backend/ea/features.sql`
- Modify: `backend/ea/db.py` (add `DEFAULT_FEATURES`, apply it in `init_db`)
- Test: `backend/tests/test_features_schema.py`

**Interfaces:**
- Produces: `ea.db.DEFAULT_FEATURES` (Path); `init_db` now also applies `features.sql` after the base schema. Tables `critical_deadlines`, `trends`, `trend_findings`; feature config keys.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_features_schema.py
from ea import db

FEATURE_TABLES = {"critical_deadlines", "trends", "trend_findings"}
FEATURE_CONFIG = {"deadlines_visible_global", "outlook_send_time",
                  "trend_window_days", "embed_model"}


def test_feature_tables_created(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    names = {r["name"] for r in
             conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert FEATURE_TABLES <= names


def test_feature_config_seeded(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    keys = {r["key"] for r in conn.execute("SELECT key FROM config")}
    assert FEATURE_CONFIG <= keys


def test_trends_unique_term_window(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    conn.execute("INSERT INTO trends(term, kind, window_start, window_end) "
                 "VALUES ('ai','keyword','2026-06-14','2026-06-21')")
    conn.commit()
    # same term+window violates UNIQUE
    import sqlite3, pytest
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute("INSERT INTO trends(term, kind, window_start, window_end) "
                     "VALUES ('ai','keyword','2026-06-14','2026-06-21')")


def test_features_idempotent(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)  # re-apply
    n = conn.execute("SELECT COUNT(*) FROM config WHERE key='embed_model'").fetchone()[0]
    assert n == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_features_schema.py -v`
Expected: FAIL — `no such table: critical_deadlines`

- [ ] **Step 3: Create `backend/ea/features.sql`**

```sql
-- Feature migration 002: critical deadlines, trends, trend findings.
CREATE TABLE IF NOT EXISTS critical_deadlines (
    id           INTEGER PRIMARY KEY,
    title        TEXT NOT NULL,
    detail       TEXT,
    due_at       TEXT NOT NULL,
    source       TEXT NOT NULL,
    source_skill TEXT,
    external_ref TEXT UNIQUE,
    person_id    INTEGER REFERENCES people(id),
    signal_id    INTEGER REFERENCES signals(id),
    priority     INTEGER NOT NULL DEFAULT 2,
    visible      INTEGER NOT NULL DEFAULT 1,
    status       TEXT NOT NULL DEFAULT 'active',
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_deadlines_due ON critical_deadlines(status, visible, due_at);

CREATE TABLE IF NOT EXISTS trends (
    id           INTEGER PRIMARY KEY,
    term         TEXT NOT NULL,
    kind         TEXT NOT NULL,
    score        REAL NOT NULL DEFAULT 0,
    count        INTEGER NOT NULL DEFAULT 0,
    delta        TEXT,
    sources      TEXT,
    window_start TEXT NOT NULL,
    window_end   TEXT NOT NULL,
    first_seen   TEXT,
    last_seen    TEXT,
    source_skill TEXT,
    embedding    BLOB,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(term, window_start)
);
CREATE INDEX IF NOT EXISTS idx_trends_rank ON trends(window_start, score);

CREATE TABLE IF NOT EXISTS trend_findings (
    id           INTEGER PRIMARY KEY,
    trend_id     INTEGER REFERENCES trends(id),
    topic_id     INTEGER REFERENCES topics(id),
    title        TEXT NOT NULL,
    synopsis     TEXT,
    url          TEXT,
    source       TEXT,
    source_skill TEXT,
    external_ref TEXT UNIQUE,
    relevance    INTEGER,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS trg_deadlines_touch AFTER UPDATE ON critical_deadlines
BEGIN UPDATE critical_deadlines SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_trends_touch AFTER UPDATE ON trends
BEGIN UPDATE trends SET updated_at = datetime('now') WHERE id = NEW.id; END;

INSERT OR IGNORE INTO config(key, value) VALUES
  ('deadlines_visible_global', '1'),
  ('outlook_send_time',        '07:00'),
  ('trend_window_days',        '7'),
  ('embed_model',              'all-MiniLM-L6-v2');
```

- [ ] **Step 4: Wire `features.sql` into `backend/ea/db.py`**

After the existing `DEFAULT_SEED` line, add:
```python
DEFAULT_FEATURES = Path(__file__).with_name("features.sql")
```
In `init_db`, after `conn.executescript(Path(schema_path).read_text())` and BEFORE the seed block, add:
```python
    conn.executescript(Path(DEFAULT_FEATURES).read_text())
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_features_schema.py -v`
Expected: PASS (4 tests)

- [ ] **Step 6: Run the FULL suite (base tests must still pass — they use subset checks)**

Run: `cd backend && python -m pytest -v`
Expected: PASS (all prior + 4 new).

- [ ] **Step 7: Commit**

```bash
git add backend/ea/features.sql backend/ea/db.py backend/tests/test_features_schema.py
git commit -m "feat(db): migration 002 — critical_deadlines, trends, trend_findings + feature config"
```

---

### Task 2: Deadline helpers in ea.db

**Files:**
- Modify: `backend/ea/db.py` (append helpers)
- Test: `backend/tests/test_deadlines_db.py`

**Interfaces:**
- Produces:
  - `ea.db.add_deadline(conn, **fields) -> int` — requires `external_ref`; dedup, returns rowcount.
  - `ea.db.list_deadlines(conn, respect_global=True) -> list[Row]` — when `respect_global` and `config.deadlines_visible_global != '1'`, returns `[]`; otherwise returns `status='active'` rows with `visible=1`, ordered by `due_at` ascending.
  - `ea.db.set_deadline_visible(conn, deadline_id, visible) -> int` — sets `visible` (1/0), returns rowcount.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_deadlines_db.py
import pytest
from ea import db


def _conn(tmp_path):
    return db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)


def test_add_deadline_dedups(tmp_path):
    conn = _conn(tmp_path)
    f = dict(title="Q3 deck", due_at="2026-06-24T17:00:00+00:00",
             source="email", external_ref="msg-9")
    assert db.add_deadline(conn, **f) == 1
    assert db.add_deadline(conn, **f) == 0
    assert conn.execute("SELECT COUNT(*) FROM critical_deadlines").fetchone()[0] == 1


def test_add_deadline_requires_external_ref(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError, match="external_ref"):
        db.add_deadline(conn, title="x", due_at="2026-06-24T17:00:00+00:00", source="manual")


def test_list_deadlines_hides_invisible_row(tmp_path):
    conn = _conn(tmp_path)
    db.add_deadline(conn, title="A", due_at="2026-06-24T17:00:00+00:00",
                    source="email", external_ref="a")
    db.add_deadline(conn, title="B", due_at="2026-06-23T17:00:00+00:00",
                    source="email", external_ref="b")
    db.set_deadline_visible(conn, 1, 0)
    rows = db.list_deadlines(conn)
    # only B visible; ordered by due_at asc
    assert [r["external_ref"] for r in rows] == ["b"]


def test_list_deadlines_global_toggle_off(tmp_path):
    conn = _conn(tmp_path)
    db.add_deadline(conn, title="A", due_at="2026-06-24T17:00:00+00:00",
                    source="email", external_ref="a")
    conn.execute("UPDATE config SET value='0' WHERE key='deadlines_visible_global'")
    conn.commit()
    assert db.list_deadlines(conn) == []
    assert db.list_deadlines(conn, respect_global=False) != []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_deadlines_db.py -v`
Expected: FAIL — `AttributeError: module 'ea.db' has no attribute 'add_deadline'`

- [ ] **Step 3: Append to `backend/ea/db.py`**

```python
# --- deadline helpers ------------------------------------------------------

def add_deadline(conn, **fields) -> int:
    """Insert a critical deadline, deduping on external_ref. Returns rowcount.

    Requires 'external_ref' in fields (manual entries use 'manual:<uuid>').
    """
    if "external_ref" not in fields:
        raise ValueError("add_deadline requires 'external_ref' in fields")
    cols = ", ".join(fields)
    placeholders = ", ".join("?" for _ in fields)
    cur = conn.execute(
        f"INSERT INTO critical_deadlines ({cols}) VALUES ({placeholders}) "
        "ON CONFLICT(external_ref) DO NOTHING",
        list(fields.values()),
    )
    conn.commit()
    return cur.rowcount


def list_deadlines(conn, respect_global=True):
    """Active, visible deadlines ordered by due_at asc.

    Returns [] when respect_global and config.deadlines_visible_global != '1'.
    """
    if respect_global:
        row = conn.execute(
            "SELECT value FROM config WHERE key='deadlines_visible_global'"
        ).fetchone()
        if row is None or row["value"] != "1":
            return []
    return conn.execute(
        "SELECT * FROM critical_deadlines "
        "WHERE status='active' AND visible=1 ORDER BY due_at ASC"
    ).fetchall()


def set_deadline_visible(conn, deadline_id, visible) -> int:
    """Set per-row visibility (1/0). Returns rows affected."""
    cur = conn.execute(
        "UPDATE critical_deadlines SET visible=? WHERE id=?",
        (1 if visible else 0, deadline_id),
    )
    conn.commit()
    return cur.rowcount
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_deadlines_db.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/ea/db.py backend/tests/test_deadlines_db.py
git commit -m "feat(db): deadline helpers — add/list/visibility with global+row toggle"
```

---

### Task 3: Trend helpers in ea.db

**Files:**
- Modify: `backend/ea/db.py` (append helpers)
- Test: `backend/tests/test_trends_db.py`

**Interfaces:**
- Produces:
  - `ea.db.upsert_trend(conn, term, kind, window_start, window_end, score=0, count=0, delta=None, sources=None, source_skill=None) -> int` — upsert on `(term, window_start)`; on conflict UPDATE score/count/delta/window_end/sources. Returns the row id.
  - `ea.db.list_trends(conn, window_start) -> list[Row]` — rows for a window, ordered by score desc.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_trends_db.py
from ea import db


def _conn(tmp_path):
    return db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)


def test_upsert_trend_insert_then_update(tmp_path):
    conn = _conn(tmp_path)
    rid = db.upsert_trend(conn, term="ai agents", kind="topic",
                          window_start="2026-06-14", window_end="2026-06-21",
                          score=1.0, count=3)
    assert rid >= 1
    # same term+window updates, does not duplicate
    rid2 = db.upsert_trend(conn, term="ai agents", kind="topic",
                           window_start="2026-06-14", window_end="2026-06-21",
                           score=2.5, count=7, delta="rising")
    assert rid2 == rid
    assert conn.execute("SELECT COUNT(*) FROM trends").fetchone()[0] == 1
    row = conn.execute("SELECT score, count, delta FROM trends WHERE id=?", (rid,)).fetchone()
    assert row["score"] == 2.5 and row["count"] == 7 and row["delta"] == "rising"


def test_list_trends_orders_by_score_desc(tmp_path):
    conn = _conn(tmp_path)
    db.upsert_trend(conn, term="low", kind="keyword",
                    window_start="w", window_end="w", score=0.5)
    db.upsert_trend(conn, term="high", kind="keyword",
                    window_start="w", window_end="w", score=9.0)
    rows = db.list_trends(conn, "w")
    assert [r["term"] for r in rows] == ["high", "low"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_trends_db.py -v`
Expected: FAIL — `AttributeError: ... 'upsert_trend'`

- [ ] **Step 3: Append to `backend/ea/db.py`**

```python
# --- trend helpers ---------------------------------------------------------

def upsert_trend(conn, term, kind, window_start, window_end,
                 score=0, count=0, delta=None, sources=None, source_skill=None) -> int:
    """Upsert a trend on (term, window_start). Returns the row id."""
    conn.execute(
        "INSERT INTO trends (term, kind, window_start, window_end, score, count, "
        "delta, sources, source_skill) VALUES (?,?,?,?,?,?,?,?,?) "
        "ON CONFLICT(term, window_start) DO UPDATE SET "
        "score=excluded.score, count=excluded.count, delta=excluded.delta, "
        "window_end=excluded.window_end, sources=excluded.sources",
        (term, kind, window_start, window_end, score, count, delta, sources, source_skill),
    )
    conn.commit()
    row = conn.execute(
        "SELECT id FROM trends WHERE term=? AND window_start=?", (term, window_start)
    ).fetchone()
    return row["id"]


def list_trends(conn, window_start):
    """Trends for a window, highest score first."""
    return conn.execute(
        "SELECT * FROM trends WHERE window_start=? ORDER BY score DESC, term ASC",
        (window_start,),
    ).fetchall()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_trends_db.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/ea/db.py backend/tests/test_trends_db.py
git commit -m "feat(db): trend helpers — upsert on (term,window) + ranked list"
```

---

### Task 4: Trend aggregation logic (lib/trends.py)

**Files:**
- Create: `backend/lib/__init__.py` (empty)
- Create: `backend/lib/trends.py`
- Test: `backend/tests/test_lib_trends.py`

**Interfaces:**
- Produces:
  - `lib.trends.aggregate(items, now, half_life_days=3.0) -> list[dict]` — `items` = `[{"term": str, "occurred_at": iso}]`; returns `[{"term","count","score"}]` sorted by score desc. Score = Σ `0.5 ** (age_days / half_life_days)` over occurrences.
  - `lib.trends.compute_delta(curr_score, prev_score, threshold=0.15) -> str` — `'rising'|'flat'|'falling'`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_lib_trends.py
from lib import trends

NOW = "2026-06-21T00:00:00+00:00"


def test_aggregate_counts_and_recency(tmp_path=None):
    items = [
        {"term": "ai", "occurred_at": "2026-06-21T00:00:00+00:00"},  # age 0 -> weight 1
        {"term": "ai", "occurred_at": "2026-06-18T00:00:00+00:00"},  # age 3 -> weight 0.5
        {"term": "k8s", "occurred_at": "2026-06-21T00:00:00+00:00"},
    ]
    out = trends.aggregate(items, NOW, half_life_days=3.0)
    by = {r["term"]: r for r in out}
    assert by["ai"]["count"] == 2
    assert abs(by["ai"]["score"] - 1.5) < 1e-6     # 1 + 0.5
    assert by["k8s"]["count"] == 1
    # ai (1.5) ranks above k8s (1.0)
    assert [r["term"] for r in out] == ["ai", "k8s"]


def test_aggregate_future_item_clamped(tmp_path=None):
    items = [{"term": "x", "occurred_at": "2026-06-25T00:00:00+00:00"}]  # future
    out = trends.aggregate(items, NOW)
    assert abs(out[0]["score"] - 1.0) < 1e-6       # age clamped to 0 -> weight 1


def test_compute_delta(tmp_path=None):
    assert trends.compute_delta(2.0, 1.0) == "rising"
    assert trends.compute_delta(1.0, 2.0) == "falling"
    assert trends.compute_delta(1.0, 1.0) == "flat"
    assert trends.compute_delta(1.0, None) == "rising"
    assert trends.compute_delta(0.0, None) == "flat"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_lib_trends.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'lib'`

- [ ] **Step 3: Create `backend/lib/__init__.py`** (empty)

- [ ] **Step 4: Create `backend/lib/trends.py`**

```python
"""Trend aggregation — recency-weighted keyword scoring + delta. Pure: no DB/LLM."""
from __future__ import annotations
from collections import defaultdict
from datetime import datetime


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def aggregate(items, now, half_life_days=3.0):
    """items: [{'term', 'occurred_at'(iso)}]. Returns [{'term','count','score'}] score desc.

    score = sum over occurrences of 0.5 ** (age_days / half_life_days); future ages clamp to 0.
    """
    now_dt = _parse(now)
    counts = defaultdict(int)
    scores = defaultdict(float)
    for it in items:
        term = it["term"]
        age_days = (now_dt - _parse(it["occurred_at"])).total_seconds() / 86400.0
        if age_days < 0:
            age_days = 0.0
        counts[term] += 1
        scores[term] += 0.5 ** (age_days / half_life_days)
    out = [{"term": t, "count": counts[t], "score": round(scores[t], 6)} for t in counts]
    out.sort(key=lambda r: (-r["score"], r["term"]))
    return out


def compute_delta(curr_score, prev_score, threshold=0.15):
    """Classify movement vs prior window. threshold = fractional change."""
    if prev_score is None or prev_score == 0:
        return "rising" if curr_score > 0 else "flat"
    change = (curr_score - prev_score) / prev_score
    if change > threshold:
        return "rising"
    if change < -threshold:
        return "falling"
    return "flat"
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_lib_trends.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/lib/__init__.py backend/lib/trends.py backend/tests/test_lib_trends.py
git commit -m "feat(lib): trend aggregation — recency-weighted score + delta"
```

---

### Task 5: Deadline normalization logic (lib/deadlines.py)

**Files:**
- Create: `backend/lib/deadlines.py`
- Test: `backend/tests/test_lib_deadlines.py`

**Interfaces:**
- Produces:
  - `lib.deadlines.normalize_due(expr, now) -> str | None` — map a detected deadline expression to a UTC ISO-8601 string, or None if unparseable. Handles ISO datetimes/dates, `today`, `tomorrow`, `eod` (today 17:00), and a bare weekday or `eod <weekday>` (next future occurrence at 17:00). `now` is an ISO string.
  - `lib.deadlines.countdown(due_at, now) -> int` — whole seconds until `due_at` (negative if past).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_lib_deadlines.py
from lib import deadlines

# 2026-06-21 is a Sunday (weekday() == 6), UTC
NOW = "2026-06-21T09:00:00+00:00"


def test_iso_passthrough_to_utc(tmp_path=None):
    assert deadlines.normalize_due("2026-06-24T17:00:00+00:00", NOW) == \
        "2026-06-24T17:00:00+00:00"


def test_today_and_tomorrow_eod(tmp_path=None):
    assert deadlines.normalize_due("today", NOW) == "2026-06-21T17:00:00+00:00"
    assert deadlines.normalize_due("tomorrow", NOW) == "2026-06-22T17:00:00+00:00"
    assert deadlines.normalize_due("eod", NOW) == "2026-06-21T17:00:00+00:00"


def test_weekday_next_occurrence(tmp_path=None):
    # next Friday after Sunday 6/21 is 6/26
    assert deadlines.normalize_due("friday", NOW) == "2026-06-26T17:00:00+00:00"
    assert deadlines.normalize_due("eod friday", NOW) == "2026-06-26T17:00:00+00:00"


def test_unparseable_returns_none(tmp_path=None):
    assert deadlines.normalize_due("sometime soon", NOW) is None


def test_countdown_sign(tmp_path=None):
    assert deadlines.countdown("2026-06-21T10:00:00+00:00", NOW) == 3600
    assert deadlines.countdown("2026-06-21T08:00:00+00:00", NOW) == -3600
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_lib_deadlines.py -v`
Expected: FAIL — `ModuleNotFoundError` / `AttributeError`

- [ ] **Step 3: Create `backend/lib/deadlines.py`**

```python
"""Deadline date normalization + countdown. Pure: no DB/LLM."""
from __future__ import annotations
from datetime import datetime, timedelta, timezone

_WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday",
             "friday", "saturday", "sunday"]


def _parse(ts: str) -> datetime:
    d = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _eod(d: datetime) -> str:
    d = d.replace(hour=17, minute=0, second=0, microsecond=0)
    return d.astimezone(timezone.utc).isoformat()


def normalize_due(expr, now):
    """Map a deadline expression to a UTC ISO-8601 string, or None."""
    now_dt = _parse(now)
    # 1) explicit ISO datetime/date
    try:
        d = datetime.fromisoformat(expr.strip().replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return d.astimezone(timezone.utc).isoformat()
    except ValueError:
        pass
    # 2) keywords
    s = expr.strip().lower()
    s = s[3:].strip() if s.startswith("eod") else s   # strip leading 'eod'
    if s in ("", "today"):
        return _eod(now_dt)
    if s == "tomorrow":
        return _eod(now_dt + timedelta(days=1))
    if s in _WEEKDAYS:
        ahead = (_WEEKDAYS.index(s) - now_dt.weekday()) % 7 or 7  # next future occurrence
        return _eod(now_dt + timedelta(days=ahead))
    return None


def countdown(due_at, now) -> int:
    """Whole seconds until due_at (negative if past)."""
    return int((_parse(due_at) - _parse(now)).total_seconds())
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_lib_deadlines.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Run the FULL suite**

Run: `cd backend && python -m pytest -v`
Expected: PASS (all prior + the new feature-backend tests).

- [ ] **Step 6: Commit**

```bash
git add backend/lib/deadlines.py backend/tests/test_lib_deadlines.py
git commit -m "feat(lib): deadline normalization + countdown"
```

---

## Self-Review

**Spec coverage (feature spec §1-§2, deterministic parts):**
- critical_deadlines / trends / trend_findings tables + `source_skill` + feature config → Task 1. ✓
- Deadline dedup + global/per-row visibility toggle → Task 2. ✓
- Trend upsert on (term, window) + ranked list → Task 3. ✓
- Recency-weighted trend scoring + delta vs prior window → Task 4. ✓
- Deadline date normalization + countdown → Task 5. ✓

**Out of scope (external/optional — later or env-gated):** LLM keyword extraction & deadline detection (Scout skills); vector embeddings + sqlite-vec (additive, needs model); the parse_deadlines/compute_trends/daily_outlook SKILL.md files (Scout-run); all UI (React plan).

**Placeholder scan:** none — complete code + exact commands throughout.

**Type consistency:** `add_deadline`/`list_deadlines`/`set_deadline_visible`/`upsert_trend`/`list_trends`/`aggregate`/`compute_delta`/`normalize_due`/`countdown` used identically across tasks and tests.

**Note for executor:** logic modules take an explicit `now` ISO string — never call `datetime.now()` inside them; the tests depend on determinism (e.g. 2026-06-21 is a Sunday). Half-life and delta-threshold are tuning knobs left as defaults; do not hardcode them away.
