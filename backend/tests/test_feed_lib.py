from ea import db
from lib import feed


def _conn(tmp_path):
    return db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)


def test_overview_counts_and_recent(tmp_path):
    conn = _conn(tmp_path)
    db.add_news_item(conn, title="N1", url="u1", external_ref="u1", event_at="2026-07-10T00:00:00")
    db.add_learning(conn, kind="course", title="L1", external_ref="l1", source="email", event_at="2026-07-11T00:00:00")
    ov = feed.overview(conn)
    assert ov["counts"]["news"] == 1 and ov["counts"]["learning"] == 1
    assert ov["counts"]["topics"] == 1  # seed has 1 active topic
    # recent newest-first: L1 (07-11) before N1 (07-10); each has tags/links keys
    titles = [r["title"] for r in ov["recent"]]
    assert titles[:2] == ["L1", "N1"]
    assert "tags" in ov["recent"][0] and "links" in ov["recent"][0]
    assert ov["recent"][0]["category"] == "learning"


def test_filter_ids_by_tag_origin_person(tmp_path):
    conn = _conn(tmp_path)
    db.add_news_item(conn, title="N1", url="u1", external_ref="u1")
    db.add_news_item(conn, title="N2", url="u2", external_ref="u2")
    ids = [r["id"] for r in db.list_news(conn)]
    a, b = min(ids), max(ids)
    db.tag_content(conn, "news", a, "external")
    db.link_content(conn, "news", a, "person", 1)
    assert feed.filter_ids(conn, "news", tag=None, origin=None, person=None) is None
    assert feed.filter_ids(conn, "news", origin="external") == {a}
    assert feed.filter_ids(conn, "news", person=1) == {a}
    # intersection: tag external AND person 1 both on `a`
    assert feed.filter_ids(conn, "news", origin="external", person=1) == {a}
    # unknown tag name -> empty set (no matches), not None
    assert feed.filter_ids(conn, "news", tag="ghost") == set()
