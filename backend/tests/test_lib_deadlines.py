from lib import deadlines

# 2026-06-21 is a Sunday (weekday() == 6), UTC
NOW = "2026-06-21T09:00:00+00:00"


def test_iso_passthrough_to_utc(tmp_path=None):
    assert deadlines.normalize_due("2026-06-24T17:00:00+00:00", NOW) == \
        "2026-06-24T17:00:00+00:00"


def test_today_and_tomorrow_eod(tmp_path=None):
    assert deadlines.normalize_due("today", NOW) == "2026-06-21T17:00:00+00:00"
    assert deadlines.normalize_due("tomorrow", NOW) == "2026-06-22T17:00:00+00:00"
    assert deadlines.normalize_due("eod", NOW) == "2026-06-21T17:00:00+00:00"


def test_weekday_next_occurrence(tmp_path=None):
    # next Friday after Sunday 6/21 is 6/26
    assert deadlines.normalize_due("friday", NOW) == "2026-06-26T17:00:00+00:00"
    assert deadlines.normalize_due("eod friday", NOW) == "2026-06-26T17:00:00+00:00"


def test_unparseable_returns_none(tmp_path=None):
    assert deadlines.normalize_due("sometime soon", NOW) is None


def test_countdown_sign(tmp_path=None):
    assert deadlines.countdown("2026-06-21T10:00:00+00:00", NOW) == 3600
    assert deadlines.countdown("2026-06-21T08:00:00+00:00", NOW) == -3600


def test_weekday_naming_today_goes_next_week(tmp_path=None):
    # "sunday" on a Sunday must resolve to NEXT Sunday (the `or 7` branch), not today
    assert deadlines.normalize_due("sunday", NOW) == "2026-06-28T17:00:00+00:00"


def test_bare_iso_date_passthrough_midnight_utc(tmp_path=None):
    # a date-only string parses to midnight UTC (passthrough, not 17:00)
    assert deadlines.normalize_due("2026-06-24", NOW) == "2026-06-24T00:00:00+00:00"
