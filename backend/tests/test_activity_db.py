from ea import db

def test_list_skill_runs_newest_first(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    db.add_skill_run(conn, "triage_email", items_created=2)
    db.add_skill_run(conn, "compute_trends", items_created=5)
    rows = db.list_skill_runs(conn, limit=10)
    assert len(rows) == 2
    assert rows[0]["skill"] == "compute_trends"   # newest first
    assert rows[0]["items_created"] == 5
