"""Parse Scout SKILL.md files into structured dicts. Pure: no DB."""
from __future__ import annotations
from pathlib import Path


def _parse_one(text: str) -> dict:
    """Split a SKILL.md into frontmatter fields + body."""
    meta: dict = {}
    body = text
    if text.startswith("---"):
        end = text.find("---", 3)
        if end != -1:
            fm = text[3:end].strip()
            body = text[end + 3:].lstrip("\n")
            for line in fm.splitlines():
                if ":" in line:
                    k, _, v = line.partition(":")
                    meta[k.strip()] = v.strip()
    return {"name": meta.get("name", ""),
            "description": meta.get("description", ""),
            "schedule": meta.get("schedule", ""),
            "body": body}


def list_skills(skills_dir) -> list[dict]:
    """Return parsed skills sorted by name. Empty list if dir missing."""
    d = Path(skills_dir)
    if not d.is_dir():
        return []
    out = []
    for f in sorted(d.glob("*/SKILL.md")):
        s = _parse_one(f.read_text())
        if not s["name"]:
            s["name"] = f.parent.name
        out.append(s)
    return out
