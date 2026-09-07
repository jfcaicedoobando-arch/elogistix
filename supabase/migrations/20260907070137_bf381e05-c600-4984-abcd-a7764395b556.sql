ALTER TABLE public.conceptos_factura
  ALTER COLUMN cantidad TYPE numeric(18, 6) USING cantidad::numeric,
  ALTER COLUMN cantidad SET DEFAULT 1;

ALTER TABLE public.conceptos_factura
  DROP CONSTRAINT IF EXISTS conceptos_factura_cantidad_pos;

ALTER TABLE public.conceptos_factura
  ADD CONSTRAINT conceptos_factura_cantidad_pos CHECK (cantidad > 0);

COMMENT ON COLUMN public.conceptos_factura.cantidad IS
  'Cantidad fiscal del concepto: numeric(18,6) positivo (CFDI 4.0 admite 6 decimales). R170-08.';