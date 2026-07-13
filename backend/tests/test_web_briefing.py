from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    db.add_deadline(conn, title="D", due_at="2099-01-01T17:00:00+00:00",
                    source="email", external_ref="d1")
    db.upsert_signal(conn, type="proactive", source="briefing", external_ref="p1",
                     title="renewal risk", status="new", polarity="risk")
    db.set_config(conn, "daily_summary", '{"date":"2026-07-12","text":"busy day"}')
    conn.close()
    return TestClient(create_app(p))


def test_briefing_endpoint_shape(tmp_path):
    body = _client(tmp_path).get("/api/briefing").json()
    assert "date" in body
    assert any(r["title"] == "renewal risk" for r in body["risks"])
    assert body["weather"] is None and body["finance"] is None
    assert "busy day" in (body["summary"] or "")


def test_outlook_still_works(tmp_path):
    body = _client(tmp_path).get("/api/outlook").json()
    assert "deadlines" in body and "proactive" in body
