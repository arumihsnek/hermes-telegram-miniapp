# Telegram Mini App — arquitectura actual

## Principio

La integración Telegram vive fuera del WebUI nativo. No se modifican archivos nativos de Hermes ni del dashboard.

## Flujo de producción

```text
Telegram WebView
  -> https://webui.hermesinthenight.duckdns.org/
  -> OpenResty HTTPS
  -> http://127.0.0.1:9118/        tg-proxy.service
  -> http://127.0.0.1:9119/        Hermes WebUI nativo
```

## Componentes propios

- `proxy/tg-proxy.py`
  - sirve `/resume`
  - proxifica todo lo demás al WebUI nativo
  - inyecta `https://telegram.org/js/telegram-web-app.js` solo en HTML
- `proxy/resume.html`
  - UI standalone para listar/copiar/resumir sesiones
- `app/`
  - SPA estática versionada en este repo
  - se despliega a OpenResty static si se quiere usar como miniapp independiente
- `ops/tg-proxy.service`
  - supervisor real del proxy en host

## Rutas

- `/` → WebUI nativo con SDK inyectado.
- `/resume` → página propia de sesiones.
- `/api/*`, assets y demás → proxificados al WebUI nativo.

## Deploy

```bash
cd /opt/data/hermes/miniapp
make test
sudo scripts/deploy-host.sh
```

El deploy no reinicia gateway ni dashboard. Solo reinicia `tg-proxy.service` y recarga OpenResty si está disponible.

## Pendientes de producto

1. `/resume <id>` real en Telegram mediante plugin/cambio mantenible.
2. Decidir si `app/` vuelve a ser la Mini App principal o si el WebUI proxificado sigue siendo la experiencia primaria.
3. Automatizar regresión post-update: SDK injected, `/resume`, static app, OpenResty upstream.
