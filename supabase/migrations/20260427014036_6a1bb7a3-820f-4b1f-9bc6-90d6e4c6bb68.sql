-- 1) Backfill: rellenar cotizaciones.embarque_id desde embarques.cotizacion_id
UPDATE public.cotizaciones c
SET embarque_id = e.id
FROM public.embarques e
WHERE e.cotizacion_id = c.id
  AND c.embarque_id IS NULL;

-- 2) Trigger function: mantener cotizaciones.embarque_id sincronizado
CREATE OR REPLACE FUNCTION public.sync_cotizacion_embarque_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cotizacion_id IS NOT NULL THEN
    UPDATE public.cotizaciones
    SET embarque_id = NEW.id,
        updated_at = now()
    WHERE id = NEW.cotizacion_id
      AND (embarque_id IS DISTINCT FROM NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Trigger AFTER INSERT/UPDATE en embarques
DROP TRIGGER IF EXISTS trg_sync_cotizacion_embarque_link ON public.embarques;
CREATE TRIGGER trg_sync_cotizacion_embarque_link
AFTER INSERT OR UPDATE OF cotizacion_id ON public.embarques
FOR EACH ROW
EXECUTE FUNCTION public.sync_cotizacion_embarque_link();