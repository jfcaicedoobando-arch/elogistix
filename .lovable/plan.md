## Contexto

FacturAPI **sí reporta `cancellation_status = pending`** para F971/F973/F974 (aunque `status = valid`). Es la fuente de verdad: hay una solicitud de cancelación abierta en su lado que el SAT aún no resuelve. La UI debe mostrar "En cancelación".

Mi fix anterior fue incorrecto: asumí que FacturAPI devolvía cadena vacía y agregué una rama `cleared` que borró el flag. Estado actual en BD:

- F971 → `pending` (sigue correcto, no se alcanzó a limpiar)
- F973 → `null` (limpiado por error)
- F974 → `null` (limpiado por error)

## Plan

### 1. Revertir F973 y F974

Migración de datos vía `supabase--insert` (UPDATE fila existente):

```sql
UPDATE public.facturas
SET cancellation_status = 'pending'
WHERE numero IN ('F973','F974')
  AND cancellation_status IS NULL
  AND cancelado_en IS NULL
  AND acuse_cancelacion_status IS NULL;
```

Más una entrada en `bitacora_actividad` (módulo `facturacion`, acción `reconciliacion_revertir_pending`) documentando que la fuente de verdad (FacturAPI) reporta `cancellation_status=pending`.

### 2. Quitar la rama `cleared` del reconciliador

`supabase/functions/facturapi-reconciliar-cancelaciones/reconcile.ts`:
- Eliminar la rama `cleared` (cuando `cs` está vacío y local `pending`).
- Quitar `"cleared"` del union `outcome` y `limpiadas` del tipo `Resumen`.

`index.ts` de la misma función:
- Quitar el manejo del outcome `cleared` y la entrada de bitácora `facturapi_pending_limpiada_async`.

`reconcile.test.ts`:
- Reemplazar los tests de `cleared` por casos que aseguren `pending` local + remoto vacío → `no_change` (así el proceso queda esperando resolución real del SAT).

Desplegar la función.

### 3. Nueva acción manual "Limpiar estado local (verificado)"

En el detalle de factura, dentro del diálogo existente `DialogConsultarFacturapi` (que ya llama al edge `facturapi-consultar` para hacer GET en vivo):

- Cuando la consulta en vivo devuelva `cancellation_status` **realmente vacío** (no `pending`, no `accepted`, no `rejected`), mostrar un botón **"Limpiar estado local"**.
- El botón invoca un nuevo RPC `limpiar_cancellation_status_verificado(factura_id, cancellation_status_remoto)` que:
  - Valida rol `facturacion.admin` (o `admin`) vía `has_role`.
  - Sólo permite limpiar si el parámetro remoto es cadena vacía y la fila local está en `pending`/`verifying` sin `cancelado_en`.
  - Escribe en `bitacora_actividad` con acción `facturapi_pending_limpiada_manual`.
- Si la consulta devuelve `pending` (como hoy), mostrar mensaje "Aún en trámite ante el SAT — no se puede limpiar" y no habilitar el botón.

Esto respeta la respuesta "Verificar antes de limpiar": FacturAPI decide, humano confirma.

### 4. UI de badge

Sin cambios de código — `deriveFacturaBadgeEstado` ya interpreta `estado='Emitida' + cancellation_status='pending'` como "En cancelación" (ámbar). Con el paso 1, las tres facturas vuelven a mostrar ese badge.

Verificación visual con Playwright FullHD en `/facturacion` (badge amarillo) y en el detalle de F971/F973/F974.

### 5. Versionado y bitácora

- Bump `APP_VERSION` a `13.301.20`.
- Entrada en `CHANGELOG.md` bajo `## [13.301.20]`:
  - Revertidas F973/F974 a `pending` (F971 ya estaba bien).
  - Quitada la rama automática `cleared` del reconciliador.
  - Nueva acción manual verificada para limpieza de `pending` colgado.

## Detalles técnicos

- No hay cambios de schema para el paso 1 — sólo UPDATE de filas existentes.
- El RPC `limpiar_cancellation_status_verificado` es `SECURITY DEFINER`, valida rol y estado. No acepta SQL crudo.
- Idempotencia del cron: `pending` local + `pending` remoto → `no_change` (comportamiento pre-fix roto).
- No se tocan RLS/grants/tipos generados.

## Archivos afectados

```text
supabase/functions/facturapi-reconciliar-cancelaciones/reconcile.ts       (quitar rama cleared)
supabase/functions/facturapi-reconciliar-cancelaciones/index.ts           (quitar outcome cleared)
supabase/functions/facturapi-reconciliar-cancelaciones/reconcile.test.ts  (ajustar tests)
supabase/migrations                                                        (RPC limpiar_cancellation_status_verificado)
src/features/facturacion/components/DialogConsultarFacturapiResult.tsx    (botón condicional)
src/features/facturacion/hooks/useLimpiarPendingVerificado.ts             (nuevo)
supabase--insert                                                           (UPDATE F973/F974 + bitácora)
src/constants/appVersion.ts                                                (13.301.20)
CHANGELOG.md                                                               (nueva entrada)
```
