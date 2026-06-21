from ea import db


def _conn(tmp_path):
    return db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)


def test_upsert_trend_insert_then_update(tmp_path):
    conn = _conn(tmp_path)
    rid = db.upsert_trend(conn, term="ai agents", kind="topic",
                          window_start="2026-06-14", window_end="2026-06-21",
                          score=1.0, count=3)
    assert rid >= 1
    # same term+window updates, does not duplicate
    rid2 = db.upsert_trend(conn, term="ai agents", kind="topic",
                           window_start="2026-06-14", window_end="2026-06-21",
                           score=2.5, count=7, delta="rising")
    assert rid2 == rid
    assert conn.execute("SELECT COUNT(*) FROM trends").fetchone()[0] == 1
    row = conn.execute("SELECT score, count, delta FROM trends WHERE id=?", (rid,)).fetchone()
    assert row["score"] == 2.5 and row["count"] == 7 and row["delta"] == "rising"


def test_list_trends_orders_by_score_desc(tmp_path):
    conn = _conn(tmp_path)
    db.upsert_trend(conn, term="low", kind="keyword",
                    window_start="w", window_end="w", score=0.5)
    db.upsert_trend(conn, term="high", kind="keyword",
                    window_start="w", window_end="w", score=9.0)
    rows = db.list_trends(conn, "w")
    assert [r["term"] for r in rows] == ["high", "low"]
