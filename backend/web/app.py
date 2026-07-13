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
from starlette.exceptions import HTTPException as StarletteHTTPException
from pydantic import BaseModel
from ea import db
from web import changes
from lib import deadlines as _deadlines
from lib import outlook as _outlook
from lib import briefing as _briefing
from lib import skills as _skills
from lib import skill_health as _skill_health
from lib import search as _search
from lib import feed as _feed


class SPAStaticFiles(StaticFiles):
    """Serve index.html for unknown non-API paths (client-side routing)."""

    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as e:
            # Only serve SPA fallback for non-API paths
            if e.status_code == 404 and not scope["path"].startswith("/api"):
                return await super().get_response("index.html", scope)
            raise


class StatusBody(BaseModel):
    status: str


class DeadlineBody(BaseModel):
    title: str
    due_at: str
    detail: str | None = None


class VisibleBody(BaseModel):
    visible: bool


class DeadlinePatch(BaseModel):
    title: str | None = None
    due_at: str | None = None
    detail: str | None = None
    priority: int | None = None


class TagCreate(BaseModel):
    name: str
    color: str = "neutral"


class ContentTagBody(BaseModel):
    name: str
    color: str = "neutral"


class ContentLinkBody(BaseModel):
    target_type: str
    target_id: int


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


class TaskPatch(BaseModel):
    title: str | None = None
    detail: str | None = None
    due_at: str | None = None
    priority: int | None = None
    status: str | None = None
    board_column_id: int | None = None


class TaskCreate(BaseModel):
    title: str
    detail: str | None = None
    due_at: str | None = None
    priority: int = 3
    status: str = "open"
    board_column_id: int | None = None


class ActionCreate(BaseModel):
    action_type: str
    entity_type: str | None = None
    entity_id: int | None = None
    mode: str = "review"
    payload: dict | None = None
    rationale: str | None = None
    approve: bool = False


class GuidanceBody(BaseModel):
    scope: str
    text: str


class BoardColumnPatch(BaseModel):
    name: str | None = None
    position: int | None = None
    status: str | None = None


_VALID_TASK_STATUSES = {"open", "in_progress", "done", "dismissed"}


class SubscribeBody(BaseModel):
    endpoint: str
    keys: dict


def _rows(conn, sql, params=()):
    return [dict(r) for r in conn.execute(sql, params).fetchall()]


def create_app(db_path, static_dir=None, skills_dir=None) -> FastAPI:
    # Relocate auto-docs off /docs so the SPA route /docs wins on hard refresh
    app = FastAPI(title="Scout EA", docs_url="/api/docs", redoc_url="/api/redoc")
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

    @app.post("/api/tasks")
    def create_task(body: TaskCreate, conn=Depends(get_db)):
        try:
            tid = db.add_task(conn, **body.model_dump(exclude_none=True))
        except sqlite3.Error:
            raise HTTPException(status_code=400, detail="create failed")
        return {"id": tid}

    @app.patch("/api/tasks/{task_id}")
    def update_task_endpoint(task_id: int, body: TaskPatch, conn=Depends(get_db)):
        fields = body.model_dump(exclude_none=True)
        if not fields:
            return {"updated": 0}
        try:
            n = db.update_task(conn, task_id, **fields)
        except sqlite3.Error:
            raise HTTPException(status_code=400, detail="update failed")
        if n == 0:
            raise HTTPException(status_code=404, detail="task not found")
        return {"updated": n}

    @app.get("/api/actions")
    def list_actions_ep(status: str | None = None, conn=Depends(get_db)):
        return db.list_actions(conn, status=status)

    @app.post("/api/actions")
    def create_action_ep(body: ActionCreate, conn=Depends(get_db)):
        status = "approved" if body.approve else "drafted"
        aid = db.add_action(conn, action_type=body.action_type,
                            entity_type=body.entity_type, entity_id=body.entity_id,
                            mode=body.mode, status=status, payload=body.payload,
                            rationale=body.rationale, created_by="user")
        if body.approve:
            db.update_action(conn, aid, status="approved")  # stamps approved_at
        return {"id": aid}

    @app.post("/api/actions/{action_id}/approve")
    def approve_action_ep(action_id: int, conn=Depends(get_db)):
        n = db.update_action(conn, action_id, status="approved")
        if n == 0:
            raise HTTPException(status_code=404, detail="action not found")
        return {"updated": n}

    @app.post("/api/actions/{action_id}/dismiss")
    def dismiss_action_ep(action_id: int, conn=Depends(get_db)):
        n = db.update_action(conn, action_id, status="dismissed")
        if n == 0:
            raise HTTPException(status_code=404, detail="action not found")
        return {"updated": n}

    @app.get("/api/guidance")
    def list_guidance_ep(scope: str | None = None, conn=Depends(get_db)):
        return db.list_guidance(conn, scope=scope)

    @app.post("/api/guidance")
    def create_guidance_ep(body: GuidanceBody, conn=Depends(get_db)):
        return {"id": db.add_guidance(conn, body.scope, body.text)}

    @app.delete("/api/guidance/{guidance_id}")
    def delete_guidance_ep(guidance_id: int, conn=Depends(get_db)):
        return {"deleted": db.delete_guidance(conn, guidance_id)}

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
    def get_deadlines(include_hidden: bool = False, conn=Depends(get_db)):
        now = datetime.now(timezone.utc).isoformat()
        out = []
        for r in db.list_deadlines(conn, respect_global=not include_hidden, include_hidden=include_hidden):
            d = dict(r)
            d["countdown_seconds"] = _deadlines.countdown(d["due_at"], now)
            d["links"] = db.list_links_for(conn, "deadline", d["id"])
            d["tags"] = db.list_tags_for(conn, "deadline", d["id"])
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

    @app.patch("/api/deadlines/{deadline_id}")
    def update_deadline_endpoint(deadline_id: int, body: DeadlinePatch, conn=Depends(get_db)):
        fields = body.model_dump(exclude_none=True)
        if "due_at" in fields:
            try:
                dt = datetime.fromisoformat(fields["due_at"].replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                fields["due_at"] = dt.isoformat()
            except ValueError:
                raise HTTPException(status_code=400, detail="due_at must be ISO-8601")
        if not fields:
            return {"updated": 0}
        try:
            n = db.update_deadline(conn, deadline_id, **fields)
        except sqlite3.Error:
            raise HTTPException(status_code=400, detail="update failed")
        if n == 0:
            raise HTTPException(status_code=404, detail="deadline not found")
        return {"updated": n}

    @app.post("/api/deadlines/{deadline_id}/visible")
    def set_visible(deadline_id: int, body: VisibleBody, conn=Depends(get_db)):
        n = db.set_deadline_visible(conn, deadline_id, body.visible)
        if n == 0:
            raise HTTPException(status_code=404, detail="deadline not found")
        return {"updated": n}

    @app.get("/api/tags")
    def get_tags(conn=Depends(get_db)):
        return [dict(r) for r in db.list_all_tags(conn)]

    @app.post("/api/tags")
    def create_tag(body: TagCreate, conn=Depends(get_db)):
        return {"id": db.get_or_create_tag(conn, body.name, body.color)}

    @app.post("/api/content/{ref_type}/{ref_id}/tags")
    def add_content_tag(ref_type: str, ref_id: int, body: ContentTagBody, conn=Depends(get_db)):
        try:
            db.tag_content(conn, ref_type, ref_id, body.name, body.color)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        return {"ok": True}

    @app.delete("/api/content/{ref_type}/{ref_id}/tags/{tag_id}")
    def del_content_tag(ref_type: str, ref_id: int, tag_id: int, conn=Depends(get_db)):
        try:
            n = db.untag_content(conn, ref_type, ref_id, tag_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        if n == 0:
            raise HTTPException(status_code=404, detail="tag not attached")
        return {"deleted": n}

    @app.post("/api/content/{ref_type}/{ref_id}/links")
    def add_content_link(ref_type: str, ref_id: int, body: ContentLinkBody, conn=Depends(get_db)):
        try:
            db.link_content(conn, ref_type, ref_id, body.target_type, body.target_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        return {"ok": True}

    @app.delete("/api/content/{ref_type}/{ref_id}/links/{link_id}")
    def del_content_link(ref_type: str, ref_id: int, link_id: int, conn=Depends(get_db)):
        if db.unlink_content(conn, link_id) == 0:
            raise HTTPException(status_code=404, detail="link not found")
        return {"deleted": 1}

    @app.get("/api/content/{ref_type}/{ref_id}/refs")
    def get_content_refs(ref_type: str, ref_id: int, conn=Depends(get_db)):
        try:
            return {"tags": db.list_tags_for(conn, ref_type, ref_id),
                    "links": db.list_links_for(conn, ref_type, ref_id)}
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    @app.post("/api/config/{key}")
    def post_config(key: str, body: ConfigBody, conn=Depends(get_db)):
        try:
            db.set_config(conn, key, body.value)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"config key not writable: {key}")
        return {"key": key, "value": body.value}

    @app.get("/api/search")
    def search_endpoint(q: str = "", conn=Depends(get_db)):
        return _search.search(conn, q)

    @app.get("/api/activity")
    def get_activity(limit: int = 20, conn=Depends(get_db)):
        return _rows(conn, "SELECT * FROM skill_runs ORDER BY ran_at DESC, id DESC LIMIT ?", (int(limit),))

    def _filtered_enriched(conn, ref_type, rows, tag, person, origin):
        ids = _feed.filter_ids(conn, ref_type, tag=tag, origin=origin, person=person)
        out = []
        for r in rows:
            d = dict(r)
            if ids is not None and d["id"] not in ids:
                continue
            d["tags"] = db.list_tags_for(conn, ref_type, d["id"])
            d["links"] = db.list_links_for(conn, ref_type, d["id"])
            out.append(d)
        return out

    @app.get("/api/feed")
    def get_feed(conn=Depends(get_db)):
        return _feed.overview(conn)

    @app.get("/api/news")
    def get_news(status: str | None = None, topic: int | None = None, tag: str | None = None,
                 person: int | None = None, origin: str | None = None, conn=Depends(get_db)):
        rows = db.list_news(conn, status=status, topic_id=topic)
        return _filtered_enriched(conn, "news", rows, tag, person, origin)

    @app.get("/api/learning")
    def get_learning(status: str | None = None, topic: int | None = None, tag: str | None = None,
                     person: int | None = None, origin: str | None = None, conn=Depends(get_db)):
        rows = db.list_learning(conn, status=status, topic_id=topic)
        return _filtered_enriched(conn, "learning", rows, tag, person, origin)

    @app.get("/api/trends")
    def get_trends(window_start: str | None = None, tag: str | None = None,
                   origin: str | None = None, conn=Depends(get_db)):
        w = window_start or db.latest_trend_window(conn)
        if w is None:
            return []
        rows = [dict(r) for r in db.list_trends(conn, w)]
        ids = _feed.filter_ids(conn, "trend", tag=tag, origin=origin)
        if ids is not None:
            rows = [r for r in rows if r["id"] in ids]
        return rows

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

    @app.get("/api/briefing")
    def get_briefing(conn=Depends(get_db)):
        now = datetime.now(timezone.utc).isoformat()
        deadlines = [dict(r) for r in db.list_deadlines(conn)]
        tasks = [dict(r) for r in conn.execute(
            "SELECT * FROM tasks WHERE status IN ('open','in_progress')")]
        signals = [dict(r) for r in conn.execute(
            "SELECT * FROM signals WHERE status='new' ORDER BY created_at DESC")]
        news = [dict(r) for r in db.list_news(conn)]
        learning = [dict(r) for r in db.list_learning(conn)]
        topics = [dict(r) for r in db.list_topics(conn)]
        people = [dict(r) for r in db.list_people(conn)]
        people_signals = {}
        for s in signals:
            pid = s.get("person_id")
            if pid:
                people_signals.setdefault(pid, []).append(s)
        row = conn.execute("SELECT value FROM config WHERE key='daily_summary'").fetchone()
        summary = None
        if row:
            try:
                summary = json.loads(row["value"]).get("text")
            except (ValueError, TypeError):
                summary = None
        return _briefing.assemble(now, deadlines, tasks, signals, news, learning,
                                  topics, people, people_signals, summary)

    @app.get("/api/skills")
    def get_skills(conn=Depends(get_db)):
        skills = _skills.list_skills(skills_dir) if skills_dir else []
        if not skills:
            return []
        # Latest run per skill from the activity log; decide active-by-cadence.
        last = {r["skill"]: r["last_run"] for r in conn.execute(
            "SELECT skill, MAX(ran_at) AS last_run FROM skill_runs GROUP BY skill")}
        now = datetime.now(timezone.utc)
        for s in skills:
            lr = last.get(s["name"])
            s["last_run"] = lr
            s["active"] = _skill_health.is_active(s.get("schedule"), lr, now)
        return skills

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

    @app.get("/api/push/vapid-key")
    def vapid_key(conn=Depends(get_db)):
        from lib import push
        pub, _ = push.ensure_vapid(conn)
        return {"publicKey": pub}

    @app.post("/api/push/subscribe")
    def subscribe(body: SubscribeBody, conn=Depends(get_db)):
        from lib import push
        if not push.valid_push_endpoint(body.endpoint):
            raise HTTPException(status_code=400, detail="invalid push endpoint")
        db.add_subscription(conn, body.endpoint, body.keys.get("p256dh", ""), body.keys.get("auth", ""))
        return {"ok": True}

    @app.post("/api/push/unsubscribe")
    def unsubscribe(body: SubscribeBody, conn=Depends(get_db)):
        n = db.delete_subscription(conn, body.endpoint)
        return {"removed": n}

    @app.post("/api/push/test")
    def push_test(conn=Depends(get_db)):
        from lib import push
        return {"sent": push.send_push(conn, "Scout EA", "Test notification")}

    @app.get("/api/board/columns")
    def list_board_columns(conn=Depends(get_db)):
        return [dict(r) for r in db.list_board_columns(conn)]

    @app.post("/api/board/columns")
    def create_board_column(body: dict, conn=Depends(get_db)):
        if "name" not in body:
            raise HTTPException(status_code=400, detail="name required")
        status = body.get("status", "open")
        if status not in _VALID_TASK_STATUSES:
            raise HTTPException(status_code=400, detail="invalid status")
        col_id = db.add_board_column(conn, body["name"], status)
        return {"id": col_id}

    @app.patch("/api/board/columns/{col_id}")
    def update_board_column_endpoint(col_id: int, body: BoardColumnPatch, conn=Depends(get_db)):
        fields = body.model_dump(exclude_none=True)
        if not fields:
            return {"updated": 0}
        if "status" in fields and fields["status"] not in _VALID_TASK_STATUSES:
            raise HTTPException(status_code=400, detail="invalid status")
        try:
            n = db.update_board_column(conn, col_id, **fields)
        except sqlite3.Error:
            raise HTTPException(status_code=400, detail="update failed")
        if n == 0:
            raise HTTPException(status_code=404, detail="column not found")
        return {"updated": n}

    @app.delete("/api/board/columns/{col_id}")
    def delete_board_column_endpoint(col_id: int, conn=Depends(get_db)):
        n = db.delete_board_column(conn, col_id)
        if n == 0:
            raise HTTPException(status_code=404, detail="column not found")
        return {"deleted": n}

    if static_dir is not None and Path(static_dir).is_dir():
        app.mount("/", SPAStaticFiles(directory=str(static_dir), html=True), name="static")

    return app
