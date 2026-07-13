import pytest
from ea import db
from mcp_server import tools


def _conn(tmp_path):
    return db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)


def test_add_and_list_signal(tmp_path):
    conn = _conn(tmp_path)
    assert tools.add_signal(conn, type="email", source="outlook",
                            external_ref="m1", title="Hi", status="new") == 1
    rows = tools.list_table(conn, "signals", status="new")
    assert [r["external_ref"] for r in rows] == ["m1"]


def test_list_table_rejects_unknown(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError):
        tools.list_table(conn, "sqlite_master")


def test_update_status_and_helpers(tmp_path):
    conn = _conn(tmp_path)
    tools.add_signal(conn, type="email", source="outlook", external_ref="m1", title="Hi")
    assert tools.update_status(conn, "signals", 1, "dismissed") == 1
    tid = tools.add_task(conn, title="do it")
    assert tid >= 1
    did = tools.add_deadline(conn, title="D", due_at="2099-01-01T00:00:00+00:00",
                             source="manual", external_ref="manual:x")
    assert did == 1
    assert tools.log_skill_run(conn, "triage_email", items_created=1) >= 1


def test_trend_tools(tmp_path):
    conn = _conn(tmp_path)
    rid = tools.upsert_trend(conn, "ai", "topic", "2026-06-14", "2026-06-21", score=2.0)
    assert rid >= 1
    assert tools.add_trend_finding(conn, title="P", url="http://x",
                                   external_ref="http://x", source="web") == 1


def test_tag_and_link_tools(tmp_path):
    conn = _conn(tmp_path)
    conn.execute("INSERT INTO people (name) VALUES ('Ada')")
    conn.commit()
    assert tools.tag_content(conn, "task", 1, "urgent", "amber") == 1
    assert tools.link_content(conn, "task", 1, "person", 1) == 1
    names = {t["name"] for t in tools.list_tags(conn)}
    assert "urgent" in names


def test_add_learning_and_news_tools(tmp_path):
    conn = _conn(tmp_path)
    assert tools.add_learning(conn, kind="course", title="K8s", external_ref="l1", source="email") == 1
    assert tools.add_news(conn, title="AI", external_ref="u1", url="u1", topic_id=1) == 1
    learning = tools.list_table(conn, "learning")
    news = tools.list_table(conn, "news_items")
    assert learning[0]["title"] == "K8s"
    assert news[0]["title"] == "AI"


def test_add_signal_full_fields(tmp_path):
    conn = _conn(tmp_path)
    assert tools.add_signal(
        conn, type="email", source="outlook", external_ref="mX", title="Budget",
        who="CFO", what="approve budget", when_rel="today", why="deadline",
        polarity="risk", impact=88, person_id=1, topic_id=1,
        url="http://x", occurred_at="2026-07-13T09:00:00+00:00", triage_rank=1) == 1
    row = tools.list_table(conn, "signals")[0]
    assert row["who"] == "CFO" and row["impact"] == 88 and row["polarity"] == "risk"


def test_writers_extra_fields(tmp_path):
    conn = _conn(tmp_path)
    assert tools.add_deadline(conn, title="D", due_at="2099-01-01T00:00:00+00:00",
                              source="manual", external_ref="d1",
                              person_id=1, visible=0) == 1
    d = tools.list_table(conn, "critical_deadlines")[0]
    assert d["visible"] == 0 and d["person_id"] == 1
    tid = tools.add_task(conn, title="T", status="in_progress", person_id=1)
    assert tid >= 1
    rid = tools.upsert_trend(conn, "ai", "topic", "2026-06-14", "2026-06-21",
                             score=2.0, sources="signal:1,signal:2")
    assert rid >= 1
    tr = tools.list_table(conn, "trends")[0]
    assert tr["sources"] == "signal:1,signal:2"


def test_add_alert(tmp_path):
    conn = _conn(tmp_path)
    aid = tools.add_alert(conn, severity="critical", title="Deadline in 1h",
                          body="Q3 filing due", url="/deadlines",
                          source_table="critical_deadlines", source_id=1)
    assert aid >= 1
    alerts = tools.list_table(conn, "alerts")
    assert alerts[0]["title"] == "Deadline in 1h" and alerts[0]["severity"] == "critical"


def test_add_alert_rejects_bad_column(tmp_path):
    conn = _conn(tmp_path)
    with pytest.raises(ValueError):
        tools.add_alert(conn, severity="info", title="t", body="b", bogus=1)


def test_list_skills_roster_and_health(tmp_path):
    conn = _conn(tmp_path)
    skills_dir = tmp_path / "skills" / "triage_email"
    skills_dir.mkdir(parents=True)
    (skills_dir / "SKILL.md").write_text(
        "---\nname: triage_email\ndescription: triage inbound\n"
        "schedule: heartbeat 30m\n---\nbody\n")
    tools.log_skill_run(conn, "triage_email", items_created=1)  # recent run
    skills = tools.list_skills(conn, tmp_path / "skills")
    s = next(x for x in skills if x["name"] == "triage_email")
    assert s["description"] == "triage inbound"
    assert s["last_run"] is not None
    assert s["active"] is True


def test_list_skills_no_dir(tmp_path):
    conn = _conn(tmp_path)
    assert tools.list_skills(conn, None) == []
