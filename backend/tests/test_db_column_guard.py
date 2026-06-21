import pytest
from ea import db


def _conn(tmp_path):
    return db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)


def test_upsert_signal_rejects_unknown_column(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError, match="unknown signal columns"):
        db.upsert_signal(conn, external_ref="x", title="t", evil="1; DROP TABLE signals")


def test_add_deadline_rejects_unknown_column(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError, match="unknown deadline columns"):
        db.add_deadline(conn, external_ref="x", title="t",
                        due_at="2099-01-01T00:00:00+00:00", source="manual", evil="1")


def test_add_task_rejects_unknown_column(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError, match="unknown task columns"):
        db.add_task(conn, title="t", evil="1")


def test_valid_columns_still_work(tmp_path):
    conn = _conn(tmp_path)
    assert db.upsert_signal(conn, external_ref="a", type="email", source="x", title="t") == 1
    assert db.add_task(conn, title="t", priority=2) >= 1
    assert db.add_deadline(conn, external_ref="d", title="t",
                           due_at="2099-01-01T00:00:00+00:00", source="manual") == 1
