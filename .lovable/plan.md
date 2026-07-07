## Problema

Al editar los **días de crédito** de una factura (antes de timbrar) el campo se guarda correctamente en `facturas.dias_credito`, pero `facturas.fecha_vencimiento` NO se recalcula. Queda con el valor original (normalmente `fecha_emision + 0` días) y la factura aparece con vencimiento incorrecto en cobranza.

Analogía: es como cambiar el plazo del pagaré pero olvidar mover la fecha límite escrita hasta abajo — el sistema sigue mirando la fecha vieja.

## Causa

`actualizarDatosTimbradoFactura` (en `src/features/facturacion/services/datosFiscalesCliente.ts`) hace `update({ dias_credito, ... })` sin tocar `fecha_vencimiento`, y no existe ningún trigger en Postgres que lo recalcule. Afecta a los dos caminos que editan crédito:

- Autoguardado de la card "Configuración de timbrado" (`useAutoSaveDatosFiscales`).
- Cualquier update futuro que cambie `fecha_emision` o `dias_credito`.

## Solución

**Trigger en base de datos** (una sola fuente de verdad, cubre ambos caminos y edge cases futuros).

1. **Migración** `recompute_fecha_vencimiento_facturas`:
   - Crear `public.facturas_set_fecha_vencimiento()` — función `BEFORE INSERT OR UPDATE` en `public.facturas` que, si cambia `fecha_emision` o `dias_credito` (o en INSERT), setea:
     ```
     NEW.fecha_vencimiento := NEW.fecha_emision + COALESCE(NEW.dias_credito, 0)
     ```
   - Crear el trigger `trg_facturas_set_fecha_vencimiento`.
   - **Backfill** único: `UPDATE public.facturas SET fecha_vencimiento = fecha_emision + COALESCE(dias_credito, 0) WHERE fecha_vencimiento IS DISTINCT FROM (fecha_emision + COALESCE(dias_credito, 0)) AND estado IN ('borrador','timbrada','parcial','vencida');` — corrige facturas ya afectadas.
   - Respeta el CHECK `facturas_venc_despues_emision` (siempre `>= fecha_emision`).

2. **CHANGELOG + APP_VERSION** bump patch (`13.213.42`) con nota corta en español.

## No cambia

- No se toca la UI ni los servicios en TypeScript: el cliente sigue enviando solo `dias_credito` y el trigger se encarga del resto.
- No afecta a `proveedor_facturas` (misma columna pero flujo distinto).

## Archivos

- **nuevo** `supabase/migrations/<timestamp>_facturas_recompute_fecha_vencimiento.sql`
- editado `CHANGELOG.md`
- editado `src/constants/appVersion.ts`