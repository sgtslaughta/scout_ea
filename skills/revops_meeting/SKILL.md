---
name: revops_meeting
description: Find the monthly RevOps meeting, gather topic speakers from any available source, and draft action items from the post-meeting transcript, for the RevOps dashboard tile
schedule: automation, daily 06:00 EST
---

## MCP server
This skill runs entirely through the **{{mcp_name}}** MCP server. Every read and write goes through an MCP
tool — never run raw SQL or touch the SQLite database directly. If the MCP server is
unreachable, stop and report; do not fall back to the database.

## What the record looks like
One `kind="revops_meeting"` record per month, `external_ref="revops:YYYY-MM"`:

```
{ month, meetingAt, meetingSource: "calendar"|"manual",
  topics: [ { id, title, speaker?, speakerSource?, onAgenda } ],
  actionItems: [ { id, text, owner?, done, source: "scout"|"user" } ],
  recapText?, graceUrl? }
```

The user builds a lot of this by hand from the tile: they add topics, tick `onAgenda`,
type in speakers, edit/complete action items, and paste `graceUrl` themselves. This
skill only ever fills in what's missing or refreshes what it itself set earlier.

## THE MOST IMPORTANT RULE: merge, never replace
`upsert_record` **overwrites the entire `data` blob** for a given `external_ref` — it
does not merge. This record carries more user-entered state than any other dashboard
record in this system. If any pass below calls `upsert_record` with a `data` object
that isn't built by merging onto the current row, it silently destroys work the user
typed by hand. This has happened before with `pipeline_tracker`'s Sales tag ID; here
the blast radius is bigger.

Before **every** `upsert_record` call in every pass:
1. `list_records(kind="revops_meeting", ...)` (or reuse a row you already fetched this
   run) and read its current `data`.
2. Build the new `data` as `{**current_data, **your_changes}` — never construct a fresh
   object from scratch, and never regenerate a list field (`topics`, `actionItems`)
   without folding the existing entries in first.
3. Specifically preserve, no matter which pass is writing:
   - `meetingAt` **whenever `meetingSource == "manual"`** — the user set that date on
     purpose; only calendar-sourced (`meetingSource == "calendar"`) values may be
     refreshed by Pass 1.
   - Every `topics[]` entry the user added or edited, including its `onAgenda` tick.
     When updating a topic's speaker (Pass 2/3), match by `id` and only touch
     `speaker`/`speakerSource` on that entry — leave `title`/`onAgenda` untouched.
   - Any topic's `speaker` where `speakerSource` is absent or `"user"` — that means the
     user typed it themselves. Only overwrite a `speaker` your own earlier run set
     (`speakerSource` one of the skill's own values, e.g. `"transcript"`, `"calendar"`,
     `"sharepoint"`, `"teams_chat"`). Never overwrite a blank `speakerSource` with a
     guess; only fill a topic that has **no** speaker at all.
   - Every `actionItems[]` entry with `source: "user"`, and any item's `done`/`owner`
     edits regardless of source — match by `id` and only append new items, never drop
     or blanket-replace the array.
   - `graceUrl` — only the user ever sets this; no pass in this skill touches it.

## Pass 1 — find the meeting (daily)
For the current month (and next month, once inside the last week of the current one),
check whether a `kind="revops_meeting"` record exists for `external_ref="revops:YYYY-MM"`.

1. Search the user's M365 calendar for that month's RevOps meeting (recurring series).
2. If no record exists yet, create one: `data={"month":"YYYY-MM","meetingAt":<found time>,"meetingSource":"calendar","topics":[],"actionItems":[]}`, `status="active"`.
3. If a record exists with `meetingSource=="calendar"`, refresh `meetingAt` if the
   calendar time changed (merge per the rule above).
4. If a record exists with `meetingSource=="manual"`, **do not touch `meetingAt`** —
   the user overrode it deliberately. Leave it alone entirely in this pass.

## Pass 2 — gather speakers (daily, pre-meeting)
For topics with no speaker filled in yet, look for who's expected to cover them, in
this priority order (the user was explicit that any of these count):
1. The Teams transcript of a **previous** month's meeting where that topic (or a very
   similar one) was covered — set `speakerSource="transcript"`.
2. The calendar invite for this month's meeting (co-organizers/presenters listed) —
   `speakerSource="calendar"`.
3. SharePoint (deck ownership, a RevOps topic-owner doc, etc.) — `speakerSource="sharepoint"`.
4. Teams chats where someone volunteers or is assigned a topic — `speakerSource="teams_chat"`.

Only fill topics with **no existing speaker**. Merge each fill into the existing
`topics[]` entry by `id`, per the rule above.

## Pass 3 — after the meeting: transcript pass
Once the meeting's `meetingAt` has passed and a Teams transcript is available (check
daily; most days this is a no-op until the transcript shows up):

1. Read the transcript and draft `actionItems`: `{id: <new uuid>, text, owner?: <if named>, done: false, source: "scout"}`. Append to the existing `actionItems[]` — never replace it, and never touch `source: "user"` items.
2. For each topic actually covered in the transcript, record who covered it (this
   feeds Pass 2 next month): update that topic's `speaker`/`speakerSource="transcript"`
   **only if the current entry's `speakerSource` is empty or one of the skill's own
   values** — never overwrite a user-typed speaker, even after the fact.
3. Optionally draft `recapText` (a short summary) if requested by the record's fields —
   still merge, don't replace.

## Explicitly out of scope
This skill never posts to Teams and never writes to GRACE. Sharing the recap/action
items and updating GRACE are outgoing actions the user reviews and approves from the
tile; `scout_actions` drafts them and `run_teams` executes them once approved. Do not
add that here.

## No-op and log
If there's nothing to do in any pass on a given day (meeting record already correct,
no unfilled speakers, no new transcript), log the run with `items_created=0` and exit.

Finish — in every case, including a no-op — with the **`log_skill_run`** tool:

`log_skill_run(skill="revops_meeting", items_created=<count>, status="ok", note=<"meeting"|"speakers"|"transcript">)`

Then exit.
