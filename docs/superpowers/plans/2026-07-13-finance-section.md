# Finance Section (SP3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the briefing super-modal's finance placeholder with a live finance strip (user watchlist + market indices) driven by a cached Stooq backend proxy.

**Architecture:** Backend `lib/finance.py` (pure `to_stooq_symbol` + `parse_quotes`) + a cached `/api/finance` proxy (stdlib urllib, one Stooq light-quote request). Frontend `getFinance` feeds a `FinanceStrip` component (watchlist + indices rows of ticker chips, hover OHLC, click→Stooq). Modal integration + a Settings watchlist field. Mirrors the SP2 weather feature shape.

**Tech Stack:** Python stdlib (sqlite3, urllib), pytest; React + TypeScript + MUI, React Query, Vitest. No new dependencies.

## Global Constraints

- No new dependencies. Stooq fetch uses stdlib `urllib.request`. Fixed host `https://stooq.com` only (no SSRF surface).
- Finance is NON-BLOCKING: upstream failure or empty watchlist must never break the modal. `/api/finance` never returns 5xx on upstream error — HTTP 200 with an `error` envelope.
- Config writes go through `db.set_config` allowlist (`WRITABLE_CONFIG`).
- Move metric = `(close - open) / open * 100`, rounded 2dp; `open<=0` or non-numeric → `None`.
- Fixed indices: `^spx` (S&P), `^dji` (Dow), `^ndq` (Nasdaq).
- Click-out URLs pass through `safeHttpUrl` (`frontend/src/lib/url.ts`), opened with `noopener`.
- Keep files under 500 lines. Reuse existing MUI theme tokens.
- Backend tests: `cd backend && .venv/bin/python -m pytest <file> -q`. Frontend: `cd frontend && npx vitest run <file>`; type-check `npx tsc --noEmit`.

---

### Task 1: `lib/finance.py` — pure `to_stooq_symbol` + `parse_quotes`

**Files:**
- Create: `backend/lib/finance.py`
- Test: `backend/tests/test_lib_finance.py` (create)

**Interfaces:**
- Produces: `to_stooq_symbol(ticker: str) -> str`; `parse_quotes(csv_text: str) -> list[dict]` with keys `symbol, price, open, high, low, volume, change_pct, date, time`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_lib_finance.py
from lib import finance


def test_to_stooq_symbol():
    assert finance.to_stooq_symbol("AAPL") == "aapl.us"
    assert finance.to_stooq_symbol("^spx") == "^spx"
    assert finance.to_stooq_symbol("^SPX") == "^spx"
    assert finance.to_stooq_symbol("aapl.us") == "aapl.us"  # already qualified
    assert finance.to_stooq_symbol("  msft ") == "msft.us"
    assert finance.to_stooq_symbol("") == ""


_CSV = (
    "Symbol,Date,Time,Open,High,Low,Close,Volume\n"
    "AAPL.US,2026-07-13,22:00:05,100.0,105.0,99.0,102.0,50000000\n"
    "^SPX,2026-07-13,22:00:05,5000.0,5050.0,4990.0,4950.0,0\n"
)


def test_parse_quotes_maps_and_computes_change():
    rows = finance.parse_quotes(_CSV)
    assert len(rows) == 2
    aapl = rows[0]
    assert aapl["symbol"] == "AAPL"          # .US stripped, upper
    assert aapl["price"] == 102.0
    assert aapl["open"] == 100.0
    assert aapl["volume"] == 50000000
    assert aapl["change_pct"] == 2.0          # (102-100)/100*100
    spx = rows[1]
    assert spx["symbol"] == "^SPX"
    assert spx["change_pct"] == -1.0          # (4950-5000)/5000*100


def test_parse_quotes_defensive():
    assert finance.parse_quotes("") == []
    assert finance.parse_quotes("Symbol,Date,Time,Open,High,Low,Close,Volume\n") == []
    # N/D fields -> None, no raise; zero open -> change_pct None
    nd = ("Symbol,Date,Time,Open,High,Low,Close,Volume\n"
          "FOO.US,2026-07-13,22:00,N/D,N/D,N/D,N/D,N/D\n"
          "BAR.US,2026-07-13,22:00,0,1,0,1,10\n")
    rows = finance.parse_quotes(nd)
    assert rows[0]["price"] is None and rows[0]["change_pct"] is None
    assert rows[1]["change_pct"] is None      # open==0 guarded
    # short row skipped
    assert finance.parse_quotes("Symbol,Date\nX,Y\n") == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_lib_finance.py -q`
Expected: FAIL (`ModuleNotFoundError: lib.finance`).

- [ ] **Step 3: Implement**

```python
# backend/lib/finance.py
"""Finance helpers — pure: Stooq symbols + light-quote CSV parsing."""
from __future__ import annotations
import csv
import io


def to_stooq_symbol(ticker: str) -> str:
    t = (ticker or "").strip().lower()
    if not t:
        return ""
    if t.startswith("^") or "." in t:
        return t
    return f"{t}.us"


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _display_symbol(raw: str) -> str:
    s = (raw or "").strip().upper()
    if s.endswith(".US"):
        s = s[:-3]
    return s


def parse_quotes(csv_text: str) -> list[dict]:
    out: list[dict] = []
    reader = csv.reader(io.StringIO(csv_text or ""))
    rows = list(reader)
    if not rows:
        return out
    for row in rows[1:]:  # skip header
        if len(row) < 8:
            continue
        sym, date, time, o, h, l, c, vol = row[:8]
        op, cl = _num(o), _num(c)
        change = round((cl - op) / op * 100, 2) if (op and op > 0 and cl is not None) else None
        vnum = _num(vol)
        out.append({
            "symbol": _display_symbol(sym),
            "price": cl,
            "open": op,
            "high": _num(h),
            "low": _num(l),
            "volume": int(vnum) if vnum is not None else None,
            "change_pct": change,
            "date": date,
            "time": time,
        })
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/python -m pytest tests/test_lib_finance.py -q`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/lib/finance.py backend/tests/test_lib_finance.py
git commit -m "feat(finance): pure to_stooq_symbol + parse_quotes helpers"
```

---

### Task 2: `/api/finance` endpoint + config key + seed

**Files:**
- Modify: `backend/web/app.py` (import + `_FINANCE_CACHE` + endpoint after `get_weather`)
- Modify: `backend/ea/db.py` (`WRITABLE_CONFIG`)
- Modify: `backend/ea/seed.sql` (seed `finance_watchlist`)
- Test: `backend/tests/test_web_finance.py` (create)

**Interfaces:**
- Consumes: `lib.finance.to_stooq_symbol`, `lib.finance.parse_quotes` (Task 1).
- Produces: `GET /api/finance` → `{watchlist:[Quote], indices:[Quote], stale, error?}`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_web_finance.py
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from ea import db
from web.app import create_app
from web import app as app_mod


def _client(tmp_path, watchlist="AAPL"):
    p = tmp_path / "ea.sqlite"
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    db.set_config(conn, "finance_watchlist", watchlist)
    conn.close()
    return TestClient(create_app(p))


_CSV = (
    "Symbol,Date,Time,Open,High,Low,Close,Volume\n"
    "AAPL.US,2026-07-13,22:00,100.0,105.0,99.0,102.0,5000\n"
    "^SPX,2026-07-13,22:00,5000.0,5050.0,4990.0,5010.0,0\n"
    "^DJI,2026-07-13,22:00,40000,40100,39900,40050,0\n"
    "^NDQ,2026-07-13,22:00,18000,18100,17900,18050,0\n"
)


def _fake_urlopen(*a, **k):
    m = MagicMock()
    m.read.return_value = _CSV.encode()
    m.__enter__.return_value = m
    m.__exit__.return_value = False
    return m


def setup_function():
    app_mod._FINANCE_CACHE.clear()


def test_finance_splits_watchlist_and_indices(tmp_path):
    with patch("web.app.urllib.request.urlopen", _fake_urlopen):
        body = _client(tmp_path).get("/api/finance").json()
    assert [q["symbol"] for q in body["watchlist"]] == ["AAPL"]
    assert {q["symbol"] for q in body["indices"]} == {"^SPX", "^DJI", "^NDQ"}
    assert body["watchlist"][0]["change_pct"] == 2.0
    assert body["stale"] is False


def test_finance_upstream_failure_degrades(tmp_path):
    def boom(*a, **k):
        raise OSError("down")
    with patch("web.app.urllib.request.urlopen", boom):
        r = _client(tmp_path).get("/api/finance")
    assert r.status_code == 200
    assert r.json()["error"] == "unavailable"


def test_finance_cache_hit_skips_fetch(tmp_path):
    c = _client(tmp_path)
    with patch("web.app.urllib.request.urlopen", _fake_urlopen) as mock:
        c.get("/api/finance")
        c.get("/api/finance")
        assert mock.call_count == 1


def test_finance_empty_watchlist_indices_only(tmp_path):
    with patch("web.app.urllib.request.urlopen", _fake_urlopen):
        body = _client(tmp_path, watchlist="").get("/api/finance").json()
    assert body["watchlist"] == []
    assert len(body["indices"]) == 3
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && .venv/bin/python -m pytest tests/test_web_finance.py -q`
Expected: FAIL (404 / `_FINANCE_CACHE` undefined).

- [ ] **Step 3: Implement**

In `backend/web/app.py`, add the import beside the other `from lib import ...` lines:

```python
from lib import finance as _finance
```

(`urllib.request`/`urllib.parse` are already imported from the weather feature.)

Add module-level cache + indices constant near `_WEATHER_CACHE` (module scope):

```python
_FINANCE_CACHE: dict = {}
_FINANCE_TTL = 300  # seconds (5 min)
_FINANCE_INDICES = ["^spx", "^dji", "^ndq"]
```

Add the endpoint immediately after `get_weather` (inside `create_app`):

```python
    @app.get("/api/finance")
    def get_finance(conn=Depends(get_db)):
        row = conn.execute("SELECT value FROM config WHERE key='finance_watchlist'").fetchone()
        watch = [t.strip() for t in (row["value"] if row else "").split(",") if t.strip()]
        symbols = watch + _FINANCE_INDICES
        if not symbols:
            return {"watchlist": [], "indices": [], "stale": False}

        key = ",".join(symbols).upper()
        now = datetime.now(timezone.utc).timestamp()
        cached = _FINANCE_CACHE.get(key)
        if cached and (now - cached[0]) < _FINANCE_TTL:
            return {**cached[1], "stale": False}

        stooq = ",".join(_finance.to_stooq_symbol(s) for s in symbols)
        qs = urllib.parse.urlencode({"s": stooq, "f": "sd2t2ohlcv", "h": "", "e": "csv"})
        url = f"https://stooq.com/q/l/?{qs}"
        idx_set = {i.upper() for i in _FINANCE_INDICES}
        try:
            with urllib.request.urlopen(url, timeout=5) as resp:
                quotes = _finance.parse_quotes(resp.read().decode())
            payload = {
                "watchlist": [q for q in quotes if q["symbol"].upper() not in idx_set],
                "indices": [q for q in quotes if q["symbol"].upper() in idx_set],
            }
            _FINANCE_CACHE[key] = (now, payload)
            return {**payload, "stale": False}
        except Exception:
            if cached:
                return {**cached[1], "stale": True}
            return {"watchlist": [], "indices": [], "error": "unavailable"}
```

In `backend/ea/db.py`, add `finance_watchlist` to `WRITABLE_CONFIG`:

```python
WRITABLE_CONFIG = {"deadlines_visible_global", "outlook_send_time", "trend_window_days",
                   "reminder_enabled", "reminder_lead_minutes",
                   "alert_loud_threshold", "alert_sound_enabled", "daily_summary",
                   "weather_lat", "weather_lon", "weather_label", "finance_watchlist"}
```

In `backend/ea/seed.sql`, the config INSERT currently ends at `('weather_label', 'New York');`. Change that line's terminator to a comma and append the finance row so the statement stays valid:

```sql
  ('weather_label',     'New York'),
  ('finance_watchlist', 'AAPL,MSFT,GOOGL,NVDA');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && .venv/bin/python -m pytest tests/test_web_finance.py tests/test_schema.py -q`
Expected: PASS (4 finance + schema unaffected).

- [ ] **Step 5: Commit**

```bash
git add backend/web/app.py backend/ea/db.py backend/ea/seed.sql backend/tests/test_web_finance.py
git commit -m "feat(finance): cached /api/finance Stooq proxy + watchlist config"
```

---

### Task 3: Frontend `getFinance` + types

**Files:**
- Modify: `frontend/src/api.ts` (types + `getFinance`)
- Test: `frontend/src/api.finance.test.ts` (create)

**Interfaces:**
- Produces: `Quote`, `FinanceResponse` types; `getFinance(): Promise<FinanceResponse>` hitting `/api/finance`.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/api.finance.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { getFinance } from './api'
afterEach(() => vi.restoreAllMocks())

describe('getFinance', () => {
  it('hits /api/finance', async () => {
    const payload = { watchlist: [{ symbol: 'AAPL', price: 102, change_pct: 2 }], indices: [], stale: false }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      { ok: true, json: () => Promise.resolve(payload) }))
    const out = await getFinance()
    expect(out.watchlist[0].symbol).toBe('AAPL')
    expect(fetch).toHaveBeenCalledWith('/api/finance')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/api.finance.test.ts`
Expected: FAIL (`getFinance` not exported).

- [ ] **Step 3: Implement**

Add to `frontend/src/api.ts` (near the other types + fetchers):

```typescript
export interface Quote {
  symbol: string
  price?: number
  open?: number; high?: number; low?: number; volume?: number
  change_pct?: number | null
  date?: string; time?: string
}
export interface FinanceResponse {
  watchlist: Quote[]
  indices: Quote[]
  stale?: boolean
  error?: string
}
export const getFinance = () => fetchJson<FinanceResponse>('/api/finance')
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/api.finance.test.ts && npx tsc --noEmit`
Expected: PASS + clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.ts frontend/src/api.finance.test.ts
git commit -m "feat(finance): getFinance api + Quote/FinanceResponse types"
```

---

### Task 4: `FinanceStrip` component

**Files:**
- Create: `frontend/src/components/finance/FinanceStrip.tsx`
- Test: `frontend/src/components/finance/FinanceStrip.test.tsx` (create)

**Interfaces:**
- Consumes: `FinanceResponse`/`Quote` (Task 3), `safeHttpUrl` (`@/lib/url`).
- Produces: `<FinanceStrip finance={FinanceResponse} />`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/finance/FinanceStrip.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FinanceStrip } from './FinanceStrip'

const fin = {
  watchlist: [
    { symbol: 'AAPL', price: 102, open: 100, high: 105, low: 99, volume: 5000, change_pct: 2 },
    { symbol: 'MSFT', price: 98, open: 100, high: 101, low: 97, volume: 3000, change_pct: -2 },
  ],
  indices: [{ symbol: '^SPX', price: 5010, change_pct: 0.2 }],
  stale: false,
}

afterEach(() => vi.restoreAllMocks())

describe('FinanceStrip', () => {
  it('renders watchlist + indices chips with direction', () => {
    render(<FinanceStrip finance={fin} />)
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('^SPX')).toBeInTheDocument()
    expect(screen.getByTestId('quote-AAPL').getAttribute('data-dir')).toBe('up')
    expect(screen.getByTestId('quote-MSFT').getAttribute('data-dir')).toBe('down')
  })
  it('click opens Stooq in a new tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<FinanceStrip finance={fin} />)
    await userEvent.click(screen.getByTestId('quote-AAPL'))
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('stooq.com/q/?s=aapl.us'), '_blank', 'noopener')
  })
  it('shows unavailable state on error', () => {
    render(<FinanceStrip finance={{ watchlist: [], indices: [], error: 'unavailable' }} />)
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/finance/FinanceStrip.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `frontend/src/components/finance/FinanceStrip.tsx`. Requirements (write real code satisfying the tests + constraints):

- Props `{ finance: FinanceResponse }`.
- If `finance.error` or both `watchlist` and `indices` are empty → render a muted Box with "Markets unavailable". Return early.
- Otherwise a container (`p: 2`, `bgcolor: 'action.hover'`, `borderRadius: 1`) with two labelled rows: "WATCHLIST" (from `finance.watchlist`) and "MARKETS" (from `finance.indices`). Omit a row whose array is empty.
- A `toStooq(symbol)` inline helper: `s = symbol.toLowerCase(); return s.startsWith('^') || s.includes('.') ? s : s + '.us'`.
- Each quote → a chip `Box` with `data-testid={`quote-${q.symbol}`}` and `data-dir={dir}` where `dir = q.change_pct == null ? 'flat' : q.change_pct > 0 ? 'up' : q.change_pct < 0 ? 'down' : 'flat'`.
  - Content: `symbol`, `price` (monospace, e.g. `{q.price?.toFixed(2)}`), and `change_pct` with a ▲ (up) / ▼ (down) glyph, `{q.change_pct?.toFixed(2)}%`. Color: up → `success.main`, down → `error.main`, flat → `text.secondary`.
  - Wrap the chip in a MUI `Tooltip` whose title shows `O {open} H {high} L {low} · Vol {volume}` (omit missing fields gracefully).
  - Click + Enter: `const url = safeHttpUrl(`https://stooq.com/q/?s=${toStooq(q.symbol)}`); if (url) window.open(url, '_blank', 'noopener')`. Chip gets `role="button"`, `tabIndex={0}`, `cursor: 'pointer'`, `'&:hover': { bgcolor: 'action.selected' }`, and an `onKeyDown` firing on `Enter`.
- Existing theme tokens; keep file under 500 lines.

- [ ] **Step 4: Run test + type-check**

Run: `cd frontend && npx vitest run src/components/finance/FinanceStrip.test.tsx && npx tsc --noEmit`
Expected: PASS + clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/finance/FinanceStrip.tsx frontend/src/components/finance/FinanceStrip.test.tsx
git commit -m "feat(finance): FinanceStrip chips (watchlist + indices, hover/click)"
```

---

### Task 5: Modal integration + Settings watchlist field

**Files:**
- Modify: `frontend/src/components/TodayBriefing.tsx` (wire strip + fetch)
- Modify: `frontend/src/views/Settings.tsx` (watchlist field)
- Modify: `frontend/src/components/TodayBriefing.test.tsx` (strip presence assertion)

**Interfaces:**
- Consumes: `FinanceStrip` (Task 4), `getFinance` (Task 3).

- [ ] **Step 1: Write the failing test** (append to `TodayBriefing.test.tsx`)

```tsx
it('renders the finance strip region', async () => {
  vi.spyOn(api, 'getBriefing').mockResolvedValue(payload as never)
  vi.spyOn(api, 'getFinance').mockResolvedValue(
    { watchlist: [{ symbol: 'AAPL', price: 102, change_pct: 2 }], indices: [], stale: false } as never)
  renderModal()
  expect(await screen.findByText('AAPL')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/TodayBriefing.test.tsx`
Expected: FAIL (no finance strip / getFinance not called).

- [ ] **Step 3: Implement**

In `TodayBriefing.tsx`:
- Import `FinanceStrip` (`@/components/finance/FinanceStrip`) and `getFinance` (`@/api`).
- Add `const { data: finance } = useQuery({ queryKey: ['finance'], queryFn: getFinance, enabled: open })`.
- Replace the finance placeholder Box (the "Markets — coming soon" block, ~lines 243-248) with:
  `{finance ? <FinanceStrip finance={finance} /> : <Box sx={{ minHeight: 60 }} />}`.

In `Settings.tsx`, add a "Watchlist" field to the weather/config area: a `TextField` bound to `cfg.finance_watchlist` (comma-separated tickers), calling `saveCfg.mutate({ key: 'finance_watchlist', value })` on blur. Helper text: "Comma-separated tickers shown in the daily briefing."

- [ ] **Step 4: Run tests + full regression**

Run: `cd frontend && npx vitest run src/components/TodayBriefing.test.tsx && npx tsc --noEmit`
Then full suites:
`cd backend && .venv/bin/python -m pytest -q`
`cd frontend && npx vitest run`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TodayBriefing.tsx frontend/src/views/Settings.tsx frontend/src/components/TodayBriefing.test.tsx
git commit -m "feat(finance): wire FinanceStrip into briefing modal + settings watchlist"
```

---

## Self-Review

**Spec coverage:**
- `lib/finance.py` `to_stooq_symbol` + `parse_quotes` (change_pct, N/D-safe) → Task 1. ✔
- `/api/finance` cached Stooq proxy + watchlist/indices split + config + seed + graceful degrade → Task 2. ✔
- `getFinance` + `Quote`/`FinanceResponse` types → Task 3. ✔
- `FinanceStrip` (chips, up/down color, hover OHLC, click→Stooq via safeHttpUrl, unavailable state) → Task 4. ✔
- Modal integration + Settings watchlist field → Task 5. ✔
- Testing (parse/symbol, endpoint cache+degrade+split, strip render/click, integration) → Tasks 1-5. ✔
- Out of scope (sparklines, streaming, internal detail view) — not planned. ✔

**Placeholder scan:** No TBD/TODO. Task 4's component body is described (presentational, testid/dir + constraint driven) rather than verbatim — acceptable; tests pin the observable contract (symbol/price/dir/tooltip/click-url/unavailable).

**Type consistency:** `Quote`/`FinanceResponse` keys (Task 3) match backend `parse_quotes` output (Task 1) + endpoint envelope (Task 2). `finance.error`/`watchlist`/`indices` used consistently in endpoint (Task 2), types (Task 3), strip (Task 4), modal (Task 5). `_FINANCE_CACHE`/`_FINANCE_INDICES` names consistent Task 2 code ↔ test. `to_stooq_symbol` rule (append `.us`, `^`/`.`-passthrough) identical in backend Task 1 and the frontend `toStooq` inline helper (Task 4).
