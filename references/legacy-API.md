# API Reference — HERMES Mini App

All endpoints are prefixed with `/api/miniapp/` in the SPA. The nginx proxy strips this prefix before forwarding to the backend.

## Boards

### `GET /boards`
List all kanban boards.

**Response:** `{ "boards": [{ "slug": "...", "name": "...", "total": 0 }] }`

### `GET /boards/:slug`
Get board detail with columns and tasks.

**Response:** `{ "columns": [{ "name": "...", "tasks": [...] }] }`

## Tasks

### `GET /tasks`
List all tasks in a board. **Query params:** `board`, `column`, `limit`

### `POST /tasks`
Create a new task. **Body:** `{ "title": "...", "body": "..." }`

### `GET /tasks/:id`
Get task detail.

### `PATCH /tasks/:id`
Update task. **Body:** `{ "title": "...", "status": "...", "body": "..." }`

### `PATCH /tasks/:id/move`
Move task to a new column.
**Body:** `{ "to_column_id": "ready", "position": 0 }`
→ Translated by proxy to `{ "status": "ready" }`

## Sessions

### `GET /sessions`
List sessions. **Query params:** `limit` (default: 50), `offset` (default: 0), `source` (comma-separated filter, e.g. `?source=cron,telegram`)
**Auth:** Requires `X-Hermes-Session-Token` (proxy handles this)

### `GET /sessions/:id`
Get session detail with messages.
**Auth:** Token (proxy merges metadata + messages)

### `PATCH /sessions/:id`
Update session metadata (title rename).
**Body:** `{ "title": "New Title" }`
**Auth:** Telegram initData
**Added in v5:** Dashboard's `miniapp_handler.py` handles this directly

## Status

### `GET /status`
Dashboard health check. No auth needed.

## Authentication Headers

| Header | Source | Used By |
|--------|--------|---------|
| `X-Telegram-Init-Data` | Telegram WebApp SDK | Dashboard miniapp_handler |
| `X-Hermes-Session-Token` | Scraped from dashboard | Standalone proxy |

## Error Responses

```json
{ "error": "error_code", "detail": "Human-readable message" }
```
Common errors: `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `405 Method Not Allowed`
