from ea import db

def test_actions_and_guidance_tables_exist(tmp_path):
    conn = db.init_db(tmp_path / "t.db")
    cols = {r[1] for r in conn.execute("PRAGMA table_info(actions)")}
    assert {"id", "entity_type", "entity_id", "action_type", "mode", "status",
            "payload", "rationale", "created_by", "approved_at", "executed_at",
            "result", "error", "created_at"} <= cols
    gcols = {r[1] for r in conn.execute("PRAGMA table_info(guidance)")}
    assert {"id", "scope", "text", "created_at"} <= gcols
