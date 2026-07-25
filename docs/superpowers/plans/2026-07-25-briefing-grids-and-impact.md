# Briefing Grids & Impact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap every briefing grid at its top 5 sorted by impact, explain each item's score in plain english on hover, and show full item detail on hover.

**Architecture:** `briefing.py` gains one shared `GRID_CAP` and a `_score_reason` helper that turns the scoring formula's own inputs into a sentence. Signals instead carry a skill-authored sentence in the existing, currently-unused `signals.reasoning` column — no migration. One `HoverCard` popover primitive serves both the impact explanation and the item-detail popover.

**Tech Stack:** Python 3.14 stdlib, FastAPI, pytest; React 19, TypeScript, MUI v7, Vitest.

## Global Constraints

- Slice 3 of 3 from `docs/superpowers/specs/2026-07-25-briefing-polish-design.md`.
- Verify the frontend with `npm run build` (runs `tsc -b`, strict). Do NOT use `tsc --noEmit`.
- Frontend tests: `cd frontend && npx vitest run`. Backend tests: `cd backend && ../.venv/bin/python -m pytest -q`.
- **No schema migration.** `signals.reasoning` already exists (`backend/ea/schema.sql:47`) and no skill writes it — verified with `grep -rn reasoning skills/`.
- Pure helpers in `backend/lib/` do no I/O and never raise.
- This slice explains the existing scoring formula. It must NOT change how any score is computed.
- Do not touch `schedule:` frontmatter in any `SKILL.md` — it is load-bearing for `skill_health` (see `2026-07-25-skill-lookback-rewrite.md`).

---

### Task 1: Cap every grid at 5 and sort by score

Today `CRITICAL_CAP = 8` applies only to Critical (`backend/lib/briefing.py:5,57`); risks, opportunities, people, and per-topic news are unbounded.

**Files:**
- Modify: `backend/lib/briefing.py:5, 57, 74-76, 86-93, 98-101`
- Test: `backend/tests/test_lib_briefing.py` (add to the existing file)

**Interfaces:**
- Consumes: the existing `_score_of`, `_rank`.
- Produces: `GRID_CAP = 5`, applied to critical, risks, opportunities, people, and each topic's `items`. `CRITICAL_CAP` is removed — grep for other references before deleting it.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_lib_briefing.py`:

```python
from lib import briefing as _briefing


def _sig(i, impact, polarity=None, type_="proactive"):
    return {"id": i, "title": f"s{i}", "type": type_, "status": "new",
            "impact": impact, "polarity": polarity, "priority": 3}


def test_every_grid_caps_at_five():
    signals = [_sig(i, 90 - i, "risk") for i in range(10)]
    signals += [_sig(100 + i, 90 - i, "opportunity") for i in range(10)]
    people = [{"id": i, "name": f"p{i}", "importance": 1} for i in range(10)]
    out = _briefing.assemble(
        "2026-07-25T09:00:00Z", deadlines=[], tasks=[], signals=signals,
        news=[], learning=[], topics=[], people=people, people_signals={}, summary=None,
    )
    assert len(out["risks"]) == 5
    assert len(out["opportunities"]) == 5
    assert len(out["people"]) == 5


def test_critical_caps_at_five():
    tasks = [{"id": i, "title": f"t{i}", "due_at": "2026-07-25T12:00:00Z", "priority": 1}
             for i in range(10)]
    out = _briefing.assemble(
        "2026-07-25T09:00:00Z", deadlines=[], tasks=tasks, signals=[],
        news=[], learning=[], topics=[], people=[], people_signals={}, summary=None,
    )
    assert len(out["critical"]) == 5


def test_grids_are_sorted_by_score_descending():
    signals = [_sig(1, 30, "risk"), _sig(2, 95, "risk"), _sig(3, 60, "risk")]
    out = _briefing.assemble(
        "2026-07-25T09:00:00Z", deadlines=[], tasks=[], signals=signals,
        news=[], learning=[], topics=[], people=[], people_signals={}, summary=None,
    )
    assert [r["score"] for r in out["risks"]] == [95, 60, 30]


def test_news_items_cap_at_five_per_topic():
    topics = [{"id": 1, "name": "AI", "priority": 1}]
    news = [{"id": i, "title": f"n{i}", "topic_id": 1, "status": "new",
             "relevance": (100 - i) / 100} for i in range(10)]
    out = _briefing.assemble(
        "2026-07-25T09:00:00Z", deadlines=[], tasks=[], signals=[],
        news=news, learning=[], topics=topics, people=[], people_signals={}, summary=None,
    )
    assert len(out["news_by_topic"][0]["items"]) == 5
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ../.venv/bin/python -m pytest tests/test_lib_briefing.py -q`
Expected: FAIL — lists come back longer than 5.

- [ ] **Step 3: Apply the cap**

In `backend/lib/briefing.py`:

Replace line 5:

```python
GRID_CAP = 5           # every briefing grid shows its top 5
PEOPLE_SIGNAL_CAP = 3
```

In `_critical`, change the final line from `return _rank(rows[:CRITICAL_CAP])` to:

```python
    return _rank(rows[:GRID_CAP])
```

In `_news_by_topic`, cap each topic's items — change the `groups.append(...)` call to slice:

```python
        groups.append({"topic_id": tid, "topic_name": tmap[tid]["name"],
                       "topic_priority": tmap[tid].get("priority", 3),
                       "items": _rank(items[:GRID_CAP])})
```

In `assemble`, cap risks, opportunities, and people:

```python
    return {
        "date": today,
        "summary": summary,
        "critical": _critical(now, today, deadlines, tasks, signals),
        "risks": _rank(risks[:GRID_CAP]),
        "opportunities": _rank(opps[:GRID_CAP]),
        "news_by_topic": _news_by_topic(topics, news, learning),
        "people": _rank(people_out[:GRID_CAP]),
        "weather": None,   # SP2
        "finance": None,   # SP3
    }
```

- [ ] **Step 4: Check for stale references to the old constant**

Run: `cd backend && grep -rn "CRITICAL_CAP" . --include=*.py`
Expected: no hits. If any remain, update them to `GRID_CAP`.

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && ../.venv/bin/python -m pytest -q`
Expected: all pass. An existing test may assert the old cap of 8 — update it to 5, since the cap change is the intended behavior.

- [ ] **Step 6: Commit**

```bash
git add backend/lib/briefing.py backend/tests/test_lib_briefing.py
git commit -m "feat(briefing): cap every grid at top 5, sorted by impact"
```

---

### Task 2: `_score_reason` plain-english explanation

**Files:**
- Modify: `backend/lib/briefing.py`
- Test: `backend/tests/test_lib_briefing.py`

**Interfaces:**
- Consumes: the existing `_PRIORITY_SCORE` map and `_score_of`.
- Produces: `_score_reason(row) -> str`, and a `score_reason` key attached to every ranked row by `_rank`.

The branches must mirror `_score_of` exactly, in the same order, so the sentence always describes the branch that actually produced the score. Signals prefer their skill-authored `reasoning`; everything else is generated from the inputs the formula read.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_lib_briefing.py`:

```python
def test_score_reason_prefers_skill_authored_reasoning():
    row = {"impact": 91, "reasoning": "CEO asked for a decision before Friday's board call."}
    assert _briefing._score_reason(row) == "CEO asked for a decision before Friday's board call."


def test_score_reason_explains_explicit_impact():
    assert "91" in _briefing._score_reason({"impact": 91})


def test_score_reason_explains_relevance():
    out = _briefing._score_reason({"relevance": 0.82})
    assert "0.82" in out and "82" in out


def test_score_reason_explains_importance():
    out = _briefing._score_reason({"importance": 1})
    assert "1" in out and "92" in out


def test_score_reason_explains_priority():
    out = _briefing._score_reason({"priority": 2})
    assert "2" in out and "76" in out


def test_rank_attaches_score_reason():
    rows = [{"priority": 1, "title": "x"}]
    ranked = _briefing._rank(rows)
    assert ranked[0]["score_reason"]
    assert ranked[0]["score"] == 92
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ../.venv/bin/python -m pytest tests/test_lib_briefing.py -q`
Expected: FAIL — `module 'lib.briefing' has no attribute '_score_reason'`

- [ ] **Step 3: Implement it**

In `backend/lib/briefing.py`, add after `_score_of`:

```python
def _score_reason(row) -> str:
    """Plain-english explanation of this row's impact score.

    Branches mirror `_score_of` exactly and in the same order, so the sentence
    always describes the branch that actually produced the score. Signals may
    carry a skill-authored sentence in `reasoning`; everything else is derived
    from the inputs the formula read.
    """
    authored = (row.get("reasoning") or "").strip()
    if authored:
        return authored
    if row.get("impact") is not None:
        return f"Impact {_score_of(row)} set directly by the source skill."
    rel = row.get("relevance")
    if rel is not None:
        return f"Topic relevance {rel} → {_score_of(row)}."
    if row.get("importance") is not None:
        return f"Person importance {int(row['importance'])} of 5 → {_score_of(row)}."
    return f"Priority {int(row.get('priority', 3))} → {_score_of(row)}."
```

Change `_rank` to attach it:

```python
def _rank(rows: list) -> list:
    """Attach 1-based rank + score + explanation to already-ordered rows (in place)."""
    for i, r in enumerate(rows, 1):
        r["rank"] = i
        r["score"] = _score_of(r)
        r["score_reason"] = _score_reason(r)
    return rows
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && ../.venv/bin/python -m pytest tests/test_lib_briefing.py -q`
Expected: PASS

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && ../.venv/bin/python -m pytest -q`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/lib/briefing.py backend/tests/test_lib_briefing.py
git commit -m "feat(briefing): plain-english score_reason on every ranked row"
```

---

### Task 3: Add `score_reason` to the frontend types

**Files:**
- Modify: `frontend/src/api.ts` — the briefing interfaces (`CriticalItem`, the signal/news/person shapes used by `BriefingResponse`)
- Test: covered by Task 4's component tests; no standalone test (a type-only change has no runtime behavior to assert)

**Interfaces:**
- Produces: `score_reason?: string` on every ranked briefing item type.

- [ ] **Step 1: Add the field**

In `frontend/src/api.ts`, add `score_reason?: string` next to the existing `score?: number` on each briefing item interface — `CriticalItem` and the types backing `risks`, `opportunities`, `news_by_topic[].items`, and `people`.

- [ ] **Step 2: Verify the build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api.ts
git commit -m "feat(api): score_reason on briefing item types"
```

---

### Task 4: `HoverCard` popover primitive

One primitive, two callers (impact explanation in Task 5, item detail in Task 6).

**Files:**
- Create: `frontend/src/components/briefing/HoverCard.tsx`
- Create: `frontend/src/components/briefing/HoverCard.test.tsx`

**Interfaces:**
- Consumes: MUI `Popover`.
- Produces: `<HoverCard anchorEl={HTMLElement | null} open={boolean} onClose={() => void} children={ReactNode} />` — a non-focus-stealing hover popover whose paper is itself hoverable.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/briefing/HoverCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { HoverCard } from './HoverCard'

it('renders children when open', () => {
  const anchor = document.createElement('div')
  document.body.appendChild(anchor)
  render(<HoverCard anchorEl={anchor} open onClose={() => {}}>hello</HoverCard>)
  expect(screen.getByText('hello')).toBeInTheDocument()
})

it('renders nothing when closed', () => {
  const anchor = document.createElement('div')
  document.body.appendChild(anchor)
  render(<HoverCard anchorEl={anchor} open={false} onClose={() => {}}>hidden</HoverCard>)
  expect(screen.queryByText('hidden')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run HoverCard`
Expected: FAIL — cannot resolve `./HoverCard`.

- [ ] **Step 3: Implement it**

Create `frontend/src/components/briefing/HoverCard.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Popover } from '@mui/material'

export interface HoverCardProps {
  anchorEl: HTMLElement | null
  open: boolean
  onClose: () => void
  children: ReactNode
}

/** Hover popover whose paper is itself hoverable, and which never steals focus. */
export function HoverCard({ anchorEl, open, onClose, children }: HoverCardProps) {
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      sx={{ pointerEvents: 'none' }}
      slotProps={{
        paper: {
          onMouseLeave: onClose,
          sx: { pointerEvents: 'auto', p: 1.5, maxWidth: 380 },
        },
      }}
      disableRestoreFocus
    >
      {children}
    </Popover>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run HoverCard`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/briefing/HoverCard.tsx frontend/src/components/briefing/HoverCard.test.tsx
git commit -m "feat(briefing): HoverCard hover-popover primitive"
```

---

### Task 5: Impact explanation on the score badge

Replaces the `Tooltip title={"Impact {score}/100"}` at `frontend/src/components/briefing/RankedItem.tsx:53`.

**Files:**
- Modify: `frontend/src/components/briefing/RankedItem.tsx`
- Create: `frontend/src/components/briefing/RankedItem.test.tsx` (if absent; otherwise add to it)

**Interfaces:**
- Consumes: `HoverCard` (Task 4).
- Produces: `RankedItemProps` gains `scoreReason?: string`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RankedItem } from './RankedItem'

it('explains the impact score on hover', async () => {
  render(
    <RankedItem rank={1} title="Board deck due" score={92}
      scoreReason="Priority 1 → 92." />,
  )
  await userEvent.hover(screen.getByText('92'))
  expect(await screen.findByText(/Priority 1 → 92\./)).toBeInTheDocument()
  // band legend accompanies the per-item reason
  expect(screen.getByText(/Critical/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run RankedItem`
Expected: FAIL — the reason text is not rendered (the current tooltip shows only "Impact 92/100").

- [ ] **Step 3: Implement it**

In `RankedItem.tsx`, add to the props interface:

```tsx
  scoreReason?: string
```

Add imports and state:

```tsx
import { useState } from 'react'
import { HoverCard } from './HoverCard'
```

```tsx
  const [scoreAnchor, setScoreAnchor] = useState<HTMLElement | null>(null)
```

Replace the `<Tooltip>...</Tooltip>` wrapper around the badge with the badge plus a `HoverCard`:

```tsx
          {badge && (
            <>
              <Box
                onMouseEnter={(e) => setScoreAnchor(e.currentTarget)}
                sx={{ px: 0.75, py: '1px', borderRadius: 0.75, fontSize: '0.7rem', fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums', color: badge.fg, bgcolor: badge.bg,
                      lineHeight: 1.7, minWidth: 26, textAlign: 'center', flexShrink: 0,
                      cursor: 'help' }}
              >
                {score}
              </Box>
              <HoverCard
                anchorEl={scoreAnchor}
                open={!!scoreAnchor}
                onClose={() => setScoreAnchor(null)}
              >
                <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', mb: 0.5 }}>
                  Impact {score} / 100
                </Typography>
                {scoreReason && (
                  <Typography sx={{ fontSize: '0.8rem', mb: 1 }}>{scoreReason}</Typography>
                )}
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                  80–100 Critical · 60–79 High · 40–59 Medium · 0–39 Low
                </Typography>
              </HoverCard>
            </>
          )}
```

Remove the now-unused `Tooltip` import.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run RankedItem`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/briefing/RankedItem.tsx frontend/src/components/briefing/RankedItem.test.tsx
git commit -m "feat(briefing): impact score explanation with band legend on hover"
```

---

### Task 6: Full item detail on row hover

**Files:**
- Modify: `frontend/src/components/briefing/RankedItem.tsx`
- Modify: `frontend/src/components/briefing/RankedItem.test.tsx`

**Interfaces:**
- Consumes: `HoverCard` (Task 4).
- Produces: `RankedItemProps` gains `detail?: string` — the untruncated text the row clips. The row shows `subtitle` clamped to 2 lines; the popover shows everything.

- [ ] **Step 1: Write the failing test**

```tsx
it('shows full detail when the row is hovered', async () => {
  render(
    <RankedItem rank={1} title="Board deck due" score={92}
      subtitle="short" detail="the full untruncated explanation" meta="due in 4h" />,
  )
  await userEvent.hover(screen.getByText('Board deck due'))
  expect(await screen.findByText(/the full untruncated explanation/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run RankedItem`
Expected: FAIL — detail text is not rendered.

- [ ] **Step 3: Implement it**

Add `detail?: string` to `RankedItemProps`. Add state:

```tsx
  const [rowAnchor, setRowAnchor] = useState<HTMLElement | null>(null)
```

On the outer row `Box`, add:

```tsx
      onMouseEnter={(e) => setRowAnchor(e.currentTarget)}
      onMouseLeave={() => setRowAnchor(null)}
```

After the row's closing content, render the detail card:

```tsx
      <HoverCard
        anchorEl={rowAnchor}
        open={!!rowAnchor && !!(detail || subtitle || meta)}
        onClose={() => setRowAnchor(null)}
      >
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 0.5 }}>{title}</Typography>
        {(detail || subtitle) && (
          <Typography sx={{ fontSize: '0.8rem', mb: 0.5 }}>{detail || subtitle}</Typography>
        )}
        {meta && (
          <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>{meta}</Typography>
        )}
      </HoverCard>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run RankedItem`
Expected: PASS — both the Task 5 and Task 6 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/briefing/RankedItem.tsx frontend/src/components/briefing/RankedItem.test.tsx
git commit -m "feat(briefing): full item detail on row hover"
```

---

### Task 7: Pass the new fields from `TodayBriefing` and extract `BriefingSections`

`TodayBriefing.tsx` is 182 lines; this slice pushes it past a comfortable size, so the grid rendering moves to its own file.

**Files:**
- Create: `frontend/src/components/briefing/BriefingSections.tsx`
- Modify: `frontend/src/components/TodayBriefing.tsx:124-176` (the 4-card grid moves out)
- Test: `frontend/src/components/TodayBriefing.test.tsx`

**Interfaces:**
- Consumes: `RankedItem` with `scoreReason` and `detail` (Tasks 5-6), `BriefingResponse` from `@/api`.
- Produces: `<BriefingSections briefing={BriefingResponse | undefined} onNavigate={(view: string) => void} />`.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/components/TodayBriefing.test.tsx`:

```tsx
it('passes the score reason through to ranked items', async () => {
  // Existing mock setup in this file returns a briefing fixture; extend the
  // fixture's first critical item with score_reason: 'Priority 1 → 92.'
  renderBriefing({ open: true })
  const badge = await screen.findByText('92')
  await userEvent.hover(badge)
  expect(await screen.findByText(/Priority 1 → 92\./)).toBeInTheDocument()
})
```

Update the briefing fixture in that file so its first critical item includes `score: 92` and `score_reason: 'Priority 1 → 92.'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run TodayBriefing`
Expected: FAIL — the reason text is not rendered, because `TodayBriefing` does not pass `scoreReason`.

- [ ] **Step 3: Extract the sections**

Create `frontend/src/components/briefing/BriefingSections.tsx`. Move the `SubLabel` and `Section` components and the entire 4-card grid `<Box>` (currently `TodayBriefing.tsx:125-176`) into it verbatim, then add `scoreReason={item.score_reason}` and a `detail` prop to every `RankedItem` call. For example, the Critical section becomes:

```tsx
              {briefing?.critical?.map((item) => (
                <RankedItem key={`c-${item.id}`} rank={item.rank ?? 0} title={item.title}
                  score={item.score} scoreReason={item.score_reason}
                  subtitle={item.summary || item.detail} detail={item.detail || item.summary}
                  meta={item.kind === 'deadline' ? fmtCountdown(item.countdown_seconds) : undefined}
                  onClick={() => item.nav && onNavigate(item.nav.view)} />
              ))}
```

Apply the same two additions to the risks, opportunities, news, and people mappings — `scoreReason={x.score_reason}` on each, and `detail` set to the richest field that type carries (`summary`, `synopsis`, or `notes`).

`fmtCountdown` moves with the grid since only the sections use it. The component signature:

```tsx
export interface BriefingSectionsProps {
  briefing: BriefingResponse | undefined
  onNavigate: (view: string) => void
}

export function BriefingSections({ briefing, onNavigate }: BriefingSectionsProps) {
```

- [ ] **Step 4: Use it from `TodayBriefing`**

In `TodayBriefing.tsx`, delete `SubLabel`, `Section`, `fmtCountdown`, and the grid `<Box>`, and replace the grid with:

```tsx
            <BriefingSections briefing={briefing} onNavigate={go} />
```

Add `import { BriefingSections } from './briefing/BriefingSections'` and remove imports that are now unused (`Paper`, `RankedItem`, and `Stack` if the skeleton no longer needs it — let the build tell you).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run TodayBriefing`
Expected: PASS

- [ ] **Step 6: Confirm both files are a reasonable size**

Run: `wc -l frontend/src/components/TodayBriefing.tsx frontend/src/components/briefing/BriefingSections.tsx`
Expected: both well under 500 lines.

- [ ] **Step 7: Run the full suite + build**

Run: `cd frontend && npx vitest run && npm run build`
Expected: all pass; build succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/TodayBriefing.tsx frontend/src/components/briefing/BriefingSections.tsx frontend/src/components/TodayBriefing.test.tsx
git commit -m "refactor(briefing): extract BriefingSections, pass score reasons through"
```

---

### Task 8: Teach the signal-writing skills to author `reasoning`

`signals.reasoning` exists (`backend/ea/schema.sql:47`, "AI rationale for surfacing") and nothing writes it. Populating it is what makes `_score_reason` return skill-authored prose instead of a generated sentence.

**Files:**
- Modify: the `SKILL.md` of every skill that calls `add_signal`
- Test: shell verification (no unit test — these are prose instructions)

**Interfaces:**
- Consumes: the `add_signal` MCP tool (`backend/mcp_server/tools.py:24`), which passes `**fields` straight to `db.upsert_signal`.
- Produces: signals carrying a one-sentence `reasoning`, surfaced by `_score_reason` (Task 2).

- [ ] **Step 1: Find the skills that create signals**

Run: `cd /home/user/code/Scout_EA && grep -rln "add_signal" skills/`
Expected: a list of `SKILL.md` files. That list — not a guess — is the set to edit.

- [ ] **Step 2: Confirm `reasoning` still reaches the database**

Run: `cd backend && grep -n "reasoning" ea/db.py`
Expected: `reasoning` appears in `upsert_signal`'s column list (verified present at `db.py:122`) and in the migration that back-fills the column on pre-existing DBs (`db.py:100-103`). This step is a guard, not a change — if it ever stops matching, the skills would write a field that is silently dropped.

- [ ] **Step 3: Add the instruction to each skill**

In each file from Step 1, in the section describing the `add_signal` call, add:

```
When you set `impact`, also set `reasoning`: one plain-english sentence saying why
this item earned that score, in your own words. It is shown to the user verbatim
when they hover the score badge in the daily briefing. Write "CEO asked for a
decision before Friday's board call", not "high priority email".
```

Do not modify the `schedule:` frontmatter line in any of these files.

- [ ] **Step 4: Verify the edits**

Run:
```bash
cd /home/user/code/Scout_EA
echo "skills with add_signal but no reasoning instruction:"
for f in $(grep -rln "add_signal" skills/); do grep -qL "reasoning" "$f" && echo "$f"; done
echo "schedule lines intact:"; grep -c "^schedule:" skills/*/SKILL.md | grep ":0" || echo "all present"
```
Expected: no files listed as missing the instruction; every skill still has its `schedule:` line.

- [ ] **Step 5: Run the backend suite**

Run: `cd backend && ../.venv/bin/python -m pytest -q`
Expected: all pass — skill body text does not affect the parser, and `test_skills_structure.py` still finds every `schedule:` line.

- [ ] **Step 6: Commit**

```bash
git add skills/
git commit -m "feat(skills): author a plain-english reasoning sentence per signal"
```

---

## Self-Review Notes

- **Spec coverage:** top-5 cap on every grid (T1), sorted by impact (T1), plain-english impact explanation (T2, T5), band legend (T5), hover for full detail (T6), skills annotate reasoning (T8), no schema migration (T2 reuses `signals.reasoning`), file-size split (T7). All of spec sections E and F are covered.
- **Risk flagged in T8 Step 2:** if `db.upsert_signal` does not already accept a `reasoning` column, the skills would write a silently-dropped field. The step checks for this before the prose edits rather than after.
- **Type consistency:** `GRID_CAP`, `_score_reason`, `score_reason` (backend/JSON) vs `scoreReason` (React prop) used consistently; the mapping between the two happens only in `BriefingSections` (T7).
