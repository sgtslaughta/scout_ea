from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    db.add_deadline(conn, title="D", due_at="2099-01-01T17:00:00+00:00",
                    source="email", external_ref="d1")
    db.upsert_signal(conn, type="proactive", source="outlook", external_ref="p1",
                     title="send card", status="new")
    conn.close()
    return TestClient(create_app(p))


def test_outlook_endpoint(tmp_path):
    body = _client(tmp_path).get("/api/outlook").json()
    assert "date" in body
    assert body["deadlines"][0]["title"] == "D"
    assert body["deadlines"][0]["countdown_seconds"] > 0
    assert any(p["title"] == "send card" for p in body["proactive"])
