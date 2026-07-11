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
                   summary: str | None = None, priority: int = 3) -> int:
        """Add an inbound signal (email/teams/etc). Returns rowcount (1 new, 0 duplicate)."""
        conn = _conn()
        try:
            return tools.add_signal(conn, type=type, source=source, title=title,
                                    external_ref=external_ref, status=status,
                                    source_skill=source_skill, summary=summary, priority=priority)
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
