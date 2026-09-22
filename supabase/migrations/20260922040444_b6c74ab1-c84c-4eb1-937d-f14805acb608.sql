-- Etapa 3 · Identidad explícita de puertos: cotizacion → tarifa → embarque.
ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS puerto_origen_id uuid NULL REFERENCES public.puertos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS puerto_destino_id uuid NULL REFERENCES public.puertos(id) ON DELETE SET NULL;

ALTER TABLE public.embarques
  ADD COLUMN IF NOT EXISTS puerto_origen_id uuid NULL REFERENCES public.puertos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS puerto_destino_id uuid NULL REFERENCES public.puertos(id) ON DELETE SET NULL;

-- Backfill (a): cotizaciones marítimas con tarifa vinculada → ruta de la tarifa.
UPDATE public.cotizaciones c
   SET puerto_origen_id = r.puerto_origen_id,
       puerto_destino_id = r.puerto_destino_id
  FROM public.costeo_tarifas t
  JOIN public.costeo_rutas r ON r.id = t.ruta_id
 WHERE c.tarifa_id = t.id
   AND t.organization_id = c.organization_id
   AND c.modo::text = 'Marítimo'
   AND c.puerto_origen_id IS NULL
   AND r.puerto_origen_id IS DISTINCT FROM r.puerto_destino_id;

-- Backfill (b): embarques vinculados a una cotización heredan sus IDs.
UPDATE public.embarques e
   SET puerto_origen_id = c.puerto_origen_id,
       puerto_destino_id = c.puerto_destino_id
  FROM public.cotizaciones c
 WHERE e.cotizacion_id = c.id
   AND e.modo::text = 'Marítimo'
   AND e.puerto_origen_id IS NULL
   AND c.puerto_origen_id IS NOT NULL;

-- Backfill (c): embarques con tarifa propia y aún sin IDs.
UPDATE public.embarques e
   SET puerto_origen_id = r.puerto_origen_id,
       puerto_destino_id = r.puerto_destino_id
  FROM public.costeo_tarifas t
  JOIN public.costeo_rutas r ON r.id = t.ruta_id
 WHERE t.id = COALESCE(e.tarifa_id_aplicada, e.tarifa_id)
   AND t.organization_id = e.organization_id
   AND e.modo::text = 'Marítimo'
   AND e.puerto_origen_id IS NULL
   AND r.puerto_origen_id IS DISTINCT FROM r.puerto_destino_id;

-- Invariante: origen ≠ destino cuando ambos están presentes.
ALTER TABLE public.cotizaciones
  DROP CONSTRAINT IF EXISTS cotizaciones_puertos_distintos_chk;
ALTER TABLE public.cotizaciones
  ADD CONSTRAINT cotizaciones_puertos_distintos_chk
  CHECK (puerto_origen_id IS NULL OR puerto_destino_id IS NULL OR puerto_origen_id <> puerto_destino_id);

ALTER TABLE public.embarques
  DROP CONSTRAINT IF EXISTS embarques_puertos_distintos_chk;
ALTER TABLE public.embarques
  ADD CONSTRAINT embarques_puertos_distintos_chk
  CHECK (puerto_origen_id IS NULL OR puerto_destino_id IS NULL OR puerto_origen_id <> puerto_destino_id);

-- Trigger: la ruta de la tarifa es la fuente de verdad de los puertos.
CREATE OR REPLACE FUNCTION public._cotizaciones_sync_puertos_tarifa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_o uuid;
  v_d uuid;
BEGIN
  IF NEW.modo::text <> 'Marítimo' THEN
    NEW.puerto_origen_id := NULL;
    NEW.puerto_destino_id := NULL;
    RETURN NEW;
  END IF;

  IF NEW.tarifa_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT r.puerto_origen_id, r.puerto_destino_id
    INTO v_o, v_d
    FROM public.costeo_tarifas t
    JOIN public.costeo_rutas r ON r.id = t.ruta_id
   WHERE t.id = NEW.tarifa_id
     AND t.organization_id = NEW.organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_COT_TARIFA_ORG_INVALIDA: la tarifa % no pertenece a la organización de la cotización.', NEW.tarifa_id
      USING ERRCODE = 'P0001';
  END IF;

  NEW.puerto_origen_id := v_o;
  NEW.puerto_destino_id := v_d;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cotizaciones_sync_puertos_tarifa ON public.cotizaciones;
CREATE TRIGGER trg_cotizaciones_sync_puertos_tarifa
BEFORE INSERT OR UPDATE OF modo, tarifa_id, puerto_origen_id, puerto_destino_id
ON public.cotizaciones
FOR EACH ROW EXECUTE FUNCTION public._cotizaciones_sync_puertos_tarifa();