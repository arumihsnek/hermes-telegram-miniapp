# Hermes Mini App — Complete Implementation

**Status**: ✅ Fully Implemented and Live  
**Last Updated**: 2026-05-26  

## Overview

The Hermes Mini App is a Telegram Mini App SPA served at `/miniapp/` via tg-proxy. It provides:
- **Kanban Board View**: Manage delegated tasks
- **Agents Tab**: Shows running kanban tasks + background sessions (bg_*)
- **Cron Tab**: Schedule and manage cron jobs
- **Sessions Tab**: Browse all session types (telegram, cron, kanban, background)
- **Chat Tab**: Real-time messaging interface

## Architecture

```
Browser → HTTPS (OpenResty :443)
         ↓
         tg-proxy :9118 (HOST, systemd service)
         ├─ /miniapp/* → static SPA files from ../app/
         ├─ /resume → resume.html session picker
         └─ everything else → proxy to http://127.0.0.1:9119 (Hermes Dashboard)
                                ↓
                         Docker container
                         uvicorn on :9119 (FastAPI)
                         ├─ /api/miniapp/agents (new)
                         ├─ /api/miniapp/jobs (new)
                         ├─ /api/miniapp/jobs/{id}/toggle (new)
                         ├─ /api/miniapp/jobs/{id}/run (new)
                         └─ [existing kanban/session routes]
```

## Components

### 1. Frontend (SPA)

**Location**: `/opt/data/hermes/miniapp/app/`

| File | Purpose |
|------|---------|
| `index.html` | Shell + nav buttons (v=10) |
| `js/router.js` | Client-side routing |
| `js/pages/kanban.js` | Kanban board view |
| `js/pages/tasks.js` | **Agents tab** — running kanban tasks + bg sessions |
| `js/pages/cron.js` | **Cron tab** — job list, create/toggle/run |
| `js/pages/sessions.js` | Sessions list with filters |
| `js/pages/chat.js` | Chat interface |
| `js/utils/api.js` | API client (relative URLs to `/api/miniapp`) |
| `css/pages/tasks.css` | Agent/cron card styles |

### 2. Backend API Routes

**Location**: `/opt/hermes_code/hermes_cli/miniapp_handler.py` (persistent via docker-compose volume mount)

**Existing routes** (boards, tasks, sessions, profiles, skills, health)

**New routes (2026-05-26)**:

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/miniapp/agents` | GET | List active agents (sessions with ended_at IS NULL) grouped by source + running kanban tasks |
| `/api/miniapp/jobs` | GET | List cron jobs from `/opt/data/cron/jobs.json` |
| `/api/miniapp/jobs` | POST | Create new cron job (requires: name, prompt, schedule_minutes) |
| `/api/miniapp/jobs/{job_id}/toggle` | POST | Enable/disable cron job |
| `/api/miniapp/jobs/{job_id}/run` | POST | Trigger cron job immediately (sets next_run_at to now) |

**Data sources**:
- `agents`: Query `/opt/data/state.db` for sessions with `ended_at IS NULL`
- `running_tasks`: Query kanban boards for tasks with status="running"
- `jobs`: Read/write `/opt/data/cron/jobs.json` directly

### 3. Proxy & Static Files

**Location**: `/opt/data/hermes/miniapp/proxy/`

| File | Purpose |
|------|---------|
| `tg-proxy.py` | HTTP proxy that serves SPA + SDK injection + /resume page |
| `resume.html` | Session picker with `/resume <id>` buttons |

**tg-proxy routing**:
- `/miniapp/` → `../app/index.html`
- `/miniapp/*` → `../app/*` (static files, with path traversal check)
- `/resume` → `resume.html` (injects bot name)
- everything else → proxy to UPSTREAM (port 9119 in container)

### 4. Hermes Dashboard (Port 9119)

**Location**: `/opt/hermes/hermes_cli/web_server.py` (FastAPI app)

**Key setup**:
- Routes `/api/miniapp/*` via `miniapp_handler.py`
- Runs on port 9119 inside Docker
- Host port 9119 published externally (PANEL_APP_PORT_HTTP)

**Persistence issue fixed**: 
- Dashboard would crash on container startup and never restart
- **Solution**: Created `/opt/data/webui/dashboard-start.sh` restart loop
- **Trigger**: `/opt/data/webui/docker-entrypoint-wrapper.sh` starts it with auto-restart

## Agents Tab Behavior

**File**: `js/pages/tasks.js`

Shows:
1. **Running kanban tasks** — from `delegate_task` / `/btw` commands (task title, assignee, elapsed time)
2. **Background sessions** (bg_*) — worker sessions for long-running jobs

Auto-refreshes every 30 seconds.

**Removed** (use Sessions tab instead):
- Telegram active sessions
- Cron active sessions

## Cron Tab Behavior

**File**: `js/pages/cron.js`

Features:
- **List**: Shows job name, schedule (e.g., "every 15m"), last status (ok/error), next run time, last error
- **Inline Create**: Form to create new cron job (name, prompt, skill, interval in minutes)
- **Actions**: "▶ Run" (immediate), "Pausar/Activar" (toggle enabled flag)
- **State**: Color-coded status dots (green=ok, red=error, gray=pending)

**Data source**: `/opt/data/cron/jobs.json` (read/write direct JSON)

## /resume Command

**File**: `/opt/hermes_code/gateway/platforms/telegram.py` (persistent via docker-compose)

Intercept in `TelegramAdapter._handle_command()`:
- Receives `/resume bg_15412` (8-char session ID prefix from Mini App buttons)
- Resolves full session ID via `SessionDB.resolve_session_id(arg)`
- Switches session and replies with confirmation

Falls through to title-based handler if ID resolution fails.

## Key Files & Persistence

| Path | Persistent? | Purpose |
|------|-------------|---------|
| `/opt/hermes_code/gateway/platforms/telegram.py` | ✅ | `/resume` command implementation |
| `/opt/hermes_code/hermes_cli/miniapp_handler.py` | ✅ | API routes for agents/jobs |
| `/opt/data/hermes/miniapp/app/*` | ✅ | SPA static files |
| `/opt/data/hermes/miniapp/proxy/tg-proxy.py` | ✅ | Proxy with `/miniapp/` serving |
| `/opt/data/webui/dashboard-start.sh` | ✅ | Dashboard restart loop |
| `/opt/data/webui/docker-entrypoint-wrapper.sh` | ✅ | Patches entrypoint to use restart loop |

**docker-compose volume mounts**:
```yaml
- /opt/hermes_code/gateway/platforms/telegram.py:/opt/hermes/gateway/platforms/telegram.py:rw
- /opt/hermes_code/hermes_cli/miniapp_handler.py:/opt/hermes/hermes_cli/miniapp_handler.py:rw
```

## Deployment Notes

**Live on**: `https://webui.hermesinthenight.duckdns.org/miniapp/`

**Service status**:
- tg-proxy: systemd service (restart via `sudo systemctl restart tg-proxy`)
- Dashboard: auto-restarts on crash via wrapper script
- Webui (server.py): auto-restarts on crash via start.sh

**Testing**:
```bash
# Full flow through tg-proxy
curl -s http://127.0.0.1:9118/miniapp/ | head -5       # SPA
curl -s http://127.0.0.1:9118/api/miniapp/agents       # API
curl -s http://127.0.0.1:9118/api/miniapp/jobs         # Cron jobs
```

## Future Enhancements

- [ ] Show queued/pending kanban tasks in Agents tab (not just running)
- [ ] Add task detail view and edit capability
- [ ] Add job execution history / logs
- [ ] Real-time updates via WebSocket instead of 30s polling
- [ ] Mobile-optimized cron job creation form
