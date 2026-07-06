
-- α.1: Agregar clave_unidad a conceptos_factura y conceptos_costo/proveedor_facturas_conceptos
-- para dejar de hardcodear "E48" al timbrar CFDIs.

ALTER TABLE public.conceptos_factura
  ADD COLUMN IF NOT EXISTS clave_unidad text NOT NULL DEFAULT 'E48';

COMMENT ON COLUMN public.conceptos_factura.clave_unidad IS
  'Clave SAT de unidad de medida (c_ClaveUnidad). Default E48 = Unidad de servicio.';

ALTER TABLE public.proveedor_facturas_conceptos
  ADD COLUMN IF NOT EXISTS clave_unidad text;

COMMENT ON COLUMN public.proveedor_facturas_conceptos.clave_unidad IS
  'Clave SAT de unidad de medida parseada del XML CFDI del proveedor.';
