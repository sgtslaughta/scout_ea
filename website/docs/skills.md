# Skills

Scout EA ships **17 skills** — `SKILL.md` prompt files Microsoft Scout runs on a schedule
(heartbeat or automation trigger). Each reads and writes the `EA_DB` through the
[MCP server](mcp-tools.md).

!!! tip "Just want to install them?"
    Follow the **[Setup Wizard](setup-wizard.md)** — it walks you through all 17 in the
    right order with the exact interval each one needs.

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
| `daily_briefing` | Morning briefing: risk/opportunity signals + one-line day summary | Daily 07:00, workdays |
| `compute_trends` | Daily trending keyword/topic extraction with recency-weighted scores | Daily 08:00 |
| `trending_search` | Weekly web/news search for trending content per topic | Weekly, Fri 14:00 |

## Data sourcing (1)

| Skill | Purpose | Schedule |
|---|---|---|
| `news_search` | Search current headlines per topic; add deduped, tagged news items | Daily 06:30 |

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
