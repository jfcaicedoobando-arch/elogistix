ALTER TABLE public.proveedor_notas_credito
  ADD COLUMN IF NOT EXISTS archivo_xml_url text,
  ADD COLUMN IF NOT EXISTS archivo_pdf_url text,
  ADD COLUMN IF NOT EXISTS uuid_fiscal text,
  ADD COLUMN IF NOT EXISTS uuid_estatus_sat text,
  ADD COLUMN IF NOT EXISTS uuid_verificado_fecha timestamptz;

-- Mantener índices útiles para búsquedas por UUID fiscal y URLs de archivo
CREATE INDEX IF NOT EXISTS idx_proveedor_notas_credito_uuid_fiscal
  ON public.proveedor_notas_credito(uuid_fiscal)
  WHERE uuid_fiscal IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proveedor_notas_credito_archivos
  ON public.proveedor_notas_credito(archivo_xml_url, archivo_pdf_url)
  WHERE archivo_xml_url IS NOT NULL OR archivo_pdf_url IS NOT NULL;
