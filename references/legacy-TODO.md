# TODO — HERMES Mini App

## Current Status (v5 — 26 May 2026)

### ✅ Completed
- [x] SPA routing with hash-based Router (normalization for tgWebAppData)
- [x] Telegram WebApp SDK integration (theme, back button, viewport)
- [x] Kanban board list + single-column detail with long-press drag
- [x] **Kanban "Add Task" form** — Asignee, Skills, Dependencies, Title, Description. Buttons: Save (→triage), Specify, Cancel, Todo/Ready
- [x] Tasks CRUD (create, edit, list, grouped by status)
- [x] Sessions list + detail with filter checkboxes, badges, rename
- [x] Dashboard/WebUI external redirects
- [x] Dashboard miniapp handler (direct SQLite, Telegram initData auth)
- [x] PATCH /api/miniapp/sessions/:id rename endpoint
- [x] Router normalization fixes (tgWebAppData, empty hash, / path)
- [x] tasks.js syntax fix (broken onclick quotes)
- [x] Nginx proxy fixed: /api/miniapp/ → dashboard :9119 (no prefix strip)
- [x] Dashboard deployed and verified
- [x] SPA deployed to OpenResty
- [x] Git repo at /opt/data/miniapp/ with full docs
- [x] Skill hermes-miniapp created
- [x] Session detail: formatted tool/assistant/user messages
- [x] GET /api/miniapp/profiles endpoint
- [x] Backend: expanded create_task with all fields (assignee, skills, parents, priority, triage, tenant)
- [x] **Session source filter** — Backend `?source=` param with `WHERE source IN (...)` SQL
- [x] Frontend filters wired to backend `?source=` — server-side filtering instead of loading all 265 sessions

### ❌ Pending

#### Frontend (SPA)
- [x] **Dependency selector** — In kanban form as checkboxes from same board (done in v6)
- [ ] **Tasks redesign** — Per-session containers with task cards (instead of grouped by status)
- [x] **Chat page** — Conversation list with last message preview, message input that opens Telegram, +New Chat
- [x] Sessions API: last_message + last_role field
- [ ] **Dashboard embed** — iframe or native MiniApp link
- [ ] **WebUI embed** — iframe
- [ ] **Terminal tab** — Terminal emulator page
- [ ] **Pull-to-refresh** — Refresh lists on pull gesture
- [ ] **Toast notifications** — In-app notifications

#### Backend (Dashboard Handler)
- [ ] **Session source filter param** — Backend `?source=...` to pre-filter
- [ ] **Pagination** — Proper cursor-based pagination
- [ ] **WebSocket** — Real-time updates for session/board changes

#### Infrastructure
- [ ] **CI/CD** — Auto-deploy on git push
- [ ] **Monitoring** — Health check for dashboard (cron or systemd)
- [ ] **Bot Telegram Mini App URL** — Verify BotFather config for miniapp URL

### 🐛 Known Bugs
1. ~~**state.db hardcoded** — Path is `/opt/data/state.db` in handler. Must match `get_hermes_home()`.~~ ✅ **Fixed in v7** — Now uses `config.get_hermes_home() / 'state.db'`
2. **Session list too large** — 263 sessions loaded at once; client-side filter only (mitigated by server-side `?source=` filter)
3. **Kanban drag visual** — Long-press pulse animation subtle on some themes
4. **Dashboard dies on restart** — Must manually restart via SSH docker exec
5. **Nginx proxy IP** — 172.18.0.2 may change if container restarts (check docker inspect)
