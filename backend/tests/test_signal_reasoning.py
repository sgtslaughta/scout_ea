from ea import db


def _conn(tmp_path):
    return db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)


def test_upsert_signal_accepts_reasoning(tmp_path):
    conn = _conn(tmp_path)
    assert db.upsert_signal(
        conn, external_ref="r1", type="email", source="inbox",
        title="Budget review", reasoning="Flagged: mentions Q3 budget + exec sender.",
    ) == 1
    rows = db.list_signals(conn)
    assert rows[0]["reasoning"] == "Flagged: mentions Q3 budget + exec sender."


def test_migration_adds_reasoning_to_existing_db(tmp_path):
    conn = _conn(tmp_path)
    # Simulate a pre-existing DB missing the column, then re-run migrations.
    conn.execute("ALTER TABLE signals DROP COLUMN reasoning")
    conn.commit()
    db._migrate(conn)
    cols = [r[1] for r in conn.execute("PRAGMA table_info(signals)").fetchall()]
    assert "reasoning" in cols
