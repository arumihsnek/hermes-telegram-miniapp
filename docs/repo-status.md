# Repo status — Mini App

Fecha: 2026-05-26

## Decisión

El proyecto vive en `/opt/data/hermes/miniapp` como repo único propio.

## Qué es fuente de verdad

- `app/` para la SPA estática de Mini App.
- `proxy/` para el reverse proxy Telegram SDK + `/resume`.
- `ops/` para systemd.
- `scripts/` para deploy, smoke y el único healthcheck operativo.
- `docs/` para arquitectura/planes.

## Qué NO es fuente de verdad

- `references/native-snapshots/` son copias de lectura.
- OpenResty static es destino de deploy, no edición manual.
- Hermes/WebUI/gateway nativos no se parchean desde este repo salvo decisión explícita y mantenible.

## Producción actual

- `tg-proxy.service` activo en host.
- `webui.hermesinthenight.duckdns.org` apunta a `127.0.0.1:9118`.
- upstream real WebUI: `127.0.0.1:9119`.
