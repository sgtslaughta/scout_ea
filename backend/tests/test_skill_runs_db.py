from ea import db

def test_add_skill_run_records_audit(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    rid = db.add_skill_run(conn, "triage_email", items_created=3, note="ok")
    assert rid >= 1
    row = conn.execute("SELECT skill, items_created, status FROM skill_runs WHERE id=?", (rid,)).fetchone()
    assert row["skill"] == "triage_email"
    assert row["items_created"] == 3
    assert row["status"] == "ok"   # default
