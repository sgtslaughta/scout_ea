---
name: ou_feedback
description: Catalogue feedback about the user's OU from email, Teams, and meeting notes — who said it, what it was, and whether it needs action
schedule: automation, daily 06:00 EST
---

## MCP server
This skill runs entirely through the **{{mcp_name}}** MCP server. Every read and write goes through an MCP
tool — never run raw SQL or touch the SQLite database directly. If the MCP server is
unreachable, stop and report; do not fall back to the database.

## What this is, and what it isn't
This is a **catalogue**, not a feed. The user doesn't want to see feedback every day —
they want it captured somewhere so they can search it when they need it, and they want
anything actionable to be easy to turn into a to-do. Run once a day at most. Do not raise
alerts for a normal catalogue entry — this skill never sets `impact`/`reasoning` and
never calls `add_alert`; a low-priority catalogue item is not a proactive signal.

## Where to look
Scout has native M365 access plus browser automation. Check, over the lookback window:
- **Email** — messages from OU stakeholders (managers, peers, skip-levels, partner
  teams) that comment on how the user or their team is doing, not routine status
  threads or FYI forwards.
- **Teams messages** — 1:1 and group chats where someone offers an opinion on the
  user's work, team, or approach, as opposed to scheduling or small talk.
- **Meeting notes** — if Scout has access to meeting transcripts/notes (e.g. from
  Teams meeting recap), scan for comments attributed to a named attendee about the
  user's OU, not general meeting action items unrelated to the user.

## Deciding something is feedback, not ordinary correspondence
A message is feedback when someone is evaluating, praising, criticizing, or advising on
the user's work, team, or decisions — not simply informing, scheduling, or asking a
question. Rules of thumb:
- Look for evaluative language: "I think you should...", "great job on...", "one thing
  that didn't land...", "my concern with...", "you might want to reconsider...".
- A status update ("here's this week's numbers") is not feedback. A reaction to a
  status update ("those numbers look light for this stage of the quarter") is.
- Prefer explicit, attributable feedback over inferred sentiment — if it's not clearly
  someone's opinion about the user's OU, skip it rather than guess.

## Lookback window
Read the last `log_skill_run` entry for this skill. Use its `ran_at` as `window_start`.
If none exists (first run), use `now - 24h`.

## Extract
For each piece of feedback found, extract:
- `who`: the person's display name (attribute it — anonymous or unattributable
  feedback is still worth capturing, but say so, e.g. `who: "Unknown (forwarded)"`)
- `text`: the feedback itself, in the speaker's own words or a faithful close
  paraphrase — this is the field the user searches later, so keep the substance, not
  just a vague summary
- `source`: where it came from — `email`, `teams`, or `meeting notes`
- `when`: UTC ISO-8601 timestamp of when it was said/sent
- `needsAction`: `true` if the feedback implies the user should do something about it
  (a change, a follow-up, a conversation), `false` if it's informational or purely
  positive with nothing to act on

## Dedup and write
Compute `external_ref` = the source message/note's stable provider id (or a stable hash
of speaker+timestamp+source for meeting notes without a native id) — required so the
same piece of feedback is never catalogued twice. Call the **`upsert_record`** tool:

`upsert_record(kind="ou_feedback", external_ref=<stable id>, data={"who":…, "text":…, "source":…, "when":…, "needsAction":…}, status="active")`

Never set `taskCreated` — that field belongs to the user, flipped by the dashboard tile
when they choose to add an item to their to-do list. If a record with this
`external_ref` already exists, `upsert_record` overwrites `data` wholesale, so if you're
re-processing the same item, carry forward its existing `taskCreated` value rather than
dropping it (fetch the row via `list_records(kind="ou_feedback")` first).

## No-op and log
If nothing found this run, that's a normal outcome for a low-frequency catalogue — log
the run with `items_created=0` and exit.

Finish — in every case, including a no-op — with the **`log_skill_run`** tool:

`log_skill_run(skill="ou_feedback", items_created=<count>, status="ok", note=None)`

Then exit.
