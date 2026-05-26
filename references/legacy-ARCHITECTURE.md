# Architecture — HERMES Mini App

## Data Flow

### Request Flow

```
Telegram WebView
     │
     ▼
OpenResty (nginx) :443
     │
     ├── /miniapp/ → try_files → index.html (SPA routing)
     │
     └── /api/miniapp/* → proxy_pass → 127.0.0.1:9444
                                      │
                                      ▼
                              Standalone Proxy
                              (miniapp-api-proxy.py)
                                  │
                                  ├── GET /boards →   Dashboard :9119/api/plugins/kanban/boards
                                  ├── GET /boards/:id → Dashboard :9119/api/plugins/kanban/board
                                  ├── GET /tasks →     Dashboard :9119/api/plugins/kanban/tasks
                                  ├── PATCH /tasks/:id/move → Dashboard :9119/api/plugins/kanban/tasks/:id (translate)
                                  ├── GET /sessions →  Dashboard :9119/api/sessions (token auth)
                                  ├── GET /sessions/:id → Dashboard :9119/api/sessions/:id + /messages (merged)
                                  ├── PATCH /sessions/:id → Dashboard :9119/api/miniapp/sessions/:id (initData auth)
                                  └── GET /status →    Dashboard :9119/api/status
```

### Authentication

**Layer 1 — Telegram initData (SPA ↔ nginx ↔ proxy)**
- `X-Telegram-Init-Data` header sent by SPA
- Validated by dashboard's `miniapp_handler.py` auth middleware (HMAC-SHA256)

**Layer 2 — Dashboard session token (proxy ↔ dashboard)**
- Token scraped from dashboard HTML (`window.__HERMES_SESSION_TOKEN__`)
- Sent as `X-Hermes-Session-Token` header on protected endpoints
- Cached with 30s TTL, auto-refreshed on 401

**Layer 3 — initData auth (dashboard miniapp_handler)**
- `/api/miniapp/*` paths validated with Telegram initData
- `request.state.user` injected on success

## Component Details

### 1. SPA (Single Page Application)

- **Hash-based routing** (`#/kanban`, `#/sessions`, etc.)
- **Telegram WebApp SDK** integration (theme, back button, viewport)
- **API client** sends `X-Telegram-Init-Data` automatically
- **Cache busting** via `?v=N` on JS/CSS (increment on deploy)

### 2. Standalone Proxy (`miniapp-api-proxy.py`)

- Listens on `127.0.0.1:9444` (localhost only)
- Translates `/api/miniapp/*` → dashboard internal endpoints
- Handles body translation for task moves (`to_column_id` → `status`)
- Parallel fetch for session detail (combines metadata + messages)
- Token management with 401 auto-retry

### 3. Dashboard Handler (`miniapp_handler.py`)

- Mounted in FastAPI app at `/api/miniapp/*`
- Direct SQLite access to `state.db` (sessions) and miniapp_db (boards)
- Telegram initData authentication
- Session ownership enforcement via `user_id`

### 4. Dashboard Web Server (`web_server.py`)

- Auth middleware that separates `/api/miniapp/` (initData) from other `/api/` (token)
- Plugin system for kanban boards at `/api/plugins/kanban/*`
- Session management endpoints

## Known Issues

See `TODO.md` for complete list.

### Architecture Issues

1. **Split filesystem** — SPA on host (OpenResty), backend in Docker container
2. **Duplicate API endpoints** — Both proxy and dashboard handler serve miniapp routes
3. **state.db path discovery** — Not consistent; different processes find DB differently
4. **No WebSocket for real-time updates** — SPA must refresh to see new data

### Routing Issues (Resolved)

- ✅ Telegram tgWebAppData query string caused 404 (fixed in router.js `_getPath()`)
- ✅ Hash-based routing conflicts with query parameters (normalized to kanban fallback)

## Version History

- **v1** — Initial SPA with kanban boards, sessions, tasks
- **v2** — Added router, API proxy, Telegram SDK integration
- **v3** — Session detail with messages, task creation
- **v4** — Router normalization, syntax fixes, session filters
- **v5** — Long-press drag, single-column kanban, session rename API
