ALTER TABLE public.factura_notas_credito
  ADD COLUMN IF NOT EXISTS facturapi_claim_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS cancelacion_solicitada_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelacion_vence_en TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_fnc_facturapi_pending
  ON public.factura_notas_credito (organization_id, facturapi_claim_at)
  WHERE facturapi_id LIKE 'PENDING:%';

COMMENT ON COLUMN public.factura_notas_credito.facturapi_claim_at IS
  'Ola 4 · N1: momento en que facturapi-emitir-nota-credito reclamó la fila con PENDING:<uuid>. NULL cuando ya no hay claim activo.';
COMMENT ON COLUMN public.factura_notas_credito.cancellation_status IS
  'Ola 4 · N4: cancellation_status SAT (none|pending|verifying|accepted|rejected|expired) reportado por FacturAPI.';

ALTER TABLE public.pagos_factura
  ADD COLUMN IF NOT EXISTS rep_cancellation_status TEXT NOT NULL DEFAULT 'none';

COMMENT ON COLUMN public.pagos_factura.rep_cancellation_status IS
  'Ola 4 · N5: cancellation_status SAT del REP (none|pending|verifying|accepted|rejected|expired) reportado por FacturAPI.';