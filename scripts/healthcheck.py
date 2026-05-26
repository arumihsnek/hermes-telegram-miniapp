#!/usr/bin/env python3
"""Health check for the HERMES Telegram Mini App stack.

Silent on success. Prints actionable errors and exits non-zero on failure.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

PROXY_URL = os.environ.get("TG_PROXY_HEALTH_URL", "http://127.0.0.1:9118/")
RESUME_URL = os.environ.get("TG_PROXY_RESUME_URL", "http://127.0.0.1:9118/resume")
PUBLIC_URL = os.environ.get("MINIAPP_PUBLIC_URL", "https://webui.hermesinthenight.duckdns.org/")
DASHBOARD_URL = os.environ.get("HERMES_WEBUI_HEALTH_URL", "http://127.0.0.1:9119/api/miniapp/health")
STATE_DB_CANDIDATES = [
    Path(p)
    for p in os.environ.get(
        "HERMES_STATE_DB_CANDIDATES",
        "/opt/data/state.db:/opt/1panel/apps/hermes-agent/hermes/data/state.db",
    ).split(":")
    if p
]


def fetch(url: str, timeout: int = 12) -> tuple[int, bytes, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "hermes-miniapp-healthcheck/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read(), resp.headers.get("content-type", "")


def main() -> int:
    errors: list[str] = []

    for label, url in (("proxy", PROXY_URL), ("public", PUBLIC_URL)):
        try:
            status, body, _ = fetch(url)
            if status != 200:
                errors.append(f"{label}: HTTP {status}")
            if b"telegram-web-app.js" not in body:
                errors.append(f"{label}: Telegram SDK not injected")
        except Exception as exc:
            errors.append(f"{label}: unreachable: {exc}")

    try:
        status, body, _ = fetch(RESUME_URL)
        if status != 200:
            errors.append(f"resume: HTTP {status}")
        if b"__BOT__" in body or b"Resume" not in body:
            errors.append("resume: page not rendered as expected")
    except Exception as exc:
        errors.append(f"resume: unreachable: {exc}")

    try:
        status, body, _ = fetch(DASHBOARD_URL)
        data = json.loads(body.decode("utf-8"))
        if status != 200 or data.get("status") != "ok":
            errors.append(f"dashboard health: HTTP {status}, status={data.get('status')!r}")
    except Exception as exc:
        # Older dashboard builds may not expose /api/miniapp/health. Keep this as warning-level failure
        # because the proxy/WebUI root checks above are the production Mini App path.
        errors.append(f"dashboard health: unavailable: {exc}")

    state_db = None
    state_db_permission_denied = []
    for path in STATE_DB_CANDIDATES:
        try:
            if path.exists():
                state_db = path
                break
        except PermissionError:
            state_db_permission_denied.append(str(path))
    if state_db is None and not state_db_permission_denied:
        errors.append("state.db missing in candidates: " + ", ".join(str(p) for p in STATE_DB_CANDIDATES))
    elif state_db is not None:
        try:
            if state_db.stat().st_size < 1024:
                errors.append(f"state.db too small: {state_db.stat().st_size} bytes at {state_db}")
        except PermissionError:
            pass

    if errors:
        print("HERMES MINIAPP HEALTH ALERT:")
        for err in errors:
            print(f"  ! {err}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
