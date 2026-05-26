"""
Hermes Mini App — backend API routes (direct in-process calls).

Mounted at /api/miniapp/ by web_server.py.
Calls kanban_db and state.db directly instead of proxying via HTTP,
avoiding single-worker deadlocks.
"""

from __future__ import annotations

import dataclasses
import json
import logging
import sqlite3
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

log = logging.getLogger(__name__)
router = APIRouter()

STATE_DB = Path("/opt/data/state.db")

# ---------------------------------------------------------------------------
# kanban_db helpers (lazy import)
# ---------------------------------------------------------------------------

def _kb():
    from hermes_cli import kanban_db as m
    return m


def _serialize_task(t: Any) -> dict:
    """Convert a kanban_db.Task dataclass to a plain dict."""
    if t is None:
        return {}
    if hasattr(t, '__dataclass_fields__'):
        return {f.name: getattr(t, f.name) for f in dataclasses.fields(t)
                if not f.name.startswith('_')}
    if isinstance(t, dict):
        return {k: v for k, v in t.items() if not k.startswith('_')}
    return {"id": str(t)}


def _boards_data() -> dict:
    """Return list of boards with task counts."""
    kb = _kb()
    boards_meta = kb.list_boards()
    current = kb.get_current_board()
    result = []
    for b in boards_meta:
        slug = b.get("slug", "default")
        try:
            conn = kb.connect(board=slug)
            stats = kb.board_stats(conn)
            conn.close()
        except Exception:
            stats = {}
        counts = stats.get("by_status", {})
        norm_counts = {s: counts.get(s, 0) for s in ["triage", "todo", "ready", "running", "blocked", "done", "archived"]}
        total = sum(norm_counts.values())
        result.append({
            "slug": slug,
            "name": b.get("name", slug.replace("_", " ").title()),
            "counts": norm_counts,
            "total": total,
        })
    return {"boards": result, "current": current}


def _board_detail(slug: str) -> dict:
    """Return board grouped by columns with tasks."""
    kb = _kb()
    kb.init_db(board=slug)
    conn = kb.connect(board=slug)
    tasks = kb.list_tasks(conn)
    conn.close()
    columns = ["triage", "todo", "ready", "running", "blocked", "done"]
    result = {"slug": slug, "columns": []}
    for col in columns:
        col_tasks = [_serialize_task(t) for t in tasks if t.status == col] if hasattr(tasks, '__iter__') else []
        result["columns"].append({"name": col, "tasks": col_tasks})
    return result


# ---------------------------------------------------------------------------
# state.db helpers
# ---------------------------------------------------------------------------

def _state_conn():
    if not STATE_DB.exists():
        raise HTTPException(status_code=503, detail="state.db not found")
    conn = sqlite3.connect(str(STATE_DB))
    conn.row_factory = sqlite3.Row
    return conn


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class CreateTaskBody(BaseModel):
    title: str
    body: str = ""
    board: Optional[str] = None

class UpdateTaskBody(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None

class MoveTaskBody(BaseModel):
    to_column_id: str
    position: int = 0


# ---------------------------------------------------------------------------
# Kanban / Boards
# ---------------------------------------------------------------------------

@router.get("/api/miniapp/boards")
async def list_boards():
    try:
        return _boards_data()
    except Exception as exc:
        log.warning("list_boards failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/miniapp/boards/{slug}")
async def get_board(slug: str):
    try:
        return _board_detail(slug)
    except Exception as exc:
        log.warning("get_board(%s) failed: %s", slug, exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------

@router.get("/api/miniapp/tasks")
async def list_tasks(board: Optional[str] = None, column: Optional[str] = None, limit: int = 50):
    try:
        kb = _kb()
        kb.init_db(board=board)
        conn = kb.connect(board=board)
        tasks = kb.list_tasks(conn)
        conn.close()
        serialized = [_serialize_task(t) for t in tasks]
        if column:
            serialized = [t for t in serialized if t.get("status") == column]
        return {"tasks": serialized[:limit]}
    except Exception as exc:
        log.warning("list_tasks failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/api/miniapp/tasks")
async def create_task(body: CreateTaskBody):
    try:
        kb = _kb()
        conn = kb.connect(board=body.board)
        task = kb.create_task(conn, title=body.title, body=body.body or "")
        conn.close()
        return _serialize_task(task)
    except Exception as exc:
        log.warning("create_task failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/miniapp/tasks/{task_id}")
async def get_task(task_id: str):
    try:
        kb = _kb()
        conn = kb.connect()
        task = kb.get_task(conn, task_id)
        conn.close()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        return _serialize_task(task)
    except HTTPException:
        raise
    except Exception as exc:
        log.warning("get_task(%s) failed: %s", task_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.patch("/api/miniapp/tasks/{task_id}")
async def update_task(task_id: str, body: UpdateTaskBody):
    try:
        kb = _kb()
        conn = kb.connect()
        task = kb.get_task(conn, task_id)
        if not task:
            conn.close()
            raise HTTPException(status_code=404, detail="Task not found")
        if body.title is not None:
            conn.execute("UPDATE tasks SET title=? WHERE id=?", (body.title, task_id))
        if body.body is not None:
            conn.execute("UPDATE tasks SET body=? WHERE id=?", (body.body, task_id))
        conn.commit()
        conn.close()
        updated = kb.get_task(kb.connect(), task_id)
        return _serialize_task(updated)
    except HTTPException:
        raise
    except Exception as exc:
        log.warning("update_task(%s) failed: %s", task_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.patch("/api/miniapp/tasks/{task_id}/move")
async def move_task(task_id: str, body: MoveTaskBody):
    if body.to_column_id == "running":
        raise HTTPException(
            status_code=400,
            detail="Only the dispatcher can move tasks to Running. Drag to another column."
        )
    try:
        kb = _kb()
        conn = kb.connect()
        task = kb.get_task(conn, task_id)
        if not task:
            conn.close()
            raise HTTPException(status_code=404, detail="Task not found")

        target = body.to_column_id
        if target == "done":
            conn.execute("UPDATE tasks SET status='done' WHERE id=?", (task_id,))
        elif target == "blocked":
            conn.execute("UPDATE tasks SET status='blocked' WHERE id=?", (task_id,))
        elif target == "ready":
            conn.execute("UPDATE tasks SET status='ready', assignee=NULL WHERE id=?", (task_id,))
        elif target == "todo":
            conn.execute("UPDATE tasks SET status='todo' WHERE id=?", (task_id,))
        elif target == "triage":
            conn.execute("UPDATE tasks SET status='triage' WHERE id=?", (task_id,))
        else:
            conn.close()
            raise HTTPException(status_code=400, detail=f"Unknown column: {target}")
        conn.commit()
        conn.close()
        return {"status": "ok", "moved_to": target}
    except HTTPException:
        raise
    except Exception as exc:
        log.warning("move_task(%s) failed: %s", task_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Sessions — direct SQLite on state.db
# ---------------------------------------------------------------------------

class UpdateSessionBody(BaseModel):
    title: Optional[str] = None


@router.patch("/api/miniapp/sessions/{session_id}")
async def patch_session(session_id: str, body: UpdateSessionBody):
    """Update session metadata (e.g. title)."""
    try:
        conn = _state_conn()
        row = conn.execute("SELECT id FROM sessions WHERE id=?", (session_id,)).fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail="Session not found")
        if body.title is not None:
            title = body.title.strip() if body.title.strip() else None
            conn.execute("UPDATE sessions SET title=? WHERE id=?", (title, session_id))
            conn.commit()
        conn.close()
        return {"ok": True, "title": body.title}
    except HTTPException:
        raise
    except Exception as exc:
        log.warning("patch_session(%s) failed: %s", session_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/miniapp/sessions")
async def list_sessions(limit: int = 50, offset: int = 0):
    try:
        conn = _state_conn()
        # Total count first
        total = conn.execute("SELECT COUNT(*) as cnt FROM sessions").fetchone()["cnt"]
        # Then paginated list
        rows = conn.execute(
            "SELECT id, title, message_count, source, model, "
            "started_at, ended_at, end_reason "
            "FROM sessions ORDER BY ended_at DESC LIMIT ? OFFSET ?",
            (limit, offset)
        ).fetchall()
        conn.close()
        sessions = []
        for r in rows:
            sid = r["id"]
            sessions.append({
                "id": sid,
                "title": r["title"] or sid[:min(30, len(sid))] + "...",
                "message_count": r["message_count"],
                "source": r["source"],
                "model": r["model"],
                "started_at": r["started_at"],
                "ended_at": r["ended_at"],
                "end_reason": r["end_reason"],
            })
        return {"sessions": sessions, "total": total, "limit": limit, "offset": offset}
    except HTTPException:
        raise
    except Exception as exc:
        log.warning("list_sessions failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/miniapp/sessions/{session_id}")
async def get_session_detail(session_id: str):
    try:
        conn = _state_conn()
        row = conn.execute(
            "SELECT id, title, message_count, source, model, "
            "started_at, ended_at, end_reason, parent_session_id, "
            "user_id, input_tokens, output_tokens "
            "FROM sessions WHERE id=?",
            (session_id,)
        ).fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail="Session not found")

        # Get messages
        msg_rows = conn.execute(
            "SELECT id, role, content, tool_name, timestamp, finish_reason "
            "FROM messages WHERE session_id=? ORDER BY timestamp ASC",
            (session_id,)
        ).fetchall()
        conn.close()

        messages = []
        for m in msg_rows:
            msg = {
                "id": m["id"],
                "role": m["role"],
                "content": m["content"],
                "timestamp": m["timestamp"],
            }
            if m["tool_name"]:
                msg["tool_name"] = m["tool_name"]
            if m["finish_reason"]:
                msg["finish_reason"] = m["finish_reason"]
            if msg.get("content") and len(msg["content"]) > 500:
                msg["content_preview"] = msg["content"][:500] + "..."
            messages.append(msg)

        sid = row["id"]
        return {
            "session": {
                "id": sid,
                "title": row["title"] or sid[:min(30, len(sid))] + "...",
                "message_count": row["message_count"],
                "source": row["source"],
                "model": row["model"],
                "started_at": row["started_at"],
                "ended_at": row["ended_at"],
                "end_reason": row["end_reason"],
                "parent_session_id": row["parent_session_id"],
                "user_id": row["user_id"],
                "input_tokens": row["input_tokens"],
                "output_tokens": row["output_tokens"],
            },
            "messages": messages
        }
    except HTTPException:
        raise
    except Exception as exc:
        log.warning("get_session_detail(%s) failed: %s", session_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@router.get("/api/miniapp/health")
async def health():
    try:
        boards = _boards_data()
        return {"status": "ok", "boards_count": len(boards.get("boards", []))}
    except Exception as exc:
        return {"status": "error", "detail": str(exc)}
