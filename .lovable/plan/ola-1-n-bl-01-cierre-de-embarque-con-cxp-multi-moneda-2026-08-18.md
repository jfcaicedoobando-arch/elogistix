# OLA 1 — N-BL-01: cierre de embarque con CxP multi-moneda

## Problema (confirmado en el código)
`public.validar_cierre_embarque` suma `pagos_proveedor.monto` **en crudo** (líneas 128 y 131 del espejo canónico `supabase/schema/embarques/validar_cierre_embarque.sql`), sin convertir a la moneda de la factura.

Consecuencia: una factura de proveedor de 500 USD "pagada" con 500 MXN se ve como saldo 0 y el embarque se puede cerrar con ~473 USD realmente pendientes. Es como sumar 500 pesos y 500 dólares como si fueran lo mismo.

## Solución
Convertir el pagado a la moneda de la factura con el helper ya existente `public.monto_pago_en_moneda_factura` (mismo patrón que `saldo_factura_proveedor`), con criterio **fail-closed**: si el pago está en otra moneda y no trae tipo de cambio, se excluye del pagado y el cierre se bloquea (nunca conversión 1:1 silenciosa).

## Cambios

1. **Migración nueva** `supabase/migrations/20260827000100_n_bl01_validar_cierre_cxp_conversion_moneda.sql`
   - Re-emite el cuerpo completo vigente de `validar_cierre_embarque` (conserva umbral por moneda de BUG-13, org guard, locks y todos los checks: contenedores, docs, buzón, evidencia, CxC, REP, comisiones, margen).
   - Único cambio funcional: el pagado CxP usa `monto_pago_en_moneda_factura(pp.monto, pp.moneda, pp.tipo_cambio_usd, pf.moneda)` en ambas subconsultas (`pagado` y `facturas_pendientes`).
   - Nuevo contador `pagos_sin_tipo_cambio` por moneda dentro de `detalle.por_moneda[]` para diagnóstico.
   - Bloque H6/FIX-45: `REVOKE ALL ... FROM PUBLIC, anon;` + `GRANT EXECUTE ... TO authenticated, service_role;`

2. **Espejo canónico** `supabase/schema/embarques/validar_cierre_embarque.sql` actualizado 1:1 con la migración (mismo cuerpo, verificado con diff).

3. **Test SQL** `supabase/tests/validar_cierre_cxp_conversion_moneda.sql` (estilo DO-block con asserts + cleanup, igual que `validar_cierre_umbral_por_moneda.sql`):
   - Regresión: factura 500 USD + pago 500 MXN @19 → `cxp_pagada.ok=false`, saldo ≈ 473.68 USD, `puede_cerrar=false`.
   - Fail-closed: pago 9,500 MXN sin TC → excluido, `pagos_sin_tipo_cambio=1`, cierre bloqueado.
   - Control positivo: pago 9,500 MXN @19 → `cxp_pagada.ok=true` (los pagos válidos no se castigan).

4. **Versión y changelog**: bump de `APP_VERSION` + entrada en `CHANGELOG.md` (raíz).

## Impacto esperado
- Embarques con CxP multi-moneda real pueden pasar de "se puede cerrar" a "bloqueado": ese es exactamente el bug corregido.
- Pagos históricos en moneda distinta sin tipo de cambio bloquearán el cierre hasta capturar el TC; aparecen listados en `detalle.por_moneda[].pagos_sin_tipo_cambio`.
- Rollback: re-aplicar el cuerpo de la migración `20260826000200`.
