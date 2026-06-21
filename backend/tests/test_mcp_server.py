from mcp.server.fastmcp import FastMCP
from ea import db
from mcp_server import server


def test_build_server_returns_fastmcp(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    s = server.build_server(p)
    assert isinstance(s, FastMCP)


def test_http_app_builds_with_auth_mounted(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    app = server.http_app(p, token="secret")
    # BearerAuthMiddleware is present in the middleware stack
    names = [m.cls.__name__ for m in app.user_middleware]
    assert "BearerAuthMiddleware" in names


def test_tools_registered(tmp_path):
    import asyncio
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    s = server.build_server(p)
    loop = asyncio.new_event_loop()
    try:
        tool_names = {t.name for t in loop.run_until_complete(s.list_tools())}
        assert {"add_signal", "list_rows", "update_status", "add_deadline",
                "add_task", "log_skill_run"} <= tool_names
    finally:
        loop.close()
