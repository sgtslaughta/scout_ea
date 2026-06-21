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


def send_push(conn, title, body, claims_email="mailto:admin@scout-ea.local"):
    """Send a push to every subscription. Returns count sent. Deletes dead subs (404/410)."""
    if not _vapid_available():
        return 0

    from pywebpush import webpush, WebPushException
    from ea import db

    pub, priv = ensure_vapid(conn)
    payload = json.dumps({"title": title, "body": body})
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
