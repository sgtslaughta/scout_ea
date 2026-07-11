"""FTS5 super-search: sanitizer, rebuild, endpoint."""
from fastapi.testclient import TestClient
from ea import db
from web.app import create_app
from lib import search as s


def _conn(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    conn = db.get_conn(p)
    conn.execute("INSERT INTO tasks(title, detail, priority, status) VALUES('Budget review','Q3 numbers',1,'open')")
    conn.execute("INSERT INTO topics(name, description, priority, max_suggest) VALUES('Budgeting','money',1,1)")
    conn.execute("INSERT INTO people(name, role, org, importance, notes, active) VALUES('Jane Doe','CFO','Acme',5,'runs budgets',1)")
    conn.commit()
    return conn, p


def test_fts_query_sanitizes():
    assert s._fts_query('a "b" c!') == "a* b* c*"
    assert s._fts_query("   ") is None
    assert s._fts_query("") is None


def test_search_finds_across_kinds(tmp_path):
    conn, _ = _conn(tmp_path)
    kinds = {r["kind"] for r in s.search(conn, "budg")}
    assert kinds == {"task", "topic", "person"}  # prefix 'budg' hits all three


def test_search_prefix_and_empty(tmp_path):
    conn, _ = _conn(tmp_path)
    assert any(r["title"] == "Budget review" for r in s.search(conn, "review"))
    assert s.search(conn, "") == []
    assert s.search(conn, "!!!") == []  # no alnum tokens


def test_search_special_char_does_not_raise(tmp_path):
    conn, _ = _conn(tmp_path)
    # a bare quote would break a raw MATCH; sanitizer must neutralize it
    assert s.search(conn, 'budget"') is not None


def test_rebuild_reflects_new_row(tmp_path):
    conn, _ = _conn(tmp_path)
    assert not any(r["title"] == "Zebra task" for r in s.search(conn, "zebra"))
    conn.execute("INSERT INTO tasks(title, priority, status) VALUES('Zebra task',3,'open')")
    conn.commit()
    assert any(r["title"] == "Zebra task" for r in s.search(conn, "zebra"))


def test_search_endpoint(tmp_path):
    conn, p = _conn(tmp_path)
    conn.close()
    c = TestClient(create_app(p))
    body = c.get("/api/search?q=budget").json()
    assert any(r["kind"] == "task" and "Budget" in r["title"] for r in body)
    assert c.get("/api/search?q=").json() == []
