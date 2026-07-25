---
name: run_cowork
description: Execute collaboration doc/gather actions; write results back with access URLs.
schedule: every 10m
---

## MCP server
This skill runs entirely through the **{{mcp_name}}** MCP server. Every read and write goes through an MCP
tool — never run raw SQL or touch the SQLite database directly. If the MCP server is
unreachable, stop and report; do not fall back to the database.

## Claim
Call `list_actions(status='approved')` filtered to action types: `cowork_doc`, `cowork_gather`. Also call `list_actions(status='drafted', mode='auto')` filtered to `cowork_doc`, `cowork_gather`. For each action, call `claim_action(id)`; proceed only if it returns True (another loop may have claimed it).

## Run
For each claimed action, read its `payload` and execute:

### cowork_doc
Generate the document locally based on `payload.prompt` and optional `payload.target`. 
- Create or render the document (markdown, spreadsheet, or other format as implied by prompt).
- Capture the file path or access URL after creation.
- Set `result={"ok": true, "access_url": "<path/url>", "detail": "<summary of what was generated>"}`.

### cowork_gather
Query the data source specified in `payload.target` (or inferred from `payload.prompt`) and summarize findings.
- Gather and synthesize data from relevant sources.
- Compose a summary with key insights.
- Set `result={"ok": true, "detail": "<summary of findings>", "access_url": "<optional link to source>"}`.

## Write back
On success: `update_action(id, status='completed', result={...})`.
On failure: `update_action(id, status='failed', error="<error message>")`.

## Report
Finish with `log_skill_run(skill='run_cowork', items_created=<count executed>, status='ok', note=<summary or null>)`.
