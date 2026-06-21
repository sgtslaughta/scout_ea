from ea import init_db, db

def test_cli_creates_seeded_db(tmp_path):
    target = tmp_path / "ea.sqlite"
    rc = init_db.main([str(target)])
    assert rc == 0
    assert target.exists()
    conn = db.get_conn(target)
    assert conn.execute("SELECT COUNT(*) FROM config").fetchone()[0] >= 1

def test_cli_bad_path_returns_1(tmp_path):
    # a path whose parent directory does not exist -> clean failure, no traceback
    rc = init_db.main([str(tmp_path / "nope" / "ea.sqlite")])
    assert rc == 1
