"""FastAPI app over EA_DB — browser-facing surface."""
from __future__ import annotations
import json
import uuid
from pathlib import Path
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from ea import db
from web import changes
from lib import deadlines as _deadlines


class StatusBody(BaseModel):
    status: str


class DeadlineBody(BaseModel):
    title: str
    due_at: str
    detail: str | None = None


class VisibleBody(BaseModel):
    visible: bool


def _rows(conn, sql, params=()):
    return [dict(r) for r in conn.execute(sql, params).fetchall()]


def create_app(db_path) -> FastAPI:
    app = FastAPI(title="Scout EA")
    db_path = Path(db_path)

    def get_db():
        conn = db.get_conn(db_path)
        try:
            yield conn
        finally:
            conn.close()

    app.state.get_db = get_db

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/config")
    def get_config(conn=Depends(get_db)):
        rows = conn.execute("SELECT key, value FROM config").fetchall()
        return {r["key"]: r["value"] for r in rows}

    @app.get("/api/signals")
    def list_signals(status: str | None = None, conn=Depends(get_db)):
        if status:
            return _rows(conn,
                "SELECT * FROM signals WHERE status=? ORDER BY created_at DESC, id DESC",
                (status,))
        return _rows(conn, "SELECT * FROM signals ORDER BY created_at DESC, id DESC")

    @app.get("/api/tasks")
    def list_tasks(conn=Depends(get_db)):
        return _rows(conn, "SELECT * FROM tasks ORDER BY created_at DESC, id DESC")

    @app.get("/api/alerts")
    def list_alerts(conn=Depends(get_db)):
        return _rows(conn, "SELECT * FROM alerts ORDER BY created_at DESC, id DESC")

    @app.get("/api/events")
    def list_events(conn=Depends(get_db)):
        return _rows(conn, "SELECT * FROM events ORDER BY created_at DESC, id DESC")

    @app.post("/api/{table}/{row_id}/status")
    def set_status(table: str, row_id: int, body: StatusBody, conn=Depends(get_db)):
        try:
            n = db.update_status(conn, table, row_id, body.status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"status not allowed on {table}")
        if n == 0:
            raise HTTPException(status_code=404, detail="row not found")
        return {"updated": n}

    @app.get("/api/events/stream")
    def events_stream():
        def gen():
            conn = db.get_conn(db_path)
            try:
                last = changes.current_version(conn)
                yield f"event: db-changed\ndata: {json.dumps({'version': last})}\n\n"
                while True:
                    v = changes.wait_for_change(conn, last, timeout=25)
                    if v != last:
                        last = v
                        yield f"event: db-changed\ndata: {json.dumps({'version': v})}\n\n"
                    else:
                        yield ": keep-alive\n\n"
            finally:
                conn.close()
        return StreamingResponse(gen(), media_type="text/event-stream")

    @app.get("/api/deadlines")
    def list_deadlines(conn=Depends(get_db)):
        now = datetime.now(timezone.utc).isoformat()
        out = []
        for r in db.list_deadlines(conn):
            d = dict(r)
            d["countdown_seconds"] = _deadlines.countdown(d["due_at"], now)
            out.append(d)
        return out

    @app.post("/api/deadlines")
    def add_deadline(body: DeadlineBody, conn=Depends(get_db)):
        ext = f"manual:{uuid.uuid4()}"
        db.add_deadline(conn, title=body.title, due_at=body.due_at, detail=body.detail,
                        source="manual", external_ref=ext)
        row = conn.execute("SELECT id FROM critical_deadlines WHERE external_ref=?",
                           (ext,)).fetchone()
        return {"id": row["id"]}

    @app.post("/api/deadlines/{deadline_id}/visible")
    def set_visible(deadline_id: int, body: VisibleBody, conn=Depends(get_db)):
        n = db.set_deadline_visible(conn, deadline_id, body.visible)
        if n == 0:
            raise HTTPException(status_code=404, detail="deadline not found")
        return {"updated": n}

    return app
