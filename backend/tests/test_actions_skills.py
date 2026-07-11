from pathlib import Path
from lib import skills

SKILLS = Path(__file__).resolve().parents[2] / "skills"

def test_scout_actions_skill_parses():
    by_name = {s["name"]: s for s in skills.list_skills(SKILLS)}
    assert "scout_actions" in by_name
    assert "5m" in by_name["scout_actions"]["schedule"]
