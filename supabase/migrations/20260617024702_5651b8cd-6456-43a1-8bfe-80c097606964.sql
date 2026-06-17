-- Add 'Por timbrar' to estado_factura enum
ALTER TYPE estado_factura ADD VALUE IF NOT EXISTS 'Por timbrar' BEFORE 'Emitida';

-- Columns on facturas for Facturapi integration
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS facturapi_id text,
  ADD COLUMN IF NOT EXISTS serie text,
  ADD COLUMN IF NOT EXISTS timbrado_en timestamptz,
  ADD COLUMN IF NOT EXISTS timbrado_por uuid,
  ADD COLUMN IF NOT EXISTS cancelacion_motivo text,
  ADD COLUMN IF NOT EXISTS cancelado_en timestamptz,
  ADD COLUMN IF NOT EXISTS enviada_cliente_at timestamptz;

-- Fiscal columns on clientes (idempotent)
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS codigo_postal text,
  ADD COLUMN IF NOT EXISTS regimen_fiscal text,
  ADD COLUMN IF NOT EXISTS uso_cfdi_default text;

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_facturas_facturapi_id ON public.facturas(facturapi_id) WHERE facturapi_id IS NOT NULL;
