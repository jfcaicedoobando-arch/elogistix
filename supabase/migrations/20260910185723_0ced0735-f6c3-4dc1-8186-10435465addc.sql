ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS tipo_cambio_usd numeric;

ALTER TABLE public.cotizaciones
  DROP CONSTRAINT IF EXISTS cotizaciones_tipo_cambio_usd_positivo;

ALTER TABLE public.cotizaciones
  ADD CONSTRAINT cotizaciones_tipo_cambio_usd_positivo
  CHECK (tipo_cambio_usd IS NULL OR tipo_cambio_usd > 0) NOT VALID;

COMMENT ON COLUMN public.cotizaciones.tipo_cambio_usd IS
  'TC USD/MXN congelado en la cotizacion. Solo se usa para expresar el subtotal del encabezado cuando hay conceptos de venta en ambas monedas; los conceptos conservan su moneda e importe original.';