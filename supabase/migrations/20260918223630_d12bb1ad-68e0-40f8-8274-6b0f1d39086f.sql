ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS facturapi_pendiente_id text,
  ADD COLUMN IF NOT EXISTS facturapi_pendiente_at timestamptz;

ALTER TABLE public.factura_notas_credito
  ADD COLUMN IF NOT EXISTS facturapi_pendiente_id text,
  ADD COLUMN IF NOT EXISTS facturapi_pendiente_at timestamptz;

ALTER TABLE public.pagos_factura
  ADD COLUMN IF NOT EXISTS facturapi_rep_pendiente_id text,
  ADD COLUMN IF NOT EXISTS facturapi_rep_pendiente_at timestamptz;

COMMENT ON COLUMN public.facturas.facturapi_pendiente_id IS 'ID remoto de FacturAPI cuando el timbrado respondió status=pending (sin UUID). No implica CFDI timbrado.';
COMMENT ON COLUMN public.factura_notas_credito.facturapi_pendiente_id IS 'ID remoto de FacturAPI cuando el timbrado de la NC respondió status=pending (sin UUID).';
COMMENT ON COLUMN public.pagos_factura.facturapi_rep_pendiente_id IS 'ID remoto de FacturAPI cuando el timbrado del REP respondió status=pending (sin UUID).';

CREATE INDEX IF NOT EXISTS idx_facturas_facturapi_pendiente_id
  ON public.facturas (facturapi_pendiente_id)
  WHERE facturapi_pendiente_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fnc_facturapi_pendiente_id
  ON public.factura_notas_credito (facturapi_pendiente_id)
  WHERE facturapi_pendiente_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pagos_factura_rep_pendiente_id
  ON public.pagos_factura (facturapi_rep_pendiente_id)
  WHERE facturapi_rep_pendiente_id IS NOT NULL;