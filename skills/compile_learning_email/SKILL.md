---
name: compile_learning_email
description: Consolidate training/research emails from the week; compile summary
schedule: automation, weekly Friday 10:00 EST
---

## Lookback window
Timeframe: last 7 days (fixed window).

## Gather this week's learning items
Query `list_rows('learning', status=?)` to find items marked as 'suggested' and created in the last 7 days where `source='email'`. For each:
- Extract `title`, `synopsis`, `provider`, `event_at`, `topic_id`, `kind`

## Deconflict duplicates
For each email-sourced learning item:
1. Check if a row with the same `title` or `url` already exists in `learning`.
2. If found and created within the last 2 weeks, skip (deduplicated).
3. Enrich: if `event_at` is null but the email mentions a date, parse and populate.

## Compile summary
Organize items by:
- Training events (scheduled `event_at`): group by date
- Self-paced resources (video, course, read): group by topic
- Create a text summary (markdown format) listing:
  - "Training this week: [list with dates]"
  - "New resources by topic: [topic]: [item1], [item2]"
  - Links to full details

## Write consolidation
Set all compiled items' status to 'suggested' (if not already). No new `learning` row is created for the consolidation itself; this skill just ensures flagged items are ready for the user to review via the `/learning` page.

## Optional: fire alert
If > 3 new training items, optionally insert a low-priority info alert: "New training opportunities this week: <count> items ready to review".

## Call log_skill_run
Write to the `skill_runs` table via the `log_skill_run` tool:
```
INSERT INTO skill_runs (
  skill, ran_at, window_start, window_end, items_created, status, note
) VALUES (
  'compile_learning_email',
  datetime('now'),
  datetime('now', '-7 days'),
  datetime('now'),
  <count>,
  'ok',
  'Week reviewed; <count> items consolidated'
)
```

Then exit.
