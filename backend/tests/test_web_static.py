from fastapi.testclient import TestClient
from ea import db
from web.app import create_app

def test_no_static_dir_api_still_works(tmp_path):
    p = tmp_path / "ea.sqlite"; db.init_db(p, seed_path=db.DEFAULT_SEED)
    c = TestClient(create_app(p))
    assert c.get("/api/health").json() == {"status": "ok"}

def test_static_index_served(tmp_path):
    p = tmp_path / "ea.sqlite"; db.init_db(p, seed_path=db.DEFAULT_SEED)
    static = tmp_path / "dist"; static.mkdir()
    (static / "index.html").write_text("<!doctype html><title>Scout</title>")
    c = TestClient(create_app(p, static_dir=static))
    assert c.get("/api/health").status_code == 200          # api still wins
    r = c.get("/")
    assert r.status_code == 200 and "Scout" in r.text
