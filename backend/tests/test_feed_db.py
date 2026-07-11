import pytest
from ea import db


def _conn(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    # Clear seed demo feed rows (keep people/topics/config)
    conn.executescript(
        "DELETE FROM content_links; DELETE FROM content_tags; DELETE FROM tags; "
        "DELETE FROM news_items; DELETE FROM learning;"
    )
    return conn


def test_add_and_list_news(tmp_path):
    conn = _conn(tmp_path)
    assert db.add_news_item(conn, title="AI news", url="http://x/1", external_ref="http://x/1",
                            topic_id=1, event_at="2026-07-10T09:00:00", status="new") == 1
    assert db.add_news_item(conn, title="dup", url="http://x/1", external_ref="http://x/1") == 0  # dedup
    rows = db.list_news(conn)
    assert [r["title"] for r in rows] == ["AI news"]
    assert db.list_news(conn, status="archived") == []
    assert [r["title"] for r in db.list_news(conn, topic_id=1)] == ["AI news"]


def test_add_news_requires_external_ref_and_guards_columns(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError, match="external_ref"):
        db.add_news_item(conn, title="x")
    with pytest.raises(ValueError, match="unknown"):
        db.add_news_item(conn, title="x", external_ref="e", bogus_col=1)


def test_add_and_list_learning(tmp_path):
    conn = _conn(tmp_path)
    assert db.add_learning(conn, kind="course", title="K8s 101", external_ref="l1",
                           source="email", topic_id=1, event_at="2026-07-09T00:00:00") == 1
    assert db.add_learning(conn, kind="course", title="dup", external_ref="l1", source="email") == 0
    rows = db.list_learning(conn)
    assert [r["title"] for r in rows] == ["K8s 101"]
    with pytest.raises(ValueError):
        db.add_learning(conn, kind="x", title="y", external_ref="l2", nope=1)


def test_news_registered_for_status_updates(tmp_path):
    conn = _conn(tmp_path)
    db.add_news_item(conn, title="n", url="u", external_ref="u")
    nid = db.list_news(conn)[0]["id"]
    assert db.update_status(conn, "news_items", nid, "read") == 1
    assert db.list_news(conn, status="read")[0]["id"] == nid


def test_tag_id_by_name(tmp_path):
    conn = _conn(tmp_path)
    tid = db.get_or_create_tag(conn, "external", "blue")
    assert db.tag_id_by_name(conn, "external") == tid
    assert db.tag_id_by_name(conn, "nope") is None
