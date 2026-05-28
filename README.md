# hermes-telegram-miniapp

Self-contained Telegram Mini App integration for Hermes Agent.

**Status**: Consolidated repo with unified installer (May 2026)

## Quick Start

```bash
# Install to ~/.hermes (default)
./install.sh

# Or custom location
./install.sh --hermes-dir /path/to/hermes

# Preview without changes
./install.sh --dry-run
```

## Structure

```
hermes-telegram-miniapp/
├── install.sh                    # Self-installer
├── README.md                     # This file
├── app/                          # Static SPA (HTML/JS/CSS)
├── proxy/                        # Reverse proxy (SDK injection)
├── scripts/                      # Operations & monitoring
├── ops/                          # Systemd & configs
├── tests/                        # Test suite
└── docs/                         # Full documentation
```

## How It Works

### Architecture

```
Telegram WebView (HTTPS)
    ↓
OpenResty nginx :443
    ↓
tg-proxy.py :9118 (host)
    ├─ Injects Telegram SDK
    └─ Proxies to:
         ↓
      Hermes WebUI :9119
```

### Installation

1. **install.sh** deploys:
   - Proxy files to `/opt/data/hermes/miniapp/`
   - Systemd service
   - Web assets to OpenResty
   - Reloads services

2. **tg-proxy.py** (runtime):
   - Intercepts Telegram WebView requests
   - Injects Telegram WebApp SDK
   - Proxies to Hermes dashboard

## Development

```bash
# Health check
python3 scripts/healthcheck.py

# Smoke test
bash scripts/smoke.sh

# Run tests
python3 -m pytest -v tests/

# Deploy
./install.sh
```

## Public URLs

- **Mini App**: `https://miniapp.hermesinthenight.duckdns.org/`
- **Web UI**: `https://webui.hermesinthenight.duckdns.org/`
- **Dashboard**: `https://dashboard.hermesinthenight.duckdns.org/`

## Documentation

- **Full Architecture**: See `docs/ARCHITECTURE.md`
- **Deployment Guide**: See `docs/DEPLOYMENT.md`
- **API Reference**: See `docs/API.md`
- **Technical Details**: See `docs/references/`

## Version

**v6.0.0** — Consolidated as self-contained repo (2026-05-28)
