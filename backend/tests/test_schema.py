import sqlite3
from ea import db

EXPECTED_TABLES = {
    "people", "person_handles", "topics", "signals", "tasks",
    "alerts", "events", "learning", "config", "skill_runs",
}

def test_init_creates_all_tables(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite")
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()
    names = {r["name"] for r in rows}
    assert EXPECTED_TABLES <= names

def test_pragmas_on(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite")
    assert conn.execute("PRAGMA foreign_keys").fetchone()[0] == 1
    assert conn.execute("PRAGMA journal_mode").fetchone()[0].lower() == "wal"

def test_new_columns_present(tmp_path):
    # source_skill on signals/learning, notified_push on alerts (badge + web-push)
    conn = db.init_db(tmp_path / "ea.sqlite")
    sig = {r["name"] for r in conn.execute("PRAGMA table_info(signals)")}
    lrn = {r["name"] for r in conn.execute("PRAGMA table_info(learning)")}
    alt = {r["name"] for r in conn.execute("PRAGMA table_info(alerts)")}
    assert "source_skill" in sig
    assert "source_skill" in lrn
    assert "notified_push" in alt

def test_config_updated_at_touch(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite")
    conn.execute("INSERT INTO config(key, value, updated_at) VALUES ('k','v','2000-01-01T00:00:00')")
    conn.commit()
    conn.execute("UPDATE config SET value = 'v2' WHERE key = 'k'")
    conn.commit()
    row = conn.execute("SELECT updated_at FROM config WHERE key='k'").fetchone()
    assert row["updated_at"] != "2000-01-01T00:00:00"   # trigger refreshed it
