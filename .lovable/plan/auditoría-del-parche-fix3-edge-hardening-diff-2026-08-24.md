# Auditoría del parche `fix3-edge-hardening.diff`

Revisé cada hallazgo contra el código actual y contra la base de datos. Resumen: **8 de 9 son bugs reales**, uno está sobrestimado (no explotable) y el parche trae 2 problemas de empaquetado que hay que corregir antes de aplicarlo.

## Bugs reales confirmados

1. **`email_send_log` nunca sale de `pending` (el más grave).**
   Existe el índice único total `uq_email_send_log_message_id`, y el flujo inserta primero `pending` y luego intenta **otro INSERT** con el mismo `message_id` para `sent` / `failed` / `rate_limited` / `dlq`, sin revisar el error. Evidencia en datos: 147 filas `sent` (todas hasta el 12/ago) y **18 filas `pending` atoradas del 17 al 20/ago, cero `failed`**. Consecuencias: el dedupe `isAlreadySent` (busca `status='sent'`) no encuentra nada → riesgo de reenviar correo; y el contador de reintentos (`status='failed'`) queda siempre en cero → el backoff/DLQ nunca actúa.
   Analogía: firmas la entrada del paquete pero la libreta no acepta una segunda firma, así que todo queda "en camino" para siempre.

2. **El barrido SAT borra sellos buenos cuando el SAT se cae.**
   `satBarrido.ts` escribe `uuid_verificado: res.estatus === "Vigente"` para *todos* los estatus, incluidos los transitorios (`Error`, `No verificable`). Un timeout del SAT en la corrida semanal pone en `false` banderas legítimas en masa. El fix (sólo tocar la bandera con veredicto definitivo) es correcto.

3. **`rep-retry-nocturno` puede perder el lote completo de alertas.**
   Hace *check-then-insert* contra el índice único parcial `uq_alertas_sistema_dedupe_open` y luego un `insert(nuevas)` en batch: si otra corrida abre una alerta en medio, el 23505 tumba el batch entero y responde 500. Insertar fila a fila tolerando 23505 es lo correcto.

4. **Crons sin mutex anti-traslape.** Real como robustez (pg_cron puede solapar corridas y hoy nada lo impide). La tabla de leases con TTL es mejor idea que un advisory lock vía PostgREST.

5. **Comparación de `CRON_SECRET` no constante en tiempo.** `tc-dof-diario`, `auditoria-snapshot-daily`, `auditoria-weekly-digest` y `rep-retry-nocturno` usan `===`, mientras `verificar-sat-semanal` y `facturapi-reconciliar-cancelaciones` ya usan `timingSafeEqual`. Real, severidad baja, pero es inconsistencia del propio proyecto.

6. **`exchange-rates` es público y no tiene freno.** No está en `config.toml` (JWT no requerido) y sus logs muestran `user_id: null`. Iterando `?fecha=` se salta el caché, se drena la cuota del token Banxico y el `Map` de caché histórico crece sin tope en el isolate. Real.

7. **`notificar-respuesta-cotizacion` sin throttle.** No hay ningún freno hoy: un usuario del portal puede invocarla en bucle y cada llamada manda correo a todos los operadores de la org. Real.

8. **`sentry-tunnel` lee el body completo sin límite** en un endpoint público. Real (severidad media-baja: ya hay rate limit por IP en memoria). El tope de 1 MB con lectura acotada es razonable.

9. **PII en logs de las edges de correo.** Se registran correos completos. Real como política; `maskEmail` es la solución adecuada.

## Hallazgo sobrestimado: el "oráculo cross-tenant" en `facturapi-*`

El parche asume que los lookups corren con `service_role` y por eso filtran existencia/estado (`ya_timbrada` 409, `*_not_found` 404) antes de `authorizeOrgRole`. Verifiqué que **no es así**: en `facturapi-emitir`, `-emitir-rep`, `-cancelar`, `-cancelar-rep`, `-consultar`, `-descargar` y `-enviar-email` el cliente se crea con `Authorization: <JWT del usuario>`, así que PostgREST corre como `authenticated` y **RLS ya filtra por organización** (`facturas`, `pagos_factura`, `factura_notas_credito` tienen policy de tenant + la policy RESTRICTIVE de scope de super admin). Un documento de otra org ya responde el mismo 404.

Además el fix propuesto trae riesgo de regresión: `.in("organization_id", [])` con arreglo vacío en PostgREST, y el scope por membresía puede romper a los usuarios del portal (que se autorizan por `authorizePortalCliente`, no por `organization_members`), incluido `facturapi-enviar-email`.

Propuesta: **no aplicar** el bloque de `resolveOrgScope` / `scopePorOrganizacion` en esta ola. Si se quiere defensa en profundidad, se hace después como cambio aislado y con pruebas de portal.

## Problemas de empaquetado del parche (bloqueantes)

- **Colisión de timestamp**: `20260831000100_r3_email_send_log_touch_y_zombies.sql` choca con la migración ya existente `20260831000100_fix3_m6_espejo_adjuntar_xml_verificado.sql`. Hay que renumerar.
- **`deno.lock` nuevo en la raíz**: un lockfile de Deno incompatible es causa conocida de fallos 500 al desplegar edge functions. No se incluye.

## Qué implementaría (si apruebas)

Aplicar sólo lo verificado, en este orden:

1. Migración (timestamp nuevo, sin colisión): columna `intentos`, RPC `email_send_log_touch` (upsert por `message_id`, `SECURITY DEFINER`, sólo `service_role`), y limpieza de las `pending` > 24 h a `failed`.
2. Migración `cron_locks` + `cron_try_lock` / `cron_unlock` (lease con TTL, RLS habilitada, grants sólo a `service_role`).
3. Edge functions: `_shared/emailSendLog.ts`, `_shared/cronLock.ts`, `_shared/redact.ts`; migrar `send-transactional-email` y `process-email-queue/*` al upsert; `patchVerificacionSat` en `_shared/satBarrido.ts`; inserción fila a fila en `rep-retry-nocturno`; `timingSafeEqual` en los 4 crons; rate limit + tope de caché en `exchange-rates`; throttle en `notificar-respuesta-cotizacion` (reusa la RPC `check_ratelimit`, que ya existe); tope de envelope en `sentry-tunnel`; enmascarado de correos en logs.
4. Tests Deno del parche, **sin** `oraculoTenant_test.ts` (guarda del hallazgo descartado) y ajustando `cronSecret_test.ts` a los archivos reales.
5. `CHANGELOG.md` + `APP_VERSION`, y sincronización de `migration-manifest.json` y espejos de esquema.
