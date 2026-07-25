# Daily Briefing Polish — Design

**Date:** 2026-07-25
**Status:** Approved
**Follows:** `2026-07-12-daily-briefing-super-modal-design.md`, `2026-07-12-weather-header-design.md`, `2026-07-13-finance-section-design.md`

## Summary

Polish pass over the daily-briefing super-modal: merge the two finance rows into
one paged rotating row with hover sparklines, fix the broken celestial arc and
extend the sky to the full modal background, make every surface legible and
theme-compliant, explain impact scores in plain english, and cap every grid at
its top 5 sorted by impact with hover-for-detail.

## Bug found during design

`WeatherBand.tsx:94-102` renders the celestial arc in an SVG with
`viewBox="0 0 100 40"` at `width:100% height:100%` and no `preserveAspectRatio`.
The default `xMidYMid meet` letterboxes: the viewBox is 2.5:1, the band is ~8:1,
so the arc scales to fit the 120px height and renders as a ~300px strip centered
in a ~1000px band. The sun traverses only the middle third and never reaches
either horizon. Combined with ~0.14% movement per minute, it reads as static.

Two related defects: sun-vs-moon is chosen from `weather.is_day` (a server-cached
snapshot, 30 min TTL) while the gradient uses `phase` from the live clock, so near
sunrise/sunset a moon can render over a daytime gradient; `arcFraction` takes its
`isDay` argument from that same stale field.

## Decisions (locked)

- **Finance:** one merged row (indices + watchlist), paged, auto-advancing on a
  config interval (default 15s), with manual advance and L→R panning for pages
  that overflow. Not a marquee — discrete pages.
- **Sparklines:** lazy, fetched only when a ticker's hover menu opens. New
  `/api/finance/history` endpoint. Modal-open cost unchanged.
- **Sky:** full-modal background, muted in dark mode. Arc fixed to span
  edge-to-edge first.
- **Impact rationale:** reuse the existing unpopulated `signals.reasoning`
  column. **No schema migration.** Non-signal items get a sentence generated from
  the scoring formula's own inputs.
- **Grid cap:** 5 for every grid, including Critical (down from 8). The
  requirement said "any given grid"; applied uniformly.
- **Charting:** `@mui/x-charts` `SparkLineChart`, already a dependency and
  already used in `widgets/KpiStrip.tsx:40`. No new dependency.

## A. Finance — paged rotating row

`frontend/src/components/finance/FinanceStrip.tsx` (currently 123 lines).

Merge `indices` and `watchlist` into a single ordered list — indices first, then
watchlist — under one label. Replace the two static rows with a paged viewport:

- **Paging:** measure the row's available width and each chip's width; pack chips
  into pages greedily. Recompute on resize (`ResizeObserver`).
- **Auto-advance:** every `briefing_ticker_interval_ms` (new config key, default
  15000), advance one page with a slide-down transition. Wrap at the end.
- **Manual advance:** a `[↓]` icon button in the row header, plus a hotkey while
  the modal has focus. Both reset the interval timer.
- **Overflow pan:** if a single page's content is still wider than the viewport
  (one chip wider than the row, or a minimum-one-chip page), pan L→R to the end
  of that page before advancing to the next.
- **Pause:** hovering anywhere in the row pauses auto-advance; leaving resumes.
- **Position:** dot indicators showing page N of M.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables the
  slide and pan; pages swap instantly.

Degradation is unchanged from SP3: an empty or errored payload shows the muted
"Markets unavailable" and no rotation.

## B. Ticker hover menu + sparklines

Replace the current OHLC `Tooltip` with a popover (`Popover`, opens on hover with
a short enter delay, closes on leave; it must be hoverable so the range toggles
are clickable).

Contents:
1. Symbol, name, price, % change — the chip's own data.
2. OHLC + volume — what today's tooltip shows.
3. `SparkLineChart` with range toggles: **1d · 5d · 1w · 1m**. Default 1d.
4. The existing click-through to Yahoo Finance stays.

### `GET /api/finance/history?symbol=X&range=Y`

- `range` ∈ `{1d, 5d, 1w, 1m}` — a closed whitelist, rejected otherwise. Maps to
  Yahoo chart params: `1d`→`range=1d&interval=5m`, `5d`→`range=5d&interval=15m`,
  `1w`→`range=7d&interval=30m`, `1m`→`range=1mo&interval=1d`.
- `symbol` must be a member of the currently-configured watchlist or the fixed
  index list. **This is the trust boundary** — the symbol is interpolated into an
  upstream URL, so an unvalidated value is an SSRF vector. Reject anything not on
  that list with HTTP 400; never pass user input through to the URL directly.
- Same host and parsing approach as `/api/finance` (`backend/lib/finance.py`).
- Returns `{ "symbol": str, "range": str, "points": number[], "stale": bool }` —
  a bare close-price series, which is all `SparkLineChart` consumes.
- Cache per `(symbol, range)`, TTL 300s, mirroring the existing finance cache.
- Failure → HTTP 200 with `{"points": [], "error": "unavailable"}`. The popover
  shows the OHLC block and omits the chart. Never breaks the modal.

New pure function in `backend/lib/finance.py`: `parse_history(payload) ->
list[float]`, extracting `indicators.quote[0].close`, dropping nulls. No I/O,
independently testable, never raises.

## C. Sky — arc fix, then full-bleed background

**Fix (must land before the visual change, or the bug is inherited):**
- `preserveAspectRatio="none"` on the arc SVG so the viewBox stretches to the
  full band width.
- Derive the celestial body from the live `phase` (`night` → moon, otherwise sun)
  rather than the cached `weather.is_day`.
- Pass that same derived day/night to `arcFraction` instead of `weather.is_day`.

**Then extend:** the sky gradient moves from the 120px band into the modal's
background layer — an absolutely-positioned element behind the Dialog content,
with the arc across the top region and the gradient fading toward the bottom so
the lower grids sit on near-neutral ground.

`skyGradients` gains a dark-mode treatment: the same four phase gradients
composited toward darkness (an overlay at theme-dependent alpha), so night in
dark mode is the same sky at lower luminance rather than a second palette to
maintain.

The band's own 120px height stays for the weather content; it just no longer owns
the gradient.

## D. Legibility, translucency, theme compliance

- **Weather text scrim:** a soft dark gradient behind the location + temperature
  block (bottom-left), replacing reliance on `text-shadow` against a bright
  daytime sky. Fixes white-on-daylight.
- **Translucent cards:** the `Section` `Paper` moves from `bgcolor:
  'action.hover'` to `background.paper` at ~0.72 alpha with a `backdrop-filter:
  blur(8px)`. The sky reads through without text losing contrast.
- **Theme compliance:** the card alpha and the sky's dark-mode muting are both
  theme-derived, not hardcoded. The remaining hardcoded values in the modal are
  the four phase gradients, which are intentional — a sky is not a theme color.
  Everything else uses palette tokens, as `FinanceStrip` and `RankedItem`
  already do.
- **Contrast floor:** the temperature, location, and every card's primary text
  must clear WCAG AA (4.5:1) against their backing in both modes and all four sky
  phases. Dusk-over-light and day-over-dark are the tight cases.

## E. Impact score explanation

`RankedItem.tsx:52-62` currently shows `Tooltip title={"Impact {score}/100"}`.
Replace with a popover in two parts:

**Part 1 — this item's rationale, in plain english.**

- **Signals:** `signals.reasoning`. The column exists (`schema.sql:47`, "AI
  rationale for surfacing") and **no skill currently writes it** — verified by
  `grep -rn reasoning skills/`. The signal-writing skills start populating it with
  one sentence justifying the score. Threaded through `add_signal` and surfaced
  by `briefing.py`.
- **Everything else** (deadlines, tasks, people, news, learning): `briefing.py`
  generates the sentence from the inputs `_score_of` already reads —
  *"Due in 4h; priority 1 → 92."*, *"Relevance 0.82 → 82."*, *"Importance 1 of 5
  → 92."* Returned as `score_reason` on each ranked row.

So every item explains itself, and only signals require skill changes.

**Part 2 — the band legend:** 80-100 Critical · 60-79 High · 40-59 Medium ·
0-39 Low, matching `scoreStyle`'s existing thresholds.

### Skill changes

The skills that create signals gain one instruction: when setting `impact`, also
set `reasoning` to a single plain-english sentence explaining the score. Applies
to the signal-writing skills only (`triage_email`, `triage_teams`,
`parse_deadlines`, `scout_actions`, `run_comms`, `run_teams` — final list
confirmed at implementation time by grepping for `add_signal` usage).

**Constraint:** per `2026-07-25-skill-lookback-rewrite.md`, the `schedule:`
frontmatter line in every SKILL.md is load-bearing for `skill_health` and must
not be touched by this work.

## F. Grids — cap, sort, hover detail

In `backend/lib/briefing.py`:
- `CRITICAL_CAP` 8 → 5, and apply the same cap to risks, opportunities, people,
  and each topic's news group. One shared constant, `GRID_CAP = 5`.
- Every grid sorts by score descending. Critical keeps its existing secondary
  sort on `countdown_seconds` so equal-score items surface soonest-first.

In the frontend, hovering a `RankedItem` opens a detail popover with what the row
truncates: full title, summary, `why`, meta, and timestamps. Shares the popover
primitive with E — one hover-detail component, two callers.

## Architecture

New and changed units, each independently testable:

| Unit | Kind | Responsibility |
|---|---|---|
| `backend/lib/finance.py::parse_history` | pure | Yahoo chart payload → `list[float]`. No I/O. |
| `GET /api/finance/history` | endpoint | Whitelist symbol + range, proxy, cache, graceful envelope. |
| `backend/lib/briefing.py::_score_reason` | pure | Scored row → plain-english sentence. |
| `FinanceStrip` | component | Merged paged rotating row. |
| `TickerPopover` | component | OHLC + range-toggled sparkline. |
| `ImpactPopover` | component | Rationale + band legend. |
| `DetailPopover` | component | Full item detail on grid hover. |
| `BriefingSections` | component | Extracted grid rendering (see below). |

`TodayBriefing.tsx` is 182 lines and this work would roughly double it. The
section/grid rendering extracts to `BriefingSections.tsx`, keeping both files
well under the 500-line project limit and giving the grids their own test surface.

## Testing

- **Pure functions** (`parse_history`, `_score_reason`, paging math): direct unit
  tests, including empty input, nulls, and single-item edge cases.
- **`/api/finance/history`:** rejects an off-whitelist symbol with 400 (the SSRF
  guard — this test is mandatory), rejects a bad range, returns points on
  success, returns the graceful envelope on upstream failure.
- **Rotation:** advances on interval with fake timers, manual advance resets the
  timer, hover pauses, wraps at the end.
- **Arc fix:** asserts `preserveAspectRatio="none"` is present, and that a
  `phase: night` render shows the moon even when `is_day` is stale-true — this is
  the regression test for the bug above.
- **Grids:** cap at 5, sorted descending by score.
- **Popovers:** open on hover, contain the expected rationale text.

## Implementation order

Three independent slices, safe to land in sequence, each shippable on its own:

1. **Sky + legibility (C, D)** — starts with the arc bug fix, which must land
   before the sky is extended or the defect is inherited by a larger surface.
2. **Finance (A, B)** — the paged row and the history endpoint. Touches only
   `FinanceStrip`, `finance.py`, and one new endpoint.
3. **Grids + impact (E, F)** — the shared popover primitive, the caps, the
   `score_reason` generation, and the skill `reasoning` instruction.

Slice 3 introduces the popover component that E and F share; if slices are
reordered, whichever lands first owns that component.

## Out of scope

- Historical data for anything but finance (no signal/news trend sparklines).
- Persisting price history locally — the Yahoo proxy plus cache is sufficient.
- Reworking the scoring formula itself. This explains the existing formula; it
  does not change it.
- Any change to `schedule:` frontmatter or skill lookback logic.
