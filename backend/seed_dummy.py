"""Populate the wired dashboard surfaces with believable demo data.

For looking at the UI before Scout is running on the host. Everything it
writes is tagged so it can be removed again:

    python seed_dummy.py            # insert / refresh
    python seed_dummy.py --clear    # remove only what this script wrote

Records use a "demo:" external_ref prefix and events/tasks a "demo:" prefix
too, so --clear never touches real Scout-written rows.
"""
import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

PREFIX = "demo:"


def _iso(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat()


def _emails(now):
    return [
        ("kim", "Priya Raman", "priya.raman@contoso.com",
         "Re: Q3 renewal — legal has questions",
         "Legal came back on the indemnity clause. Can we get 20 minutes Thursday?",
         now - timedelta(minutes=25), True, True, "Inbox"),
        ("kim2", "Dr. Vance", "vance@acme.com",
         "Board deck for the RVP visit",
         "Attaching the draft. Slide 6 is the one I want your read on.",
         now - timedelta(hours=2), True, False, "Inbox"),
        ("kim3", "Julie Park", "julie.park@acme.com",
         "Innovation Hub — March slots",
         "Two slots opened up in March. Do you want either for Contoso?",
         now - timedelta(hours=5), False, False, "Inbox"),
        ("kim4", "Mike Chen", "mike.chen@acme.com",
         "MACC consumption is tracking under plan",
         "We're about 12% under for the quarter. Worth a conversation.",
         now - timedelta(days=1, hours=3), True, False, "Inbox"),
        ("kim5", "Priya Raman", "priya.raman@contoso.com",
         "Thanks for the intro",
         "Connected with the Azure team this morning — really useful.",
         now - timedelta(days=2), False, False, "Archive"),
    ]


def _chats(now):
    return [
        ("t1", "Dr. Vance", "vance@acme.com", "RVP visit prep",
         "@you can you own the customer plan section?",
         now - timedelta(minutes=8), True, True),
        ("t2", "Julie Park", "julie.park@acme.com", "Contoso EBC",
         "Planner confirmed for the 14th.",
         now - timedelta(minutes=50), True, False),
        ("t3", "Mike Chen", "mike.chen@acme.com", "Pipeline review",
         "Pushed two opps to next quarter — flagging so the forecast lines up.",
         now - timedelta(hours=6), False, False),
        ("t4", "Priya Raman", "priya.raman@contoso.com", "Quick one",
         "Are you in the office Thursday?",
         now - timedelta(days=1), False, False),
    ]


def _events(now):
    join = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_demo%40thread.v2/0"
    # Relative to now so the rail always has something upcoming to show,
    # whenever the script happens to be run.
    return [
        ("Contoso renewal sync", now + timedelta(minutes=40),
         f"Working session on the indemnity clause. Join: {join}"),
        ("RVP territory review", now + timedelta(hours=2),
         f"Bring the customer plan. Join: {join}"),
        ("1:1 — Julie Park", now + timedelta(hours=4),
         "Coffee, no agenda."),
        ("Innovation Hub planning", now + timedelta(days=1, hours=2),
         f"March slot allocation. Join: {join}"),
        ("Quarterly forecast call", now + timedelta(days=2, hours=1),
         f"Numbers due the day before. Join: {join}"),
    ]


def seed(conn, now):
    counts = {"email": 0, "chat": 0, "events": 0}

    for ref, sender, addr, subject, preview, at, unread, mention, folder in _emails(now):
        conn.execute(
            "INSERT INTO records(kind, external_ref, data, status) VALUES('email',?,?,'active') "
            "ON CONFLICT(external_ref) DO UPDATE SET data=excluded.data",
            (PREFIX + ref, json.dumps({
                "from": sender, "fromEmail": addr, "subject": subject,
                "preview": preview, "receivedAt": _iso(at),
                "isUnread": unread, "isMention": mention,
                "webUrl": "https://outlook.office.com/mail/", "folder": folder,
            })))
        counts["email"] += 1

    for ref, sender, addr, topic, preview, at, unread, mention in _chats(now):
        conn.execute(
            "INSERT INTO records(kind, external_ref, data, status) VALUES('chat',?,?,'active') "
            "ON CONFLICT(external_ref) DO UPDATE SET data=excluded.data",
            (PREFIX + ref, json.dumps({
                "from": sender, "fromEmail": addr, "topic": topic,
                "preview": preview, "receivedAt": _iso(at),
                "isUnread": unread, "isMention": mention,
                "webUrl": "https://teams.microsoft.com/",
            })))
        counts["chat"] += 1

    for i, (title, when, body) in enumerate(_events(now)):
        conn.execute(
            "INSERT INTO events(title, body, chosen_time, status, external_ref) "
            "VALUES(?,?,?,'confirmed',?) "
            "ON CONFLICT(external_ref) DO UPDATE SET chosen_time=excluded.chosen_time, body=excluded.body",
            (title, body, _iso(when), f"{PREFIX}evt{i}"))
        counts["events"] += 1

    conn.commit()
    return counts


def clear(conn):
    cur = conn.execute("DELETE FROM records WHERE external_ref LIKE ?", (PREFIX + "%",))
    n = cur.rowcount
    cur = conn.execute("DELETE FROM events WHERE external_ref LIKE ?", (PREFIX + "%",))
    n += cur.rowcount
    conn.commit()
    return n


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--clear", action="store_true", help="remove demo rows and exit")
    ap.add_argument("--db", default=os.environ.get("EA_DB_PATH", "../ea.sqlite"))
    args = ap.parse_args()

    path = Path(args.db)
    if not path.exists():
        print(f"no database at {path}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(path)
    try:
        if args.clear:
            print(f"removed {clear(conn)} demo rows")
        else:
            counts = seed(conn, datetime.now(timezone.utc))
            print("seeded " + ", ".join(f"{v} {k}" for k, v in counts.items()))
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
