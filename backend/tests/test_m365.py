import os
from mcp_server import m365


def test_not_configured(monkeypatch):
    """When M365_MCP_URL is unset, call returns not_configured status."""
    monkeypatch.delenv("M365_MCP_URL", raising=False)
    assert m365.configured() is False
    r = m365.call("send_mail", {"to": "a@b.com"})
    assert r["status"] == "not_configured"


def test_configured_forwards(monkeypatch):
    """When M365_MCP_URL is set, call forwards action+params and returns response."""
    monkeypatch.setenv("M365_MCP_URL", "https://m365.example.com")
    monkeypatch.setenv("M365_MCP_TOKEN", "tok")
    captured = {}

    class FakeResp:
        def raise_for_status(self):
            pass

        def json(self):
            return {"status": "ok", "id": "evt1"}

    def fake_post(url, json=None, headers=None, timeout=None):
        captured.update(url=url, json=json, headers=headers)
        return FakeResp()

    import httpx
    monkeypatch.setattr(httpx, "post", fake_post)
    r = m365.call("create_event", {"title": "Sync"})
    assert r == {"status": "ok", "id": "evt1"}
    assert captured["url"].endswith("/action")
    assert captured["json"]["action"] == "create_event"
    assert captured["headers"]["Authorization"] == "Bearer tok"


def test_upstream_error_graceful(monkeypatch):
    """When upstream M365 MCP fails, return error status instead of crashing."""
    monkeypatch.setenv("M365_MCP_URL", "https://m365.example.com")
    import httpx
    def boom(*a, **k):
        raise httpx.ConnectError("down")
    monkeypatch.setattr(httpx, "post", boom)
    r = m365.call("send_mail", {"to": "x"})
    assert r["status"] == "error"
