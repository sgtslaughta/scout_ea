from ea import db

REQUIRED_CONFIG = {
    "tz", "work_hours", "work_days", "heartbeat_minutes",
    "priority_scale", "global_max_suggest", "web_port", "mcp_port",
}

def test_seed_loads_required_config(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    keys = {r["key"] for r in conn.execute("SELECT key FROM config")}
    assert REQUIRED_CONFIG <= keys

def test_seed_has_sample_person_and_topic(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    assert conn.execute("SELECT COUNT(*) FROM people").fetchone()[0] >= 1
    assert conn.execute("SELECT COUNT(*) FROM topics").fetchone()[0] >= 1

def test_seed_is_idempotent(tmp_path):
    # init twice -> no duplicate config rows (INSERT OR IGNORE on PK)
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    n = conn.execute("SELECT COUNT(*) FROM config WHERE key='tz'").fetchone()[0]
    assert n == 1

def test_seed_includes_feed_demo(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    assert db.list_news(conn) != []
    assert db.list_learning(conn) != []
    # the external tag resolves and is attached to news #1
    tags = db.list_tags_for(conn, "news", 1)
    assert any(t["name"] == "external" for t in tags)
