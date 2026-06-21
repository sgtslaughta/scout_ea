"""Seed realistic demo data for the Scout EA dashboard."""
from pathlib import Path
from datetime import datetime, timedelta, timezone
from ea import db

# Use current time as reference for realistic countdowns
NOW = datetime.now(timezone.utc)
DEMO_DATE = NOW.isoformat()

def iso_offset(hours: int) -> str:
    """Return an ISO-8601 datetime offset from DEMO_DATE by hours."""
    base = datetime.fromisoformat(DEMO_DATE.replace("Z", "+00:00"))
    dt = base + timedelta(hours=hours)
    return dt.isoformat()

def seed(db_path):
    """Insert demo data. Idempotent (dedup on external_ref)."""
    conn = db.init_db(db_path, seed_path=db.DEFAULT_SEED)

    # Enable deadlines display
    db.set_config(conn, "deadlines_visible_global", "1")

    # ~4 signals mix of statuses (including proactive)
    signals = [
        # Triaged signal, P1
        {
            "external_ref": "demo:signal:1",
            "type": "triage_email",
            "source": "triage_email",
            "title": "Julie birthday coming up in 3 days",
            "status": "new",
            "priority": 1,
        },
        # Triaged signal, P2
        {
            "external_ref": "demo:signal:2",
            "type": "email",
            "source": "email",
            "title": "Q3 roadmap review required by EOD",
            "status": "new",
            "priority": 2,
        },
        # Triaged signal, P3
        {
            "external_ref": "demo:signal:3",
            "type": "email",
            "source": "email",
            "title": "New feature request from beta testers",
            "status": "new",
            "priority": 3,
        },
        # Proactive signal
        {
            "external_ref": "demo:signal:proactive:1",
            "type": "proactive",
            "source": "skill:relationships",
            "title": "Julie mentioned her anniversary — send a card?",
            "status": "new",
            "priority": 2,
        },
    ]

    for sig in signals:
        db.upsert_signal(conn, **sig)

    # ~3 critical_deadlines with varying due_at (one <24h, one far future, one normal)
    deadlines = [
        {
            "external_ref": "demo:deadline:1",
            "title": "Q3 roadmap review",
            "due_at": (NOW + timedelta(hours=6, minutes=23)).isoformat(),
            "source": "email",
            "status": "active",
            "visible": 1,
        },
        {
            "external_ref": "demo:deadline:2",
            "title": "Budget approval",
            "due_at": (NOW + timedelta(days=1, hours=4)).isoformat(),
            "source": "email",
            "status": "active",
            "visible": 1,
        },
        {
            "external_ref": "demo:deadline:3",
            "title": "Team sync prep",
            "due_at": (NOW + timedelta(minutes=28)).isoformat(),
            "source": "email",
            "status": "active",
            "visible": 1,
        },
    ]

    for dl in deadlines:
        db.add_deadline(conn, **dl)

    # ~4 trends in one window
    today = NOW.date()
    window_start = f"{today}T00:00:00Z"
    window_end = f"{today + timedelta(days=1)}T00:00:00Z"

    trends = [
        {"term": "AI Strategy", "kind": "topic", "window_start": window_start, "window_end": window_end, "score": 85, "delta": 8},
        {"term": "Launch Timeline", "kind": "topic", "window_start": window_start, "window_end": window_end, "score": 72, "delta": 5},
        {"term": "Vendor Risk", "kind": "topic", "window_start": window_start, "window_end": window_end, "score": 45, "delta": -3},
        {"term": "Performance Review", "kind": "topic", "window_start": window_start, "window_end": window_end, "score": 58, "delta": 2},
    ]

    for tr in trends:
        db.upsert_trend(conn, **tr)

    # ~2 tasks due today
    today_str = str(today)
    tasks = [
        {
            "title": "Review Q3 metrics",
            "due_at": f"{today_str}T17:00:00Z",
            "priority": 2,
            "status": "open",
        },
        {
            "title": "Prep team standup",
            "due_at": f"{today_str}T15:30:00Z",
            "priority": 3,
            "status": "open",
        },
    ]

    for task in tasks:
        db.add_task(conn, **task)

    conn.close()
    print(f"Demo data seeded to {db_path}")

if __name__ == "__main__":
    seed(Path("ea.sqlite"))
