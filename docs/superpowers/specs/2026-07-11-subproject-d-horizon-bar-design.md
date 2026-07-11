# Sub-Project D — Horizon Bar Redesign Design

Part of the [dashboard overhaul program](2026-07-11-dashboard-overhaul-design.md). Redesigns the top `SignatureBar` horizon into a deadline-aware, proximity-colored timeline.

## Goal

Turn the decorative workday bar into a live, deadline-mapped timeline: today's deadlines plotted on a 7a–6p clock axis with urgency color/animation, future deadlines summarized in a right-edge overflow cluster, a live centered time readout, hover-detail, and click-through to `/deadlines`.

## Current state

`SignatureBar.tsx`: a static gradient bar spanning 7a–6p, a pulsing triangle at the current time, and six static hour labels (7a/9a/11a/1p/3p/5p). No data — purely decorative.

## Design

### Axis: hybrid (today clock + overflow)

- **On-axis (today):** deadlines whose `due_at` is today (local), OR any overdue deadline, are plotted as dots. Position = `clockPercent(due)` — `((minutesOfDay − 7·60) / (11·60)) · 100`, clamped 0–100. Overdue deadlines from a *past* day clamp to 0% (far left).
- **Later cluster:** deadlines due on a future day render as a single right-edge cluster: a small stacked-dots glyph + `+N` badge. Hover lists them (title + friendly due time). Click → `/deadlines`.

### Urgency (4-tier) — by `countdown_seconds`

| tier | condition | treatment |
|------|-----------|-----------|
| critical | `≤ 0` (overdue) or `≤ 900` (15m) | error color, **fast flash** (~0.8s) |
| urgent | `≤ 7200` (2h) | error color, pulse (~2s) |
| soon | `≤ 86400` (24h) | warning (amber) |
| normal | else | accent |

All animation gated behind `@media (prefers-reduced-motion: no-preference)`.

### Live time readout

Current time label centered directly above the now-marker triangle (moves with it), formatted per the user's 24h preference (`formatClock`). Static hour labels removed.

### Interaction

- Hover a deadline dot → MUI Tooltip: title + friendly due time + countdown.
- Click a dot or the later-cluster → `navigate('/deadlines')`.
- Dots are keyboard-focusable (tabIndex 0, Enter/Space activates) — a11y parity with the RightDrawer rows.

## Architecture

- **`frontend/src/lib/horizon.ts`** (pure, tested): `Urgency` type; `urgencyOf(countdownSeconds)`; `clockPercent(date)`; `sameLocalDay(a,b)`; `bucketDeadlines(deadlines, now)` → `{ onAxis: {deadline, percent, urgency}[], later: Deadline[] }`. No React, no clock unless passed `now`.
- **`frontend/src/lib/datetime.ts`**: add `formatClock(iso, prefs)` → `"1:45pm"` / `"13:45"` (reused by the readout; small, tested).
- **`frontend/src/components/SignatureBar.tsx`**: fetch `getDeadlines` (TanStack, 15s refetch), call `bucketDeadlines`, render line + dots + cluster + centered readout. `useFriendlyTime` for tooltips, `useTimePrefs` (via `formatClock`) for the readout. Remove `HOURS`.

## Testing

- **horizon.test.ts**: `urgencyOf` boundaries (0, 900, 7200, 86400); `clockPercent` (7a→0, 6p→100, noon→~45, before-7a clamps 0); `sameLocalDay`; `bucketDeadlines` splits today vs future vs overdue correctly, overdue-past clamps to 0%.
- **datetime.test.ts**: `formatClock` 12h/24h.
- **SignatureBar.test.tsx**: renders now-readout; a deadline due today yields a dot; a future deadline yields the later cluster badge; overdue deadline gets critical styling (assert via aria-label/title, not CSS).

## Global Constraints

- MUI v7: `sx` only.
- Reuse the existing `--color-accent` / `--color-accent-2` horizon gradient for the line.
- Animation only under `prefers-reduced-motion: no-preference`.
- Deadline dots must be keyboard-operable (tabIndex + Enter/Space), matching RightDrawer.
- Respect the 24h time preference in the readout (`formatClock` consumes `useTimePrefs`).
- `npx tsc -b` mandatory.
