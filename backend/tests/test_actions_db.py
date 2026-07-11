from ea import db

def test_actions_and_guidance_tables_exist(tmp_path):
    conn = db.init_db(tmp_path / "t.db")
    cols = {r[1] for r in conn.execute("PRAGMA table_info(actions)")}
    assert {"id", "entity_type", "entity_id", "action_type", "mode", "status",
            "payload", "rationale", "created_by", "approved_at", "executed_at",
            "result", "error", "created_at"} <= cols
    gcols = {r[1] for r in conn.execute("PRAGMA table_info(guidance)")}
    assert {"id", "scope", "text", "created_at"} <= gcols


def test_add_list_update_action(tmp_path):
    conn = db.init_db(tmp_path / "t.db")
    aid = db.add_action(conn, action_type="email_new", entity_type="signal",
                        entity_id=7, payload={"to": "x@y.com", "subject": "hi"},
                        rationale="follow up")
    assert aid > 0
    rows = db.list_actions(conn, status="drafted")
    assert len(rows) == 1 and rows[0]["payload"]["to"] == "x@y.com"
    n = db.update_action(conn, aid, status="completed",
                         result={"ok": True, "access_url": "http://d/1"})
    assert n == 1
    got = db.list_actions(conn)[0]
    assert got["status"] == "completed"
    assert got["result"]["access_url"] == "http://d/1"
    assert got["executed_at"] is not None


def test_claim_is_exclusive_and_dedup(tmp_path):
    conn = db.init_db(tmp_path / "t.db")
    aid = db.add_action(conn, action_type="email_new", mode="review", status="approved")
    assert db.claim_action(conn, aid) is True      # first wins
    assert db.claim_action(conn, aid) is False     # already executing
    auto = db.add_action(conn, action_type="cowork_doc", mode="auto")  # drafted+auto
    assert db.claim_action(conn, auto) is True
    db.add_action(conn, action_type="teams_dm", entity_type="person",
                  entity_id=3, status="drafted")
    assert db.has_open_action(conn, "person", 3, "teams_dm") is True
    assert db.has_open_action(conn, "person", 3, "email_new") is False


def test_guidance_crud(tmp_path):
    conn = db.init_db(tmp_path / "t.db")
    gid = db.add_guidance(conn, "topic:AI", "ignore vendor spam")
    db.add_guidance(conn, "global", "keep replies short")
    scoped = db.list_guidance(conn, scope="topic:AI")
    texts = {g["text"] for g in scoped}
    assert "ignore vendor spam" in texts and "keep replies short" in texts  # global included
    assert db.delete_guidance(conn, gid) == 1
    assert all(g["text"] != "ignore vendor spam" for g in db.list_guidance(conn))
