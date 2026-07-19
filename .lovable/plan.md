# Fase R.4 — Bug 24 · Pagar sin aprobación

## Contexto verificado

- `proveedor_facturas.estado_aprobacion` (enum `pendiente | aprobada | rechazada`) existe y se cambia sólo desde el RPC `aprobar_factura_proveedor` (con permisos).
- **No hay guarda BD** en `pagos_proveedor` ni en `_recalc_estado_proveedor_factura` que impida registrar pagos cuando la factura sigue `pendiente` o `rechazada` (grep confirmado en migraciones).
- En cliente, `registrarPagoProveedor` (`src/features/cxp/services/pagosProveedor.ts`) inserta sin leer `estado_aprobacion`; la UI (`DialogRegistrarPagoProveedor.tsx`) tampoco lo revisa.
- Riesgo (analogía): es como poder firmar un cheque antes de que el jefe autorice el gasto — la contabilidad ya se movió, pero nadie dio el visto bueno.

## Objetivo

Que la BD sea la fuente de verdad: no se puede insertar/reactivar un pago si la factura no está `aprobada`. La UI acompaña con feedback claro.

## Cambios

### 1. Migración BD (nueva)

Archivo: `supabase/migrations/<timestamp>_r4_pago_requiere_aprobacion.sql`

- Función `public.check_pago_proveedor_factura_aprobada()` `SECURITY DEFINER`:
  - En `INSERT` (o `UPDATE` que quite `deleted_at`, i.e. "revivir" un pago): leer `estado_aprobacion` de la factura.
  - Si `<> 'aprobada'`, `RAISE EXCEPTION 'LC_PAGO_SIN_APROBACION: la factura % está en estado %', v_folio, v_estado;`
- Trigger `trg_pago_requiere_aprobacion` `BEFORE INSERT OR UPDATE OF deleted_at ON public.pagos_proveedor`.
- `GRANT EXECUTE` no aplica (trigger). Mantener `search_path = public`.

### 2. Servicio cliente

`src/features/cxp/services/pagosProveedor.ts`

- Añadir clase `PagoRequiereAprobacionError extends Error` con `code = "LC_PAGO_SIN_APROBACION"`.
- En `registrarPagoProveedor` y `eliminarPagoProveedor` (para el caso de reactivación), envolver el `throw error` con detección del token `LC_PAGO_SIN_APROBACION` → lanzar el error tipado.
- Como defensa temprana (menos roundtrips), al inicio de `registrarPagoProveedor` extender la lectura de la factura para incluir `estado_aprobacion` y lanzar el error tipado antes del `INSERT` si es `<> 'aprobada'`.

### 3. UI

`src/features/cxp/components/DialogRegistrarPagoProveedor.tsx` (o el disparador equivalente en `PagoProveedorFormBody` / botón "Registrar pago" del detalle CxP):

- Recibir/leer `estado_aprobacion` de la factura.
- Si `!== "aprobada"`: deshabilitar el botón "Registrar pago" con `Tooltip` "Requiere aprobación de la factura".
- En el submit, si el error mapeado es `PagoRequiereAprobacionError`, mostrar toast rojo con el copy: "No se puede registrar el pago: la factura aún no está aprobada."

### 4. Tests

- `src/features/cxp/services/__tests__/pagosProveedor.test.ts`:
  - Caso: factura `pendiente` → `registrarPagoProveedor` lanza `PagoRequiereAprobacionError` sin hacer `insert`.
  - Caso: BD devuelve error con `LC_PAGO_SIN_APROBACION` → se mapea al error tipado.
  - Caso: factura `aprobada` → flujo actual funciona (regresión).
- Test opcional en componente para verificar botón deshabilitado cuando `estado_aprobacion !== 'aprobada'` (si el patrón del feature ya usa RTL para dialogs; si no, se omite y se cubre por unit del servicio).

### 5. Versionado & changelog

- Bump `APP_VERSION` → `13.301.95`.
- Añadir bullet en `CHANGELOG.md`:
  `[13.301.95] - 2026-07-19 · Fase R.4 (Bug 24): guarda BD LC_PAGO_SIN_APROBACION en pagos_proveedor + UI deshabilita "Registrar pago" en facturas no aprobadas.`

## Criterios de aceptación

1. Intentar `INSERT` directo con SQL en `pagos_proveedor` para una factura `pendiente` falla con `LC_PAGO_SIN_APROBACION`.
2. Aprobar la factura y luego registrar pago funciona.
3. Al rechazar/desaprobar una factura vía trigger (si aplica en flujos futuros), no se pueden crear pagos nuevos.
4. `bun run ci:fast` verde (lint + typecheck + tests unitarios).
