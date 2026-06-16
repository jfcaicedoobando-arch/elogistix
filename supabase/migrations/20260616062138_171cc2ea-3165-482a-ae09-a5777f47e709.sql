ALTER TABLE public.cotizaciones
ADD COLUMN IF NOT EXISTS sin_desglose_costos boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.cotizaciones.sin_desglose_costos IS 'Marca cotizaciones creadas con el atajo "sin desglose". El embarque derivado queda bloqueado hasta que existan filas en cotizacion_costos.';