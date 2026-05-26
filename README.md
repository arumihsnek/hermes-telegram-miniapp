# HERMES Telegram Mini App

Repo único para la Mini App de Telegram de HERMES **sin tocar archivos nativos de Hermes/WebUI**.

## Estado actual

Producción usa esta cadena:

```text
Telegram Mini App / WebView
  -> https://webui.hermesinthenight.duckdns.org/
  -> OpenResty :443
  -> tg-proxy.service :9118
  -> Hermes WebUI nativo :9119
```

Este repo contiene dos piezas propias:

- `proxy/` — proxy independiente que inyecta Telegram WebApp SDK y sirve `/resume`.
- `app/` — SPA Mini App estática consolidada desde OpenResty para que también viva aquí como fuente versionada.

Y contiene solo copias de referencia de cosas nativas:

- `references/native-snapshots/` — snapshots para estudiar/integrar; **no son destino de deploy automático**.

## Regla de oro

No editar directamente:

- `/opt/hermes/gateway/*`
- `/opt/hermes/hermes_cli/*`
- WebUI nativo
- `web_server.py`, HTML/JS nativos del WebUI

Todo lo propio debe vivir aquí y desplegarse alrededor:

- proxy por systemd
- SPA estática por OpenResty
- documentación/scripts/tests en este repo

## Estructura

```text
app/                         SPA estática propia de Mini App
proxy/tg-proxy.py            reverse proxy + SDK injection + /resume
proxy/resume.html            página de sesiones standalone
scripts/healthcheck.py       healthcheck único full-stack
scripts/smoke.sh             smoke test rápido
scripts/deploy-host.sh       deploy desde repo host
scripts/tg-proxy-watch.py    watchdog legacy; systemd es preferido
ops/tg-proxy.service         unidad systemd versionada
docs/                        arquitectura, planes y decisiones
references/                  docs legacy y snapshots nativos no desplegables
tests/                       tests de regresión del proxy
```

## Desarrollo rápido

```bash
cd /opt/data/hermes/miniapp
make test
make smoke
make healthcheck
```

## Deploy

El repo ya vive en el host en `/opt/data/hermes/miniapp`.

```bash
cd /opt/data/hermes/miniapp
sudo scripts/deploy-host.sh
```

Qué hace:

1. sincroniza `app/` a OpenResty static miniapp
2. instala/actualiza `ops/tg-proxy.service`
3. recarga systemd
4. reinicia solo `tg-proxy.service`
5. recarga OpenResty si el contenedor existe
6. ejecuta smoke test

No reinicia gateway ni WebUI nativo.

## URLs

- Mini App URL del bot: `https://webui.hermesinthenight.duckdns.org/`
- Resume: `https://webui.hermesinthenight.duckdns.org/resume`
- Proxy local: `http://127.0.0.1:9118/`
- WebUI local upstream: `http://127.0.0.1:9119/`

## Pendiente importante

`/resume <id>` directo en Telegram no debe implementarse tocando nativo a ciegas. Primero diseñar un plugin/wrapper o un cambio upstream mantenible. Mientras tanto `/resume` ofrece Copy/Resume manual.
