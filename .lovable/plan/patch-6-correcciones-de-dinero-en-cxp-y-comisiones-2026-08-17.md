# Patch 6 — Correcciones de dinero en CxP y Comisiones

El parche aplica limpio sobre el estado actual del repo (verificado en seco: 17 archivos, ninguna migración existente modificada). Toca 6 hallazgos de dinero (BL-01 a BL-05 y BL-08). No hay duplicados históricos en `liquidaciones_comision` (consultado), así que el índice único nuevo no romperá al aplicarse.

## Qué se corrige

1. **Comisiones mal valuadas (BL-01).** El cálculo de "monto cobrado en pesos" mezclaba la moneda del pago con la de la factura y podía inflar la cifra ~19x en 3 de 4 combinaciones de moneda. Se recalcula siempre valuando el importe aplicado con el tipo de cambio del documento. Los pagos históricos no se recalculan.
2. **Pago en lote a proveedores sin llave de idempotencia (BL-02).** Doble clic podía crear dos lotes y duplicar cargos en banco. Se agrega llave por apertura del diálogo, igual que ya existe en cobros a cliente.
3. **Pagos/anticipos sobre facturas canceladas o en papelera (BL-03).** Se agregan candados en las 4 funciones involucradas y se limpia el estado de aprobación "zombie" al cancelar una factura.
4. **Pago programado con saldo mal calculado (BL-04).** El saldo sumaba movimientos borrados y anteriores al saldo inicial (doble conteo). Se introduce una función compartida de saldo bancario y se agrega idempotencia. Esto puede bloquear pagos que antes pasaban con saldo inflado (comportamiento deseado).
5. **Liquidación de comisiones duplicable (BL-05).** Índice único por organización + vendedora + periodo, más idempotencia en la generación.
6. **Aplicación de anticipo duplicable (BL-08).** Llave de idempotencia por intento de envío, que se reutiliza en reintentos.

## Cambios técnicos

- Aplicar el parche con `patch -p1` (6 migraciones nuevas `2026082500xxxx_*`, 3 espejos en `supabase/schema/cxp/`, 2 tests SQL nuevos, 2 pasos nuevos en `rls-tests.yml`, 4 archivos de frontend/servicios y `types.ts`).
- Ejecutar las 6 migraciones en la base con la herramienta de migración (los archivos por sí solos no corren).
- Verificación: typecheck, build y los tests SQL nuevos (`comision_cobrado_mxn.sql`, `cxp_guard_factura_cancelada.sql`).
- Mapear en la UI de Comisiones el error de duplicado (23505) a un mensaje claro en español, ya que el nuevo índice único puede rechazar una segunda liquidación del mismo periodo.
- Registrar en `CHANGELOG.md` y subir `APP_VERSION` a 13.636.0.

## Riesgos

- Las cifras de comisión visibles cambiarán en los cruces de moneda afectados (hacia el valor correcto).
- El candado de saldo bancario es más estricto: algún pago programado podría quedar bloqueado hasta corregir el saldo real.
