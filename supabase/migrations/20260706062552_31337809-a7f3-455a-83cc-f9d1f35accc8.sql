ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS factura_xml_backup_path text;

COMMENT ON COLUMN public.facturas.factura_xml_backup_path IS
  'Ruta al XML respaldado en el bucket privado `facturas` (Ola 3 · Item 5). Best-effort tras cada timbrado.';