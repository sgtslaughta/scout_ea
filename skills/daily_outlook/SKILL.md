---
name: daily_outlook
description: Daily morning snapshot of today's events, deadlines, trends; generate proactive suggestions
schedule: automation, daily at config.outlook_send_time (default 07:00), workdays only
---

## Lookback window
Use a fixed 24-hour window: `[now - 1 day, now]` for gathering recent context. For proactive suggestions, pull signals from the last ~24h.

## Gather today's data
Assemble:
1. **Today's events**: `events WHERE status='created' OR status='approved' AND chosen_time within today's date` (per `config.tz`)
2. **Items due today**: `tasks WHERE due_at within today AND status != 'done'`
3. **Critical deadlines**: `critical_deadlines WHERE due_at within today AND visible=1 AND status='active'`
4. **Top trends**: `trends WHERE window_start >= now - config.trend_window_days ORDER BY score DESC LIMIT 5`
5. **Recent learning headlines**: `learning WHERE created_at >= now - 7 days AND status='suggested' LIMIT 3 per kind`

Do **not** store this snapshot; the `/outlook` page will render it live from source tables.

## Generate proactive suggestions
Over the last ~24h of `signals` (`type='email' OR type='teams'`) and manual `learning` items:
1. **LLM pass**: feed the signals/context to an LLM (Claude or Scout's embedded model) with the prompt:
   ```
   "Analyze these recent emails/chat messages and data. Generate 2-5 brief proactive suggestions 
    for interpersonal actions or opportunities:
    - Interpersonal cues (birthdays, anniversaries, personal milestones from recent notes)
    - Opportunity cues (mentioned meetings, RVPs, key discussions that warrant follow-up)
    - Resource cues (mentioned skills/gaps that map to training or hiring)
    Format each as a single sentence action (who, what, why)."
   ```
2. For each suggestion, create a synthesized `external_ref` (e.g., hash of the suggestion text + date).
3. Extract `who`, `what`, `when_rel` (always "today" for daily outlook), `why`.
4. Set `priority=3` (normal) or `priority=4` (low) depending on confidence.

## Write proactive signals
For each LLM-generated suggestion, call the `add_signal` tool to insert into the `signals` table:
- `type`: 'proactive'
- `source`: 'outlook'
- `external_ref`: synthesized hash of suggestion text + date (for dedup)
- `title`: 2–3 word summary
- `summary`: full suggestion text
- `who`: person involved if identifiable
- `what`, `why`: extracted from suggestion
- `when_rel`: 'today'
- `priority`: 3 or 4 (normal to low)

The dashboard's control loop allows the user to **Accept** (promote to `tasks`) or **Dismiss** these signals.

## Fire morning notification
Generate **one** BurntToast (Windows notification) summarizing the outlook. **Important:** the server is the single owner of OS toasts. Do not fire the toast here; instead, insert a low-priority `alerts` row with `severity='info'` and a note. The server's notification thread will fire the OS toast and set `notified_toast=1`.

## Call log_skill_run
Write to the `skill_runs` table via the `log_skill_run` tool:
```
INSERT INTO skill_runs (
  skill, ran_at, window_start, window_end, items_created, status, note
) VALUES (
  'daily_outlook',
  datetime('now'),
  datetime('now', '-1 day'),
  datetime('now'),
  <suggestions_count>,
  'ok',
  '<events_count> events, <deadlines_count> deadlines, <suggestions_count> suggestions'
)
```

Then exit.
