-- ============================================================
-- BL-14 · Idempotencia de pagos individuales CxC/CxP.
--
-- Hoy el único freno anti doble-submit es `isPending` del botón: un retry
-- de red (POST reenviado tras timeout cuando el INSERT sí llegó) duplica el
-- cobro/pago si cada monto cabe en el saldo (el guard de sobrepago no lo
-- detecta). El lote CxC ya resolvió esto con idempotencia server-side
-- (RNF-01); aquí se cubre el flujo individual SIN RPC nueva:
--   · columna `client_request_id uuid` (NULL) en `pagos_factura` y
--     `pagos_proveedor`, rellenada por el dialog con un UUID generado por
--     intento de submit;
--   · índice UNIQUE parcial (sólo filas con valor): el retry con el mismo
--     UUID revienta con 23505 y el UI lo traduce a "pago duplicado".
-- NULLs históricos no chocan entre sí (índice parcial). Sin backfill.
-- ============================================================

ALTER TABLE public.pagos_factura
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

ALTER TABLE public.pagos_proveedor
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS pagos_factura_client_request_id_key
  ON public.pagos_factura (client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pagos_proveedor_client_request_id_key
  ON public.pagos_proveedor (client_request_id)
  WHERE client_request_id IS NOT NULL;

COMMENT ON COLUMN public.pagos_factura.client_request_id IS
  'BL-14: UUID generado por intento de submit en el dialog de cobro; dedupe anti doble-submit/retry.';
COMMENT ON COLUMN public.pagos_proveedor.client_request_id IS
  'BL-14: UUID generado por intento de submit en el dialog de pago; dedupe anti doble-submit/retry.';
