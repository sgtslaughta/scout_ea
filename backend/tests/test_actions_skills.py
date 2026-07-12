from pathlib import Path
import pytest
from lib import skills

SKILLS = Path(__file__).resolve().parents[2] / "skills"

def test_scout_actions_skill_parses():
    by_name = {s["name"]: s for s in skills.list_skills(SKILLS)}
    assert "scout_actions" in by_name
    assert "5m" in by_name["scout_actions"]["schedule"]


@pytest.mark.parametrize("name,sched,owns", [
    ("run_comms", "5m", "email_new"),
    ("run_teams", "5m", "teams_dm"),
    ("run_calendar", "5m", "calendar_invite"),
    ("run_cowork", "10m", "cowork_doc"),
])
def test_executor_skill_parses(name, sched, owns):
    by_name = {s["name"]: s for s in skills.list_skills(SKILLS)}
    assert name in by_name and sched in by_name[name]["schedule"]
    assert owns in (SKILLS / name / "SKILL.md").read_text()
