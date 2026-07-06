-- v13.205.3.b — Regla más estricta: los borradores solo cuentan si tienen
-- conceptos_venta vinculados. Los montos manuales sin conceptos ya no encienden
-- el badge (evita ambigüedad tipo ELIMP00207 con total_usd=3920 y 0 conceptos).

CREATE OR REPLACE FUNCTION public.recompute_embarque_tiene_proforma(p_embarque_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_embarque_id IS NULL THEN
    RETURN;
  END IF;
  PERFORM set_config('app.bypass_cierre', 'on', true);
  UPDATE public.embarques e
  SET tiene_proforma = EXISTS (
    SELECT 1
    FROM public.proformas p
    WHERE p.embarque_id = e.id
      AND (
        COALESCE(p.estado_aprobacion, 'aprobada') <> 'borrador'
        OR EXISTS (
          SELECT 1 FROM public.conceptos_venta cv
          WHERE cv.proforma_id = p.id
        )
      )
  )
  WHERE e.id = p_embarque_id;
END;
$$;

DO $$
BEGIN
  PERFORM set_config('app.bypass_cierre', 'on', true);
  UPDATE public.embarques e
  SET tiene_proforma = EXISTS (
    SELECT 1
    FROM public.proformas p
    WHERE p.embarque_id = e.id
      AND (
        COALESCE(p.estado_aprobacion, 'aprobada') <> 'borrador'
        OR EXISTS (
          SELECT 1 FROM public.conceptos_venta cv
          WHERE cv.proforma_id = p.id
        )
      )
  );
END $$;
