---
name: run_calendar
description: Execute approved calendar invite actions; write results back.
schedule: heartbeat 5m
---

## MCP server
This skill runs entirely through the Scout **MCP server** at `http://127.0.0.1:8766`
(default port; bearer token `EA_MCP_TOKEN`). Every read and write goes through an MCP
tool — never run raw SQL or touch the SQLite database directly. If the MCP server is
unreachable, stop and report; do not fall back to the database.

## Claim
Call `list_actions(status='approved')` filtered to action type: `calendar_invite`. For each action, call `claim_action(id)`; proceed only if it returns True (another loop may have claimed it).

## Run
For each claimed action, read its `payload` and execute via M365 MCP tool `m365_create_event()` with:
- `title`: from `payload.title`
- `start`: from `payload.start`
- `end`: from `payload.end`
- `attendees`: from `payload.attendees`
- `body`: from `payload.body`

## Write back
On success: `update_action(id, status='completed', result={"ok": true, "detail": "<what happened>"})`.
On failure: `update_action(id, status='failed', error="<error message>")`.

## Report
Finish with `log_skill_run(skill='run_calendar', items_created=<count executed>, status='ok', note=<summary or null>)`.
