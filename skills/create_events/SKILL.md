---
name: create_events
description: Read approved events; draft calendar invites for user review
schedule: every 30m
---

## MCP server
This skill runs entirely through the **{{mcp_name}}** MCP server. Every read and write goes through an MCP
tool — never run raw SQL or touch the SQLite database directly. If the MCP server is
unreachable, stop and report; do not fall back to the database.

## Lookback window
Read the last `log_skill_run` entry for this skill. Use its `ran_at` as `window_start`. If none exists (first run), use `now - 24h`.

## Gather approved events
Query `list_rows('events', status='approved')` for rows in any window (ignore time; the dashboard sets status, and we react immediately). Filter to those updated in the last 24 hours to avoid reprocessing. For each:
- Extract `chosen_time` (ISO-8601 UTC), `attendees` (JSON array of person_ids), `title`, `body`, `source_signal_id`

## Draft calendar invite
For each approved event:
1. Resolve `attendees` person_ids to email addresses via `query("person_handles", filters=[["channel","=","email"]])`.
2. Create a calendar event in Scout's calendar connector:
   - Title: `events.title`
   - Time: `events.chosen_time` (converted to user's local tz from `config.tz`)
   - Duration: default 30 min (or infer from `events.body` if specified)
   - Body: `events.body` + attendee list
   - Invitees: emails from step 1
   - **Open for user review** — do not send automatically
3. Capture the calendar event ID returned by Scout (or a placeholder if the draft doesn't get an ID yet).
4. Mark the `events` row drafted via the **`update_event`** tool:

   `update_event(event_id=<event id>, status="drafted", external_ref=<calendar-event-id>)`

## Notification
Optionally, if an event was drafted, raise a low-priority notice with the **`add_alert`**
tool: `add_alert(severity="info", title="Event draft ready", body="<title>", source_table="events", source_id=<event id>)`.

## No-op and log
If no approved events, still call `log_skill_run` with `items_created=0` and exit.

Finish — in every case, including a no-op — with the **`log_skill_run`** tool:

`log_skill_run(skill="create_events", items_created=<count>, status="ok", note=None)`

Then exit.
