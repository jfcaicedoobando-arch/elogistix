ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS estado_proforma text NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS folio_factura_externa text,
  ADD COLUMN IF NOT EXISTS fecha_facturacion date;

ALTER TABLE public.proformas
  DROP CONSTRAINT IF EXISTS proformas_estado_proforma_check;

ALTER TABLE public.proformas
  ADD CONSTRAINT proformas_estado_proforma_check
  CHECK (estado_proforma IN ('pendiente', 'facturada'));