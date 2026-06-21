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

    return mcp


def http_app(db_path, token):
    """Return the bearer-gated streamable-http ASGI app for this server."""
    app = build_server(db_path).streamable_http_app()
    app.add_middleware(BearerAuthMiddleware, token=token)
    return app


def main():  # pragma: no cover - process entry, not unit-tested
    import uvicorn
    conn = db.get_conn(db.DEFAULT_SCHEMA.with_name("ea.sqlite"))
    cfg = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM config")}
    conn.close()
    import os
    token = os.environ.get("EA_MCP_TOKEN", "dev-token")
    port = int(cfg.get("mcp_port", "8766"))
    uvicorn.run(http_app(db.DEFAULT_SCHEMA.with_name("ea.sqlite"), token),
                host="127.0.0.1", port=port)
