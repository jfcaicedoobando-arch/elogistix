CREATE OR REPLACE FUNCTION public.actualizar_tarifa_con_recargos_rpc(
  p_id uuid, p_tarifa jsonb, p_recargos jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_es_agente_dueno boolean := false;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.costeo_tarifas WHERE id = p_id
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_TARIFA_NO_ENCONTRADA';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.costeo_tarifas t
    WHERE t.id = p_id
      AND public.has_role(auth.uid(), 'agente_carga'::app_role)
      AND t.agente_id = public.current_agente_id()
      AND t.organization_id = public.current_agente_org()
      AND t.estado_aprobacion = ANY (ARRAY['borrador'::text, 'rechazada'::text])
  ) INTO v_es_agente_dueno;

  IF auth.uid() IS NOT NULL
     AND NOT public.is_org_member(v_org)
     AND NOT v_es_agente_dueno THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;

  IF v_es_agente_dueno AND NOT public.is_org_member(v_org) THEN
    p_tarifa := jsonb_set(
      COALESCE(p_tarifa, '{}'::jsonb),
      '{agente_id}',
      to_jsonb(public.current_agente_id()::text)
    );
  END IF;

  UPDATE public.costeo_tarifas SET
    agente_id = CASE WHEN p_tarifa ? 'agente_id'
      THEN NULLIF(p_tarifa->>'agente_id', '')::uuid ELSE agente_id END,
    naviera_id = CASE WHEN p_tarifa ? 'naviera_id'
      THEN NULLIF(p_tarifa->>'naviera_id', '')::uuid ELSE naviera_id END,
    ruta_id = CASE WHEN p_tarifa ? 'ruta_id'
      THEN NULLIF(p_tarifa->>'ruta_id', '')::uuid ELSE ruta_id END,
    tipo_contenedor_id = CASE WHEN p_tarifa ? 'tipo_contenedor_id'
      THEN NULLIF(p_tarifa->>'tipo_contenedor_id', '')::uuid ELSE tipo_contenedor_id END,
    flete_base = CASE WHEN p_tarifa ? 'flete_base'
      THEN NULLIF(p_tarifa->>'flete_base', '')::numeric ELSE flete_base END,
    dias_libres_demoras = CASE WHEN p_tarifa ? 'dias_libres_demoras'
      THEN NULLIF(p_tarifa->>'dias_libres_demoras', '')::integer ELSE dias_libres_demoras END,
    vigente_desde = COALESCE(NULLIF(p_tarifa->>'vigente_desde', '')::date, vigente_desde),
    vigente_hasta = COALESCE(NULLIF(p_tarifa->>'vigente_hasta', '')::date, vigente_hasta),
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