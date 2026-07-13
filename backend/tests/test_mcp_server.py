from mcp.server.fastmcp import FastMCP
from ea import db
from mcp_server import server
import pytest


def test_runtime_params_requires_token():
    """_runtime_params must fail closed if EA_MCP_TOKEN is missing."""
    with pytest.raises(RuntimeError, match="EA_MCP_TOKEN"):
        server._runtime_params({})


def test_runtime_params_parses(tmp_path):
    """_runtime_params resolves db_path, token, port, host, skills_dir from environ."""
    p, t, port, host, skills_dir = server._runtime_params(
        {"EA_MCP_TOKEN": "x", "EA_DB_PATH": str(tmp_path / "d.sqlite"), "EA_MCP_PORT": "9001"})
    assert t == "x"
    assert port == 9001
    assert str(p).endswith("d.sqlite")
    assert host == "127.0.0.1"  # safe default
    assert skills_dir is None  # /app/skills doesn't exist in test


def test_runtime_params_host_override():
    """EA_MCP_HOST overrides the bind host (container needs 0.0.0.0)."""
    _, _, _, host, _ = server._runtime_params({"EA_MCP_TOKEN": "x", "EA_MCP_HOST": "0.0.0.0"})
    assert host == "0.0.0.0"


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
        assert {"add_signal", "list_rows", "query", "search", "get_entity", "update_status", "add_deadline",
                "add_task", "log_skill_run", "add_alert", "upsert_trend", "add_trend_finding",
                "m365_status", "m365_send_mail", "m365_create_event", "list_skills"} <= tool_names
    finally:
        loop.close()
