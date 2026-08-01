---
name: run_comms
description: Execute approved email + status actions via M365; write results back.
schedule: every 5m
---

## MCP server
This skill runs entirely through the **{{mcp_name}}** MCP server. Every read and write goes through an MCP
tool — never run raw SQL or touch the SQLite database directly. If the MCP server is
unreachable, stop and report; do not fall back to the database.

## Claim
Call `list_actions(status='approved')` filtered to action types: `email_reply`, `email_forward`, `email_new`, `email_delete`, `email_move_folder`, `status_set`. Also call `list_actions(status='drafted', mode='auto')` filtered to `status_set`. For each action, call `claim_action(id)`; proceed only if it returns True (another loop may have claimed it).

## Run
For each claimed action, read its `payload` and execute:
- `email_reply` / `email_forward` / `email_new` → Use the M365 MCP tool `m365_send_mail(to, subject, body)` with data from payload.
- `email_delete` → Move the message identified by `payload.external_ref` (the provider message id, written by `email_preferred`) to Deleted Items using your Outlook connection. Delete only that one message; never a thread, a folder, or a search result set. If the message no longer exists, treat that as success — the user's intent is already satisfied.
- `email_move_folder` → Move the message identified by `payload.external_ref` into the folder named in `payload.folder`. If no folder of that name exists, fail the action with a clear error rather than creating one or guessing at a near match.
- `status_set` → Using your Teams connection, set presence status to the text in `payload.text` with optional `payload.expires_at`. Send message to host: "Using your Teams connection, set presence to: {payload.text}".

`email_delete` and `email_move_folder` change the user's mailbox and are not undoable from this app. Only ever execute them from `status='approved'` — never from `mode='auto'`, and never infer them from anything other than an explicit queued action.

## Write back
On success: `update_action(id, status='completed', result={"ok": true, "detail": "<what happened>"})`.
On failure: `update_action(id, status='failed', error="<error message>")`.

## Report
Finish with `log_skill_run(skill='run_comms', items_created=<count executed>, status='ok', note=<summary or null>)`.
