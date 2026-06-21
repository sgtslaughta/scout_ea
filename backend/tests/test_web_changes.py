from ea import db
from web import changes


def test_current_version_is_int(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    conn = db.get_conn(p)
    assert isinstance(changes.current_version(conn), int)


def test_wait_returns_new_version_on_write(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    reader = db.get_conn(p)
    v0 = changes.current_version(reader)
    writer = db.get_conn(p)
    db.upsert_signal(writer, type="email", source="outlook", external_ref="a", title="A")
    v1 = changes.wait_for_change(reader, v0, timeout=2, poll=0.05)
    assert v1 != v0


def test_wait_times_out_without_write(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    reader = db.get_conn(p)
    v0 = changes.current_version(reader)
    v1 = changes.wait_for_change(reader, v0, timeout=0.3, poll=0.05)
    assert v1 == v0
