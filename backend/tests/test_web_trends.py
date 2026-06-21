from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    db.upsert_trend(conn, term="old", kind="keyword",
                    window_start="2026-06-07", window_end="2026-06-14", score=1.0)
    db.upsert_trend(conn, term="newA", kind="keyword",
                    window_start="2026-06-14", window_end="2026-06-21", score=2.0)
    db.upsert_trend(conn, term="newB", kind="keyword",
                    window_start="2026-06-14", window_end="2026-06-21", score=5.0)
    conn.close()
    return TestClient(create_app(p))


def test_trends_latest_window_default(tmp_path):
    body = _client(tmp_path).get("/api/trends").json()
    # latest window is 2026-06-14; ranked by score desc
    assert [t["term"] for t in body] == ["newB", "newA"]


def test_trends_explicit_window(tmp_path):
    body = _client(tmp_path).get("/api/trends", params={"window_start": "2026-06-07"}).json()
    assert [t["term"] for t in body] == ["old"]


def test_trends_empty_when_none(tmp_path):
    p = tmp_path / "empty.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    assert TestClient(create_app(p)).get("/api/trends").json() == []
