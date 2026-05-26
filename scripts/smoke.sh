#!/usr/bin/env bash
set -euo pipefail

PROXY_URL="${TG_PROXY_HEALTH_URL:-http://127.0.0.1:9118/}"
RESUME_URL="${TG_PROXY_RESUME_URL:-http://127.0.0.1:9118/resume}"
PUBLIC_URL="${MINIAPP_PUBLIC_URL:-https://webui.hermesinthenight.duckdns.org/}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

curl -fsSL "$PROXY_URL" -o "$tmp/proxy.html"
grep -q 'telegram-web-app.js' "$tmp/proxy.html"

curl -fsSL "$RESUME_URL" -o "$tmp/resume.html"
grep -q 'Resume' "$tmp/resume.html"
! grep -q '__BOT__' "$tmp/resume.html"

curl -fsSL "$PUBLIC_URL" -o "$tmp/public.html"
grep -q 'telegram-web-app.js' "$tmp/public.html"

echo "smoke ok: proxy, /resume, public HTTPS"
