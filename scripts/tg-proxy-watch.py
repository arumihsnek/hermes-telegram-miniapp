#!/usr/bin/env python3
"""Legacy watchdog for tg-proxy.

Preferred production supervisor is systemd (`tg-proxy.service`). This script is kept for cron
fallbacks and now targets the repo path, not ~/.hermes/scripts.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SCRIPT = Path(os.environ.get("TG_PROXY_SCRIPT", REPO / "proxy" / "tg-proxy.py"))
PYTHON = os.environ.get("TG_PROXY_PYTHON", sys.executable or "/usr/bin/python3")
LOG = Path(os.environ.get("TG_PROXY_WATCH_LOG", "/tmp/tg-proxy-watch.log"))
PORT = os.environ.get("TG_PROXY_PORT", "9118")


def log(message: str) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as fh:
        fh.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {message}\n")


def is_running() -> bool:
    try:
        out = subprocess.check_output(["pgrep", "-f", str(SCRIPT)], timeout=5, stderr=subprocess.DEVNULL)
        return bool(out.strip())
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return False


def main() -> int:
    if not SCRIPT.exists():
        log(f"missing script: {SCRIPT}")
        return 1
    if is_running():
        log("tg-proxy already running")
        return 0
    log(f"tg-proxy not running; starting {SCRIPT} on port {PORT}")
    proc = subprocess.Popen([PYTHON, str(SCRIPT)], cwd=str(SCRIPT.parent), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    time.sleep(2)
    if is_running():
        log(f"tg-proxy started pid={proc.pid}")
        return 0
    log("tg-proxy failed to start")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
