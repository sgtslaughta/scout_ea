# MCP Capability Expansion — Design

**Date:** 2026-07-13
**Status:** Approved design → plan pending
**Branch base:** `feat/briefing-data-depth-and-live-data` (2cb64fd)

## Goal

Give the external MCP-connected LLM **maximum informed power, inward and outward**:

- **Inward:** find, scope, and fully understand any entity (search, flexible query, full-context read). Today the LLM reads only flat rows and is blind to tags/links.
- **Outward:** write every structured field the schema supports, plus a real user-facing notification channel. Today writers expose a subset of columns and there is no way to raise an alert to the user.
- **Safety:** the flexible read path is SELECT-only, whitelisted, and parameter-bound. Writes stay on typed tools. Bearer auth + container isolation unchanged.

Tool count grows ~23 → ~29.

## Current gaps (motivation)

| Gap | Evidence |
|---|---|
| No search | FTS5 `search_index(kind, ref_id, title, body)` exists in `features.sql`, unexposed by MCP |
| No filtered read | `list_rows(table, status?)` filters by status only — no topic/person/date/limit |
| Blind to associations | `tag_content`/`link_content` are write-only; `list_tags` returns tag *definitions*, not assignments; no read of `content_tags`/`content_links` |
| Can't target outward | `person_handles` not in readable whitelist — LLM can't get an email/Teams handle |
| Writers not field-complete | `signals` has `who/what/when_rel/why/polarity/impact` columns; `add_signal` accepts none |
| No user notification | `alerts` table + skills rule "raise alerts for priority ≤2" exist, but no `add_alert` MCP tool |
| No self-knowledge | `/api/skills` (roster + health) exists at web layer, not over MCP |

## Architecture

Unchanged 3-layer pattern: `@mcp.tool()` closure (`mcp_server/server.py`) → wrapper (`mcp_server/tools.py`) → `ea.db`. FastMCP derives each tool's JSON Schema from type hints + docstring. New DB helpers land in `ea/db.py`; read-whitelists live in `mcp_server/tools.py`.

## Section 1 — Inward (read power)

### `query` *(new)* — flexible SELECT
```
query(table, filters?, since?, until?, order?, limit=50) -> list[dict]
```
- **SELECT-only.** Builds one parameterized `SELECT * FROM <table> WHERE ... ORDER BY ... LIMIT ...`.
- `table` must be in the read whitelist (extend `_READABLE`).
- `filters`: `{column: value}` or `{column: {op, value}}` with `op` in `= != < <= > >= in`. Every column checked against a **per-table column whitelist**; values **bound as params**.
- `since`/`until`: bound range on `created_at` (or `occurred_at`/`due_at`/`ran_at` per table — resolved by a small per-table map).
- `order`: `"col"` or `"col desc"`, col whitelisted; default `created_at DESC, id DESC`.
- `limit`: hard-capped at **200**.
- Unknown table/column/op → `ValueError` (never interpolate).

### `search` *(new)* — full-text
```
search(q, kinds?, limit=20) -> list[{kind, ref_id, title, snippet}]
```
- FTS5 MATCH over `search_index`; `q` bound as the match arg.
- `kinds?` optional filter on the `kind` column; `limit` capped at 50.

### `get_entity` *(new)* — full context in one call
```
get_entity(ref_type, ref_id) -> {row, tags[], links[], related_actions[], source?}
```
- `row`: the entity row.
- `tags`: joined `content_tags` → `tags` → `[{name, color}]`.
- `links`: joined `content_links`, target resolved to `{target_type, target_id, label}` (person name / topic name).
- `related_actions`: open/recent `actions` where `entity_type=ref_type AND entity_id=ref_id`.
- `source`: for signals, the resolved person/topic; omitted otherwise.
- `ref_type` in the same set `tag_content` accepts.

### `list_rows` — unchanged
Kept for skill back-compat. `query` is the power path.

### Whitelist changes
Add `person_handles`, `actions`, `guidance`, `content_tags`, `content_links` to the readable set (so `query` and targeting work).

## Section 2 — Outward (write + user-facing reach)

### Field-complete typed writers
Expand signatures to accept every schema column; dedup (`external_ref` ON CONFLICT), triggers, and validation unchanged.

| Tool | Added fields |
|---|---|
| `add_signal` | `who, what, when_rel, why, polarity, impact, person_id, topic_id, url, occurred_at, triage_rank` |
| `add_deadline` | `person_id, signal_id, visible` |
| `add_task` | `person_id, source_signal_id, board_column_id, status` |
| `add_learning` / `add_news` | audit against schema, fill any missing optional columns |
| `upsert_trend` | `sources, first_seen, last_seen` (`embedding` stays backend-only) |

### `add_alert` *(new)* — outward-to-user notification
```
add_alert(severity, title, body, url?, source_table?, source_id?) -> int
```
Inserts an `alerts` row (toast/push pipeline already consumes it). Fills the documented "raise alerts for priority ≤2" rule that had no tool.

### Actions — unchanged pipeline, add discoverability
`add_action` stays generic (any `action_type` + `payload`, `review`/`auto` mode, executor skills claim + run). The `review`/`auto` gate is the outward safety boundary — **not** loosened. Add `list_action_types() -> list[str]` (or embed the enum in the `add_action` docstring) so the LLM picks from the valid set.

### `update_status` — widen whitelist
Extend the updatable-table set to every status-bearing table. Current set is 6 (`signals, tasks, alerts, events, learning, critical_deadlines`); add `news_items` (has `status`). Note `trend_findings` has **no** `status` column — exclude it. Audit each table's schema before adding.

## Section 3 — Cross-cutting

### Safety
- `query`/`search` are read-only; the only SQL executed is a built SELECT/MATCH with **bound params** and whitelisted identifiers. No generic write path exists.
- `LIMIT` hard-capped; unknown identifiers rejected with `ValueError`.
- Bearer middleware + separate MCP container unchanged.

### Discoverability
- `list_skills() -> list[{name, description, schedule, last_run, active}]` *(new)* — mirrors `/api/skills` (reuse `lib/skills.list_skills` + `lib/skill_health.is_active`). Lets the LLM see what automation runs and when.
- `list_guidance(scope?)` already exists (LLM standing orders) — keep.
- Tool docstrings enumerate valid `action_types`, `ref_types`, `severities`, palette colors — capability is self-describing.

### Testing (per new/changed tool)
- Exposure: all new tools present in `list_tools()`.
- `query` safety: rejects non-whitelisted table; rejects non-whitelisted column/order; caps LIMIT; an injection attempt in a filter value returns no rows / errors (proves binding).
- `get_entity`: seeded row returns its tags + links + related actions.
- `search`: seeded FTS row is found.
- `add_alert`: inserts and is then readable via `query('alerts', ...)`.
- Field-complete writers: round-trip a fully-populated `add_signal` (all new fields persist).
- `list_skills`: returns roster with `active` health for a seeded `skill_runs`.

## Packaging / phases

One cohesive spec; implementation plan phased:

1. **P1 — Reads:** `query`, `search`, `get_entity`, whitelist extension.
2. **P2 — Writes:** field-complete writers, `add_alert`, `update_status` widen.
3. **P3 — Discoverability + cleanup:** `list_skills`, `list_action_types`, docstring enums.

Each phase ships with its tests green.

## Non-goals

- No generic write/upsert tool (loses per-entity dedup/validation).
- No raw-SQL tool (even read-only) — `query` covers the need with a smaller surface.
- No change to auth, container topology, or the action review/auto gate.
- No `embedding` exposure over MCP.
