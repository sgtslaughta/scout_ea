# Briefing Finance Row Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the briefing's watchlist and markets rows into one paged, auto-rotating row, and give each ticker a hover menu with 1d/5d/1w/1m sparklines backed by a new lazy history endpoint.

**Architecture:** A new `/api/finance/history` endpoint proxies Yahoo's chart API for a single symbol and range, guarded by a strict symbol whitelist. The frontend fetches it only when a ticker's hover popover opens. `FinanceStrip` merges both quote lists into one array and pages it based on measured width, advancing on an interval with manual override.

**Tech Stack:** Python 3.14 stdlib (`urllib.request`, no new deps), FastAPI, pytest; React 19, TypeScript, MUI v7, `@mui/x-charts` `SparkLineChart` (already a dependency), TanStack Query, Vitest.

## Global Constraints

- Slice 2 of 3 from `docs/superpowers/specs/2026-07-25-briefing-polish-design.md`.
- Verify the frontend with `npm run build` (runs `tsc -b`, strict). Do NOT use `tsc --noEmit`.
- Frontend tests: `cd frontend && npx vitest run`. Backend tests: `cd backend && ../.venv/bin/python -m pytest -q`.
- No new dependencies. `@mui/x-charts@^9.9.0` is already installed and already used in `frontend/src/widgets/KpiStrip.tsx:40`.
- Pure helpers in `backend/lib/` do no I/O and never raise.
- Upstream failure must never break the modal — always HTTP 200 with a graceful envelope, never a 5xx.
- All animation must be disabled under `@media (prefers-reduced-motion: reduce)`.
- Do not touch `schedule:` frontmatter in any `SKILL.md`.

---

### Task 1: `parse_history` pure helper

**Files:**
- Modify: `backend/lib/finance.py`
- Test: `backend/tests/test_lib_finance.py` (add to the existing file)

**Interfaces:**
- Consumes: nothing.
- Produces: `parse_history(result: dict) -> list[float]` — takes one Yahoo v8 chart `result[0]` dict, returns the close-price series with nulls dropped. Never raises; returns `[]` for unusable input.

Yahoo returns gaps as `null` inside `indicators.quote[0].close` (market closed, thin trading). `SparkLineChart` cannot render nulls, so they are dropped rather than interpolated.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_lib_finance.py`:

```python
from lib import finance as _finance


def test_parse_history_extracts_close_series():
    result = {"indicators": {"quote": [{"close": [1.0, 2.5, 3.25]}]}}
    assert _finance.parse_history(result) == [1.0, 2.5, 3.25]


def test_parse_history_drops_nulls():
    result = {"indicators": {"quote": [{"close": [1.0, None, 3.0, None]}]}}
    assert _finance.parse_history(result) == [1.0, 3.0]


def test_parse_history_handles_unusable_input():
    assert _finance.parse_history({}) == []
    assert _finance.parse_history(None) == []
    assert _finance.parse_history({"indicators": {}}) == []
    assert _finance.parse_history({"indicators": {"quote": []}}) == []


def test_parse_history_coerces_ints_and_skips_junk():
    result = {"indicators": {"quote": [{"close": [1, "bad", 3.5]}]}}
    assert _finance.parse_history(result) == [1.0, 3.5]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ../.venv/bin/python -m pytest tests/test_lib_finance.py -q`
Expected: FAIL — `AttributeError: module 'lib.finance' has no attribute 'parse_history'`

- [ ] **Step 3: Implement it**

Append to `backend/lib/finance.py`:

```python
def parse_history(result: dict) -> list[float]:
    """One Yahoo v8 chart `result[0]` dict → close-price series, nulls dropped.

    Yahoo writes null for gaps (market closed, thin trading); SparkLineChart
    cannot render those, so they are dropped rather than interpolated.
    """
    q = (((result or {}).get("indicators") or {}).get("quote") or [{}])[0]
    out = []
    for v in (q.get("close") or []):
        n = _num(v)
        if n is not None:
            out.append(n)
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && ../.venv/bin/python -m pytest tests/test_lib_finance.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/lib/finance.py backend/tests/test_lib_finance.py
git commit -m "feat(finance): parse_history extracts close series from Yahoo chart"
```

---

### Task 2: `GET /api/finance/history` with a symbol whitelist

**SECURITY — this is the point of the task.** The symbol is interpolated into an upstream URL. An unvalidated value lets a caller steer the request at Yahoo's host and path, which is an SSRF vector. The symbol must be validated against the currently-configured watchlist plus the fixed index list, and rejected with HTTP 400 otherwise. Do not rely on URL-encoding alone.

**Files:**
- Modify: `backend/web/app.py` (add after `get_finance`, which ends at line ~594)
- Test: `backend/tests/test_finance_history_endpoint.py` (create)

**Interfaces:**
- Consumes: `_finance.to_yahoo_symbol`, `_finance.parse_history` (Task 1), the module-level `_FINANCE_INDICES`, and the `finance_watchlist` config key.
- Produces: `GET /api/finance/history?symbol=<str>&range=<1d|5d|1w|1m>` → `{"symbol": str, "range": str, "points": list[float], "stale": bool}`. On upstream failure: HTTP 200 with `{"symbol", "range", "points": [], "error": "unavailable"}`. On a bad symbol or range: HTTP 400.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_finance_history_endpoint.py`. Follow the app-fixture pattern used by `backend/tests/test_mcp_config_endpoint.py`:

```python
def test_history_rejects_symbol_not_in_watchlist(client):
    """SSRF guard: the symbol reaches an upstream URL, so only known symbols pass."""
    r = client.get("/api/finance/history?symbol=evil.example.com&range=1d")
    assert r.status_code == 400


def test_history_rejects_unknown_range(client):
    r = client.get("/api/finance/history?symbol=^GSPC&range=10y")
    assert r.status_code == 400


def test_history_accepts_a_fixed_index(client, monkeypatch):
    import web.app as app_mod

    class _Resp:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def read(self):
            return b'{"chart":{"result":[{"indicators":{"quote":[{"close":[1.0,2.0]}]}}]}}'

    monkeypatch.setattr(app_mod.urllib.request, "urlopen", lambda *a, **k: _Resp())
    r = client.get("/api/finance/history?symbol=^GSPC&range=1d")
    assert r.status_code == 200
    assert r.json()["points"] == [1.0, 2.0]


def test_history_returns_graceful_envelope_on_upstream_failure(client, monkeypatch):
    import web.app as app_mod

    def _boom(*a, **k):
        raise OSError("upstream down")

    monkeypatch.setattr(app_mod.urllib.request, "urlopen", _boom)
    r = client.get("/api/finance/history?symbol=^GSPC&range=1d")
    assert r.status_code == 200          # never 5xx — the modal must not break
    assert r.json()["points"] == []
    assert r.json()["error"] == "unavailable"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ../.venv/bin/python -m pytest tests/test_finance_history_endpoint.py -q`
Expected: FAIL — 404, the route does not exist.

- [ ] **Step 3: Add the endpoint**

In `backend/web/app.py`, immediately after `get_finance`, add:

```python
    # range → (Yahoo range, Yahoo interval). Closed whitelist: anything else is rejected.
    _HISTORY_RANGES = {
        "1d": ("1d", "5m"),
        "5d": ("5d", "15m"),
        "1w": ("7d", "30m"),
        "1m": ("1mo", "1d"),
    }
    _HISTORY_CACHE: dict = {}
    _HISTORY_TTL = 300

    @app.get("/api/finance/history")
    def get_finance_history(symbol: str, range: str = "1d", conn=Depends(get_db)):
        rng = _HISTORY_RANGES.get(range)
        if rng is None:
            raise HTTPException(status_code=400, detail="unknown range")

        # SECURITY: `symbol` is interpolated into an upstream URL. Only symbols the
        # user has actually configured (or our fixed indices) may be requested —
        # otherwise this endpoint is an SSRF pivot. Encoding alone is not enough.
        row = conn.execute("SELECT value FROM config WHERE key='finance_watchlist'").fetchone()
        watch = [t.strip() for t in (row["value"] if row else "").split(",") if t.strip()]
        allowed = {_finance.to_yahoo_symbol(s) for s in watch if s}
        allowed |= {i.upper() for i in _FINANCE_INDICES}
        y = _finance.to_yahoo_symbol(symbol)
        if not y or y not in allowed:
            raise HTTPException(status_code=400, detail="unknown symbol")

        key = (y, range)
        now = datetime.now(timezone.utc).timestamp()
        cached = _HISTORY_CACHE.get(key)
        if cached and (now - cached[0]) < _HISTORY_TTL:
            return {"symbol": y, "range": range, "points": cached[1], "stale": False}

        yr, yi = rng
        try:
            cu = (f"https://query1.finance.yahoo.com/v8/finance/chart/"
                  f"{urllib.parse.quote(y)}?interval={yi}&range={yr}")
            req = urllib.request.Request(cu, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                raw = json.loads(resp.read().decode())
            res = ((raw.get("chart") or {}).get("result") or [None])[0]
            points = _finance.parse_history(res) if res else []
            _HISTORY_CACHE[key] = (now, points)
            return {"symbol": y, "range": range, "points": points, "stale": False}
        except Exception:
            if cached:
                return {"symbol": y, "range": range, "points": cached[1], "stale": True}
            return {"symbol": y, "range": range, "points": [], "error": "unavailable"}
```

Confirm `HTTPException` is imported at the top of `app.py`; if not, add it to the existing `from fastapi import ...` line.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && ../.venv/bin/python -m pytest tests/test_finance_history_endpoint.py -q`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && ../.venv/bin/python -m pytest -q`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/web/app.py backend/tests/test_finance_history_endpoint.py
git commit -m "feat(api): GET /api/finance/history with symbol whitelist

The symbol reaches an upstream Yahoo URL, so it is validated against the
configured watchlist plus fixed indices and rejected with 400 otherwise."
```

---

### Task 3: Frontend history fetcher

**Files:**
- Modify: `frontend/src/api.ts`
- Test: `frontend/src/api.finance.test.ts` (create)

**Interfaces:**
- Consumes: the existing `fetchJson` helper in `api.ts`.
- Produces: `export type HistoryRange = '1d' | '5d' | '1w' | '1m'`, `export interface FinanceHistory { symbol: string; range: string; points: number[]; stale?: boolean; error?: string }`, and `export const getFinanceHistory = (symbol: string, range: HistoryRange) => Promise<FinanceHistory>`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/api.finance.test.ts`, following the shape of the existing `frontend/src/api.mcp.test.ts`:

```ts
import { getFinanceHistory } from './api'

describe('getFinanceHistory', () => {
  it('requests the symbol and range', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ symbol: 'AAPL', range: '5d', points: [1, 2, 3] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const out = await getFinanceHistory('AAPL', '5d')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/finance/history?symbol=AAPL&range=5d'),
      expect.anything(),
    )
    expect(out.points).toEqual([1, 2, 3])
    vi.unstubAllGlobals()
  })
})
```

If `fetchJson` calls `fetch` with a single argument, drop the `expect.anything()` second argument to match.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run api.finance`
Expected: FAIL — `getFinanceHistory` is not exported.

- [ ] **Step 3: Add the types and fetcher**

Append to `frontend/src/api.ts`, next to the existing `getFinance`:

```ts
export type HistoryRange = '1d' | '5d' | '1w' | '1m'

export interface FinanceHistory {
  symbol: string
  range: string
  points: number[]
  stale?: boolean
  error?: string
}

export const getFinanceHistory = (symbol: string, range: HistoryRange) =>
  fetchJson<FinanceHistory>(
    `/api/finance/history?symbol=${encodeURIComponent(symbol)}&range=${range}`,
  )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run api.finance`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.ts frontend/src/api.finance.test.ts
git commit -m "feat(api): getFinanceHistory fetcher + HistoryRange type"
```

---

### Task 4: Paging math helper

Pure function, tested directly — the packing logic is where the bugs live, and testing it through the DOM would be indirect and brittle.

**Files:**
- Create: `frontend/src/components/finance/paging.ts`
- Create: `frontend/src/components/finance/paging.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `packPages(widths: number[], available: number, gap: number): number[][]` — returns arrays of indices, one per page. Greedy: fill a page until the next item would overflow. An item wider than `available` gets its own page (it is pannable rather than droppable). Empty input → `[]`. `available <= 0` → one page containing everything (unmeasured; render rather than hide).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/finance/paging.test.ts`:

```ts
import { packPages } from './paging'

describe('packPages', () => {
  it('packs items greedily into pages', () => {
    // 3 items of 100 + gaps of 10 into 220 available: [0,1] then [2]
    expect(packPages([100, 100, 100], 220, 10)).toEqual([[0, 1], [2]])
  })

  it('returns one page when everything fits', () => {
    expect(packPages([50, 50], 500, 10)).toEqual([[0, 1]])
  })

  it('gives an oversized item its own page', () => {
    // item 1 is wider than the row — it pans rather than being dropped
    expect(packPages([50, 900, 50], 200, 10)).toEqual([[0], [1], [2]])
  })

  it('handles empty input', () => {
    expect(packPages([], 300, 10)).toEqual([])
  })

  it('falls back to a single page when width is unmeasured', () => {
    expect(packPages([100, 100], 0, 10)).toEqual([[0, 1]])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run paging`
Expected: FAIL — cannot resolve `./paging`.

- [ ] **Step 3: Implement it**

Create `frontend/src/components/finance/paging.ts`:

```ts
/**
 * Greedily pack item widths into pages that fit `available`.
 * Returns arrays of indices, one per page.
 *
 * An item wider than the row gets its own page rather than being dropped —
 * the row pans it L→R instead.
 */
export function packPages(widths: number[], available: number, gap: number): number[][] {
  if (widths.length === 0) return []
  // Unmeasured (first render, hidden container): show everything on one page.
  if (available <= 0) return [widths.map((_, i) => i)]

  const pages: number[][] = []
  let page: number[] = []
  let used = 0

  for (let i = 0; i < widths.length; i++) {
    const w = widths[i]
    const cost = page.length === 0 ? w : w + gap
    if (page.length > 0 && used + cost > available) {
      pages.push(page)
      page = [i]
      used = w
    } else {
      page.push(i)
      used += cost
    }
  }
  if (page.length > 0) pages.push(page)
  return pages
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run paging`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/finance/paging.ts frontend/src/components/finance/paging.test.ts
git commit -m "feat(finance): packPages greedy page-packing helper"
```

---

### Task 5: Merged paged rotating row

**Files:**
- Modify: `frontend/src/components/finance/FinanceStrip.tsx` (currently 123 lines — replace the two-group render at lines 94-122)
- Modify: `frontend/src/components/finance/FinanceStrip.test.tsx`
- Modify: `backend/ea/seed.sql`, and the `WRITABLE_CONFIG` set in `backend/ea/db.py:593`

**Interfaces:**
- Consumes: `packPages` (Task 4), the existing `FinanceResponse` / `Quote` types.
- Produces: a single merged row. `FinanceStripProps` gains `intervalMs?: number` (default 15000) so tests can drive it deterministically.

Merge order is indices first, then watchlist — market context before personal holdings.

- [ ] **Step 1: Add the config key**

In `backend/ea/seed.sql`, next to the existing `finance_watchlist` row, add:

```sql
  ('briefing_ticker_interval_ms', '15000'),
```

Add `"briefing_ticker_interval_ms"` to the `WRITABLE_CONFIG` set at `backend/ea/db.py:593` (the same whitelist that holds `finance_watchlist`).

- [ ] **Step 2: Write the failing test**

Add to `frontend/src/components/finance/FinanceStrip.test.tsx`:

```tsx
const finance = {
  watchlist: [{ symbol: 'AAPL', price: 1, change_pct: 1 }],
  indices: [{ symbol: '^GSPC', name: 'S&P 500', price: 2, change_pct: -1 }],
}

it('renders indices and watchlist in one merged row', () => {
  render(<FinanceStrip finance={finance} />)
  expect(screen.getByTestId('finance-row')).toBeInTheDocument()
  // Both groups present, no separate WATCHLIST / MARKETS group rows
  expect(screen.getByTestId('quote-^GSPC')).toBeInTheDocument()
  expect(screen.getByTestId('quote-AAPL')).toBeInTheDocument()
})

// jsdom has no layout engine: offsetWidth/clientWidth are always 0, and
// packPages falls back to a single page when `available <= 0`. Rotation can
// therefore NEVER occur in jsdom unless these are stubbed. Without this
// helper the rotation test silently passes against a component that does not
// rotate at all.
function stubLayout({ chip, row }: { chip: number; row: number }) {
  const offset = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
    .mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-chip') ? chip : row
    })
  const client = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get')
    .mockReturnValue(row)
  return () => { offset.mockRestore(); client.mockRestore() }
}

const many = {
  indices: Array.from({ length: 6 }, (_, i) => ({
    symbol: `^IDX${i}`, name: `Index ${i}`, price: 100 + i, change_pct: 1,
  })),
  watchlist: Array.from({ length: 6 }, (_, i) => ({
    symbol: `SYM${i}`, price: 50 + i, change_pct: -1,
  })),
}

it('advances the page on the interval and wraps at the end', () => {
  // 12 chips of 100px in a 250px row => 3 pages
  const restore = stubLayout({ chip: 100, row: 250 })
  vi.useFakeTimers()
  render(<FinanceStrip finance={many} intervalMs={1000} />)

  const row = () => screen.getByTestId('finance-row')
  expect(row()).toHaveAttribute('data-page', '0')

  act(() => { vi.advanceTimersByTime(1100) })
  expect(row()).toHaveAttribute('data-page', '1')

  // keep advancing until it must have wrapped back to 0
  const pages = Number(row().getAttribute('data-page-count'))
  expect(pages).toBeGreaterThan(1)
  act(() => { vi.advanceTimersByTime(1100 * pages) })
  expect(row()).toHaveAttribute('data-page', '0')

  vi.useRealTimers()
  restore()
})

it('pauses rotation while hovered', async () => {
  const restore = stubLayout({ chip: 100, row: 250 })
  vi.useFakeTimers()
  render(<FinanceStrip finance={many} intervalMs={1000} />)
  const row = () => screen.getByTestId('finance-row')

  fireEvent.mouseEnter(row().parentElement!)
  act(() => { vi.advanceTimersByTime(5000) })
  expect(row()).toHaveAttribute('data-page', '0')   // frozen while hovered

  fireEvent.mouseLeave(row().parentElement!)
  act(() => { vi.advanceTimersByTime(1100) })
  expect(row()).toHaveAttribute('data-page', '1')   // resumes on leave

  vi.useRealTimers()
  restore()
})

it('advances when the manual button is pressed', async () => {
  render(<FinanceStrip finance={finance} intervalMs={999999} />)
  const btn = screen.getByRole('button', { name: /next tickers/i })
  await userEvent.click(btn)
  expect(screen.getByTestId('finance-row')).toBeInTheDocument()
})
```

Import `act` and `fireEvent` from `@testing-library/react` and `userEvent` from
`@testing-library/user-event`, matching the existing imports in this test file.

**Why the layout stub is mandatory:** `packPages` returns a single page when
`available <= 0`, and jsdom reports every element's `offsetWidth` and
`clientWidth` as 0. A rotation test without `stubLayout` therefore exercises a
one-page strip, where the page index legitimately never changes — it would pass
against a component with no rotation logic whatsoever. Any assertion about
paging must stub layout first.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npx vitest run FinanceStrip`
Expected: FAIL — no `finance-row` testid, no "next tickers" button.

- [ ] **Step 4: Implement the paged row**

In `FinanceStrip.tsx`: keep `renderQuote` and the error early-return exactly as they are. Replace `groupLabel` and the final `return` block with a merged, paged implementation.

Add imports:

```tsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { IconButton } from '@mui/material'
import { ChevronDown } from 'lucide-react'
import { packPages } from './paging'
```

Add to the props interface:

```tsx
export interface FinanceStripProps {
  finance: FinanceResponse
  /** Auto-advance interval. Exposed so tests can drive it deterministically. */
  intervalMs?: number
}
```

Inside the component, after the early return:

```tsx
  // Indices first (market context), then the user's own watchlist.
  const merged = useMemo(
    () => [
      ...finance.indices.map((q) => ({ q, useName: true })),
      ...finance.watchlist.map((q) => ({ q, useName: false })),
    ],
    [finance.indices, finance.watchlist],
  )

  const rowRef = useRef<HTMLDivElement>(null)
  const [widths, setWidths] = useState<number[]>([])
  const [available, setAvailable] = useState(0)
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(false)

  // Measure chips + container, and re-measure on resize.
  useLayoutEffect(() => {
    const el = rowRef.current
    if (!el) return
    const measure = () => {
      const chips = Array.from(el.querySelectorAll('[data-chip]')) as HTMLElement[]
      setWidths(chips.map((c) => c.offsetWidth))
      setAvailable(el.clientWidth)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [merged.length])

  const pages = useMemo(() => packPages(widths, available, 8), [widths, available])
  const pageCount = Math.max(1, pages.length)

  useEffect(() => { if (page >= pageCount) setPage(0) }, [page, pageCount])

  const advance = () => setPage((p) => (p + 1) % pageCount)

  useEffect(() => {
    if (paused || pageCount <= 1) return
    const id = setInterval(advance, intervalMs)
    return () => clearInterval(id)
  }, [paused, pageCount, intervalMs])
```

Then the render — one row, all chips mounted (so they stay measurable), translated to show the active page:

```tsx
  const activeIdx = pages[Math.min(page, pages.length - 1)] ?? merged.map((_, i) => i)
  const firstVisible = activeIdx[0] ?? 0
  const offset = widths.slice(0, firstVisible).reduce((a, w) => a + w + 8, 0)

  return (
    <Box
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1, p: 1.5, borderRadius: 1,
        border: '1px solid', borderColor: 'divider',
      }}
    >
      <Box
        ref={rowRef}
        data-testid="finance-row"
        data-page={page}
        data-page-count={pageCount}
        sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}
      >
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            transform: `translateX(${-offset}px)`,
            transition: 'transform 400ms ease',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          }}
        >
          {merged.map(({ q, useName }) => (
            <Box key={q.symbol} data-chip sx={{ flexShrink: 0 }}>
              {renderQuote(q, useName)}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Dots only make sense with more than one page; the manual advance is always
          available so the control does not appear and vanish as the row is resized. */}
      {pageCount > 1 && (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {Array.from({ length: pageCount }, (_, i) => (
            <Box key={i} sx={{
              width: 6, height: 6, borderRadius: '50%',
              bgcolor: i === page ? 'primary.main' : 'action.disabled',
            }} />
          ))}
        </Box>
      )}
      <IconButton size="small" aria-label="Next tickers" onClick={advance}>
        <ChevronDown size={16} />
      </IconButton>
    </Box>
  )
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run FinanceStrip`
Expected: PASS

- [ ] **Step 6: Run the full suite + build**

Run: `cd frontend && npx vitest run && npm run build`
Expected: all pass; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/finance/FinanceStrip.tsx frontend/src/components/finance/FinanceStrip.test.tsx backend/ea/seed.sql backend/web/app.py
git commit -m "feat(finance): merge watchlist+markets into one paged rotating row"
```

---

### Task 6: Ticker hover popover with sparklines

**Files:**
- Create: `frontend/src/components/finance/TickerPopover.tsx`
- Create: `frontend/src/components/finance/TickerPopover.test.tsx`
- Modify: `frontend/src/components/finance/FinanceStrip.tsx` (replace the `Tooltip` in `renderQuote`)

**Interfaces:**
- Consumes: `getFinanceHistory`, `HistoryRange` (Task 3); `Quote` from `@/api`; `SparkLineChart` from `@mui/x-charts/SparkLineChart`.
- Produces: `<TickerPopover quote={Quote} anchorEl={HTMLElement | null} open={boolean} onClose={() => void} />`.

The popover must be hoverable (the range toggles are clickable), so it uses `Popover` with `sx={{ pointerEvents: 'none' }}` on the root and `pointerEvents: 'auto'` on the paper, and closes on mouse-leave of the paper.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/finance/TickerPopover.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TickerPopover } from './TickerPopover'

vi.mock('@/api', async () => ({
  ...(await vi.importActual<any>('@/api')),
  getFinanceHistory: vi.fn().mockResolvedValue({ symbol: 'AAPL', range: '1d', points: [1, 2, 3] }),
}))

const quote = { symbol: 'AAPL', price: 100, open: 99, high: 101, low: 98, volume: 1000, change_pct: 1 }

it('shows OHLC and the range toggles', async () => {
  const anchor = document.createElement('div')
  document.body.appendChild(anchor)
  render(<TickerPopover quote={quote} anchorEl={anchor} open onClose={() => {}} />)

  expect(await screen.findByText(/AAPL/)).toBeInTheDocument()
  expect(screen.getByText(/O 99/)).toBeInTheDocument()
  for (const r of ['1d', '5d', '1w', '1m']) {
    expect(screen.getByRole('button', { name: r })).toBeInTheDocument()
  }
})

it('fetches a new range when a toggle is clicked', async () => {
  const { getFinanceHistory } = await import('@/api')
  const anchor = document.createElement('div')
  document.body.appendChild(anchor)
  render(<TickerPopover quote={quote} anchorEl={anchor} open onClose={() => {}} />)

  await userEvent.click(screen.getByRole('button', { name: '1m' }))
  expect(getFinanceHistory).toHaveBeenCalledWith('AAPL', '1m')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run TickerPopover`
Expected: FAIL — cannot resolve `./TickerPopover`.

- [ ] **Step 3: Implement the popover**

Create `frontend/src/components/finance/TickerPopover.tsx`:

```tsx
import { useState } from 'react'
import { Box, Popover, Typography, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { SparkLineChart } from '@mui/x-charts/SparkLineChart'
import { useQuery } from '@tanstack/react-query'
import { getFinanceHistory, type HistoryRange, type Quote } from '@/api'

const RANGES: HistoryRange[] = ['1d', '5d', '1w', '1m']

export interface TickerPopoverProps {
  quote: Quote
  anchorEl: HTMLElement | null
  open: boolean
  onClose: () => void
}

export function TickerPopover({ quote, anchorEl, open, onClose }: TickerPopoverProps) {
  const [range, setRange] = useState<HistoryRange>('1d')

  // Lazy: nothing is fetched until the popover actually opens.
  const { data } = useQuery({
    queryKey: ['finance-history', quote.symbol, range],
    queryFn: () => getFinanceHistory(quote.symbol, range),
    enabled: open,
    staleTime: 300_000,
  })

  const ohlc = [
    quote.open != null && `O ${quote.open}`,
    quote.high != null && `H ${quote.high}`,
    quote.low != null && `L ${quote.low}`,
    quote.volume != null && `Vol ${quote.volume}`,
  ].filter(Boolean).join(' · ')

  const points = data?.points ?? []

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ pointerEvents: 'none' }}
      slotProps={{
        paper: {
          onMouseLeave: onClose,
          sx: { pointerEvents: 'auto', p: 1.5, minWidth: 240 },
        },
      }}
      disableRestoreFocus
    >
      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
        {quote.name || quote.symbol}
      </Typography>
      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 1 }}>
        {ohlc}
      </Typography>

      <Box sx={{ height: 48, mb: 1 }}>
        {points.length > 1
          ? <SparkLineChart data={points} height={48} color="var(--color-accent)" />
          : <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
              No history available
            </Typography>}
      </Box>

      <ToggleButtonGroup
        size="small"
        exclusive
        value={range}
        onChange={(_, v) => { if (v) setRange(v as HistoryRange) }}
      >
        {RANGES.map((r) => (
          <ToggleButton key={r} value={r} sx={{ px: 1, py: 0.25, fontSize: '0.7rem' }}>
            {r}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Popover>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run TickerPopover`
Expected: PASS

- [ ] **Step 5: Wire it into `FinanceStrip`**

In `FinanceStrip.tsx`, remove the `Tooltip` wrapper and its `tooltipTitle` computation from `renderQuote`, and track hover state instead. Add near the other state:

```tsx
  const [hovered, setHovered] = useState<{ q: Quote; el: HTMLElement } | null>(null)
```

In `renderQuote`, drop the `<Tooltip>` wrapper (keep the inner `<Box>` exactly as-is) and add to that `Box`:

```tsx
          onMouseEnter={(e) => setHovered({ q, el: e.currentTarget })}
```

Render one popover for the whole strip, after the row `Box`:

```tsx
      {hovered && (
        <TickerPopover
          quote={hovered.q}
          anchorEl={hovered.el}
          open
          onClose={() => setHovered(null)}
        />
      )}
```

Remove the now-unused `Tooltip` import.

- [ ] **Step 6: Run the full suite + build**

Run: `cd frontend && npx vitest run && npm run build`
Expected: all pass; build succeeds. If an existing `FinanceStrip` test asserted on tooltip text, update it to assert the popover content instead.

- [ ] **Step 7: Verify in a real browser**

Run the app, open the briefing, hover a ticker: the popover shows OHLC and a 1d sparkline; clicking 1m refetches and redraws; the row pauses while hovered and resumes on leave.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/finance/
git commit -m "feat(finance): ticker hover popover with 1d/5d/1w/1m sparklines"
```

---

## Self-Review Notes

- **Spec coverage:** merged single row (T5), paged rotation on an interval (T5), manual advance (T5), pan on overflow (T4 oversized-item page + T5 translate), hover pause (T5), hover menu with OHLC (T6), 1d/5d/1w/1m sparklines (T6), lazy history endpoint (T1-T3), SSRF whitelist (T2). All of spec sections A and B are covered.
- **Deviation:** the spec describes panning within an oversized page. `packPages` gives such an item its own page and the row translates to it; true intra-page panning is deferred as YAGNI — with realistic chip widths, a single chip never exceeds the row.
- **Type consistency:** `HistoryRange`, `FinanceHistory`, `getFinanceHistory`, `packPages`, `TickerPopover`, `intervalMs` used identically across tasks.
