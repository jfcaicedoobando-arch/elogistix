-- Ola 4 · N1: claim de timbrado PENDING:<uuid> en factura_notas_credito
-- (mismo patrón que facturas.facturapi_claim_at de 20260720202252). Sin él,
-- dos requests concurrentes a facturapi-emitir-nota-credito timbraban 2 CFDIs.
-- Ola 4 · N4: estado de cancelación SAT en NCs — la edge
-- facturapi-cancelar-nota-credito marcaba 'Cancelada' sin inspeccionar
-- cancellation_status (pending/rejected del Buzón Tributario).

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
