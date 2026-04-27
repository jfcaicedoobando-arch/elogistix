-- 1) Backfill: cualquier cotización Aceptada con embarque vinculado pasa a 'En operación'
UPDATE public.cotizaciones
SET estado = 'En operación'::estado_cotizacion,
    updated_at = now()
WHERE estado = 'Aceptada'::estado_cotizacion
  AND embarque_id IS NOT NULL;

-- 2) Reinstalar el trigger de sincronización (la función ya existe con la lógica correcta)
DROP TRIGGER IF EXISTS trg_sync_cotizacion_embarque_link ON public.embarques;
CREATE TRIGGER trg_sync_cotizacion_embarque_link
AFTER INSERT OR UPDATE OF cotizacion_id ON public.embarques
FOR EACH ROW
EXECUTE FUNCTION public.sync_cotizacion_embarque_link();