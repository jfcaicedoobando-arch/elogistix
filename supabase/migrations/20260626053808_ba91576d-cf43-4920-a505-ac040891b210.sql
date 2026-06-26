
-- Agregar valor 'Timbrada' al enum estado_nota_credito
ALTER TYPE public.estado_nota_credito ADD VALUE IF NOT EXISTS 'Timbrada' BEFORE 'Aplicada';

-- Columnas fiscales y de conceptos para soportar timbrado FacturApi
ALTER TABLE public.factura_notas_credito
  ADD COLUMN IF NOT EXISTS serie text,
  ADD COLUMN IF NOT EXISTS folio_fiscal bigint,
  ADD COLUMN IF NOT EXISTS facturapi_id text,
  ADD COLUMN IF NOT EXISTS uuid_fiscal text,
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS xml_url text,
  ADD COLUMN IF NOT EXISTS uso_cfdi text,
  ADD COLUMN IF NOT EXISTS forma_pago text,
  ADD COLUMN IF NOT EXISTS conceptos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS timbrado_en timestamptz,
  ADD COLUMN IF NOT EXISTS timbrado_por uuid,
  ADD COLUMN IF NOT EXISTS cancelado_en timestamptz,
  ADD COLUMN IF NOT EXISTS cancelacion_motivo text;

CREATE INDEX IF NOT EXISTS idx_factura_notas_credito_uuid_fiscal
  ON public.factura_notas_credito (uuid_fiscal)
  WHERE uuid_fiscal IS NOT NULL;
