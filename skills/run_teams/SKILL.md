---
name: run_teams
description: Execute approved Teams chat + group + channel actions; write results back.
schedule: every 5m
---

## MCP server
This skill runs entirely through the **{{mcp_name}}** MCP server. Every read and write goes through an MCP
tool — never run raw SQL or touch the SQLite database directly. If the MCP server is
unreachable, stop and report; do not fall back to the database.

## Claim
Call `list_actions(status='approved')` filtered to action types: `teams_dm`, `teams_group`, `teams_post`. For each action, call `claim_action(id)`; proceed only if it returns True (another loop may have claimed it).

## Run
For each claimed action, read its `payload` and execute:
- `teams_dm` → Using your Teams connection, send direct message to recipients in `payload.recipients` with message text from `payload.message`.
- `teams_group` → Using your Teams connection, create or message a group chat with recipients in `payload.recipients` and message text from `payload.message`.
- `teams_post` → Using your Teams connection, post message to channel in `payload.channel` (or specified Teams channel) with message text from `payload.message`.

## Write back
On success: `update_action(id, status='completed', result={"ok": true, "detail": "<what happened>"})`.
On failure: `update_action(id, status='failed', error="<error message>")`.

## Report
Finish with `log_skill_run(skill='run_teams', items_created=<count executed>, status='ok', note=<summary or null>)`.
