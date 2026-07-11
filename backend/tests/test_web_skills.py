from fastapi.testclient import TestClient
from ea import db
from web.app import create_app


def test_skills_endpoint(tmp_path):
    sd = tmp_path / "skills" / "daily_outlook"
    sd.mkdir(parents=True)
    (sd / "SKILL.md").write_text("---\nname: daily_outlook\ndescription: morning brief\nschedule: daily 07:00\n---\nGather. log_skill_run.\n")
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    c = TestClient(create_app(p, skills_dir=tmp_path / "skills"))
    body = c.get("/api/skills").json()
    assert body[0]["name"] == "daily_outlook"


def test_skills_endpoint_none_returns_empty(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    c = TestClient(create_app(p))
    assert c.get("/api/skills").json() == []


def test_skills_endpoint_marks_active_from_recent_run(tmp_path):
    sd = tmp_path / "skills" / "daily_outlook"
    sd.mkdir(parents=True)
    (sd / "SKILL.md").write_text("---\nname: daily_outlook\ndescription: brief\nschedule: daily 07:00\n---\nbody\n")
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    db.add_skill_run(db.get_conn(p), skill="daily_outlook", items_created=3)
    c = TestClient(create_app(p, skills_dir=tmp_path / "skills"))
    body = c.get("/api/skills").json()
    assert body[0]["active"] is True
    assert body[0]["last_run"] is not None


def test_skills_endpoint_inactive_when_never_run(tmp_path):
    sd = tmp_path / "skills" / "fast_skill"
    sd.mkdir(parents=True)
    (sd / "SKILL.md").write_text("---\nname: fast_skill\ndescription: x\nschedule: heartbeat 30m\n---\nbody\n")
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    c = TestClient(create_app(p, skills_dir=tmp_path / "skills"))
    body = c.get("/api/skills").json()
    assert body[0]["active"] is False
    assert body[0]["last_run"] is None
