"""FastAPI app over EA_DB — browser-facing surface."""
from __future__ import annotations
import json
import sqlite3
import uuid
from pathlib import Path
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from ea import db
from web import changes
from lib import deadlines as _deadlines
from lib import outlook as _outlook
from lib import skills as _skills


class StatusBody(BaseModel):
    status: str


class DeadlineBody(BaseModel):
    title: str
    due_at: str
    detail: str | None = None


class VisibleBody(BaseModel):
    visible: bool


class ConfigBody(BaseModel):
    value: str


class PersonBody(BaseModel):
    name: str
    role: str | None = None
    org: str | None = None
    importance: int = 3
    notes: str | None = None


class PersonPatch(BaseModel):
    name: str | None = None
    role: str | None = None
    org: str | None = None
    importance: int | None = None
    notes: str | None = None


class TopicBody(BaseModel):
    name: str
    description: str | None = None
    priority: int = 3
    max_suggest: int = 5


class TopicPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    priority: int | None = None
    max_suggest: int | None = None


def _rows(conn, sql, params=()):
    return [dict(r) for r in conn.execute(sql, params).fetchall()]


def create_app(db_path, static_dir=None, skills_dir=None) -> FastAPI:
    app = FastAPI(title="Scout EA")
    db_path = Path(db_path)

    def get_db():
        conn = db.get_conn(db_path)
        try:
            yield conn
        finally:
            conn.close()

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/config")
    def get_config(conn=Depends(get_db)):
        rows = conn.execute("SELECT key, value FROM config").fetchall()
        return {r["key"]: r["value"] for r in rows}

    @app.get("/api/signals")
    def get_signals(status: str | None = None, conn=Depends(get_db)):
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
    def post_status(table: str, row_id: int, body: StatusBody, conn=Depends(get_db)):
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
            except Exception as e:
                yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
            finally:
                conn.close()
        return StreamingResponse(gen(), media_type="text/event-stream")

    @app.get("/api/deadlines")
    def get_deadlines(conn=Depends(get_db)):
        now = datetime.now(timezone.utc).isoformat()
        out = []
        for r in db.list_deadlines(conn):
            d = dict(r)
            d["countdown_seconds"] = _deadlines.countdown(d["due_at"], now)
            out.append(d)
        return out

    @app.post("/api/deadlines")
    def post_deadline(body: DeadlineBody, conn=Depends(get_db)):
        try:
            dt = datetime.fromisoformat(body.due_at.replace("Z", "+00:00"))
            # If naive (no tzinfo), treat as UTC and normalize
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="due_at must be ISO-8601")
        # Normalize to UTC ISO string for storage
        normalized_due_at = dt.isoformat()
        ext = f"manual:{uuid.uuid4()}"
        db.add_deadline(conn, title=body.title, due_at=normalized_due_at, detail=body.detail,
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

    @app.post("/api/config/{key}")
    def post_config(key: str, body: ConfigBody, conn=Depends(get_db)):
        try:
            db.set_config(conn, key, body.value)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"config key not writable: {key}")
        return {"key": key, "value": body.value}

    @app.get("/api/activity")
    def get_activity(limit: int = 20, conn=Depends(get_db)):
        return _rows(conn, "SELECT * FROM skill_runs ORDER BY ran_at DESC, id DESC LIMIT ?", (int(limit),))

    @app.get("/api/trends")
    def get_trends(window_start: str | None = None, conn=Depends(get_db)):
        w = window_start or db.latest_trend_window(conn)
        if w is None:
            return []
        return [dict(r) for r in db.list_trends(conn, w)]

    @app.get("/api/outlook")
    def get_outlook(conn=Depends(get_db)):
        now = datetime.now(timezone.utc).isoformat()
        deadlines = [dict(r) for r in db.list_deadlines(conn)]
        w = db.latest_trend_window(conn)
        trends = [dict(r) for r in db.list_trends(conn, w)] if w else []
        proactive = [dict(r) for r in conn.execute(
            "SELECT * FROM signals WHERE type='proactive' AND status='new' "
            "ORDER BY created_at DESC")]
        tasks = [dict(r) for r in conn.execute(
            "SELECT * FROM tasks WHERE status IN ('open','in_progress')")]
        return _outlook.assemble(now, deadlines, trends, proactive, tasks)

    @app.get("/api/skills")
    def get_skills():
        return _skills.list_skills(skills_dir) if skills_dir else []

    @app.get("/api/people")
    def list_people(include_inactive: bool = False, conn=Depends(get_db)):
        return [dict(r) for r in db.list_people(conn, include_inactive=include_inactive)]

    @app.post("/api/people")
    def create_person(body: PersonBody, conn=Depends(get_db)):
        pid = db.add_person(conn, **body.model_dump(exclude_none=True))
        return {"id": pid}

    @app.patch("/api/people/{person_id}")
    def update_person_endpoint(person_id: int, body: PersonPatch, conn=Depends(get_db)):
        fields = body.model_dump(exclude_none=True)
        if not fields:
            return {"updated": 0}
        try:
            n = db.update_person(conn, person_id, **fields)
        except sqlite3.Error:
            raise HTTPException(status_code=400, detail="update failed")
        if n == 0:
            raise HTTPException(status_code=404, detail="person not found")
        return {"updated": n}

    @app.delete("/api/people/{person_id}")
    def delete_person_endpoint(person_id: int, conn=Depends(get_db)):
        n = db.deactivate_person(conn, person_id)
        if n == 0:
            raise HTTPException(status_code=404, detail="person not found")
        return {"deactivated": n}

    @app.get("/api/topics")
    def list_topics(include_inactive: bool = False, conn=Depends(get_db)):
        return [dict(r) for r in db.list_topics(conn, include_inactive=include_inactive)]

    @app.post("/api/topics")
    def create_topic(body: TopicBody, conn=Depends(get_db)):
        try:
            tid = db.add_topic(conn, **body.model_dump(exclude_none=True))
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="topic name must be unique")
        return {"id": tid}

    @app.patch("/api/topics/{topic_id}")
    def update_topic_endpoint(topic_id: int, body: TopicPatch, conn=Depends(get_db)):
        fields = body.model_dump(exclude_none=True)
        if not fields:
            return {"updated": 0}
        try:
            n = db.update_topic(conn, topic_id, **fields)
        except sqlite3.Error:
            raise HTTPException(status_code=400, detail="update failed")
        if n == 0:
            raise HTTPException(status_code=404, detail="topic not found")
        return {"updated": n}

    @app.delete("/api/topics/{topic_id}")
    def delete_topic_endpoint(topic_id: int, conn=Depends(get_db)):
        n = db.deactivate_topic(conn, topic_id)
        if n == 0:
            raise HTTPException(status_code=404, detail="topic not found")
        return {"deactivated": n}

    if static_dir is not None and Path(static_dir).is_dir():
        app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")

    return app
