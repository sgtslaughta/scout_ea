---
name: pipeline_tracker
description: Look up user-tracked opportunities (by TPID or opportunity ID) in MSX and fill in the Pipeline dashboard tile; refresh status monthly
schedule: heartbeat 20m, workdays 07:00-18:00 EST; monthly status refresh on the 1st at 07:00 EST
---

## MCP server
This skill runs entirely through the **{{mcp_name}}** MCP server. Every read and write goes through an MCP
tool — never run raw SQL or touch the SQLite database directly. If the MCP server is
unreachable, stop and report; do not fall back to the database.

## What the user does
From the Pipeline tile, the user types **one** key they already know — a TPID or an
opportunity ID — plus, optionally, a Sales tag ID (the only field MSX doesn't have).
The tile writes a stub `kind="pipeline"` record with `status="pending"` and
`data={"tpid":…}` or `data={"opportunityId":…}` (and `salesTagId` if given). This
skill's job is to find those stubs, look them up in MSX, and fill in the rest.

## THE MOST IMPORTANT RULE: merge, never replace
`upsert_record` **overwrites the entire `data` blob** for a given `external_ref` — it
does not merge. `salesTagId` is hand-typed by the user and exists **nowhere in MSX**.
If you ever call `upsert_record` with a `data` object that doesn't carry forward the
existing `salesTagId` (and any other fields already on the row), you silently delete it
and the user has to retype it. This applies to **every** write this skill makes,
including the monthly status refresh.

Before every `upsert_record` call:
1. Fetch the current row (from the `list_records` you already did, or a fresh
   `list_records(kind="pipeline")` if you don't have it in hand).
2. Build the new `data` as `{**current_data, **your_new_fields}` — spread the existing
   blob first, then overlay only the fields you're actually updating.
3. Call `upsert_record` with that merged object, never with a fresh dict built from
   scratch.

## Pass 1 — lookup: pending → active
List stub records with `list_records(kind="pipeline", status="pending")`. For each:

1. Read whichever key is present: `data.tpid` or `data.opportunityId`.
2. Look up that TPID/opportunity in MSX (via Scout's browser automation) and extract:
   - `customer`: customer/account name
   - `accountExec`: account exec name
   - `tpid`: TPID # (fill in even if the user gave the opportunity ID, and vice versa,
     when MSX cross-references it)
   - `opportunityId`: opportunity ID
   - `totalValue`: total opportunity value, a plain number (no currency symbol/commas)
   - `workload`: workload name (azure, macc, copilot, purview, etc — use MSX's own label)
   - `status`: MSX's current status/stage for the opportunity. Categories are whatever
     MSX uses — do not invent or constrain to a fixed set; store the raw label.
3. Merge (per the rule above) `data.salesTagId` from the existing stub into the new
   `data`, then call `upsert_record(kind="pipeline", external_ref=<same ref>, data=<merged>, status="active")`.
4. If MSX has no match for the given key, leave the record `status="pending"` (retry
   next run) rather than guessing — do not fabricate values.

## Pass 2 — monthly status refresh
On the monthly run only (1st of the month, or the first run after `now - 32d` since the
last monthly run — track this yourself via `log_skill_run` notes, e.g. note="monthly"):

1. List enriched records with `list_records(kind="pipeline", status="active")`.
2. For each, re-look-up its `status` in MSX using `data.tpid` or `data.opportunityId`.
3. Merge (per the rule above) just the new `status` value into the existing `data` —
   every other field, and especially `salesTagId`, must come through unchanged.
4. Call `upsert_record` with the merged `data` and `status="active"` (record status
   stays active; only `data.status`, the deal stage, changes).

## No-op and log
If no pending records to look up and it isn't a monthly refresh run, log the run with
`items_created=0` and exit.

Finish — in every case, including a no-op — with the **`log_skill_run`** tool:

`log_skill_run(skill="pipeline_tracker", items_created=<count>, status="ok", note=<"lookup" or "monthly">)`

Then exit.
