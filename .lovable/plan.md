## Qué pasa

Tu correo **sí se generó**, pero está atorado — no salió del servidor a Mailgun.

Pruebas:
- En `email_send_log` veo 4 envíos a `hector@lopezbenavides.com` hoy (03:40 y 03:47 UTC) con status `pending` — nunca pasaron a `sent`.
- La cola `transactional_emails` tiene **4 mensajes visibles** sin procesar (el más viejo lleva 14 min esperando).
- El worker `process-email-queue` se está despertando cada 5 s (cron activo) pero **no procesa nada**: sus logs sólo muestran `booted`/`shutdown`, ni un solo `sent` ni `error`.
- El último envío exitoso a tu correo fue hace 2 días (18-jun).

**Analogía:** es como si el cartero llegara puntual cada 5 minutos a la oficina de correos, pero la puerta del almacén estuviera cerrada con llave — recoge cero cartas y se va. Las cartas siguen ahí, sólo no las puede tocar.

La causa típica documentada es que la *service-role key* de Cloud rotó y el worker ya no tiene permiso para leer la cola (devuelve 401/403 silencioso). La solución es refrescar el secreto interno que usa el worker.

Esto **no afecta sólo al CC** — afecta a cualquier correo transaccional (cotizaciones, notificaciones) desde hace ~14 min. Hay que arreglarlo ya.

## Plan

1. **Refrescar credenciales de la cola de correo** — ejecutar `email_domain--setup_email_infra` (es idempotente, no recrea tablas; sólo regenera el secreto `email_queue_service_role_key` en Vault que usa el worker).
2. **Verificar** que la cola se vacíe: revisar `pgmq.metrics_all()` para `transactional_emails` (debe bajar a 0) y `email_send_log` para los 4 envíos (deben pasar a `sent`).
3. **Si después de 1 min siguen pendientes**, revisar logs de `process-email-queue` por errores específicos (suppressed, dominio, etc.) y ajustar.
4. **Confirmar contigo** que el correo (TO + CC a hector@lopezbenavides.com) ya llegó a tu bandeja.
5. **Changelog**: registrar el incidente en `CHANGELOG.md` y subir `APP_VERSION` patch (13.73.3) con la nota "Fix: refresco de credenciales del worker de correos transaccionales atorado".

## Lo que NO voy a hacer

- No voy a tocar la lógica del CC en `enviar-cotizacion-email/handlers.ts` — ya revisé y está bien: arma `recipients` con `to` + `cc` y manda cada uno como envío individual con su propia `idempotencyKey`. El bug no está ahí.
- No voy a borrar mensajes de la cola — una vez refrescado el secreto, el worker los procesará solo (aún están dentro del TTL de 60 min).
- No voy a recrear tablas ni cron — `setup_email_infra` es seguro de re-ejecutar.

¿Procedo?