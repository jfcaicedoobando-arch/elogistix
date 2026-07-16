## Diagnóstico

Las tres facturas están así en la BD (todas con acuse vacío, sin `cancelado_en`, sin sustituida_por):

| Numero | Estado | `cancellation_status` | `acuse_cancelacion_status` | `cancelado_en` |
|--------|--------|----------------------|----------------------------|----------------|
| F971 | Emitida | **pending** | null | null |
| F973 | Emitida | **pending** | null | null |
| F974 | Emitida | **pending** | null | null |

Las tres muestran el badge amarillo **"En cancelación"** en el detalle y en las tablas, pero en el portal de FacturAPI aparecen como *válidas* (sin proceso de cancelación abierto). Es la misma divergencia que ya nos había pasado con F971 en la sesión anterior.

### Causa raíz

El cron `facturapi-reconciliar-cancelaciones` **no maneja la transición "pending local → sin cancelación remota"**. En `reconcile.ts → resolveNextAction`:

```text
remote.cancellation_status = "" (o ausente)
local.cancellation_status  = "pending"
```

Recorre las ramas `accepted / rejected / expired` — ninguna aplica — y llega a `if (cs && cs !== local.cancellation_status)`. Como `cs` está vacío (falsy), devuelve `no_change`. Resultado: el `pending` se queda colgado para siempre aunque FacturAPI ya diga que no hay cancelación en curso.

## Plan

### 1. Reconciliar las 3 facturas ahora mismo
- Llamar `facturapi-consultar` (ya existe) para F971, F973 y F974 desde una migración de datos (`supabase--insert`) que:
  1. Traiga el estado remoto en tiempo real vía `net.http_post` o simplemente consulte lo que ya sabemos del portal.
  2. Alternativa más simple y segura: si el remoto no reporta cancelación abierta, hacer un `UPDATE facturas SET cancellation_status = NULL, cancelacion_solicitada_en = NULL, cancelacion_vence_en = NULL WHERE numero IN ('F971','F973','F974') AND cancellation_status = 'pending' AND cancelado_en IS NULL AND acuse_cancelacion_status IS NULL`.
- Registrar la corrección en `bitacora_actividad` (módulo `facturacion`, acción `reconciliacion_manual_pending_stale`).

### 2. Corregir el reconciliador para que no se repita
En `supabase/functions/facturapi-reconciliar-cancelaciones/reconcile.ts`:
- Agregar rama en `resolveNextAction`: cuando `local.cancellation_status ∈ {pending, verifying}` **y** `cs` está vacío **y** `remote.status !== "canceled"` → devolver un nuevo outcome `cleared` con patch:
  ```ts
  { cancellation_status: null, cancelacion_solicitada_en: null, cancelacion_vence_en: null }
  ```
- Actualizar el tipo `ResolvedPatch["outcome"]` y `Resumen` para incluir `limpiadas: number`.
- En `index.ts`, tratar el outcome `cleared` como un update simple sin acuse ni reversión de proformas y con entrada en bitácora `facturapi_pending_limpiada_async`.

### 3. Tests
- Añadir casos en `reconcile.test.ts` (o crearlo si no existe) para:
  - remote vacío + local `pending` → outcome `cleared` con patch correcto.
  - remote vacío + local `pending` + remote.status `canceled` → sigue siendo `accepted` (no se limpia por error).
  - remote `none`/`""` + local `null` → `no_change`.

### 4. UI (verificación)
- Confirmar con Playwright FullHD que tras el fix el detalle de F971 muestra badge **"Emitida"** (no "En cancelación") y la lista de facturación también.

### 5. Versionado y bitácora
- Bump `APP_VERSION` a `13.301.19`.
- Entrada en `CHANGELOG.md` bajo `## [13.301.19]` describiendo:
  - Fix de estado colgado en F971/F973/F974.
  - Nueva rama `cleared` en el reconciliador con test.

## Detalles técnicos

- La migración de datos usa `supabase--insert` (solo UPDATE de filas existentes, sin cambio de schema).
- Se preserva la salvaguarda: solo se limpia si `cancelado_en IS NULL AND acuse_cancelacion_status IS NULL` — así jamás pisamos una cancelación real ya confirmada.
- El cron sigue idempotente: ejecutar la rama `cleared` sobre una factura ya limpia devuelve `no_change` en la siguiente corrida.
- No se tocan RLS, grants ni tipos generados.

## Archivos afectados

```text
supabase/functions/facturapi-reconciliar-cancelaciones/reconcile.ts   (nueva rama)
supabase/functions/facturapi-reconciliar-cancelaciones/index.ts       (manejo outcome cleared)
supabase/functions/facturapi-reconciliar-cancelaciones/reconcile.test.ts (tests)
supabase--insert                                                        (UPDATE F971/F973/F974 + bitácora)
src/config/version.ts                                                   (13.301.19)
CHANGELOG.md                                                            (entrada nueva)
```
