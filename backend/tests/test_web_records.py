from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    return TestClient(create_app(p))


def test_create_and_list_records(tmp_path):
    c = _client(tmp_path)
    resp = c.post("/api/records", json={"kind": "ebc", "external_ref": "e1", "data": {"a": 1}})
    assert resp.status_code == 200
    rid = resp.json()["id"]
    assert rid > 0

    rows = c.get("/api/records", params={"kind": "ebc"}).json()
    assert len(rows) == 1
    assert rows[0]["id"] == rid
    assert rows[0]["data"] == {"a": 1}


def test_list_records_unknown_kind_returns_empty_list(tmp_path):
    c = _client(tmp_path)
    resp = c.get("/api/records", params={"kind": "nope"})
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_records_filters_by_status(tmp_path):
    c = _client(tmp_path)
    c.post("/api/records", json={"kind": "pipeline", "external_ref": "p1", "data": {},
                                  "status": "active"})
    c.post("/api/records", json={"kind": "pipeline", "external_ref": "p2", "data": {},
                                  "status": "archived"})
    active = c.get("/api/records", params={"kind": "pipeline", "status": "active"}).json()
    assert len(active) == 1
    assert active[0]["external_ref"] == "p1"
