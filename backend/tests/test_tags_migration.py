import sqlite3
from ea import db


def test_migrate_moves_deadline_tags_and_links(tmp_path):
    p = tmp_path / "ea.sqlite"
    # Build a DB that still has the OLD deadline tables with data, as a pre-migration DB would.
    # Use get_conn + manual schema instead of init_db to avoid early migration run
    conn = db.get_conn(p)
    conn.executescript(db.DEFAULT_SCHEMA.read_text())
    conn.executescript(db.DEFAULT_FEATURES.read_text())
    conn.executescript(db.DEFAULT_SEED.read_text())

    # Manually insert old deadline tables (as if from pre-migration DB)
    conn.executescript("""
      CREATE TABLE IF NOT EXISTS deadline_tags (id INTEGER PRIMARY KEY AUTOINCREMENT, deadline_id INTEGER, tag TEXT, UNIQUE(deadline_id, tag));
      CREATE TABLE IF NOT EXISTS deadline_links (id INTEGER PRIMARY KEY AUTOINCREMENT, deadline_id INTEGER, ref_type TEXT, ref_id INTEGER, UNIQUE(deadline_id, ref_type, ref_id));
      CREATE INDEX IF NOT EXISTS idx_deadline_tags ON deadline_tags(deadline_id);
      CREATE INDEX IF NOT EXISTS idx_deadline_links ON deadline_links(deadline_id);
    """)

    # Insert test data
    conn.execute(
        "INSERT INTO critical_deadlines (title, due_at, source, external_ref) "
        "VALUES (?, ?, ?, ?)",
        ("Ship", "2099-01-01T00:00:00+00:00", "manual", "test-1")
    )
    did = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.execute("INSERT INTO deadline_tags (deadline_id, tag) VALUES (?, ?)", (did, "q3"))
    conn.execute("INSERT INTO people (name) VALUES (?)", ("Ada",))
    pid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.execute("INSERT INTO deadline_links (deadline_id, ref_type, ref_id) VALUES (?, ?, ?)", (did, "person", pid))
    conn.commit()

    # Now run the migration
    db._migrate(conn)

    tags = db.list_tags_for(conn, "deadline", did)
    links = db.list_links_for(conn, "deadline", did)
    assert [t["name"] for t in tags] == ["q3"]
    assert links[0]["target_type"] == "person" and links[0]["label"] == "Ada"
    # old tables dropped
    got = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('deadline_tags','deadline_links')").fetchall()
    assert got == []
    # re-run is a no-op (no duplicates, no crash)
    db._migrate(conn)
    assert len(db.list_tags_for(conn, "deadline", did)) == 1
