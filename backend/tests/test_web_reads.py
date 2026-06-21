from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    db.upsert_signal(conn, type="email", source="outlook", external_ref="a",
                     title="Alpha", status="new")
    db.upsert_signal(conn, type="teams", source="teams", external_ref="b",
                     title="Bravo", status="dismissed")
    conn.close()
    return TestClient(create_app(p))


def test_signals_list_all(tmp_path):
    r = _client(tmp_path).get("/api/signals")
    assert r.status_code == 200
    titles = {row["title"] for row in r.json()}
    assert titles == {"Alpha", "Bravo"}


def test_signals_filter_status(tmp_path):
    r = _client(tmp_path).get("/api/signals", params={"status": "new"})
    body = r.json()
    assert [row["external_ref"] for row in body] == ["a"]


def test_other_tables_return_lists(tmp_path):
    c = _client(tmp_path)
    for path in ("/api/tasks", "/api/alerts", "/api/events"):
        r = c.get(path)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
