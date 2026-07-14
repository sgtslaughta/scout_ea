from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    return TestClient(create_app(p))


def test_status_null_before_any_call(tmp_path):
    c = _client(tmp_path)
    assert c.get("/api/mcp/status").json()["last_seen"] is None


def test_status_returns_stamp(tmp_path):
    c = _client(tmp_path)
    # mcp_last_seen is writable (Task 1), so this also exercises the whitelist
    c.post("/api/config/mcp_last_seen", json={"value": "2026-07-14T00:00:00+00:00"})
    assert c.get("/api/mcp/status").json()["last_seen"] == "2026-07-14T00:00:00+00:00"
