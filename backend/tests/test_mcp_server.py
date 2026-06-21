from mcp.server.fastmcp import FastMCP
from ea import db
from mcp_server import server
import pytest


def test_runtime_params_requires_token():
    """_runtime_params must fail closed if EA_MCP_TOKEN is missing."""
    with pytest.raises(RuntimeError, match="EA_MCP_TOKEN"):
        server._runtime_params({})


def test_runtime_params_parses(tmp_path):
    """_runtime_params resolves db_path, token, port from environ."""
    p, t, port = server._runtime_params(
        {"EA_MCP_TOKEN": "x", "EA_DB_PATH": str(tmp_path / "d.sqlite"), "EA_MCP_PORT": "9001"})
    assert t == "x"
    assert port == 9001
    assert str(p).endswith("d.sqlite")


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
                "add_task", "log_skill_run", "upsert_trend", "add_trend_finding"} <= tool_names
    finally:
        loop.close()
