---
name: create_events
description: Read approved events; draft calendar invites for user review
schedule: heartbeat 30m
---

## Lookback window
Read the last `log_skill_run` entry for this skill. Use its `ran_at` as `window_start`. If none exists, use `now - heartbeat_minutes` (default 30 min).

## Gather approved events
Query `list_rows('events', status='approved')` for rows in any window (ignore time; the dashboard sets status, and we react immediately). Filter to those updated in the last 24 hours to avoid reprocessing. For each:
- Extract `chosen_time` (ISO-8601 UTC), `attendees` (JSON array of person_ids), `title`, `body`, `source_signal_id`

## Draft calendar invite
For each approved event:
1. Resolve `attendees` person_ids to email addresses via `person_handles WHERE channel='email'`.
2. Create a calendar event in Scout's calendar connector:
   - Title: `events.title`
   - Time: `events.chosen_time` (converted to user's local tz from `config.tz`)
   - Duration: default 30 min (or infer from `events.body` if specified)
   - Body: `events.body` + attendee list
   - Invitees: emails from step 1
   - **Open for user review** — do not send automatically
3. Capture the calendar event ID returned by Scout (or a placeholder if the draft doesn't get an ID yet).
4. Update the `events` row:
   ```
   UPDATE events SET status='drafted', external_ref=<calendar-event-id>
   WHERE id=<event.id>
   ```

## Notification
Optionally: if an event is drafted, insert a low-priority alert to notify the user ("Event draft ready: <title>").

## No-op and log
If no approved events, write a `skill_runs` row with `items_created=0` and exit.

If events drafted, write:
```
INSERT INTO skill_runs (skill, ran_at, window_start, window_end, items_created, status, note)
VALUES ('create_events', datetime('now'), ?, datetime('now'), <count>, 'ok', NULL)
```

Then exit.
