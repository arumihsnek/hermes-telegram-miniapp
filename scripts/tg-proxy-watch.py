#!/usr/bin/env python3
"""Ensures tg-proxy.py is running. Relaunches if dead. Idempotent."""
import subprocess, sys, os, time

SCRIPT = os.path.expanduser("~/.hermes/scripts/tg-proxy.py")
PYTHON = "/opt/hermes/.venv/bin/python3"
LOG = "/opt/data/home/tg-proxy-watch.log"

def log(msg):
    with open(LOG, "a") as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}\n")

def is_running():
    try:
        out = subprocess.check_output(
            ["pgrep", "-f", "tg-proxy.py"], timeout=5, stderr=subprocess.DEVNULL
        )
        return bool(out.strip())
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return False

if not is_running():
    log("tg-proxy not running, starting...")
    proc = subprocess.Popen(
        [PYTHON, SCRIPT],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    time.sleep(2)
    if is_running():
        log(f"tg-proxy started (PID {proc.pid})")
    else:
        log("tg-proxy FAILED to start")
else:
    log("tg-proxy already running")
