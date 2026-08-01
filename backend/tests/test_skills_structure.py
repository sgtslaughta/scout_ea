"""
Structural validator for Scout EA skills.
Verifies all 11 skills are present, have proper YAML frontmatter, and reference MCP tools.
"""

from pathlib import Path
import re

SKILLS = Path(__file__).resolve().parents[2] / "skills"
EXPECTED = {
    "triage_email",
    "triage_teams",
    "extract_research_training_email",
    "suggest_events",
    "create_events",
    "research_topics",
    "compile_learning_email",
    "parse_deadlines",
    "daily_briefing",
    "compute_trends",
    "trending_search",
    "email_preferred",
    "chat_preferred",
    "pipeline_tracker",
    "ou_feedback",
    "territory_review",
    "ebc_innovation_hub",
    "revops_meeting",
}
MCP_TOOLS = {
    "add_signal",
    "list_rows",
    "update_status",
    "add_deadline",
    "add_task",
    "log_skill_run",
    "upsert_trend",
    "add_trend_finding",
    "upsert_record",
}


def _files():
    """Return dict of {skill_name: file_contents} for all SKILL.md files."""
    return {p.parent.name: p.read_text() for p in SKILLS.glob("*/SKILL.md")}


def test_all_skills_present():
    """All 11 expected skills must be present."""
    files = _files()
    assert EXPECTED <= set(
        files.keys()
    ), f"Missing skills: {EXPECTED - set(files.keys())}"


def test_each_has_frontmatter_and_logs_run():
    """Each skill must have YAML frontmatter and call log_skill_run."""
    files = _files()
    for name, text in files.items():
        assert text.startswith("---"), f"{name} missing frontmatter start"
        assert re.search(
            r"^name:\s*\S+", text, re.M
        ), f"{name} missing 'name:' in frontmatter"
        assert re.search(
            r"^description:\s*\S+", text, re.M
        ), f"{name} missing 'description:' in frontmatter"
        assert re.search(
            r"^schedule:\s*\S+", text, re.M
        ), f"{name} missing 'schedule:' in frontmatter"
        assert (
            "log_skill_run" in text
        ), f"{name} must reference log_skill_run MCP tool"


def test_each_references_a_real_mcp_tool():
    """Each skill must reference at least one MCP tool."""
    files = _files()
    for name, text in files.items():
        referenced = [tool for tool in MCP_TOOLS if tool in text]
        assert (
            referenced
        ), f"{name} references no MCP tools; must use one of {MCP_TOOLS}"
