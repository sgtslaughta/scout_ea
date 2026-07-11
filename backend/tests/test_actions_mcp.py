"""Tests for action and guidance MCP tools."""
import asyncio
from ea import db
from mcp_server import server


def test_action_tools_registered(tmp_path):
    """Verify that all action/guidance MCP tools are registered."""
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    s = server.build_server(p)
    loop = asyncio.new_event_loop()
    try:
        tool_names = {t.name for t in loop.run_until_complete(s.list_tools())}
        assert {"add_action", "list_actions", "update_action", "claim_action",
                "has_open_action", "add_guidance", "list_guidance"} <= tool_names
    finally:
        loop.close()
