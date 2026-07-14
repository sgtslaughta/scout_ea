from ea import db


def test_signals_has_polarity_column(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    cols = [r[1] for r in conn.execute("PRAGMA table_info(signals)")]
    assert "polarity" in cols


def test_upsert_signal_accepts_polarity(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    n = db.upsert_signal(conn, type="proactive", source="briefing",
                         external_ref="r1", title="t", status="new",
                         polarity="risk")
    assert n == 1
    row = conn.execute("SELECT polarity FROM signals WHERE external_ref='r1'").fetchone()
    assert row["polarity"] == "risk"


def test_signals_has_impact_column_and_upsert_accepts_it(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    cols = [r[1] for r in conn.execute("PRAGMA table_info(signals)")]
    assert "impact" in cols
    db.upsert_signal(conn, type="proactive", source="briefing", external_ref="i1",
                     title="t", status="new", polarity="risk", impact=88)
    row = conn.execute("SELECT impact FROM signals WHERE external_ref='i1'").fetchone()
    assert row["impact"] == 88


def test_migration_adds_impact_to_preexisting_db(tmp_path):
    # Simulate an old DB with no impact column, then re-open to trigger migration.
    import sqlite3
    p = tmp_path / "ea.sqlite"
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    conn.execute("ALTER TABLE signals DROP COLUMN impact")
    conn.commit()
    conn.close()
    conn2 = db.init_db(p, seed_path=db.DEFAULT_SEED)  # migration re-adds it
    cols = [r[1] for r in conn2.execute("PRAGMA table_info(signals)")]
    assert "impact" in cols


def test_daily_summary_is_writable(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    db.set_config(conn, "daily_summary", '{"date":"2026-07-12","text":"hi"}')
    v = conn.execute("SELECT value FROM config WHERE key='daily_summary'").fetchone()
    assert '"text":"hi"' in v["value"]
