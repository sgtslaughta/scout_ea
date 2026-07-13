"""Seed realistic demo data for the Scout EA dashboard."""
import json
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
            "summary": "Julie Park's birthday is Thursday. She mentioned wanting the team offsite moved — a card + quick note lands well before the planning meeting.",
            "status": "new",
            "priority": 1,
            "impact": 84,
        },
        # Triaged signal, P2
        {
            "external_ref": "demo:signal:2",
            "type": "email",
            "source": "email",
            "title": "Q3 roadmap review required by EOD",
            "summary": "Finance is blocked on the headcount line until you sign off the Q3 roadmap. Slips the whole planning cycle a week if it misses today.",
            "status": "new",
            "priority": 2,
            "impact": 91,
        },
        # Triaged signal, P3
        {
            "external_ref": "demo:signal:3",
            "type": "email",
            "source": "email",
            "title": "New feature request from beta testers",
            "summary": "Three beta accounts asked for bulk-export this week. Low urgency but a recurring theme worth logging for the backlog.",
            "status": "new",
            "priority": 3,
            "impact": 38,
        },
        # Proactive — risk
        {
            "external_ref": "demo:signal:proactive:1",
            "type": "proactive",
            "source": "briefing",
            "source_skill": "daily_briefing",
            "title": "Acme renewal at risk",
            "summary": "No reply from Dr. Vance on the renewal thread for 4 days; contract lapses end of month. Nudge today or loop in the account lead.",
            "who": "Dr. Vance", "what": "contract renewal", "when_rel": "today",
            "why": "4 days silent, expires this month",
            "status": "new",
            "priority": 1,
            "polarity": "risk",
            "impact": 88,
        },
        # Proactive — opportunity
        {
            "external_ref": "demo:signal:proactive:2",
            "type": "proactive",
            "source": "briefing",
            "source_skill": "daily_briefing",
            "title": "Julie opened door to expansion",
            "summary": "Julie hinted the platform team wants agentic workflows next quarter — a warm intro to their lead could seed a second contract.",
            "who": "Julie Park", "what": "expansion opening", "when_rel": "this week",
            "why": "expressed interest, budget cycle open",
            "status": "new",
            "priority": 2,
            "polarity": "opportunity",
            "impact": 72,
        },
    ]

    for sig in signals:
        db.upsert_signal(conn, **sig)

    # ~3 critical_deadlines with varying due_at (one <24h, one far future, one normal)
    deadlines = [
        {
            "external_ref": "demo:deadline:1",
            "title": "Q3 roadmap review",
            "detail": "Sign-off unblocks Finance's headcount line. Deck is ready in the shared drive.",
            "due_at": (NOW + timedelta(hours=6, minutes=23)).isoformat(),
            "source": "email",
            "status": "active",
            "visible": 1,
            "priority": 1,
        },
        {
            "external_ref": "demo:deadline:2",
            "title": "Budget approval",
            "detail": "Q3 budget needs your approval before the finance close on Friday.",
            "due_at": (NOW + timedelta(days=1, hours=4)).isoformat(),
            "source": "email",
            "status": "active",
            "visible": 1,
            "priority": 2,
        },
        {
            "external_ref": "demo:deadline:3",
            "title": "Team sync prep",
            "detail": "Pull the three blockers from the board and draft talking points for standup.",
            "due_at": (NOW + timedelta(minutes=28)).isoformat(),
            "source": "email",
            "status": "active",
            "visible": 1,
            "priority": 3,
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
            "detail": "Check the funnel + retention deltas before the roadmap sign-off; flag anything off-trend.",
            "due_at": f"{today_str}T17:00:00Z",
            "priority": 2,
            "status": "open",
        },
        {
            "title": "Prep team standup",
            "detail": "Draft the three-blocker summary and confirm the demo slot with Mike.",
            "due_at": f"{today_str}T15:30:00Z",
            "priority": 3,
            "status": "open",
        },
    ]

    for task in tasks:
        db.add_task(conn, **task)

    # ~4 skill runs with varied skills, items_created, and one error status
    skill_runs = [
        {"skill": "triage_email", "items_created": 5},
        {"skill": "parse_deadlines", "items_created": 2},
        {"skill": "compute_trends", "items_created": 8},
        {"skill": "daily_briefing", "items_created": 0, "status": "error", "note": "API timeout"},
    ]

    for run in skill_runs:
        db.add_skill_run(conn, **run)

    # More signals — varied types + statuses (so Inbox filters have content)
    more_signals = [
        {"external_ref": "demo:signal:4", "type": "teams", "source": "teams",
         "source_skill": "triage_teams", "title": "Mike: can we get RVP into the launch review?",
         "status": "new", "priority": 2},
        {"external_ref": "demo:signal:5", "type": "research", "source": "email",
         "source_skill": "extract_research_training_email",
         "title": "Webinar: Agentic workflows in production (Thu 2pm)",
         "status": "triaged", "priority": 3},
        {"external_ref": "demo:signal:6", "type": "email", "source": "email",
         "title": "Re: contract renewal — needs your sign-off", "status": "actioned", "priority": 2},
        {"external_ref": "demo:signal:7", "type": "email", "source": "email",
         "title": "FYI newsletter — weekly digest", "status": "dismissed", "priority": 5},
    ]
    for sig in more_signals:
        db.upsert_signal(conn, **sig)

    # More tasks — varied statuses
    for task in [
        {"title": "Draft launch announcement", "detail": "First pass for marketing review",
         "due_at": iso_offset(48), "priority": 2, "status": "in_progress"},
        {"title": "Approve vendor invoice", "due_at": iso_offset(-24), "priority": 2, "status": "done"},
        {"title": "Book travel for RVP visit", "due_at": iso_offset(72), "priority": 3, "status": "open"},
    ]:
        db.add_task(conn, **task)

    # Calendar events — agenda + approvals (suggested events get Approve/Reject in the UI)
    events = [
        {"external_ref": "demo:event:1", "title": "Sync with Dr. Vance",
         "body": "Align on Q3 roadmap and RVP asks.",
         "proposed_times": json.dumps([iso_offset(26), iso_offset(28), iso_offset(50)]),
         "attendees": json.dumps([1]), "status": "suggested"},
        {"external_ref": "demo:event:2", "title": "Q3 planning review",
         "body": "Lock the roadmap for next quarter.",
         "chosen_time": iso_offset(30), "attendees": json.dumps([1, 2, 3]), "status": "approved"},
        {"external_ref": "demo:event:3", "title": "1:1 with Mike Chen",
         "proposed_times": json.dumps([iso_offset(5), iso_offset(7)]),
         "attendees": json.dumps([2]), "status": "suggested"},
    ]
    for ev in events:
        conn.execute(
            "INSERT INTO events (title, body, proposed_times, chosen_time, attendees, status, external_ref) "
            "VALUES (:title, :body, :proposed_times, :chosen_time, :attendees, :status, :external_ref) "
            "ON CONFLICT(external_ref) DO NOTHING",
            {"body": None, "proposed_times": None, "chosen_time": None, "attendees": None, **ev},
        )

    # Key personnel + research topics (for People/Topics, and to resolve attendees)
    # importance: higher = more important (matches briefing ranking)
    people = [
        (1, "Dr. Vance", "Regional VP", "Acme Corp", 5, "Owns the renewal decision; silent 4 days — top of the follow-up list."),
        (2, "Mike Chen", "Engineering Lead", "Acme Corp", 4, "Driving the launch review; wants RVP in the room."),
        (3, "Julie Park", "Product Manager", "Acme Corp", 3, "Birthday Thursday; hinted at a Q4 expansion opening."),
    ]
    for pid, name, role, org, importance, notes in people:
        conn.execute(
            "INSERT INTO people (id, name, role, org, importance, notes) VALUES (?,?,?,?,?,?) "
            "ON CONFLICT(id) DO NOTHING", (pid, name, role, org, importance, notes))
    for tid, name, desc, prio in [
        (1, "AI agents", "Autonomous agent frameworks and tooling", 2),
        (2, "Cloud security", "Posture, IAM, and zero-trust developments", 2),
        (3, "Product analytics", "Activation, retention, and funnel tooling", 3),
    ]:
        conn.execute(
            "INSERT INTO topics (id, name, description, priority) VALUES (?,?,?,?) "
            "ON CONFLICT(id) DO NOTHING", (tid, name, desc, prio))

    # Learning items (research/training queue)
    for kind, source, title, synopsis, ext in [
        ("read", "web", "How agentic RAG cuts hallucination", "Survey of retrieval-augmented agents.", "demo:learn:1"),
        ("webinar", "email", "Zero-trust for AI workloads", "Live session Thursday 2pm.", "demo:learn:2"),
        ("course", "web", "Product analytics foundations", "4-week self-paced.", "demo:learn:3"),
    ]:
        conn.execute(
            "INSERT INTO learning (kind, source, title, synopsis, external_ref, status) "
            "VALUES (?,?,?,?,?,'suggested') ON CONFLICT(external_ref) DO NOTHING",
            (kind, source, title, synopsis, ext))

    # Trend findings (drill-down for /trending)
    db.add_trend_finding(conn, title="Anthropic ships agent SDK update", url="https://example.com/a",
                         external_ref="https://example.com/a", source="news", relevance=1)
    db.add_trend_finding(conn, title="OSS framework hits 20k stars", url="https://example.com/b",
                         external_ref="https://example.com/b", source="web", relevance=2)

    # Alerts (severity bar / unread count)
    for sev, title in [("critical", "P1 meeting request — Dr. Vance"), ("warning", "Reply needed — contract renewal")]:
        conn.execute("INSERT INTO alerts (severity, title, status) VALUES (?,?,'unread')", (sev, title))

    conn.commit()
    conn.close()
    print(f"Demo data seeded to {db_path}")

if __name__ == "__main__":
    seed(Path("ea.sqlite"))
