ALTER TABLE public.embarque_facturas_entrantes
  ADD COLUMN IF NOT EXISTS xml_path text,
  ADD COLUMN IF NOT EXISTS xml_nombre text,
  ADD COLUMN IF NOT EXISTS xml_hash text,
  ADD COLUMN IF NOT EXISTS uuid_fiscal text,
  ADD COLUMN IF NOT EXISTS rfc_emisor text,
  ADD COLUMN IF NOT EXISTS folio_serie text,
  ADD COLUMN IF NOT EXISTS fecha_emision date;

COMMENT ON COLUMN public.embarque_facturas_entrantes.xml_path IS 'Ruta en el bucket cxp-inbox del XML del CFDI que acompana al PDF (proveedores mexicanos).';
COMMENT ON COLUMN public.embarque_facturas_entrantes.uuid_fiscal IS 'UUID del TimbreFiscalDigital extraido del XML; unico por organizacion.';

DROP INDEX IF EXISTS public.uq_efe_uuid_fiscal;
CREATE UNIQUE INDEX uq_efe_uuid_fiscal
  ON public.embarque_facturas_entrantes (organization_id, uuid_fiscal)
  WHERE uuid_fiscal IS NOT NULL AND deleted_at IS NULL;