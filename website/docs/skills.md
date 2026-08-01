# Skills

Scout EA ships **24 skills** — `SKILL.md` prompt files Microsoft Scout runs on a schedule
(heartbeat or automation trigger). Each reads and writes the `EA_DB` through the
[MCP server](mcp-tools.md).

!!! tip "Just want to install them?"
    Follow the **[Setup Wizard](setup-wizard.md)** — connect Scout once, then one pasted
    message installs and schedules all 24 for you. Nothing here needs doing by hand.

## Base skills (7)

| Skill | Purpose | Schedule |
|---|---|---|
| `triage_email` | Triage inbound email for critical actions, events, key-person replies | Heartbeat 30 min, workdays 07:00–18:00 |
| `triage_teams` | Triage active Teams chats for critical actions and mentions | Heartbeat 30 min, workdays 07:00–18:00 |
| `extract_research_training_email` | Identify training/research announcements in email | Heartbeat 30 min, workdays 07:00–18:00 |
| `suggest_events` | Read signals implying meetings; draft calendar times | Heartbeat 30 min |
| `create_events` | Draft calendar invites from approved events | Heartbeat 30 min |
| `research_topics` | Weekly web/news search for active topics | Weekly, Fri 09:00 |
| `compile_learning_email` | Consolidate the week's training/research emails | Weekly, Fri 10:00 |

## Feature skills (4)

| Skill | Purpose | Schedule |
|---|---|---|
| `parse_deadlines` | Scan signals and mail/chat for hard deadlines | Heartbeat 30 min, workdays 07:00–18:00 |
| `daily_briefing` | Morning briefing curator: proactive risk/opportunity signals + one-line day summary | Daily at config.outlook_send_time (default 07:00), workdays |
| `compute_trends` | Daily trending keyword/topic extraction with recency-weighted scores | Daily 08:00 |
| `trending_search` | Weekly web/news search for trending content per topic | Weekly, Fri 14:00 |

## Data sourcing (1)

| Skill | Purpose | Schedule |
|---|---|---|
| `news_search` | Search current headlines per topic; add deduped, tagged news items | Daily 06:30 |

## Preferred people feeds (2)

Write the summary records behind the Email and Teams chat dashboard tiles.

| Skill | Purpose | Schedule |
|---|---|---|
| `email_preferred` | Find recent email from preferred (high-importance) people; write summary records for the Email tile | Heartbeat 20 min, workdays 07:00–18:00 |
| `chat_preferred` | Find recent Teams chats from preferred people; write summary records for the Teams chat tile | Heartbeat 20 min, workdays 07:00–18:00 |

## Dashboard records (5)

Each fills in one generic-`records`-backed dashboard tile (see
**[Architecture](architecture.md)**), always merging into the existing record rather
than overwriting anything the user typed in by hand.

| Skill | Purpose | Schedule |
|---|---|---|
| `pipeline_tracker` | Look up user-tracked opportunities (by TPID or opportunity ID) in MSX and fill in the Pipeline tile; refresh status monthly | Heartbeat 20 min, workdays 07:00–18:00; monthly refresh on the 1st at 07:00 |
| `territory_review` | Find the master territory review schedule and enrich each review with its recording, decks, and recap | Heartbeat 30 min, workdays 07:00–18:00 |
| `ou_feedback` | Catalogue feedback about the user's OU from email, Teams, and meeting notes — infrequent, no alerts | Daily 06:00 |
| `ebc_innovation_hub` | Pull EBC and Innovation Hub session bookings from the MSXI MCP server and fill in the EBC & Innovation Hub tile | Heartbeat 20 min, workdays 07:00–18:00 |
| `revops_meeting` | Find the monthly RevOps meeting, gather topic speakers, and draft post-meeting action items for the RevOps tile | Daily 06:00 |

## Outgoing actions (5)

Scout's closed-loop action pipeline: `scout_actions` drafts outgoing actions, and the four
`run_*` executors claim and execute approved (or auto-mode) actions, writing results back.

| Skill | Purpose | Schedule |
|---|---|---|
| `scout_actions` | Draft outgoing actions from recent signals/deadlines/people (never executes) | Heartbeat 5 min |
| `run_comms` | Execute approved email + status actions via M365 | Heartbeat 5 min |
| `run_teams` | Execute approved Teams chat/group/channel actions | Heartbeat 5 min |
| `run_calendar` | Execute approved calendar invite actions | Heartbeat 5 min |
| `run_cowork` | Execute collaboration doc/gather actions | Heartbeat 10 min |

## Cross-cutting rules

Every skill follows the same contract: read the last `skill_runs.ran_at` as the lookback
window, dedupe by `external_ref` before insert, use the shared 1 (critical) → 5 (info)
priority scale, UTC ISO-8601 timestamps, raise an alert for priority ≤ 2 items, and always
end with `log_skill_run` — even on a no-op.
