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


def test_daily_summary_is_writable(tmp_path):
    conn = db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)
    db.set_config(conn, "daily_summary", '{"date":"2026-07-12","text":"hi"}')
    v = conn.execute("SELECT value FROM config WHERE key='daily_summary'").fetchone()
    assert '"text":"hi"' in v["value"]
