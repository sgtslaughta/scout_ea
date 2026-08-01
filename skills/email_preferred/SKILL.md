---
name: email_preferred
description: Find recent email from preferred (high-importance) people and write summary records for the Email dashboard tile
schedule: every 20m, workdays 07:00-18:00 EST
---

## MCP server
This skill runs entirely through the **{{mcp_name}}** MCP server. Every read and write goes through an MCP
tool — never run raw SQL or touch the SQLite database directly. If the MCP server is
unreachable, stop and report; do not fall back to the database.

## Lookback window
Read the last `log_skill_run` entry for this skill. Use its `ran_at` as `window_start`. If none exists (first run), use `now - 24h`. Query Scout's email connector for messages received in `[window_start, now]`.

## Find preferred people
Preferred people are **high-importance** rows in `people`: `importance` is 1-5 where a
**lower number is more important** (1 = critical, 5 = info — see the shared priority
scale in this README and `people.importance`). Read them with
`query("people", filters=[["active","=",1],["importance","<=",2]], order="importance")`.

For each preferred person, get their email handles with
`query("person_handles", filters=[["channel","=","email"],["person_id","=",<id>]])`.

## Match and extract
For each inbound message in the lookback window whose sender handle matches a preferred
person's email handle, extract:
- `from` / `fromEmail`: sender display name and address
- `subject`: message subject
- `preview`: a short plain-text snippet (first 1-2 sentences) — never copy the full body
- `receivedAt`: UTC ISO-8601 timestamp
- `isUnread`: boolean read state
- `isMention`: true if the user is directly addressed (To, not Bcc) or named in the body
- `webUrl`: Scout's Outlook deep-link to the message, if available
- `folder`: the mailbox folder the message is in

## Write records
Compute `external_ref` = the message's stable provider id (required for dedup — the same
message must never appear twice). Call the **`upsert_record`** tool:

`upsert_record(kind="email", external_ref=<message id>, data={"from":…, "fromEmail":…, "subject":…, "preview":…, "receivedAt":…, "isUnread":…, "isMention":…, "webUrl":…, "folder":…}, status="active")`

## Clean up stale records
Records older than 7 days (by `receivedAt`) should not accumulate on the tile. List
existing `kind="email"` records with `list_records(kind="email", status="active")` and,
for any whose `receivedAt` is more than 7 days before `now`, call `upsert_record` again
with the same `external_ref`/`data` and `status="archived"` to retire them.

## No-op and log
If no new or updated messages in window, log the run with `items_created=0` and exit.

Finish — in every case, including a no-op — with the **`log_skill_run`** tool:

`log_skill_run(skill="email_preferred", items_created=<count>, status="ok", note=None)`

Then exit.
