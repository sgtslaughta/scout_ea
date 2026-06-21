from lib import skills


def test_parse_and_list(tmp_path):
    d = tmp_path / "skills" / "triage_email"
    d.mkdir(parents=True)
    (d / "SKILL.md").write_text("---\nname: triage_email\ndescription: triage inbox\nschedule: heartbeat 30m\n---\n\nReview email. Call add_signal.\n")
    out = skills.list_skills(tmp_path / "skills")
    assert len(out) == 1
    assert out[0]["name"] == "triage_email"
    assert out[0]["description"] == "triage inbox"
    assert "add_signal" in out[0]["body"]


def test_missing_dir_returns_empty(tmp_path):
    assert skills.list_skills(tmp_path / "nope") == []
