---
name: ebc_innovation_hub
description: Pull EBC and Innovation Hub session bookings from the MSXI MCP server and fill in the EBC & Innovation Hub dashboard tile
schedule: heartbeat 20m, workdays 07:00-18:00 EST
---

## Two MCP servers, two jobs
This skill talks to **two** separate MCP servers — don't confuse them:

- **MSXI MCP server** (running on the user's host machine): the *source* of EBC/Innovation
  Hub session data. Read-only for this skill.
- **{{mcp_name}}** (our own app's MCP server): where the data ends up, via `upsert_record`.
  Every write to Scout EA's database goes through this server — never touch SQLite directly.

If either MCP server is unreachable, stop and report; do not fall back to guessing or to
a direct database connection.

## MSXI's shape is unknown — do not force one
Nobody on the team has seen MSXI's actual field names yet. **Do not assume** a fixed
schema. Call whatever MSXI MCP tools are available for Innovation Hub / EBC bookings
(list/search-style tools are the likely candidates — inspect the server's tool list if
unsure), and store what comes back close to as-is. At minimum, look for and normalize
these into the field names the EBC tile expects, when present under any reasonably
named source field:

- `date`: the session date (UTC ISO-8601 if MSXI gives a parseable date; otherwise pass
  the raw string through rather than dropping it)
- `customer`: the customer/account name
- `accountExec`: the account exec's name

Any other fields MSXI returns are fine to include in the `data` blob too — extra fields
don't break the tile, it only renders what it recognizes and shows an em-dash for the
rest. If MSXI returns nothing usable for a session (no date and no customer), skip it
rather than writing a placeholder row.

## THE MOST IMPORTANT RULE: merge, never replace
`upsert_record` **overwrites the entire `data` blob** for a given `external_ref` — it
does not merge. Two fields on every EBC row are **entered by the user in the tile, not
by MSXI**: `leadPlanner` (free text) and `myAction` (a status the user picks from a
dropdown). MSXI has no concept of either. If you call `upsert_record` with a `data`
object that doesn't carry forward the existing `leadPlanner`/`myAction` (and any other
fields already on the row), you silently wipe what the user typed in.

Before every `upsert_record` call for an existing row:
1. `list_records(kind="ebc")` to get the current `data` for that `external_ref`.
2. Build the new `data` as `{**current_data, **your_new_fields_from_msxi}` — spread the
   existing blob first, then overlay only the MSXI-sourced fields you're refreshing.
   Never build a fresh dict from scratch and never include `leadPlanner`/`myAction` in
   `your_new_fields_from_msxi` — those are the user's, and merging on top of the
   existing blob already preserves them untouched.
3. Call `upsert_record` with that merged object.

## Dedup
Compute `external_ref` from a stable MSXI session identifier (session/booking id if
MSXI provides one; otherwise a deterministic composite like
`<customer>:<date>` — lowercased, trimmed). The same session must never appear twice.

## Run
1. `list_records(kind="ebc")` to see what's already tracked (and their current `data`,
   for the merge step above).
2. Query the MSXI MCP server for EBC/Innovation Hub sessions in the lookback window
   (use the last `log_skill_run` entry for this skill as `window_start`; `now - 24h` on
   first run).
3. For each session MSXI returns:
   - Compute `external_ref` per the Dedup rule.
   - If a record with that `external_ref` already exists, merge per the rule above.
   - If it's new, `upsert_record(kind="ebc", external_ref=<ref>, data=<msxi fields>, status="active")`.

## No-op and log
If MSXI has nothing new in the lookback window, still log the run with `items_created=0`
and exit — a no-op is a valid, expected outcome.

Finish — in every case, including a no-op — with the **`log_skill_run`** tool:

`log_skill_run(skill="ebc_innovation_hub", items_created=<count>, status="ok", note=None)`

Then exit.
