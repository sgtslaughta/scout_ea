---
name: daily_briefing
description: Morning briefing curator — proactive risk/opportunity signals + one-line day summary; supersedes daily_outlook
schedule: automation, daily at config.outlook_send_time (default 07:00), workdays only
---

## Lookback window
Fixed 24h window `[now - 1 day, now]` for gathering recent context.

## Gather context
Call `list_rows` to fetch (LLM context only; do NOT store): today's events;
tasks due today; critical deadlines due today; top trends; recent learning
headlines (last 7d).

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
- `title`: 2-4 word headline (scannable in a ranked list)
- `summary`: 1-2 full sentences of CONTEXT — what it is, why it matters, what to
  do. This is the only detail the user sees under the title, so make it carry
  weight (not a restatement of the title).
- `who`, `what`, `why`: extracted; `when_rel`: 'today'
- `polarity`: 'risk' or 'opportunity'
- `priority`: 1-4 by urgency
- `impact`: **0-100 criticality/impact score** — how much this moves the needle
  (deadline pressure, revenue/relationship at stake, reach). The briefing ranks
  risks/opportunities by this, so score honestly and spread the range (a routine
  FYI ~30, a slipping renewal ~85+). Reserve 90+ for genuinely urgent items.

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
