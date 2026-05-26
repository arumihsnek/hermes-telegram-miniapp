#!/usr/bin/env python3
"""Health check for HERMES Mini App stack.
Checks: dashboard API, nginx proxy, state.db.

Non-zero exit + error message on failure. Silent on success.
"""
import json
import sys
import urllib.request
import urllib.error

# Config
DASHBOARD_URL = "http://localhost:9119/api/miniapp/health"
NGINX_URL = "https://hermes.cloudinthenight.duckdns.org/api/miniapp/health"
STATE_DB = "/opt/data/state.db"

errors = []

# 1. Dashboard health
try:
    resp = urllib.request.urlopen(DASHBOARD_URL, timeout=10)
    data = json.loads(resp.read())
    if data.get("status") != "ok":
        errors.append(f"Dashboard health: status={data.get('status')}")
except Exception as e:
    errors.append(f"Dashboard unreachable: {e}")

# 2. Nginx proxy (full stack)
try:
    ctx = urllib.request.build_opener()
    resp = ctx.open(NGINX_URL, timeout=15)
    data = json.loads(resp.read())
    if data.get("status") != "ok":
        errors.append(f"Nginx health: status={data.get('status')}")
except Exception as e:
    errors.append(f"Nginx unreachable: {e}")

# 3. State.db
from pathlib import Path
db = Path(STATE_DB)
if not db.exists():
    errors.append(f"state.db not found at {STATE_DB}")
elif db.stat().st_size < 1024:
    errors.append(f"state.db too small: {db.stat().st_size} bytes")

if errors:
    print("HERMES MINIAPP HEALTH ALERT:")
    for e in errors:
        print(f"  ! {e}")
    sys.exit(1)
