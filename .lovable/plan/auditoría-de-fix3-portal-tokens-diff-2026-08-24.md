# Auditoría de `fix3-portal-tokens.diff`

Sí: los hallazgos principales son bugs reales. Los verifiqué contra la base y el código actuales.

## Confirmado en la base de datos

1. **Fuga de datos internos al portal (crítico).** Las políticas actuales son más laxas de lo que la UI aparenta:
   - `Cliente read own eventos`: no filtra tipo de evento ni marcas internas; cualquier cliente con su sesión puede pedir por API todos los eventos de sus embarques, incluidos internos/semilla/E2E.
   - `Cliente read own notas` y `Agente read own notas`: permiten `tipo IN ('nota','cambio_estado')`, es decir, las notas de texto libre del staff.
   - El portal nunca consulta `notas_embarque` (sólo `eventos_embarque`), así que restringirlas no rompe pantallas.

2. **`portal_responder_por_token` está roto hoy (crítico).** La función inserta en `bitacora_actividad` con `usuario_id = NULL`, y esa columna es `NOT NULL`. Cualquier aceptación/rechazo desde el portal falla al final, después de haber actualizado la proforma.

3. **TOCTOU real.** La función lee la proforma sin `FOR UPDATE` y actualiza sin condición de estado en el `WHERE`: dos respuestas simultáneas con el mismo token pueden pasar ambas y liberar conceptos/notificar dos veces.

4. **`portal_solicitar_cotizacion` sin rate limit ni topes de longitud.** Confirmado: no invoca `check_ratelimit` y los textos son `text` libre. Permite inflar folios y ruido en la bandeja de pricing.

5. **Ligas de tracking eternas.** Las 12 ligas existentes tienen `expires_at = NULL`, y `handleCompartirTracking` crea una liga nueva en cada clic sin vigencia ni forma de revocarla.

6. **Tokens en logs.** `logClientError` guarda `window.location.pathname` tal cual, así que `/tracking/<token>` y `/portal/proformas/<uuid>` quedan en `app_logs`; son credenciales de acceso (la proforma incluso permite aceptar/rechazar).

## Ajuste al parche

Una afirmación del parche está desactualizada: dice que `portal_obtener_proforma_por_token` perdió su `check_ratelimit` por drift. En la base actual **sí** lo tiene y ya es `VOLATILE`. Reaplicar la migración es inofensivo, pero corregiré el comentario para no dejar documentación falsa. `portal_solicitar_cotizacion` tampoco tiene `anon` hoy (el parche lo dice bien).

## Qué implementar

- Migración RLS: replicar en las políticas de cliente/agente el mismo predicado que `get_tracking_public` (lista de hitos de negocio, `deleted_at IS NULL`, sin marcas `[interno]/harness/e2e/seed/qa-`) y dejar `notas_embarque` sólo en `cambio_estado`.
- Migración `portal_responder_por_token`: `SELECT ... FOR UPDATE`, `UPDATE` con compare-and-set sobre `estado_cliente = 'pendiente'`, motivo acotado a 1000 caracteres y bitácora con el usuario sentinel del sistema.
- Migración `portal_solicitar_cotizacion`: rate limit 10/hora por (cliente, usuario) y topes de longitud; grants sin cambios (nunca fue `anon`).
- Migración de grants: revocar `handle_new_user_signup` de `anon` (es función de trigger, corre como owner) y dejar documentado el estado de rate limits de cada RPC pública.
- Frontend tracking: vigencia de 30 días por defecto, reuso de la liga vigente en "Compartir", y acción "Revocar liga de tracking" en el menú del embarque (con registro en bitácora).
- Observabilidad: `scrubPathTokens` en `piiScrub` y aplicarlo en `scrubUrl` + `logClientError` para no persistir tokens.
- Tests: los dos scripts SQL nuevos cableados en el workflow de RLS, más los tests de vitest del parche (tracking links y piiScrub).
- Registrar en `CHANGELOG.md` y subir `APP_VERSION`.
