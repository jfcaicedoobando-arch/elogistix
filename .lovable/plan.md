## Contexto

En el embarque `3296c226…` (estado **Cerrado**), Héctor intentó eliminar una proforma y el backend respondió con `Embarque cerrado: edición bloqueada (tabla conceptos_venta)` (código Postgres `23514`).

El servicio `eliminarProforma` (`src/features/proformas/services/crud.ts`) hace dos pasos:

1. `UPDATE conceptos_venta SET estado_facturacion='pendiente', proforma_id=NULL WHERE proforma_id = …`
2. `rpc('soft_delete_record', { _table: 'proformas', … })`

El paso 1 dispara `tg_bloquear_si_embarque_cerrado`, que en el CHANGELOG (v13.303.99…) se dejó **intencionalmente** enganchado a `conceptos_venta` para proteger la operación. Pero **eliminar una proforma no es una edición operativa** — es limpieza fiscal previa a la factura (análoga a lo que ya se hizo con `facturas`/`pagos_factura`). Hoy no hay forma de que un usuario elimine una proforma huérfana de un embarque ya cerrado.

Analogía: el candado de la puerta operativa no debería trabar también la papelera de borradores fiscales.

## Diagnóstico (verificado)

- Trigger `tg_bloquear_si_embarque_cerrado` bloquea cualquier `UPDATE/INSERT/DELETE` sobre `conceptos_venta` cuando `embarques.estado = 'Cerrado'`.
- El trigger respeta la GUC `app.bypass_cierre = 'on'` (patrón ya usado por `avanzar_estado_embarque`, `cerrar_embarque`, etc.).
- La proforma en cuestión es un borrador (no está `facturada`) — eliminarla es seguro.

## Plan

### 1. Nueva RPC `eliminar_proforma_atomica(p_proforma_id uuid)`

En una nueva migración:

- `SECURITY DEFINER`, `SET search_path = public`, `REVOKE ALL … FROM PUBLIC` + `GRANT EXECUTE … TO authenticated, service_role, postgres` (cumple H6).
- Verifica que la proforma exista y **no** esté en estado `facturada` (para no romper trazabilidad ya vinculada a un CFDI). Si lo está, `RAISE EXCEPTION 'LC_PROFORMA_FACTURADA'`.
- Verifica que el `auth.uid()` pertenezca a la misma `organization_id` de la proforma (defensa en profundidad además de RLS).
- Dentro de la función activa `PERFORM set_config('app.bypass_cierre','on', true)` (scope local a la transacción) para que el trigger permita:
  - `UPDATE conceptos_venta SET estado_facturacion='pendiente', proforma_id=NULL WHERE proforma_id = p_proforma_id`.
  - Llamar a `soft_delete_record('proformas', p_proforma_id)` (que hace `UPDATE proformas SET deleted_at = now()`, sin tocar `conceptos_venta` ni el embarque, por lo que no re-dispara el bloqueo).
- Registra en `bitacora_actividad` la acción `PROFORMA_ELIMINADA` con `metadata = { embarque_id, motivo: 'cierre' }`.

### 2. Reemplazar el flujo del cliente

En `src/features/proformas/services/crud.ts`:

- `eliminarProforma` deja de hacer los dos pasos manuales y llama únicamente a `supabase.rpc('eliminar_proforma_atomica', { p_proforma_id })`.
- El `Sentry.startSpan` se conserva (`op: db.rpc`, name `rpc.eliminar_proforma_atomica`).
- El mensaje de error `LC_PROFORMA_FACTURADA` se mapea en `src/lib/errors/lcCodeMessages.ts` con copy amigable: “No se puede eliminar: la proforma ya está facturada. Cancela primero la factura vinculada.”

### 3. Tests

- Ampliar `src/features/proformas/services/__tests__/crud.test.ts` con dos casos:
  - Éxito: mock de `supabase.rpc('eliminar_proforma_atomica')` → `error: null`, verifica que se llame con el `p_proforma_id` correcto.
  - Error `LC_PROFORMA_FACTURADA` → burbujea al caller.
- Sumar entrada al test `lcCodeMessages` para asegurar el copy del nuevo código.

### 4. Documentación

- `CHANGELOG.md`: nueva entrada `## [13.312.7]` describiendo el fix (usuario reporta bloqueo al eliminar proforma en embarque cerrado; ahora la RPC bypassa el candado sólo para borradores).
- Bump `APP_VERSION` a `13.312.7` en `src/constants/appVersion.ts`.

## Consideraciones técnicas

- El trigger sigue igual (no relajamos la protección general de `conceptos_venta`) — el bypass es puntual y auditado por la RPC.
- `soft_delete_record` no toca `conceptos_venta`, así que el bypass sólo cubre el `UPDATE` inicial.
- El chequeo de estado `facturada` evita que un admin borre por accidente una proforma ya convertida en CFDI vigente.
- No se modifica UI del diálogo (el mensaje sigue igual); en el próximo turno podríamos ocultar el botón para roles sin permiso, pero fuera de scope aquí.

## Archivos a tocar

- `supabase/migrations/<timestamp>_eliminar_proforma_atomica.sql` (nueva)
- `src/features/proformas/services/crud.ts`
- `src/features/proformas/services/__tests__/crud.test.ts`
- `src/lib/errors/lcCodeMessages.ts` (+ test asociado si aplica)
- `src/constants/appVersion.ts`
- `CHANGELOG.md`

Esta proforma es legacy de versiones anterirores del software. Borra la de manera directa. Es lo mas sencillo. PRO-2026-0330