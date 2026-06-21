# Scout EA Skills

This directory contains the 11 Scout automation skills that orchestrate the Executive Agent. Each skill is a `SKILL.md` prompt file that Scout executes on a schedule (heartbeat or automation trigger). Skills read/write the `EA_DB` via MCP server tools and follow the cross-cutting rules from the design spec.

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
**MCP Tools:** `add_signal`, `log_skill_run`

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
**MCP Tools:** `add_signal`, `log_skill_run`

### 7. `compile_learning_email`
**Description:** Consolidate training/research emails from the week; compile summary  
**Schedule:** Automation, weekly Friday 10:00 EST  
**MCP Tools:** `list_rows`, `log_skill_run`

## Feature Skills (4)

### 8. `parse_deadlines`
**Description:** Scan signals and email/chat for hard deadlines; upsert critical_deadlines  
**Schedule:** Heartbeat 30 min, workdays 07:00–18:00 EST  
**MCP Tools:** `add_deadline`, `log_skill_run`

### 9. `daily_outlook`
**Description:** Daily morning snapshot of today's events, deadlines, trends; generate proactive suggestions  
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

1. **Lookback via `skill_runs`**: On start, read the last `skill_runs.ran_at` for this skill and use it as `window_start`. Fallback: `now - config.heartbeat_minutes`.
2. **Dedup before insert**: Compute `external_ref` (message-id, chat-id, URL, or manual:<uuid>). `INSERT ... ON CONFLICT(external_ref) DO NOTHING`.
3. **Shared priority scale**: 1 (critical) → 5 (info).
4. **All timestamps** in UTC ISO-8601.
5. **No-op is valid**: If nothing new, still log a `skill_runs` row with `items_created=0`.
6. **Raise alerts** for priority ≤ 2 items: insert an `alerts` row.
7. **End with `log_skill_run`**: Always call this tool at the end, even if no-op.

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
