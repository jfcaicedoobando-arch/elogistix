-- Ola 4 · N15: los índices únicos pago↔movimiento deben ignorar la papelera.
-- 20260721211537 creó uq_bbva_movimientos_pago_{factura,proveedor} SIN filtro
-- de deleted_at porque bbva_movimientos aún no tenía esa columna; el FIX M6
-- (20260729064650) la agregó. Sin el predicado, un movimiento soft-eliminado
-- sigue bloqueando la re-conciliación del pago y el índice no refleja la
-- regla de negocio: UN pago ↔ UN movimiento VIVO.
--
-- Pre-verificación (ejecutada antes de este PR): 0 filas duplicadas vivas.

DROP INDEX IF EXISTS public.uq_bbva_movimientos_pago_factura;
DROP INDEX IF EXISTS public.uq_bbva_movimientos_pago_proveedor;

CREATE UNIQUE INDEX uq_bbva_movimientos_pago_factura
  ON public.bbva_movimientos (pago_factura_id)
  WHERE pago_factura_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX uq_bbva_movimientos_pago_proveedor
  ON public.bbva_movimientos (pago_proveedor_id)
  WHERE pago_proveedor_id IS NOT NULL AND deleted_at IS NULL;
