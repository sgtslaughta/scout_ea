"""Scout install bundle: schedule parsing, automation assembly, endpoint shape."""
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from ea import db
from ea import scout_install as si
from web.app import create_app

NOW = datetime(2026, 8, 1, 12, 0, 0, 123000, tzinfo=timezone.utc)


def _client(tmp_path, skills_dir=None):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    return TestClient(create_app(p, skills_dir=skills_dir))


def _write_skill(tmp_path, name, schedule, body="Use the {{mcp_name}} MCP server. Call upsert_record."):
    d = tmp_path / "skills" / name
    d.mkdir(parents=True)
    (d / "SKILL.md").write_text(
        f"---\nname: {name}\ndescription: test skill\nschedule: {schedule}\n---\n{body}\n")
    return d


# --- parse_schedule -----------------------------------------------------------

def test_parse_schedule_interval():
    s = si.parse_schedule("every 30m")
    assert s["kind"] == "interval"
    assert s["intervalMinutes"] == 30
    assert s["days"] == [0, 1, 2, 3, 4, 5, 6]
    assert s["anchor"] == {"hour": 0, "minute": 0}
    assert s["hour"] == 0 and s["minute"] == 0


def test_parse_schedule_interval_workdays():
    s = si.parse_schedule("every 20m, workdays 07:00-18:00 EST")
    assert s["kind"] == "interval"
    assert s["intervalMinutes"] == 20
    assert s["days"] == [1, 2, 3, 4, 5]
    assert "weekdays" in s["naturalLanguage"].lower()


def test_parse_schedule_daily_time():
    s = si.parse_schedule("automation, daily 06:30 EST")
    assert s["kind"] == "single"
    assert s["time"] == {"hour": 6, "minute": 30}
    assert s["hour"] == 6 and s["minute"] == 30
    assert s["days"] == [0, 1, 2, 3, 4, 5, 6]


def test_parse_schedule_weekly_friday():
    s = si.parse_schedule("automation, weekly Friday 09:00 EST")
    assert s["kind"] == "single"
    assert s["days"] == [5]
    assert s["time"] == {"hour": 9, "minute": 0}
    assert "friday" in s["naturalLanguage"].lower()


def test_parse_schedule_unparseable_does_not_raise():
    s = si.parse_schedule("gibberish schedule with no useful tokens")
    assert s["kind"] == "single"
    assert s["time"] == {"hour": 7, "minute": 0}

    s2 = si.parse_schedule("")
    assert s2["kind"] == "single"
    assert s2["time"] == {"hour": 7, "minute": 0}

    s3 = si.parse_schedule(None)
    assert s3["time"] == {"hour": 7, "minute": 0}


def test_parse_schedule_config_default_fallback():
    s = si.parse_schedule("automation, daily at config.outlook_send_time (default 07:00), workdays only")
    assert s["kind"] == "single"
    assert s["time"] == {"hour": 7, "minute": 0}
    assert s["days"] == [1, 2, 3, 4, 5]


# --- automation_id -------------------------------------------------------------

def test_automation_id_stable_and_distinct():
    assert si.automation_id("chat_preferred") == si.automation_id("chat_preferred")
    assert len(si.automation_id("chat_preferred")) == 16
    assert si.automation_id("chat_preferred").islower()
    assert si.automation_id("chat_preferred") != si.automation_id("compute_trends")


# --- build_automation ----------------------------------------------------------

def test_build_automation_shape():
    skill = {"name": "chat_preferred", "description": "d", "schedule": "every 20m"}
    a = si.build_automation(skill, "the rendered prompt body", NOW)
    assert a["name"] == "Chat Preferred"
    assert a["id"] == si.automation_id("chat_preferred")
    assert a["steps"] == [{"id": "1", "label": "Step 1", "prompt": "the rendered prompt body"}]
    assert a["enabled"] is True
    assert a["triggerType"] == "schedule"
    assert a["browserHeadless"] is False
    assert a["teamsNotify"] == "never"
    assert a["createdAt"].endswith("Z")
    assert a["updatedAt"] == a["createdAt"]
    assert "pinnedSessionId" not in a
    assert "lastExecutedAt" not in a


# --- required_mcp_tools ---------------------------------------------------------

def test_required_mcp_tools_includes_expected():
    tools = si.required_mcp_tools()
    assert "upsert_record" in tools
    assert "claim_action" in tools
    assert tools == sorted(tools)


# --- endpoint --------------------------------------------------------------------

def test_endpoint_one_automation_per_skill_and_mcp_name_substitution(tmp_path):
    _write_skill(tmp_path, "chat_preferred", "every 20m")
    _write_skill(tmp_path, "compute_trends", "automation, daily 06:00 EST")
    c = _client(tmp_path, skills_dir=tmp_path / "skills")
    body = c.get("/api/scout/install?mcp_name=my-mcp").json()

    assert body["skillsDir"] == "~/.scout/m-skills"
    assert body["automationsPath"] == "~/.scout/m-automations/automations.json"
    assert body["mcpServersPath"] == "~/.scout/m-mcp-servers.json"
    assert len(body["skills"]) == 2
    assert len(body["automations"]) == 2

    for s in body["skills"]:
        assert s["content"].startswith("---")
        assert "{{mcp_name}}" not in s["content"]
        assert "my-mcp" in s["content"]
    assert body["skills"][0]["path"] == "chat_preferred/SKILL.md"

    assert "upsert_record" in body["mcpTools"]
    assert "claim_action" in body["mcpTools"]


def test_endpoint_defaults_mcp_name_to_config_then_scout_ea(tmp_path):
    _write_skill(tmp_path, "chat_preferred", "every 20m")
    c = _client(tmp_path, skills_dir=tmp_path / "skills")
    body = c.get("/api/scout/install").json()
    assert "scout-ea" in body["skills"][0]["content"]
