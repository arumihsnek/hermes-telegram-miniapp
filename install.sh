#!/bin/bash
# ============================================================================
# Hermes Telegram Mini App Installer
# ============================================================================
# Self-contained installer for the Telegram Mini App integration.
#
# Usage:
#   ./install.sh
#   ./install.sh --hermes-dir /custom/path
#   ./install.sh --copy                 # Use copies instead of symlinks
#   ./install.sh --dry-run              # Preview only
#   ./install.sh --yes                  # Skip confirmations
#
# This installer:
# 1. Deploys proxy scripts (tg-proxy.py) to the operational repo
# 2. Installs systemd service (tg-proxy.service)
# 3. Deploys web assets to OpenResty
# 4. Reloads services (systemd, nginx)
# 5. Runs health checks
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Parse arguments
USE_SYMLINKS=true
DRY_RUN=false
SKIP_CONFIRM=false
HERMES_DIR=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --hermes-dir) HERMES_DIR="$2"; shift 2 ;;
    --copy) USE_SYMLINKS=false; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    --yes) SKIP_CONFIRM=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Detect HERMES_DIR
if [ -z "$HERMES_DIR" ]; then
  HERMES_DIR="$HOME/.hermes"
fi

if [ ! -d "$HERMES_DIR" ]; then
  echo -e "${RED}✗${NC} HERMES_DIR not found: $HERMES_DIR"
  exit 1
fi

echo ""
echo -e "${CYAN}🐝 Hermes Telegram Mini App Installer${NC}"
echo "Target: $HERMES_DIR"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}DRY-RUN MODE${NC} (no changes will be made)"
  echo ""
fi

# ============================================================================
# Phase 1: Deploy proxy files
# ============================================================================

echo -e "${CYAN}→${NC} Deploying proxy files..."

MINIAPP_OPS_DIR="/opt/data/hermes/miniapp"
if [ ! -d "$MINIAPP_OPS_DIR" ]; then
  if [ "$DRY_RUN" = false ]; then
    mkdir -p "$MINIAPP_OPS_DIR/proxy"
  fi
  echo -e "${YELLOW}⚠${NC} Creating operational repo at $MINIAPP_OPS_DIR"
fi

if [ "$DRY_RUN" = false ]; then
  if [ "$USE_SYMLINKS" = true ]; then
    ln -sf "$SCRIPT_DIR/proxy/tg-proxy.py" "$MINIAPP_OPS_DIR/proxy/tg-proxy.py"
    ln -sf "$SCRIPT_DIR/proxy/resume.html" "$MINIAPP_OPS_DIR/proxy/resume.html"
    echo -e "${GREEN}✓${NC} Proxy files symlinked (live updates on git pull)"
  else
    cp "$SCRIPT_DIR/proxy/tg-proxy.py" "$MINIAPP_OPS_DIR/proxy/tg-proxy.py"
    cp "$SCRIPT_DIR/proxy/resume.html" "$MINIAPP_OPS_DIR/proxy/resume.html"
    echo -e "${GREEN}✓${NC} Proxy files copied"
  fi
else
  echo -e "${YELLOW}[DRY-RUN]${NC} Would deploy proxy files to $MINIAPP_OPS_DIR"
fi

# ============================================================================
# Phase 2: Install systemd service
# ============================================================================

echo -e "${CYAN}→${NC} Installing systemd service..."

SERVICE_CONTENT="$(cat "$SCRIPT_DIR/ops/tg-proxy.service")"
SERVICE_CONTENT="${SERVICE_CONTENT//{{MINIAPP_REPO_PATH}}/$SCRIPT_DIR}"

if [ "$DRY_RUN" = false ]; then
  echo "$SERVICE_CONTENT" | sudo tee /etc/systemd/system/tg-proxy.service > /dev/null
  sudo systemctl daemon-reload
  echo -e "${GREEN}✓${NC} Systemd service installed"
else
  echo -e "${YELLOW}[DRY-RUN]${NC} Would install systemd service with:"
  echo "  Path: $SCRIPT_DIR"
fi

# ============================================================================
# Phase 3: Deploy web assets to OpenResty
# ============================================================================

echo -e "${CYAN}→${NC} Deploying web assets to OpenResty..."

OPENRESTY_DIR="/opt/1panel/apps/openresty/openresty/www/sites/hermesinthenight/static/miniapp"

if [ "$DRY_RUN" = false ]; then
  if [ -d "$OPENRESTY_DIR" ]; then
    sudo cp -r "$SCRIPT_DIR/app"/* "$OPENRESTY_DIR/"
    echo -e "${GREEN}✓${NC} Web assets deployed to OpenResty"
  else
    echo -e "${YELLOW}⚠${NC} OpenResty directory not found: $OPENRESTY_DIR"
    echo "  (Will be created on first deployment)"
  fi
else
  echo -e "${YELLOW}[DRY-RUN]${NC} Would deploy web assets to $OPENRESTY_DIR"
fi

# ============================================================================
# Phase 4: Restart services
# ============================================================================

echo -e "${CYAN}→${NC} Restarting services..."

if [ "$DRY_RUN" = false ]; then
  # Restart systemd service
  sudo systemctl restart tg-proxy.service
  sleep 2
  echo -e "${GREEN}✓${NC} tg-proxy.service restarted"

  # Reload nginx (OpenResty)
  if command -v docker &> /dev/null; then
    OPENRESTY_CONTAINER=$(sudo docker ps -q --filter name=openresty 2>/dev/null || echo "")
    if [ -n "$OPENRESTY_CONTAINER" ]; then
      sudo docker exec "$OPENRESTY_CONTAINER" nginx -s reload 2>/dev/null || true
      echo -e "${GREEN}✓${NC} OpenResty nginx reloaded"
    fi
  fi
else
  echo -e "${YELLOW}[DRY-RUN]${NC} Would restart tg-proxy.service and reload nginx"
fi

# ============================================================================
# Phase 5: Health checks
# ============================================================================

echo -e "${CYAN}→${NC} Running health checks..."

if [ "$DRY_RUN" = false ]; then
  if [ -f "$SCRIPT_DIR/scripts/healthcheck.py" ]; then
    python3 "$SCRIPT_DIR/scripts/healthcheck.py" 2>/dev/null || {
      echo -e "${YELLOW}⚠${NC} Health check failed (may need a moment to start)"
    }
  fi
  echo -e "${GREEN}✓${NC} Health check complete"
else
  echo -e "${YELLOW}[DRY-RUN]${NC} Would run health checks"
fi

# ============================================================================
# Summary
# ============================================================================

echo ""
if [ "$DRY_RUN" = true ]; then
  echo -e "${GREEN}✓ Installation plan ready (use without --dry-run to execute)${NC}"
else
  echo -e "${GREEN}✓ Installation complete!${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Verify miniapp is accessible:"
  echo "     curl https://miniapp.hermesinthenight.duckdns.org/"
  echo ""
  echo "  2. Check service status:"
  echo "     systemctl status tg-proxy.service"
  echo ""
  echo "  3. Monitor health:"
  echo "     python3 scripts/healthcheck.py"
fi
echo ""
