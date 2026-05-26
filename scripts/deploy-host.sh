#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-/opt/data/hermes/miniapp}"
OPENRESTY_MINIAPP_DIR="${OPENRESTY_MINIAPP_DIR:-/opt/1panel/apps/openresty/openresty/www/sites/hermes/static/miniapp}"
SERVICE_SRC="$REPO/ops/tg-proxy.service"
SERVICE_DST="/etc/systemd/system/tg-proxy.service"

cd "$REPO"

test -f proxy/tg-proxy.py
test -f proxy/resume.html
test -f app/index.html
test -f "$SERVICE_SRC"

python3 -m py_compile proxy/tg-proxy.py scripts/healthcheck.py scripts/tg-proxy-watch.py
python3 -m pytest -q

mkdir -p "$OPENRESTY_MINIAPP_DIR"
tar -C "$REPO/app" -cf - . | tar -C "$OPENRESTY_MINIAPP_DIR" -xf -

install -m 0644 "$SERVICE_SRC" "$SERVICE_DST"
systemctl daemon-reload
systemctl enable tg-proxy.service >/dev/null
systemctl restart tg-proxy.service

if docker ps --format '{{.Names}}' | grep -q '^1Panel-openresty'; then
  docker exec 1Panel-openresty-iX4n nginx -s reload || true
fi

bash scripts/smoke.sh
