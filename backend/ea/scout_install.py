"""Build the Scout desktop install bundle: skills, automations, MCP tool allow-list.

Turns our SKILL.md frontmatter into the JSON shapes the MS Scout desktop app reads
from `~/.scout/` on first run. Pure logic — no DB, no filesystem writes. Verified
against a real `~/.scout/m-automations/automations.json` (Windows path shown in the
Scout docs is `C:\\Users\\<user>\\.scout\\`; same tree under `~/.scout/` on macOS).
"""
from __future__ import annotations
import hashlib
import re
from datetime import datetime
from pathlib import Path

from lib import skills as _skills

# --- schedule parsing -------------------------------------------------------

_INTERVAL_RE = re.compile(r"\b(?:every|heartbeat)\s+(\d+)\s*m\b")
_TIME_RE = re.compile(r"\b(\d{1,2}):(\d{2})\b")
_WEEKDAY_RE = re.compile(
    r"\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b", re.IGNORECASE)

# Observed in real automations.json: 0..6 with 1=Monday, 0=Sunday (i.e. Python's
# isoweekday() % 7). A 7-day automation used [0,1,2,3,4,5,6].
_WEEKDAY_NUM = {"monday": 1, "tuesday": 2, "wednesday": 3, "thursday": 4,
                "friday": 5, "saturday": 6, "sunday": 0}
_ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
_WORKDAYS = [1, 2, 3, 4, 5]

_DEFAULT_HOUR, _DEFAULT_MINUTE = 7, 0  # fallback clock time when nothing parses


def _fmt_clock(hour: int, minute: int) -> str:
    period = "AM" if hour < 12 else "PM"
    h12 = hour % 12 or 12
    return f"{h12}:{minute:02d} {period}"


def parse_schedule(text: str) -> dict:
    """Turn a SKILL.md `schedule:` string into a Scout schedule object.

    Never raises — an unparseable string falls back to a daily 07:00 (or the
    "default HH:MM" mentioned in the text, if any), so a bad skill schedule
    can't take the install endpoint down.
    """
    try:
        return _parse_schedule(text or "")
    except Exception:
        return _parse_schedule("")


def _parse_schedule(text: str) -> dict:
    low = text.lower()
    workdays = "workdays" in low
    wd_match = _WEEKDAY_RE.search(text)
    weekday_name = wd_match.group(1).lower() if wd_match else None

    if weekday_name:
        days = [_WEEKDAY_NUM[weekday_name]]
    elif workdays:
        days = list(_WORKDAYS)
    else:
        days = list(_ALL_DAYS)

    m = _INTERVAL_RE.search(low)
    if m:
        minutes = int(m.group(1))
        nl = f"Every {minutes} minutes" + (" on weekdays" if workdays else "")
        return {
            "kind": "interval",
            "naturalLanguage": nl,
            "days": days,
            "intervalMinutes": minutes,
            "anchor": {"hour": 0, "minute": 0},
            "hour": 0,
            "minute": 0,
        }

    # Clock-time (single) schedule. Find the first HH:MM in the text — this also
    # covers the "daily at config.outlook_send_time (default 07:00)" case, since
    # the parenthesised default is itself an HH:MM.
    tm = _TIME_RE.search(text)
    hour, minute = (int(tm.group(1)), int(tm.group(2))) if tm else (_DEFAULT_HOUR, _DEFAULT_MINUTE)
    clock = _fmt_clock(hour, minute)

    if weekday_name:
        nl = f"Every {weekday_name.capitalize()} at {clock}"
    elif workdays:
        nl = f"Every weekday at {clock}"
    else:
        nl = f"Every day at {clock}"

    return {
        "kind": "single",
        "naturalLanguage": nl,
        "days": days,
        "time": {"hour": hour, "minute": minute},
        "hour": hour,
        "minute": minute,
    }


# --- automation assembly -----------------------------------------------------

def automation_id(name: str) -> str:
    """Deterministic 16-char lowercase-alphanumeric id for a skill's automation.

    Hashed from the skill name (not random) so re-running the install endpoint
    reproduces the same id instead of creating duplicate automations in Scout.
    """
    return hashlib.sha256(name.encode()).hexdigest()[:16]


def _title_case(name: str) -> str:
    return " ".join(w.capitalize() for w in name.split("_"))


def _iso_z(now: datetime) -> str:
    # Millisecond precision + trailing "Z", matching the real automations.json.
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"


def build_automation(skill: dict, prompt: str, now: datetime) -> dict:
    """Assemble one automations.json entry for a skill.

    Omits `pinnedSessionId` and `lastExecutedAt` — both are written by the Scout
    app on first run and inventing them would be wrong.
    """
    name = skill.get("name", "")
    ts = _iso_z(now)
    return {
        "schedule": parse_schedule(skill.get("schedule", "")),
        "browserHeadless": False,
        "teamsNotify": "never",
        "id": automation_id(name),
        "name": _title_case(name),
        "steps": [{"id": "1", "label": "Step 1", "prompt": prompt}],
        "enabled": True,
        "createdAt": ts,
        "updatedAt": ts,
        "triggerType": "schedule",
    }


# --- MCP tool allow-list ------------------------------------------------------

_TOOL_DEF_RE = re.compile(r"@mcp\.tool\(\)\s*\n\s*def (\w+)\(")


def required_mcp_tools() -> list[str]:
    """MCP tool names our skills actually call.

    Scans mcp_server/server.py for `@mcp.tool()`-decorated function names, then
    keeps only the ones referenced (by name) in a skill's SKILL.md body — so this
    list tracks the skills instead of rotting into a hand-maintained one.
    """
    server_path = Path(__file__).resolve().parent.parent / "mcp_server" / "server.py"
    try:
        src = server_path.read_text()
    except OSError:
        return []
    all_tools = _TOOL_DEF_RE.findall(src)

    skills_dir = Path(__file__).resolve().parent.parent.parent / "skills"
    bodies = []
    for f in skills_dir.glob("*/SKILL.md"):
        try:
            bodies.append(f.read_text())
        except OSError:
            continue
    combined = "\n".join(bodies)

    used = [t for t in all_tools if re.search(rf"\b{re.escape(t)}\b", combined)]
    return sorted(used)


# --- install bundle ------------------------------------------------------------

def build_install_bundle(skills_dir, mcp_name: str, now: datetime) -> dict:
    """Assemble the full `GET /api/scout/install` payload. Pure: no DB."""
    parsed = _skills.list_skills(skills_dir)
    files = sorted(Path(skills_dir).glob("*/SKILL.md")) if Path(skills_dir).is_dir() else []

    skills_out = []
    automations = []
    for meta, f in zip(parsed, files):
        raw = f.read_text().replace("{{mcp_name}}", mcp_name)
        rel_path = f"{f.parent.name}/SKILL.md"
        skills_out.append({
            "name": meta["name"],
            "description": meta["description"],
            "schedule": meta["schedule"],
            "path": rel_path,
            "content": raw,
        })
        body = meta["body"].replace("{{mcp_name}}", mcp_name)
        automations.append(build_automation(meta, body, now))

    return {
        "skillsDir": "~/.scout/m-skills",
        "automationsPath": "~/.scout/m-automations/automations.json",
        "mcpServersPath": "~/.scout/m-mcp-servers.json",
        "skills": skills_out,
        "automations": automations,
        "mcpTools": required_mcp_tools(),
    }


# ponytail: runnable self-check — `python -m ea.scout_install`.
if __name__ == "__main__":
    assert parse_schedule("every 20m, workdays 07:00-18:00 EST")["kind"] == "interval"
    assert parse_schedule("automation, weekly Friday 10:00 EST")["days"] == [5]
    assert automation_id("chat_preferred") == automation_id("chat_preferred")
    assert automation_id("chat_preferred") != automation_id("compute_trends")
    print("scout_install self-check OK")
