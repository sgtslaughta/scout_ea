"""Web Push — VAPID key management + send. Graceful if pywebpush is unavailable."""
from __future__ import annotations
import json


def _vapid_available() -> bool:
    """Check if pywebpush is installed and functional."""
    try:
        import pywebpush  # noqa
        return True
    except Exception:
        return False


def ensure_vapid(conn):
    """Return (public, private) VAPID keys; generate + persist in config on first use."""
    rows = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM config")}
    pub, priv = rows.get("vapid_public"), rows.get("vapid_private")
    if pub and priv:
        return pub, priv

    from py_vapid import Vapid01
    import base64

    v = Vapid01()
    v.generate_keys()

    # application server key (uncompressed public point, urlsafe-b64 no padding)
    pub_raw = v.public_key.public_bytes(
        __import__("cryptography.hazmat.primitives.serialization", fromlist=["Encoding"]).Encoding.X962,
        __import__("cryptography.hazmat.primitives.serialization", fromlist=["PublicFormat"]).PublicFormat.UncompressedPoint)
    pub = base64.urlsafe_b64encode(pub_raw).rstrip(b"=").decode()

    priv = base64.urlsafe_b64encode(
        v.private_key.private_numbers().private_value.to_bytes(32, "big")
    ).rstrip(b"=").decode()

    for k, val in (("vapid_public", pub), ("vapid_private", priv)):
        conn.execute(
            "INSERT INTO config(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (k, val))
    conn.commit()
    return pub, priv


def valid_push_endpoint(endpoint: str) -> bool:
    """SSRF guard: a push endpoint must be https and not target localhost/private/link-local.

    Hostnames (real push services) are accepted without DNS resolution; only literal
    private/loopback/link-local/reserved IPs and localhost names are rejected.
    """
    from urllib.parse import urlparse
    import ipaddress
    try:
        u = urlparse(endpoint or "")
    except Exception:
        return False
    if u.scheme != "https" or not u.hostname:
        return False
    host = u.hostname
    if host == "localhost" or host.endswith(".localhost"):
        return False
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return True  # public hostname
    return not (ip.is_private or ip.is_loopback or ip.is_link_local
                or ip.is_reserved or ip.is_multicast or ip.is_unspecified)


LOUD_REPEAT_MINUTES = 5
LOUD_REPEAT_MAX = 2   # initial send + 2 repeats = 3 notifications total


def _loud_severities(conn) -> set[str]:
    """Severity names that qualify for loud (repeat + sound) treatment. Empty set when 'off'."""
    cfg = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM config")}
    thr = cfg.get("alert_loud_threshold", "critical")
    if thr == "off":
        return set()
    if thr == "warning":
        return {"warning", "critical"}
    return {"critical"}   # 'critical' or any unrecognized value


def send_push(conn, title, body, loud=False, tag=None, claims_email="mailto:admin@scout-ea.local"):
    """Send a push to every subscription. Returns count sent. Deletes dead subs (404/410)."""
    if not _vapid_available():
        return 0

    from pywebpush import webpush, WebPushException
    from ea import db

    pub, priv = ensure_vapid(conn)
    payload = json.dumps({"title": title, "body": body, "loud": bool(loud), "tag": tag})
    sent = 0

    for s in db.list_subscriptions(conn):
        sub_info = {"endpoint": s["endpoint"], "keys": {"p256dh": s["p256dh"], "auth": s["auth"]}}
        try:
            webpush(
                subscription_info=sub_info,
                data=payload,
                vapid_private_key=priv,
                vapid_claims={"sub": claims_email}
            )
            sent += 1
        except WebPushException as e:
            code = getattr(getattr(e, "response", None), "status_code", None)
            if code in (404, 410):
                db.delete_subscription(conn, s["endpoint"])

    return sent


def push_pending_alerts(conn, limit=20) -> int:
    """Send Web Push for unpushed critical/warning alerts; mark them notified_push=1. Returns count sent.

    The web server is the single owner of push (no double-fire). No-op (returns 0) when
    pywebpush is unavailable or there are no subscriptions.
    """
    if not _vapid_available():
        return 0
    loud = _loud_severities(conn)
    rows = conn.execute(
        "SELECT id, title, body, severity FROM alerts "
        "WHERE notified_push=0 AND severity IN ('critical','warning') "
        "ORDER BY created_at DESC LIMIT ?", (int(limit),)).fetchall()
    sent = 0
    for a in rows:
        send_push(conn, a["title"], a["body"] or "",
                  loud=a["severity"] in loud, tag=f"alert-{a['id']}")
        conn.execute("UPDATE alerts SET notified_push=1 WHERE id=?", (a["id"],))
        sent += 1
    conn.commit()
    return sent


def repush_loud_alerts(conn, limit=20) -> int:
    """Re-push unacknowledged loud alerts, up to LOUD_REPEAT_MAX times, LOUD_REPEAT_MINUTES apart.
    Ack = status leaving 'unread' (repeats stop). Cadence anchored on updated_at (touch trigger
    re-anchors it each repeat). Returns count resent. No-op when threshold is 'off'."""
    if not _vapid_available():
        return 0
    loud = _loud_severities(conn)
    if not loud:
        return 0
    placeholders = ",".join("?" * len(loud))
    rows = conn.execute(
        f"SELECT id, title, body FROM alerts "
        f"WHERE status='unread' AND notified_push=1 AND severity IN ({placeholders}) "
        f"AND repeat_count < ? "
        f"AND datetime('now') >= datetime(updated_at, ?) "
        f"ORDER BY created_at DESC LIMIT ?",
        (*sorted(loud), LOUD_REPEAT_MAX, f"+{LOUD_REPEAT_MINUTES} minutes", int(limit))
    ).fetchall()
    sent = 0
    for a in rows:
        send_push(conn, a["title"], a["body"] or "", loud=True, tag=f"alert-{a['id']}")
        conn.execute("UPDATE alerts SET repeat_count = repeat_count + 1 WHERE id=?", (a["id"],))
        sent += 1
    if sent:
        conn.commit()
    return sent


# ponytail: table-driven scan; each entry = (tag, SQL with one ? for the lead offset).
# Add a row here to cover another time-anchored table. Signals excluded — occurred_at is past.
_REMINDER_SOURCES = [
    ("deadline", "SELECT id, title, due_at AS t FROM critical_deadlines "
                 "WHERE status='active' AND visible=1 "
                 "AND due_at BETWEEN datetime('now') AND datetime('now', ?)"),
    ("task", "SELECT id, title, due_at AS t FROM tasks "
             "WHERE status != 'done' AND due_at IS NOT NULL "
             "AND due_at BETWEEN datetime('now') AND datetime('now', ?)"),
    ("event", "SELECT id, title, chosen_time AS t FROM events "
              "WHERE status NOT IN ('cancelled','declined') AND chosen_time IS NOT NULL "
              "AND chosen_time BETWEEN datetime('now') AND datetime('now', ?)"),
    ("news", "SELECT id, title, event_at AS t FROM news_items "
             "WHERE status != 'dismissed' AND event_at IS NOT NULL "
             "AND event_at BETWEEN datetime('now') AND datetime('now', ?)"),
]


def generate_due_reminders(conn) -> int:
    """Insert a 'warning' alert for each item whose due time falls within the reminder
    lead window and that has no alert yet. Deduped on alerts.source_table+source_id.
    Returns the number of alerts inserted. No-op when reminder_enabled != '1'."""
    cfg = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM config")}
    if cfg.get("reminder_enabled", "1") != "1":
        return 0
    try:
        lead = int(cfg.get("reminder_lead_minutes", "15"))
    except (TypeError, ValueError):
        lead = 15
    if lead < 1:
        lead = 15
    offset = f"+{lead} minutes"

    inserted = 0
    for tag, sql in _REMINDER_SOURCES:
        for r in conn.execute(sql, (offset,)).fetchall():
            dup = conn.execute(
                "SELECT 1 FROM alerts WHERE source_table=? AND source_id=?",
                (tag, r["id"])).fetchone()
            if dup:
                continue
            conn.execute(
                "INSERT INTO alerts (severity, title, body, source_table, source_id, status) "
                "VALUES ('warning', ?, ?, ?, ?, 'unread')",
                # ponytail: relative phrasing avoids UTC-vs-local tz mismatch in the notification
                (f"Due soon: {r['title']}", f"Due within {lead} minutes", tag, r["id"]))
            inserted += 1
    if inserted:
        conn.commit()
    return inserted
