# Finance Section — SP3 Design

**Date:** 2026-07-13
**Status:** Approved
**Program:** Skills-based Daily Briefing (SP3 of 3 — final)

## Summary

Fill the daily-briefing super-modal's bottom finance placeholder with a live
finance strip: a user-defined watchlist row + a fixed market-indices row, each
showing symbol, price, and today's % move (▲/▼ colored). Data comes from Stooq
(keyless CSV light-quote), fetched + cached by the backend in a single request.
Hovering a ticker shows OHLC + volume; clicking opens its Stooq page. Mirrors the
SP2 weather architecture (backend proxy + cache + Settings field). Completes the
3-part Daily Briefing program.

## Decisions (locked)

- **Content:** watchlist (user-defined, config + Settings) + fixed market indices
  (S&P `^spx`, Dow `^dji`, Nasdaq `^ndq`).
- **Source:** Stooq light-quote CSV, keyless, backend-proxied + cached, ONE
  request for all symbols.
- **Move metric:** today's % = `(close - open) / open * 100` (intraday move from
  the single light-quote row — avoids per-symbol history calls). Guarded for
  `open <= 0` or non-numeric (`N/D`) → `change_pct = None`.
- **Interactivity:** hover → OHLC + volume Tooltip; click → open the ticker's
  Stooq page in a new tab (`safeHttpUrl` guard, `noopener`).
- **Degradation:** finance is non-blocking. Upstream failure or empty config
  must never break the modal; the strip shows a muted "Markets unavailable".
- **No sparklines** in SP3 (history is a heavier, later concern). YAGNI.

## Architecture

Mirrors SP2. Units, each independently testable:

1. **`backend/lib/finance.py`** — pure: `to_stooq_symbol(ticker)` and
   `parse_quotes(csv_text) -> list[dict]`. No I/O.
2. **`/api/finance` endpoint** (`backend/web/app.py`) — reads watchlist config +
   fixed indices, one Stooq request, TTL cache, calls `parse_quotes`, graceful
   error envelope.
3. **`FinanceStrip`** (frontend) — presentational, driven by the payload.
4. **Settings field** — edits the watchlist config key.

Data flow:

```
modal opens
  → getFinance()  ──▶ GET /api/finance
        → cache hit within TTL? return cached
        → miss: read finance_watchlist config + fixed indices
              → urllib GET Stooq light-quote (ALL symbols, one request)
              → finance.parse_quotes() → split into watchlist / indices → cache → return
  → <FinanceStrip finance={...} />
        watchlist row + indices row of ticker chips (price, % move, hover OHLC, click→Stooq)
```

## A. Backend

### `backend/lib/finance.py`

```
def to_stooq_symbol(ticker: str) -> str: ...   # 'AAPL' -> 'aapl.us'; '^spx' -> '^spx'
def parse_quotes(csv_text: str) -> list[dict]: ...
```

**`to_stooq_symbol`:** lowercases; if the ticker starts with `^` (index) or
already contains `.` (already-qualified, e.g. `aapl.us`), return as-is
(lowercased); otherwise append `.us` (US equities). Empty/whitespace → `""`.

**`parse_quotes(csv_text)`:** Stooq light-quote CSV has a header row
`Symbol,Date,Time,Open,High,Low,Close,Volume` then one row per symbol. For each
data row return:

```
{
  "symbol": <str, upper-cased, .us stripped for display>,
  "price": <float Close or None>,
  "open": <float or None>, "high": <float or None>, "low": <float or None>,
  "volume": <int or None>,
  "change_pct": <round((close-open)/open*100, 2) if open>0 else None>,
  "date": <str>, "time": <str>,
}
```

Defensive: non-numeric fields (Stooq writes `N/D` for unknown) → `None`; a row
with too few columns is skipped; empty input → `[]`. Never raises.

### `/api/finance` endpoint

`GET /api/finance`:

1. Read `finance_watchlist` config (comma-separated friendly tickers; blank →
   empty watchlist). Fixed indices: `["^spx", "^dji", "^ndq"]`.
2. Cache key = the resolved symbol list (stable order). Module-level cache
   `_FINANCE_CACHE = {}` with TTL 300s (5 min).
   `# ponytail: process-local cache; revisit if multi-worker`
3. On miss: build `https://stooq.com/q/l/?s=<comma-joined to_stooq_symbol()>&f=sd2t2ohlcv&h&e=csv`,
   `urllib.request` GET, 5s timeout. Fixed host — no SSRF surface.
4. `parse_quotes(csv)`, then split rows back into `watchlist` vs `indices` by
   symbol membership. Return `{ "watchlist": [...], "indices": [...],
   "stale": false }`. Cache the parsed result.
5. Upstream/parse failure → HTTP **200** with
   `{ "watchlist": [], "indices": [], "error": "unavailable" }` (or last cached
   payload with `"stale": true` if present). Never 5xx.

### Config

Add `finance_watchlist` to `WRITABLE_CONFIG`. Seed default in `seed.sql`:
`('finance_watchlist', 'AAPL,MSFT,GOOGL,NVDA')`.

## B. Frontend data layer

`frontend/src/api.ts`:

```
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

## C. `FinanceStrip` component

`frontend/src/components/finance/FinanceStrip.tsx`. Replaces the placeholder Box.
Props: `{ finance: FinanceResponse }`.

- Two labelled rows: "WATCHLIST" and "MARKETS". Each maps its `Quote[]` to
  ticker chips (flex-wrap row).
- **Chip:** `symbol` + `price` (monospace numeric) + `change_pct` with a ▲/▼
  glyph, colored: `>0` green (`success.main`), `<0` red (`error.main`), `0`/null
  muted (`text.secondary`). Wrapped in a MUI `Tooltip` showing `O/H/L` + volume.
- **Click:** `const url = safeHttpUrl(`https://stooq.com/q/?s=${to_stooq}`)` — if
  non-null, `window.open(url, '_blank', 'noopener')`. Chip gets
  `role="button"`, `tabIndex={0}`, `cursor: 'pointer'`, Enter-key handler. (The
  frontend builds the Stooq quote URL from the display symbol; reuse the same
  suffix rule inline or accept the symbol as-is.)
- `finance.error` or both rows empty → muted "Markets unavailable" band.
- Uses existing theme tokens; no animation.

## D. Modal integration + Settings

- `TodayBriefing.tsx`: replace the finance placeholder Box (lines ~243-248) with
  `{finance ? <FinanceStrip finance={finance} /> : <Box sx={{ minHeight: 60 }} />}`;
  fetch via `useQuery({ queryKey: ['finance'], queryFn: getFinance, enabled: open })`.
- `Settings.tsx`: add a "Watchlist" field (comma-separated tickers) bound to
  `finance_watchlist` via the existing `cfg`/`saveCfg` pattern (same shape as the
  SP2 weather-location field).

## E. Testing

- **`lib/finance.py`:** `to_stooq_symbol` (plain equity → `.us`; `^` index
  passthrough; already-qualified passthrough; empty); `parse_quotes` (change_pct
  math, `N/D`-safe → None, multi-row, short-row skip, empty → []).
- **`/api/finance`:** cache miss fetches (urllib mocked) → watchlist/indices
  split; cache hit skips fetch; upstream error → 200 error envelope (never 5xx);
  empty watchlist config → indices-only.
- **Frontend:** `FinanceStrip` renders chips with up/down color; tooltip content;
  click opens Stooq URL (mock `window.open`); `error` payload → unavailable
  state. Settings watchlist field writes config.

## Out of scope (SP3)

- Sparklines / historical charts (heavier; a later concern).
- Real-time streaming / websockets (poll on modal open + 5-min cache is enough).
- Currency/crypto/options beyond what Stooq light-quote returns for the symbols.
- Per-ticker internal detail view (click goes to external Stooq).
