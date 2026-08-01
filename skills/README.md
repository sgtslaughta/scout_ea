# Scout EA Skills

This directory contains the 22 Scout automation skills that orchestrate the Executive Agent. Each skill is a `SKILL.md` prompt file that Scout executes on a schedule (heartbeat or automation trigger). Skills read/write the `EA_DB` via MCP server tools and follow the cross-cutting rules from the design spec.

## Base Skills (7)

### 1. `triage_email`
**Description:** Review inbound email for critical/time-sensitive actions, events, and key-person replies; upsert signals  
**Schedule:** Heartbeat 30 min, workdays 07:00–18:00 EST  
**MCP Tools:** `add_signal`, `log_skill_run`

### 2. `triage_teams`
**Description:** Review active Teams chats for critical/time-sensitive actions and key-person mentions; upsert signals  
**Schedule:** Heartbeat 30 min, workdays 07:00–18:00 EST  
**MCP Tools:** `add_signal`, `log_skill_run`

### 3. `extract_research_training_email`
**Description:** Identify training opportunities and research announcements in email; upsert learning items  
**Schedule:** Heartbeat 30 min, workdays 07:00–18:00 EST  
**MCP Tools:** `add_learning`, `log_skill_run`

### 4. `suggest_events`
**Description:** Read signals implying meetings; suggest calendar times and attendees; draft events  
**Schedule:** Heartbeat 30 min  
**MCP Tools:** `list_rows`, `add_task`, `log_skill_run`

### 5. `create_events`
**Description:** Read approved events; draft calendar invites for user review  
**Schedule:** Heartbeat 30 min  
**MCP Tools:** `list_rows`, `update_status`, `log_skill_run`

### 6. `research_topics`
**Description:** Weekly web/news search for developments in active topics; upsert learning items  
**Schedule:** Automation, weekly Friday 09:00 EST  
**MCP Tools:** `add_learning`, `log_skill_run`

### 7. `compile_learning_email`
**Description:** Consolidate training/research emails from the week; compile summary  
**Schedule:** Automation, weekly Friday 10:00 EST  
**MCP Tools:** `list_rows`, `log_skill_run`

## Feature Skills (4)

### 8. `parse_deadlines`
**Description:** Scan signals and email/chat for hard deadlines; upsert critical_deadlines  
**Schedule:** Heartbeat 30 min, workdays 07:00–18:00 EST  
**MCP Tools:** `add_deadline`, `log_skill_run`

### 9. `daily_briefing`
**Description:** Morning briefing curator — proactive risk/opportunity signals + one-line day summary; supersedes daily_outlook  
**Schedule:** Automation, daily at config.outlook_send_time (default 07:00), workdays only  
**MCP Tools:** `list_rows`, `add_signal`, `log_skill_run`

### 10. `compute_trends`
**Description:** Daily extraction of trending keywords/topics from signals; compute recency-weighted scores and deltas  
**Schedule:** Automation, daily 08:00 EST  
**MCP Tools:** `upsert_trend`, `list_rows`, `log_skill_run`

### 11. `trending_search`
**Description:** Weekly web/news search for trending content per topic; upsert trend_findings  
**Schedule:** Automation, weekly Friday 14:00 EST  
**MCP Tools:** `add_trend_finding`, `log_skill_run`

## Data Sourcing (1)

### 12. `news_search`
**Description:** Search current headlines per topic; add news_items (deduped), tagged external + linked to topic/people  
**Schedule:** Automation, daily 06:30 EST  
**MCP Tools:** `add_news`, `tag_content`, `link_content`, `list_tags`, `log_skill_run`

## Preferred People Feeds (2)

### 13. `email_preferred`
**Description:** Find recent email from preferred (high-importance) people; write summary records for the Email tile  
**Schedule:** Heartbeat 20 min, workdays 07:00–18:00 EST  
**MCP Tools:** `query`, `upsert_record`, `list_records`, `log_skill_run`

### 14. `chat_preferred`
**Description:** Find recent Teams chats from preferred (high-importance) people; write summary records for the Teams Chat tile  
**Schedule:** Heartbeat 20 min, workdays 07:00–18:00 EST  
**MCP Tools:** `query`, `upsert_record`, `list_records`, `log_skill_run`

## Dashboard Records (4)

### 15. `pipeline_tracker`
**Description:** Look up user-tracked opportunities (by TPID or opportunity ID) in MSX and fill in the Pipeline dashboard tile; refresh status monthly. Always merges into the existing record — never overwrites the user's hand-entered Sales tag ID.  
**Schedule:** Heartbeat 20 min, workdays 07:00–18:00 EST; monthly status refresh on the 1st at 07:00 EST  
**MCP Tools:** `list_records`, `upsert_record`, `log_skill_run`

### 16. `territory_review`
**Description:** Find the master territory review schedule and enrich each review with its Teams recording, decks, and recap as they become available. Always merges into the existing record — new artefacts never overwrite ones already attached.  
**Schedule:** Heartbeat 30 min, workdays 07:00–18:00 EST  
**MCP Tools:** `list_records`, `upsert_record`, `log_skill_run`

### 17. `ou_feedback`
**Description:** Catalogue feedback about the user's OU from email, Teams, and meeting notes — who said it, what it was, and whether it needs action. A catalogue, not a feed: infrequent, no alerts.  
**Schedule:** Automation, daily 06:00 EST  
**MCP Tools:** `list_records`, `upsert_record`, `log_skill_run`

### 18. `ebc_innovation_hub`
**Description:** Pull EBC and Innovation Hub session bookings from the MSXI MCP server (on the user's host machine) and fill in the EBC & Innovation Hub dashboard tile. MSXI's field shape is unknown, so it stores what it gets rather than forcing a schema. Always merges into the existing record — never overwrites the user's hand-entered Lead planner or My action.  
**Schedule:** Heartbeat 20 min, workdays 07:00–18:00 EST  
**MCP Tools:** `list_records`, `upsert_record`, `log_skill_run`

## Outgoing Actions (5)

Scout's closed-loop action pipeline: `scout_actions` drafts, the four `run_*` executors claim and execute approved (or auto-mode) actions and write results back.

### 19. `scout_actions`
**Description:** Scan recent signals/deadlines/people and draft outgoing actions for review; report each run. Does not execute.  
**Schedule:** Heartbeat 5 min  
**MCP Tools:** `list_rows`, `list_guidance`, `has_open_action`, `add_action`, `log_skill_run`

### 20. `run_comms`
**Description:** Execute approved email + status actions via M365; write results back  
**Schedule:** Heartbeat 5 min  
**MCP Tools:** `list_actions`, `claim_action`, `update_action`, `m365_send_mail`, `log_skill_run`

### 21. `run_teams`
**Description:** Execute approved Teams chat + group + channel actions; write results back  
**Schedule:** Heartbeat 5 min  
**MCP Tools:** `list_actions`, `claim_action`, `update_action`, `log_skill_run`

### 22. `run_calendar`
**Description:** Execute approved calendar invite actions; write results back  
**Schedule:** Heartbeat 5 min  
**MCP Tools:** `list_actions`, `claim_action`, `update_action`, `m365_create_event`, `log_skill_run`

### 23. `run_cowork`
**Description:** Execute collaboration doc/gather actions; write results back with access URLs  
**Schedule:** Heartbeat 10 min  
**MCP Tools:** `list_actions`, `claim_action`, `update_action`, `log_skill_run`

---

## MCP Tool Reference (33 tools)

Skills call these over the bearer-gated MCP server. Reads: `list_rows`, `query` (flexible whitelisted SELECT — filters/since/until/order/limit), `search` (full-text), `get_entity` (row + tags + links + related actions), `list_tags`, `list_actions`, `list_guidance`, `list_skills` (roster + cadence health), `list_action_types`, `list_records` (dashboard records by kind). Writes: `add_signal`, `add_deadline`, `add_task`, `add_learning`, `add_news`, `add_event`, `update_event`, `upsert_trend`, `add_trend_finding`, `add_alert` (user-facing notification), `add_action`, `add_guidance`, `update_status`, `update_action`, `claim_action`, `has_open_action`, `tag_content`, `link_content`, `upsert_record` (generic dashboard record, dedup on external_ref), `log_skill_run`. M365 passthrough: `m365_status`, `m365_send_mail`, `m365_create_event`.

---

## Installation into Scout

Scout executes Skills by reading `.md` files from a skills directory and parsing YAML frontmatter. To install these skills:

1. **Copy** each `skills/<name>/SKILL.md` file to Scout's configured skills directory (typically `C:\ScoutEA\skills\<name>\SKILL.md` on Windows).
2. **Verify** the frontmatter:
   - `name:` — skill name (must match directory)
   - `description:` — one-line summary
   - `schedule:` — Scout's execution trigger (heartbeat or automation)
3. **MCP server configuration:** Ensure `backend/mcp_server/server.py` is running on `127.0.0.1:8766` with bearer authentication configured (see backend docs).
4. **Test:** Run the skill validation suite (see below).

---

## Cross-Cutting Rules (All Skills)

All skills follow these rules from the design spec:

1. **Lookback via `skill_runs`**: On start, read the last `skill_runs.ran_at` for this skill and use it as `window_start`. Fallback on first run: `now - 24h`.
2. **Dedup before insert**: Compute `external_ref` (message-id, chat-id, URL, or manual:<uuid>). `INSERT ... ON CONFLICT(external_ref) DO NOTHING`.
3. **Shared priority scale**: 1 (critical) → 5 (info).
4. **All timestamps** in UTC ISO-8601.
5. **No-op is valid**: If nothing new, still log a `skill_runs` row with `items_created=0`.
6. **Raise alerts** for priority ≤ 2 items: insert an `alerts` row.
7. **End with `log_skill_run`**: Always call this tool at the end, even if no-op.
8. **Justify `impact`**: whenever a skill sets `impact` on a signal, it must also set
   `reasoning` — one plain-english sentence saying why the item earned that score.
   It is shown to the user verbatim when they hover the score badge in the daily
   briefing. Write "CEO asked for a decision before Friday's board call", not
   "high priority email".

---

## Validation Test

Run the test suite to verify skill structure:

```bash
cd backend
python -m pytest tests/test_skills_structure.py -v
```

Expected output: **3 passed** (all skills present, frontmatter valid, MCP tools referenced).

Full test suite (with database and server tests):

```bash
python -m pytest tests/ -v
```

Expected output: **82 tests passed** (or the count configured in CI/CD).

---

## Tagging & links convention

Every content row a skill creates (signal, trend, trend_finding, learning, news, event,
deadline, task) should be associated so the Data Feed can cross-reference it:

- Call `link_content(ref_type, ref_id, target_type, target_id)` to connect the row to the
  relevant **person(s)** and **topic(s)** it concerns (`target_type` in `person|topic`).
- Call `tag_content(ref_type, ref_id, tag, color?)` with 1–3 short lowercase labels.
  For trends/news, include an origin label: `internal` (Teams/email chatter) or
  `external` (news/web). `color` is a palette key (`neutral|red|amber|green|teal|blue|violet|pink`).
- Call `list_tags()` first and reuse an existing tag name before inventing a new one.
