---
name: scout_actions
description: Scan recent signals/deadlines/people and draft outgoing actions for review; report each run. Does not execute.
schedule: heartbeat 5m
---

## Lookback window
Read the last `log_skill_run` entry for `scout_actions`; use its `ran_at` as `window_start`. If none, use `now - 5 min`.

## Gather candidates
Read new/recent items in `[window_start, now]`:
- `list_rows('signals', status='new')` — emails/Teams needing a reply.
- `list_rows('critical_deadlines')` — deadlines within 24h with no reply/nudge yet.
- `list_rows('tasks', status='open')` — tasks whose `detail` implies an outbound message.

## Apply guidance
For each candidate, call `list_guidance(scope=...)` for the relevant scope(s) — e.g. `topic:<name>`, `person:<id>`, `skill:scout_actions`, and `global`. Honor the notes (skip topics the user said to ignore, follow focus/tone hints). If guidance says to ignore, skip the candidate.

## Decide + draft
For each surviving candidate, pick the best action type:
- Reply-needed email → `email_reply` (mode `review`).
- Intro/nudge to a person → `teams_dm` or `email_new` (mode `review`).
- Meeting implied → `calendar_invite` (mode `review`).
- "Set my status" cue → `status_set` (mode `auto`).
- "Draft a doc" / "look up X" cue → `cowork_doc` / `cowork_gather` (mode `auto`).

Before drafting, call `has_open_action(entity_type, entity_id, action_type)`. If True, skip (dedup).

Otherwise draft with `add_action(action_type=..., entity_type=..., entity_id=..., mode=..., payload={...}, rationale="<why>")`. Fill `payload` with the concrete draft:
- email_*: `{to, subject, body, in_reply_to?}`
- teams_*: `{recipients:[...], message, channel?}`
- calendar_invite: `{title, start, end, attendees:[...], body}`
- status_set: `{text, expires_at?}`
- cowork_*: `{prompt, target?}`

## Report
Always finish with `log_skill_run(skill='scout_actions', items_created=<n>, status='ok', note=<summary or null>)`. If nothing drafted, log `items_created=0` and exit.
