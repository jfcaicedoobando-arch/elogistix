ALTER TABLE public.proveedor_facturas
  ADD COLUMN IF NOT EXISTS origen_carga text NOT NULL DEFAULT 'manual'
  CHECK (origen_carga IN ('manual','cfdi','pdf_ia'));

COMMENT ON COLUMN public.proveedor_facturas.origen_carga IS
  'Cómo se capturó la factura: manual, cfdi (XML CFDI mexicano) o pdf_ia (PDF extraído por IA para proveedores internacionales).';