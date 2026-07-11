---
name: run_comms
description: Execute approved email + status actions via M365; write results back.
schedule: heartbeat 5m
---

## Claim
Call `list_actions(status='approved')` filtered to action types: `email_reply`, `email_forward`, `email_new`, `status_set`. Also call `list_actions(status='drafted', mode='auto')` filtered to `status_set`. For each action, call `claim_action(id)`; proceed only if it returns True (another loop may have claimed it).

## Run
For each claimed action, read its `payload` and execute:
- `email_reply` / `email_forward` / `email_new` → Use the M365 MCP tool `m365_send_mail(to, subject, body)` with data from payload.
- `status_set` → Using your Teams connection, set presence status to the text in `payload.text` with optional `payload.expires_at`. Send message to host: "Using your Teams connection, set presence to: {payload.text}".

## Write back
On success: `update_action(id, status='completed', result={"ok": true, "detail": "<what happened>"})`.
On failure: `update_action(id, status='failed', error="<error message>")`.

## Report
Finish with `log_skill_run(skill='run_comms', items_created=<count executed>, status='ok', note=<summary or null>)`.
