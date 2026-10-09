CREATE OR REPLACE FUNCTION public.reemplazar_demoras_tramos_rpc(
  p_naviera_condicion_id uuid, p_tipo_contenedor_id uuid, p_tramos jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_count integer;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.costeo_navieras_condiciones
  WHERE id = p_naviera_condicion_id
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_CONDICION_NAVIERA_NO_ENCONTRADA';
  END IF;

  -- Validar antes de borrar: conservar íntegro el tabulador anterior ante error.
  IF (SELECT COUNT(DISTINCT COALESCE(NULLIF(t->>'moneda', ''), 'USD'))
      FROM jsonb_array_elements(COALESCE(p_tramos, '[]'::jsonb)) AS t) > 1 THEN
    RAISE EXCEPTION 'LC_DEMORAS_MONEDAS_MIXTAS: el tabulador de este tipo de contenedor mezcla monedas. Usa una sola moneda por tabulador; no hay conversión automática.';
  END IF;

  DELETE FROM public.costeo_naviera_demoras_tarifa
  WHERE naviera_condicion_id = p_naviera_condicion_id
    AND tipo_contenedor_id = p_tipo_contenedor_id;

  INSERT INTO public.costeo_naviera_demoras_tarifa (
    naviera_condicion_id, organization_id, tipo_contenedor_id,
    desde_dia, hasta_dia, monto_por_dia, moneda
  )
  SELECT
    p_naviera_condicion_id,
    v_org,
    p_tipo_contenedor_id,
    (t->>'desde_dia')::integer,
    NULLIF(t->>'hasta_dia', '')::integer,
    (t->>'monto_por_dia')::numeric,
    COALESCE(NULLIF(t->>'moneda', ''), 'USD')
  FROM jsonb_array_elements(COALESCE(p_tramos, '[]'::jsonb)) AS t;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;
