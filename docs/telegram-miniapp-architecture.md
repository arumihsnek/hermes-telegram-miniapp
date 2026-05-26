# Telegram Mini App — Estado y Documentación

## Estado actual (26 Mayo 2026)

### URLs activas
| URL | Sirve | Puerto |
|-----|-------|--------|
| `https://webui.hermesinthenight.duckdns.org/` | WebUI completo | :443 → host → :9118 |
| `https://webui.hermesinthenight.duckdns.org/resume` | Página sesiones (independiente) | :443 → host → :9118 |
| `https://t.me/evh055_bot` | Bot Telegram | gateway |
| `https://t.me/evh055_bot?startapp=dashboard` | Deep link Mini App | - |
| `http://127.0.0.1:9118/` | Proxy (tg-proxy.py) | 9118 |
| `http://127.0.0.1:9119/` | WebUI nativo Hermes | 9119 |
| `http://127.0.0.1:8788/` | API WebUI interna | 8788 |

### Proxy independiente (`:9118`)
- **No modifica nada nativo** — sobrevive a actualizaciones de Hermes/WebUI
- Inyecta Telegram WebApp SDK en el HTML del WebUI
- Sirve `/resume` con lista de sesiones (filtros: Todas/Programadas/Chats/Vacías)
- Botón **Copy** → copia `/resume <id>` al portapapeles
- Botón **Resume** → abre `t.me/evh055_bot?start=<id>`
- Watchdog via cron cada 5min (script `tg-proxy-watch.py`)

### Archivos del proyecto (no nativos)
| Archivo | Propósito |
|---------|-----------|
| `~/.hermes/scripts/tg-proxy.py` | Proxy con inyección SDK + /resume page |
| `~/.hermes/scripts/tg-proxy-watch.py` | Watchdog que mantiene proxy vivo |
| `~/.hermes/scripts/telegram-miniapp-architecture.md` | Esta documentación |

### Mini App independiente (`/opt/data/miniapp/`)
- Kanban con long-press drag para móvil (500ms activación)
- ✅ Bugfix: bloquea scroll durante drag via `touch-action:none` + `overflow:hidden`
- Sessions list con filtros por tipo (cron/msg/vacías)
- Tasks grouped by status
- Telegram SDK integrado (tema, haptics, back button)

---

## 🐛 Bugs conocidos

### 1. Kanban drag: scroll no bloqueado ✅ FIXED
- **Síntoma:** al mantener pulsado y arrastrar, el contenido se mueve con la card
- **Causa:** `preventDefault()` en touchmove no detiene scroll si el listener es pasivo
- **Fix:** `document.body.style.touchAction = 'none'` al activar drag, se restaura en drop
- **Archivo:** `/opt/data/miniapp/js/pages/kanban.js` (commit `0a5110d`)

### 2. WebUI nativo (> v0.51.120): cambios sin commit
- **Archivos:** `api/routes.py`, `api/streaming.py`, `start.sh`, `static/boot.js`, `static/login.js`, `static/messages.js`
- **Cambios:** voz/transcripción, orden de mensajes, navegación móvil, swipe edges, start.sh wrapper
- **Estado:** pendiente de commit (`.git` es root, sin permisos hermes)
- **Riesgo:** se perderán al actualizar WebUI si no se commitean antes

---

## 🎯 Roadmap — Próximos pasos

### Prioridad alta
1. **Comando `/resume <id>` en Telegram**
   - El bot recibe `/resume abc123` → busca sesión por ID prefix → crea hilo con contexto
   - Implementar en gateway/platforms/telegram.py (aunque es nativo)
   - Alternativa: plugin de gateway que intercepte el comando

2. **Revisión semanal de salud del proxy**
   - Verificar que `tg-proxy.py` sigue corriendo
   - Verificar cron watchdog funciona
   - Verificar inyección SDK sigue funcionando tras actualizaciones

3. **Migrar a plugin de Hermes** (en lugar de proxy)
   - Hermes tiene sistema de plugins en `/opt/data/plugins/`
   - Un plugin podría inyectar el SDK y servir rutas sin proxy separado
   - Más estable y mantenible

### Prioridad media
4. **Autenticación via Telegram SDK**
   - Usar `initDataUnsafe` del SDK para identificar usuario Telegram
   - Asociar `telegram_user_id` ↔ `session_token` automáticamente
   - Evitar el doble fetch para obtener token

5. **Notificaciones de sesiones completadas**
   - Cuando agente termina tarea larga → notificación con deep link a la sesión

6. **Deep links directos a sesiones**
   - `t.me/evh055_bot?start=session_abc12345` → abre Mini App en esa sesión

### Prioridad baja
7. **WebUI nativo: commit de cambios pendientes**
   - Necesita acceso root al `.git` del webui
   - O copiar los cambios a un fork

8. **Prueba de regresión post-actualización**
   - Script que verifique: proxy activo, SDK inyectado, /resume funcional, API responde

---

## 🔧 Para el siguiente desarrollador

### Cómo iniciar el proxy manualmente
```bash
# Via watchdog (recomendado)
/opt/hermes/.venv/bin/python3 ~/.hermes/scripts/tg-proxy-watch.py

# Directo
/opt/hermes/.venv/bin/python3 ~/.hermes/scripts/tg-proxy.py
```

### Cómo verificar que funciona
```bash
curl -s http://127.0.0.1:9118/resume | head -5
curl -s http://127.0.0.1:9118/ | grep -c "telegram-web-app.js"
```

### Para commitear en webui (como root)
```bash
sudo git -C /opt/data/webui add -A
sudo git -C /opt/data/webui commit -m "feat: descripción"
```

### Para añadir ruta nueva al proxy
Editar `~/.hermes/scripts/tg-proxy.py`, añadir bloque en el método `do()`:
```python
if self.path == "/mi-ruta":
    body = MI_PAGINA.encode()
    self.send_response(200)
    self.send_header("Content-Type", "text/html; charset=utf-8")
    self.end_headers()
    self.wfile.write(body)
    return
```
