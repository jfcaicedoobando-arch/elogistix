CREATE OR REPLACE FUNCTION public.crear_tarifa_con_recargos_rpc(p_organization_id uuid, p_tarifa jsonb, p_recargos jsonb)
 RETURNS costeo_tarifas
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.costeo_tarifas;
BEGIN
  INSERT INTO public.costeo_tarifas (
    organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id,
    flete_base, dias_libres_demoras, vigente_desde, vigente_hasta,
    transit_time_dias, notas, moneda, estado,
    solicitud_pricing_id, carta_garantia, unidad_flete
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
    'vigente',
    NULLIF(p_tarifa->>'solicitud_pricing_id', '')::uuid,
    NULLIF(p_tarifa->>'carta_garantia', '')::boolean,
    NULLIF(btrim(COALESCE(p_tarifa->>'unidad_flete', '')), '')
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
