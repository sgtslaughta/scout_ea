"""Web Push backend tests — no real network calls (monkeypatched)."""
import json
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient
from pywebpush import WebPushException
from ea import db
from web.app import create_app


def test_subscribe_and_list(tmp_path):
    """POST /api/push/subscribe adds subscription; duplicate endpoint upserts (still 1)."""
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    conn = db.get_conn(p)

    # Subscribe first time
    n = db.add_subscription(conn, "https://push.example.com/1", "p256dh_key_1", "auth_key_1")
    assert n == 1

    # List should have 1
    subs = db.list_subscriptions(conn)
    assert len(subs) == 1
    assert subs[0]["endpoint"] == "https://push.example.com/1"

    # Upsert with same endpoint
    n = db.add_subscription(conn, "https://push.example.com/1", "p256dh_key_updated", "auth_key_updated")
    assert n == 1

    # List should still have 1 (upserted, not duplicate)
    subs = db.list_subscriptions(conn)
    assert len(subs) == 1
    assert subs[0]["p256dh"] == "p256dh_key_updated"
    assert subs[0]["auth"] == "auth_key_updated"


def test_vapid_key_endpoint(tmp_path):
    """GET /api/push/vapid-key returns a publicKey string of length > 80."""
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    c = TestClient(create_app(p))

    resp = c.get("/api/push/vapid-key")
    assert resp.status_code == 200
    body = resp.json()
    assert "publicKey" in body
    assert isinstance(body["publicKey"], str)
    assert len(body["publicKey"]) > 80


def test_send_push_iterates_subs(tmp_path, monkeypatch):
    """Seed 2 subs; monkeypatch webpush to a recorder; send_push returns 2."""
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    conn = db.get_conn(p)

    # Seed 2 subscriptions
    db.add_subscription(conn, "https://push.example.com/1", "p256dh_1", "auth_1")
    db.add_subscription(conn, "https://push.example.com/2", "p256dh_2", "auth_2")

    # Mock webpush
    calls = []
    def fake_webpush(subscription_info, data, vapid_private_key, vapid_claims):
        calls.append({
            "subscription_info": subscription_info,
            "data": data,
            "vapid_private_key": vapid_private_key,
            "vapid_claims": vapid_claims,
        })

    monkeypatch.setattr("pywebpush.webpush", fake_webpush)

    from lib import push
    sent = push.send_push(conn, "Test Title", "Test Body")

    assert sent == 2
    assert len(calls) == 2
    # Verify payload was JSON
    payload = json.loads(calls[0]["data"])
    assert payload["title"] == "Test Title"
    assert payload["body"] == "Test Body"


def test_send_push_deletes_dead_sub(tmp_path, monkeypatch):
    """Monkeypatch webpush to raise 410 for one endpoint; that sub is deleted."""
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    conn = db.get_conn(p)

    # Seed 2 subscriptions
    db.add_subscription(conn, "https://push.example.com/1", "p256dh_1", "auth_1")
    db.add_subscription(conn, "https://push.example.com/2", "p256dh_2", "auth_2")

    # Mock webpush: raise 410 for first endpoint, succeed for second
    call_count = [0]
    def fake_webpush(subscription_info, data, vapid_private_key, vapid_claims):
        call_count[0] += 1
        if call_count[0] == 1:
            # Raise 410 for first sub
            fake_response = Mock()
            fake_response.status_code = 410
            exc = WebPushException("Gone")
            exc.response = fake_response
            raise exc
        # Second call succeeds

    monkeypatch.setattr("pywebpush.webpush", fake_webpush)

    from lib import push
    sent = push.send_push(conn, "Test", "Test")

    # Should have sent to 1 (the second one; first was deleted)
    assert sent == 1

    # Verify first sub is deleted, second remains
    remaining = db.list_subscriptions(conn)
    assert len(remaining) == 1
    assert remaining[0]["endpoint"] == "https://push.example.com/2"


def test_unsubscribe(tmp_path):
    """Subscribe then unsubscribe removes it."""
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    conn = db.get_conn(p)

    # Subscribe
    db.add_subscription(conn, "https://push.example.com/test", "p256dh", "auth")
    subs = db.list_subscriptions(conn)
    assert len(subs) == 1

    # Unsubscribe
    n = db.delete_subscription(conn, "https://push.example.com/test")
    assert n == 1

    # Verify deleted
    subs = db.list_subscriptions(conn)
    assert len(subs) == 0


def test_subscribe_post_endpoint(tmp_path):
    """POST /api/push/subscribe via HTTP."""
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    c = TestClient(create_app(p))

    body = {
        "endpoint": "https://push.example.com/http-test",
        "keys": {"p256dh": "key_p256dh", "auth": "key_auth"}
    }
    resp = c.post("/api/push/subscribe", json=body)
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}

    # Verify stored
    conn = db.get_conn(p)
    subs = db.list_subscriptions(conn)
    assert len(subs) == 1
    assert subs[0]["endpoint"] == "https://push.example.com/http-test"


def test_unsubscribe_post_endpoint(tmp_path):
    """POST /api/push/unsubscribe via HTTP."""
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    c = TestClient(create_app(p))

    # First subscribe
    body = {
        "endpoint": "https://push.example.com/unsub-test",
        "keys": {"p256dh": "key_p256dh", "auth": "key_auth"}
    }
    c.post("/api/push/subscribe", json=body)

    # Unsubscribe
    resp = c.post("/api/push/unsubscribe", json=body)
    assert resp.status_code == 200
    assert resp.json()["removed"] == 1


def test_push_test_endpoint(tmp_path, monkeypatch):
    """POST /api/push/test sends a notification to all subs."""
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    c = TestClient(create_app(p))

    # Subscribe one client
    sub_body = {
        "endpoint": "https://push.example.com/test-endpoint",
        "keys": {"p256dh": "p256dh_test", "auth": "auth_test"}
    }
    c.post("/api/push/subscribe", json=sub_body)

    # Mock webpush
    calls = []
    def fake_webpush(subscription_info, data, vapid_private_key, vapid_claims):
        calls.append(True)

    monkeypatch.setattr("pywebpush.webpush", fake_webpush)

    # Call test endpoint
    resp = c.post("/api/push/test")
    assert resp.status_code == 200
    assert resp.json()["sent"] == 1
    assert len(calls) == 1


def test_push_pending_alerts_marks_and_counts(tmp_path, monkeypatch):
    """push_pending_alerts sends critical alerts and marks notified_push=1."""
    import pywebpush
    from lib import push

    calls = []
    monkeypatch.setattr(pywebpush, "webpush", lambda **kw: calls.append(kw))

    p = tmp_path / "ea.sqlite"
    conn = db.init_db(p, seed_path=db.DEFAULT_SEED)
    db.add_subscription(conn, "https://push/ep1", "p", "a")
    conn.execute("INSERT INTO alerts (severity,title,body,status) VALUES ('critical','P1 mtg','Dr. Vance','unread')")
    conn.execute("INSERT INTO alerts (severity,title,body,status) VALUES ('warning','low','x','unread')")
    conn.commit()

    n = push.push_pending_alerts(conn)
    assert n == 1                                  # only the critical one
    assert len(calls) == 1                          # one sub
    row = conn.execute("SELECT notified_push FROM alerts WHERE severity='critical'").fetchone()
    assert row["notified_push"] == 1
    # second run: already marked -> nothing new
    assert push.push_pending_alerts(conn) == 0
