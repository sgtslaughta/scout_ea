from fastapi.testclient import TestClient
from ea import db
from web.app import create_app

def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    return TestClient(create_app(p))

def test_mcp_config_returns_url_and_token(tmp_path, monkeypatch):
    monkeypatch.setenv("EA_MCP_TOKEN", "abc123")
    monkeypatch.setenv("EA_MCP_PORT", "8766")
    r = _client(tmp_path).get("/api/mcp/config")
    assert r.status_code == 200
    body = r.json()
    assert body["url"].endswith(":8766/mcp")
    assert body["token"] == "abc123"
    assert body["configured"] is True

def test_mcp_config_unset_token(tmp_path, monkeypatch):
    monkeypatch.delenv("EA_MCP_TOKEN", raising=False)
    body = _client(tmp_path).get("/api/mcp/config").json()
    assert body["token"] == ""
    assert body["configured"] is False
