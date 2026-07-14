import pytest
from ea import db
from mcp_server import tools


def _conn(tmp_path):
    return db.init_db(tmp_path / "ea.sqlite", seed_path=db.DEFAULT_SEED)


def test_add_event_with_title_only(tmp_path):
    """add_event with title only → returns an int id > 0; row exists with status 'suggested'."""
    conn = _conn(tmp_path)
    event_id = tools.add_event(conn, title="Team Meeting")
    assert event_id > 0
    events = tools.list_table(conn, "events")
    assert len(events) == 1
    assert events[0]["title"] == "Team Meeting"
    assert events[0]["status"] == "suggested"


def test_add_event_with_all_fields(tmp_path):
    """add_event with all fields (incl source_signal_id, external_ref) → row has them."""
    conn = _conn(tmp_path)
    # Create a signal to reference
    tools.add_signal(conn, type="email", source="outlook", external_ref="sig-1", title="Trigger")
    event_id = tools.add_event(
        conn,
        title="Planning Session",
        body="Q3 planning",
        proposed_times="2026-07-14T10:00:00, 2026-07-14T14:00:00",
        chosen_time="2026-07-14T10:00:00",
        attendees="alice@example.com,bob@example.com",
        status="confirmed",
        source_signal_id=1,
        external_ref="cal-001"
    )
    assert event_id > 0
    events = tools.list_table(conn, "events")
    assert len(events) == 1
    row = events[0]
    assert row["title"] == "Planning Session"
    assert row["body"] == "Q3 planning"
    assert row["proposed_times"] == "2026-07-14T10:00:00, 2026-07-14T14:00:00"
    assert row["chosen_time"] == "2026-07-14T10:00:00"
    assert row["attendees"] == "alice@example.com,bob@example.com"
    assert row["status"] == "confirmed"
    assert row["source_signal_id"] == 1
    assert row["external_ref"] == "cal-001"


def test_add_event_unknown_column_raises(tmp_path):
    """add_event with an unknown column kwarg → raises ValueError."""
    conn = _conn(tmp_path)
    with pytest.raises(ValueError, match="unknown event columns"):
        tools.add_event(conn, title="Meeting", bogus_field="value")


def test_add_event_without_title_raises(tmp_path):
    """add_event without title → raises ValueError."""
    conn = _conn(tmp_path)
    with pytest.raises(ValueError, match="add_event requires 'title'"):
        tools.add_event(conn, body="No title here")


def test_update_event_multiple_fields(tmp_path):
    """update_event(id, status='drafted', external_ref='cal-123') → returns 1; row reflects both."""
    conn = _conn(tmp_path)
    event_id = tools.add_event(conn, title="Review")
    assert event_id > 0

    rows_affected = tools.update_event(conn, event_id, status="drafted", external_ref="cal-123")
    assert rows_affected == 1

    events = tools.list_table(conn, "events")
    assert len(events) == 1
    row = events[0]
    assert row["status"] == "drafted"
    assert row["external_ref"] == "cal-123"


def test_update_event_unknown_column_raises(tmp_path):
    """update_event with unknown column → raises ValueError."""
    conn = _conn(tmp_path)
    event_id = tools.add_event(conn, title="Meeting")

    with pytest.raises(ValueError, match="unknown event columns"):
        tools.update_event(conn, event_id, unknown_col="value")


def test_update_event_no_fields_returns_zero(tmp_path):
    """update_event with no fields → returns 0."""
    conn = _conn(tmp_path)
    event_id = tools.add_event(conn, title="Meeting")

    rows_affected = tools.update_event(conn, event_id)
    assert rows_affected == 0
