-- P1-5 / P1-6: altas y reemplazos atómicos en costeo (una sola transacción).
-- SECURITY INVOKER: se conservan exactamente las políticas RLS actuales.

CREATE OR REPLACE FUNCTION public.crear_tarifa_con_recargos_rpc(
  p_organization_id uuid, p_tarifa jsonb, p_recargos jsonb
)
RETURNS public.costeo_tarifas
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.costeo_tarifas;
BEGIN
  INSERT INTO public.costeo_tarifas (
    organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id,
    flete_base, dias_libres_demoras, vigente_desde, vigente_hasta,
    transit_time_dias, notas, moneda, estado
  ) VALUES (
    p_organization_id,
    NULLIF(p_tarifa->>'agente_id', '')::uuid,
    NULLIF(p_tarifa->>'naviera_id', '')::uuid,
    NULLIF(p_tarifa->>'ruta_id', '')::uuid,
    NULLIF(p_tarifa->>'tipo_contenedor_id', '')::uuid,
    NULLIF(p_tarifa->>'flete_base', '')::numeric,
    COALESCE(NULLIF(p_tarifa->>'dias_libres_demoras', '')::integer, 0),
    NULLIF(p_tarifa->>'vigente_desde', '')::date,
    NULLIF(p_tarifa->>'vigente_hasta', '')::date,
    NULLIF(p_tarifa->>'transit_time_dias', '')::integer,
    NULLIF(p_tarifa->>'notas', ''),
    'USD',
    'vigente'
  )
  RETURNING * INTO v_row;

  INSERT INTO public.costeo_tarifa_recargos (
    tarifa_id, organization_id, concepto, lado, monto, moneda, incluido_en_total
  )
  SELECT
    v_row.id,
    v_row.organization_id,
    btrim(r->>'concepto'),
    COALESCE(NULLIF(r->>'lado', ''), 'origen'),
    (r->>'monto')::numeric,
    'USD',
    COALESCE((r->>'incluido_en_total')::boolean, true)
  FROM jsonb_array_elements(COALESCE(p_recargos, '[]'::jsonb)) AS r
  WHERE NULLIF(btrim(COALESCE(r->>'concepto', '')), '') IS NOT NULL
    AND COALESCE((r->>'monto')::numeric, 0) > 0;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.crear_tarifa_con_recargos_rpc(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_tarifa_con_recargos_rpc(uuid, jsonb, jsonb) TO authenticated, service_role;

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

REVOKE ALL ON FUNCTION public.reemplazar_demoras_tramos_rpc(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reemplazar_demoras_tramos_rpc(uuid, uuid, jsonb) TO authenticated, service_role;