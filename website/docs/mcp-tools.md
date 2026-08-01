# MCP Tools

Skills call these **33 tools** over the bearer-gated MCP server (`:8766`). Tool schemas are
auto-derived from Python type hints and docstrings (FastMCP). Reads are SELECT-only against
whitelisted tables/columns; writes are field-complete and parameter-bound.

## Reads (11)

| Tool | Purpose |
|---|---|
| `list_rows` | List rows from a whitelisted table |
| `query` | Flexible whitelisted SELECT — filters / since / until / order / limit |
| `search` | Full-text search across indexed content (FTS5) |
| `get_entity` | A single row plus its tags, links, and related actions |
| `list_tags` | List existing tags (reuse before inventing) |
| `list_actions` | List outgoing actions by status |
| `list_guidance` | List standing guidance rows |
| `list_skills` | Skill roster plus per-skill cadence health |
| `list_action_types` | Self-describing catalogue of outward action types |
| `list_records` | List generic dashboard records by `kind` (see [Architecture](architecture.md)) |
| `has_open_action` | Check whether an open action already exists (dedupe) |

## Writes (19)

| Tool | Purpose |
|---|---|
| `add_signal` | Upsert a triaged signal (field-complete) |
| `add_deadline` | Upsert a critical deadline |
| `add_task` | Add a task |
| `add_learning` | Add a learning/training item |
| `add_news` | Add a news item |
| `add_event` | Draft a calendar event (dedup on external_ref) |
| `upsert_trend` | Upsert a trend (with sources) |
| `add_trend_finding` | Add a trend finding |
| `add_alert` | Raise a user-facing notification |
| `add_action` | Draft an outgoing action |
| `add_guidance` | Add standing guidance |
| `update_status` | Update a row's status |
| `update_action` | Write an action's result back |
| `update_event` | Update an event's status / external_ref |
| `claim_action` | Claim an approved action for execution |
| `upsert_record` | Upsert a generic dashboard record, deduped on `external_ref` — the write side of most dashboard tiles |
| `tag_content` | Attach 1–3 lowercase tags to a row |
| `link_content` | Link a row to a person or topic |
| `log_skill_run` | Record a skill run (always called, even on no-op) |

## M365 passthrough (3)

| Tool | Purpose |
|---|---|
| `m365_status` | Report Microsoft 365 MCP connectivity |
| `m365_send_mail` | Send mail via the connected M365 MCP |
| `m365_create_event` | Create a calendar event via the connected M365 MCP |

!!! note "Graceful degradation"
    The M365 tools no-op cleanly when `M365_MCP_URL` / `M365_MCP_TOKEN` are unset, so skills
    run end-to-end without a live Microsoft 365 connection.

## Safety model

- **Reads** are SELECT-only against a table/column whitelist; ranges and limits are bounded.
- **Writes** bind every value as a parameter — no string interpolation of user data.
- **Auth** is a constant-time bearer-token check on every MCP request.
