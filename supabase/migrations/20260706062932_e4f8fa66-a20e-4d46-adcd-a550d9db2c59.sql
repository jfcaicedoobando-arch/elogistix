ALTER TABLE public.factura_notas_credito ADD COLUMN IF NOT EXISTS xml_backup_path text;
COMMENT ON COLUMN public.factura_notas_credito.xml_backup_path IS 'Ola 3 · Item 5 — Ruta en storage.facturas del respaldo XML timbrado de la nota de crédito.';

ALTER TABLE public.pagos_factura ADD COLUMN IF NOT EXISTS rep_xml_backup_path text;
COMMENT ON COLUMN public.pagos_factura.rep_xml_backup_path IS 'Ola 3 · Item 5 — Ruta en storage.facturas del respaldo XML timbrado del REP.';