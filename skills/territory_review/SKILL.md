---
name: territory_review
description: Find the master territory review schedule and enrich each review with its Teams recording, decks, and recap as they become available
schedule: heartbeat 30m, workdays 07:00-18:00 EST
---

## MCP server
This skill runs entirely through the **{{mcp_name}}** MCP server. Every read and write goes through an MCP
tool — never run raw SQL or touch the SQLite database directly. If the MCP server is
unreachable, stop and report; do not fall back to the database.

## What the tile shows
The Territory Review tile is a master schedule: manager, date, who's presenting, a link
to the customer plan, and — once available — the Teams call recording, PowerPoint decks,
and recap notes for that review. Rows are `kind="territory"` records with:

```json
{
  "manager": "Jamie Lee",
  "date": "2026-08-10T15:00:00Z",
  "presenter": "Sam Rivera",
  "customerPlanUrl": "https://.../customer-plan",
  "attachments": [
    { "kind": "recording", "label": "Teams recording", "url": "https://.../rec.mp4" },
    { "kind": "deck", "label": "Deck", "url": "https://.../deck.pptx" },
    { "kind": "recap", "label": "Recap notes", "url": "https://.../recap.docx" }
  ]
}
```

`attachments` is a growable list, not fixed fields — a review only gets its recording and
recap **after** the meeting happens, so the same row is written once (schedule only) and
enriched over multiple later runs as each artefact shows up.

## THE MOST IMPORTANT RULE: merge, never replace
`upsert_record` **overwrites the entire `data` blob** for a given `external_ref` — it does
not merge. If you write a fresh `data` object containing only the new attachment you just
found, you silently delete every attachment (and the customer plan link) already on that
row. This applies to **every** write this skill makes.

Before every `upsert_record` call:
1. Fetch the current row (from the `list_records` you already did, or a fresh
   `list_records(kind="territory")` if you don't have it in hand).
2. Build the new `attachments` array as the existing array **plus** any newly found
   artefacts (dedup by `url` — don't add the same artefact twice across runs), and build
   the new `data` as `{...current_data, ...your_new_fields, attachments: <merged array>}`.
3. Call `upsert_record` with that merged object, never with a fresh dict built from
   scratch.

## Pass 1 — find the master schedule
1. Find the territory review schedule (via Scout's M365/SharePoint access — wherever the
   team keeps it, e.g. a shared calendar or planning doc).
2. For each scheduled review not already tracked, build `external_ref` = a stable key for
   that review (e.g. `"<manager>-<date>"` or the schedule's own row/event id — pick one
   convention and use it consistently so re-runs dedup correctly).
3. Call `upsert_record(kind="territory", external_ref=<ref>, data={"manager":…, "date":…,
   "presenter":…, "customerPlanUrl":…, "attachments": []}, status="active")`. Leave
   `attachments` empty at this point — nothing to attach until the meeting happens.

## Pass 2 — enrich with artefacts
1. `list_records(kind="territory", status="active")`.
2. For each review whose `date` is in the past, look for a Teams call recording, any
   PowerPoint decks, and a recap for that meeting (via Scout's M365/Teams/OneDrive access
   and browser automation).
3. For each artefact found that isn't already in the row's `attachments` (compare by
   `url`), merge it in per the rule above and call `upsert_record` with kind `"recording"`,
   `"deck"`, or `"recap"` and a short human `label`.
4. If nothing new is found for a review, leave it untouched — retry on a later run.

## No-op and log
If no new schedule rows and no new artefacts found, log the run with `items_created=0`
and exit.

Finish — in every case, including a no-op — with the **`log_skill_run`** tool:

`log_skill_run(skill="territory_review", items_created=<count>, status="ok", note=<"schedule" or "enrich">)`

Then exit.
