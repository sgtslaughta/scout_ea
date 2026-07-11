"""Cadence parsing + active-by-schedule logic."""
from datetime import datetime, timezone

from lib import skill_health as sh

NOW = datetime(2026, 7, 12, 12, 0, tzinfo=timezone.utc)


def test_interval_from_heartbeat_minutes():
    assert sh.expected_interval_seconds("heartbeat 30m, workdays 07:00-18:00 EST") == 1800


def test_interval_from_daily_weekly_words():
    assert sh.expected_interval_seconds("automation, daily 08:00 EST") == 86400
    assert sh.expected_interval_seconds("automation, weekly Friday 10:00 EST") == 604800
    assert sh.expected_interval_seconds("automation, hourly") == 3600


def test_interval_unparseable_is_none():
    assert sh.expected_interval_seconds("") is None
    assert sh.expected_interval_seconds("whenever the mood strikes") is None


def test_active_respects_cadence():
    # 30m skill: 20 min stale -> active, 3h stale -> not (grace = 2x = 60m)
    assert sh.is_active("heartbeat 30m", "2026-07-12T11:40:00Z", NOW) is True
    assert sh.is_active("heartbeat 30m", "2026-07-12T09:00:00Z", NOW) is False


def test_weekly_skill_idle_three_days_still_active():
    # weekly grace = 14 days; 3 days stale is healthy
    assert sh.is_active("weekly Friday 10:00 EST", "2026-07-09T10:00:00Z", NOW) is True


def test_never_run_is_inactive():
    assert sh.is_active("daily", None, NOW) is False


def test_unparseable_schedule_falls_back_to_24h_grace():
    # no cadence -> 24h grace; 12h stale active, 30h stale inactive
    assert sh.is_active("mystery", "2026-07-12T00:00:00Z", NOW) is True
    assert sh.is_active("mystery", "2026-07-11T05:00:00Z", NOW) is False
