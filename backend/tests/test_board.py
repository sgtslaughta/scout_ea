"""Tests for board columns CRUD and board column integration with tasks."""
from fastapi.testclient import TestClient
from ea import db
from web.app import create_app
import sqlite3


def _client(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    return TestClient(create_app(p))


def test_init_db_seeds_exactly_3_columns(tmp_path):
    """init_db creates exactly 3 default board columns after migration."""
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    conn = db.get_conn(p)
    rows = conn.execute("SELECT * FROM board_columns ORDER BY position, id").fetchall()
    assert len(rows) == 3
    assert rows[0]["name"] == "To Do" and rows[0]["position"] == 0
    assert rows[1]["name"] == "In Progress" and rows[1]["position"] == 1
    assert rows[2]["name"] == "Done" and rows[2]["position"] == 2


def test_init_db_is_idempotent_no_dupe_columns(tmp_path):
    """Re-running init_db is idempotent: still 3 columns, no dupe, no ALTER error."""
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    # Run init again
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    conn = db.get_conn(p)
    rows = conn.execute("SELECT * FROM board_columns ORDER BY position, id").fetchall()
    assert len(rows) == 3
    names = [r["name"] for r in rows]
    assert names == ["To Do", "In Progress", "Done"]


def test_init_db_maps_existing_tasks_to_columns(tmp_path):
    """Init maps existing tasks by status to board_columns: open→To Do, in_progress→In Progress, done→Done."""
    p = tmp_path / "ea.sqlite"
    # Init schema without seed, add tasks manually, then init with migration (no seed)
    conn = db.get_conn(p)
    conn.executescript(db.Path(db.DEFAULT_SCHEMA).read_text())
    conn.executescript(db.Path(db.DEFAULT_FEATURES).read_text())
    conn.commit()

    # Add tasks without board_column_id mapping
    tid_open = db.add_task(conn, title="Open task", priority=1, status="open")
    tid_in_prog = db.add_task(conn, title="In progress task", priority=1, status="in_progress")
    tid_done = db.add_task(conn, title="Done task", priority=1, status="done")

    # Now run the migration which should map existing tasks
    db._migrate(conn)

    # Check tasks are mapped
    task_open = conn.execute("SELECT board_column_id FROM tasks WHERE id=?", (tid_open,)).fetchone()
    task_in_prog = conn.execute("SELECT board_column_id FROM tasks WHERE id=?", (tid_in_prog,)).fetchone()
    task_done = conn.execute("SELECT board_column_id FROM tasks WHERE id=?", (tid_done,)).fetchone()

    # Get column ids
    to_do = conn.execute("SELECT id FROM board_columns WHERE name='To Do'").fetchone()
    in_progress = conn.execute("SELECT id FROM board_columns WHERE name='In Progress'").fetchone()
    done = conn.execute("SELECT id FROM board_columns WHERE name='Done'").fetchone()

    assert task_open["board_column_id"] == to_do["id"]
    assert task_in_prog["board_column_id"] == in_progress["id"]
    assert task_done["board_column_id"] == done["id"]


def test_get_board_columns_lists_all_columns(tmp_path):
    """GET /api/board/columns returns list of all columns ordered by position."""
    client = _client(tmp_path)
    r = client.get("/api/board/columns")
    assert r.status_code == 200
    cols = r.json()
    assert len(cols) == 3
    assert cols[0]["name"] == "To Do"
    assert cols[1]["name"] == "In Progress"
    assert cols[2]["name"] == "Done"


def test_post_board_columns_adds_column_at_next_position(tmp_path):
    """POST /api/board/columns creates a new column at next position."""
    client = _client(tmp_path)
    r = client.post("/api/board/columns", json={"name": "Review"})
    assert r.status_code == 200
    data = r.json()
    assert "id" in data
    col_id = data["id"]

    # Verify it's in the list
    r = client.get("/api/board/columns")
    cols = r.json()
    assert len(cols) == 4
    new_col = [c for c in cols if c["id"] == col_id][0]
    assert new_col["name"] == "Review"
    assert new_col["position"] == 3


def test_patch_board_columns_renames_and_reorders(tmp_path):
    """PATCH /api/board/columns/{id} updates name and position."""
    client = _client(tmp_path)
    # Get current columns
    r = client.get("/api/board/columns")
    cols = r.json()
    col_id = cols[0]["id"]  # To Do

    # Rename and move
    r = client.patch(f"/api/board/columns/{col_id}", json={"name": "Backlog", "position": 2})
    assert r.status_code == 200

    # Verify
    r = client.get("/api/board/columns")
    cols = r.json()
    updated = [c for c in cols if c["id"] == col_id][0]
    assert updated["name"] == "Backlog"
    assert updated["position"] == 2


def test_patch_board_columns_returns_404_if_not_found(tmp_path):
    """PATCH /api/board/columns/{id} returns 404 if not found."""
    client = _client(tmp_path)
    r = client.patch("/api/board/columns/9999", json={"name": "X"})
    assert r.status_code == 404


def test_delete_board_columns_reassigns_tasks_then_removes(tmp_path):
    """DELETE reassigns column's tasks to lowest-position remaining column, then deletes."""
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    conn = db.get_conn(p)

    # Add a task to "To Do" column
    to_do = conn.execute("SELECT id FROM board_columns WHERE name='To Do'").fetchone()
    tid = db.add_task(conn, title="Task in To Do", priority=1, status="open")
    conn.execute("UPDATE tasks SET board_column_id=? WHERE id=?", (to_do["id"], tid))
    conn.commit()

    client = TestClient(create_app(p))

    # Delete "To Do"
    r = client.delete(f"/api/board/columns/{to_do['id']}")
    assert r.status_code == 200

    # Verify task reassigned to In Progress (lowest remaining)
    task = conn.execute("SELECT board_column_id FROM tasks WHERE id=?", (tid,)).fetchone()
    in_progress = conn.execute("SELECT id FROM board_columns WHERE name='In Progress'").fetchone()
    assert task["board_column_id"] == in_progress["id"]

    # Verify column deleted
    r = client.get("/api/board/columns")
    cols = r.json()
    assert len(cols) == 2
    names = [c["name"] for c in cols]
    assert "To Do" not in names


def test_delete_board_columns_returns_404_if_not_found(tmp_path):
    """DELETE /api/board/columns/{id} returns 404 if not found."""
    client = _client(tmp_path)
    r = client.delete("/api/board/columns/9999")
    assert r.status_code == 404


def test_patch_task_with_board_column_id_moves_card(tmp_path):
    """PATCH /api/tasks/{id} with board_column_id moves the task to that column."""
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    conn = db.get_conn(p)

    # Add task
    tid = db.add_task(conn, title="Task", priority=1, status="open")

    # Get columns
    to_do = conn.execute("SELECT id FROM board_columns WHERE name='To Do'").fetchone()
    done = conn.execute("SELECT id FROM board_columns WHERE name='Done'").fetchone()

    # Assign to To Do
    conn.execute("UPDATE tasks SET board_column_id=? WHERE id=?", (to_do["id"], tid))
    conn.commit()

    client = TestClient(create_app(p))

    # Move to Done via PATCH
    r = client.patch(f"/api/tasks/{tid}", json={"board_column_id": done["id"]})
    assert r.status_code == 200

    # Verify
    task = conn.execute("SELECT board_column_id FROM tasks WHERE id=?", (tid,)).fetchone()
    assert task["board_column_id"] == done["id"]


def test_patch_task_with_invalid_column_id_fails(tmp_path):
    """Moving a task to a non-existent column violates the FK -> 400 (not silent)."""
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    conn = db.get_conn(p)
    tid = db.add_task(conn, title="x", priority=3, status="open")
    c = TestClient(create_app(p))
    r = c.patch(f"/api/tasks/{tid}", json={"board_column_id": 9999})
    assert r.status_code == 400


def test_delete_last_column_nulls_tasks(tmp_path):
    """Deleting every column reassigns down to the last, then NULL on the final delete."""
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    conn = db.get_conn(p)
    tid = db.add_task(conn, title="x", priority=3, status="open")
    cols = [r["id"] for r in conn.execute("SELECT id FROM board_columns ORDER BY position")]
    c = TestClient(create_app(p))
    for cid in cols:
        assert c.delete(f"/api/board/columns/{cid}").status_code == 200
    assert conn.execute("SELECT count(*) FROM board_columns").fetchone()[0] == 0
    row = db.get_conn(p).execute("SELECT board_column_id FROM tasks WHERE id=?", (tid,)).fetchone()
    assert row["board_column_id"] is None


def test_default_columns_have_mapped_statuses(tmp_path):
    p = tmp_path / "ea.sqlite"
    db.init_db(p, seed_path=db.DEFAULT_SEED)
    conn = db.get_conn(p)
    rows = {r["name"]: r["status"] for r in conn.execute("SELECT name, status FROM board_columns")}
    assert rows == {"To Do": "open", "In Progress": "in_progress", "Done": "done"}


def test_add_column_with_status_and_update(tmp_path):
    c = _client(tmp_path)
    cid = c.post("/api/board/columns", json={"name": "Blocked", "status": "in_progress"}).json()["id"]
    got = [col for col in c.get("/api/board/columns").json() if col["id"] == cid][0]
    assert got["status"] == "in_progress"
    assert c.patch(f"/api/board/columns/{cid}", json={"status": "done"}).json() == {"updated": 1}
    got2 = [col for col in c.get("/api/board/columns").json() if col["id"] == cid][0]
    assert got2["status"] == "done"


def test_invalid_status_rejected(tmp_path):
    c = _client(tmp_path)
    assert c.post("/api/board/columns", json={"name": "X", "status": "bogus"}).status_code == 400
    cid = c.get("/api/board/columns").json()[0]["id"]
    assert c.patch(f"/api/board/columns/{cid}", json={"status": "bogus"}).status_code == 400
