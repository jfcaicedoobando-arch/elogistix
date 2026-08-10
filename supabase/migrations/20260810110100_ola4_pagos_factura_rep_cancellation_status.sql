-- Ola 4 · N5: estado de cancelación SAT del REP (Complemento de Pagos).
-- La edge facturapi-cancelar-rep marcaba estado_rep='Cancelado' sin
-- inspeccionar cancellation_status (pending/rejected del Buzón Tributario).

ALTER TABLE public.pagos_factura
  ADD COLUMN IF NOT EXISTS rep_cancellation_status TEXT NOT NULL DEFAULT 'none';

COMMENT ON COLUMN public.pagos_factura.rep_cancellation_status IS
  'Ola 4 · N5: cancellation_status SAT del REP (none|pending|verifying|accepted|rejected|expired) reportado por FacturAPI.';
