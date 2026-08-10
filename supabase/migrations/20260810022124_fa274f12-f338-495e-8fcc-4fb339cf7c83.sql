CREATE OR REPLACE FUNCTION public.actualizar_tarifa_con_recargos_rpc(p_id uuid, p_tarifa jsonb, p_recargos jsonb)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.costeo_tarifas WHERE id = p_id
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_TARIFA_NO_ENCONTRADA';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(v_org) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;

  UPDATE public.costeo_tarifas SET
    agente_id = COALESCE((p_tarifa->>'agente_id')::uuid, agente_id),
    naviera_id = COALESCE((p_tarifa->>'naviera_id')::uuid, naviera_id),
    ruta_id = COALESCE((p_tarifa->>'ruta_id')::uuid, ruta_id),
    tipo_contenedor_id = COALESCE((p_tarifa->>'tipo_contenedor_id')::uuid, tipo_contenedor_id),
    flete_base = COALESCE((p_tarifa->>'flete_base')::numeric, flete_base),
    dias_libres_demoras = COALESCE((p_tarifa->>'dias_libres_demoras')::integer, dias_libres_demoras),
    -- Campos NOT NULL: nunca se anulan en una actualización parcial.
    vigente_desde = COALESCE(NULLIF(p_tarifa->>'vigente_desde', '')::date, vigente_desde),
    vigente_hasta = COALESCE(NULLIF(p_tarifa->>'vigente_hasta', '')::date, vigente_hasta),
    -- Campos opcionales: solo se tocan si la llave viene en el payload.
    transit_time_dias = CASE WHEN p_tarifa ? 'transit_time_dias'
      THEN NULLIF(p_tarifa->>'transit_time_dias', '')::integer ELSE transit_time_dias END,
    notas = CASE WHEN p_tarifa ? 'notas'
      THEN NULLIF(p_tarifa->>'notas', '') ELSE notas END,
    moneda = 'USD',
    updated_at = now()
  WHERE id = p_id;

  DELETE FROM public.costeo_tarifa_recargos WHERE tarifa_id = p_id;

  INSERT INTO public.costeo_tarifa_recargos (
    tarifa_id, organization_id, concepto, lado, monto, moneda, incluido_en_total
  )
  SELECT
    p_id,
    v_org,
    btrim(r->>'concepto'),
    COALESCE(NULLIF(r->>'lado', ''), 'origen'),
    (r->>'monto')::numeric,
    'USD',
    COALESCE((r->>'incluido_en_total')::boolean, true)
  FROM jsonb_array_elements(COALESCE(p_recargos, '[]'::jsonb)) AS r
  WHERE NULLIF(btrim(COALESCE(r->>'concepto', '')), '') IS NOT NULL
    AND COALESCE((r->>'monto')::numeric, 0) > 0;
END;
$function$;

REVOKE ALL ON FUNCTION public.actualizar_tarifa_con_recargos_rpc(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.actualizar_tarifa_con_recargos_rpc(uuid, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.actualizar_tarifa_con_recargos_rpc(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_tarifa_con_recargos_rpc(uuid, jsonb, jsonb) TO service_role;