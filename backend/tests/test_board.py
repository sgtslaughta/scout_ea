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
