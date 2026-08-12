-- EF-03 (auditoría edge functions): la reconciliación de cancelaciones de NC
-- necesita persistir el acuse SAT igual que las facturas (conservación 5 años).

ALTER TABLE public.factura_notas_credito
  ADD COLUMN IF NOT EXISTS acuse_cancelacion_xml TEXT,
  ADD COLUMN IF NOT EXISTS acuse_cancelacion_fecha TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acuse_cancelacion_status TEXT;

COMMENT ON COLUMN public.factura_notas_credito.acuse_cancelacion_xml IS 'XML de acuse de cancelación SAT de la NC (recibido vía FacturApi). Obligatorio conservar por 5 años (SAT 2022+).';
COMMENT ON COLUMN public.factura_notas_credito.acuse_cancelacion_fecha IS 'Timestamp en que se descargó y guardó el acuse SAT de la NC.';
COMMENT ON COLUMN public.factura_notas_credito.acuse_cancelacion_status IS 'Estado de la descarga del acuse (accepted/pending/error_*).';
