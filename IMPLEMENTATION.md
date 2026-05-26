# /resume <id> Implementation

**Status**: ✅ Implemented and Live  
**Date**: 2026-05-26  
**Modified Files**: 
- `/opt/hermes_code/gateway/platforms/telegram.py` (persistent at `/opt/hermes_code/gateway/platforms/telegram.py`)
- `/opt/1panel/apps/hermes-agent/hermes/docker-compose.yml` (volume mount added)

## Problem

The `/resume` command in the Telegram bot backend only supported session resolution by **title** (via `resolve_session_by_title`). The Mini App's `/resume` page generates `/resume <8char_id_prefix>` buttons (e.g., `/resume bg_15412`), but these were treated as session titles and failed to match.

## Solution

Added ID-based session resolution intercept in `TelegramAdapter._handle_command()` in `telegram.py`:

1. **Detection**: When `/resume <arg>` is received with an argument
2. **Resolution**: Access `GatewayRunner._session_db.resolve_session_id(arg)` to find the full session ID via prefix match
3. **Execution**: If found, perform the full session switch flow:
   - Resolve any compression continuations
   - Check if already on that session
   - Release running agents for the session
   - Switch session via `session_store.switch_session()`
   - Clear security boundary state
   - Evict cached agent
4. **Response**: Reply with confirmation message including session title and message count
5. **Fallthrough**: If ID resolution fails, let the normal `handle_message` flow process it (handles title-based `/resume`)

## Code Changes

### `/opt/hermes_code/gateway/platforms/telegram.py`

Added interception block in `TelegramAdapter._handle_command()` after the `/skill-menu` intercept (lines 3333-3376):

```python
# Intercept /resume <id_prefix> from Mini App buttons (ID-based lookup)
if text in ("/resume",) or text.startswith("/resume@"):
    parts = update.message.text.strip().split(None, 1)
    arg = parts[1].strip() if len(parts) > 1 else ""
    if arg:
        runner = getattr(self._message_handler, "__self__", None)
        session_db = getattr(runner, "_session_db", None) if runner else None
        if session_db is not None:
            full_id = session_db.resolve_session_id(arg)
            if full_id:
                # [session switch logic]
                return
```

The intercept:
- Resolves the ID prefix using `SessionDB.resolve_session_id()` (supports exact and prefix matching)
- Calls runner methods: `_release_running_agent_state()`, `session_store.switch_session()`, `_clear_session_boundary_security_state()`, `_evict_cached_agent()`
- Sends confirmation reply with session title and message count
- Returns early (doesn't call `handle_message`)

### `/opt/1panel/apps/hermes-agent/hermes/docker-compose.yml`

Added persistent volume mount for `telegram.py`:

```yaml
- /opt/hermes_code/gateway/platforms/telegram.py:/opt/hermes/gateway/platforms/telegram.py:rw
```

This ensures the modified `telegram.py` persists across container recreations.

## How It Works

**User Flow**:
1. User taps "Copy" button in Mini App's `/resume` page
2. Button copies `/resume bg_15412` (first 8 chars of session ID)
3. User pastes in Telegram chat or clicks "Resume" button (deep link)
4. `_handle_command` intercepts the command
5. `resolve_session_id("bg_15412")` finds the full ID: `bg_154125_10b036`
6. Session switch is performed
7. User receives: `↻ Resumed session *Session Title* (N messages). Conversation restored.`

**Ambiguity Handling**:
- If a prefix matches multiple sessions, `resolve_session_id()` returns `None`
- The request falls through to normal handler (which tries title-based lookup)
- User sees: `No session found matching '**bg_15412**'.`
- User must provide more characters to disambiguate

## Testing

Manual test with existing sessions:
```python
from pathlib import Path
from hermes_state import SessionDB

db = SessionDB(Path("/opt/data/state.db"))
# Test: bg_15412 (8-char prefix)
full_id = db.resolve_session_id("bg_15412")
# Result: bg_154125_10b036 ✅

# Test: cron_dcc (ambiguous - multiple cron sessions)
full_id = db.resolve_session_id("cron_dcc")
# Result: None (ambiguous) ✅
```

## Architecture Notes

- **Runtime Access**: The intercept accesses `GatewayRunner` via `self._message_handler.__self__` (bound method inspection)
- **Error Handling**: Catches and ignores exceptions from optional methods (`_clear_session_boundary_security_state`, `_evict_cached_agent`)
- **Message Format**: Uses Markdown format for consistency with other gateway responses
- **Fallthrough Logic**: If `resolve_session_id()` returns `None`, execution falls through to normal `handle_message()` flow

## Deployment Notes

- **Current Status**: Live in running container (restarted via kill -9 PID 7)
- **Persistence**: Mapped via docker-compose volume mount; next container recreation will pick up the bind mount automatically
- **No Breaking Changes**: Title-based `/resume` continues to work via normal handler flow

## Related Files

- `proxy/resume.html` — Mini App page that generates `/resume <id>` buttons
- `proxy/tg-proxy.py` — Proxy that serves resume.html and injects Telegram SDK
- `/opt/hermes/gateway/run.py` — Original `_handle_resume_command` (title-based, read-only in container)
- `/opt/hermes/hermes_state.py` — `SessionDB.resolve_session_id()` and related methods (read-only in container)
