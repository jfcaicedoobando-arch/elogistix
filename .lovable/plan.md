## Qué encontré

El correo SÍ se generó y encoló, pero **está atorado en la cola porque el worker que envía no puede autenticarse**. Ninguno de los 6 destinatarios ha recibido nada.

### Evidencia

1. `send-transactional-email` encoló los 6 mensajes de F955 a las 23:23 UTC (log: "Transactional email enqueued" x6): `erika@indimextrading.com` (principal), y CC a `karol.hernandez`, `alan.hernandez`, `accounting`, `juanluis.martinez`, `marta.sarmiento` en `elogistixshipping.com`.
2. `factura_envios` guardó el registro con `estado='enviado'` y los links firmados — pero eso sólo significa "encolado", no "entregado".
3. `email_send_log` tiene los 6 mensajes con status **`pending`** desde hace ~6 min. Ninguno pasó a `sent`, `failed`, ni `dlq`.
4. `process-email-queue` está siendo despertado cada 5s por cron: bootea y hace shutdown inmediato **sin loguear ni un batch procesado, ni un error, ni un envío**. Cero salida útil.

### Causa

`process-email-queue` valida un JWT `service_role` en `verifyServiceRoleToken` (queueAuth.ts). Si falla, devuelve 403 y termina — el catch traga los errores. El síntoma "bootea/muere en silencio cada 5s con la cola llena" coincide **exactamente** con el escenario documentado en la guía de infraestructura de email: *"Si Supabase rota el service-role key y el procesamiento del queue empieza a regresar 401/403, llamar `email_domain--setup_email_infra` de nuevo. Es seguro/idempotente y refresca el secreto de Vault `email_queue_service_role_key`."*

Analogía: el mensajero llega puntual cada 5 segundos a recoger la valija de correos, pero el guardia no reconoce su credencial y lo regresa sin decir por qué. Los correos siguen en la valija sin salir.

## Cambio

1. **Ejecutar `email_domain--setup_email_infra`** para refrescar el secreto `email_queue_service_role_key` en Vault (no toca código, no borra la cola, no re-crea nada — sólo re-sincroniza credenciales).
2. Esperar el próximo tick (~5–10 s) y verificar que:
   - Los 6 registros en `email_send_log` pasen de `pending` → `sent`.
   - `process-email-queue` logs muestren un batch procesado.
3. Si algún destinatario está en `suppressed_emails` (bounce previo, etc.), quedará en `suppressed` — te lo reporto explícitamente.

La TTL de emails transaccionales es 60 min y llevan ~6 min; **hay margen amplio** para que se envíen sin caer al DLQ. No hay que re-enviar la factura desde la UI.

## Fuera de alcance

- No modifico código ni templates de email.
- No cambio la lógica de `factura_envios`.
- Si tras el refresh siguen sin salir, escalo con evidencia (logs específicos) antes de tocar la cola manualmente.
