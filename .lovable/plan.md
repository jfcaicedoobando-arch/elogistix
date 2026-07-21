# Fase 3 auditoría — Sprint 1 (v13.303.45)

Continúa la remediación del documento subido. Fases previas ya cerradas en repo:
FIX-01…07 (Sprint 0), FIX-08+23 (sobrepago con NCs + locks), FIX-10 (fallback TC marcado + rechazado), FIX-11 (helper `tcValido` + guard NC). Falta migrar los `|| 1` restantes y avanzar con los ítems que la nota final del doc marca como críticos ("FIX-10 antes que FIX-11", "FIX-08 define estados canónicos que usan FIX-09").

## Alcance de esta fase (3 fixes)

### 1. FIX-13 · Comisiones multi-moneda
- **Bug:** `calcular_comision_pago` (migración `20260616231916`) usa `CASE WHEN moneda='USD' THEN tc ELSE 1 END`. Ventas y costos en EUR se suman como MXN → comisión inflada.
- **Fix:** migración que redefine `calcular_comision_pago` reemplazando el CASE por `public.convertir_a_mxn(monto, moneda, v_tc_usd, v_tc_eur)` (helper ya existente) tanto en ingresos como en costos.
- **Guard:** si `pagos_factura.tipo_cambio IS NULL` en pago no-MXN, tomar el TC del embarque; si sigue nulo, `RAISE 'LC_COMISION_TC_FALTANTE'`.
- **Test:** SQL fixture con venta EUR y costo USD → comisión = `%` × (ventaEUR·tcEUR − costoUSD·tcUSD).

### 2. FIX-15 · Optimistic locking en editar embarque
- **Bug:** `actualizar_embarque_completo` no valida versión. Dos operadores editando pisan cambios; el DELETE+INSERT de conceptos hace la pérdida silenciosa.
- **Fix DB:** migración que añade parámetro `p_expected_updated_at timestamptz DEFAULT NULL` (compatible hacia atrás). Si viene y `embarques.updated_at <> p_expected_updated_at` → `RAISE 'LC_CONFLICTO_CONCURRENCIA'` con `ERRCODE = 'serialization_failure'`.
- **Fix UI:** en `useEditarEmbarqueWizard.ts` leer `updated_at` al abrir el wizard, pasarlo a la mutation, y al recibir `LC_CONFLICTO_CONCURRENCIA` mostrar `AlertDialog` "Otro usuario modificó este embarque · Recargar".
- **Tests:** unit del handler de error + integration del RPC (dos updates seguidos, el 2º debe fallar).

### 3. FIX-11 (continuación) · Migrar `|| 1` restantes a `tcValido`
Aplicar el helper creado en la fase pasada a los sitios listados en el doc (línea 188):
- `src/features/embarques/domain/embarqueKpis.ts:24-47`
- `src/features/facturacion/services/proyeccionFacturacion/conversion.ts:22`
- `src/features/dashboard/direccion/services/mxn.ts:9`
- `src/features/embarques/services/costosUSD.ts:113-116`
- `src/features/facturacion/components/DialogRegistrarPago.tsx:41`
- `supabase/functions/parse-cfdi-xml/parser.ts:186`

Patrón: cuando `tcValido(v)` devuelve `null` → no convertir; propagar bandera `tcMissing` al KPI/UI para mostrar "TC faltante" (patrón ya usado en `useCostosPreciosCalc`).

## Fuera de alcance (siguientes fases)
- FIX-09 (PNL sustituidas + pendientes reales) — necesita definir "estados canónicos de NC" que aún no hemos consolidado.
- FIX-12 (timezone MX en dashboard/exchange-rates/TabTracking).
- FIX-14 (pago CxP MXN de factura USD).
- FIX-17…32 restantes de Sprint 1.
- Sprint 2 (UX) y Sprint 3 (gobierno).

## Detalles técnicos

**Migración única** con:
1. `CREATE OR REPLACE FUNCTION public.calcular_comision_pago` (FIX-13).
2. `CREATE OR REPLACE FUNCTION public.actualizar_embarque_completo` con nueva firma que agrega `p_expected_updated_at timestamptz DEFAULT NULL` al final (para no romper llamadas existentes).

**Frontend:**
- `useEditarEmbarqueWizard.ts`: leer `updated_at` del fetch inicial, guardarlo en ref, enviarlo en el `mutateAsync`.
- Nuevo `DialogConflictoConcurrencia.tsx` (reutilizando `AlertDialog` shadcn) para mostrar el aviso.
- Actualizar `useUpdateEmbarque.ts` para detectar `LC_CONFLICTO_CONCURRENCIA` y abrir el diálogo.

**Cierre:**
- Bump `APP_VERSION` a `13.303.45`.
- Entradas en `CHANGELOG.md` (FIX-13, FIX-15, FIX-11 continuación).
- Ejecutar suite afectada: comisiones, embarques wizard, KPIs.

## Fixes ya cerrados (confirmar en review, no re-hacer)
```text
Sprint 0:  01 · 02 · 03 · 04 · 05 · 06 · 07
Sprint 1:  08 · 10 · 11(parcial) · 23
```
