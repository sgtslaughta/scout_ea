import pytest
from ea import db


def _c(tmp_path):
    return db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)


def test_add_finding_dedups(tmp_path):
    conn = _c(tmp_path)
    f = dict(title="Paper", url="http://x", external_ref="http://x", source="web")
    assert db.add_trend_finding(conn, **f) == 1
    assert db.add_trend_finding(conn, **f) == 0


def test_add_finding_rejects_unknown_col(tmp_path):
    conn = _c(tmp_path)
    with pytest.raises(ValueError, match="unknown trend_finding columns"):
        db.add_trend_finding(conn, external_ref="x", title="t", evil="1")
