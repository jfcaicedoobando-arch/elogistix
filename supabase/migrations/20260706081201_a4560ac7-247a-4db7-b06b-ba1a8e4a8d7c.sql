ALTER TABLE public.proveedor_facturas
  ADD COLUMN IF NOT EXISTS ieps NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.proveedor_facturas_conceptos
  ADD COLUMN IF NOT EXISTS iva NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ieps NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.proveedor_facturas.ieps IS 'IEPS trasladado total (clave SAT 003). Aplica en fletes, maniobras y otros servicios especiales.';
COMMENT ON COLUMN public.proveedor_facturas_conceptos.iva IS 'IVA trasladado del concepto (parseado del XML CFDI).';
COMMENT ON COLUMN public.proveedor_facturas_conceptos.ieps IS 'IEPS trasladado del concepto (parseado del XML CFDI, clave SAT 003).';