
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS acuse_cancelacion_xml TEXT,
  ADD COLUMN IF NOT EXISTS acuse_cancelacion_fecha TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acuse_cancelacion_status TEXT;

COMMENT ON COLUMN public.facturas.acuse_cancelacion_xml IS 'XML de acuse de cancelación emitido por el SAT (recibido vía FacturApi). Obligatorio conservar por 5 años (SAT 2022+).';
COMMENT ON COLUMN public.facturas.acuse_cancelacion_fecha IS 'Timestamp en que se descargó y guardó el acuse SAT.';
COMMENT ON COLUMN public.facturas.acuse_cancelacion_status IS 'Estado devuelto por SAT al descargar el acuse (accepted/pending/rejected/error).';
