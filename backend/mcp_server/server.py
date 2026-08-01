"""MCP server exposing EA_DB tools over streamable-http, bearer-gated. Built on MCPServer."""
from __future__ import annotations
from mcp.server.mcpserver import MCPServer
from ea import db
from mcp_server import tools
from mcp_server.auth import BearerAuthMiddleware


def build_server(db_path, skills_dir=None) -> MCPServer:
    """Construct an MCP server whose tools read/write the EA_DB at db_path."""
    mcp = MCPServer("Scout EA")

    def _conn():
        return db.get_conn(db_path)

    @mcp.tool()
    def add_signal(type: str, source: str, title: str, external_ref: str,
                   status: str = "new", source_skill: str | None = None,
                   summary: str | None = None, priority: int = 3,
                   reasoning: str | None = None, who: str | None = None,
                   what: str | None = None, when_rel: str | None = None,
                   why: str | None = None, polarity: str | None = None,
                   impact: int | None = None, person_id: int | None = None,
                   topic_id: int | None = None, url: str | None = None,
                   occurred_at: str | None = None,
                   triage_rank: int | None = None) -> int:
        """Add an inbound signal (email/teams/etc), dedup on external_ref. Returns
        rowcount (1 new, 0 duplicate). polarity in risk|opportunity|neutral;
        impact is a 0-100 briefing score; who/what/when_rel/why are the structured
        summary; occurred_at is UTC ISO-8601."""
        conn = _conn()
        try:
            fields = {"type": type, "source": source, "title": title,
                      "external_ref": external_ref, "status": status, "priority": priority}
            for k, v in (("source_skill", source_skill), ("summary", summary),
                         ("reasoning", reasoning), ("who", who), ("what", what),
                         ("when_rel", when_rel), ("why", why), ("polarity", polarity),
                         ("impact", impact), ("person_id", person_id),
                         ("topic_id", topic_id), ("url", url),
                         ("occurred_at", occurred_at), ("triage_rank", triage_rank)):
                if v is not None:
                    fields[k] = v
            return tools.add_signal(conn, **fields)
        finally:
            conn.close()

    @mcp.tool()
    def list_rows(table: str, status: str | None = None) -> list[dict]:
        """List rows from a whitelisted table, optionally filtered by status."""
        conn = _conn()
        try:
            return tools.list_table(conn, table, status=status)
        finally:
            conn.close()

    @mcp.tool()
    def query(table: str, filters: dict | None = None, since: str | None = None,
              until: str | None = None, order: str | None = None,
              limit: int = 50) -> list[dict]:
        """Read-only SELECT over a whitelisted table. filters is {col: value} for
        equality or {col: {"op": OP, "value": v}} with OP in =,!=,<,<=,>,>=,in.
        since/until bound a date column (created_at, or ran_at/window_start).
        order is 'col' or 'col desc'. limit capped at 200. Queryable tables:
        signals, tasks, alerts, events, learning, news_items, critical_deadlines,
        trends, trend_findings, people, person_handles, topics, config, actions,
        guidance, content_tags, content_links, skill_runs, board_columns."""
        conn = _conn()
        try:
            return tools.query(conn, table, filters=filters, since=since,
                               until=until, order=order, limit=limit)
        finally:
            conn.close()

    @mcp.tool()
    def search(q: str, limit: int = 20) -> list[dict]:
        """Full-text search across signals, tasks, deadlines, events, people,
        topics, trends. Returns [{kind, ref_id, title, snippet}] ranked by
        relevance. Use get_entity(kind, ref_id) to expand a hit. limit capped 50."""
        conn = _conn()
        try:
            return tools.search(conn, q, limit=limit)
        finally:
            conn.close()

    @mcp.tool()
    def get_entity(ref_type: str, ref_id: int) -> dict | None:
        """Full context for one entity in a single call: the row plus its tags,
        links (person/topic with resolved labels), and its related actions (any status).
        ref_type in signal|task|deadline|event|trend|trend_finding|learning|news|
        person|topic. Returns null if not found."""
        conn = _conn()
        try:
            return tools.get_entity(conn, ref_type, ref_id)
        finally:
            conn.close()

    @mcp.tool()
    def update_status(table: str, row_id: int, status: str) -> int:
        """Set status on a whitelisted table row. Returns rows affected."""
        conn = _conn()
        try:
            return tools.update_status(conn, table, row_id, status)
        finally:
            conn.close()

    @mcp.tool()
    def add_deadline(title: str, due_at: str, source: str, external_ref: str,
                     detail: str | None = None, priority: int = 2,
                     source_skill: str | None = None, person_id: int | None = None,
                     signal_id: int | None = None, visible: int | None = None) -> int:
        """Add a critical deadline (due_at = UTC ISO-8601), dedup on external_ref.
        visible=0 hides it from the deadline strip. Returns rowcount."""
        conn = _conn()
        try:
            fields = {"title": title, "due_at": due_at, "source": source,
                      "external_ref": external_ref, "priority": priority}
            for k, v in (("detail", detail), ("source_skill", source_skill),
                         ("person_id", person_id), ("signal_id", signal_id),
                         ("visible", visible)):
                if v is not None:
                    fields[k] = v
            return tools.add_deadline(conn, **fields)
        finally:
            conn.close()

    @mcp.tool()
    def add_task(title: str, priority: int = 3, detail: str | None = None,
                 due_at: str | None = None, status: str | None = None,
                 person_id: int | None = None, source_signal_id: int | None = None,
                 board_column_id: int | None = None) -> int:
        """Add an actionable task. status defaults to the table default ('open').
        source_signal_id links the task to the signal that spawned it. Returns id."""
        conn = _conn()
        try:
            fields = {"title": title, "priority": priority}
            for k, v in (("detail", detail), ("due_at", due_at), ("status", status),
                         ("person_id", person_id), ("source_signal_id", source_signal_id),
                         ("board_column_id", board_column_id)):
                if v is not None:
                    fields[k] = v
            return tools.add_task(conn, **fields)
        finally:
            conn.close()

    @mcp.tool()
    def upsert_record(kind: str, external_ref: str, data: dict,
                      status: str = "active", sort: int = 0) -> int:
        """Upsert a generic dashboard record, dedup on external_ref. kind is one of
        email|chat|qtr_event|ou_feedback|territory|ebc|revops|pipeline. data is an
        arbitrary JSON object whose shape is owned by the consuming dashboard tile.
        Returns the row id."""
        conn = _conn()
        try:
            return tools.upsert_record(conn, kind=kind, external_ref=external_ref,
                                       data=data, status=status, sort=sort)
        finally:
            conn.close()

    @mcp.tool()
    def list_records(kind: str, status: str | None = None) -> list[dict]:
        """List dashboard records for a kind (email|chat|qtr_event|ou_feedback|
        territory|ebc|revops|pipeline), optionally filtered by status. Ordered by
        sort then id."""
        conn = _conn()
        try:
            return tools.list_records(conn, kind, status=status)
        finally:
            conn.close()

    @mcp.tool()
    def log_skill_run(skill: str, items_created: int = 0, status: str = "ok",
                      note: str | None = None) -> int:
        """Record a skill run (audit + lookback anchor). Returns the new id."""
        conn = _conn()
        try:
            return tools.log_skill_run(conn, skill, items_created=items_created,
                                       status=status, note=note)
        finally:
            conn.close()

    @mcp.tool()
    def add_alert(severity: str, title: str, body: str, url: str | None = None,
                  source_table: str | None = None, source_id: int | None = None) -> int:
        """Raise a user-facing alert (drives toast + web push). severity in
        info|warning|critical. url is an optional in-app deep link. source_table/
        source_id point back at the originating row. Returns the new alert id."""
        conn = _conn()
        try:
            fields = {"severity": severity, "title": title, "body": body}
            for k, v in (("url", url), ("source_table", source_table),
                         ("source_id", source_id)):
                if v is not None:
                    fields[k] = v
            return tools.add_alert(conn, **fields)
        finally:
            conn.close()

    @mcp.tool()
    def add_event(title: str, body: str = "", proposed_times: str = "",
                  chosen_time: str = "", attendees: str = "", status: str = "suggested",
                  source_signal_id: int | None = None, external_ref: str | None = None) -> int:
        """Create an event. title is required. status defaults to 'suggested'.
        Dedupes on external_ref if provided. Returns the new event id."""
        conn = _conn()
        try:
            fields = {"title": title, "status": status}
            for k, v in (("body", body), ("proposed_times", proposed_times),
                         ("chosen_time", chosen_time), ("attendees", attendees),
                         ("source_signal_id", source_signal_id), ("external_ref", external_ref)):
                if v:
                    fields[k] = v
            return tools.add_event(conn, **fields)
        finally:
            conn.close()

    @mcp.tool()
    def update_event(event_id: int, status: str = "", external_ref: str = "",
                     chosen_time: str = "") -> int:
        """Update an event row. Pass only the fields you want to change. Returns rows affected."""
        conn = _conn()
        try:
            fields = {}
            for k, v in (("status", status), ("external_ref", external_ref),
                         ("chosen_time", chosen_time)):
                if v:
                    fields[k] = v
            return tools.update_event(conn, event_id, **fields)
        finally:
            conn.close()

    @mcp.tool()
    def upsert_trend(term: str, kind: str, window_start: str, window_end: str,
                     score: float = 0, count: int = 0, delta: str | None = None,
                     sources: str | None = None) -> int:
        """Upsert a trend by (term, window_start). sources is a freeform provenance
        string (e.g. 'signal:1,signal:2'). Returns the trend id."""
        conn = _conn()
        try:
            return tools.upsert_trend(conn, term=term, kind=kind,
                                      window_start=window_start, window_end=window_end,
                                      score=score, count=count, delta=delta, sources=sources)
        finally:
            conn.close()

    @mcp.tool()
    def add_trend_finding(title: str, url: str, external_ref: str,
                         synopsis: str | None = None, source: str | None = None,
                         relevance: int | None = None, trend_id: int | None = None,
                         topic_id: int | None = None) -> int:
        """Add a trend finding with dedup on external_ref. Returns rowcount."""
        conn = _conn()
        try:
            fields = {"title": title, "url": url, "external_ref": external_ref}
            if synopsis is not None:
                fields["synopsis"] = synopsis
            if source is not None:
                fields["source"] = source
            if relevance is not None:
                fields["relevance"] = relevance
            if trend_id is not None:
                fields["trend_id"] = trend_id
            if topic_id is not None:
                fields["topic_id"] = topic_id
            return tools.add_trend_finding(conn, **fields)
        finally:
            conn.close()

    @mcp.tool()
    def tag_content(ref_type: str, ref_id: int, tag: str, color: str = "neutral") -> int:
        """Attach a label tag to a content row. ref_type in deadline|task|signal|event|trend|
        trend_finding|learning|news|person|topic. color is a palette key. Returns rowcount."""
        conn = _conn()
        try:
            return tools.tag_content(conn, ref_type, ref_id, tag, color)
        finally:
            conn.close()

    @mcp.tool()
    def link_content(ref_type: str, ref_id: int, target_type: str, target_id: int) -> int:
        """Link a content row to a person or topic (target_type in person|topic). Returns rowcount."""
        conn = _conn()
        try:
            return tools.link_content(conn, ref_type, ref_id, target_type, target_id)
        finally:
            conn.close()

    @mcp.tool()
    def list_tags() -> list[dict]:
        """List all known tags [{id,name,color}]. Call before inventing a new tag name."""
        conn = _conn()
        try:
            return tools.list_tags(conn)
        finally:
            conn.close()

    @mcp.tool()
    def add_learning(kind: str, title: str, external_ref: str, source: str = "skill",
                     synopsis: str | None = None, url: str | None = None,
                     provider: str | None = None, event_at: str | None = None,
                     topic_id: int | None = None, relevance: int | None = None,
                     status: str = "suggested", source_skill: str | None = None) -> int:
        """Add a learning/training item, dedup on external_ref. Returns rowcount."""
        conn = _conn()
        try:
            fields = {"kind": kind, "title": title, "external_ref": external_ref, "source": source, "status": status}
            for k, v in (("synopsis", synopsis), ("url", url), ("provider", provider),
                         ("event_at", event_at), ("topic_id", topic_id), ("relevance", relevance),
                         ("source_skill", source_skill)):
                if v is not None:
                    fields[k] = v
            return tools.add_learning(conn, **fields)
        finally:
            conn.close()

    @mcp.tool()
    def add_news(title: str, external_ref: str, url: str | None = None, synopsis: str | None = None,
                 topic_id: int | None = None, source: str = "web", source_skill: str | None = None,
                 event_at: str | None = None, relevance: int | None = None, status: str = "new") -> int:
        """Add a news item, dedup on external_ref (usually the url). Returns rowcount."""
        conn = _conn()
        try:
            fields = {"title": title, "external_ref": external_ref, "source": source, "status": status}
            for k, v in (("url", url), ("synopsis", synopsis), ("topic_id", topic_id),
                         ("source_skill", source_skill), ("event_at", event_at), ("relevance", relevance)):
                if v is not None:
                    fields[k] = v
            return tools.add_news(conn, **fields)
        finally:
            conn.close()

    @mcp.tool()
    def m365_status() -> dict:
        """Whether M365 actions are enabled (an external M365 MCP is configured)."""
        from mcp_server import m365
        return {"configured": m365.configured()}

    @mcp.tool()
    def m365_send_mail(to: str, subject: str, body: str) -> dict:
        """Send an email via the connected Microsoft 365 account (if configured)."""
        from mcp_server import m365
        return m365.call("send_mail", {"to": to, "subject": subject, "body": body})

    @mcp.tool()
    def m365_create_event(title: str, start: str, end: str | None = None,
                          attendees: str | None = None) -> dict:
        """Create a calendar event via the connected Microsoft 365 account (if configured)."""
        from mcp_server import m365
        return m365.call("create_event",
                         {"title": title, "start": start, "end": end, "attendees": attendees})

    @mcp.tool()
    def add_action(action_type: str, entity_type: str | None = None,
                   entity_id: int | None = None, mode: str = "review",
                   payload: dict | None = None, rationale: str | None = None,
                   created_by: str = "skill") -> int:
        """Draft an outgoing action. mode 'review' needs approval; 'auto' runs unattended.
        Returns the new action id."""
        conn = _conn()
        try:
            return tools.add_action(conn, action_type=action_type, entity_type=entity_type,
                                    entity_id=entity_id, mode=mode, payload=payload,
                                    rationale=rationale, created_by=created_by)
        finally:
            conn.close()

    @mcp.tool()
    def list_action_types() -> list[str]:
        """Valid action_type values for add_action, e.g. email_reply, teams_dm,
        calendar_invite, status_set, cowork_doc. Call before drafting an action."""
        return tools.list_action_types()

    @mcp.tool()
    def list_actions(status: str | None = None, mode: str | None = None) -> list[dict]:
        """List actions (optionally by status/mode), newest first."""
        conn = _conn()
        try:
            return tools.list_actions(conn, status=status, mode=mode)
        finally:
            conn.close()

    @mcp.tool()
    def update_action(action_id: int, status: str | None = None,
                      result: dict | None = None, error: str | None = None) -> int:
        """Write back an action's status/result/error. Returns rows affected."""
        conn = _conn()
        try:
            return tools.update_action(conn, action_id, status=status, result=result, error=error)
        finally:
            conn.close()

    @mcp.tool()
    def claim_action(action_id: int) -> bool:
        """Atomically claim an action for execution (approved, or auto+drafted).
        Returns True iff this caller won the claim."""
        conn = _conn()
        try:
            return tools.claim_action(conn, action_id)
        finally:
            conn.close()

    @mcp.tool()
    def has_open_action(entity_type: str, entity_id: int, action_type: str) -> bool:
        """True if an equivalent action is open or was completed in the last 24h (dedup guard)."""
        conn = _conn()
        try:
            return tools.has_open_action(conn, entity_type, entity_id, action_type)
        finally:
            conn.close()

    @mcp.tool()
    def add_guidance(scope: str, text: str) -> int:
        """Store user guidance for a scope (e.g. 'topic:AI', 'person:5', 'global'). Returns id."""
        conn = _conn()
        try:
            return tools.add_guidance(conn, scope, text)
        finally:
            conn.close()

    @mcp.tool()
    def list_guidance(scope: str | None = None) -> list[dict]:
        """List guidance; if scope given, returns that scope plus 'global'."""
        conn = _conn()
        try:
            return tools.list_guidance(conn, scope=scope)
        finally:
            conn.close()

    @mcp.tool()
    def list_skills() -> list[dict]:
        """List the automation skills Scout runs: [{name, description, schedule,
        last_run, active}]. active=False means the skill is overdue for its cadence."""
        conn = _conn()
        try:
            return tools.list_skills(conn, skills_dir)
        finally:
            conn.close()

    return mcp


def http_app(db_path, token, skills_dir=None):
    """Return the bearer-gated streamable-http ASGI app for this server."""
    app = build_server(db_path, skills_dir=skills_dir).streamable_http_app()
    app.add_middleware(BearerAuthMiddleware, token=token, db_path=db_path)
    return app


def _runtime_params(environ):
    """Resolve (db_path, token, port, host, skills_dir) from the environment. Fails closed on missing token."""
    from pathlib import Path as _P
    token = environ.get("EA_MCP_TOKEN")
    if not token:
        raise RuntimeError("EA_MCP_TOKEN environment variable is required")
    db_path = _P(environ.get("EA_DB_PATH", "ea.sqlite"))
    port = int(environ.get("EA_MCP_PORT", "8766"))
    # ponytail: default localhost-only; container sets 0.0.0.0 so Docker's
    # 127.0.0.1-published port can reach it. Bearer auth fails closed regardless.
    host = environ.get("EA_MCP_HOST", "127.0.0.1")
    skills_dir = environ.get("SKILLS_DIR", "/app/skills")
    skills_dir = skills_dir if _P(skills_dir).is_dir() else None
    return db_path, token, port, host, skills_dir


def main():  # pragma: no cover - process entry, not unit-tested
    import os
    import uvicorn
    db_path, token, port, host, skills_dir = _runtime_params(os.environ)
    uvicorn.run(http_app(db_path, token, skills_dir=skills_dir), host=host, port=port)


if __name__ == "__main__":
    main()
