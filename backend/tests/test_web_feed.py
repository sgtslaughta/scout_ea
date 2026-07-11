from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    # Clear seed demo feed rows (keep people/topics/config)
    conn.executescript(
        "DELETE FROM content_links; DELETE FROM content_tags; DELETE FROM tags; "
        "DELETE FROM news_items; DELETE FROM learning;"
    )
    db.add_news_item(conn, title="N1", url="u1", external_ref="u1", topic_id=1, event_at="2026-07-10T00:00:00")
    db.add_news_item(conn, title="N2", url="u2", external_ref="u2")
    nid = next(r["id"] for r in db.list_news(conn) if r["external_ref"] == "u1")  # N1 (dated, topic 1)
    db.tag_content(conn, "news", nid, "external")
    db.link_content(conn, "news", nid, "person", 1)
    db.add_learning(conn, kind="course", title="L1", external_ref="l1", topic_id=1, source="internal")
    return TestClient(create_app(p)), nid


def test_feed_overview(tmp_path):
    c, _ = _client(tmp_path)
    ov = c.get("/api/feed").json()
    assert ov["counts"]["news"] == 2 and ov["counts"]["learning"] == 1
    assert isinstance(ov["recent"], list) and "tags" in ov["recent"][0]


def test_news_list_and_filters(tmp_path):
    c, nid = _client(tmp_path)
    alln = c.get("/api/news").json()
    assert len(alln) == 2 and "tags" in alln[0]
    assert [r["id"] for r in c.get("/api/news?origin=external").json()] == [nid]
    assert [r["id"] for r in c.get("/api/news?person=1").json()] == [nid]
    assert [r["id"] for r in c.get("/api/news?topic=1").json()] == [nid]  # only N1 has topic_id=1
    assert c.get("/api/news?tag=ghost").json() == []


def test_learning_list(tmp_path):
    c, _ = _client(tmp_path)
    rows = c.get("/api/learning").json()
    assert [r["title"] for r in rows] == ["L1"] and "links" in rows[0]


def test_news_status_via_generic_endpoint(tmp_path):
    c, nid = _client(tmp_path)
    assert c.post(f"/api/news_items/{nid}/status", json={"status": "read"}).json() == {"updated": 1}
    assert [r["id"] for r in c.get("/api/news?status=read").json()] == [nid]


def test_news_bad_topic_param_is_422(tmp_path):
    c, _ = _client(tmp_path)
    assert c.get("/api/news?topic=abc").status_code == 422
