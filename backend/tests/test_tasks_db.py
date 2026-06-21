from ea import db

def test_add_task_returns_id_and_persists(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    tid = db.add_task(conn, title="Reply to budget thread", priority=2)
    assert tid >= 1
    row = conn.execute("SELECT title, status FROM tasks WHERE id=?", (tid,)).fetchone()
    assert row["title"] == "Reply to budget thread"
    assert row["status"] == "open"   # schema default
