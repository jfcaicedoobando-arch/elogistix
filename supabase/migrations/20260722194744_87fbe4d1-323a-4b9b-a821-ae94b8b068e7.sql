ALTER TABLE public.conceptos_costo
  DROP CONSTRAINT IF EXISTS conceptos_costo_origen_check;

ALTER TABLE public.conceptos_costo
  ADD CONSTRAINT conceptos_costo_origen_check
  CHECK (origen = ANY (ARRAY[
    'manual'::text,
    'demoras_auto'::text,
    'cotizacion'::text,
    'costeo_tarifa'::text,
    'ajuste_factura_proveedor'::text
  ]));

COMMENT ON CONSTRAINT conceptos_costo_origen_check ON public.conceptos_costo IS
  'v13.307.13: Se agrega ajuste_factura_proveedor para permitir renglones de ajuste creados por crearAjustesFacturaProveedor cuando el proveedor factura distinto al devengado.';