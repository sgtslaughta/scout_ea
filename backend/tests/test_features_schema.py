from ea import db

FEATURE_TABLES = {"critical_deadlines", "trends", "trend_findings"}
FEATURE_CONFIG = {"deadlines_visible_global", "outlook_send_time",
                  "trend_window_days", "embed_model"}


def test_feature_tables_created(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    names = {r["name"] for r in
             conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert FEATURE_TABLES <= names


def test_feature_config_seeded(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    keys = {r["key"] for r in conn.execute("SELECT key FROM config")}
    assert FEATURE_CONFIG <= keys


def test_trends_unique_term_window(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    conn.execute("INSERT INTO trends(term, kind, window_start, window_end) "
                 "VALUES ('ai','keyword','2026-06-14','2026-06-21')")
    conn.commit()
    # same term+window violates UNIQUE
    import sqlite3, pytest
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute("INSERT INTO trends(term, kind, window_start, window_end) "
                     "VALUES ('ai','keyword','2026-06-14','2026-06-21')")


def test_features_idempotent(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)  # re-apply
    n = conn.execute("SELECT COUNT(*) FROM config WHERE key='embed_model'").fetchone()[0]
    assert n == 1
