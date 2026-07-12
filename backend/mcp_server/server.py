"""MCP server exposing EA_DB tools over streamable-http, bearer-gated. Built on FastMCP."""
from __future__ import annotations
from mcp.server.fastmcp import FastMCP
from ea import db
from mcp_server import tools
from mcp_server.auth import BearerAuthMiddleware


def build_server(db_path) -> FastMCP:
    """Construct a FastMCP server whose tools read/write the EA_DB at db_path."""
    mcp = FastMCP("Scout EA")

    def _conn():
        return db.get_conn(db_path)

    @mcp.tool()
    def add_signal(type: str, source: str, title: str, external_ref: str,
                   status: str = "new", source_skill: str | None = None,
                   summary: str | None = None, priority: int = 3,
                   reasoning: str | None = None) -> int:
        """Add an inbound signal (email/teams/etc). Returns rowcount (1 new, 0 duplicate)."""
        conn = _conn()
        try:
            return tools.add_signal(conn, type=type, source=source, title=title,
                                    external_ref=external_ref, status=status,
                                    source_skill=source_skill, summary=summary, priority=priority,
                                    reasoning=reasoning)
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
                     source_skill: str | None = None) -> int:
        """Add a critical deadline (due_at = UTC ISO-8601). Returns rowcount."""
        conn = _conn()
        try:
            return tools.add_deadline(conn, title=title, due_at=due_at, source=source,
                                      external_ref=external_ref, detail=detail,
                                      priority=priority, source_skill=source_skill)
        finally:
            conn.close()

    @mcp.tool()
    def add_task(title: str, priority: int = 3, detail: str | None = None,
                 due_at: str | None = None) -> int:
        """Add an actionable task. Returns the new task id."""
        conn = _conn()
        try:
            fields = {"title": title, "priority": priority}
            if detail is not None:
                fields["detail"] = detail
            if due_at is not None:
                fields["due_at"] = due_at
            return tools.add_task(conn, **fields)
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
    def upsert_trend(term: str, kind: str, window_start: str, window_end: str,
                     score: float = 0, count: int = 0, delta: str | None = None) -> int:
        """Upsert a trend by term and window. Returns the trend id."""
        conn = _conn()
        try:
            return tools.upsert_trend(conn, term=term, kind=kind, window_start=window_start,
                                      window_end=window_end, score=score, count=count, delta=delta)
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

    return mcp


def http_app(db_path, token):
    """Return the bearer-gated streamable-http ASGI app for this server."""
    app = build_server(db_path).streamable_http_app()
    app.add_middleware(BearerAuthMiddleware, token=token)
    return app


def _runtime_params(environ):
    """Resolve (db_path, token, port) from the environment. Fails closed on missing token."""
    from pathlib import Path
    token = environ.get("EA_MCP_TOKEN")
    if not token:
        raise RuntimeError("EA_MCP_TOKEN environment variable is required")
    db_path = Path(environ.get("EA_DB_PATH", "ea.sqlite"))
    port = int(environ.get("EA_MCP_PORT", "8766"))
    # ponytail: default localhost-only; container sets 0.0.0.0 so Docker's
    # 127.0.0.1-published port can reach it. Bearer auth fails closed regardless.
    host = environ.get("EA_MCP_HOST", "127.0.0.1")
    return db_path, token, port, host


def main():  # pragma: no cover - process entry, not unit-tested
    import os
    import uvicorn
    db_path, token, port, host = _runtime_params(os.environ)
    uvicorn.run(http_app(db_path, token), host=host, port=port)


if __name__ == "__main__":
    main()
