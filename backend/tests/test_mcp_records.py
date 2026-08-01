from ea import db
from mcp_server import tools


def _conn(tmp_path):
    return db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)


def test_upsert_and_list_records_round_trip(tmp_path):
    conn = _conn(tmp_path)
    rid1 = tools.upsert_record(conn, kind="territory", external_ref="t1",
                               data={"region": "EMEA"})
    assert rid1 > 0

    rid2 = tools.upsert_record(conn, kind="territory", external_ref="t1",
                               data={"region": "APAC"})
    assert rid2 == rid1  # dedup on external_ref

    rows = tools.list_records(conn, "territory")
    assert len(rows) == 1
    assert rows[0]["data"] == {"region": "APAC"}


def test_list_records_status_filter(tmp_path):
    conn = _conn(tmp_path)
    tools.upsert_record(conn, kind="revops", external_ref="r1", data={}, status="active")
    tools.upsert_record(conn, kind="revops", external_ref="r2", data={}, status="archived")
    assert len(tools.list_records(conn, "revops", status="active")) == 1
